"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requirePermission } from "@/lib/auth/session";
import {
  mockLeadsStore,
  mockCompaniesStore,
  mockContactsStore,
  mockOpportunitiesStore,
  mockTasksStore,
} from "@/lib/db/mock-store";
import { parseCsv, serializeCsv } from "@/lib/csv/parser";
import {
  ImportEntityType,
  ImportResult,
  RowImportError,
  leadImportRowSchema,
  companyImportRowSchema,
  contactImportRowSchema,
} from "@/lib/validations/imports";

/**
 * Bulk Import entities from CSV string
 */
export async function importCsvAction(
  entityType: ImportEntityType,
  csvText: string
): Promise<{ success: boolean; data?: ImportResult; error?: string }> {
  const session = await requireAuth();

  // Permission check per entity
  if (entityType === "leads") await requirePermission("lead:create");
  if (entityType === "companies") await requirePermission("company:create");
  if (entityType === "contacts") await requirePermission("contact:create");

  try {
    const matrix = parseCsv(csvText);
    if (matrix.length < 2) {
      return {
        success: false,
        error: "CSV file is empty or missing a header row.",
      };
    }

    const headers = matrix[0].map((h) => h.trim().toLowerCase());
    const dataRows = matrix.slice(1);

    const errors: RowImportError[] = [];
    const validRecords: any[] = [];

    dataRows.forEach((row, idx) => {
      const rowNum = idx + 2; // Line 1 is header
      const rowObj: Record<string, any> = {};

      headers.forEach((hdr, hIdx) => {
        rowObj[hdr] = row[hIdx] !== undefined ? row[hIdx] : "";
      });

      if (entityType === "leads") {
        const parsed = leadImportRowSchema.safeParse({
          firstName: rowObj["firstname"] || rowObj["first_name"] || rowObj["first name"] || "",
          lastName: rowObj["lastname"] || rowObj["last_name"] || rowObj["last name"] || null,
          email: rowObj["email"] || null,
          phone: rowObj["phone"] || null,
          companyName: rowObj["companyname"] || rowObj["company_name"] || rowObj["company"] || null,
          jobTitle: rowObj["jobtitle"] || rowObj["job_title"] || rowObj["title"] || null,
          source: rowObj["source"] || "Website",
          estimatedValue: rowObj["estimatedvalue"] || rowObj["estimated_value"] || rowObj["value"] || 0,
          rating: rowObj["rating"] || "Warm",
          description: rowObj["description"] || null,
        });

        if (parsed.success) {
          validRecords.push(parsed.data);
        } else {
          errors.push({
            rowNumber: rowNum,
            field: parsed.error.errors[0]?.path[0]?.toString(),
            message: parsed.error.errors[0]?.message || "Validation failed",
          });
        }
      } else if (entityType === "companies") {
        const parsed = companyImportRowSchema.safeParse({
          name: rowObj["name"] || rowObj["companyname"] || rowObj["company_name"] || "",
          industry: rowObj["industry"] || null,
          website: rowObj["website"] || null,
          email: rowObj["email"] || null,
          phone: rowObj["phone"] || null,
          city: rowObj["city"] || null,
          country: rowObj["country"] || null,
          status: rowObj["status"] || "Prospect",
          description: rowObj["description"] || null,
        });

        if (parsed.success) {
          validRecords.push(parsed.data);
        } else {
          errors.push({
            rowNumber: rowNum,
            field: parsed.error.errors[0]?.path[0]?.toString(),
            message: parsed.error.errors[0]?.message || "Validation failed",
          });
        }
      } else if (entityType === "contacts") {
        const parsed = contactImportRowSchema.safeParse({
          firstName: rowObj["firstname"] || rowObj["first_name"] || "",
          lastName: rowObj["lastname"] || rowObj["last_name"] || null,
          email: rowObj["email"] || null,
          phone: rowObj["phone"] || null,
          jobTitle: rowObj["jobtitle"] || rowObj["job_title"] || null,
          department: rowObj["department"] || null,
          companyName: rowObj["companyname"] || rowObj["company_name"] || null,
        });

        if (parsed.success) {
          validRecords.push(parsed.data);
        } else {
          errors.push({
            rowNumber: rowNum,
            field: parsed.error.errors[0]?.path[0]?.toString(),
            message: parsed.error.errors[0]?.message || "Validation failed",
          });
        }
      }
    });

    // Insert valid records
    let importedCount = 0;
    const now = new Date().toISOString();

    for (const rec of validRecords) {
      if (entityType === "leads") {
        const leadNum = `LEAD-${1000 + mockLeadsStore.length + 1}`;
        const newLead = {
          id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          organizationId: session.organizationId,
          leadNumber: leadNum,
          firstName: rec.firstName,
          lastName: rec.lastName || null,
          fullName: `${rec.firstName} ${rec.lastName || ""}`.trim(),
          email: rec.email || null,
          phone: rec.phone || null,
          companyName: rec.companyName || null,
          jobTitle: rec.jobTitle || null,
          source: rec.source || "Import",
          status: "New",
          rating: rec.rating || "Warm",
          estimatedValue: Number(rec.estimatedValue || 0),
          currency: "USD",
          ownerName: session.name || "Alex Sales",
          createdAt: now,
          description: rec.description || null,
        };
        mockLeadsStore.unshift(newLead);
        importedCount++;
      } else if (entityType === "companies") {
        const newComp = {
          id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          organizationId: session.organizationId,
          name: rec.name,
          industry: rec.industry || null,
          website: rec.website || null,
          email: rec.email || null,
          phone: rec.phone || null,
          city: rec.city || null,
          country: rec.country || null,
          status: rec.status || "Prospect",
          createdAt: now,
          contactCount: 0,
          description: rec.description || null,
        };
        mockCompaniesStore.unshift(newComp);
        importedCount++;
      } else if (entityType === "contacts") {
        const newContact = {
          id: `cont_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          organizationId: session.organizationId,
          firstName: rec.firstName,
          lastName: rec.lastName || null,
          fullName: `${rec.firstName} ${rec.lastName || ""}`.trim(),
          email: rec.email || null,
          phone: rec.phone || null,
          jobTitle: rec.jobTitle || null,
          department: rec.department || null,
          companyId: null,
          companyName: rec.companyName || null,
          createdAt: now,
        };
        mockContactsStore.unshift(newContact);
        importedCount++;
      }
    }

    // Try logging audit event
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
          action: "BULK_IMPORT",
          entityType: entityType.toUpperCase(),
          entityId: "batch",
          newValues: {
            importedCount,
            failedCount: errors.length,
            totalRows: dataRows.length,
          },
        },
      });
    } catch {
      // safe fallback
    }

    revalidatePath(`/${entityType}`);
    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return {
      success: true,
      data: {
        entityType,
        totalRows: dataRows.length,
        importedCount,
        failedCount: errors.length,
        errors,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to process CSV file",
    };
  }
}

/**
 * Export entity table to CSV format
 */
export async function exportEntityCsvAction(
  entityType: "leads" | "companies" | "contacts" | "opportunities" | "tasks"
): Promise<{ success: boolean; csv?: string; filename?: string; error?: string }> {
  await requireAuth();
  const dateStr = new Date().toISOString().split("T")[0];

  try {
    let csv = "";
    const filename = `${entityType}_export_${dateStr}.csv`;

    if (entityType === "leads") {
      const headers = [
        "Lead Number",
        "Full Name",
        "Email",
        "Phone",
        "Company",
        "Job Title",
        "Source",
        "Status",
        "Rating",
        "Estimated Value (USD)",
        "Owner",
        "Created Date",
      ];
      const rows = mockLeadsStore.map((l) => [
        l.leadNumber,
        l.fullName,
        l.email,
        l.phone,
        l.companyName,
        l.jobTitle,
        l.source,
        l.status,
        l.rating,
        l.estimatedValue,
        l.ownerName,
        l.createdAt.split("T")[0],
      ]);
      csv = serializeCsv(headers, rows);
    } else if (entityType === "companies") {
      const headers = [
        "Company Name",
        "Industry",
        "Website",
        "Email",
        "Phone",
        "City",
        "Country",
        "Status",
        "Contact Count",
        "Created Date",
      ];
      const rows = mockCompaniesStore.map((c) => [
        c.name,
        c.industry,
        c.website,
        c.email,
        c.phone,
        c.city,
        c.country,
        c.status,
        c.contactCount,
        c.createdAt.split("T")[0],
      ]);
      csv = serializeCsv(headers, rows);
    } else if (entityType === "contacts") {
      const headers = [
        "First Name",
        "Last Name",
        "Full Name",
        "Email",
        "Phone",
        "Job Title",
        "Department",
        "Company",
        "Created Date",
      ];
      const rows = mockContactsStore.map((c) => [
        c.firstName,
        c.lastName,
        c.fullName,
        c.email,
        c.phone,
        c.jobTitle,
        c.department,
        c.companyName,
        c.createdAt.split("T")[0],
      ]);
      csv = serializeCsv(headers, rows);
    } else if (entityType === "opportunities") {
      const headers = [
        "Deal Name",
        "Amount (USD)",
        "Company",
        "Primary Contact",
        "Stage",
        "Win Probability %",
        "Status",
        "Loss Reason",
        "Expected Close Date",
        "Owner",
        "Created Date",
      ];
      const rows = mockOpportunitiesStore.map((o) => [
        o.name,
        o.amount,
        o.companyName,
        o.primaryContactName,
        o.stageName,
        o.probability,
        o.status,
        o.lossReason,
        o.expectedCloseDate,
        o.ownerName,
        o.createdAt.split("T")[0],
      ]);
      csv = serializeCsv(headers, rows);
    } else if (entityType === "tasks") {
      const headers = [
        "Task Title",
        "Priority",
        "Status",
        "Due Date",
        "Company",
        "Opportunity",
        "Lead",
        "Assigned To",
        "Completed At",
      ];
      const rows = mockTasksStore.map((t) => [
        t.title,
        t.priority,
        t.status,
        t.dueAt,
        t.companyName,
        t.opportunityName,
        t.leadName,
        t.assignedToName,
        t.completedAt,
      ]);
      csv = serializeCsv(headers, rows);
    }

    return { success: true, csv, filename };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to export CSV" };
  }
}
