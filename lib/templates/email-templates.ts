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
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  dealName?: string | null;
  dealAmount?: number | string | null;
  repName?: string | null;
  email?: string | null;
}

/**
 * Replace placeholders like {{first_name}}, {{first_name}, {first_name}, {{company_name}}, etc.
 * with context values. Supports flexible brackets, case insensitivity, camelCase, snake_case,
 * and user typos (such as missing closing braces or single curly braces).
 */
export function applyMergeTags(text: string, context: MergeContext): string {
  if (!text) return "";
  let result = text;

  const formattedAmount =
    typeof context.dealAmount === "number"
      ? `$${context.dealAmount.toLocaleString()}`
      : context.dealAmount || "$0";

  const firstNameVal = (context.firstName || "").trim() || "there";
  const lastNameVal = (context.lastName || "").trim();
  const companyNameVal = (context.companyName || "").trim() || "your company";
  const repNameVal = (context.repName || "").trim() || "Account Representative";
  const emailVal = (context.email || "").trim();
  const dealNameVal = (context.dealName || "").trim() || "our discussion";

  // 1. Last Name (replace before name to avoid partial matching)
  // Supports {{last_name}}, {{last_name}, {last_name}, {{lastname}}, {{lastName}}, {{last name}}, {{surname}}
  result = result.replace(
    /\{{1,2}\s*(?:last[-_ ]?name|lastname|surname|family[-_ ]?name)\s*\}*/gi,
    lastNameVal
  );

  // 2. Company Name
  // Supports {{company_name}}, {{company_name}, {company_name}, {{company}}, {company}, {{companyName}}, {{business_name}}
  result = result.replace(
    /\{{1,2}\s*(?:company[-_ ]?name|company|organization[-_ ]?name|org[-_ ]?name|business[-_ ]?name|business|account[-_ ]?name)\s*\}*/gi,
    companyNameVal
  );

  // 3. First Name / Lead Name
  // Supports {{first_name}}, {{first_name}, {first_name}, {{firstname}}, {{firstName}}, {{first name}}, {{lead_name}}, {{name}}
  result = result.replace(
    /\{{1,2}\s*(?:first[-_ ]?name|firstname|lead[-_ ]?first[-_ ]?name|lead[-_ ]?name|client[-_ ]?name|contact[-_ ]?name|name)\s*\}*/gi,
    firstNameVal
  );

  // 4. Sales Rep / Sender Name
  // Supports {{rep_name}}, {{rep_name}, {rep_name}, {{sender_name}}, {{my_name}}, {{owner_name}}, {{agent_name}}, {{repName}}
  result = result.replace(
    /\{{1,2}\s*(?:rep[-_ ]?name|rep|sender[-_ ]?name|sender|my[-_ ]?name|owner[-_ ]?name|agent[-_ ]?name|sales[-_ ]?rep)\s*\}*/gi,
    repNameVal
  );

  // 5. Lead Email
  // Supports {{email}}, {{email}, {email}, {{lead_email}}, {{client_email}}, {{recipient_email}}
  result = result.replace(
    /\{{1,2}\s*(?:email|lead[-_ ]?email|client[-_ ]?email|recipient[-_ ]?email)\s*\}*/gi,
    emailVal
  );

  // 6. Deal Amount (process before deal name to prevent {{deal}} capturing {{deal_amount}})
  // Supports {{deal_amount}}, {{deal_amount}, {deal_amount}, {{amount}}, {{value}}
  result = result.replace(
    /\{{1,2}\s*(?:deal[-_ ]?amount|deal[-_ ]?value|deal_amount|amount|value)\s*\}*/gi,
    formattedAmount
  );

  // 7. Deal Name
  // Supports {{deal_name}}, {{deal_name}, {deal_name}, {{deal}}, {{opportunity}}
  result = result.replace(
    /\{{1,2}\s*(?:deal[-_ ]?name|deal|opportunity[-_ ]?name|opportunity)\s*\}*/gi,
    dealNameVal
  );

  return result;
}
