import { z } from "zod";

export interface PipelineStageItem {
  id: string;
  name: string;
  order: number;
  probability: number;
  color: string;
  isWon?: boolean;
  isLost?: boolean;
}

export const PIPELINE_STAGES: readonly PipelineStageItem[] = [
  { id: "stage_new", name: "New", order: 1, probability: 10, color: "#3B82F6", isWon: false, isLost: false },
  { id: "stage_qualified", name: "Qualified", order: 2, probability: 25, color: "#8B5CF6", isWon: false, isLost: false },
  { id: "stage_discovery", name: "Discovery", order: 3, probability: 40, color: "#6366F1", isWon: false, isLost: false },
  { id: "stage_proposal", name: "Proposal", order: 4, probability: 60, color: "#F59E0B", isWon: false, isLost: false },
  { id: "stage_negotiation", name: "Negotiation", order: 5, probability: 80, color: "#EC4899", isWon: false, isLost: false },
  { id: "stage_won", name: "Won", order: 6, probability: 100, color: "#059669", isWon: true, isLost: false },
  { id: "stage_lost", name: "Lost", order: 7, probability: 0, color: "#EF4444", isWon: false, isLost: true },
];

export const LOSS_REASONS = [
  "Pricing / Budget Constraints",
  "Competitor Chosen",
  "Missing Required Features",
  "Timing / Project Postponed",
  "Internal Solution Built",
  "No Decision / Executive Ghosted",
  "Other",
] as const;

export const opportunitySchema = z.object({
  name: z.string().min(2, "Opportunity name must be at least 2 characters"),
  amount: z.coerce.number().min(0, "Amount cannot be negative").default(0),
  currency: z.string().default("USD"),
  companyId: z.string().min(1, "Company is required"),
  primaryContactId: z.string().optional(),
  leadId: z.string().optional(),
  stageName: z.string().default("Qualified"),
  expectedCloseDate: z.string().optional(),
  description: z.string().optional(),
});

export type OpportunityFormData = z.infer<typeof opportunitySchema>;

export const closeOpportunitySchema = z.object({
  status: z.enum(["WON", "LOST"]),
  lossReason: z.string().optional(),
  lossNotes: z.string().optional(),
}).refine(
  (data) => {
    if (data.status === "LOST") {
      return Boolean(data.lossReason && data.lossReason.trim().length > 0);
    }
    return true;
  },
  {
    message: "A structured loss reason is required when marking a deal as Lost",
    path: ["lossReason"],
  }
);

export type CloseOpportunityFormData = z.infer<typeof closeOpportunitySchema>;

export interface OpportunityItem {
  id: string;
  organizationId?: string;
  name: string;
  amount: number;
  currency: string;
  companyId: string;
  companyName: string;
  primaryContactId: string | null;
  primaryContactName: string | null;
  primaryContactEmail?: string | null;
  leadId: string | null;
  pipelineId?: string;
  stageId: string;
  stageName: string;
  probability: number;
  ownerId?: string;
  ownerName: string;
  status: "OPEN" | "WON" | "LOST";
  lossReason: string | null;
  description: string | null;
  expectedCloseDate: string | null;
  closedAt: string | null;
  createdAt: string;
}
