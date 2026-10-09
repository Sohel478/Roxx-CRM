import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveCompanyMatrixAction,
  getCompanyMatrixAction,
  extractCompanyMatrixFromUrlAction,
  extractCompanyMatrixFromFileAction,
  removeCompanyDocumentAction,
} from "@/actions/company-matrix";
import { mockAiConfigsStore } from "@/lib/db/mock-store";
import type { CompanyMatrix } from "@/lib/validations/marketing";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockSessionUser: any = {
  id: "usr_matrix_persistence_tester",
  organizationId: "org_persistence_test",
  organizationName: "TechFlux Solutions",
  email: "admin@techflux.in",
  name: "Sohel Jatu",
  role: "ADMIN",
  permissions: ["admin:access"],
};

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(async () => mockSessionUser),
  requirePermission: vi.fn(async () => mockSessionUser),
  getSession: vi.fn(async () => mockSessionUser),
}));

// Mock extractTextFromUrl
vi.mock("@/lib/ai/company-matrix-extractor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/company-matrix-extractor")>();
  return {
    ...actual,
    extractTextFromUrl: vi.fn(async (url: string) => ({
      success: true,
      text: `TechFlux Solutions is a software consultancy offering Next.js, React, Node.js, and Mobile App Development for Healthcare and Fintech clients. URL: ${url}. We do not do SEO or Hardware.`,
    })),
  };
});

describe("Company Capabilities Matrix & Source Persistence", () => {
  beforeEach(() => {
    delete mockAiConfigsStore["org_persistence_test"];
  });

  it("should normalize URL without protocol (e.g. www.techflux.in) and persist it to matrix", async () => {
    const res = await extractCompanyMatrixFromUrlAction({
      url: "www.techflux.in",
    });

    expect(res.success).toBe(true);
    expect(res.matrix).toBeDefined();
    expect(res.matrix?.websiteUrl).toBe("https://www.techflux.in");
    expect(res.matrix?.lastExtractedSource).toBe("Website (https://www.techflux.in)");
    expect(res.matrix?.lastExtractedAt).toBeDefined();

    // Verify it was persisted to database / mock store
    const stored = await getCompanyMatrixAction();
    expect(stored.success).toBe(true);
    expect(stored.data?.websiteUrl).toBe("https://www.techflux.in");
    expect(stored.data?.lastExtractedSource).toBe("Website (https://www.techflux.in)");
  });

  it("should persist uploaded file metadata into sourceDocuments without clearing websiteUrl", async () => {
    // Seed initial matrix with a connected website
    await saveCompanyMatrixAction({
      websiteUrl: "https://techflux.in",
      elevatorPitch: "Initial pitch",
      coreSkillsets: ["React"],
      serviceOfferings: ["Web Development"],
      targetIndustries: ["Fintech"],
      caseStudies: [],
      outOfScopeExclusions: [],
      sourceDocuments: [],
    });

    // Upload a deck file
    const fileContent = "TechFlux Capabilities Deck: Cloud Migration, AWS, Kubernetes, DevOps consulting.";
    const formData = new FormData();
    formData.append("file", new Blob([fileContent], { type: "text/plain" }), "techflux-capabilities-deck.txt");

    const res = await extractCompanyMatrixFromFileAction(formData);
    expect(res.success).toBe(true);
    expect(res.matrix).toBeDefined();

    // Verify file document was added
    expect(res.matrix?.sourceDocuments).toHaveLength(1);
    expect(res.matrix?.sourceDocuments[0].name).toBe("techflux-capabilities-deck.txt");
    expect(res.matrix?.sourceDocuments[0].type).toBe("txt");

    // Verify existing websiteUrl is preserved
    expect(res.matrix?.websiteUrl).toBe("https://techflux.in");
    expect(res.matrix?.lastExtractedSource).toBe("Document (techflux-capabilities-deck.txt)");

    // Verify stored in tenant config
    const stored = await getCompanyMatrixAction();
    expect(stored.data?.sourceDocuments).toHaveLength(1);
    expect(stored.data?.websiteUrl).toBe("https://techflux.in");
  });

  it("should preserve existing sourceDocuments when scanning a new website URL", async () => {
    // Seed matrix with a document
    await saveCompanyMatrixAction({
      websiteUrl: null,
      elevatorPitch: "Pitch",
      coreSkillsets: ["Python"],
      serviceOfferings: ["Data Engineering"],
      targetIndustries: ["Healthcare"],
      caseStudies: [],
      outOfScopeExclusions: [],
      sourceDocuments: [
        {
          id: "doc_1",
          name: "portfolio_2026.pdf",
          size: 204800,
          uploadedAt: new Date().toISOString(),
          type: "pdf",
        },
      ],
    });

    // Scan URL
    const res = await extractCompanyMatrixFromUrlAction({
      url: "https://techflux.in/services",
    });

    expect(res.success).toBe(true);
    expect(res.matrix?.websiteUrl).toBe("https://techflux.in/services");
    // Document should still exist
    expect(res.matrix?.sourceDocuments).toHaveLength(1);
    expect(res.matrix?.sourceDocuments[0].name).toBe("portfolio_2026.pdf");

    // Stored verify
    const stored = await getCompanyMatrixAction();
    expect(stored.data?.sourceDocuments).toHaveLength(1);
    expect(stored.data?.websiteUrl).toBe("https://techflux.in/services");
  });

  it("should remove an uploaded document using removeCompanyDocumentAction", async () => {
    // Seed matrix with two documents
    await saveCompanyMatrixAction({
      websiteUrl: "https://techflux.in",
      elevatorPitch: "Pitch",
      coreSkillsets: ["Next.js"],
      serviceOfferings: ["Web Development"],
      targetIndustries: ["Fintech"],
      caseStudies: [],
      outOfScopeExclusions: [],
      sourceDocuments: [
        {
          id: "doc_keep",
          name: "keep_me.pdf",
          size: 1024,
          uploadedAt: new Date().toISOString(),
          type: "pdf",
        },
        {
          id: "doc_delete",
          name: "delete_me.pdf",
          size: 2048,
          uploadedAt: new Date().toISOString(),
          type: "pdf",
        },
      ],
    });

    // Delete one document
    const removeRes = await removeCompanyDocumentAction("doc_delete");
    expect(removeRes.success).toBe(true);
    expect(removeRes.matrix?.sourceDocuments).toHaveLength(1);
    expect(removeRes.matrix?.sourceDocuments[0].id).toBe("doc_keep");

    // Verify database / mock store
    const stored = await getCompanyMatrixAction();
    expect(stored.data?.sourceDocuments).toHaveLength(1);
    expect(stored.data?.sourceDocuments[0].id).toBe("doc_keep");
    expect(stored.data?.websiteUrl).toBe("https://techflux.in");
  });

  it("should normalize raw domain without protocol in saveCompanyMatrixAction", async () => {
    const rawMatrix: CompanyMatrix = {
      websiteUrl: "techflux.in",
      elevatorPitch: "Software solutions provider",
      coreSkillsets: ["TypeScript"],
      serviceOfferings: ["Full Stack Engineering"],
      targetIndustries: ["SaaS"],
      caseStudies: [],
      outOfScopeExclusions: [],
      sourceDocuments: [],
    };

    const res = await saveCompanyMatrixAction(rawMatrix);
    expect(res.success).toBe(true);

    const stored = await getCompanyMatrixAction();
    expect(stored.data?.websiteUrl).toBe("https://techflux.in");
  });
});
