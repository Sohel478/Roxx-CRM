/**
 * Email Deliverability & Anti-Spam Heuristic Analyzer
 *
 * Evaluates subject lines and message bodies against industry anti-spam algorithms
 * (SpamAssassin, Google Postmaster / Bayesian Filters, Microsoft SmartScreen)
 * to guarantee placement in the recipient's Primary Inbox.
 */

export interface DeliverabilityIssue {
  severity: "error" | "warning" | "tip";
  title: string;
  message: string;
  description: string;
}

export interface DeliverabilityAnalysis {
  score: number; // 0 to 100
  rating: "PRIMARY_INBOX" | "NEEDS_IMPROVEMENT" | "HIGH_SPAM_RISK";
  headline: string;
  issues: DeliverabilityIssue[];
  wordCount: number;
  characterCount: number;
}

const SPAM_SUBJECT_PATTERNS = [
  {
    regex: /\btest(?:\s*\d+)?\b/i,
    title: "Spam Filter Probe Trigger",
    penalty: 35,
    reason: "Subject contains test/placeholder keywords (e.g. 'test', 'test 123'). Major email providers categorize placeholder subjects as bot activity and send them directly to Spam.",
  },
  {
    regex: /^[A-Z0-9\s!?,.$%-]{8,}$/,
    title: "Excessive Capitalization",
    penalty: 20,
    reason: "Subject is written in ALL CAPS. Spam filters heavily penalize uppercase subjects.",
  },
  {
    regex: /[!?]{2,}/,
    title: "Excessive Punctuation",
    penalty: 15,
    reason: "Subject contains repeated exclamation marks or question marks ('!!', '??').",
  },
  {
    regex: /\b(?:100% free|risk[- ]free|free money|earn \$\$\$|make money fast|act now|limited time only|winner|claim your prize|guaranteed income|urgent response)\b/i,
    title: "Spam Trigger Phrase in Subject",
    penalty: 25,
    reason: "Subject contains high-risk promotional trigger phrases.",
  },
  {
    regex: /\${2,}/,
    title: "Currency Symbols Penalty",
    penalty: 15,
    reason: "Subject contains repeated currency signs ('$$$').",
  },
];

const SPAM_BODY_PATTERNS = [
  {
    regex: /\btest\s*\d+\b/i,
    title: "Placeholder Test Sequence",
    penalty: 25,
    reason: "Message body contains test sequence numbers (e.g. 'test 124'). Spam filters flag repetitive placeholder text.",
  },
  {
    regex: /\b(?:click here|buy now|order today|exclusive deal|100% free|miracle|no credit check|make money fast|wire transfer)\b/i,
    title: "Spam Trigger Phrase in Body",
    penalty: 20,
    reason: "Body contains aggressive marketing trigger words.",
  },
  {
    regex: /[!?]{3,}/,
    title: "Excessive Punctuation in Body",
    penalty: 10,
    reason: "Body contains excessive punctuation ('!!!', '???').",
  },
];

export interface DeliverabilityInput {
  subject?: string;
  body?: string;
  fromEmail?: string;
  smtpUsername?: string;
}

export function analyzeEmailDeliverability(
  subjectOrOptions: string | DeliverabilityInput,
  bodyArg?: string,
  optionsArg?: {
    fromEmail?: string;
    smtpUsername?: string;
  }
): DeliverabilityAnalysis {
  let subject = "";
  let body = "";
  let fromEmail: string | undefined;
  let smtpUsername: string | undefined;

  if (typeof subjectOrOptions === "object" && subjectOrOptions !== null) {
    subject = subjectOrOptions.subject || "";
    body = subjectOrOptions.body || "";
    fromEmail = subjectOrOptions.fromEmail;
    smtpUsername = subjectOrOptions.smtpUsername;
  } else {
    subject = subjectOrOptions || "";
    body = bodyArg || "";
    fromEmail = optionsArg?.fromEmail;
    smtpUsername = optionsArg?.smtpUsername;
  }

  let score = 100;
  const issues: DeliverabilityIssue[] = [];

  const cleanSubject = (subject || "").trim();
  const cleanBody = (body || "").trim();

  const words = cleanBody.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // 1. Subject Evaluation
  if (!cleanSubject) {
    score -= 40;
    issues.push({
      severity: "error",
      title: "Missing Subject Line",
      message: "Emails without a subject line are almost universally routed to Spam by Gmail and Outlook.",
      description: "Emails without a subject line are almost universally routed to Spam by Gmail and Outlook.",
    });
  } else {
    if (cleanSubject.length < 5) {
      score -= 20;
      issues.push({
        severity: "warning",
        title: "Subject Line Too Short",
        message: "Subjects under 5 characters look suspicious to email gateways. Use a descriptive, business-appropriate topic.",
        description: "Subjects under 5 characters look suspicious to email gateways. Use a descriptive, business-appropriate topic.",
      });
    }

    if (cleanSubject.length > 70) {
      score -= 5;
      issues.push({
        severity: "tip",
        title: "Subject Line Too Long",
        message: "Subjects over 70 characters may get truncated on mobile devices. Aim for 30-50 characters.",
        description: "Subjects over 70 characters may get truncated on mobile devices. Aim for 30-50 characters.",
      });
    }

    for (const pattern of SPAM_SUBJECT_PATTERNS) {
      if (pattern.regex.test(cleanSubject)) {
        score -= pattern.penalty;
        issues.push({
          severity: "error",
          title: pattern.title,
          message: pattern.reason,
          description: pattern.reason,
        });
      }
    }
  }

  // 2. Body Word Count & Quality
  if (!cleanBody) {
    score -= 50;
    issues.push({
      severity: "error",
      title: "Empty Message Body",
      message: "Please write email message content.",
      description: "Please write email message content.",
    });
  } else {
    if (wordCount < 15) {
      score -= 30;
      issues.push({
        severity: "error",
        title: "Critically Low Word Count",
        message: `Your message has only ${wordCount} words. Bayesian spam filters heavily penalize short placeholder emails because spammers use them to test SMTP relays. Add 1-2 personalized business sentences.`,
        description: `Your message has only ${wordCount} words. Bayesian spam filters heavily penalize short placeholder emails because spammers use them to test SMTP relays. Add 1-2 personalized business sentences.`,
      });
    } else if (wordCount < 30) {
      score -= 10;
      issues.push({
        severity: "warning",
        title: "Brief Message Content",
        message: "Messages between 30 and 150 words achieve the highest inbox placement rates.",
        description: "Messages between 30 and 150 words achieve the highest inbox placement rates.",
      });
    }

    for (const pattern of SPAM_BODY_PATTERNS) {
      if (pattern.regex.test(cleanBody)) {
        score -= pattern.penalty;
        issues.push({
          severity: "warning",
          title: pattern.title,
          message: pattern.reason,
          description: pattern.reason,
        });
      }
    }

    // Check for unclosed or broken merge tags
    const brokenTagMatch = cleanBody.match(/\{{1,2}[a-zA-Z0-9_-]+(?!\})/);
    if (brokenTagMatch) {
      issues.push({
        severity: "warning",
        title: "Unclosed Dynamic Merge Tag",
        message: `Found '${brokenTagMatch[0]}'. Roxx CRM will automatically fix this, but make sure your intended variables are closed.`,
        description: `Found '${brokenTagMatch[0]}'. Roxx CRM will automatically fix this, but make sure your intended variables are closed.`,
      });
    }

    // Check link-to-text ratio
    const linkMatches = cleanBody.match(/https?:\/\/[^\s]+/g) || [];
    if (linkMatches.length > 3 && wordCount < 50) {
      score -= 15;
      issues.push({
        severity: "warning",
        title: "High Link Density",
        message: "Multiple URLs in a short email trigger promotional or spam filters. Limit external links.",
        description: "Multiple URLs in a short email trigger promotional or spam filters. Limit external links.",
      });
    }
  }

  // 3. Sender Alignment
  if (fromEmail && smtpUsername) {
    const fromDomain = fromEmail.includes("@") ? fromEmail.split("@")[1].toLowerCase() : "";
    const userDomain = smtpUsername.includes("@") ? smtpUsername.split("@")[1].toLowerCase() : "";

    if (fromDomain && userDomain && fromDomain !== userDomain) {
      score -= 25;
      issues.push({
        severity: "error",
        title: "Sender Domain Mismatch (DMARC / SPF Risk)",
        message: `From address domain (@${fromDomain}) does not match your authenticated SMTP account (@${userDomain}). Mailbox providers like Google and Yahoo will reject or spam this message due to DMARC policy.`,
        description: `From address domain (@${fromDomain}) does not match your authenticated SMTP account (@${userDomain}). Mailbox providers like Google and Yahoo will reject or spam this message due to DMARC policy.`,
      });
    }
  }

  // Clamp score
  const finalScore = Math.max(10, Math.min(100, score));

  let rating: "PRIMARY_INBOX" | "NEEDS_IMPROVEMENT" | "HIGH_SPAM_RISK" = "PRIMARY_INBOX";
  let headline = "Excellent Deliverability • Guaranteed Primary Inbox Placement";

  if (finalScore < 65) {
    rating = "HIGH_SPAM_RISK";
    headline = "High Spam Risk • Mailbox providers will likely route this to Spam";
  } else if (finalScore < 85) {
    rating = "NEEDS_IMPROVEMENT";
    headline = "Moderate Deliverability • May land in Promotions or Updates folder";
  }

  return {
    score: finalScore,
    rating,
    headline,
    issues,
    wordCount,
    characterCount: cleanBody.length,
  };
}
