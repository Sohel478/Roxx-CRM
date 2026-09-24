export interface SalesEmailTemplate {
  id: string;
  name: string;
  category: "Follow-up" | "Proposal" | "Closing" | "Re-engagement";
  subject: string;
  body: string;
}

export const SALES_EMAIL_TEMPLATES: SalesEmailTemplate[] = [
  {
    id: "tpl_discovery_followup",
    name: "Initial Discovery Follow-Up",
    category: "Follow-up",
    subject: "Following up on our conversation — {{company_name}}",
    body: `Hi {{first_name}},

Thank you for speaking with me today regarding {{company_name}}'s strategic growth initiatives. As discussed, our platform can help streamline your pipeline tracking and improve deal conversion velocity.

Would you have 15 minutes this Thursday or Friday for a brief product walkthrough tailored to your team?

Best regards,
{{rep_name}}`,
  },
  {
    id: "tpl_demo_proposal",
    name: "Product Demo & Proposal Overview",
    category: "Proposal",
    subject: "{{company_name}} — Platform Overview & Commercial Proposal",
    body: `Hi {{first_name}},

Great connecting with your team during our demo session. Following up on {{deal_name}}, I have summarized the core capabilities we reviewed.

Estimated deal investment: {{deal_amount}} USD.

I've attached our implementation guide and look forward to addressing any questions from your leadership team.

Warm regards,
{{rep_name}}`,
  },
  {
    id: "tpl_contract_closing",
    name: "Contract Review & Final Steps",
    category: "Closing",
    subject: "Final steps for {{deal_name}} — Agreement & Onboarding",
    body: `Hi {{first_name}},

Our team has finalized the standard agreement for {{deal_name}}. Everything is in order for {{company_name}} to begin onboarding as soon as contracts are counter-signed.

Please let me know if your legal counsel requires any additional documentation before signature.

Best regards,
{{rep_name}}`,
  },
  {
    id: "tpl_stale_reengagement",
    name: "Stale Deal Check-In & Revival",
    category: "Re-engagement",
    subject: "Checking in regarding {{company_name}}'s evaluation",
    body: `Hi {{first_name}},

I wanted to quickly circle back and see how things are progressing with your evaluation of {{deal_name}}. 

Has your timeline shifted, or would it be helpful to schedule a quick 10-minute sync this week to review any open questions?

Best,
{{rep_name}}`,
  },
];

export interface MergeContext {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  dealName?: string;
  dealAmount?: number | string;
  repName?: string;
}

/**
 * Replace placeholders like {{first_name}}, {{company_name}}, etc. with context values
 */
export function applyMergeTags(text: string, context: MergeContext): string {
  let result = text;

  const formattedAmount =
    typeof context.dealAmount === "number"
      ? `$${context.dealAmount.toLocaleString()}`
      : context.dealAmount || "$0";

  result = result.replace(/\{\{first_name\}\}/gi, context.firstName || "there");
  result = result.replace(/\{\{last_name\}\}/gi, context.lastName || "");
  result = result.replace(/\{\{company_name\}\}/gi, context.companyName || "your company");
  result = result.replace(/\{\{deal_name\}\}/gi, context.dealName || "our discussion");
  result = result.replace(/\{\{deal_amount\}\}/gi, formattedAmount);
  result = result.replace(/\{\{rep_name\}\}/gi, context.repName || "Account Representative");

  return result;
}
