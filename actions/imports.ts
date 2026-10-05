"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requirePermission } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
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

function cleanPersonName(raw: string) {
  if (!raw) return { firstName: "", lastName: null };
  const cleaned = raw
    .trim()
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/\.+$/, "")
    .replace(/,\s*$/, "");

  // Deduplicate repeated trailing tokens (e.g. "Jones Jones" or repeated parentheticals)
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (
    parts.length >= 2 &&
    parts[parts.length - 1].toLowerCase() === parts[parts.length - 2].toLowerCase()
  ) {
    parts.pop();
  }
  const dedupedStr = parts.join(" ").replace(/\(([^)]+)\)\s+([A-Za-z]+)\s+\(\1\)\s+\2/i, "($1) $2");
  const finalParts = dedupedStr.split(/\s+/).filter(Boolean);

  if (finalParts.length === 0) return { firstName: "", lastName: null };
  const firstName = finalParts[0];
  const lastName = finalParts.length > 1 ? finalParts.slice(1).join(" ") : null;
  return { firstName, lastName };
}

function cleanEmails(raw1?: string | null, raw2?: string | null) {
  const allRaw = [raw1, raw2].filter(Boolean).join(" or ");
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const matches = (allRaw.match(emailRegex) || []).map((e) => e.toLowerCase().trim());
  const unique = Array.from(new Set(matches));
  return {
    primary: unique[0] || null,
    secondary: unique[1] || null,
  };
}

/**
 * Bulk Import entities from CSV string
 */
export async function importCsvAction(
  entityType: ImportEntityType,
  csvText: string
): Promise<{ success: boolean; data?: ImportResult; error?: string }> {
  const session = await requireAuth();
  const { organizationId, userId } = await resolveTenantContext(session);
  const isTechflux =
    (session.organizationName || "").toLowerCase().includes("techflux") ||
    (session.organizationId || "").toLowerCase().includes("techflux") ||
    organizationId.toLowerCase().includes("techflux");

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
    let currentCategory = "General";

    dataRows.forEach((row, idx) => {
      const rowNum = idx + 2; // Line 1 is header
      const nonEmpties = row.filter((c) => c && c.trim().length > 0);
      if (nonEmpties.length === 0) return;

      // Detect single-cell category / divider rows (e.g. ", Clothing & Fashion ,,,,,,")
      if (nonEmpties.length === 1 && entityType === "leads") {
        currentCategory = nonEmpties[0].trim();
        return;
      }

      // Detect repeated sub-headers inside the CSV body
      const rowStr = row.join(" | ").toLowerCase();
      if (
        (rowStr.includes("company name") && rowStr.includes("website")) ||
        (rowStr.includes("owner first name") && rowStr.includes("contact"))
      ) {
        return;
      }

      const rowObj: Record<string, any> = {};
      headers.forEach((hdr, hIdx) => {
        rowObj[hdr] = row[hIdx] !== undefined ? row[hIdx] : "";
      });

      if (entityType === "leads") {
        // 1. Resolve Person Name (Owner / Contact)
        const ownerCol = (
          rowObj["owner first name"] ||
          rowObj["owner name"] ||
          rowObj["owner_first_name"] ||
          rowObj["owner_name"] ||
          rowObj["first name"] ||
          rowObj["firstname"] ||
          rowObj["first_name"] ||
          rowObj["founder name"] ||
          rowObj["ceo name"] ||
          rowObj["contact person"] ||
          ""
        ).trim();

        const ownerLastCol = (
          rowObj["last name"] ||
          rowObj["lastname"] ||
          rowObj["last_name"] ||
          rowObj["owner last name"] ||
          rowObj["owner_last_name"] ||
          ""
        ).trim();

        // Check for explicit company name column
        const explicitCompany = (
          rowObj["company"] ||
          rowObj["company name"] ||
          rowObj["companyname"] ||
          rowObj["company_name"] ||
          rowObj["organization"] ||
          rowObj["business name"] ||
          rowObj["store name"] ||
          rowObj["brand"] ||
          ""
        ).trim();

        const genericName = (
          rowObj["name"] ||
          rowObj["fullname"] ||
          rowObj["full name"] ||
          rowObj["lead name"] ||
          ""
        ).trim();

        const hasOwnerHeader = headers.some((h) =>
          h.includes("owner") || h.includes("founder") || h.includes("ceo") || h.includes("contact person")
        );

        let firstName = "";
        let lastName: string | null = null;
        let companyName: string | null = explicitCompany || null;

        if (hasOwnerHeader) {
          // When sheet has an owner/founder header, genericName ("Name") is the Company/Brand Name
          companyName = explicitCompany || genericName || null;
          if (ownerCol) {
            const nameParsed = cleanPersonName(ownerCol);
            firstName = nameParsed.firstName;
            lastName = ownerLastCol || nameParsed.lastName;
          } else {
            // No owner specified on this row, but company exists (e.g. Peacock Beauty Wholesale)
            firstName = companyName || "Valued Lead";
            lastName = "Team";
          }
        } else if (ownerCol) {
          const nameParsed = cleanPersonName(ownerCol);
          firstName = nameParsed.firstName;
          lastName = ownerLastCol || nameParsed.lastName;
          if (!companyName && genericName) {
            companyName = genericName;
          }
        } else if (genericName && explicitCompany) {
          const nameParsed = cleanPersonName(genericName);
          firstName = nameParsed.firstName;
          lastName = ownerLastCol || nameParsed.lastName;
        } else if (genericName && !explicitCompany) {
          const nameParsed = cleanPersonName(genericName);
          firstName = nameParsed.firstName;
          lastName = nameParsed.lastName;
        } else if (companyName) {
          firstName = companyName;
          lastName = "Team";
        }

        // Fallback if still empty
        if (!firstName) {
          firstName = companyName || "Valued Lead";
        }

        // 2. Resolve Emails
        const ownerEmailRaw =
          rowObj["owner email"] ||
          rowObj["owner_email"] ||
          rowObj["personal email"] ||
          "";
        const emailRaw =
          rowObj["customer email"] ||
          rowObj["customer_email"] ||
          rowObj["customeremail"] ||
          rowObj["email"] ||
          rowObj["support email"] ||
          rowObj["support_email"] ||
          "";

        const { primary: email, secondary: supportEmail } = cleanEmails(ownerEmailRaw, emailRaw);

        // 3. Resolve Phone / Contact
        let phone = (
          rowObj["contact"] ||
          rowObj["phone"] ||
          rowObj["contact number"] ||
          rowObj["mobile"] ||
          rowObj["phone number"] ||
          ""
        ).trim() || null;
        if (phone && (phone === "—" || phone === "-" || phone.toLowerCase() === "n/a")) {
          phone = null;
        }

        // 4. Resolve LinkedIn & Website
        const websiteRaw = (
          rowObj["website"] ||
          rowObj["company website"] ||
          rowObj["url"] ||
          ""
        ).trim() || null;
        const website = websiteRaw && websiteRaw !== "—" && websiteRaw !== "-" ? websiteRaw : null;

        const colLinkedin1 = (
          rowObj["ceo/founder linkedin"] ||
          rowObj["ceo / founder linkedin"] ||
          rowObj["linkediprofile"] ||
          rowObj["linkedinprofile"] ||
          rowObj["linkedin_profile"] ||
          rowObj["personal linkedin"] ||
          rowObj["profile"] ||
          ""
        ).trim();

        const colLinkedin2 = (
          rowObj["company linkedin"] ||
          rowObj["company_linkedin"] ||
          ""
        ).trim();

        const genericLinkedin = (rowObj["linkedin"] || "").trim();

        let personalLinkedin: string | null = null;
        let companyLinkedin: string | null = null;

        [colLinkedin1, colLinkedin2, genericLinkedin].forEach((url) => {
          if (!url || url === "—" || url === "-") return;
          if (url.includes("/in/") || url.includes("keywords=")) {
            if (!personalLinkedin) personalLinkedin = url;
          } else if (url.includes("/company/")) {
            if (!companyLinkedin) companyLinkedin = url;
          } else if (!personalLinkedin) {
            personalLinkedin = url;
          }
        });

        // 5. Industry / Category
        const industry = (rowObj["industry"] || rowObj["category"] || currentCategory || "").trim() || null;

        // Detect scraped source
        const isScrapedRow = Boolean(
          ownerCol ||
          genericName ||
          website ||
          personalLinkedin ||
          companyLinkedin ||
          rowObj["contact"]
        );

        // 6. Build rich structured discovery notes
        const notesList: string[] = [];
        if (industry && industry !== "General") notesList.push(`Industry / Category: ${industry}`);
        if (website) notesList.push(`Website: ${website}`);
        if (companyLinkedin) notesList.push(`Company LinkedIn: ${companyLinkedin}`);
        if (personalLinkedin) notesList.push(`LinkedIn Profile: ${personalLinkedin}`);
        if (supportEmail) notesList.push(`Support/Store Email: ${supportEmail}`);

        let description = (rowObj["description"] || "").trim() || null;
        if (notesList.length > 0) {
          const notesText = notesList.join("\n");
          description = description ? `${description}\n\n${notesText}` : notesText;
        }

        const defaultStatus = isScrapedRow || isTechflux ? "Scraped" : "New";
        const status = (rowObj["status"] || "").trim() || defaultStatus;
        const source = (rowObj["source"] || "").trim() || (isScrapedRow ? "Scraped Data" : "Website");

        const parsed = leadImportRowSchema.safeParse({
          firstName,
          lastName,
          email,
          supportEmail,
          phone,
          companyName,
          jobTitle: (rowObj["jobtitle"] || rowObj["job_title"] || rowObj["title"] || "").trim() || null,
          companyLinkedin,
          customerLinkedin: personalLinkedin,
          source,
          estimatedValue: rowObj["estimatedvalue"] || rowObj["estimated_value"] || rowObj["value"] || 0,
          rating: rowObj["rating"] || "Warm",
          status,
          description,
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
        let firstName = (
          rowObj["firstname"] ||
          rowObj["first_name"] ||
          rowObj["first name"] ||
          ""
        ).trim();
        let lastName = (
          rowObj["lastname"] ||
          rowObj["last_name"] ||
          rowObj["last name"] ||
          ""
        ).trim() || null;

        const fullName = (
          rowObj["name"] ||
          rowObj["fullname"] ||
          rowObj["full name"] ||
          ""
        ).trim();

        if (!firstName && fullName) {
          const parts = fullName.split(/\s+/);
          firstName = parts[0] || "";
          lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
        }

        const parsed = contactImportRowSchema.safeParse({
          firstName,
          lastName,
          email: rowObj["email"] || null,
          phone: rowObj["phone"] || rowObj["contact"] || rowObj["mobile"] || null,
          jobTitle: rowObj["jobtitle"] || rowObj["job_title"] || rowObj["job title"] || null,
          department: rowObj["department"] || null,
          companyName: rowObj["companyname"] || rowObj["company_name"] || rowObj["company name"] || rowObj["company"] || null,
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
        const leadStatus = rec.status || (isTechflux ? "Scraped" : "New");

        try {
          await prisma.lead.create({
            data: {
              organizationId,
              leadNumber: leadNum,
              firstName: rec.firstName,
              lastName: rec.lastName || null,
              email: rec.email || null,
              supportEmail: rec.supportEmail || null,
              phone: rec.phone || null,
              companyName: rec.companyName || null,
              jobTitle: rec.jobTitle || null,
              companyLinkedin: rec.companyLinkedin || null,
              customerLinkedin: rec.customerLinkedin || null,
              source: rec.source || (isTechflux ? "Scraped Import" : "Import"),
              status: leadStatus,
              rating: rec.rating || "Warm",
              estimatedValue: Number(rec.estimatedValue || 0),
              currency: "INR",
              ownerId: userId || session.id,
              createdById: userId || session.id,
              description: rec.description || null,
            },
          });
        } catch (dbErr) {
          console.warn("[importCsvAction] Prisma lead create error:", dbErr);
        }

        const newLead = {
          id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          organizationId: organizationId || session.organizationId,
          leadNumber: leadNum,
          firstName: rec.firstName,
          lastName: rec.lastName || null,
          fullName: `${rec.firstName} ${rec.lastName || ""}`.trim(),
          email: rec.email || null,
          supportEmail: rec.supportEmail || null,
          phone: rec.phone || null,
          companyName: rec.companyName || null,
          jobTitle: rec.jobTitle || null,
          companyLinkedin: rec.companyLinkedin || null,
          customerLinkedin: rec.customerLinkedin || null,
          source: rec.source || (isTechflux ? "Scraped Import" : "Import"),
          status: leadStatus,
          rating: rec.rating || "Warm",
          estimatedValue: Number(rec.estimatedValue || 0),
          currency: "INR",
          ownerId: userId || session.id,
          createdById: userId || session.id,
          ownerName: session.name || "Alex Sales",
          createdAt: now,
          description: rec.description || null,
        };
        mockLeadsStore.unshift(newLead);
        importedCount++;
      } else if (entityType === "companies") {
        try {
          await prisma.company.create({
            data: {
              organizationId: session.organizationId,
              name: rec.name,
              industry: rec.industry || null,
              website: rec.website || null,
              email: rec.email || null,
              phone: rec.phone || null,
              city: rec.city || null,
              country: rec.country || null,
              status: rec.status || "Prospect",
              description: rec.description || null,
              ownerId: session.id,
            },
          });
        } catch (dbErr) {
          console.warn("[importCsvAction] Prisma company create error:", dbErr);
        }

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
          ownerId: session.id,
          ownerName: session.name || "Sales Rep",
        };
        mockCompaniesStore.unshift(newComp);
        importedCount++;
      } else if (entityType === "contacts") {
        try {
          await prisma.contact.create({
            data: {
              organizationId: session.organizationId,
              firstName: rec.firstName,
              lastName: rec.lastName || null,
              email: rec.email || null,
              phone: rec.phone || null,
              jobTitle: rec.jobTitle || null,
              department: rec.department || null,
              ownerId: session.id,
            },
          });
        } catch (dbErr) {
          console.warn("[importCsvAction] Prisma contact create error:", dbErr);
        }

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
          ownerId: session.id,
          ownerName: session.name || "Sales Rep",
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
