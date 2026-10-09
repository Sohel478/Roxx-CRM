import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractTextFromDocumentBuffer,
  synthesizeCompanyMatrix,
} from "@/lib/ai/company-matrix-extractor";
import {
  matchLeadWithCompanySkillsets,
  buildLeadResearchBrief,
  researchLeadAndDraftEmail,
} from "@/lib/ai/lead-researcher";
import {
  saveCompanyMatrixAction,
  getCompanyMatrixAction,
  extractCompanyMatrixFromFileAction,
} from "@/actions/company-matrix";
import { generateLeadAiEmailAction } from "@/actions/ai-email";
import { mockLeadsStore, mockAiConfigsStore } from "@/lib/db/mock-store";
import type { CompanyMatrix } from "@/lib/validations/marketing";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockSessionUser: any = {
  id: "usr_matrix_tester",
  organizationId: "org_matrix_test",
  organizationName: "Apex Cloud Innovations",
  email: "lead@apexcloud.com",
  name: "Jordan Lee",
  role: "ADMIN",
  permissions: ["admin:access"],
};

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(async () => mockSessionUser),
  requirePermission: vi.fn(async () => mockSessionUser),
  getSession: vi.fn(async () => mockSessionUser),
}));

describe("Company Capabilities & Skillset Matrix Ingestion Engine", () => {
  beforeEach(() => {
    mockLeadsStore.length = 0;
    delete mockAiConfigsStore["org_matrix_test"];
  });

  describe("Document Buffer & PDF Ingestion", () => {
    it("should extract text from plain text and markdown buffers", () => {
      const textContent =
        "Apex Cloud Innovations provides Next.js, Node.js, AWS Kubernetes development and Cloud Migration services. We do NOT do SEO or Hardware.";
      const buffer = Buffer.from(textContent, "utf-8");

      const res = extractTextFromDocumentBuffer(buffer, "capabilities.txt");
      expect(res.success).toBe(true);
      expect(res.text).toContain("Next.js");
      expect(res.text).toContain("SEO");
    });

    it("should extract text streams from PDF stream buffer", () => {
      const fakePdf = `%PDF-1.4
1 0 obj << /Length 60 >> stream
BT
/F1 12 Tf
(Apex Cloud Enterprise Solutions) Tj
[(Kubernetes) 20 (AWS) 30 (Microservices)] TJ
ET
endstream
endobj
%%EOF`;
      const buffer = Buffer.from(fakePdf, "latin1");

      const res = extractTextFromDocumentBuffer(buffer, "pitch-deck.pdf");
      expect(res.success).toBe(true);
      expect(res.text).toContain("Apex Cloud Enterprise Solutions");
      expect(res.text).toContain("Kubernetes");
      expect(res.text).toContain("AWS");
    });
  });

  describe("Heuristic Capabilities Synthesizer", () => {
    it("should synthesize a structured CompanyMatrix from unstructured text", async () => {
      const sampleText = `
About Apex Cloud Innovations:
We help high-growth B2B SaaS and Fintech companies modernize legacy monoliths and accelerate engineering delivery.
Our services include Custom Software Development, Cloud Architecture, DevOps & CI/CD Pipelines, and API Integration.
Core tech stack: Next.js, React, Node.js, Python, PostgreSQL, AWS, and Docker.
Case study: Reduced deployment pipeline latency by 3.5x for FinScale Payments.
Note: We strictly do not provide Hardware development, Crypto/NFT projects, or SEO Marketing.
      `;

      const matrix = await synthesizeCompanyMatrix(sampleText, {
        websiteUrl: "https://apexcloud.io",
      });

      expect(matrix).toBeDefined();
      expect(matrix.websiteUrl).toBe("https://apexcloud.io");
      expect(matrix.elevatorPitch).toContain("modernize legacy monoliths");

      // Verify core skills extracted
      expect(matrix.coreSkillsets).toContain("Next.js");
      expect(matrix.coreSkillsets).toContain("React");
      expect(matrix.coreSkillsets).toContain("Node.js");
      expect(matrix.coreSkillsets).toContain("AWS");

      // Verify services
      expect(matrix.serviceOfferings.length).toBeGreaterThan(0);

      // Verify target industries
      expect(matrix.targetIndustries).toContain("B2B SaaS & Cloud Platforms");
      expect(matrix.targetIndustries).toContain("Fintech & Financial Services");

      // Verify exclusions
      expect(matrix.outOfScopeExclusions).toContain("Hardware & Embedded Systems");
      expect(matrix.outOfScopeExclusions).toContain("Cryptocurrency & Web3");
      expect(matrix.outOfScopeExclusions).toContain("SEO & Social Media Marketing");
    });
  });

  describe("Skillset Matching & Peer-Level Guardrails", () => {
    const verifiedMatrix: CompanyMatrix = {
      websiteUrl: "https://apexcloud.io",
      elevatorPitch: "Modern cloud architecture and dedicated engineering teams for enterprise platforms.",
      coreSkillsets: ["Next.js", "React", "Node.js", "Python", "AWS", "Kubernetes", "PostgreSQL"],
      serviceOfferings: [
        "Cloud Architecture & Modernization",
        "Custom Software & Web App Development",
        "Dedicated Engineering Teams",
      ],
      targetIndustries: ["B2B SaaS & Cloud Platforms", "Fintech & Financial Services"],
      caseStudies: [
        {
          id: "cs_1",
          title: "Fintech Event Streaming",
          metric: "99.99% Reliability",
          summary: "Engineered scalable pipeline handling 100k events/sec.",
          industry: "Fintech & Financial Services",
        },
      ],
      outOfScopeExclusions: ["Hardware", "SEO", "Crypto"],
    };

    it("should match Engineering leader with Cloud/Engineering capabilities and peer technical tone", () => {
      const matched = matchLeadWithCompanySkillsets(
        {
          firstName: "Marcus",
          jobTitle: "VP of Engineering",
          companyIndustry: "Fintech",
        },
        verifiedMatrix
      );

      expect(matched.primaryCapability).toBe("Cloud Architecture & Modernization");
      expect(matched.peerToneGuidance).toContain("architecture");
      expect(matched.matchedCaseStudy?.metric).toBe("99.99% Reliability");

      // Verify exclusions were strictly observed
      expect(matched.excludedSkillsAvoided).toContain("Hardware");
      expect(matched.excludedSkillsAvoided).toContain("SEO");
      expect(matched.excludedSkillsAvoided).toContain("Crypto");
    });

    it("should match Commercial/Sales leader with pipeline/workflow focus and business outcome tone", () => {
      const matched = matchLeadWithCompanySkillsets(
        {
          firstName: "Rachel",
          jobTitle: "Chief Revenue Officer",
          companyIndustry: "B2B SaaS",
        },
        verifiedMatrix
      );

      expect(matched.peerToneGuidance).toContain("pipeline velocity");
      expect(matched.excludedSkillsAvoided).toContain("SEO");
    });

    it("should strictly avoid out-of-scope services in research brief", () => {
      const brief = buildLeadResearchBrief({
        firstName: "Elena",
        jobTitle: "Head of Marketing",
        companyMatrix: verifiedMatrix,
      });

      expect(brief.matchedSkillset).toBeDefined();
      // Should not pitch SEO because it is in outOfScopeExclusions
      expect(brief.matchedSkillset?.primaryCapability).not.toContain("SEO");
      expect(brief.matchedSkillset?.excludedSkillsAvoided).toContain("SEO");
    });
  });

  describe("Server Actions: Persistence & Lead Generation", () => {
    it("should save and retrieve tenant company matrix", async () => {
      const testMatrix: CompanyMatrix = {
        elevatorPitch: "Transforming enterprise data workflows with custom automation.",
        coreSkillsets: ["Python", "FastAPI", "React", "PostgreSQL"],
        serviceOfferings: ["Data Engineering Pipelines", "Internal Tools Development"],
        targetIndustries: ["Healthcare & Life Sciences"],
        caseStudies: [],
        outOfScopeExclusions: ["Blockchain"],
      };

      const saveRes = await saveCompanyMatrixAction(testMatrix);
      expect(saveRes.success).toBe(true);

      const getRes = await getCompanyMatrixAction();
      expect(getRes.success).toBe(true);
      expect(getRes.data?.elevatorPitch).toBe(testMatrix.elevatorPitch);
      expect(getRes.data?.coreSkillsets).toEqual(testMatrix.coreSkillsets);
      expect(getRes.data?.outOfScopeExclusions).toContain("Blockchain");
    });

    it("should generate email adhering to tenant matrix when requested for a lead", async () => {
      const testMatrix: CompanyMatrix = {
        elevatorPitch: "Specialists in zero-downtime cloud migration.",
        coreSkillsets: ["AWS", "Terraform", "Docker"],
        serviceOfferings: ["Cloud Migration"],
        targetIndustries: ["Fintech"],
        caseStudies: [],
        outOfScopeExclusions: ["Mobile Apps", "SEO"],
      };

      await saveCompanyMatrixAction(testMatrix);

      mockLeadsStore.push({
        id: "lead_test_matrix_1",
        organizationId: "org_matrix_test",
        leadNumber: "LD-9901",
        firstName: "David",
        lastName: "Miller",
        jobTitle: "Director of Infrastructure",
        companyName: "PayStream Global",
        email: "david@paystream.com",
        industry: "Fintech",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await generateLeadAiEmailAction({
        leadId: "lead_test_matrix_1",
        objective: "INITIAL_OUTREACH",
        tone: "PROFESSIONAL",
      });

      expect(res.success).toBe(true);
      expect(res.data?.researchBrief.matchedSkillset).toBeDefined();
      expect(res.data?.researchBrief.matchedSkillset?.primaryCapability).toBe("Cloud Migration");
      expect(res.data?.suggestion.body.toLowerCase()).not.toContain("mobile apps");
    });
  });
});
