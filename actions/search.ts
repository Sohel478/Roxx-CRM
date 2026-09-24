"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import {
  mockLeadsStore,
  mockOpportunitiesStore,
  mockCompaniesStore,
  mockContactsStore,
} from "@/lib/db/mock-store";
import {
  GlobalSearchResults,
  GlobalSearchResultItem,
} from "@/lib/validations/search";

export type { GlobalSearchResults, GlobalSearchResultItem };

/**
 * Searches the in-memory store immediately
 */
function searchMockStore(query: string): GlobalSearchResults {
  const filteredOpps: GlobalSearchResultItem[] = mockOpportunitiesStore
    .filter(
      (o) =>
        o.name.toLowerCase().includes(query) ||
        o.companyName.toLowerCase().includes(query) ||
        (o.ownerName && o.ownerName.toLowerCase().includes(query)) ||
        (o.stageName && o.stageName.toLowerCase().includes(query))
    )
    .slice(0, 5)
    .map((o) => ({
      id: o.id,
      type: "opportunity",
      title: o.name,
      subtitle: `${o.companyName} • $${o.amount.toLocaleString()} ${o.currency}`,
      badge: o.stageName,
      href: `/opportunities/${o.id}`,
    }));

  const filteredLeads: GlobalSearchResultItem[] = mockLeadsStore
    .filter(
      (l) =>
        l.fullName.toLowerCase().includes(query) ||
        l.firstName.toLowerCase().includes(query) ||
        (l.lastName && l.lastName.toLowerCase().includes(query)) ||
        (l.companyName && l.companyName.toLowerCase().includes(query)) ||
        (l.email && l.email.toLowerCase().includes(query)) ||
        (l.phone && l.phone.toLowerCase().includes(query)) ||
        (l.leadNumber && l.leadNumber.toLowerCase().includes(query))
    )
    .slice(0, 5)
    .map((l) => ({
      id: l.id,
      type: "lead",
      title: l.fullName,
      subtitle: `${l.companyName || "Independent"} • ${l.email || l.phone || l.leadNumber}`,
      badge: l.status,
      href: `/leads/${l.id}`,
    }));

  const filteredCompanies: GlobalSearchResultItem[] = mockCompaniesStore
    .filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.industry && c.industry.toLowerCase().includes(query)) ||
        (c.city && c.city.toLowerCase().includes(query)) ||
        (c.country && c.country.toLowerCase().includes(query))
    )
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      type: "company",
      title: c.name,
      subtitle: `${c.industry || "General Account"} • ${c.city ? `${c.city}, ` : ""}${c.country || "Global"}`,
      badge: c.status,
      href: `/companies/${c.id}`,
    }));

  const filteredContacts: GlobalSearchResultItem[] = mockContactsStore
    .filter(
      (c) =>
        c.fullName.toLowerCase().includes(query) ||
        c.firstName.toLowerCase().includes(query) ||
        (c.lastName && c.lastName.toLowerCase().includes(query)) ||
        (c.companyName && c.companyName.toLowerCase().includes(query)) ||
        (c.email && c.email.toLowerCase().includes(query)) ||
        (c.jobTitle && c.jobTitle.toLowerCase().includes(query))
    )
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      type: "contact",
      title: c.fullName,
      subtitle: `${c.companyName || "Individual"} • ${c.jobTitle || "Contact"} • ${c.email || ""}`,
      href: `/contacts/${c.id}`,
    }));

  const total =
    filteredOpps.length +
    filteredLeads.length +
    filteredCompanies.length +
    filteredContacts.length;

  return {
    opportunities: filteredOpps,
    leads: filteredLeads,
    companies: filteredCompanies,
    contacts: filteredContacts,
    totalMatches: total,
  };
}

/**
 * Real-time cross-entity global search action for Spotlight Command Palette
 */
export async function globalSearchAction(
  rawQuery: string
): Promise<{ success: boolean; data?: GlobalSearchResults; error?: string }> {
  let session;
  try {
    session = await requireAuth();
  } catch {
    // Fallback in dev if auth check fails
  }

  const query = (rawQuery || "").trim().toLowerCase();

  if (!query) {
    return {
      success: true,
      data: {
        opportunities: [],
        leads: [],
        companies: [],
        contacts: [],
        totalMatches: 0,
      },
    };
  }

  const isDummyDatabase =
    !process.env.DATABASE_URL ||
    process.env.DATABASE_URL.includes("sample") ||
    process.env.DATABASE_URL.includes("example");

  // If local development with mock database, return instant sub-millisecond search
  if (isDummyDatabase || !session) {
    return {
      success: true,
      data: searchMockStore(query),
    };
  }

  try {
    const { organizationId } = await resolveTenantContext(session);

    // Add a 1.2s timeout race so if remote Postgres is slow or unreachable, it falls back instantly
    const searchPromise = Promise.all([
      prisma.opportunity.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { company: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        include: { company: true, stage: true },
        take: 5,
      }),
      prisma.lead.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { companyName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { leadNumber: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),
      prisma.company.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { industry: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),
      prisma.contact.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { jobTitle: { contains: query, mode: "insensitive" } },
          ],
        },
        include: { company: true },
        take: 5,
      }),
    ]);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Search timeout")), 1200)
    );

    const [opps, leads, companies, contacts] = await Promise.race([
      searchPromise,
      timeoutPromise,
    ]);

    const mappedOpps: GlobalSearchResultItem[] = opps.map((o) => ({
      id: o.id,
      type: "opportunity",
      title: o.name,
      subtitle: `${o.company?.name || "Account"} • $${Number(o.amount).toLocaleString()}`,
      badge: o.stage?.name || "Open",
      href: `/opportunities/${o.id}`,
    }));

    const mappedLeads: GlobalSearchResultItem[] = leads.map((l) => ({
      id: l.id,
      type: "lead",
      title: `${l.firstName} ${l.lastName || ""}`.trim(),
      subtitle: `${l.companyName || "Independent"} • ${l.email || l.phone || l.leadNumber}`,
      badge: l.status,
      href: `/leads/${l.id}`,
    }));

    const mappedCompanies: GlobalSearchResultItem[] = companies.map((c) => ({
      id: c.id,
      type: "company",
      title: c.name,
      subtitle: `${c.industry || "General Account"} • ${c.city || c.country || "Global"}`,
      badge: c.status,
      href: `/companies/${c.id}`,
    }));

    const mappedContacts: GlobalSearchResultItem[] = contacts.map((c) => ({
      id: c.id,
      type: "contact",
      title: `${c.firstName} ${c.lastName || ""}`.trim(),
      subtitle: `${c.company?.name || "Individual"} • ${c.jobTitle || "Contact"}`,
      href: `/contacts/${c.id}`,
    }));

    const total =
      mappedOpps.length +
      mappedLeads.length +
      mappedCompanies.length +
      mappedContacts.length;

    return {
      success: true,
      data: {
        opportunities: mappedOpps,
        leads: mappedLeads,
        companies: mappedCompanies,
        contacts: mappedContacts,
        totalMatches: total,
      },
    };
  } catch {
    // Instant fallback store search
    return {
      success: true,
      data: searchMockStore(query),
    };
  }
}
