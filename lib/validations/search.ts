import { z } from "zod";

export const globalSearchSchema = z.object({
  q: z.string().trim().min(2, "Search query must be at least 2 characters"),
});

export type GlobalSearchQuery = z.infer<typeof globalSearchSchema>;

export interface GlobalSearchResultItem {
  id: string;
  type: "opportunity" | "lead" | "company" | "contact";
  title: string;
  subtitle: string;
  badge?: string;
  href: string;
}

export interface GlobalSearchResults {
  opportunities: GlobalSearchResultItem[];
  leads: GlobalSearchResultItem[];
  companies: GlobalSearchResultItem[];
  contacts: GlobalSearchResultItem[];
  totalMatches: number;
}
