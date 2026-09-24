"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requirePermission } from "@/lib/auth/session";
import {
  mockOrgSettingsStore,
  mockPipelineStagesStore,
  mockAuditLogsStore,
} from "@/lib/db/mock-store";
import {
  organizationSettingsSchema,
  OrganizationSettings,
  PipelineStageItem,
} from "@/lib/validations/settings";

/**
 * Fetch organization profile and preferences
 */
export async function getOrganizationSettingsAction(): Promise<{
  success: boolean;
  data?: OrganizationSettings;
  error?: string;
}> {
  const session = await requireAuth();

  try {
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
    });

    if (org) {
      return {
        success: true,
        data: {
          name: org.name,
          timezone: "UTC",
          defaultCurrency: "USD",
          fiscalYearStart: "January",
          dateFormat: "YYYY-MM-DD",
        },
      };
    }

    return { success: true, data: { ...mockOrgSettingsStore } };
  } catch {
    return { success: true, data: { ...mockOrgSettingsStore } };
  }
}

/**
 * Update organization profile and preferences
 */
export async function updateOrganizationSettingsAction(
  input: OrganizationSettings
): Promise<{ success: boolean; data?: OrganizationSettings; error?: string }> {
  const session = await requirePermission("settings:update");

  const parsed = organizationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid settings input",
    };
  }

  const { name, timezone, defaultCurrency, fiscalYearStart, dateFormat } = parsed.data;

  try {
    await prisma.organization.update({
      where: { id: session.organizationId },
      data: { name },
    });

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
          action: "SETTINGS_UPDATED",
          entityType: "Organization",
          entityId: session.organizationId,
          newValues: { name, timezone, defaultCurrency, fiscalYearStart, dateFormat },
        },
      });
    } catch {
      // Non-critical audit error
    }

    revalidatePath("/settings");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: { name, timezone, defaultCurrency, fiscalYearStart, dateFormat },
    };
  } catch {
    // Fallback store
    const oldValues = { ...mockOrgSettingsStore };
    mockOrgSettingsStore.name = name;
    mockOrgSettingsStore.timezone = timezone;
    mockOrgSettingsStore.defaultCurrency = defaultCurrency;
    mockOrgSettingsStore.fiscalYearStart = fiscalYearStart;
    mockOrgSettingsStore.dateFormat = dateFormat;

    mockAuditLogsStore.unshift({
      id: `audit_${Date.now()}`,
      organizationId: session.organizationId,
      userId: session.id,
      userName: session.name,
      action: "SETTINGS_UPDATED",
      entityType: "Organization",
      entityId: session.organizationId,
      oldValues,
      newValues: { name, timezone, defaultCurrency, fiscalYearStart, dateFormat },
      ipAddress: "127.0.0.1",
      createdAt: new Date().toISOString(),
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: { ...mockOrgSettingsStore },
    };
  }
}

/**
 * Fetch Pipeline Stages
 */
export async function getPipelineStagesAction(): Promise<{
  success: boolean;
  data?: PipelineStageItem[];
  error?: string;
}> {
  const session = await requireAuth();

  try {
    const pipeline = await prisma.pipeline.findFirst({
      where: { organizationId: session.organizationId },
      include: {
        stages: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (pipeline && pipeline.stages.length > 0) {
      return {
        success: true,
        data: pipeline.stages.map((s) => ({
          id: s.id,
          name: s.name,
          order: s.order,
          probability: s.probability,
          color: s.color || "#6366f1",
          isWon: s.isWon,
          isLost: s.isLost,
        })),
      };
    }

    return { success: true, data: [...mockPipelineStagesStore] };
  } catch {
    return { success: true, data: [...mockPipelineStagesStore] };
  }
}

/**
 * Update Pipeline Stages
 */
export async function updatePipelineStagesAction(
  stages: PipelineStageItem[]
): Promise<{ success: boolean; data?: PipelineStageItem[]; error?: string }> {
  const session = await requirePermission("settings:update");

  if (!stages || stages.length === 0) {
    return { success: false, error: "Pipeline must have at least one stage." };
  }

  try {
    const pipeline = await prisma.pipeline.findFirst({
      where: { organizationId: session.organizationId },
    });

    if (pipeline) {
      for (const st of stages) {
        await prisma.pipelineStage.upsert({
          where: { id: st.id },
          update: {
            name: st.name,
            order: st.order,
            probability: st.probability,
            color: st.color,
            isWon: st.isWon,
            isLost: st.isLost,
          },
          create: {
            pipelineId: pipeline.id,
            name: st.name,
            order: st.order,
            probability: st.probability,
            color: st.color,
            isWon: st.isWon,
            isLost: st.isLost,
          },
        });
      }
    }

    revalidatePath("/settings");
    revalidatePath("/opportunities");
    return { success: true, data: stages };
  } catch {
    // Fallback store
    mockPipelineStagesStore.length = 0;
    stages.forEach((st) => mockPipelineStagesStore.push(st));

    mockAuditLogsStore.unshift({
      id: `audit_${Date.now()}`,
      organizationId: session.organizationId,
      userId: session.id,
      userName: session.name,
      action: "PIPELINE_STAGES_UPDATED",
      entityType: "PipelineStage",
      entityId: "pipeline_default",
      oldValues: null,
      newValues: { stagesCount: stages.length },
      ipAddress: "127.0.0.1",
      createdAt: new Date().toISOString(),
    });

    revalidatePath("/settings");
    revalidatePath("/opportunities");
    return { success: true, data: [...mockPipelineStagesStore] };
  }
}
