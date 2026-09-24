"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requirePermission } from "@/lib/auth/session";
import {
  mockOpportunitiesStore,
  mockCompaniesStore,
  mockContactsStore,
  MockOpportunity,
} from "@/lib/db/mock-store";
import {
  opportunitySchema,
  closeOpportunitySchema,
  PIPELINE_STAGES,
  OpportunityFormData,
  CloseOpportunityFormData,
  OpportunityItem,
} from "@/lib/validations/opportunities";

export type { OpportunityItem, OpportunityFormData, CloseOpportunityFormData };

/**
 * Fetch all opportunities with stage metrics and totals
 */
export async function getOpportunitiesAction(params: {
  search?: string;
  stageName?: string;
  status?: "OPEN" | "WON" | "LOST" | "ALL";
  ownerId?: string;
} = {}) {
  const session = await requireAuth();

  try {
    const where: any = {
      organizationId: session.organizationId,
      deletedAt: null,
    };

    if (params.status && params.status !== "ALL") {
      where.status = params.status;
    }

    if (params.stageName && params.stageName !== "ALL") {
      where.stage = { name: params.stageName };
    }

    if (params.ownerId && params.ownerId !== "ALL") {
      where.ownerId = params.ownerId;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { company: { name: { contains: params.search, mode: "insensitive" } } },
        { primaryContact: { firstName: { contains: params.search, mode: "insensitive" } } },
        { primaryContact: { lastName: { contains: params.search, mode: "insensitive" } } },
      ];
    }

    const items = await prisma.opportunity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true } },
        primaryContact: { select: { id: true, firstName: true, lastName: true } },
        stage: { select: { id: true, name: true, probability: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    const mapped: OpportunityItem[] = items.map((o) => ({
      id: o.id,
      organizationId: o.organizationId,
      name: o.name,
      amount: Number(o.amount || 0),
      currency: o.currency,
      companyId: o.companyId,
      companyName: o.company.name,
      primaryContactId: o.primaryContactId,
      primaryContactName: o.primaryContact
        ? `${o.primaryContact.firstName} ${o.primaryContact.lastName || ""}`.trim()
        : null,
      leadId: o.leadId,
      stageId: o.stageId,
      stageName: o.stage.name,
      probability: o.probability,
      ownerId: o.ownerId,
      ownerName: o.owner.name,
      status: o.status as "OPEN" | "WON" | "LOST",
      lossReason: o.lossReason,
      description: o.description,
      expectedCloseDate: o.expectedCloseDate ? o.expectedCloseDate.toISOString().split("T")[0] : null,
      closedAt: o.closedAt ? o.closedAt.toISOString() : null,
      createdAt: o.createdAt.toISOString(),
    }));

    const totalValue = mapped.reduce((acc, curr) => acc + curr.amount, 0);
    const wonValue = mapped
      .filter((o) => o.status === "WON")
      .reduce((acc, curr) => acc + curr.amount, 0);
    const openValue = mapped
      .filter((o) => o.status === "OPEN")
      .reduce((acc, curr) => acc + curr.amount, 0);

    return {
      success: true,
      data: {
        items: mapped,
        stages: PIPELINE_STAGES,
        summary: {
          totalCount: mapped.length,
          totalValue,
          wonCount: mapped.filter((o) => o.status === "WON").length,
          wonValue,
          openCount: mapped.filter((o) => o.status === "OPEN").length,
          openValue,
        },
      },
    };
  } catch {
    // In-memory fallback
    let filtered = mockOpportunitiesStore.filter((o) => {
      if (params.status && params.status !== "ALL" && o.status !== params.status) {
        return false;
      }
      if (params.stageName && params.stageName !== "ALL" && o.stageName !== params.stageName) {
        return false;
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        const matchesName = o.name.toLowerCase().includes(q);
        const matchesCompany = o.companyName.toLowerCase().includes(q);
        const matchesContact = o.primaryContactName?.toLowerCase().includes(q);
        if (!matchesName && !matchesCompany && !matchesContact) return false;
      }
      return true;
    });

    const totalValue = filtered.reduce((acc, curr) => acc + curr.amount, 0);
    const wonValue = filtered
      .filter((o) => o.status === "WON")
      .reduce((acc, curr) => acc + curr.amount, 0);
    const openValue = filtered
      .filter((o) => o.status === "OPEN")
      .reduce((acc, curr) => acc + curr.amount, 0);

    return {
      success: true,
      data: {
        items: filtered,
        stages: PIPELINE_STAGES,
        summary: {
          totalCount: filtered.length,
          totalValue,
          wonCount: filtered.filter((o) => o.status === "WON").length,
          wonValue,
          openCount: filtered.filter((o) => o.status === "OPEN").length,
          openValue,
        },
      },
    };
  }
}

/**
 * Fetch opportunity by ID
 */
export async function getOpportunityByIdAction(id: string) {
  const session = await requireAuth();

  try {
    const opp = await prisma.opportunity.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
        deletedAt: null,
      },
      include: {
        company: { select: { id: true, name: true, phone: true, email: true } },
        primaryContact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        stage: { select: { id: true, name: true, probability: true, color: true } },
        owner: { select: { id: true, name: true, email: true } },
        activities: { orderBy: { activityAt: "desc" }, take: 10 },
        tasks: { orderBy: { dueAt: "asc" } },
        notes: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!opp) {
      const mock = mockOpportunitiesStore.find((o) => o.id === id);
      if (mock) {
        return {
          success: true,
          data: {
            ...mock,
            company: { id: mock.companyId, name: mock.companyName },
            primaryContact: mock.primaryContactId
              ? { id: mock.primaryContactId, firstName: mock.primaryContactName || "", lastName: "" }
              : null,
            owner: { id: mock.ownerId, name: mock.ownerName },
            activities: [],
            tasks: [],
            notes: [],
          },
        };
      }
      return { success: false, error: "Opportunity not found" };
    }

    return {
      success: true,
      data: {
        id: opp.id,
        organizationId: opp.organizationId,
        name: opp.name,
        amount: Number(opp.amount || 0),
        currency: opp.currency,
        companyId: opp.companyId,
        companyName: opp.company.name,
        primaryContactId: opp.primaryContactId,
        primaryContactName: opp.primaryContact
          ? `${opp.primaryContact.firstName} ${opp.primaryContact.lastName || ""}`.trim()
          : null,
        primaryContactEmail: opp.primaryContact?.email || null,
        leadId: opp.leadId,
        stageId: opp.stageId,
        stageName: opp.stage.name,
        probability: opp.probability,
        ownerId: opp.ownerId,
        ownerName: opp.owner.name,
        status: opp.status as "OPEN" | "WON" | "LOST",
        lossReason: opp.lossReason,
        description: opp.description,
        expectedCloseDate: opp.expectedCloseDate ? opp.expectedCloseDate.toISOString().split("T")[0] : null,
        closedAt: opp.closedAt ? opp.closedAt.toISOString() : null,
        createdAt: opp.createdAt.toISOString(),
        activities: opp.activities || [],
        tasks: opp.tasks || [],
        notes: opp.notes || [],
      },
    };
  } catch {
    const mock = mockOpportunitiesStore.find((o) => o.id === id);
    if (mock) {
      const contact = mockContactsStore.find((c) => c.id === mock.primaryContactId);
      return {
        success: true,
        data: {
          ...mock,
          primaryContactEmail: contact?.email || null,
          company: { id: mock.companyId, name: mock.companyName },
          primaryContact: mock.primaryContactId
            ? {
                id: mock.primaryContactId,
                firstName: mock.primaryContactName || "",
                lastName: "",
                email: contact?.email || "",
              }
            : null,
          owner: { id: mock.ownerId, name: mock.ownerName },
          activities: [],
          tasks: [],
          notes: [],
        },
      };
    }
    return { success: false, error: "Opportunity not found" };
  }
}

/**
 * Create a new opportunity
 */
export async function createOpportunityAction(data: OpportunityFormData) {
  const session = await requirePermission("opportunity:create");
  const parsed = opportunitySchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const {
    name,
    amount,
    currency,
    companyId,
    primaryContactId,
    leadId,
    stageName,
    expectedCloseDate,
    description,
  } = parsed.data;

  const stageMeta = PIPELINE_STAGES.find(
    (s) => s.name.toLowerCase() === stageName.toLowerCase()
  ) || PIPELINE_STAGES[1];

  try {
    // Find pipeline
    let pipeline = await prisma.pipeline.findFirst({
      where: { organizationId: session.organizationId, isDefault: true },
      include: { stages: true },
    });

    if (!pipeline) {
      pipeline = await prisma.pipeline.findFirst({
        where: { organizationId: session.organizationId },
        include: { stages: true },
      });
    }

    let stageId = pipeline?.stages.find(
      (s) => s.name.toLowerCase() === stageName.toLowerCase()
    )?.id;

    if (!stageId && pipeline && pipeline.stages.length > 0) {
      stageId = pipeline.stages[0].id;
    }

    if (!pipeline || !stageId) {
      const createdPipeline = await prisma.pipeline.create({
        data: {
          organizationId: session.organizationId,
          name: "Standard Sales Pipeline",
          isDefault: true,
          stages: {
            create: PIPELINE_STAGES.map((s) => ({
              name: s.name,
              order: s.order,
              probability: s.probability,
              color: s.color,
              isWon: Boolean(s.isWon),
              isLost: Boolean(s.isLost),
            })),
          },
        },
        include: { stages: true },
      });
      pipeline = createdPipeline;
      stageId = createdPipeline.stages.find(
        (s) => s.name.toLowerCase() === stageName.toLowerCase()
      )?.id || createdPipeline.stages[0].id;
    }

    const created = await prisma.opportunity.create({
      data: {
        organizationId: session.organizationId,
        companyId,
        primaryContactId: primaryContactId || null,
        leadId: leadId || null,
        name,
        pipelineId: pipeline.id,
        stageId,
        ownerId: session.id,
        amount,
        currency,
        probability: stageMeta.probability,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        description: description || null,
        status: stageMeta.isWon ? "WON" : stageMeta.isLost ? "LOST" : "OPEN",
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
          action: "OPPORTUNITY_CREATED",
          entityType: "Opportunity",
          entityId: created.id,
          newValues: { name, amount, stageName, companyId },
        },
      });
    } catch {}

    revalidatePath("/opportunities");
    revalidatePath("/dashboard");
    return { success: true, data: created };
  } catch {
    // In-memory fallback
    const comp = mockCompaniesStore.find((c) => c.id === companyId);
    const cont = mockContactsStore.find((ct) => ct.id === primaryContactId);

    const newOpp: MockOpportunity = {
      id: `opp_${Date.now()}`,
      organizationId: session.organizationId,
      name,
      amount,
      currency,
      companyId,
      companyName: comp?.name || "Company",
      primaryContactId: primaryContactId || null,
      primaryContactName: cont?.fullName || null,
      leadId: leadId || null,
      pipelineId: "pipe_default",
      stageId: stageMeta.id,
      stageName: stageMeta.name,
      probability: stageMeta.probability,
      ownerId: session.id,
      ownerName: session.name,
      status: stageMeta.isWon ? "WON" : stageMeta.isLost ? "LOST" : "OPEN",
      lossReason: null,
      description: description || null,
      expectedCloseDate: expectedCloseDate || null,
      closedAt: stageMeta.isWon || stageMeta.isLost ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
    };

    mockOpportunitiesStore.unshift(newOpp);
    revalidatePath("/opportunities");
    revalidatePath("/dashboard");
    return { success: true, data: newOpp };
  }
}

/**
 * Update an existing opportunity
 */
export async function updateOpportunityAction(id: string, raw: Partial<OpportunityFormData>) {
  await requirePermission("opportunity:update");

  try {
    const data: any = {};
    if (raw.name !== undefined) data.name = raw.name;
    if (raw.amount !== undefined) data.amount = raw.amount;
    if (raw.currency !== undefined) data.currency = raw.currency;
    if (raw.companyId !== undefined) data.companyId = raw.companyId;
    if (raw.primaryContactId !== undefined) data.primaryContactId = raw.primaryContactId || null;
    if (raw.expectedCloseDate !== undefined) {
      data.expectedCloseDate = raw.expectedCloseDate ? new Date(raw.expectedCloseDate) : null;
    }
    if (raw.description !== undefined) data.description = raw.description || null;

    if (raw.stageName) {
      const stageMeta = PIPELINE_STAGES.find(
        (s) => s.name.toLowerCase() === raw.stageName!.toLowerCase()
      );
      if (stageMeta) {
        data.probability = stageMeta.probability;
      }
    }

    await prisma.opportunity.update({
      where: { id },
      data,
    });

    const mockOpp = mockOpportunitiesStore.find((o) => o.id === id);
    if (mockOpp) {
      if (raw.name !== undefined) mockOpp.name = raw.name;
      if (raw.amount !== undefined) mockOpp.amount = raw.amount;
      if (raw.expectedCloseDate !== undefined) mockOpp.expectedCloseDate = raw.expectedCloseDate || null;
      if (raw.description !== undefined) mockOpp.description = raw.description || null;
      if (raw.companyId) {
        const comp = mockCompaniesStore.find((c) => c.id === raw.companyId);
        if (comp) {
          mockOpp.companyId = comp.id;
          mockOpp.companyName = comp.name;
        }
      }
      if (raw.primaryContactId) {
        const cont = mockContactsStore.find((c) => c.id === raw.primaryContactId);
        if (cont) {
          mockOpp.primaryContactId = cont.id;
          mockOpp.primaryContactName = cont.fullName;
        }
      }
    }

    revalidatePath("/opportunities");
    revalidatePath(`/opportunities/${id}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    const mockOpp = mockOpportunitiesStore.find((o) => o.id === id);
    if (mockOpp) {
      if (raw.name !== undefined) mockOpp.name = raw.name;
      if (raw.amount !== undefined) mockOpp.amount = raw.amount;
      if (raw.expectedCloseDate !== undefined) mockOpp.expectedCloseDate = raw.expectedCloseDate || null;
      if (raw.description !== undefined) mockOpp.description = raw.description || null;
      if (raw.companyId) {
        const comp = mockCompaniesStore.find((c) => c.id === raw.companyId);
        if (comp) {
          mockOpp.companyId = comp.id;
          mockOpp.companyName = comp.name;
        }
      }
      if (raw.primaryContactId) {
        const cont = mockContactsStore.find((c) => c.id === raw.primaryContactId);
        if (cont) {
          mockOpp.primaryContactId = cont.id;
          mockOpp.primaryContactName = cont.fullName;
        }
      }
      revalidatePath("/opportunities");
      revalidatePath(`/opportunities/${id}`);
      revalidatePath("/dashboard");
      return { success: true };
    }
    return { success: false, error: "Opportunity not found" };
  }
}

/**
 * Move opportunity to a new stage
 */
export async function updateOpportunityStageAction(id: string, newStageName: string) {
  const session = await requirePermission("opportunity:update");

  const stageMeta = PIPELINE_STAGES.find(
    (s) => s.name.toLowerCase() === newStageName.toLowerCase()
  );

  if (!stageMeta) {
    return { success: false, error: "Invalid pipeline stage" };
  }

  const status: "OPEN" | "WON" | "LOST" = stageMeta.isWon
    ? "WON"
    : stageMeta.isLost
    ? "LOST"
    : "OPEN";

  const closedAt = status !== "OPEN" ? new Date() : null;

  try {
    const opp = await prisma.opportunity.findFirst({
      where: { id, organizationId: session.organizationId },
      include: { pipeline: { include: { stages: true } } },
    });

    if (!opp) {
      return { success: false, error: "Opportunity not found" };
    }

    let targetStageId = opp.pipeline.stages.find(
      (s) => s.name.toLowerCase() === newStageName.toLowerCase()
    )?.id;

    if (!targetStageId) {
      targetStageId = opp.stageId;
    }

    const updated = await prisma.opportunity.update({
      where: { id },
      data: {
        stageId: targetStageId,
        probability: stageMeta.probability,
        status,
        closedAt,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
          action: "OPPORTUNITY_STAGE_CHANGED",
          entityType: "Opportunity",
          entityId: id,
          newValues: { stageName: newStageName, probability: stageMeta.probability, status },
        },
      });
    } catch {}

    revalidatePath("/opportunities");
    revalidatePath(`/opportunities/${id}`);
    revalidatePath("/dashboard");
    return { success: true, data: updated };
  } catch {
    const idx = mockOpportunitiesStore.findIndex((o) => o.id === id);
    if (idx !== -1) {
      mockOpportunitiesStore[idx] = {
        ...mockOpportunitiesStore[idx],
        stageId: stageMeta.id,
        stageName: stageMeta.name,
        probability: stageMeta.probability,
        status,
        closedAt: closedAt ? closedAt.toISOString() : null,
      };
      revalidatePath("/opportunities");
      revalidatePath(`/opportunities/${id}`);
      revalidatePath("/dashboard");
      return { success: true, data: mockOpportunitiesStore[idx] };
    }
    return { success: false, error: "Opportunity not found" };
  }
}

/**
 * Close opportunity as Won or Lost
 */
export async function closeOpportunityAction(id: string, data: CloseOpportunityFormData) {
  const session = await requirePermission("opportunity:update");
  const parsed = closeOpportunitySchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid close data" };
  }

  const { status, lossReason, lossNotes } = parsed.data;
  const stageName = status === "WON" ? "Won" : "Lost";
  const probability = status === "WON" ? 100 : 0;
  const closedAt = new Date();

  try {
    const opp = await prisma.opportunity.findFirst({
      where: { id, organizationId: session.organizationId },
      include: { pipeline: { include: { stages: true } } },
    });

    if (!opp) {
      return { success: false, error: "Opportunity not found" };
    }

    const targetStageId = opp.pipeline.stages.find(
      (s) => s.name.toLowerCase() === stageName.toLowerCase()
    )?.id || opp.stageId;

    const updated = await prisma.opportunity.update({
      where: { id },
      data: {
        stageId: targetStageId,
        status,
        probability,
        closedAt,
        lossReason: status === "LOST" ? lossReason : null,
        description: lossNotes ? `${opp.description || ""}\nLoss Notes: ${lossNotes}`.trim() : opp.description,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
          action: status === "WON" ? "OPPORTUNITY_WON" : "OPPORTUNITY_LOST",
          entityType: "Opportunity",
          entityId: id,
          newValues: { status, lossReason, amount: Number(opp.amount) },
        },
      });
    } catch {}

    revalidatePath("/opportunities");
    revalidatePath(`/opportunities/${id}`);
    revalidatePath("/dashboard");
    return { success: true, data: updated };
  } catch {
    const idx = mockOpportunitiesStore.findIndex((o) => o.id === id);
    if (idx !== -1) {
      mockOpportunitiesStore[idx] = {
        ...mockOpportunitiesStore[idx],
        stageName,
        probability,
        status,
        closedAt: closedAt.toISOString(),
        lossReason: status === "LOST" ? lossReason || null : null,
      };
      revalidatePath("/opportunities");
      revalidatePath(`/opportunities/${id}`);
      revalidatePath("/dashboard");
      return { success: true, data: mockOpportunitiesStore[idx] };
    }
    return { success: false, error: "Opportunity not found" };
  }
}

/**
 * Soft delete opportunity
 */
export async function deleteOpportunityAction(id: string) {
  const session = await requirePermission("opportunity:delete");

  try {
    await prisma.opportunity.update({
      where: { id, organizationId: session.organizationId },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/opportunities");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    const idx = mockOpportunitiesStore.findIndex((o) => o.id === id);
    if (idx !== -1) {
      mockOpportunitiesStore.splice(idx, 1);
    }
    revalidatePath("/opportunities");
    revalidatePath("/dashboard");
    return { success: true };
  }
}
