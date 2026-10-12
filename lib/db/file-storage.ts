import fs from "fs";
import path from "path";
import type { MockAiConfig } from "./mock-store";

const CONFIG_FILE_PATH = path.join(process.cwd(), "prisma", "dev-ai-config.json");

/**
 * Loads persisted AI configuration from disk with process.env.OPENAI_API_KEY fallback
 */
export function getPersistedAiConfig(): MockAiConfig | null {
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return null;
  }

  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf-8");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          // If env var is available and config has no key, inject env key
          if (!parsed.apiKey && process.env.OPENAI_API_KEY) {
            parsed.apiKey = process.env.OPENAI_API_KEY;
            parsed.aiProvider = "openai";
          }
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("[getPersistedAiConfig] Disk read error:", err);
  }

  // If environment variable has an OpenAI key, auto-configure it
  if (process.env.OPENAI_API_KEY) {
    return {
      organizationId: "default",
      aiProvider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      defaultCompanyPitch: "Helping growing teams automate and personalize client outreach.",
      defaultFollowUpDays: 3,
      defaultPacingMinutes: 2,
      updatedAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Persists AI configuration durably to disk
 */
export function persistAiConfig(config: MockAiConfig): void {
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return;
  }

  try {
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.warn("[persistAiConfig] Disk write error:", err);
  }
}
