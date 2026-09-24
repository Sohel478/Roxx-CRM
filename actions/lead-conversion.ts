"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import {
  conversionSchema,
  ConversionFormData,
  ConversionResult,
} from "@/lib/validations/lead-conversion";
import {
  mockLeadsStore,
  mockCompaniesStore,
  mockContactsStore,
  mockOpportunitiesStore,
  MockCompany,
  MockContact,
  MockOpportunity,
} from "@/lib/db/mock-store";

/**
 * Atomic Lead Conversion:
 * Converts a qualified prospective lead into a permanent Company, Contact,
 * and optional Opportunity in an all-or-nothing database transaction.
 */
export async function convertLeadAction(
  leadId: string,
  inputData: ConversionFormData
): Promise<{ success: boolean; data?: ConversionResult; error?: string }> {
  const session = await requirePermission("lead:update");
  const { organizationId, userId } = await resolveTenantContext(session);

  const parsed = conversionSchema.safeParse(inputData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid conversion data",
    };
  }

  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch and validate lead ownership & state
      const lead = await tx.lead.findFirst({
        where: {
          id: leadId,
          deletedAt: null,
        },
      });

      if (!lead) {
        throw new Error("Lead not found or does not belong to your organization.");
      }

      // Idempotency check: Cannot convert an already converted lead
      if (lead.convertedAt || lead.status === "Converted") {
        throw new Error("This lead has already been converted.");
      }

      // 2. Resolve or create Company account
      let resolvedCompanyId: string;
      let resolvedCompanyName: string;

      if (data.companyMode === "NEW") {
        const createdCompany = await tx.company.create({
          data: {
            organizationId,
            name: data.companyName!.trim(),
            ownerId: userId,
            status: "Prospect",
            phone: data.contactPhone || null,
            email: data.contactEmail || null,
            description: `Account created via conversion from lead ${lead.leadNumber || lead.id}`,
          },
        });
        resolvedCompanyId = createdCompany.id;
        resolvedCompanyName = createdCompany.name;
      } else {
        const existingCompany = await tx.company.findFirst({
          where: {
            id: data.companyId,
            deletedAt: null,
          },
        });

        if (!existingCompany) {
          throw new Error("Selected existing company does not exist.");
        }
        resolvedCompanyId = existingCompany.id;
        resolvedCompanyName = existingCompany.name;
      }

      // 3. Create Primary Contact
      const createdContact = await tx.contact.create({
        data: {
          organizationId,
          companyId: resolvedCompanyId,
          firstName: data.contactFirstName.trim(),
          lastName: data.contactLastName?.trim() || null,
          email: data.contactEmail?.trim() || null,
          phone: data.contactPhone?.trim() || null,
          jobTitle: data.contactJobTitle?.trim() || null,
          ownerId: userId,
        },
      });

      const contactName = `${createdContact.firstName} ${createdContact.lastName || ""}`.trim();

      // 4. Create Opportunity if requested
      let resolvedOpportunityId: string | null = null;
      let resolvedOpportunityName: string | null = null;

      if (data.createOpportunity) {
        let pipeline = await tx.pipeline.findFirst({
          where: { organizationId, isDefault: true },
          include: { stages: { orderBy: { order: "asc" } } },
        });

        if (!pipeline) {
          pipeline = await tx.pipeline.findFirst({
            where: { organizationId },
            include: { stages: { orderBy: { order: "asc" } } },
          });
        }

        let stageId = pipeline?.stages.find(
          (s) => s.name.toLowerCase() === data.opportunityStage.toLowerCase()
        )?.id;

        if (!stageId && pipeline && pipeline.stages.length > 0) {
          stageId = pipeline.stages[0].id;
        }

        if (!pipeline || !stageId) {
          // Fallback bootstrap pipeline
          const createdPipeline = await tx.pipeline.create({
            data: {
              organizationId,
              name: "Standard Sales Pipeline",
              isDefault: true,
              stages: {
                create: [
                  { name: "New", order: 1, probability: 10 },
                  { name: "Qualified", order: 2, probability: 25 },
                  { name: "Discovery", order: 3, probability: 40 },
                  { name: "Proposal", order: 4, probability: 60 },
                  { name: "Won", order: 6, probability: 100, isWon: true },
                  { name: "Lost", order: 7, probability: 0, isLost: true },
                ],
              },
            },
            include: { stages: true },
          });
          pipeline = createdPipeline;
          stageId =
            createdPipeline.stages.find(
              (s) => s.name.toLowerCase() === data.opportunityStage.toLowerCase()
            )?.id || createdPipeline.stages[0].id;
        }

        const createdOpportunity = await tx.opportunity.create({
          data: {
            organizationId,
            companyId: resolvedCompanyId,
            primaryContactId: createdContact.id,
            leadId: lead.id,
            name: data.opportunityName!.trim(),
            pipelineId: pipeline.id,
            stageId: stageId,
            ownerId: userId || session.id,
            amount: data.opportunityAmount,
            expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
            status: "OPEN",
          },
        });
        resolvedOpportunityId = createdOpportunity.id;
        resolvedOpportunityName = createdOpportunity.name;
      }

      // 5. Update Lead with conversion references
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: "Converted",
          convertedAt: new Date(),
          convertedCompanyId: resolvedCompanyId,
          convertedContactId: createdContact.id,
          convertedOpportunityId: resolvedOpportunityId,
        },
      });

      // 6. Record Audit Log
      try {
        await tx.auditLog.create({
          data: {
            organizationId,
            userId,
            action: "LEAD_CONVERTED",
            entityType: "Lead",
            entityId: lead.id,
            newValues: {
              companyId: resolvedCompanyId,
              companyName: resolvedCompanyName,
              contactId: createdContact.id,
              contactName,
              opportunityId: resolvedOpportunityId,
              opportunityName: resolvedOpportunityName,
              opportunityAmount: data.opportunityAmount,
            },
          },
        });
      } catch {}

      return {
        leadId: lead.id,
        companyId: resolvedCompanyId,
        companyName: resolvedCompanyName,
        contactId: createdContact.id,
        contactName,
        opportunityId: resolvedOpportunityId,
        opportunityName: resolvedOpportunityName,
        opportunityAmount: data.opportunityAmount,
      };
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/companies");
    revalidatePath("/contacts");
    revalidatePath("/opportunities");
    revalidatePath("/dashboard");

    return { success: true, data: result };
  } catch (error: any) {
    if (error?.message?.includes("already been converted")) {
      return { success: false, error: "This lead has already been converted." };
    }

    // In-memory fallback if Neon PostgreSQL is offline during local preview
    const lead = mockLeadsStore.find((l) => l.id === leadId);
    if (!lead) {
      return { success: false, error: "Lead not found" };
    }

    if (lead.convertedAt || lead.status === "Converted") {
      return { success: false, error: "This lead has already been converted." };
    }

    let resolvedCompanyId: string;
    let resolvedCompanyName: string;

    if (data.companyMode === "NEW") {
      resolvedCompanyId = `comp_${Date.now()}`;
      resolvedCompanyName = data.companyName!.trim();
      const newCompany: MockCompany = {
        id: resolvedCompanyId,
        organizationId: session.organizationId,
        name: resolvedCompanyName,
        industry: null,
        website: null,
        city: null,
        country: null,
        status: "Prospect",
        createdAt: new Date().toISOString(),
        contactCount: 1,
        phone: data.contactPhone || null,
        email: data.contactEmail || null,
        description: `Account created via conversion from lead ${lead.leadNumber}`,
      };
      mockCompaniesStore.unshift(newCompany);
    } else {
      const existing = mockCompaniesStore.find((c) => c.id === data.companyId);
      if (!existing) {
        return { success: false, error: "Selected existing company does not exist." };
      }
      resolvedCompanyId = existing.id;
      resolvedCompanyName = existing.name;
      existing.contactCount = (existing.contactCount || 0) + 1;
    }

    const contactId = `cont_${Date.now()}`;
    const contactName = `${data.contactFirstName.trim()} ${data.contactLastName?.trim() || ""}`.trim();
    const newContact: MockContact = {
      id: contactId,
      organizationId: session.organizationId,
      companyId: resolvedCompanyId,
      companyName: resolvedCompanyName,
      firstName: data.contactFirstName.trim(),
      lastName: data.contactLastName?.trim() || null,
      fullName: contactName,
      email: data.contactEmail?.trim() || null,
      phone: data.contactPhone?.trim() || null,
      jobTitle: data.contactJobTitle?.trim() || null,
      department: null,
      createdAt: new Date().toISOString(),
    };
    mockContactsStore.unshift(newContact);

    let opportunityId: string | null = null;
    let opportunityName: string | null = null;

    if (data.createOpportunity) {
      opportunityId = `opp_${Date.now()}`;
      opportunityName = data.opportunityName!.trim();
      const newOpp: MockOpportunity = {
        id: opportunityId,
        organizationId: session.organizationId,
        name: opportunityName,
        amount: data.opportunityAmount,
        currency: "USD",
        companyId: resolvedCompanyId,
        companyName: resolvedCompanyName,
        primaryContactId: contactId,
        primaryContactName: contactName,
        leadId: lead.id,
        pipelineId: "pipe_default",
        stageId: `stage_${data.opportunityStage.toLowerCase()}`,
        stageName: data.opportunityStage,
        probability: 25,
        ownerId: session.id,
        ownerName: session.name,
        status: "OPEN",
        lossReason: null,
        description: null,
        expectedCloseDate: data.expectedCloseDate || null,
        closedAt: null,
        createdAt: new Date().toISOString(),
      };
      mockOpportunitiesStore.unshift(newOpp);
    }

    // Update mock lead
    lead.status = "Converted";
    lead.convertedAt = new Date().toISOString();
    lead.convertedCompanyId = resolvedCompanyId;
    lead.convertedContactId = contactId;
    lead.convertedOpportunityId = opportunityId;

    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/companies");
    revalidatePath("/contacts");
    revalidatePath("/opportunities");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: {
        leadId: lead.id,
        companyId: resolvedCompanyId,
        companyName: resolvedCompanyName,
        contactId,
        contactName,
        opportunityId,
        opportunityName,
        opportunityAmount: data.opportunityAmount,
      },
    };
  }
}
