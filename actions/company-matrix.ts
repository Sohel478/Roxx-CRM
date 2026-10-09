"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { mockAiConfigsStore, type MockAiConfig } from "@/lib/db/mock-store";
import {
  companyMatrixSchema,
  type CompanyMatrix,
} from "@/lib/validations/marketing";
import {
  extractTextFromUrl,
  extractTextFromDocumentBuffer,
  synthesizeCompanyMatrix,
  type ExtractionResult,
} from "@/lib/ai/company-matrix-extractor";
import { getAiConfigAction } from "./ai-email";

/**
 * 1. Extract capabilities matrix from website URL
 */
export async function extractCompanyMatrixFromUrlAction(input: {
  url: string;
}): Promise<ExtractionResult> {
  try {
    const session = await requireAuth();
    await resolveTenantContext(session);

    if (!input.url || !input.url.trim()) {
      return { success: false, error: "Please provide a valid company website URL." };
    }

    const textRes = await extractTextFromUrl(input.url);
    if (!textRes.success || !textRes.text) {
      return { success: false, error: textRes.error || "Failed to extract text from URL" };
    }

    // Load AI config for tenant to check if OpenAI/Gemini is configured
    const aiConfig = await getAiConfigAction();
    const configData = aiConfig.data;

    const matrix = await synthesizeCompanyMatrix(textRes.text, {
      aiProvider: configData?.aiProvider || "builtin",
      apiKey: configData?.apiKey || undefined,
      websiteUrl: input.url,
    });

    return {
      success: true,
      matrix,
      extractedTextPreview: textRes.text.slice(0, 500),
      sourceUrl: input.url,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error)?.message || "Failed to analyze company website URL",
    };
  }
}

/**
 * 2. Extract capabilities matrix from uploaded file (PDF / TXT / MD)
 */
export async function extractCompanyMatrixFromFileAction(
  formData: FormData
): Promise<ExtractionResult> {
  try {
    const session = await requireAuth();
    await resolveTenantContext(session);

    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, error: "No document file provided for upload." };
    }

    const fileName = file.name || "document.pdf";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const textRes = extractTextFromDocumentBuffer(buffer, fileName);
    if (!textRes.success || !textRes.text) {
      return { success: false, error: textRes.error || "Failed to extract readable text from document" };
    }

    const aiConfig = await getAiConfigAction();
    const configData = aiConfig.data;

    const matrix = await synthesizeCompanyMatrix(textRes.text, {
      aiProvider: configData?.aiProvider || "builtin",
      apiKey: configData?.apiKey || undefined,
    });

    return {
      success: true,
      matrix,
      extractedTextPreview: textRes.text.slice(0, 500),
      sourceFileName: fileName,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error)?.message || "Failed to analyze uploaded document",
    };
  }
}

/**
 * 3. Save tenant's verified company capabilities matrix
 */
export async function saveCompanyMatrixAction(
  matrix: CompanyMatrix
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await requireAuth();
    const { organizationId } = await resolveTenantContext(session);

    const parsed = companyMatrixSchema.safeParse(matrix);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || "Invalid company matrix data",
      };
    }

    const validMatrix = parsed.data;

    // Update in Prisma
    try {
      await prisma.systemSetting.upsert({
        where: {
          organizationId_key: {
            organizationId,
            key: "company_matrix",
          },
        },
        create: {
          organizationId,
          key: "company_matrix",
          value: JSON.stringify(validMatrix),
        },
        update: {
          value: JSON.stringify(validMatrix),
        },
      });
    } catch {
      // Prisma fallback
    }

    // Also update in mock store
    if (!mockAiConfigsStore[organizationId]) {
      mockAiConfigsStore[organizationId] = {
        organizationId,
        aiProvider: "builtin",
        apiKey: null,
        defaultCompanyPitch: validMatrix.elevatorPitch || null,
        defaultFollowUpDays: 3,
        defaultPacingMinutes: 2,
        companyMatrix: validMatrix,
        updatedAt: new Date().toISOString(),
      };
    } else {
      mockAiConfigsStore[organizationId].companyMatrix = validMatrix;
      if (validMatrix.elevatorPitch) {
        mockAiConfigsStore[organizationId].defaultCompanyPitch = validMatrix.elevatorPitch;
      }
      mockAiConfigsStore[organizationId].updatedAt = new Date().toISOString();
    }

    revalidatePath("/settings");

    return {
      success: true,
      message: "Company Capabilities & Skillset Matrix updated successfully.",
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error)?.message || "Failed to save company matrix",
    };
  }
}

/**
 * 4. Get active company capabilities matrix
 */
export async function getCompanyMatrixAction(): Promise<{
  success: boolean;
  data?: CompanyMatrix;
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId } = await resolveTenantContext(session);

    let matrix: CompanyMatrix | null = null;
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: {
          organizationId_key: {
            organizationId,
            key: "company_matrix",
          },
        },
      });
      if (setting?.value) {
        matrix = JSON.parse(setting.value);
      }
    } catch {
      matrix = mockAiConfigsStore[organizationId]?.companyMatrix || null;
    }

    if (!matrix && mockAiConfigsStore[organizationId]?.companyMatrix) {
      matrix = mockAiConfigsStore[organizationId].companyMatrix;
    }

    // Default template if never configured
    if (!matrix) {
      matrix = {
        websiteUrl: null,
        elevatorPitch:
          "Helping growing companies streamline technical execution, modernize core infrastructure, and eliminate workflow bottlenecks.",
        coreSkillsets: [
          "Full-Stack Web Development",
          "Next.js & React",
          "Node.js & Python",
          "Cloud Infrastructure (AWS/GCP)",
          "DevOps & CI/CD Automation",
          "REST & GraphQL APIs",
          "PostgreSQL & Database Design",
          "UI/UX Product Design",
        ],
        serviceOfferings: [
          "Custom Software & Web App Development",
          "Cloud Architecture & Modernization",
          "Dedicated Engineering Teams",
          "API Integration & Systems Architecture",
        ],
        targetIndustries: [
          "B2B SaaS & Cloud Platforms",
          "Fintech & Financial Services",
          "Healthcare & Life Sciences",
        ],
        caseStudies: [
          {
            id: "cs_1",
            title: "Cloud Infrastructure Modernization",
            metric: "3.5x Faster Deployment",
            summary: "Restructured legacy monolith into microservices, accelerating engineering sprint velocity.",
            industry: "B2B SaaS & Cloud Platforms",
          },
          {
            id: "cs_2",
            title: "Fintech High-Throughput Ingestion",
            metric: "99.99% Reliability",
            summary: "Engineered scalable event pipeline processing high-frequency transaction volumes seamlessly.",
            industry: "Fintech & Financial Services",
          },
        ],
        outOfScopeExclusions: [
          "Hardware & Embedded Systems",
          "Cryptocurrency & Web3",
          "SEO & Social Media Marketing",
        ],
      };
    }

    return { success: true, data: matrix };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error)?.message || "Failed to load company matrix",
    };
  }
}
