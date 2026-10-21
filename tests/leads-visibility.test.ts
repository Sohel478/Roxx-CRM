import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { createLeadAction, getLeadsAction, getLeadByIdAction, assignLeadAction } from "@/actions/leads";
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
  });
});
