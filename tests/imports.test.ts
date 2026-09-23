import { describe, it, expect } from "vitest";
import { parseCsv, serializeCsv, getSampleCsvTemplate } from "@/lib/csv/parser";
import {
  leadImportRowSchema,
  companyImportRowSchema,
  contactImportRowSchema,
} from "@/lib/validations/imports";

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

  it("generates correct sample CSV templates for all supported entities", () => {
    const entities = ["leads", "companies", "contacts"] as const;
    entities.forEach((entity) => {
      const template = getSampleCsvTemplate(entity);
      expect(template.filename).toContain(entity);
      expect(template.csv.length).toBeGreaterThan(20);
      const parsed = parseCsv(template.csv);
      expect(parsed.length).toBeGreaterThanOrEqual(2); // Header + at least 1 sample row
    });
  });
});
