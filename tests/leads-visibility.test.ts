import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { createLeadAction, updateLeadAction, getLeadsAction, getLeadByIdAction, assignLeadAction } from "@/actions/leads";
import * as sessionModule from "@/lib/auth/session";
import { mockLeadsStore } from "@/lib/db/mock-store";

describe("Lead Creation & Table Visibility", () => {
  beforeEach(() => {
    vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
      id: "usr_sohel",
      organizationId: "demo-org-123",
      organizationName: "Techflux Solutions",
      email: "sohel@techflux.in",
      name: "Sohel Jatu",
      role: "ADMIN",
      permissions: ["lead:create", "lead:read", "lead:update", "lead:delete"],
      expiresAt: Date.now() + 3600000,
    });

    vi.spyOn(sessionModule, "requirePermission").mockResolvedValue({
      id: "usr_sohel",
      organizationId: "demo-org-123",
      organizationName: "Techflux Solutions",
      email: "sohel@techflux.in",
      name: "Sohel Jatu",
      role: "ADMIN",
      permissions: ["lead:create", "lead:read", "lead:update", "lead:delete"],
      expiresAt: Date.now() + 3600000,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createLeadAction returns a complete LeadItem and places it at index 0 in getLeadsAction", async () => {
    const payload = {
      firstName: "Mohsin",
      lastName: "Bella",
      companyName: "Bella Woman Boutique",
      website: "https://www.bellawoman.com/",
      source: "Website",
      status: "New" as const,
      rating: "Warm" as const,
      estimatedValue: 12000,
      currency: "USD",
      description: "Website: https://www.bellawoman.com/",
    };

    const createRes = await createLeadAction(payload);
    expect(createRes.success).toBe(true);
    expect(createRes.data).toBeDefined();
    expect(createRes.data.fullName).toBe("Mohsin Bella");
    expect(createRes.data.website).toBe("https://www.bellawoman.com/");
    expect(createRes.data.status).toBe("New");
    expect(createRes.data.leadNumber).toMatch(/^LEAD-\d+/);

    // Now retrieve leads through getLeadsAction on page 1 with status ALL
    const listRes = await getLeadsAction({
      page: 1,
      limit: 10,
      status: "ALL",
    });

    expect(listRes.success).toBe(true);
    expect(listRes.data.items.length).toBeGreaterThan(0);
    // The newly created lead must be at index 0 because it was created most recently
    const topLead = listRes.data.items[0];
    expect(topLead.id).toBe(createRes.data.id);
    expect(topLead.fullName).toBe("Mohsin Bella");
    expect(topLead.website).toBe("https://www.bellawoman.com/");
  });

  it("getLeadsAction retrieves newly created lead with status filter matching its status", async () => {
    const payload = {
      firstName: "Amina",
      lastName: "Kader",
      companyName: "Amina Couture",
      website: "https://aminacouture.com",
      status: "Qualified" as const,
      rating: "Hot" as const,
      estimatedValue: 50000,
      currency: "USD",
    };

    const createRes = await createLeadAction(payload);
    expect(createRes.success).toBe(true);

    // Query for Qualified status
    const qualifiedRes = await getLeadsAction({
      page: 1,
      limit: 10,
      status: "Qualified",
    });

    expect(qualifiedRes.success).toBe(true);
    const found = qualifiedRes.data.items.find((l) => l.id === createRes.data.id);
    expect(found).toBeDefined();
    expect(found?.fullName).toBe("Amina Kader");
    expect(found?.status).toBe("Qualified");
  });

  it("getLeadsAction search query finds the lead by name, company, or website", async () => {
    const payload = {
      firstName: "Zubair",
      lastName: "Chowdhury",
      companyName: "Zubair Tech Enterprises",
      email: "zubair@zte.local",
      status: "New" as const,
      rating: "Warm" as const,
      estimatedValue: 25000,
      currency: "USD",
    };

    const createRes = await createLeadAction(payload);
    expect(createRes.success).toBe(true);

    const searchRes = await getLeadsAction({
      page: 1,
      limit: 10,
      search: "Zubair",
    });

    expect(searchRes.success).toBe(true);
    expect(searchRes.data.items.some((l) => l.id === createRes.data.id)).toBe(true);
  });

  it("getLeadByIdAction immediately retrieves the newly created lead with all details", async () => {
    const payload = {
      firstName: "Tariq",
      lastName: "Mansoor",
      companyName: "Mansoor Logistics",
      email: "tariq@mansoor.io",
      website: "https://mansoor.io",
      status: "New" as const,
      rating: "Hot" as const,
      estimatedValue: 45000,
      currency: "USD",
    };

    const createRes = await createLeadAction(payload);
    expect(createRes.success).toBe(true);
    const newId = createRes.data.id;

    // Simulate page refresh / dossier fetch
    const detailRes = await getLeadByIdAction(newId);
    expect(detailRes.success).toBe(true);
    expect(detailRes.data).toBeDefined();
    expect(detailRes.data?.id).toBe(newId);
    expect(detailRes.data?.fullName).toBe("Tariq Mansoor");
    expect(detailRes.data?.companyName).toBe("Mansoor Logistics");
    expect(detailRes.data?.ownerId).toBe("usr_sohel");
    expect(detailRes.data?.ownerName).toBe("Sohel Jatu");
  });

  it("assignLeadAction successfully reassigns owner and persists across subsequent queries", async () => {
    const payload = {
      firstName: "Ranya",
      lastName: "Habib",
      companyName: "Habib Designs",
      email: "ranya@habib.art",
      status: "New" as const,
      rating: "Warm" as const,
      estimatedValue: 15000,
      currency: "USD",
    };

    const createRes = await createLeadAction(payload);
    expect(createRes.success).toBe(true);
    const leadId = createRes.data.id;

    // Reassign to Sheetal D
    const assignRes = await assignLeadAction(leadId, "usr_sheetal");
    expect(assignRes.success).toBe(true);

    // Verify detail
    const detailRes = await getLeadByIdAction(leadId);
    expect(detailRes.success).toBe(true);
    expect(detailRes.data?.ownerId).toBe("usr_sheetal");
    expect(detailRes.data?.ownerName).toBe("Sheetal D");

    // Reassign to Unassigned explicitly
    const unassignRes = await assignLeadAction(leadId, "UNASSIGNED");
    expect(unassignRes.success).toBe(true);

    const detailUnassigned = await getLeadByIdAction(leadId);
    expect(detailUnassigned.success).toBe(true);
    expect(detailUnassigned.data?.ownerId).toBeNull();
    expect(detailUnassigned.data?.ownerName).toBeNull();

    // Reassign back to Sheetal D to restore clean state
    await assignLeadAction(leadId, "usr_sheetal");
  });

  it("Newly created lead persists deterministically across 10 consecutive page refreshes without vanishing or flapping", async () => {
    const payload = {
      firstName: "Danish",
      lastName: "Ansari",
      companyName: "Ansari Digital Solutions",
      email: "danish@ansaridigital.com",
      status: "New" as const,
      rating: "Hot" as const,
      estimatedValue: 75000,
      currency: "USD",
    };

    const createRes = await createLeadAction(payload);
    expect(createRes.success).toBe(true);
    const newId = createRes.data.id;

    // Simulate 10 consecutive hard browser refreshes on the leads table
    for (let refreshIndex = 1; refreshIndex <= 10; refreshIndex++) {
      const listRes = await getLeadsAction({
        page: 1,
        limit: 10,
        status: "ALL",
      });

      expect(listRes.success).toBe(true);
      const leadFound = listRes.data.items.find((l) => l.id === newId);
      expect(
        leadFound,
        `Lead vanished on refresh attempt #${refreshIndex}`
      ).toBeDefined();
      expect(leadFound?.fullName).toBe("Danish Ansari");
      expect(leadFound?.ownerName).toBe("Sohel Jatu");
    }
  });

  it("Newly created lead dossier persists deterministically across 10 consecutive refreshes and never returns Lead Not Found", async () => {
    const payload = {
      firstName: "Fatima",
      lastName: "Zahra",
      companyName: "Zahra Haute Couture",
      email: "fatima@zahrahautecouture.com",
      status: "New" as const,
      rating: "Warm" as const,
      estimatedValue: 35000,
      currency: "USD",
    };

    const createRes = await createLeadAction(payload);
    expect(createRes.success).toBe(true);
    const newId = createRes.data.id;

    // Simulate 10 consecutive hard browser refreshes on /leads/[id]
    for (let refreshIndex = 1; refreshIndex <= 10; refreshIndex++) {
      const detailRes = await getLeadByIdAction(newId);
      expect(
        detailRes.success,
        `Dossier returned error on refresh attempt #${refreshIndex}: ${detailRes.error}`
      ).toBe(true);
      expect(detailRes.data).toBeDefined();
      expect(detailRes.data?.id).toBe(newId);
      expect(detailRes.data?.fullName).toBe("Fatima Zahra");
      expect(detailRes.data?.ownerId).toBe("usr_sohel");
      expect(detailRes.data?.ownerName).toBe("Sohel Jatu");
    }
  });

  it("All scraped leads are owned by Sheetal D or Alex Sales and zero are unassigned", async () => {
    const listRes = await getLeadsAction({
      page: 1,
      limit: 100,
      status: "ALL",
    });

    expect(listRes.success).toBe(true);
    // Query with UNASSIGNED filter to verify zero unassigned leads
    const unassignedRes = await getLeadsAction({
      page: 1,
      limit: 100,
      ownerId: "UNASSIGNED",
    });

    expect(unassignedRes.success).toBe(true);
    expect(unassignedRes.data.items.length).toBe(0);
    expect(unassignedRes.data.meta.total).toBe(0);

    // Query with Sheetal D owner filter
    const sheetalRes = await getLeadsAction({
      page: 1,
      limit: 100,
      ownerId: "usr_sheetal",
    });
    expect(sheetalRes.success).toBe(true);
    expect(sheetalRes.data.meta.total).toBeGreaterThanOrEqual(264);
  });

  it("updateLeadAction updates lead fields immediately and persists to getLeadByIdAction and getLeadsAction", async () => {
    // 1. Create a test lead
    const createRes = await createLeadAction({
      firstName: "Mohsin",
      lastName: "Bella",
      companyName: "Bella Woman Boutique",
      website: "https://www.bellawoman.com/",
      source: "Website",
      status: "New" as const,
      rating: "Warm" as const,
      estimatedValue: 12000,
      currency: "USD",
      description: "Initial discovery notes",
    });
    expect(createRes.success).toBe(true);
    const leadId = createRes.data.id;

    // 2. Edit/Update lead data
    const updateRes = await updateLeadAction(leadId, {
      firstName: "Mohsin",
      lastName: "Al-Bella",
      companyName: "Bella Woman Luxe Group",
      website: "https://bellawoman.com/shop",
      status: "Qualified" as const,
      rating: "Hot" as const,
      estimatedValue: 28500,
      description: "Updated VIP discovery notes & pricing inquiry",
    });

    expect(updateRes.success).toBe(true);
    expect(updateRes.data).toBeDefined();
    expect(updateRes.data?.fullName).toBe("Mohsin Al-Bella");
    expect(updateRes.data?.companyName).toBe("Bella Woman Luxe Group");
    expect(updateRes.data?.website).toBe("https://bellawoman.com/shop");
    expect(updateRes.data?.status).toBe("Qualified");
    expect(updateRes.data?.rating).toBe("Hot");
    expect(updateRes.data?.estimatedValue).toBe(28500);

    // 3. Immediately fetch through getLeadByIdAction (Lead Dossier view)
    const detailRes = await getLeadByIdAction(leadId);
    expect(detailRes.success).toBe(true);
    expect(detailRes.data?.fullName).toBe("Mohsin Al-Bella");
    expect(detailRes.data?.companyName).toBe("Bella Woman Luxe Group");
    expect(detailRes.data?.website).toBe("https://bellawoman.com/shop");
    expect(detailRes.data?.status).toBe("Qualified");
    expect(detailRes.data?.rating).toBe("Hot");
    expect(detailRes.data?.estimatedValue).toBe(28500);
    expect(detailRes.data?.description).toBe("Updated VIP discovery notes & pricing inquiry");

    // 4. Also fetch by leadNumber to ensure lookup by lead number reflects updated data
    const leadNumber = detailRes.data?.leadNumber;
    if (leadNumber) {
      const byNumberRes = await getLeadByIdAction(leadNumber);
      expect(byNumberRes.success).toBe(true);
      expect(byNumberRes.data?.companyName).toBe("Bella Woman Luxe Group");
    }

    // 5. Verify getLeadsAction reflects the updated data
    const listRes = await getLeadsAction({
      page: 1,
      limit: 10,
      search: "Bella Woman Luxe",
    });
    expect(listRes.success).toBe(true);
    expect(listRes.data.items.length).toBeGreaterThan(0);
    const found = listRes.data.items.find((l) => l.id === leadId);
    expect(found).toBeDefined();
    expect(found?.fullName).toBe("Mohsin Al-Bella");
    expect(found?.companyName).toBe("Bella Woman Luxe Group");
    expect(found?.website).toBe("https://bellawoman.com/shop");
    expect(found?.rating).toBe("Hot");

    // 6. Verify 5 consecutive re-fetches maintain the edited values
    for (let i = 1; i <= 5; i++) {
      const refetch = await getLeadByIdAction(leadId);
      expect(refetch.success).toBe(true);
      expect(refetch.data?.companyName).toBe("Bella Woman Luxe Group");
      expect(refetch.data?.website).toBe("https://bellawoman.com/shop");
      expect(refetch.data?.estimatedValue).toBe(28500);
    }
  });
});
