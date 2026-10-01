import { describe, it, expect } from "vitest";
import { navigationItems } from "@/components/layout/sidebar";

describe("Sidebar Navigation Items", () => {
  it("includes all 10 core MVP CRM navigation links", () => {
    const itemNames = navigationItems.map((item) => item.name);
    const itemHrefs = navigationItems.map((item) => item.href);

    expect(itemNames).toEqual([
      "Dashboard",
      "Inbox",
      "Leads",
      "Companies",
      "Contacts",
      "Opportunities",
      "Tasks",
      "Activities",
      "Reports",
      "Settings",
    ]);

    expect(itemHrefs).toEqual([
      "/dashboard",
      "/inbox",
      "/leads",
      "/companies",
      "/contacts",
      "/opportunities",
      "/tasks",
      "/activities",
      "/reports",
      "/settings",
    ]);
  });
});
