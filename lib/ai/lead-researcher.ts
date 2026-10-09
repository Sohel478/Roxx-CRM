/**
 * AI Lead Intelligence & Deep Contextual Research Engine
 *
 * Synthesizes lead profiles, LinkedIn presence, company websites, role responsibilities,
 * and past CRM timeline activities to produce bespoke, high-converting outreach emails.
 */

import { analyzeEmailDeliverability } from "@/lib/email/deliverability-analyzer";
import type { CompanyMatrix } from "@/lib/validations/marketing";

export type AiEmailObjective =
  | "INITIAL_OUTREACH"
  | "MEETING_INVITE"
  | "FOLLOW_UP"
  | "RE_ENGAGEMENT"
  | "VALUE_CASE_STUDY";

export type AiEmailTone =
  | "PROFESSIONAL"
  | "WARM"
  | "EXECUTIVE"
  | "CONSULTATIVE";

export interface MatchedSkillsetResult {
  primaryCapability: string;
  matchedServices: string[];
  matchedSkills: string[];
  matchedCaseStudy?: {
    title: string;
    metric?: string | null;
    summary: string;
  };
  peerToneGuidance: string;
  excludedSkillsAvoided: string[];
}

export interface LeadResearchContext {
  leadId?: string;
  firstName: string;
  lastName?: string | null;
  fullName?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  customerLinkedin?: string | null;
  companyLinkedin?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  source?: string | null;
  sourceDetail?: string | null;
  rating?: string | null;
  description?: string | null;
  companyIndustry?: string | null;
  companyDescription?: string | null;
  repName?: string | null;
  repEmail?: string | null;
  organizationName?: string | null;
  pastActivitiesSummary?: string | null;
  companyMatrix?: CompanyMatrix | null;
}

export type LeadProfileInput = LeadResearchContext;

export interface LeadResearchBrief {
  seniorityLevel: string;
  department: string;
  personaInsights: string;
  companyFocus: string;
  personalizedHook: string;
  recommendedAngle: string;
  detectedPainPoints: string[];
  linkedinPresence?: string;
  matchedSkillset?: MatchedSkillsetResult;
}

export interface AiEmailSuggestion {
  subject: string;
  body: string;
  researchBrief: LeadResearchBrief;
  objective: AiEmailObjective;
  tone: AiEmailTone;
}

export interface AiResearchOptions {
  objective?: AiEmailObjective;
  tone?: AiEmailTone;
  customInstruction?: string;
  valueProposition?: string;
  apiKey?: string;
  aiProvider?: "builtin" | "openai" | "gemini";
  leadIndex?: number;
}

/**
 * Dissects a job title into seniority level and typical business priorities
 */
function analyzeJobTitle(title?: string | null): {
  seniority: "C-LEVEL" | "VP" | "DIRECTOR" | "MANAGER" | "SPECIALIST" | "FOUNDER";
  department: "SALES" | "MARKETING" | "ENGINEERING" | "OPS" | "LEADERSHIP" | "GENERAL";
  priorityCues: string[];
  seniorityLabel: string;
  departmentLabel: string;
} {
  const t = (title || "").toLowerCase();

  let seniority: "C-LEVEL" | "VP" | "DIRECTOR" | "MANAGER" | "SPECIALIST" | "FOUNDER" = "SPECIALIST";
  let seniorityLabel = "Individual Contributor / Lead";

  if (!t) {
    seniorityLabel = "Individual Contributor / Lead";
  } else if (
    t.includes("founder") ||
    t.includes("co-founder") ||
    t.includes("owner") ||
    t.includes("ceo") ||
    t.includes("chief") ||
    t.includes("cto") ||
    t.includes("cro") ||
    t.includes("cmo") ||
    t.includes("president")
  ) {
    seniority = t.includes("founder") ? "FOUNDER" : "C-LEVEL";
    seniorityLabel = "C-Level / Executive";
  } else if (t.includes("vp") || t.includes("vice president")) {
    seniority = "VP";
    seniorityLabel = "VP / Vice President";
  } else if (t.includes("director") || t.includes("head of")) {
    seniority = "DIRECTOR";
    seniorityLabel = "Director / Head of Department";
  } else if (t.includes("manager")) {
    seniority = "MANAGER";
    seniorityLabel = "Manager / Team Lead";
  } else {
    seniority = "SPECIALIST";
    seniorityLabel = "Individual Contributor / Lead";
  }

  let department: "SALES" | "MARKETING" | "ENGINEERING" | "OPS" | "LEADERSHIP" | "GENERAL" = "GENERAL";
  let departmentLabel = "General Management";

  if (
    t.includes("sale") ||
    t.includes("revenue") ||
    t.includes("business dev") ||
    t.includes("bdr") ||
    t.includes("ae")
  ) {
    department = "SALES";
    departmentLabel = "Sales & Business Development";
  } else if (t.includes("market") || t.includes("growth") || t.includes("brand")) {
    department = "MARKETING";
    departmentLabel = "Marketing & Growth";
  } else if (
    t.includes("tech") ||
    t.includes("engineer") ||
    t.includes("product") ||
    t.includes("dev") ||
    t.includes("cloud") ||
    t.includes("infrastructure") ||
    t.includes("software")
  ) {
    department = "ENGINEERING";
    departmentLabel = "Engineering & Product";
  } else if (t.includes("operat") || t.includes("supply") || t.includes("logistic") || t.includes("coo")) {
    department = "OPS";
    departmentLabel = "Operations & Logistics";
  } else if (seniority === "C-LEVEL" || seniority === "FOUNDER") {
    department = "LEADERSHIP";
    departmentLabel = "Executive Leadership";
  }

  const priorityCues: string[] = [];
  if (seniority === "FOUNDER" || seniority === "C-LEVEL") {
    priorityCues.push("Revenue acceleration", "Operational efficiency", "High ROI investments", "Scalable systems");
  } else if (department === "SALES") {
    priorityCues.push("Pipeline velocity", "Lead conversion rate", "CRM deal visibility", "Team sales productivity");
  } else if (department === "MARKETING") {
    priorityCues.push("Inbound lead quality", "Marketing-to-sales handoff", "Campaign ROI");
  } else if (department === "OPS") {
    priorityCues.push("Process automation", "Cross-team handoffs", "Eliminating manual data entry");
  } else {
    priorityCues.push("Streamlining daily workflow", "Better visibility into customer communication");
  }

  return { seniority, department, priorityCues, seniorityLabel, departmentLabel };
}

/**
/**
 * Resolves a clean, human brand name and extracts domain / industry indicators
 */
export function resolveCleanCompanyName(
  companyName?: string | null,
  website?: string | null,
  email?: string | null
): { domain: string; cleanName: string; likelyIndustry: string } {
  let domain = "";
  if (website && typeof website === "string") {
    try {
      const url = website.startsWith("http") ? website : `https://${website}`;
      domain = new URL(url).hostname.replace(/^www\./i, "");
    } catch {
      domain = website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
    }
  } else if (email && typeof email === "string" && email.includes("@")) {
    const parts = email.split("@")[1].toLowerCase();
    if (!["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "mail.com", "proton.me", "protonmail.com"].includes(parts)) {
      domain = parts;
    }
  }

  const rawCompanyName =
    typeof companyName === "string"
      ? companyName
      : companyName && typeof companyName === "object" && "cleanName" in companyName
      ? String((companyName as { cleanName?: unknown }).cleanName || "")
      : "";

  const raw = rawCompanyName.trim();
  const isGeneric =
    !raw ||
    [
      "organization",
      "your team",
      "n/a",
      "na",
      "none",
      "unknown",
      "company",
      "null",
      "undefined",
      "lead",
    ].includes(raw.toLowerCase());

  let cleanName = "";
  if (!isGeneric) {
    cleanName = raw;
  } else if (domain) {
    const base = domain.split(".")[0];
    cleanName = base
      .replace(/[-_]/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } else {
    cleanName = "";
  }

  const checkText = `${cleanName} ${domain}`.toLowerCase();
  let likelyIndustry = "technology & modern services";
  if (checkText.includes("tech") || checkText.includes("soft") || checkText.includes("ai") || checkText.includes("cloud") || checkText.includes("data") || checkText.includes("dev")) {
    likelyIndustry = "Software, Technology & Cloud Services";
  } else if (checkText.includes("health") || checkText.includes("care") || checkText.includes("med") || checkText.includes("clinic") || checkText.includes("pharma")) {
    likelyIndustry = "Healthcare & Life Sciences";
  } else if (checkText.includes("mattress") || checkText.includes("furniture") || checkText.includes("bed") || checkText.includes("home")) {
    likelyIndustry = "Home Furnishings & Retail";
  } else if (checkText.includes("toy") || checkText.includes("game") || checkText.includes("kid") || checkText.includes("play")) {
    likelyIndustry = "Consumer Products & Goods";
  } else if (checkText.includes("capital") || checkText.includes("invest") || checkText.includes("fin") || checkText.includes("bank") || checkText.includes("pay")) {
    likelyIndustry = "Financial Services & Investment";
  } else if (checkText.includes("logist") || checkText.includes("freight") || checkText.includes("supply") || checkText.includes("shipping") || checkText.includes("cargo")) {
    likelyIndustry = "Logistics & Supply Chain Operations";
  } else if (checkText.includes("consult") || checkText.includes("advis") || checkText.includes("agency") || checkText.includes("studio")) {
    likelyIndustry = "Professional Consulting & Strategic Services";
  } else if (checkText.includes("retail") || checkText.includes("store") || checkText.includes("commerce") || checkText.includes("shop")) {
    likelyIndustry = "Retail & E-commerce Operations";
  }

  return { domain, cleanName, likelyIndustry };
}

function analyzeCompanyDomain(
  companyName?: string | null,
  website?: string | null,
  email?: string | null
): { domain: string; cleanName: string; likelyIndustry: string } {
  return resolveCleanCompanyName(companyName, website, email);
}

/**
 * Matches a lead's role, department, and industry with our company's verified skillsets,
 * enforcing negative exclusions and tuning communication to the lead's peer level.
 */
export function matchLeadWithCompanySkillsets(
  context: LeadResearchContext,
  matrix?: CompanyMatrix | null
): MatchedSkillsetResult {
  const roleAnalysis = analyzeJobTitle(context.jobTitle);
  const leadIndustry = (context.companyIndustry || "").toLowerCase();

  const allSkills = matrix?.coreSkillsets?.length
    ? matrix.coreSkillsets
    : [
        "Full-Stack Web Development",
        "Next.js & React",
        "Node.js & Python",
        "Cloud Infrastructure (AWS/GCP)",
        "DevOps & CI/CD Automation",
      ];

  const allServices = matrix?.serviceOfferings?.length
    ? matrix.serviceOfferings
    : [
        "Custom Software & Web App Development",
        "Cloud Architecture & Modernization",
        "Dedicated Engineering Teams",
      ];

  const rawExclusions = matrix?.outOfScopeExclusions || [];
  const exclusions = rawExclusions.map((e) => e.toLowerCase());

  // Filter out any skills or services that collide with out-of-scope exclusions
  const validSkills = allSkills.filter(
    (s) => !exclusions.some((ex) => s.toLowerCase().includes(ex) || ex.includes(s.toLowerCase()))
  );
  const validServices = allServices.filter(
    (s) => !exclusions.some((ex) => s.toLowerCase().includes(ex) || ex.includes(s.toLowerCase()))
  );

  let primaryCapability = validServices[0] || validSkills[0] || "Custom Software & Technology Solutions";
  let peerToneGuidance = "Align communication with executive ROI and delivery reliability.";

  if (roleAnalysis.department === "ENGINEERING") {
    const engServices = validServices.filter((s) =>
      /(?:software|cloud|devops|api|engineering|architecture|app|backend)/i.test(s)
    );
    const engSkills = validSkills.filter((s) =>
      /(?:cloud|devops|aws|api|backend|full-stack|react|node|python|kubernetes|microservices|docker)/i.test(s)
    );

    if (engServices.length > 0) {
      primaryCapability = engServices[0];
    } else if (engSkills.length > 0) {
      primaryCapability = `${engSkills.slice(0, 2).join(" & ")} Engineering`;
    }

    peerToneGuidance =
      "Peer engineering level: speak in terms of architecture, deployment pipelines, latency, and code maintainability.";
  } else if (roleAnalysis.department === "SALES" || roleAnalysis.department === "MARKETING") {
    const bizServices = validServices.filter((s) =>
      /(?:crm|sales|conversion|automation|analytics|pipeline|operations|growth)/i.test(s)
    );
    if (bizServices.length > 0) {
      primaryCapability = bizServices[0];
    }
    peerToneGuidance =
      "Commercial peer level: focus on pipeline velocity, lead conversion efficiency, and automated workflows.";
  } else if (roleAnalysis.seniority === "C-LEVEL" || roleAnalysis.seniority === "FOUNDER") {
    primaryCapability = validServices[0] || matrix?.elevatorPitch?.slice(0, 60) || "Strategic Technical Partner";
    peerToneGuidance =
      "Executive peer level: focus on macro business ROI, capital efficiency, risk mitigation, and time-to-market.";
  }

  // Find matching case study
  let matchedCaseStudy: MatchedSkillsetResult["matchedCaseStudy"] = undefined;
  if (matrix?.caseStudies && matrix.caseStudies.length > 0) {
    const industryMatch = matrix.caseStudies.find(
      (cs) => cs.industry && leadIndustry.includes(cs.industry.toLowerCase())
    );
    const selected = industryMatch || matrix.caseStudies[0];
    if (selected) {
      matchedCaseStudy = {
        title: selected.title,
        metric: selected.metric ?? null,
        summary: selected.summary,
      };
    }
  }

  return {
    primaryCapability,
    matchedServices: validServices.slice(0, 3),
    matchedSkills: validSkills.slice(0, 5),
    matchedCaseStudy,
    peerToneGuidance,
    excludedSkillsAvoided: rawExclusions,
  };
}

/**
 * Deep Research Synthesizer: constructs the research brief from all known signals
 */
export function buildLeadResearchBrief(context: LeadResearchContext): LeadResearchBrief {
  const roleAnalysis = analyzeJobTitle(context.jobTitle);
  const companyAnalysis = analyzeCompanyDomain(context.companyName, context.website, context.email);
  const matchedSkillset = matchLeadWithCompanySkillsets(context, context.companyMatrix);

  const linkedinPresent = Boolean(context.customerLinkedin || context.companyLinkedin);
  const linkedinTarget = context.customerLinkedin || context.companyLinkedin || "";

  // 1. Persona Insights
  let personaInsights = "";
  if (roleAnalysis.seniority === "FOUNDER" || roleAnalysis.seniority === "C-LEVEL") {
    personaInsights = `Executive Decision Maker (${context.jobTitle || "Executive"}). Highly focused on high-level growth, revenue predictability, and minimizing operational overhead for ${companyAnalysis.cleanName}.`;
  } else if (roleAnalysis.seniority === "VP" || roleAnalysis.seniority === "DIRECTOR") {
    personaInsights = `Department Leader (${context.jobTitle || "Director"}). Driving team performance, evaluating scalable tooling, and accountable for quarterly execution targets.`;
  } else {
    personaInsights = `Core Practitioner / Key Stakeholder (${context.jobTitle || "Specialist"}). Manages day-to-day operations and directly feels workflow friction or bottlenecks.`;
  }

  if (linkedinPresent) {
    personaInsights += ` LinkedIn footprint (${linkedinTarget}) indicates active presence in the ${companyAnalysis.likelyIndustry} sector.`;
  }

  // 2. Company Focus
  const companyFocus = `${companyAnalysis.cleanName} operates in ${context.companyIndustry || companyAnalysis.likelyIndustry}. ${
    context.companyDescription
      ? context.companyDescription
      : `Scaling their client relationships and commercial pipeline in competitive market conditions.`
  }`;

  // 3. Personalized Hook
  let personalizedHook = "";
  if (context.customerLinkedin) {
    personalizedHook = `Noticed your profile on LinkedIn and your focus on driving growth at ${companyAnalysis.cleanName}.`;
  } else if (roleAnalysis.seniority === "FOUNDER") {
    personalizedHook = `Given your role spearheading ${companyAnalysis.cleanName}, wanted to connect directly regarding how peers in ${companyAnalysis.likelyIndustry} are scaling their outreach.`;
  } else if (context.jobTitle) {
    personalizedHook = `Reaching out as you oversee ${roleAnalysis.department.toLowerCase()} strategy at ${companyAnalysis.cleanName}.`;
  } else {
    personalizedHook = `Came across ${companyAnalysis.cleanName}'s work and wanted to share a relevant perspective on your customer operations.`;
  }

  // 4. Detected Pain Points
  const detectedPainPoints = [
    ...roleAnalysis.priorityCues,
    `Preventing high-intent leads from dropping through the cracks`,
    `Ensuring outbound sales correspondence reaches the Primary Inbox directly`,
  ];

  // 5. Recommended Angle
  let recommendedAngle = "";
  if (roleAnalysis.seniority === "FOUNDER" || roleAnalysis.seniority === "C-LEVEL") {
    recommendedAngle = "Focus on macro business impact, direct ROI, and hands-off visibility into deal pipelines.";
  } else if (roleAnalysis.department === "SALES") {
    recommendedAngle = "Focus on closing velocity, reducing repetitive manual admin tasks, and intelligent client touchpoint tracking.";
  } else {
    recommendedAngle = "Focus on ease of adoption, immediate productivity gains, and reliable customer communications.";
  }

  return {
    seniorityLevel: roleAnalysis.seniorityLabel,
    department: roleAnalysis.departmentLabel,
    personaInsights,
    companyFocus,
    personalizedHook,
    recommendedAngle,
    detectedPainPoints,
    linkedinPresence:
      context.customerLinkedin || context.companyLinkedin || context.linkedinUrl
        ? "Active LinkedIn Profile detected"
        : undefined,
    matchedSkillset,
  };
}

/**
 * Generates an authentic, distinct, human-sounding subject line tailored specifically per lead
 */
function generateBespokeSubjectLine(params: {
  firstName: string;
  cleanCompany: string;
  department: string;
  departmentLabel: string;
  seniority: string;
  repOrg: string;
  matchedCapability: string;
  objective: AiEmailObjective;
  tone: AiEmailTone;
  seed: number;
}): string {
  const {
    firstName,
    cleanCompany,
    department,
    departmentLabel,
    seniority,
    repOrg,
    matchedCapability,
    objective,
    seed,
  } = params;

  const hasCompany = Boolean(cleanCompany && cleanCompany.toLowerCase() !== "your team");
  const cap = matchedCapability || "technical solutions";
  const dep = department.toLowerCase();

  if (objective === "MEETING_INVITE") {
    const inviteStyles = hasCompany
      ? [
          `Brief 10-minute sync for ${cleanCompany}?`,
          `Walkthrough invitation for ${firstName} & ${cleanCompany}`,
          `${firstName} & ${repOrg} — quick screenshare?`,
          `Quick conversation regarding ${cleanCompany}'s ${dep} roadmap`,
          `Idea for ${cleanCompany} // 10m sync?`,
        ]
      : [
          `Quick 10-minute discussion, ${firstName}?`,
          `${firstName} & ${repOrg} — introductory sync?`,
          `Brief walkthrough on ${cap}`,
          `10 minutes this week, ${firstName}?`,
          `Connecting with ${firstName} (${repOrg})`,
        ];
    return inviteStyles[seed % inviteStyles.length];
  }

  if (objective === "FOLLOW_UP") {
    const followUpStyles = hasCompany
      ? [
          `Following up on our discussion — ${cleanCompany}`,
          `Quick follow-up for ${firstName} at ${cleanCompany}`,
          `Circling back regarding ${cleanCompany}'s ${dep} initiatives`,
          `Re: thoughts on ${cleanCompany}'s ${cap}`,
          `Touching base, ${firstName} (${cleanCompany})`,
        ]
      : [
          `Quick follow-up for you, ${firstName}`,
          `Circling back following our earlier note`,
          `Touching base regarding ${cap}, ${firstName}`,
          `Quick check-in, ${firstName}`,
          `Re: introductory sync with ${firstName}`,
        ];
    return followUpStyles[seed % followUpStyles.length];
  }

  if (objective === "VALUE_CASE_STUDY") {
    const caseStyles = hasCompany
      ? [
          `How peer organizations in your space scale ${cap}`,
          `Relevant benchmarks for ${cleanCompany}'s ${dep} team`,
          `Quick performance case study for ${cleanCompany}`,
          `How peer teams approach ${cap} without overhead`,
          `Growth metric for ${cleanCompany}`,
        ]
      : [
          `Relevant benchmarks on ${cap} for ${firstName}`,
          `How peer teams in your space approached ${cap}`,
          `Quick performance data point for ${firstName}`,
          `Case study on scaling ${cap}`,
          `Benchmarks for ${firstName}'s team`,
        ];
    return caseStyles[seed % caseStyles.length];
  }

  if (objective === "RE_ENGAGEMENT") {
    const reEngageStyles = hasCompany
      ? [
          `Checking in regarding ${cleanCompany}'s quarterly priorities`,
          `Revisiting ${cleanCompany}'s ${dep} roadmap`,
          `${firstName} — touching base on ${cleanCompany}'s timeline`,
          `Still on radar for ${cleanCompany}?`,
          `Quick pulse check for ${cleanCompany}`,
        ]
      : [
          `Checking in regarding your timeline, ${firstName}`,
          `Revisiting your ${dep} priorities, ${firstName}`,
          `${firstName} — touching base on quarterly goals`,
          `Still on your radar, ${firstName}?`,
          `Quick check-in for ${firstName}`,
        ];
    return reEngageStyles[seed % reEngageStyles.length];
  }

  // Default: INITIAL_OUTREACH
  if (seniority === "FOUNDER" || seniority === "C-LEVEL") {
    const executiveStyles = hasCompany
      ? [
          `Quick question regarding ${cleanCompany}`,
          `Idea for ${cleanCompany}'s ${cap}`,
          `${cleanCompany} + ${repOrg} // ${cap}`,
          `${firstName} — perspective on ${cleanCompany}'s growth`,
          `Question on ${cleanCompany}'s tech roadmap`,
          `Intro: ${firstName} & ${repOrg}`,
          `${cleanCompany}'s ${dep} strategy: quick note`,
        ]
      : [
          `Quick question for you, ${firstName}`,
          `Idea regarding ${cap} for your team, ${firstName}`,
          `Intro: ${firstName} & ${repOrg}`,
          `${firstName} — perspective on scaling ${cap}`,
          `Quick thought for ${firstName}`,
          `Question on your team's tech roadmap`,
        ];
    return executiveStyles[seed % executiveStyles.length];
  }

  // Department leaders & practitioners
  const standardStyles = hasCompany
    ? [
        `Idea for ${cleanCompany}'s ${dep} workflow`,
        `Connecting regarding ${cleanCompany}'s ${dep} operations`,
        `${cleanCompany} & ${repOrg}: ${cap}`,
        `${firstName} — quick question regarding ${cleanCompany}`,
        `Question about ${cleanCompany}'s ${dep} initiatives`,
        `Resource for ${cleanCompany}'s ${dep} team`,
        `${cleanCompany}'s ${dep} roadmap: quick perspective`,
      ]
    : [
        `Idea for your ${dep} workflow, ${firstName}`,
        `Connecting regarding your ${dep} operations, ${firstName}`,
        `Quick question for you, ${firstName}`,
        `${firstName} — thought on your team's ${cap}`,
        `Question about your ${dep} initiatives, ${firstName}`,
        `Quick note on ${cap}`,
        `Connecting with ${firstName} (${departmentLabel})`,
      ];

  return standardStyles[seed % standardStyles.length];
}

/**
 * Intelligent Contextual Generation Engine
 *
 * Employs heuristic prompt engineering & deep context injection to craft
 * an authentic, non-generic, high-deliverability email tailored specifically
 * to the lead's LinkedIn, company domain, role, and past timeline notes.
 */
export async function generatePersonalizedLeadEmail(
  context: LeadResearchContext,
  options: AiResearchOptions = {}
): Promise<AiEmailSuggestion> {
  const objective = options.objective || "INITIAL_OUTREACH";
  const tone = options.tone || "PROFESSIONAL";
  const researchBrief = buildLeadResearchBrief(context);

  const companyAnalysis = resolveCleanCompanyName(context.companyName, context.website, context.email);
  const firstName = (context.firstName || "there").trim();
  const cleanCompany = companyAnalysis.cleanName || (context.companyName && context.companyName.toLowerCase() !== "organization" ? context.companyName.trim() : "");
  const repName = (context.repName || "Account Representative").trim();
  const repOrg = (context.organizationName || "Roxx CRM").trim();
  const roleAnalysis = analyzeJobTitle(context.jobTitle);

  // Compute a deterministic seed per lead to guarantee distinct, varied subject lines
  const seed = Math.abs(
    (options.leadIndex ?? 0) * 31 +
    (context.leadId ? context.leadId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) : 0) +
    (firstName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0))
  );

  // If an external LLM key is configured (OpenAI or Gemini), we call the remote endpoint.
  if (options.apiKey && options.aiProvider && options.aiProvider !== "builtin") {
    try {
      const remoteResult = await callExternalLlm(context, researchBrief, options);
      if (remoteResult) {
        return remoteResult;
      }
    } catch (err) {
      console.warn("External LLM call failed, smoothly utilizing built-in intelligence engine:", err);
    }
  }

  // Built-in Advanced Synthesis Engine
  const matched = researchBrief.matchedSkillset;
  const caseStudyWin = matched?.matchedCaseStudy
    ? ` (recently helped a team in your sector achieve ${matched.matchedCaseStudy.metric ? `${matched.matchedCaseStudy.metric}` : "major efficiency"})`
    : "";

  const customPitch = options.valueProposition?.trim() ||
    (matched
      ? `${matched.primaryCapability.toLowerCase()}${caseStudyWin}`
      : `helping modern teams streamline their pipeline management and automate high-touch lead follow-ups without landing in spam`);

  const companyRef = cleanCompany ? cleanCompany : "your team";
  const leadRoleText = context.jobTitle ? `as ${context.jobTitle}` : "overseeing operations";

  const subject = generateBespokeSubjectLine({
    firstName,
    cleanCompany,
    department: roleAnalysis.department,
    departmentLabel: roleAnalysis.departmentLabel,
    seniority: roleAnalysis.seniority,
    repOrg,
    matchedCapability: matched?.primaryCapability || "custom solutions",
    objective,
    tone,
    seed,
  });

  let bodyParagraphs: string[] = [];

  // Construct Subject & Body according to Objective & Tone
  switch (objective) {
    case "INITIAL_OUTREACH": {
      const bodyStyleVariant = seed % 3;

      if (bodyStyleVariant === 0) {
        bodyParagraphs = [
          `Hi ${firstName},`,
          `I came across ${companyRef} and wanted to reach out directly regarding how you're approaching ${roleAnalysis.department.toLowerCase()} operations.`,
          `At ${repOrg}, we specialize in ${customPitch}. We partner with leaders in your space to eliminate execution bottlenecks and scale results without operational bloat.`,
          `Would you be open to a brief 10-minute introductory conversation this Thursday or Friday to explore if there might be a mutual fit?`,
          `Best regards,\n${repName}\n${repOrg}`,
        ];
      } else if (bodyStyleVariant === 1) {
        bodyParagraphs = [
          `Hi ${firstName},`,
          `${researchBrief.personalizedHook}`,
          `Teams in ${companyAnalysis.likelyIndustry} frequently run into friction with ${researchBrief.detectedPainPoints[0]?.toLowerCase() || "pipeline momentum"}. We help teams solve this by ${customPitch}.`,
          `Curious if this is currently a priority for ${companyRef}. Do you have a few minutes for a quick chat later this week?`,
          `Warm regards,\n${repName}\n${repOrg}`,
        ];
      } else {
        bodyParagraphs = [
          `Hi ${firstName},`,
          `Noticed your role ${leadRoleText} at ${companyRef} and wanted to share a quick perspective.`,
          `At ${repOrg}, we focus on ${customPitch}. Given your focus on team delivery and conversion, I wanted to see if our approach aligns with what you're building.`,
          `Happy to send over a concise 2-minute overview or jump on a brief call if you are open to comparing notes.`,
          `Best,\n${repName}\n${repOrg}`,
        ];
      }
      break;
    }

    case "MEETING_INVITE": {
      bodyParagraphs = [
        `Hi ${firstName},`,
        `Hope your week is off to a productive start.`,
        `Following up on our focus on ${companyRef}, I have put together a concise 15-minute walkthrough demonstrating how ${repOrg} can address ${researchBrief.detectedPainPoints[0]?.toLowerCase() || "your core challenges"} around ${customPitch}.`,
        `Would 2:00 PM this Wednesday or Thursday work for a quick screenshare? If not, feel free to suggest a time that suits your calendar.`,
        `Looking forward to connecting,\n${repName}\n${repOrg}`,
      ];
      break;
    }

    case "FOLLOW_UP": {
      const noteRef = context.pastActivitiesSummary
        ? `Reflecting on our earlier notes regarding ${context.pastActivitiesSummary.slice(0, 80)}...`
        : `Wanted to quickly circle back following our earlier touchpoint with ${companyRef}.`;

      bodyParagraphs = [
        `Hi ${firstName},`,
        `${noteRef}`,
        `I wanted to check in and see if you have had a moment to review the points we touched on, particularly around ${customPitch}.`,
        `Happy to answer any questions or share a tailored implementation timeline whenever convenient.`,
        `Best regards,\n${repName}`,
      ];
      break;
    }

    case "VALUE_CASE_STUDY": {
      bodyParagraphs = [
        `Hi ${firstName},`,
        `I have been following ${companyRef}'s recent initiatives and noticed your strategic position in the market.`,
        `Recently, we worked with a similar team in your sector to solve ${researchBrief.detectedPainPoints[0]?.toLowerCase() || "lead follow-up drop-offs"}, resulting in a 34% increase in qualified meeting bookings within the first 60 days.`,
        `I would be happy to send over the 2-page case breakdown or hop on a brief call if you are curious to see how the numbers apply to ${companyRef}.`,
        `Best,\n${repName}\n${repOrg}`,
      ];
      break;
    }

    case "RE_ENGAGEMENT": {
      bodyParagraphs = [
        `Hi ${firstName},`,
        `I know priorities shift quickly, so I wanted to touch base to see if optimizing your ${roleAnalysis.department.toLowerCase()} pipeline is still on ${companyRef}'s radar for this quarter.`,
        `If the timing isn't right, no problem at all. If you'd like to revisit our notes or explore updated capabilities, just let me know.`,
        `Best regards,\n${repName}`,
      ];
      break;
    }
  }

  // Adjust tone nuances
  if (tone === "EXECUTIVE") {
    // Keep very tight, eliminate fluff
    bodyParagraphs = bodyParagraphs.map((p) => p.replace(/Hope your week is off to a productive start\.\s*/i, ""));
  }

  if (options.customInstruction?.trim()) {
    // Insert user custom guidance gracefully before CTA
    const customPromptText = options.customInstruction.trim();
    bodyParagraphs.splice(bodyParagraphs.length - 2, 0, `As a quick note: ${customPromptText}`);
  }

  const body = bodyParagraphs.join("\n\n");

  return {
    subject,
    body,
    researchBrief,
    objective,
    tone,
  };
}

/**
 * Optional external LLM adapter (OpenAI / Gemini)
 */
async function callExternalLlm(
  context: LeadResearchContext,
  brief: LeadResearchBrief,
  options: AiResearchOptions
): Promise<AiEmailSuggestion | null> {
  if (!options.apiKey) return null;

  const matrix = context.companyMatrix;
  const matched = brief.matchedSkillset;
  const companyAnalysis = resolveCleanCompanyName(context.companyName, context.website, context.email);
  const cleanCompany = companyAnalysis.cleanName || (context.companyName && context.companyName.toLowerCase() !== "organization" ? context.companyName.trim() : "their team");

  const prompt = `You are an elite B2B sales development strategist for ${context.organizationName || "Roxx CRM"}.
Draft a highly personalized, authentic 1-on-1 human email to this lead.

CRITICAL HUMAN OUTREACH INSTRUCTIONS:
1. BESPOKE SUBJECT LINE: You MUST create a 100% bespoke, natural, human subject line tailored specifically for this lead (${context.firstName} at ${cleanCompany}). NEVER use formulaic patterns like "your team <> Company: streamlining client engagement". Use varied human subject styles like "Quick question, ${context.firstName}", "Idea for ${cleanCompany}'s ${brief.department.toLowerCase()} operations", or "${context.firstName} — perspective on ${matched?.primaryCapability || "growth"}".
2. NATURAL HUMAN VOICE: Write in an authentic, respectful 1-on-1 human voice from one professional to another. Avoid marketing buzzwords, cheesy hype, or automated boilerplate.
3. CONTEXTUAL RELEVANCE: Speak directly to their specific role (${context.jobTitle || "Executive"}) and organization (${cleanCompany}). Connect it naturally to our verified capability (${matched?.primaryCapability || "Custom Solutions"}).
4. VERIFIED CAPABILITIES ONLY: ONLY pitch our verified capabilities listed below. Strictly NEVER mention anything in the Out-of-Scope Exclusions list.
5. CONCISE: Keep between 45 and 110 words across 3-4 natural paragraphs.
6. OUTPUT FORMAT: Output strict JSON only: {"subject": "...", "body": "..."}

Our Company Verified Capabilities & Skillsets:
- Service Offerings: ${matrix?.serviceOfferings?.join(", ") || matched?.matchedServices?.join(", ") || "Custom Software & Technology Solutions"}
- Core Skillsets: ${matrix?.coreSkillsets?.join(", ") || matched?.matchedSkills?.join(", ") || "Full-Stack Development, Cloud Infrastructure"}
- Out-of-Scope (STRICT EXCLUSIONS - NEVER PITCH THESE): ${matrix?.outOfScopeExclusions?.join(", ") || "None"}
- Matched Offering for this Lead: ${matched?.primaryCapability || "Custom Software Solutions"}
- Matched Proof Point / Metric: ${matched?.matchedCaseStudy?.metric || ""} ${matched?.matchedCaseStudy?.summary || ""}
- Peer Level Tone Guidance: ${matched?.peerToneGuidance || "Peer level"}

Lead Context:
- Name: ${context.firstName} ${context.lastName || ""}
- Organization / Company: ${cleanCompany}
- Role / Title: ${context.jobTitle || "Stakeholder"}
- Domain / Website: ${companyAnalysis.domain || context.website || "N/A"}
- LinkedIn: ${context.customerLinkedin || context.companyLinkedin || "N/A"}
- Sector: ${companyAnalysis.likelyIndustry}
- Persona Insights: ${brief.personaInsights}
- Objective: ${options.objective || "INITIAL_OUTREACH"}
- Tone: ${options.tone || "PROFESSIONAL"}
- Rep Name: ${context.repName || "Account Rep"}
- Custom Instructions: ${options.customInstruction || "None"}`;

  if (options.aiProvider === "openai") {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = JSON.parse(data.choices?.[0]?.message?.content || "{}");
        if (content.subject && content.body) {
          return {
            subject: content.subject,
            body: content.body,
            researchBrief: brief,
            objective: options.objective || "INITIAL_OUTREACH",
            tone: options.tone || "PROFESSIONAL",
          };
        }
      } else {
        const errText = await res.text().catch(() => "");
        console.warn(`[OpenAI Error ${res.status}] Failed to generate email:`, errText);
      }
    } catch (fetchErr) {
      console.warn("[OpenAI Fetch Exception]:", fetchErr);
    }
  }

  if (options.aiProvider === "gemini") {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${options.apiKey.trim()}`;
      const res = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${prompt}\nOutput strict JSON only with format: {"subject": "...", "body": "..."}` }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const content = JSON.parse(rawContent);
        if (content.subject && content.body) {
          return {
            subject: content.subject,
            body: content.body,
            researchBrief: brief,
            objective: options.objective || "INITIAL_OUTREACH",
            tone: options.tone || "PROFESSIONAL",
          };
        }
      } else {
        const errText = await res.text().catch(() => "");
        console.warn(`[Gemini Error ${res.status}]:`, errText);
      }
    } catch (gErr) {
      console.warn("[Gemini Fetch Exception]:", gErr);
    }
  }

  return null;
}

/**
 * High-level helper combining research synthesis, email generation, and deliverability audit
 */
export async function researchLeadAndDraftEmail(
  context: LeadResearchContext,
  options: AiResearchOptions = {}
): Promise<{
  subject: string;
  body: string;
  researchBrief: LeadResearchBrief;
  deliverabilityScore: number;
  wordCount: number;
  objective: AiEmailObjective;
  tone: AiEmailTone;
}> {
  const brief = buildLeadResearchBrief(context);
  const suggestion = await generatePersonalizedLeadEmail(context, options);
  const deliverability = analyzeEmailDeliverability({
    subject: suggestion.subject,
    body: suggestion.body,
  });

  return {
    subject: suggestion.subject,
    body: suggestion.body,
    researchBrief: brief,
    deliverabilityScore: deliverability.score,
    wordCount: deliverability.wordCount,
    objective: suggestion.objective,
    tone: suggestion.tone,
  };
}
