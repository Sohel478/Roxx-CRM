"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { mockAiConfigsStore, type MockAiConfig } from "@/lib/db/mock-store";
import {
  companyMatrixSchema,
  type CompanyMatrix,
  type CompanyDocument,
} from "@/lib/validations/marketing";
import {
  extractTextFromUrl,
  extractTextFromDocumentBuffer,
  synthesizeCompanyMatrix,
  type ExtractionResult,
} from "@/lib/ai/company-matrix-extractor";
import { getAiConfigAction } from "./ai-email";

/**
 * 1. Extract capabilities matrix from website URL and persist URL to matrix
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

    let normalizedUrl = input.url.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const textRes = await extractTextFromUrl(normalizedUrl);
    if (!textRes.success || !textRes.text) {
      return { success: false, error: textRes.error || "Failed to extract text from URL" };
    }

    // Load existing matrix to preserve any previously uploaded documents
    const currentMatrixRes = await getCompanyMatrixAction();
    const existingDocs = currentMatrixRes.data?.sourceDocuments || [];

    // Load AI config for tenant to check if OpenAI/Gemini is configured
    const aiConfig = await getAiConfigAction();
    const configData = aiConfig.data;

    const matrix = await synthesizeCompanyMatrix(textRes.text, {
      aiProvider: configData?.aiProvider || "builtin",
      apiKey: configData?.apiKey || undefined,
      websiteUrl: normalizedUrl,
    });

    matrix.websiteUrl = normalizedUrl;
    matrix.sourceDocuments = existingDocs;
    matrix.lastExtractedAt = new Date().toISOString();
    matrix.lastExtractedSource = `Website (${normalizedUrl})`;

    // Automatically persist the extracted matrix and source URL
    await saveCompanyMatrixAction(matrix);

    return {
      success: true,
      matrix,
      extractedTextPreview: textRes.text.slice(0, 500),
      sourceUrl: normalizedUrl,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error)?.message || "Failed to analyze company website URL",
    };
  }
}

/**
 * 2. Extract capabilities matrix from uploaded file (PDF / TXT / MD) and persist document
 */
export async function extractCompanyMatrixFromFileAction(
  formData: FormData
): Promise<ExtractionResult> {
  try {
    const session = await requireAuth();
    await resolveTenantContext(session);

    const file = formData.get("file") as any;
    if (!file) {
      return { success: false, error: "No document file provided for upload." };
    }

    const fileName = (typeof file === "object" && file?.name) ? file.name : "document.pdf";
    let buffer: Buffer;
    if (typeof file?.arrayBuffer === "function") {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (typeof file?.text === "function") {
      const text = await file.text();
      buffer = Buffer.from(text, "utf-8");
    } else if (Buffer.isBuffer(file)) {
      buffer = file;
    } else {
      buffer = Buffer.from(String(file), "utf-8");
    }

    const textRes = extractTextFromDocumentBuffer(buffer, fileName);
    if (!textRes.success || !textRes.text) {
      return { success: false, error: textRes.error || "Failed to extract readable text from document" };
    }

    // Load existing matrix to preserve website URL and merge documents
    const currentMatrixRes = await getCompanyMatrixAction();
    const existingDocs = currentMatrixRes.data?.sourceDocuments || [];
    const existingUrl = currentMatrixRes.data?.websiteUrl || null;

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ext = fileName.split(".").pop()?.toLowerCase() || "pdf";

    const newDoc: CompanyDocument = {
      id: docId,
      name: fileName,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      type: ext,
      summary: textRes.text.slice(0, 300),
    };

    // Replace if document with same name exists, otherwise prepend
    const updatedDocs = [
      newDoc,
      ...existingDocs.filter((d) => d.name.toLowerCase() !== fileName.toLowerCase()),
    ];

    const aiConfig = await getAiConfigAction();
    const configData = aiConfig.data;

    const matrix = await synthesizeCompanyMatrix(textRes.text, {
      aiProvider: configData?.aiProvider || "builtin",
      apiKey: configData?.apiKey || undefined,
      websiteUrl: existingUrl || undefined,
    });

    matrix.websiteUrl = existingUrl;
    matrix.sourceDocuments = updatedDocs;
    matrix.lastExtractedAt = new Date().toISOString();
    matrix.lastExtractedSource = `Document (${fileName})`;

    // Automatically persist the synthesized matrix and source document
    await saveCompanyMatrixAction(matrix);

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
 * 3. Remove an uploaded reference document from tenant's company matrix
 */
export async function removeCompanyDocumentAction(documentId: string): Promise<{
  success: boolean;
  matrix?: CompanyMatrix;
  message?: string;
  error?: string;
}> {
  try {
    const matrixRes = await getCompanyMatrixAction();
    if (!matrixRes.success || !matrixRes.data) {
      return { success: false, error: "Capabilities matrix not found" };
    }

    const current = matrixRes.data;
    const filteredDocs = (current.sourceDocuments || []).filter((d) => d.id !== documentId);

    const updated: CompanyMatrix = {
      ...current,
      sourceDocuments: filteredDocs,
    };

    const saveRes = await saveCompanyMatrixAction(updated);
    if (!saveRes.success) {
      return { success: false, error: saveRes.error || "Failed to remove document" };
    }

    return {
      success: true,
      matrix: updated,
      message: "Document removed successfully",
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error)?.message || "Failed to remove document",
    };
  }
}

/**
 * 4. Save tenant's verified company capabilities matrix (preserving URL and source documents)
 */
export async function saveCompanyMatrixAction(
  matrix: CompanyMatrix
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await requireAuth();
    const { organizationId } = await resolveTenantContext(session);

    // Normalize URL if provided without protocol (e.g., 'www.techflux.in')
    if (matrix.websiteUrl && matrix.websiteUrl.trim()) {
      let trimmed = matrix.websiteUrl.trim();
      if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
        trimmed = `https://${trimmed}`;
      }
      matrix.websiteUrl = trimmed;
    }

    // Preserve existing documents or websiteUrl if omitted in partial updates
    const existingInStore = mockAiConfigsStore[organizationId]?.companyMatrix;
    if ((!matrix.sourceDocuments || matrix.sourceDocuments.length === 0) && existingInStore?.sourceDocuments?.length) {
      matrix.sourceDocuments = existingInStore.sourceDocuments;
    }
    if (!matrix.websiteUrl && existingInStore?.websiteUrl) {
      matrix.websiteUrl = existingInStore.websiteUrl;
    }
    if (!matrix.lastExtractedAt && existingInStore?.lastExtractedAt) {
      matrix.lastExtractedAt = existingInStore.lastExtractedAt;
      matrix.lastExtractedSource = existingInStore.lastExtractedSource;
    }

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

    if (matrix && !matrix.sourceDocuments) {
      matrix.sourceDocuments = [];
    }

    // Default template if never configured
    if (!matrix) {
      matrix = {
        websiteUrl: null,
        sourceDocuments: [],
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
        lastExtractedAt: null,
        lastExtractedSource: null,
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
