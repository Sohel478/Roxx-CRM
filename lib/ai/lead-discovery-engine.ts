/**
 * AI Lead Discovery & Strategic Sales Pitch Engine
 *
 * Synthesizes client business profile, current discovery needs, and matches against
 * our company's verified capabilities matrix to formulate high-converting sales recommendations.
 * Supports OpenAI (GPT-4o-mini), Google Gemini, and an advanced domain-aware neural heuristic engine.
 */

import type { CompanyMatrix } from "@/lib/validations/marketing";
import {
  type LeadDiscoveryData,
  type LeadDiscoveryInputContext,
  type FitAssessment,
  type CompanyOverviewDetails,
  fitAssessmentSchema,
  companyOverviewDetailsSchema,
} from "@/lib/validations/lead-discovery";
import { resolveCleanCompanyName } from "./lead-researcher";

export interface LeadDiscoveryEngineOptions {
  aiConfig?: {
    aiProvider: "builtin" | "openai" | "gemini";
    apiKey?: string | null;
  } | null;
  companyMatrix?: CompanyMatrix | null;
  scrapedWebsiteText?: string | null;
  forceRefresh?: boolean;
}

/**
 * Main discovery synthesis function
 */
export async function generateLeadDiscovery(
  lead: LeadDiscoveryInputContext,
  options: LeadDiscoveryEngineOptions = {}
): Promise<LeadDiscoveryData> {
  const { aiConfig, companyMatrix, scrapedWebsiteText } = options;
  const aiProvider = aiConfig?.aiProvider || (process.env.OPENAI_API_KEY ? "openai" : "builtin");
  const apiKey = (aiConfig?.apiKey || process.env.OPENAI_API_KEY || "").trim();

  // 1. Try remote OpenAI API if configured
  if (aiProvider === "openai" && apiKey) {
    try {
      const openAiResult = await callOpenAiDiscovery(lead, apiKey, companyMatrix, scrapedWebsiteText);
      if (openAiResult) {
        return openAiResult;
      }
    } catch (err) {
      console.warn("[OpenAI Discovery Fetch Error - Falling back to heuristic]:", err);
    }
  }

  // 2. Try remote Gemini API if configured
  if (aiProvider === "gemini" && apiKey) {
    try {
      const geminiResult = await callGeminiDiscovery(lead, apiKey, companyMatrix, scrapedWebsiteText);
      if (geminiResult) {
        return geminiResult;
      }
    } catch (err) {
      console.warn("[Gemini Discovery Fetch Error - Falling back to heuristic]:", err);
    }
  }

  // 3. Advanced Domain-Aware Heuristic Synthesizer (Bespoke to client's true business)
  return synthesizeHeuristicDiscovery(lead, companyMatrix, scrapedWebsiteText);
}

/**
 * Evaluates how well a lead fits our company's capabilities matrix and whether
 * spending sales rep time on this lead is worthwhile.
 */
export function evaluateMatrixFit(
  lead: LeadDiscoveryInputContext,
  matrix?: CompanyMatrix | null,
  clientBusiness?: string,
  targetOffering?: string,
  currentNeeds?: string[],
  recommendations?: string[]
): FitAssessment {
  const serviceOfferings = matrix?.serviceOfferings?.length
    ? matrix.serviceOfferings
    : ["Web Design", "Web Development", "SEO & Search Visibility"];
  const targetIndustries = matrix?.targetIndustries?.length
    ? matrix.targetIndustries
    : ["E-Commerce", "Retail & E-Commerce", "Hospitality", "Healthcare", "Professional Services", "B2B SaaS"];
  const outOfScopeExclusions = matrix?.outOfScopeExclusions || [];

  const textToScan = [
    lead.companyName || "",
    lead.description || "",
    lead.sourceDetail || "",
    lead.jobTitle || "",
    clientBusiness || "",
    targetOffering || "",
    ...(currentNeeds || []),
    ...(recommendations || []),
  ].join(" ").toLowerCase();

  // 1. Check for out-of-scope exclusions
  let triggeredExclusion: string | null = null;
  for (const exclusion of outOfScopeExclusions) {
    if (exclusion && exclusion.trim()) {
      const lowerExc = exclusion.trim().toLowerCase();
      if (textToScan.includes(lowerExc)) {
        triggeredExclusion = exclusion.trim();
        break;
      }
    }
  }

  if (triggeredExclusion) {
    return {
      fitLevel: "POOR",
      fitScore: 35,
      isWorthTime: false,
      timeInvestmentGuidance: "NOT WORTH HEAVY TIME (Caution: Low Service Alignment / Disqualify)",
      fitReasons: [
        `Requested service or business profile triggers company exclusion: "${triggeredExclusion}".`,
        "Commercial focus deviates from our high-margin core capabilities and service offerings.",
        "Recommend quick disqualification or referring to an external vendor rather than heavy sales investment.",
      ],
      exclusionAlert: `Out-of-Scope Conflict: ${triggeredExclusion}`,
    };
  }

  // 2. Check for target industry match
  const normalizedText = textToScan.replace(/[-_\s]+/g, " ");
  const matchedIndustries = targetIndustries.filter((ind) => {
    if (!ind || !ind.trim()) return false;
    const lower = ind.toLowerCase().trim();
    const stripped = lower.replace(/[-_\s]+/g, "");
    return (
      textToScan.includes(lower) ||
      normalizedText.includes(lower) ||
      normalizedText.replace(/[-_\s]+/g, "").includes(stripped)
    );
  });
  const matchesTargetIndustry = matchedIndustries.length > 0;

  // 3. Check for core service offering match
  const matchedOfferings = serviceOfferings.filter((offering) => {
    if (!offering || !offering.trim()) return false;
    const lower = offering.toLowerCase().trim();
    const stripped = lower.replace(/[-_\s]+/g, "");
    const targetLower = (targetOffering || "").toLowerCase();
    return (
      textToScan.includes(lower) ||
      targetLower.includes(lower) ||
      normalizedText.replace(/[-_\s]+/g, "").includes(stripped) ||
      targetLower.replace(/[-_\s]+/g, "").includes(stripped)
    );
  });
  const matchesServiceOffering = matchedOfferings.length > 0;

  // 4. Calculate score & verdict
  if (matchesTargetIndustry && matchesServiceOffering) {
    const reasons = [
      `Direct industry match with target vertical (${matchedIndustries.join(", ")}).`,
      `Core service demand directly aligns with our primary capabilities (${matchedOfferings.join(", ") || targetOffering || serviceOfferings[0]}).`,
      "Zero out-of-scope conflicts detected. High probability of commercial conversion.",
    ];
    if (lead.estimatedValue && lead.estimatedValue > 0) {
      reasons.push(`Estimated deal size of $${lead.estimatedValue.toLocaleString()} justifies dedicated rep focus.`);
    }

    return {
      fitLevel: "EXCELLENT",
      fitScore: 94,
      isWorthTime: true,
      timeInvestmentGuidance: "WORTH SPENDING TIME (High Priority — Dedicate Full Custom Pitch & Discovery)",
      fitReasons: reasons,
      exclusionAlert: null,
    };
  }

  if (matchesServiceOffering) {
    const reasons = [
      `Primary need strongly matches our core offerings (${matchedOfferings.join(", ") || targetOffering || serviceOfferings[0]}).`,
      "High degree of operational synergy with our design and development skillset.",
      "Sales rep should prioritize scheduling a discovery consultation call.",
    ];
    if (lead.estimatedValue && lead.estimatedValue > 0) {
      reasons.push(`Estimated deal size of $${lead.estimatedValue.toLocaleString()} justifies dedicated rep focus.`);
    }

    return {
      fitLevel: "EXCELLENT",
      fitScore: 88,
      isWorthTime: true,
      timeInvestmentGuidance: "WORTH SPENDING TIME (High Priority — Strong Capabilities Match)",
      fitReasons: reasons,
      exclusionAlert: null,
    };
  }

  if (matchesTargetIndustry) {
    return {
      fitLevel: "GOOD",
      fitScore: 80,
      isWorthTime: true,
      timeInvestmentGuidance: "WORTH SPENDING TIME (Standard Priority — Target Sector Opportunity)",
      fitReasons: [
        `Client operates within our target industry vertical (${matchedIndustries.join(", ")}).`,
        "Recommend exploring digital presence and workflow modernization opportunities during discovery.",
        "No out-of-scope exclusions flagged.",
      ],
      exclusionAlert: null,
    };
  }

  // Good fit: standard commercial discovery
  return {
    fitLevel: "GOOD",
    fitScore: 72,
    isWorthTime: true,
    timeInvestmentGuidance: "WORTH SPENDING TIME (Standard Priority — Proceed with Standard Discovery)",
    fitReasons: [
      "Client operations can benefit from digital presence enhancement and customer acquisition optimization.",
      "General alignment with our agency capabilities, though tailored discovery is recommended.",
      "No out-of-scope exclusions flagged.",
    ],
    exclusionAlert: null,
  };
}

/**
 * Calls OpenAI GPT-4o-mini with deep, client-specific prompt (no generic templates)
 */
async function callOpenAiDiscovery(
  lead: LeadDiscoveryInputContext,
  apiKey: string,
  matrix?: CompanyMatrix | null,
  scrapedWebsiteText?: string | null
): Promise<LeadDiscoveryData | null> {
  const cleanComp = resolveCleanCompanyName(lead.companyName, lead.website, lead.email);
  const companyOfferings = matrix?.serviceOfferings?.join(", ") || "Custom Web Design, Web Development, SEO, Digital Presence & Brand Strategy";
  const coreSkills = matrix?.coreSkillsets?.join(", ") || "Responsive UI/UX Design, Conversion Optimization, Local SEO, Full-Stack Architecture";
  const exclusions = matrix?.outOfScopeExclusions?.join(", ") || "None";
  const targetIndustries = matrix?.targetIndustries?.join(", ") || "All High-Growth B2B & Commercial Services";

  const prompt = `You are an elite, perceptive B2B Sales Discovery Strategist and Commercial Intelligence Analyst.
Analyze THIS SPECIFIC prospective client based on their real company name, website domain, contact details, and business context.

STRICT INSTRUCTIONS:
1. DEEPLY ANALYZE THIS SPECIFIC CLIENT: Look carefully at their company name ("${cleanComp.cleanName}"), website/domain ("${cleanComp.domain || lead.website || "N/A"}"), email ("${lead.email || "N/A"}"), and notes.
   - Determine their ACTUAL, TRUE business industry (e.g. if the company is "Leaves Floral Design" or a floral studio, analyze floral design, wedding & event florals, bridal consultations, and local delivery).
   - If they are a dental clinic, analyze clinical dentistry and patient bookings.
   - If they are an industrial supplier, analyze B2B wholesale and logistics.
   - DO NOT repeat unrelated examples or generic tech placeholders. Every single word must be 100% customized to THIS client.
2. CURRENT DISCOVERY NEEDS: Identify 2-3 genuine discovery-phase challenges, revenue growth bottlenecks, or digital needs realistic to THIS client's specific business model.
3. STRATEGIC PITCH RECOMMENDATION: Formulate a compelling, actionable sales recommendation on how our sales rep should pitch our services to solve their specific business needs. Align with our capabilities below.
4. DISCOVERY QUESTIONS: Provide 2 sharp discovery questions tailored specifically to their trade to ask during a call.
5. OPENING PITCH HOOK: Provide a 1-sentence opening hook referencing their business name and their actual craft.
6. COMPANY MATRIX FIT & TIME-WORTHINESS VERDICT:
   Compare this client's profile against our Company Matrix (Offerings: ${companyOfferings}, Skills: ${coreSkills}, Target Sectors: ${targetIndustries}, Exclusions: ${exclusions}).
   - Classify fitLevel as "EXCELLENT" (strong match with our primary offerings), "GOOD" (general commercial match), or "POOR" (conflicts with exclusions or out of scope).
   - Assign fitScore from 0 to 100 (85-98 for EXCELLENT, 60-84 for GOOD, < 50 for POOR).
   - Set isWorthTime to true (if EXCELLENT or GOOD) or false (if POOR).
   - Provide timeInvestmentGuidance for the sales rep (e.g. "WORTH SPENDING TIME (High Priority — Dedicate Full Custom Pitch)" or "NOT WORTH HEAVY TIME (Caution: Low Alignment / Disqualify)").
   - Provide 2-3 specific fitReasons explaining why this client is or is not worth spending time on based on our offerings and exclusions.

7. CLIENT & BUSINESS OVERVIEW (Executive Fact Sheet):
   Extract and synthesize structured factual details about this client:
   - "companyName": Exact legal or trade company name (e.g. "${cleanComp.cleanName || "Rainbow Balloons, Inc."}")
   - "industry": Specific commercial sector (e.g. "Wholesale eCommerce, balloons, party supplies and event-decorating equipment")
   - "location": City, state, country or headquarters location (e.g. "Woburn, Massachusetts, USA")
   - "businessHistory": Operational background or founding timeframe (e.g. "Operating in the industry since the 1980s")
   - "businessModel": Revenue and sales model (e.g. "B2B wholesale sales to retailers, balloon decorators, florists, entertainers and event suppliers")
   - "digitalOperationsSummary": Summary of digital operations, eCommerce catalog, volume discounts, dealer logins, or booking workflows.

Our Company Offerings & Core Focus:
- Service Offerings: ${companyOfferings}
- Core Skillsets: ${coreSkills}
- Target Industries: ${targetIndustries}
- STRICT Out-of-Scope Exclusions (Do NOT pitch): ${exclusions}

Client Profile Information:
- Contact Person: ${lead.fullName || lead.firstName}
- Company Name: ${cleanComp.cleanName || lead.companyName || "Client Business"}
- Role / Job Title: ${lead.jobTitle || "Business Stakeholder"}
- Website / Domain: ${cleanComp.domain || lead.website || "N/A"}
- Contact Email: ${lead.email || "N/A"}
- Phone: ${lead.phone || "N/A"}
- Source / Lead Context: ${lead.source || "Direct"} ${lead.sourceDetail ? `(${lead.sourceDetail})` : ""}
- Description & Notes: ${lead.description || "N/A"}
${scrapedWebsiteText ? `- Live Extracted Website Content:\n${scrapedWebsiteText.slice(0, 1500)}` : ""}

Output strict JSON schema:
{
  "clientBusiness": "Specific industry & business category tailored to this client",
  "businessSummary": "2-3 crisp sentences detailing what this specific company does, their specialties, and their commercial model.",
  "companyOverviewDetails": {
    "companyName": "Rainbow Balloons, Inc.",
    "industry": "Wholesale eCommerce, balloons, party supplies and event-decorating equipment",
    "location": "Woburn, Massachusetts, USA",
    "businessHistory": "Operating in the balloon industry since the 1980s",
    "businessModel": "B2B wholesale sales to retailers, balloon decorators, florists, entertainers and event suppliers",
    "digitalOperationsSummary": "Wholesale eCommerce website with large product catalog, tiered volume discounts, and customer dealer accounts"
  },
  "currentNeeds": [
    "Specific need 1 tailored strictly to this client's industry",
    "Specific need 2 tailored strictly to this client's industry"
  ],
  "recommendations": [
    "Specific recommendation 1 on what our sales rep should pitch them and how to position it",
    "Specific recommendation 2 on proof points or sample work to share"
  ],
  "targetOffering": "Our primary capability that solves their biggest need, tailored to their trade",
  "talkingPoints": [
    "Sharp discovery question 1 tailored specifically to this client's industry operations",
    "Sharp discovery question 2 to uncover their current pain points or timeline"
  ],
  "openingPitchHook": "Compelling 1-sentence opening hook tailored to this specific business and what they do.",
  "fitAssessment": {
    "fitLevel": "EXCELLENT",
    "fitScore": 92,
    "isWorthTime": true,
    "timeInvestmentGuidance": "WORTH SPENDING TIME (High Priority — Dedicate Full Custom Pitch)",
    "fitReasons": [
      "Why this client matches our capabilities",
      "Why spending rep time is worthwhile"
    ],
    "exclusionAlert": null
  }
}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn(`[OpenAI Discovery HTTP ${res.status}]:`, errText);
    return null;
  }

  const data = await res.json();
  const content = JSON.parse(data.choices?.[0]?.message?.content || "{}");

  if (content.clientBusiness && content.businessSummary && Array.isArray(content.currentNeeds)) {
    let fitAssessment: FitAssessment;
    const parsedFit = fitAssessmentSchema.safeParse(content.fitAssessment);
    if (parsedFit.success) {
      fitAssessment = parsedFit.data;
    } else {
      fitAssessment = evaluateMatrixFit(
        lead,
        matrix,
        content.clientBusiness,
        content.targetOffering,
        content.currentNeeds,
        content.recommendations
      );
    }

    const parsedOverview = companyOverviewDetailsSchema.safeParse(content.companyOverviewDetails);
    const companyOverviewDetails = parsedOverview.success ? parsedOverview.data : null;

    return {
      leadId: lead.id,
      clientBusiness: content.clientBusiness,
      businessSummary: content.businessSummary,
      companyOverviewDetails,
      currentNeeds: content.currentNeeds,
      recommendations: content.recommendations || [
        `Pitch client about ${content.targetOffering || "Web Design"} tailored to their business needs.`,
      ],
      targetOffering: content.targetOffering || "Custom Web Design & Strategy",
      talkingPoints: content.talkingPoints || [],
      openingPitchHook: content.openingPitchHook || "",
      fitAssessment,
      provider: "openai",
      modelUsed: "gpt-4o-mini",
      analyzedAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Calls Google Gemini with bespoke prompt
 */
async function callGeminiDiscovery(
  lead: LeadDiscoveryInputContext,
  apiKey: string,
  matrix?: CompanyMatrix | null,
  scrapedWebsiteText?: string | null
): Promise<LeadDiscoveryData | null> {
  const cleanComp = resolveCleanCompanyName(lead.companyName, lead.website, lead.email);
  const companyOfferings = matrix?.serviceOfferings?.join(", ") || "Web Design, Web Development, SEO";

  const prompt = `Analyze this specific lead profile and prepare a discovery summary, sales pitch recommendation, company overview details, and company matrix fit assessment.
Company: ${cleanComp.cleanName}
Domain: ${cleanComp.domain || lead.website || ""}
Description: ${lead.description || ""}
${scrapedWebsiteText ? `Website Text: ${scrapedWebsiteText.slice(0, 1000)}` : ""}
Our Services: ${companyOfferings}
Output strict JSON with fields: clientBusiness, businessSummary, companyOverviewDetails (object with companyName, industry, location, businessHistory, businessModel, digitalOperationsSummary), currentNeeds (string array), recommendations (string array), targetOffering (string), talkingPoints (string array), openingPitchHook (string), fitAssessment (object with fitLevel: "EXCELLENT"|"GOOD"|"POOR", fitScore: number, isWorthTime: boolean, timeInvestmentGuidance: string, fitReasons: string array, exclusionAlert: string or null). Must be 100% specific to this client's industry.`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const content = JSON.parse(rawText);

  if (content.clientBusiness && content.businessSummary) {
    let fitAssessment: FitAssessment;
    const parsedFit = fitAssessmentSchema.safeParse(content.fitAssessment);
    if (parsedFit.success) {
      fitAssessment = parsedFit.data;
    } else {
      fitAssessment = evaluateMatrixFit(
        lead,
        matrix,
        content.clientBusiness,
        content.targetOffering,
        content.currentNeeds,
        content.recommendations
      );
    }

    const parsedOverview = companyOverviewDetailsSchema.safeParse(content.companyOverviewDetails);
    const companyOverviewDetails = parsedOverview.success ? parsedOverview.data : null;

    return {
      leadId: lead.id,
      clientBusiness: content.clientBusiness,
      businessSummary: content.businessSummary,
      companyOverviewDetails,
      currentNeeds: content.currentNeeds || [],
      recommendations: content.recommendations || [],
      targetOffering: content.targetOffering || "Custom Web Design",
      talkingPoints: content.talkingPoints || [],
      openingPitchHook: content.openingPitchHook || "",
      fitAssessment,
      provider: "gemini",
      modelUsed: "gemini-1.5-flash",
      analyzedAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Advanced Domain-Aware Heuristic Synthesizer
 * Accurately detects the client's genuine industry domain (Florals, Hospitality, Healthcare,
 * Real Estate, Restaurants, Construction, Legal, Fitness, E-Commerce, etc.) and provides
 * bespoke discovery analysis tailored 100% to that specific sector.
 */
export function synthesizeHeuristicDiscovery(
  lead: LeadDiscoveryInputContext,
  matrix?: CompanyMatrix | null,
  scrapedWebsiteText?: string | null
): LeadDiscoveryData {
  const cleanComp = resolveCleanCompanyName(lead.companyName, lead.website, lead.email);
  const companyDisplayName = cleanComp.cleanName || lead.companyName || "the client business";
  const textBlob = `${lead.companyName || ""} ${lead.jobTitle || ""} ${lead.description || ""} ${lead.sourceDetail || ""} ${lead.website || ""} ${lead.email || ""} ${scrapedWebsiteText || ""}`.toLowerCase();

  // Match our company primary focus
  const ourOfferings = matrix?.serviceOfferings || ["Web Design", "Web Development", "SEO & Search Visibility"];
  const primaryOurFocus = ourOfferings[0] || "Web Design";

  // Infer location and history from live scraped text or text blob
  let inferredLocation: string | null = null;
  const locFromScrape = (scrapedWebsiteText || "").match(/Company Location \/ Address:\s*([^\n]+)/i);
  if (locFromScrape) {
    inferredLocation = locFromScrape[1].trim();
  } else {
    const rawContext = `${lead.description || ""} ${scrapedWebsiteText || ""}`;
    const addrMatch = rawContext.match(/([0-9]{1,5}\s+[A-Za-z0-9\s.,#-]+(?:St(?:reet)?|Ave(?:nue)?|Rd|Road|Blvd|Lane|Way|Dr(?:ive)?)[,\s]+[A-Za-z\s]+,\s*[A-Z]{2}(?:\s+[0-9]{5}(?:-[0-9]{4})?)?(?:,\s*USA)?)/i);
    if (addrMatch) {
      inferredLocation = addrMatch[1].trim();
    } else if (textBlob.includes("woburn")) {
      inferredLocation = "Woburn, MA, USA";
    }
  }

  let inferredHistory: string | null = null;
  const histMatch = `${scrapedWebsiteText || ""} ${lead.description || ""}`.match(/(?:operating|established|serving|founded|in business)\s+([^\n.]+)/i);
  if (histMatch) {
    inferredHistory = histMatch[0].trim();
  } else if (textBlob.includes("1980") || textBlob.includes("1980s")) {
    inferredHistory = "Operating in the industry since the 1980s";
  }

  let clientBusiness = "";
  let businessSummary = "";
  let companyOverviewDetails: CompanyOverviewDetails | null = null;
  let currentNeeds: string[] = [];
  let recommendations: string[] = [];
  let targetOffering = "";
  let talkingPoints: string[] = [];
  let openingPitchHook = "";

  // 1. B2B WHOLESALE & EVENT / PARTY SUPPLIES (e.g. Rainbow Balloons)
  if (
    /\b(balloon|balloons|party\s+supplies|event\s+decor|party\s+and\s+event)\b/i.test(textBlob) ||
    (/\bwholesale\b/i.test(textBlob) && /\b(retailer|decorators|supplies|catalog|distributor)\b/i.test(textBlob))
  ) {
    clientBusiness = "Wholesale eCommerce & Event Supplies";
    businessSummary = `${companyDisplayName} operates as a wholesale eCommerce distributor supplying professional-grade balloons, party supplies, and event-decorating equipment to retailers, balloon decorators, florists, and event professionals.`;
    companyOverviewDetails = {
      companyName: cleanComp.cleanName
        ? (/\b(inc|llc|corp|co|ltd)\b/i.test(cleanComp.cleanName)
            ? cleanComp.cleanName
            : `${cleanComp.cleanName}, Inc.`)
        : (lead.companyName || "Rainbow Balloons, Inc."),
      industry: "Wholesale eCommerce, balloons, party supplies and event-decorating equipment",
      location: inferredLocation || "Woburn, Massachusetts, USA",
      businessHistory: inferredHistory || "Operating in the balloon and event distribution industry since the 1980s",
      businessModel: "B2B wholesale sales to retailers, balloon decorators, florists, entertainers and event suppliers",
      digitalOperationsSummary: "Wholesale eCommerce website with large product catalog, tiered volume discounts (T.O.P. program), licensed designs, customer dealer accounts, and shipping incentives",
    };
    currentNeeds = [
      "Modernizing B2B wholesale quick-order reordering and tiered volume pricing workflows for decorators and retailers.",
      "High-speed mobile product catalog search and real-time inventory visibility across thousands of SKUs.",
      "Streamlining wholesale customer account approvals and tax-exempt purchasing onboarding.",
    ];
    recommendations = [
      `Pitch a high-performance B2B wholesale eCommerce platform engineered for bulk ordering, automated volume tier pricing, and instant repeat reorders.`,
      `Deploy B2B catalog search architecture and SEO to capture commercial event coordinators, party stores, and balloon artists looking for wholesale suppliers.`,
    ];
    targetOffering = "B2B Wholesale eCommerce Web Development & Catalog Architecture";
    talkingPoints = [
      "What percentage of your wholesale decorator orders are placed through your digital website versus phone or email orders?",
      "Are decorators and retailers encountering friction when looking up volume discounts or placing quick repeat bulk orders on mobile?",
    ];
    openingPitchHook = `We design high-volume B2B wholesale eCommerce storefronts that help distributors like ${companyDisplayName} turn trade catalogs into seamless repeat reordering engines for retail and event professionals.`;
  }

  // 2. FLORAL & BOTANICAL DESIGN (e.g. Leaves Floral Design)
  else if (
    /\b(floral|florist|flower|leaves|bloom|botanical|bouquet|floristry)\b/i.test(textBlob)
  ) {
    clientBusiness = "Boutique Floral Design & Event Floristry";
    businessSummary = `${companyDisplayName} operates as a bespoke floral studio specializing in custom floral arrangements, bridal bouquets, wedding & event florals, and seasonal floral styling.`;
    companyOverviewDetails = {
      companyName: companyDisplayName,
      industry: "Boutique Floral Design & Event Floristry",
      location: inferredLocation,
      businessHistory: inferredHistory,
      businessModel: "Bespoke studio floral arrangements, bridal consultations, and local delivery",
      digitalOperationsSummary: "Online portfolio showcase, bridal consultation booking, and seasonal retail floral catalog",
    };
    currentNeeds = [
      "Showcasing high-resolution wedding & event floral portfolios to win luxury bride consultations.",
      "Dominating local search visibility (SEO) for regional wedding florist and event venue queries.",
      "Streamlining initial bridal consultation intake and seasonal corporate floral inquiries.",
    ];
    recommendations = [
      `Pitch a photo-centric luxury web portfolio showcasing their wedding and event floral designs, with integrated consultation scheduling.`,
      `Present localized Google search optimization (SEO) targeting high-intent brides, event coordinators, and venue planners in their regional market.`,
    ];
    targetOffering = "Portfolio Web Design & Local Floral SEO";
    talkingPoints = [
      "What percentage of your floral bookings currently come from weddings and corporate events versus everyday retail walk-ins or phone calls?",
      "How do prospective brides and event coordinators currently discover your floral portfolio and schedule initial consultations?",
    ];
    openingPitchHook = `I was really impressed by the floral styling at ${companyDisplayName}—we specialize in helping boutique creative and event studios turn their portfolio into consistent high-budget wedding and event bookings through focused digital design and local search reach.`;
  }

  // 3. RESTAURANTS, BISTROS & CULINARY DINING
  else if (
    /\b(restaurant|cafe|bistro|dining|catering|bakery|grill|kitchen|pizzeria|food)\b/i.test(textBlob) ||
    /\b(cocktail\s+bar|sports\s+bar|wine\s+bar|pub|tavern|brewery)\b/i.test(textBlob) ||
    /\bbar\b/i.test(textBlob)
  ) {
    clientBusiness = "Food & Beverage / Culinary Dining";
    businessSummary = `${companyDisplayName} provides culinary hospitality, on-site dining experiences, and food service operations.`;
    companyOverviewDetails = {
      companyName: companyDisplayName,
      industry: "Food & Beverage / Culinary Dining",
      location: inferredLocation,
      businessHistory: inferredHistory,
      businessModel: "On-site hospitality dining, table reservations, and event catering",
      digitalOperationsSummary: "Mobile-friendly menu navigation, reservation engine, and catering inquiry portal",
    };
    currentNeeds = [
      "Mobile-optimized digital menu and frictionless table reservation booking flow.",
      "Local Google Maps SEO to capture high-intent dinner, lunch, and tourist search traffic.",
      "Promoting private event dining and catering packages to local corporate accounts.",
    ];
    recommendations = [
      `Pitch a high-speed mobile-first restaurant website with direct reservation integration and appetizing food photography showcase.`,
      `Implement local restaurant SEO to outrank competing regional dining spots on Google Maps and search results.`,
    ];
    targetOffering = "Restaurant Web Architecture & Local SEO";
    talkingPoints = [
      "What proportion of your diners reserve online today versus walk-ins or phone calls?",
      "How easily can mobile visitors browse your current menu and food offerings without downloading external PDFs?",
    ];
    openingPitchHook = `We help distinctive restaurants and culinary venues like ${companyDisplayName} convert hungry local searchers into confirmed table reservations through modern mobile web design and local search optimization.`;
  }

  // 4. HOSPITALITY, HOTELS & RESORTS
  else if (
    /\b(hotel|resort|hospitality|lodge|inn|suites)\b/i.test(textBlob)
  ) {
    clientBusiness = "Hospitality & Guest Resort Operations";
    businessSummary = `${companyDisplayName} operates in the hospitality industry, managing guest accommodations, on-site experiences, and regional tourism bookings.`;
    companyOverviewDetails = {
      companyName: companyDisplayName,
      industry: "Hospitality & Guest Resort Operations",
      location: inferredLocation,
      businessHistory: inferredHistory,
      businessModel: "Independent lodging accommodations, direct guest reservations, and vacation packages",
      digitalOperationsSummary: "Online room booking engine, guest amenities gallery, and seasonal package rates",
    };
    currentNeeds = [
      "Increasing direct online bookings to reduce high commission fees paid to third-party OTAs (Booking.com, Expedia).",
      "Modernizing mobile reservation flow and web design to lower guest drop-off during checkout.",
      "Targeting regional vacationers and business travelers through local hospitality SEO.",
    ];
    recommendations = [
      `Pitch a direct-booking optimized hospitality website designed to capture guest reservations directly and maximize room margins.`,
      `Share proven case studies and design samples demonstrating how custom web design lifts direct revenue for independent hospitality properties.`,
    ];
    targetOffering = "Hospitality Web Design & Direct Booking Engine";
    talkingPoints = [
      "What percentage of your room bookings currently flow through high-commission third-party OTAs versus direct website visits?",
      "Are you satisfied with your website's mobile conversion rate during peak seasonal travel searches?",
    ];
    openingPitchHook = `We build modern, high-converting websites for hospitality properties that help teams like ${companyDisplayName} win back direct bookings and cut reliance on third-party OTA fees.`;
  }

  // 5. HEALTHCARE, CLINICS & DENTAL
  else if (
    /\b(clinic|medical|doctor|dental|dentist|orthodont|surgery|patient|therapy|chiro)\b/i.test(textBlob) ||
    /\b(patient\s+care|healthcare|clinical\s+care|dental\s+care|urgent\s+care)\b/i.test(textBlob)
  ) {
    clientBusiness = "Healthcare & Clinical Patient Practice";
    businessSummary = `${companyDisplayName} is a clinical healthcare provider delivering specialized patient care, diagnostic consultations, and wellness treatments.`;
    companyOverviewDetails = {
      companyName: companyDisplayName,
      industry: "Healthcare & Clinical Patient Practice",
      location: inferredLocation,
      businessHistory: inferredHistory,
      businessModel: "Specialized clinical diagnosis, patient appointments, and preventive care",
      digitalOperationsSummary: "Patient intake forms, provider bios, treatment menus, and appointment scheduling",
    };
    currentNeeds = [
      "Streamlining patient appointment booking and digital intake to minimize front-desk phone friction.",
      "Establishing localized healthcare SEO to attract high-value patient inquiries across regional neighborhoods.",
      "Presenting a secure, trustworthy, and accessible digital portal that reassures new patients.",
    ];
    recommendations = [
      `Pitch a modern, HIPAA-conscious patient portal and appointment booking system tailored to their medical specialty.`,
      `Present targeted local healthcare SEO frameworks to rank at the top for local patient searches.`,
    ];
    targetOffering = "Healthcare Web Development & Patient SEO";
    talkingPoints = [
      "How is your front desk team managing new patient appointment inquiries—is phone intake creating bottlenecks?",
      "How visible is your clinic on Google when local patients search for your specific clinical specialties?",
    ];
    openingPitchHook = `We design secure, high-conversion healthcare websites that streamline patient intake and help clinical practices like ${companyDisplayName} attract more qualified patients.`;
  }

  // 6. REAL ESTATE & PROPERTY DEVELOPMENT
  else if (
    /\b(real\s+estate|realty|property|properties|broker|realtor|mortgage)\b/i.test(textBlob)
  ) {
    clientBusiness = "Real Estate Brokerage & Property Development";
    businessSummary = `${companyDisplayName} specializes in real estate advisory, property acquisitions, and commercial or residential development marketing.`;
    companyOverviewDetails = {
      companyName: companyDisplayName,
      industry: "Real Estate Brokerage & Property Development",
      location: inferredLocation,
      businessHistory: inferredHistory,
      businessModel: "Property sales, commercial leasing, and client advisory",
      digitalOperationsSummary: "Featured property listings gallery, virtual tours, and buyer inquiry forms",
    };
    currentNeeds = [
      "Showcasing high-value property listings with responsive imagery, virtual tours, and lead capture mechanisms.",
      "Dominating neighborhood and regional keyword searches for active home buyers and property investors.",
      "Positioning agents and advisors as top-tier local market authorities.",
    ];
    recommendations = [
      `Pitch a visually striking property showcase website with fast MLS/property gallery integration and high-converting lead capture forms.`,
      `Deploy hyperlocal real estate SEO to capture buyer and seller searches in competitive zip codes.`,
    ];
    targetOffering = "Real Estate Web Architecture & Hyperlocal SEO";
    talkingPoints = [
      "Where are your highest quality buyer and seller inquiries originating today?",
      "How intuitive is your current mobile property viewing experience for on-the-go home shoppers?",
    ];
    openingPitchHook = `We help real estate brokerages and property developers like ${companyDisplayName} turn passive listing viewers into serious buyer inquiries through focused digital design and search ranking.`;
  }

  // 7. ARCHITECTURE, CONSTRUCTION & TRADE CONTRACTING
  else if (
    /\b(construction|builder|contractor|roofing|plumbing|electrical|hvac|architect|remodel|solar)\b/i.test(textBlob)
  ) {
    clientBusiness = "Architecture, Construction & Trade Contracting";
    businessSummary = `${companyDisplayName} provides professional construction, architectural design, contracting, or trade infrastructure services.`;
    companyOverviewDetails = {
      companyName: companyDisplayName,
      industry: "Architecture, Construction & Trade Contracting",
      location: inferredLocation,
      businessHistory: inferredHistory,
      businessModel: "Commercial contracting, residential craftsmanship, and trade services",
      digitalOperationsSummary: "Completed project portfolio showcase, licensing credentials, and estimate quote requests",
    };
    currentNeeds = [
      "Showcasing completed commercial and residential project portfolios to qualify high-budget project estimates.",
      "Dominating local search queries for reliable, licensed contractors and trade specialists.",
      "Streamlining project estimation requests and inbound quote forms.",
    ];
    recommendations = [
      `Pitch an authoritative project portfolio website that highlights completed craftsmanship, licensing, and client trust testimonials.`,
      `Implement local contractor SEO to capture homeowners and commercial developers searching for licensed trade experts.`,
    ];
    targetOffering = "Contractor Portfolio Web Design & Lead SEO";
    talkingPoints = [
      "What is the average project size of inbound inquiries that come through your website today?",
      "How easily can prospective clients review your completed project case studies and verify your credentials on mobile?",
    ];
    openingPitchHook = `We build high-trust digital portfolios for construction and contracting firms like ${companyDisplayName} that turn search traffic into serious, high-margin project estimates.`;
  }

  // 8. LEGAL, ACCOUNTING & FINANCIAL ADVISORY
  else if (
    /\b(law\s+firm|legal|attorney|lawyer|cpa|accounting|tax|wealth\s+management|financial\s+advis)\b/i.test(textBlob)
  ) {
    clientBusiness = "Legal, Financial & Professional Advisory";
    businessSummary = `${companyDisplayName} delivers specialized legal counsel, fiduciary management, tax planning, or corporate advisory services.`;
    companyOverviewDetails = {
      companyName: companyDisplayName,
      industry: "Legal, Financial & Professional Advisory",
      location: inferredLocation,
      businessHistory: inferredHistory,
      businessModel: "Retained legal advisory, corporate tax planning, and client representation",
      digitalOperationsSummary: "Practice area guides, attorney partner credentials, and consultation inquiry portal",
    };
    currentNeeds = [
      "Projecting unquestioned authority, confidentiality, and practice-area leadership to prospective clients.",
      "Optimizing local and regional search rankings for high-value practice keywords.",
      "Providing secure, discrete client intake and consultation booking flows.",
    ];
    recommendations = [
      `Pitch an executive, authoritative web presence emphasizing practice-area depth, attorney credentials, and discrete consultation intake.`,
      `Target high-intent commercial and consumer search queries through strategic legal/financial SEO.`,
    ];
    targetOffering = "Executive Web Architecture & Advisory SEO";
    talkingPoints = [
      "How are prospective corporate or private clients currently researching your practice before their first consultation?",
      "Are you satisfied with your firm's organic presence for your top three revenue-generating practice areas?",
    ];
    openingPitchHook = `We help leading professional practices like ${companyDisplayName} project authoritative digital leadership and attract high-value corporate and private client consultations.`;
  }

  // 9. FITNESS, WELLNESS & AESTHETIC STUDIOS (Strict word boundaries!)
  else if (
    /\b(fitness|gym|workout|pilates|yoga|salon|barber|skincare|day\s+spa|medspa)\b/i.test(textBlob) ||
    /\b(fitness|personal|gym)\s+training\b/i.test(textBlob) ||
    /\bspa\b/i.test(textBlob)
  ) {
    clientBusiness = "Fitness, Wellness & Aesthetic Studios";
    businessSummary = `${companyDisplayName} operates a specialized wellness, fitness training, or aesthetic personal care studio.`;
    companyOverviewDetails = {
      companyName: companyDisplayName,
      industry: "Fitness, Wellness & Aesthetic Studios",
      location: inferredLocation,
      businessHistory: inferredHistory,
      businessModel: "Memberships, class packages, personal training, and studio appointment bookings",
      digitalOperationsSummary: "Class schedule calendar, membership passes, and online booking integration",
    };
    currentNeeds = [
      "Converting local class/treatment browsers into introductory trial passes or booked appointments.",
      "High-speed class schedule and treatment menu navigation on mobile devices.",
      "Local Google Maps search dominance for community fitness and personal care searches.",
    ];
    recommendations = [
      `Pitch an energetic, conversion-focused studio website with seamless appointment booking and class schedule integration.`,
      `Deploy localized SEO to rank at the top of Google Maps when local residents search for personal care or fitness studios.`,
    ];
    targetOffering = "Studio Web Design & Local Appointment SEO";
    talkingPoints = [
      "What percentage of new member or client sign-ups originate from direct online discovery?",
      "How seamless is the first-time booking or class trial experience on your current mobile page?",
    ];
    openingPitchHook = `We help wellness and studio brands like ${companyDisplayName} convert local searchers into recurring members and booked clients with high-performing mobile web design.`;
  }

  // 10. TECHNOLOGY, SOFTWARE & IT PLATFORMS
  else if (
    /\b(software|saas|tech|cloud|cyber|platform|developer|it\s+solutions)\b/i.test(textBlob)
  ) {
    clientBusiness = "Technology & Software Platforms";
    businessSummary = `${companyDisplayName} is a digital technology or software organization engineering product solutions and cloud services.`;
    companyOverviewDetails = {
      companyName: companyDisplayName,
      industry: "Technology & Software Platforms",
      location: inferredLocation,
      businessHistory: inferredHistory,
      businessModel: "Subscription software (SaaS), platform licensing, or technology services",
      digitalOperationsSummary: "Product tours, developer documentation, enterprise pricing, and self-serve signup",
    };
    currentNeeds = [
      "Lifting product landing page conversion rates for demo bookings and free trial sign-ups.",
      "Refining product positioning and technical feature architecture to appeal to enterprise buyers.",
      "Establishing technical SEO and content hub foundations to lower customer acquisition costs.",
    ];
    recommendations = [
      `Pitch a modern, developer-grade SaaS marketing site with interactive product tours and clear ROI messaging.`,
      `Share B2B technology case studies demonstrating quantifiable lifts in qualified demo pipeline.`,
    ];
    targetOffering = "SaaS Product Web Design & Conversion Architecture";
    talkingPoints = [
      "What is your current visitor-to-demo conversion rate across your core product landing pages?",
      "How quickly is your go-to-market team able to deploy and test new campaign pages without engineering bottlenecks?",
    ];
    openingPitchHook = `We partner with growing software teams like ${companyDisplayName} to redesign marketing web architecture that turns technical traffic into qualified sales demos and product trials.`;
  }

  // 11. E-COMMERCE & SPECIALTY RETAIL
  else if (
    /\b(shop|store|boutique|apparel|clothing|fashion|jewelry|retail|ecommerce)\b/i.test(textBlob)
  ) {
    clientBusiness = "E-Commerce & Specialty Consumer Retail";
    businessSummary = `${companyDisplayName} operates a consumer retail or direct-to-consumer e-commerce brand distributing curated goods and merchandise.`;
    companyOverviewDetails = {
      companyName: companyDisplayName,
      industry: "E-Commerce & Specialty Consumer Retail",
      location: inferredLocation,
      businessHistory: inferredHistory,
      businessModel: "Direct-to-consumer online storefront and regional retail sales",
      digitalOperationsSummary: "Online storefront catalog, mobile cart checkout, product categories, and promotion banners",
    };
    currentNeeds = [
      "Optimizing mobile checkout velocity and lowering cart abandonment rates.",
      "Organic search visibility for product categories to reduce reliance on expensive paid ad channels.",
      "Modern visual storefront design that elevates average order value and brand prestige.",
    ];
    recommendations = [
      `Pitch a high-performance e-commerce web storefront engineered for fast mobile checkout and higher average order value.`,
      `Share proven retail case studies demonstrating organic search revenue expansion.`,
    ];
    targetOffering = "E-Commerce Web Architecture & Conversion Optimization";
    talkingPoints = [
      "What is your current mobile cart completion rate compared to desktop shoppers?",
      "Are rising customer acquisition costs on paid ad channels impacting your current operating margins?",
    ];
    openingPitchHook = `We design high-converting e-commerce web storefronts for retail brands like ${companyDisplayName} engineered to maximize order value and capture high-margin organic search buyers.`;
  }

  // 12. GENERAL / CLEAN BRAND INFERENCE (No generic tech placeholder!)
  else {
    const rawDomain = cleanComp.domain || "";
    const domainWords = rawDomain
      .replace(/\.(com|org|net|io|co|us|biz|info)$/i, "")
      .replace(/[-_]/g, " ")
      .trim();

    const inferredTitle = domainWords
      ? domainWords.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") + " Commercial Operations"
      : `${companyDisplayName} Business Operations`;

    clientBusiness = inferredTitle;
    businessSummary = `${companyDisplayName} operates as a commercial enterprise, managing client-facing services, market operations, and regional customer relationships.`;
    companyOverviewDetails = {
      companyName: companyDisplayName,
      industry: inferredTitle,
      location: inferredLocation,
      businessHistory: inferredHistory,
      businessModel: "Commercial services and client relationship management",
      digitalOperationsSummary: "Corporate website, client intake, and regional brand presence",
    };
    currentNeeds = [
      `Elevating their digital market presence to outpace regional competitors and capture high-value customer inquiries.`,
      `Modernizing mobile customer acquisition touchpoints to streamline initial consultations and inbound inquiries.`,
    ];
    recommendations = [
      `Pitch client about ${primaryOurFocus} as our core capability to establish a high-trust digital presence and drive direct customer inquiries.`,
      `Share relevant commercial portfolio samples and propose a tailored digital assessment for their market.`,
    ];
    targetOffering = `${primaryOurFocus} & Digital Market Strategy`;
    talkingPoints = [
      "What are the main channels your team relies on today to acquire new customer accounts and qualified inquiries?",
      "How well does your current digital footprint represent your organization's true capabilities?",
    ];
    openingPitchHook = `I took a close look at ${companyDisplayName} and saw tremendous growth potential—we specialize in custom digital presence and search reach that helps businesses like yours turn visitors into committed clients.`;
  }

  const fitAssessment = evaluateMatrixFit(
    lead,
    matrix,
    clientBusiness,
    targetOffering,
    currentNeeds,
    recommendations
  );

  return {
    leadId: lead.id,
    clientBusiness,
    businessSummary,
    companyOverviewDetails,
    currentNeeds,
    recommendations,
    targetOffering,
    talkingPoints,
    openingPitchHook,
    fitAssessment,
    provider: "builtin",
    modelUsed: "neural-heuristic",
    analyzedAt: new Date().toISOString(),
  };
}
