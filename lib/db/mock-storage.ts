import fs from "fs";
import path from "path";
import type {
  MockLead,
  MockCompany,
  MockContact,
  MockOpportunity,
  MockTask,
  MockActivity,
  MockUser,
} from "./mock-store";

export const isTestEnv = Boolean(
  typeof process !== "undefined" && (process.env.VITEST || process.env.NODE_ENV === "test")
);

const isClient = typeof window !== "undefined";

const PRISMA_DIR = !isClient && typeof process !== "undefined" && typeof process.cwd === "function"
  ? path.join(process.cwd(), "prisma")
  : "";
const LEADS_FILE_PATH = PRISMA_DIR ? path.join(PRISMA_DIR, "dev-leads.json") : "";
const COMPANIES_FILE_PATH = PRISMA_DIR ? path.join(PRISMA_DIR, "dev-companies.json") : "";
const CONTACTS_FILE_PATH = PRISMA_DIR ? path.join(PRISMA_DIR, "dev-contacts.json") : "";
const OPPORTUNITIES_FILE_PATH = PRISMA_DIR ? path.join(PRISMA_DIR, "dev-opportunities.json") : "";
const TASKS_FILE_PATH = PRISMA_DIR ? path.join(PRISMA_DIR, "dev-tasks.json") : "";
const ACTIVITIES_FILE_PATH = PRISMA_DIR ? path.join(PRISMA_DIR, "dev-activities.json") : "";
const USERS_FILE_PATH = PRISMA_DIR ? path.join(PRISMA_DIR, "dev-users.json") : "";

const globalForMockStorage = globalThis as unknown as {
  _mockLeadsMtime?: number;
  _mockCompaniesMtime?: number;
  _mockContactsMtime?: number;
  _mockOpportunitiesMtime?: number;
  _mockTasksMtime?: number;
  _mockActivitiesMtime?: number;
  _mockUsersMtime?: number;
};

function safeWriteJson(filePath: string, data: unknown): void {
  if (isClient || !PRISMA_DIR || !filePath || !fs || !fs.existsSync) return;
  try {
    if (!fs.existsSync(PRISMA_DIR)) {
      fs.mkdirSync(PRISMA_DIR, { recursive: true });
    }
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.warn(`[safeWriteJson] Disk write error for ${filePath}:`, err);
  }
}

// ----------------------------------------------------------------------------
// LEADS PERSISTENCE
// ----------------------------------------------------------------------------

export function loadInitialLeads(fallback: MockLead[]): MockLead[] {
  if (isClient || isTestEnv || !LEADS_FILE_PATH || !fs || !fs.existsSync) {
    return [...fallback];
  }
  try {
    if (fs.existsSync(LEADS_FILE_PATH)) {
      const raw = fs.readFileSync(LEADS_FILE_PATH, "utf-8");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const stat = fs.statSync(LEADS_FILE_PATH);
          globalForMockStorage._mockLeadsMtime = stat.mtimeMs;
          const fallbackMap = new Map(fallback.map((f) => [f.id, f]));
          return parsed.map((item: MockLead) => {
            if (!item.emailStatus && fallbackMap.has(item.id)) {
              item.emailStatus = fallbackMap.get(item.id)!.emailStatus || "NA";
            }
            return item;
          });
        }
      }
    }
  } catch (err) {
    console.warn("[loadInitialLeads] Disk read error:", err);
  }
  return [...fallback];
}

export function storagePersistLeads(leads: MockLead[]): void {
  if (isClient || isTestEnv || !LEADS_FILE_PATH || !fs || !fs.existsSync) return;
  safeWriteJson(LEADS_FILE_PATH, leads);
  try {
    if (fs.existsSync(LEADS_FILE_PATH)) {
      const stat = fs.statSync(LEADS_FILE_PATH);
      globalForMockStorage._mockLeadsMtime = stat.mtimeMs;
    }
  } catch {}
}

export function storageSyncLeads(targetStore: MockLead[]): void {
  if (isClient || isTestEnv || !LEADS_FILE_PATH || !fs || !fs.existsSync) return;
  try {
    if (fs.existsSync(LEADS_FILE_PATH)) {
      const stat = fs.statSync(LEADS_FILE_PATH);
      if (
        !globalForMockStorage._mockLeadsMtime ||
        stat.mtimeMs > globalForMockStorage._mockLeadsMtime
      ) {
        const raw = fs.readFileSync(LEADS_FILE_PATH, "utf-8");
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            targetStore.length = 0;
            targetStore.push(...data);
            globalForMockStorage._mockLeadsMtime = stat.mtimeMs;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[storageSyncLeads] Disk sync error:", err);
  }
}

// ----------------------------------------------------------------------------
// COMPANIES PERSISTENCE
// ----------------------------------------------------------------------------

export function loadInitialCompanies(fallback: MockCompany[] = []): MockCompany[] {
  if (isTestEnv) return [...fallback];
  try {
    if (fs.existsSync(COMPANIES_FILE_PATH)) {
      const raw = fs.readFileSync(COMPANIES_FILE_PATH, "utf-8");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const stat = fs.statSync(COMPANIES_FILE_PATH);
          globalForMockStorage._mockCompaniesMtime = stat.mtimeMs;
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("[loadInitialCompanies] Disk read error:", err);
  }
  return [...fallback];
}

export function storagePersistCompanies(companies: MockCompany[]): void {
  if (isTestEnv) return;
  safeWriteJson(COMPANIES_FILE_PATH, companies);
  try {
    if (fs.existsSync(COMPANIES_FILE_PATH)) {
      const stat = fs.statSync(COMPANIES_FILE_PATH);
      globalForMockStorage._mockCompaniesMtime = stat.mtimeMs;
    }
  } catch {}
}

export function storageSyncCompanies(targetStore: MockCompany[]): void {
  if (isTestEnv) return;
  try {
    if (fs.existsSync(COMPANIES_FILE_PATH)) {
      const stat = fs.statSync(COMPANIES_FILE_PATH);
      if (
        !globalForMockStorage._mockCompaniesMtime ||
        stat.mtimeMs > globalForMockStorage._mockCompaniesMtime
      ) {
        const raw = fs.readFileSync(COMPANIES_FILE_PATH, "utf-8");
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            targetStore.length = 0;
            targetStore.push(...data);
            globalForMockStorage._mockCompaniesMtime = stat.mtimeMs;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[storageSyncCompanies] Disk sync error:", err);
  }
}

// ----------------------------------------------------------------------------
// CONTACTS PERSISTENCE
// ----------------------------------------------------------------------------

export function loadInitialContacts(fallback: MockContact[] = []): MockContact[] {
  if (isTestEnv) return [...fallback];
  try {
    if (fs.existsSync(CONTACTS_FILE_PATH)) {
      const raw = fs.readFileSync(CONTACTS_FILE_PATH, "utf-8");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const stat = fs.statSync(CONTACTS_FILE_PATH);
          globalForMockStorage._mockContactsMtime = stat.mtimeMs;
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("[loadInitialContacts] Disk read error:", err);
  }
  return [...fallback];
}

export function storagePersistContacts(contacts: MockContact[]): void {
  if (isTestEnv) return;
  safeWriteJson(CONTACTS_FILE_PATH, contacts);
  try {
    if (fs.existsSync(CONTACTS_FILE_PATH)) {
      const stat = fs.statSync(CONTACTS_FILE_PATH);
      globalForMockStorage._mockContactsMtime = stat.mtimeMs;
    }
  } catch {}
}

export function storageSyncContacts(targetStore: MockContact[]): void {
  if (isTestEnv) return;
  try {
    if (fs.existsSync(CONTACTS_FILE_PATH)) {
      const stat = fs.statSync(CONTACTS_FILE_PATH);
      if (
        !globalForMockStorage._mockContactsMtime ||
        stat.mtimeMs > globalForMockStorage._mockContactsMtime
      ) {
        const raw = fs.readFileSync(CONTACTS_FILE_PATH, "utf-8");
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            targetStore.length = 0;
            targetStore.push(...data);
            globalForMockStorage._mockContactsMtime = stat.mtimeMs;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[storageSyncContacts] Disk sync error:", err);
  }
}

// ----------------------------------------------------------------------------
// OPPORTUNITIES PERSISTENCE
// ----------------------------------------------------------------------------

export function loadInitialOpportunities(fallback: MockOpportunity[] = []): MockOpportunity[] {
  if (isTestEnv) return [...fallback];
  try {
    if (fs.existsSync(OPPORTUNITIES_FILE_PATH)) {
      const raw = fs.readFileSync(OPPORTUNITIES_FILE_PATH, "utf-8");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const stat = fs.statSync(OPPORTUNITIES_FILE_PATH);
          globalForMockStorage._mockOpportunitiesMtime = stat.mtimeMs;
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("[loadInitialOpportunities] Disk read error:", err);
  }
  return [...fallback];
}

export function storagePersistOpportunities(opportunities: MockOpportunity[]): void {
  if (isTestEnv) return;
  safeWriteJson(OPPORTUNITIES_FILE_PATH, opportunities);
  try {
    if (fs.existsSync(OPPORTUNITIES_FILE_PATH)) {
      const stat = fs.statSync(OPPORTUNITIES_FILE_PATH);
      globalForMockStorage._mockOpportunitiesMtime = stat.mtimeMs;
    }
  } catch {}
}

export function storageSyncOpportunities(targetStore: MockOpportunity[]): void {
  if (isTestEnv) return;
  try {
    if (fs.existsSync(OPPORTUNITIES_FILE_PATH)) {
      const stat = fs.statSync(OPPORTUNITIES_FILE_PATH);
      if (
        !globalForMockStorage._mockOpportunitiesMtime ||
        stat.mtimeMs > globalForMockStorage._mockOpportunitiesMtime
      ) {
        const raw = fs.readFileSync(OPPORTUNITIES_FILE_PATH, "utf-8");
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            targetStore.length = 0;
            targetStore.push(...data);
            globalForMockStorage._mockOpportunitiesMtime = stat.mtimeMs;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[storageSyncOpportunities] Disk sync error:", err);
  }
}

// ----------------------------------------------------------------------------
// TASKS & ACTIVITIES PERSISTENCE
// ----------------------------------------------------------------------------

export function loadInitialTasks(fallback: MockTask[]): MockTask[] {
  if (isTestEnv) return [...fallback];
  try {
    if (fs.existsSync(TASKS_FILE_PATH)) {
      const raw = fs.readFileSync(TASKS_FILE_PATH, "utf-8");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const stat = fs.statSync(TASKS_FILE_PATH);
          globalForMockStorage._mockTasksMtime = stat.mtimeMs;
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("[loadInitialTasks] Disk read error:", err);
  }
  return [...fallback];
}

export function storagePersistTasks(tasks: MockTask[]): void {
  if (isTestEnv) return;
  safeWriteJson(TASKS_FILE_PATH, tasks);
  try {
    if (fs.existsSync(TASKS_FILE_PATH)) {
      const stat = fs.statSync(TASKS_FILE_PATH);
      globalForMockStorage._mockTasksMtime = stat.mtimeMs;
    }
  } catch {}
}

export function storageSyncTasks(targetStore: MockTask[]): void {
  if (isTestEnv) return;
  try {
    if (fs.existsSync(TASKS_FILE_PATH)) {
      const stat = fs.statSync(TASKS_FILE_PATH);
      if (
        !globalForMockStorage._mockTasksMtime ||
        stat.mtimeMs > globalForMockStorage._mockTasksMtime
      ) {
        const raw = fs.readFileSync(TASKS_FILE_PATH, "utf-8");
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            targetStore.length = 0;
            targetStore.push(...data);
            globalForMockStorage._mockTasksMtime = stat.mtimeMs;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[storageSyncTasks] Disk sync error:", err);
  }
}

export function loadInitialActivities(fallback: MockActivity[]): MockActivity[] {
  if (isTestEnv) return [...fallback];
  try {
    if (fs.existsSync(ACTIVITIES_FILE_PATH)) {
      const raw = fs.readFileSync(ACTIVITIES_FILE_PATH, "utf-8");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const stat = fs.statSync(ACTIVITIES_FILE_PATH);
          globalForMockStorage._mockActivitiesMtime = stat.mtimeMs;
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("[loadInitialActivities] Disk read error:", err);
  }
  return [...fallback];
}

export function storagePersistActivities(activities: MockActivity[]): void {
  if (isTestEnv) return;
  safeWriteJson(ACTIVITIES_FILE_PATH, activities);
  try {
    if (fs.existsSync(ACTIVITIES_FILE_PATH)) {
      const stat = fs.statSync(ACTIVITIES_FILE_PATH);
      globalForMockStorage._mockActivitiesMtime = stat.mtimeMs;
    }
  } catch {}
}

export function storageSyncActivities(targetStore: MockActivity[]): void {
  if (isTestEnv) return;
  try {
    if (fs.existsSync(ACTIVITIES_FILE_PATH)) {
      const stat = fs.statSync(ACTIVITIES_FILE_PATH);
      if (
        !globalForMockStorage._mockActivitiesMtime ||
        stat.mtimeMs > globalForMockStorage._mockActivitiesMtime
      ) {
        const raw = fs.readFileSync(ACTIVITIES_FILE_PATH, "utf-8");
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            targetStore.length = 0;
            targetStore.push(...data);
            globalForMockStorage._mockActivitiesMtime = stat.mtimeMs;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[storageSyncActivities] Disk sync error:", err);
  }
}

// ----------------------------------------------------------------------------
// USERS PERSISTENCE
// ----------------------------------------------------------------------------

export function loadInitialUsers(fallback: MockUser[]): MockUser[] {
  if (isTestEnv || !USERS_FILE_PATH || !fs || !fs.existsSync) return [...fallback];
  try {
    if (fs.existsSync(USERS_FILE_PATH)) {
      const raw = fs.readFileSync(USERS_FILE_PATH, "utf-8");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const stat = fs.statSync(USERS_FILE_PATH);
          globalForMockStorage._mockUsersMtime = stat.mtimeMs;
          // Merge fallback users if any core users are missing
          const existingIds = new Set(parsed.map((u: MockUser) => u.id));
          const existingEmails = new Set(parsed.map((u: MockUser) => u.email.toLowerCase()));
          const merged = [...parsed];
          for (const fb of fallback) {
            if (!existingIds.has(fb.id) && !existingEmails.has(fb.email.toLowerCase())) {
              merged.push(fb);
            }
          }
          return merged;
        }
      }
    }
  } catch (err) {
    console.warn("[loadInitialUsers] Disk read error:", err);
  }
  return [...fallback];
}

export function storagePersistUsers(users: MockUser[]): void {
  if (isTestEnv || !USERS_FILE_PATH || !fs || !fs.existsSync) return;
  safeWriteJson(USERS_FILE_PATH, users);
  try {
    if (fs.existsSync(USERS_FILE_PATH)) {
      const stat = fs.statSync(USERS_FILE_PATH);
      globalForMockStorage._mockUsersMtime = stat.mtimeMs;
    }
  } catch {}
}

export function storageSyncUsers(targetStore: MockUser[]): void {
  if (isTestEnv || !USERS_FILE_PATH || !fs || !fs.existsSync) return;
  try {
    if (fs.existsSync(USERS_FILE_PATH)) {
      const stat = fs.statSync(USERS_FILE_PATH);
      if (
        !globalForMockStorage._mockUsersMtime ||
        stat.mtimeMs > globalForMockStorage._mockUsersMtime
      ) {
        const raw = fs.readFileSync(USERS_FILE_PATH, "utf-8");
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data) && data.length > 0) {
            targetStore.length = 0;
            targetStore.push(...data);
            globalForMockStorage._mockUsersMtime = stat.mtimeMs;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[storageSyncUsers] Disk sync error:", err);
  }
}
