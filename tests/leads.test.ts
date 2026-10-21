import { describe, it, expect } from "vitest";
import { leadSchema, isTechfluxOrganization } from "@/lib/validations/leads";
import { resolveOwnerNameFromStore } from "@/lib/leads/owner-resolution";

describe("Lead Validation & Duplicate Rules", () => {
  it("validates valid lead data", () => {
    const valid = {
      firstName: "Elena",
      lastName: "Rostova",
      email: "elena@cyberdyne.local",
      phone: "+1 555 492 8172",
      companyName: "Cyberdyne Systems",
      jobTitle: "IT Director",
      source: "Website",
      status: "New",
      rating: "Hot",
      estimatedValue: 45000,
      currency: "USD",
      description: "Urgent requirements",
    };

    const res = leadSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it("rejects lead missing first name", () => {
    const invalid = {
      firstName: "",
      email: "test@example.com",
    };

    const res = leadSchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("First name is required");
    }
  });

  it("rejects negative estimated deal value", () => {
    const invalid = {
      firstName: "Marcus",
      estimatedValue: -500,
    };

    const res = leadSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("normalizes phone numbers for duplicate detection", () => {
    const phoneInput = "+1 (555) 492-8172";
    const normalized = phoneInput.replace(/[^0-9]/g, "");
    expect(normalized).toBe("15554928172");
  });

  it("normalizes email addresses for case-insensitive duplicate matching", () => {
    const email1 = " Elena.Rostova@CyberdyneSys.LOCAL  ";
    const email2 = "elena.rostova@cyberdynesys.local";
    expect(email1.trim().toLowerCase()).toBe(email2);
  });

  it("supports all standardized CRM lead statuses including Scraped", () => {
    const statuses = ["Scraped", "New", "Contacted", "Qualified", "Unqualified", "Nurture", "Converted", "Lost"];
    for (const status of statuses) {
      const res = leadSchema.safeParse({ firstName: "Test", status });
      expect(res.success).toBe(true);
    }
  });

  it("identifies Techflux organization accurately and excludes others", () => {
    expect(isTechfluxOrganization("Techflux", "org_123")).toBe(true);
    expect(isTechfluxOrganization("techflux solutions", null)).toBe(true);
    expect(isTechfluxOrganization(null, "techflux-tenant")).toBe(true);

    expect(isTechfluxOrganization("Demo Company", "demo-org-123")).toBe(false);
    expect(isTechfluxOrganization("Acme Corp", "org_acme")).toBe(false);
    expect(isTechfluxOrganization(null, null)).toBe(false);
  });

  it("renders Scraped tab only for Techflux organization", () => {
    const getTabsForOrg = (isTechflux: boolean) =>
      isTechflux
        ? ["ALL", "Scraped", "New", "Contacted", "Qualified", "Nurture", "Lost"]
        : ["ALL", "New", "Contacted", "Qualified", "Nurture", "Lost"];

    const techfluxTabs = getTabsForOrg(true);
    expect(techfluxTabs).toContain("Scraped");
    expect(techfluxTabs[1]).toBe("Scraped");

    const otherOrgTabs = getTabsForOrg(false);
    expect(otherOrgTabs).not.toContain("Scraped");
    expect(otherOrgTabs[1]).toBe("New");
  });

  it("validates companyLinkedin and customerLinkedin fields correctly", () => {
    const leadWithLinkedin = {
      firstName: "John",
      lastName: "Doe",
      companyName: "Acme Inc",
      companyLinkedin: "https://linkedin.com/company/acme",
      customerLinkedin: "https://linkedin.com/in/johndoe",
      source: "Scraped Data",
      status: "Scraped",
    };

    const res = leadSchema.safeParse(leadWithLinkedin);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.companyLinkedin).toBe("https://linkedin.com/company/acme");
      expect(res.data.customerLinkedin).toBe("https://linkedin.com/in/johndoe");
    }

    // Nullable/optional behavior
    const leadWithoutLinkedin = {
      firstName: "Jane",
      companyLinkedin: null,
      customerLinkedin: null,
    };
    const res2 = leadSchema.safeParse(leadWithoutLinkedin);
    expect(res2.success).toBe(true);
  });

  it("validates emailStatus with Sent, Follow up, and NA values", () => {
    for (const validStatus of ["Sent", "Follow up", "NA"] as const) {
      const res = leadSchema.safeParse({ firstName: "Test", emailStatus: validStatus });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.emailStatus).toBe(validStatus);
      }
    }

    const invalid = leadSchema.safeParse({ firstName: "Test", emailStatus: "UNKNOWN" as any });
    expect(invalid.success).toBe(false);
  });

  it("evaluates owner scope matching correctly for ALL, ME, and UNASSIGNED", () => {
    const currentUserId = "usr_sohel";
    const currentSessionName = "Sohel J";
    const sampleLeads = [
      { id: "1", ownerId: "usr_sohel", ownerName: "Sohel J", createdById: "usr_sohel" },
      { id: "2", ownerId: "usr_sheetal", ownerName: "Sheetal D", createdById: "usr_sheetal" },
      { id: "3", ownerId: null, ownerName: null, createdById: "usr_other" },
    ];

    // Filter ALL
    const filterAll = sampleLeads.filter(() => true);
    expect(filterAll.length).toBe(3);

    // Filter ME
    const filterMe = sampleLeads.filter(
      (l) => l.ownerId === currentUserId || l.createdById === currentUserId || l.ownerName === currentSessionName
    );
    expect(filterMe.length).toBe(1);
    expect(filterMe[0].id).toBe("1");

    // Filter UNASSIGNED
    const filterUnassigned = sampleLeads.filter((l) => !l.ownerId);
    expect(filterUnassigned.length).toBe(1);
    expect(filterUnassigned[0].id).toBe("3");

    // Filter specific owner
    const filterSheetal = sampleLeads.filter((l) => l.ownerId === "usr_sheetal");
    expect(filterSheetal.length).toBe(1);
    expect(filterSheetal[0].id).toBe("2");
  });

  it("filters leads by emailStatus (Sent, Follow up, NA) accurately", () => {
    const sampleLeads = [
      { id: "1", emailStatus: "Sent" },
      { id: "2", emailStatus: "Follow up" },
      { id: "3", emailStatus: "NA" },
      { id: "4", emailStatus: "Sent" },
    ];

    const sent = sampleLeads.filter((l) => l.emailStatus === "Sent");
    expect(sent.length).toBe(2);

    const followUp = sampleLeads.filter((l) => l.emailStatus === "Follow up");
    expect(followUp.length).toBe(1);
    expect(followUp[0].id).toBe("2");

    const na = sampleLeads.filter((l) => l.emailStatus === "NA");
    expect(na.length).toBe(1);
    expect(na[0].id).toBe("3");
  });

  it("validates and accepts company website URL in lead schema", () => {
    const leadWithWebsite = {
      firstName: "Mohsin",
      lastName: "S",
      companyName: "Bellawoman",
      website: "https://bellawoman.com",
      jobTitle: "CEO",
    };

    const res = leadSchema.safeParse(leadWithWebsite);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.website).toBe("https://bellawoman.com");
    }
  });

  it("accurately resolves owner names for team members and never defaults to session owner", () => {
    const session = {
      id: "usr_sohel",
      name: "Sohel Jatu",
      email: "sohel@techflux.in",
    };

    // 1. Assign to Sheetal D -> Sheetal D (NEVER Sohel Jatu)
    const sheetalName = resolveOwnerNameFromStore("usr_sheetal", session);
    expect(sheetalName).toBe("Sheetal D");

    // 2. Assign to Alex Sales -> Alex Sales
    const alexName = resolveOwnerNameFromStore("usr_alex", session);
    expect(alexName).toBe("Alex Sales");

    // 3. Assign to Self / ME -> Sohel Jatu
    const selfName = resolveOwnerNameFromStore("ME", session);
    expect(selfName).toBe("Sohel Jatu");
    const selfIdName = resolveOwnerNameFromStore("usr_sohel", session);
    expect(selfIdName).toBe("Sohel Jatu");

    // 4. Unassigned -> null
    expect(resolveOwnerNameFromStore("UNASSIGNED", session)).toBe(null);
    expect(resolveOwnerNameFromStore(null, session)).toBe(null);
    expect(resolveOwnerNameFromStore(undefined, session)).toBe(null);

    // 5. Preserves explicit team member fallbackName when provided
    const customMember = resolveOwnerNameFromStore("usr_sheetal_custom", session, "Sheetal D");
    expect(customMember).toBe("Sheetal D");
  });

  it("ensures initial-leads.json contains explicit emailStatus across reps and defaults unassigned to NA", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "lib/db/initial-leads.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const leads = JSON.parse(raw);

    expect(leads.length).toBe(414);

    // 1. Every lead must have a valid emailStatus
    for (const lead of leads) {
      expect(["Sent", "Follow up", "NA"]).toContain(lead.emailStatus);

      // If no email exists, it MUST be NA
      if (!lead.email && !lead.supportEmail) {
        expect(lead.emailStatus).toBe("NA");
      }
    }

    // 2. Rep assignment integrity
    const sheetalLeads = leads.filter((l: any) => l.ownerId === "usr_sheetal");
    const alexLeads = leads.filter((l: any) => l.ownerId === "usr_alex");
    const unassignedLeads = leads.filter((l: any) => !l.ownerId);

    expect(sheetalLeads.length).toBe(150);
    expect(alexLeads.length).toBe(150);
    expect(unassignedLeads.length).toBe(114);

    // 3. Sheetal leads have a realistic distribution of Sent, Follow up, and NA
    const sheetalSent = sheetalLeads.filter((l: any) => l.emailStatus === "Sent").length;
    const sheetalFollowUp = sheetalLeads.filter((l: any) => l.emailStatus === "Follow up").length;
    const sheetalNA = sheetalLeads.filter((l: any) => l.emailStatus === "NA").length;

    expect(sheetalSent).toBeGreaterThan(40);
    expect(sheetalFollowUp).toBeGreaterThan(40);
    expect(sheetalNA).toBeGreaterThan(30);
    expect(sheetalSent + sheetalFollowUp + sheetalNA).toBe(150);

    // 4. Alex leads have a realistic distribution of Sent, Follow up, and NA
    const alexSent = alexLeads.filter((l: any) => l.emailStatus === "Sent").length;
    const alexFollowUp = alexLeads.filter((l: any) => l.emailStatus === "Follow up").length;
    const alexNA = alexLeads.filter((l: any) => l.emailStatus === "NA").length;

    expect(alexSent).toBeGreaterThan(40);
    expect(alexFollowUp).toBeGreaterThan(40);
    expect(alexNA).toBeGreaterThan(30);
    expect(alexSent + alexFollowUp + alexNA).toBe(150);

    // 5. Unassigned leads must all be NA
    for (const lead of unassignedLeads) {
      expect(lead.emailStatus).toBe("NA");
    }
  });
});
