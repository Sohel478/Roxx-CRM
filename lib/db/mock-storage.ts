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
const INITIAL_LEADS_PATH = !isClient && typeof process !== "undefined" && typeof process.cwd === "function"
  ? path.join(process.cwd(), "lib", "db", "initial-leads.json")
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
  _mockLeadsSize?: number;
  _mockCompaniesMtime?: number;
  _mockCompaniesSize?: number;
  _mockContactsMtime?: number;
  _mockContactsSize?: number;
  _mockOpportunitiesMtime?: number;
  _mockOpportunitiesSize?: number;
  _mockTasksMtime?: number;
  _mockTasksSize?: number;
  _mockActivitiesMtime?: number;
  _mockActivitiesSize?: number;
  _mockUsersMtime?: number;
  _mockUsersSize?: number;
};

function safeWriteJson(filePath: string, data: unknown): void {
  if (isClient || !filePath || !fs || !fs.existsSync) return;
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn(`[safeWriteJson] Disk write error for ${filePath}:`, err);
  }
}

// ----------------------------------------------------------------------------
// LEADS PERSISTENCE
// ----------------------------------------------------------------------------

export function loadInitialLeads(fallback: MockLead[]): MockLead[] {
  if (isClient || isTestEnv || !fs || !fs.existsSync) {
    return [...fallback];
  }
  try {
    const candidates = [LEADS_FILE_PATH, INITIAL_LEADS_PATH].filter(Boolean);
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const stat = fs.statSync(filePath);
            globalForMockStorage._mockLeadsMtime = stat.mtimeMs;
            globalForMockStorage._mockLeadsSize = stat.size;
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
    }
  } catch (err) {
    console.warn("[loadInitialLeads] Disk read error:", err);
  }
  return [...fallback];
}

export function storagePersistLeads(leads: MockLead[]): void {
  if (isClient || isTestEnv || !fs || !fs.existsSync) return;
  if (LEADS_FILE_PATH) safeWriteJson(LEADS_FILE_PATH, leads);
  if (INITIAL_LEADS_PATH) safeWriteJson(INITIAL_LEADS_PATH, leads);
  try {
    const checkPath = (LEADS_FILE_PATH && fs.existsSync(LEADS_FILE_PATH)) ? LEADS_FILE_PATH : INITIAL_LEADS_PATH;
    if (checkPath && fs.existsSync(checkPath)) {
      const stat = fs.statSync(checkPath);
      globalForMockStorage._mockLeadsMtime = stat.mtimeMs;
      globalForMockStorage._mockLeadsSize = stat.size;
    }
  } catch {}
}

export function storageSyncLeads(targetStore: MockLead[], force = false): void {
  if (isClient || isTestEnv || !fs || !fs.existsSync) return;
  try {
    const filePath = (LEADS_FILE_PATH && fs.existsSync(LEADS_FILE_PATH))
      ? LEADS_FILE_PATH
      : (INITIAL_LEADS_PATH && fs.existsSync(INITIAL_LEADS_PATH) ? INITIAL_LEADS_PATH : "");
    if (filePath) {
      const stat = fs.statSync(filePath);
      const needsSync =
        force ||
        !globalForMockStorage._mockLeadsMtime ||
        stat.mtimeMs !== globalForMockStorage._mockLeadsMtime ||
        stat.size !== globalForMockStorage._mockLeadsSize ||
        targetStore.length === 0;

      if (needsSync) {
        const raw = fs.readFileSync(filePath, "utf-8");
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            targetStore.length = 0;
            targetStore.push(...data);
            globalForMockStorage._mockLeadsMtime = stat.mtimeMs;
            globalForMockStorage._mockLeadsSize = stat.size;
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
          globalForMockStorage._mockCompaniesSize = stat.size;
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
      globalForMockStorage._mockCompaniesSize = stat.size;
    }
  } catch {}
}

export function storageSyncCompanies(targetStore: MockCompany[], force = false): void {
  if (isTestEnv) return;
  try {
    if (fs.existsSync(COMPANIES_FILE_PATH)) {
      const stat = fs.statSync(COMPANIES_FILE_PATH);
      const needsSync =
        force ||
        !globalForMockStorage._mockCompaniesMtime ||
        stat.mtimeMs !== globalForMockStorage._mockCompaniesMtime ||
        stat.size !== globalForMockStorage._mockCompaniesSize ||
        targetStore.length === 0;

      if (needsSync) {
        const raw = fs.readFileSync(COMPANIES_FILE_PATH, "utf-8");
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            targetStore.length = 0;
            targetStore.push(...data);
            globalForMockStorage._mockCompaniesMtime = stat.mtimeMs;
            globalForMockStorage._mockCompaniesSize = stat.size;
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
          globalForMockStorage._mockContactsSize = stat.size;
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
      globalForMockStorage._mockContactsSize = stat.size;
    }
  } catch {}
}

export function storageSyncContacts(targetStore: MockContact[], force = false): void {
  if (isTestEnv) return;
  try {
    if (fs.existsSync(CONTACTS_FILE_PATH)) {
      const stat = fs.statSync(CONTACTS_FILE_PATH);
      const needsSync =
        force ||
        !globalForMockStorage._mockContactsMtime ||
        stat.mtimeMs !== globalForMockStorage._mockContactsMtime ||
        stat.size !== globalForMockStorage._mockContactsSize ||
        targetStore.length === 0;

      if (needsSync) {
        const raw = fs.readFileSync(CONTACTS_FILE_PATH, "utf-8");
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            targetStore.length = 0;
            targetStore.push(...data);
            globalForMockStorage._mockContactsMtime = stat.mtimeMs;
            globalForMockStorage._mockContactsSize = stat.size;
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
          globalForMockStorage._mockOpportunitiesSize = stat.size;
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
      globalForMockStorage._mockOpportunitiesSize = stat.size;
    }
  } catch {}
}

export function storageSyncOpportunities(targetStore: MockOpportunity[], force = false): void {
  if (isTestEnv) return;
  try {
    if (fs.existsSync(OPPORTUNITIES_FILE_PATH)) {
      const stat = fs.statSync(OPPORTUNITIES_FILE_PATH);
      const needsSync =
        force ||
        !globalForMockStorage._mockOpportunitiesMtime ||
        stat.mtimeMs !== globalForMockStorage._mockOpportunitiesMtime ||
        stat.size !== globalForMockStorage._mockOpportunitiesSize ||
        targetStore.length === 0;

      if (needsSync) {
        const raw = fs.readFileSync(OPPORTUNITIES_FILE_PATH, "utf-8");
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            targetStore.length = 0;
            targetStore.push(...data);
            globalForMockStorage._mockOpportunitiesMtime = stat.mtimeMs;
            globalForMockStorage._mockOpportunitiesSize = stat.size;
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
          globalForMockStorage._mockTasksSize = stat.size;
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
      globalForMockStorage._mockTasksSize = stat.size;
    }
  } catch {}
}

export function storageSyncTasks(targetStore: MockTask[], force = false): void {
  if (isTestEnv) return;
  try {
    if (fs.existsSync(TASKS_FILE_PATH)) {
      const stat = fs.statSync(TASKS_FILE_PATH);
      const needsSync =
        force ||
        !globalForMockStorage._mockTasksMtime ||
        stat.mtimeMs !== globalForMockStorage._mockTasksMtime ||
        stat.size !== globalForMockStorage._mockTasksSize ||
        targetStore.length === 0;

      if (needsSync) {
        const raw = fs.readFileSync(TASKS_FILE_PATH, "utf-8");
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            targetStore.length = 0;
            targetStore.push(...data);
            globalForMockStorage._mockTasksMtime = stat.mtimeMs;
            globalForMockStorage._mockTasksSize = stat.size;
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
          globalForMockStorage._mockActivitiesSize = stat.size;
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
      globalForMockStorage._mockActivitiesSize = stat.size;
    }
  } catch {}
}

export function storageSyncActivities(targetStore: MockActivity[], force = false): void {
  if (isTestEnv) return;
  try {
    if (fs.existsSync(ACTIVITIES_FILE_PATH)) {
      const stat = fs.statSync(ACTIVITIES_FILE_PATH);
      const needsSync =
        force ||
        !globalForMockStorage._mockActivitiesMtime ||
        stat.mtimeMs !== globalForMockStorage._mockActivitiesMtime ||
        stat.size !== globalForMockStorage._mockActivitiesSize ||
        targetStore.length === 0;

      if (needsSync) {
        const raw = fs.readFileSync(ACTIVITIES_FILE_PATH, "utf-8");
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            targetStore.length = 0;
            targetStore.push(...data);
            globalForMockStorage._mockActivitiesMtime = stat.mtimeMs;
            globalForMockStorage._mockActivitiesSize = stat.size;
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
          globalForMockStorage._mockUsersSize = stat.size;
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
      globalForMockStorage._mockUsersSize = stat.size;
    }
  } catch {}
}

export function storageSyncUsers(targetStore: MockUser[], force = false): void {
  if (isTestEnv || !USERS_FILE_PATH || !fs || !fs.existsSync) return;
  try {
    if (fs.existsSync(USERS_FILE_PATH)) {
      const stat = fs.statSync(USERS_FILE_PATH);
      const needsSync =
        force ||
        !globalForMockStorage._mockUsersMtime ||
        stat.mtimeMs !== globalForMockStorage._mockUsersMtime ||
        stat.size !== globalForMockStorage._mockUsersSize ||
        targetStore.length === 0;

      if (needsSync) {
        const raw = fs.readFileSync(USERS_FILE_PATH, "utf-8");
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data) && data.length > 0) {
            targetStore.length = 0;
            targetStore.push(...data);
            globalForMockStorage._mockUsersMtime = stat.mtimeMs;
            globalForMockStorage._mockUsersSize = stat.size;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[storageSyncUsers] Disk sync error:", err);
  }
}
