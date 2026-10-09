/**
 * AI Batch Study & Cadence Generation Engine
 *
 * Studies an entire cohort of leads in a marketing batch one-by-one,
 * generating tailored bespoke outreach emails and automated follow-up sequences.
 */

import {
  LeadResearchContext,
  buildLeadResearchBrief,
  generatePersonalizedLeadEmail,
  AiEmailObjective,
  AiEmailTone,
  AiEmailSuggestion,
  LeadResearchBrief,
  resolveCleanCompanyName,
} from "./lead-researcher";
import { analyzeEmailDeliverability } from "@/lib/email/deliverability-analyzer";

export interface BatchStudyLeadInput {
  id: string;
  leadNumber?: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  customerLinkedin?: string | null;
  companyLinkedin?: string | null;
  website?: string | null;
  description?: string | null;
  industry?: string | null;
  phone?: string | null;
  rating?: string | null;
}

export interface StudiedLeadItem {
  leadId: string;
  leadNumber: string;
  leadName: string;
  leadEmail: string;
  companyName: string;
  jobTitle: string;
  researchBrief: LeadResearchBrief;
  initialEmail: {
    subject: string;
    body: string;
    deliverabilityScore: number;
    deliverabilityRating: "PRIMARY_INBOX" | "NEEDS_IMPROVEMENT" | "HIGH_SPAM_RISK";
  };
  followUpEmail?: {
    subject: string;
    body: string;
    followUpDays: number;
    deliverabilityScore: number;
  };
}

export interface BatchStudyResult {
  batchId: string;
  totalStudied: number;
  leads: StudiedLeadItem[];
  commonThemes: string[];
  suggestedPacingMinutes: number;
}

export interface BatchStudyConfig {
  batchId: string;
  objective?: AiEmailObjective;
  tone?: AiEmailTone;
  valueProposition?: string;
  customInstruction?: string;
  repName?: string;
  repEmail?: string;
  organizationName?: string;
  enableFollowUp?: boolean;
  followUpDays?: number;
  companyMatrix?: import("@/lib/validations/marketing").CompanyMatrix | null;
  aiProvider?: "builtin" | "openai" | "gemini";
  apiKey?: string | null;
}

/**
 * Builds a natural contextual Step 2 follow-up email
 */
function buildContextualFollowUp(
  lead: BatchStudyLeadInput,
  initialSubject: string,
  repName: string,
  cleanCompany: string
): { subject: string; body: string } {
  const firstName = lead.firstName?.trim() || "there";
  const company = cleanCompany || "your team";

  const subject = initialSubject.toLowerCase().startsWith("re:")
    ? initialSubject
    : `Re: ${initialSubject}`;

  const body = `Hi ${firstName},

I wanted to quickly bump this up in your inbox in case it slipped past during a busy week.

Has your team at ${company} had a moment to think about the points I mentioned regarding streamlining your outreach pipeline?

If you have 5 minutes later this week, I'd love to connect. If timing is completely off, just let me know and I won't follow up further.

Best regards,
${repName}`;

  return { subject, body };
}

/**
 * Studies all leads in a batch one by one, synthesizing deep contextual research
 * and individual bespoke email copies.
 */
export async function studyMarketingBatch(
  leads: BatchStudyLeadInput[],
  config: BatchStudyConfig
): Promise<BatchStudyResult> {
  const repName = config.repName || "Account Representative";
  const repEmail = config.repEmail || "";
  const orgName = config.organizationName || "Roxx CRM";
  const followUpDays = config.followUpDays || 3;

  const studiedLeads: StudiedLeadItem[] = [];
  const industriesEncountered = new Set<string>();

  for (const lead of leads) {
    if (!lead.email) {
      // Skip leads without email
      continue;
    }

    const cleanCompany = resolveCleanCompanyName(lead.companyName, lead.website, lead.email).cleanName;

    const context: LeadResearchContext = {
      leadId: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      companyName: cleanCompany,
      jobTitle: lead.jobTitle,
      email: lead.email,
      phone: lead.phone,
      customerLinkedin: lead.customerLinkedin,
      companyLinkedin: lead.companyLinkedin,
      website: lead.website,
      description: lead.description,
      companyIndustry: lead.industry,
      rating: lead.rating,
      repName,
      repEmail,
      organizationName: orgName,
      companyMatrix: config.companyMatrix,
    };

    const researchBrief = buildLeadResearchBrief(context);
    if (lead.industry) industriesEncountered.add(lead.industry);

    const emailSuggestion: AiEmailSuggestion = await generatePersonalizedLeadEmail(context, {
      objective: config.objective,
      tone: config.tone,
      valueProposition: config.valueProposition,
      customInstruction: config.customInstruction,
      apiKey: config.apiKey || undefined,
      aiProvider: config.aiProvider || "builtin",
      leadIndex: studiedLeads.length,
    });

    const deliverability = analyzeEmailDeliverability({
      subject: emailSuggestion.subject,
      body: emailSuggestion.body,
    });

    let followUpData: StudiedLeadItem["followUpEmail"] | undefined = undefined;
    if (config.enableFollowUp) {
      const followUp = buildContextualFollowUp(lead, emailSuggestion.subject, repName, cleanCompany);
      const followUpDeliv = analyzeEmailDeliverability({
        subject: followUp.subject,
        body: followUp.body,
      });

      followUpData = {
        subject: followUp.subject,
        body: followUp.body,
        followUpDays,
        deliverabilityScore: followUpDeliv.score,
      };
    }

    studiedLeads.push({
      leadId: lead.id,
      leadNumber: lead.leadNumber || `LEAD-${lead.id.slice(-4).toUpperCase()}`,
      leadName: `${lead.firstName} ${lead.lastName || ""}`.trim(),
      leadEmail: lead.email,
      companyName: cleanCompany,
      jobTitle: lead.jobTitle || "Executive",
      researchBrief,
      initialEmail: {
        subject: emailSuggestion.subject,
        body: emailSuggestion.body,
        deliverabilityScore: deliverability.score,
        deliverabilityRating: deliverability.rating,
      },
      followUpEmail: followUpData,
    });
  }

  const commonThemes = [
    `Identified decision makers across ${industriesEncountered.size || "multiple"} target sectors`,
    `Crafted tailored value hooks based on individual LinkedIn & domain profiles`,
    `Configured human 1-on-1 paragraph formatting to maximize Primary Inbox placement`,
  ];

  return {
    batchId: config.batchId,
    totalStudied: studiedLeads.length,
    leads: studiedLeads,
    commonThemes,
    suggestedPacingMinutes: studiedLeads.length > 20 ? 3 : 2,
  };
}
