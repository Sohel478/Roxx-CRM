import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCsv, serializeCsv, getSampleCsvTemplate } from "@/lib/csv/parser";
import {
  leadImportRowSchema,
  companyImportRowSchema,
  contactImportRowSchema,
} from "@/lib/validations/imports";
import { mockLeadsStore } from "@/lib/db/mock-store";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    id: "usr_test_rep",
    organizationId: "org_acme_corp",
    organizationName: "Acme Corp",
    email: "rep@acmecorp.com",
    name: "Alex Sales",
    role: "SALES_REP",
    permissions: ["lead:create", "company:create", "contact:create"],
  }),
  requirePermission: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    lead: {
      create: vi.fn().mockResolvedValue({ id: "lead_1" }),
    },
    company: {
      create: vi.fn().mockResolvedValue({ id: "comp_1" }),
    },
    contact: {
      create: vi.fn().mockResolvedValue({ id: "cont_1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit_1" }),
    },
  },
}));

import { importCsvAction } from "@/actions/imports";

describe("Phase 9: Bulk CSV Parser & Serializer", () => {
  it("parses standard comma-separated values correctly", () => {
    const csv = "name,email,role\nAlice,alice@example.com,Admin\nBob,bob@example.com,Sales";
    const matrix = parseCsv(csv);

    expect(matrix).toHaveLength(3);
    expect(matrix[0]).toEqual(["name", "email", "role"]);
    expect(matrix[1]).toEqual(["Alice", "alice@example.com", "Admin"]);
    expect(matrix[2]).toEqual(["Bob", "bob@example.com", "Sales"]);
  });

  it("handles quoted fields with commas and escaped quotes per RFC 4180", () => {
    const csv = 'Name,Company,Notes\n"Smith, John","Acme, Inc.","He said ""Hello"" to us"';
    const matrix = parseCsv(csv);

    expect(matrix).toHaveLength(2);
    expect(matrix[1][0]).toBe("Smith, John");
    expect(matrix[1][1]).toBe("Acme, Inc.");
    expect(matrix[1][2]).toBe('He said "Hello" to us');
  });

  it("handles multi-line values enclosed within quotes", () => {
    const csv = 'ID,Description\n1,"Line 1\nLine 2\nLine 3"\n2,"Simple"';
    const matrix = parseCsv(csv);

    expect(matrix).toHaveLength(3);
    expect(matrix[1][0]).toBe("1");
    expect(matrix[1][1]).toBe("Line 1\nLine 2\nLine 3");
    expect(matrix[2][0]).toBe("2");
    expect(matrix[2][1]).toBe("Simple");
  });

  it("serializes rows with RFC 4180 escaping", () => {
    const headers = ["Name", "Company", "Notes"];
    const rows = [
      ["John Doe", "Simple Corp", "Normal note"],
      ["Smith, Jane", 'Quotes "R" Us', "Contains\nNewline"],
    ];

    const serialized = serializeCsv(headers, rows);
    const reparsed = parseCsv(serialized);

    expect(reparsed[0]).toEqual(headers);
    expect(reparsed[1]).toEqual(rows[0]);
    expect(reparsed[2]).toEqual(rows[1]);
  });

  it("validates lead import row schema", () => {
    const validLead = {
      firstName: "Elena",
      lastName: "Rostova",
      email: "elena@example.com",
      phone: "+1-555-0199",
      companyName: "Rostova Dynamics",
      jobTitle: "CTO",
      source: "Referral",
      estimatedValue: 45000,
      rating: "Hot",
    };

    const parsed = leadImportRowSchema.safeParse(validLead);
    expect(parsed.success).toBe(true);

    const invalidLead = {
      firstName: "", // Required min 1
      email: "invalid-email-format",
    };

    const invalidParsed = leadImportRowSchema.safeParse(invalidLead);
    expect(invalidParsed.success).toBe(false);
  });

  it("validates company import row schema", () => {
    const validCompany = {
      name: "Acme Corporation",
      industry: "Software & Technology",
      website: "https://acme.example.com",
      email: "contact@acme.example.com",
      phone: "+1-800-555-1234",
      city: "Austin",
      country: "USA",
      status: "Prospect",
    };

    const parsed = companyImportRowSchema.safeParse(validCompany);
    expect(parsed.success).toBe(true);

    const invalidCompany = {
      name: "", // Required min 1
    };
    expect(companyImportRowSchema.safeParse(invalidCompany).success).toBe(false);
  });

  it("generates correct sample CSV template for scraped leads format", () => {
    const template = getSampleCsvTemplate("leads");
    expect(template.filename).toBe("scraped_leads_template.csv");

    const matrix = parseCsv(template.csv);
    expect(matrix[0]).toEqual([
      "Name",
      "Website",
      "linkedin",
      "company",
      "linkediprofile",
      "Email",
      "Contact",
    ]);
    expect(matrix.length).toBeGreaterThanOrEqual(3); // Header + 2 sample leads
  });
});

describe("Scraped Leads CSV Importer (importCsvAction)", () => {
  beforeEach(() => {
    mockLeadsStore.length = 0;
  });

  it("imports scraped leads with 7-column format and maps all fields accurately", async () => {
    const csvContent = [
      "Name,Website,linkedin,company,linkediprofile,Email,Contact",
      "Jane Doe,https://techflux.in,https://linkedin.com/company/techflux,Techflux Solutions,https://linkedin.com/in/janedoe,jane.doe@techflux.in,+91 9876543210",
      "Robert Smith,https://acme.com,https://linkedin.com/company/acme,Acme Inc,https://linkedin.com/in/robertsmith,robert@acme.com,+1 555-0144",
    ].join("\n");

    const result = await importCsvAction("leads", csvContent);

    expect(result.success).toBe(true);
    expect(result.data?.importedCount).toBe(2);
    expect(result.data?.failedCount).toBe(0);

    // Verify in mock store
    expect(mockLeadsStore.length).toBe(2);

    const lead1 = mockLeadsStore.find((l) => l.fullName === "Jane Doe");
    expect(lead1).toBeDefined();
    expect(lead1?.firstName).toBe("Jane");
    expect(lead1?.lastName).toBe("Doe");
    expect(lead1?.companyName).toBe("Techflux Solutions");
    expect(lead1?.email).toBe("jane.doe@techflux.in");
    expect(lead1?.phone).toBe("+91 9876543210");
    expect(lead1?.status).toBe("Scraped");
    expect(lead1?.source).toBe("Scraped Data");

    // Verify notes contain website, company linkedin, and personal linkedin profile
    expect(lead1?.description).toContain("Website: https://techflux.in");
    expect(lead1?.description).toContain("Company LinkedIn: https://linkedin.com/company/techflux");
    expect(lead1?.description).toContain("LinkedIn Profile: https://linkedin.com/in/janedoe");
  });

  it("splits multi-part and single names correctly", async () => {
    const csvContent = [
      "Name,Website,linkedin,company,linkediprofile,Email,Contact",
      "Mononym,https://example.com,https://linkedin.com/company/ex,Example Corp,https://linkedin.com/in/mono,mono@example.com,+1 111-2222",
      "Dr. Sarah Connor Smith,https://cyberdyne.com,https://linkedin.com/company/cd,Cyberdyne,https://linkedin.com/in/sconnor,sarah@cyberdyne.com,+1 333-4444",
    ].join("\n");

    const result = await importCsvAction("leads", csvContent);
    expect(result.success).toBe(true);

    const mononymLead = mockLeadsStore.find((l) => l.firstName === "Mononym");
    expect(mononymLead).toBeDefined();
    expect(mononymLead?.lastName).toBeNull();

    const threePartLead = mockLeadsStore.find((l) => l.firstName === "Dr.");
    expect(threePartLead).toBeDefined();
    expect(threePartLead?.lastName).toBe("Sarah Connor Smith");
  });

  it("sanitizes missing or invalid email addresses without failing row import", async () => {
    const csvContent = [
      "Name,Website,linkedin,company,linkediprofile,Email,Contact",
      "No Email User,https://web.org,https://linkedin.com/company/web,Web Org,https://linkedin.com/in/noemail,,+1 555-9999",
      "NA Email User,https://na.org,https://linkedin.com/company/na,NA Org,https://linkedin.com/in/na,N/A,+1 555-8888",
    ].join("\n");

    const result = await importCsvAction("leads", csvContent);
    expect(result.success).toBe(true);
    expect(result.data?.importedCount).toBe(2);

    const noEmailLead = mockLeadsStore.find((l) => l.fullName === "No Email User");
    expect(noEmailLead?.email).toBeNull();

    const naEmailLead = mockLeadsStore.find((l) => l.fullName === "NA Email User");
    expect(naEmailLead?.email).toBeNull();
  });

  it("maintains backwards compatibility for standard CRM headers", async () => {
    const standardCsv = [
      "firstName,lastName,email,phone,companyName,jobTitle,source,estimatedValue,rating,description",
      "Bruce,Wayne,bruce@waynecorp.com,+1 555-9000,Wayne Enterprises,CEO,Referral,150000,Hot,VIP enterprise customer",
    ].join("\n");

    const result = await importCsvAction("leads", standardCsv);
    expect(result.success).toBe(true);
    expect(result.data?.importedCount).toBe(1);

    const wayneLead = mockLeadsStore.find((l) => l.fullName === "Bruce Wayne");
    expect(wayneLead).toBeDefined();
    expect(wayneLead?.companyName).toBe("Wayne Enterprises");
    expect(wayneLead?.jobTitle).toBe("CEO");
    expect(wayneLead?.source).toBe("Referral");
    expect(wayneLead?.rating).toBe("Hot");
    expect(wayneLead?.estimatedValue).toBe(150000);
    expect(wayneLead?.description).toBe("VIP enterprise customer");
  });
});
