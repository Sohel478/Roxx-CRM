/**
 * AI Lead Discovery & Strategic Sales Pitch Engine
 *
 * Synthesizes client business profile, current discovery needs, and matches against
 * our company's verified capabilities matrix to formulate high-converting sales recommendations.
 * Supports OpenAI (GPT-4o-mini), Google Gemini, and a built-in neural heuristic engine.
 */

import type { CompanyMatrix } from "@/lib/validations/marketing";
import type {
  LeadDiscoveryData,
  LeadDiscoveryInputContext,
} from "@/lib/validations/lead-discovery";
import { resolveCleanCompanyName } from "./lead-researcher";

export interface LeadDiscoveryEngineOptions {
  aiConfig?: {
    aiProvider: "builtin" | "openai" | "gemini";
    apiKey?: string | null;
  } | null;
  companyMatrix?: CompanyMatrix | null;
  forceRefresh?: boolean;
}

/**
 * Main discovery synthesis function
 */
export async function generateLeadDiscovery(
  lead: LeadDiscoveryInputContext,
  options: LeadDiscoveryEngineOptions = {}
): Promise<LeadDiscoveryData> {
  const { aiConfig, companyMatrix } = options;
  const aiProvider = aiConfig?.aiProvider || "builtin";
  const apiKey = (aiConfig?.apiKey || "").trim();

  // 1. Try remote OpenAI API if configured
  if (aiProvider === "openai" && apiKey) {
    try {
      const openAiResult = await callOpenAiDiscovery(lead, apiKey, companyMatrix);
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
      const geminiResult = await callGeminiDiscovery(lead, apiKey, companyMatrix);
      if (geminiResult) {
        return geminiResult;
      }
    } catch (err) {
      console.warn("[Gemini Discovery Fetch Error - Falling back to heuristic]:", err);
    }
  }

  // 3. Built-in Neural Heuristic Synthesizer (Zero-latency fallback)
  return synthesizeHeuristicDiscovery(lead, companyMatrix);
}

/**
 * Calls OpenAI GPT-4o-mini with structured JSON response
 */
async function callOpenAiDiscovery(
  lead: LeadDiscoveryInputContext,
  apiKey: string,
  matrix?: CompanyMatrix | null
): Promise<LeadDiscoveryData | null> {
  const cleanComp = resolveCleanCompanyName(lead.companyName, lead.website, lead.email);
  const companyOfferings = matrix?.serviceOfferings?.join(", ") || "Web Design, Web Development, SEO, Digital Marketing";
  const coreSkills = matrix?.coreSkillsets?.join(", ") || "Full-Stack Development, UI/UX Design, Conversion Optimization, Local SEO";
  const exclusions = matrix?.outOfScopeExclusions?.join(", ") || "None";

  const prompt = `You are an elite B2B Sales Discovery Strategist.
Analyze this lead profile and prepare a short, high-value discovery summary and strategic pitch recommendation for our sales representative before they speak with the client.

Our Company Capabilities & Core Focus:
- Service Offerings: ${companyOfferings}
- Core Skillsets: ${coreSkills}
- STRICT Out-of-Scope Exclusions (NEVER pitch these): ${exclusions}

Lead Profile Information:
- Client Contact Name: ${lead.fullName || lead.firstName}
- Company Name: ${cleanComp.cleanName || lead.companyName || "Client Business"}
- Role / Job Title: ${lead.jobTitle || "Business Stakeholder"}
- Website / Domain: ${cleanComp.domain || lead.website || "N/A"}
- Lead Rating: ${lead.rating || "Warm"}
- Lead Source: ${lead.source || "Direct"} ${lead.sourceDetail ? `(${lead.sourceDetail})` : ""}
- Discovery Notes / Description: ${lead.description || "N/A"}
- Past Rep Interactions: ${lead.pastActivitiesSummary || "Initial discovery phase"}

CRITICAL REQUIREMENTS:
1. Identify the client's business industry (e.g., Hospitality, Healthcare, E-Commerce, etc.) and summarize what they do.
2. Outline 2-3 specific discovery-phase needs or pain points (e.g. looking for Web design and SEO to increase direct bookings/sales).
3. Provide actionable recommendations matching OUR core focus (e.g. pitch Web design as our primary focus, share portfolio samples).
4. Provide 2 targeted discovery questions for the sales call.
5. Provide a 1-sentence opening pitch hook for the sales rep.

Output strict JSON with format:
{
  "clientBusiness": "e.g. Hospitality & Hotel Operations",
  "businessSummary": "1-2 sentences on what this client business does.",
  "currentNeeds": [
    "Need 1: e.g. Currently looking for Web design and SEO to increase sales and bookings for their business",
    "Need 2: e.g. Modern responsive mobile experience to reduce drop-offs"
  ],
  "recommendations": [
    "Rec 1: e.g. Pitch client about Web design as we focus on it and share relevant hospitality samples",
    "Rec 2: e.g. Introduce SEO strategy to capture high-intent organic customers"
  ],
  "targetOffering": "e.g. Web Design & SEO Optimization",
  "talkingPoints": [
    "Question 1 for discovery call",
    "Question 2 to uncover budget or timeline"
  ],
  "openingPitchHook": "Compelling 1-sentence hook ready to speak or email"
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
      temperature: 0.4,
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
    return {
      leadId: lead.id,
      clientBusiness: content.clientBusiness,
      businessSummary: content.businessSummary,
      currentNeeds: content.currentNeeds,
      recommendations: content.recommendations || [
        `Pitch client about ${content.targetOffering || "Web Design"} as our core capability and share portfolio samples.`,
      ],
      targetOffering: content.targetOffering || "Web Design & Conversion",
      talkingPoints: content.talkingPoints || [],
      openingPitchHook: content.openingPitchHook || "",
      provider: "openai",
      modelUsed: "gpt-4o-mini",
      analyzedAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Calls Google Gemini with structured response
 */
async function callGeminiDiscovery(
  lead: LeadDiscoveryInputContext,
  apiKey: string,
  matrix?: CompanyMatrix | null
): Promise<LeadDiscoveryData | null> {
  const cleanComp = resolveCleanCompanyName(lead.companyName, lead.website, lead.email);
  const companyOfferings = matrix?.serviceOfferings?.join(", ") || "Web Design, Web Development, SEO";

  const prompt = `Analyze this lead profile and prepare a discovery summary and sales pitch recommendation.
Company: ${cleanComp.cleanName}
Title: ${lead.jobTitle || "Executive"}
Description: ${lead.description || ""}
Our Services: ${companyOfferings}
Output strict JSON with fields: clientBusiness, businessSummary, currentNeeds (string array), recommendations (string array), targetOffering (string), talkingPoints (string array), openingPitchHook (string).`;

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
    return {
      leadId: lead.id,
      clientBusiness: content.clientBusiness,
      businessSummary: content.businessSummary,
      currentNeeds: content.currentNeeds || [],
      recommendations: content.recommendations || [],
      targetOffering: content.targetOffering || "Web Design",
      talkingPoints: content.talkingPoints || [],
      openingPitchHook: content.openingPitchHook || "",
      provider: "gemini",
      modelUsed: "gemini-1.5-flash",
      analyzedAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Intelligent Heuristic Synthesis Engine
 * Dissects lead metadata, industry markers, and matches against company matrix.
 */
export function synthesizeHeuristicDiscovery(
  lead: LeadDiscoveryInputContext,
  matrix?: CompanyMatrix | null
): LeadDiscoveryData {
  const cleanComp = resolveCleanCompanyName(lead.companyName, lead.website, lead.email);
  const textBlob = `${lead.companyName || ""} ${lead.jobTitle || ""} ${lead.description || ""} ${lead.sourceDetail || ""} ${lead.website || ""}`.toLowerCase();

  // Match our company focus offerings from matrix or default
  const ourOfferings = matrix?.serviceOfferings || ["Web Design", "Web Development", "SEO & Search Visibility"];
  const primaryOurFocus = ourOfferings[0] || "Web Design";

  let clientBusiness = "Hospitality & Tourism Services";
  let businessSummary = `The client business operates in hospitality, providing customer accommodations, on-site services, and guest hospitality management.`;
  let currentNeeds: string[] = [
    "Currently looking for modern Web design and SEO expertise to increase direct bookings and revenue for their business.",
    "Needs a mobile-responsive reservation experience to reduce customer drop-offs and minimize third-party OTA fees.",
  ];
  let recommendations: string[] = [
    `Pitch client about ${primaryOurFocus} as we focus on it and share relevant hospitality portfolio samples and case studies.`,
    "Highlight local search engine optimization (SEO) to outrank regional competitors and capture high-intent travelers.",
  ];
  let targetOffering = primaryOurFocus;
  let talkingPoints: string[] = [
    "What percentage of your current bookings or customer inquiries come directly through your website vs third-party aggregators?",
    "How has your mobile visitor conversion been performing over the past quarter?",
  ];
  let openingPitchHook = `I noticed ${cleanComp.cleanName || "your team"} has strong guest traction—we specialize in custom Web Design and SEO that helps hospitality businesses drive over 30% more direct bookings.`;

  // Detect specific industry verticals
  if (
    textBlob.includes("hotel") ||
    textBlob.includes("resort") ||
    textBlob.includes("hospitality") ||
    textBlob.includes("restaurant") ||
    textBlob.includes("cafe") ||
    textBlob.includes("dining") ||
    textBlob.includes("travel") ||
    textBlob.includes("catering")
  ) {
    clientBusiness = "Hospitality & Guest Services";
    businessSummary = `The client business is in hospitality, managing guest experiences, bookings, and customer-facing hospitality services.`;
    currentNeeds = [
      "Currently looking for Web design and SEO expertise to increase direct bookings and sales for their business.",
      "Requires an intuitive, high-speed mobile experience to reduce booking abandonment and OTA commission reliance.",
    ];
    recommendations = [
      `Pitch client about Web design as we focus on it and share some sample works and client case studies as well.`,
      "Offer an integrated SEO visibility audit focusing on regional search queries and Google Maps positioning.",
    ];
    targetOffering = "Web Design & Hospitality SEO";
    talkingPoints = [
      "What percentage of your bookings currently come directly through your website vs platforms like Booking.com or Expedia?",
      "Are you satisfied with your current website speed and mobile conversion flow?",
    ];
    openingPitchHook = `We've helped hospitality brands increase direct online reservations while cutting down on third-party OTA fees through modern, high-converting web design.`;
  } else if (
    textBlob.includes("health") ||
    textBlob.includes("clinic") ||
    textBlob.includes("medical") ||
    textBlob.includes("doctor") ||
    textBlob.includes("dental") ||
    textBlob.includes("pharma") ||
    textBlob.includes("care")
  ) {
    clientBusiness = "Healthcare & Clinical Services";
    businessSummary = `The client operates in the medical and healthcare sector, offering clinical care and patient-oriented services.`;
    currentNeeds = [
      "Looking for a patient-friendly digital portal, appointment scheduling, and localized healthcare SEO.",
      "Needs compliance-focused, accessible web architecture to build patient trust and increase inquiries.",
    ];
    recommendations = [
      `Pitch client about Web design and streamlined patient intake portals as our core technical focus.`,
      "Share medical/clinical case studies demonstrating privacy compliance and local search reach.",
    ];
    targetOffering = "Healthcare Web Development & SEO";
    talkingPoints = [
      "How do patients currently schedule appointments, and is your front-desk team handling manual scheduling calls?",
      "What is your visibility for local patient searches in your metropolitan area?",
    ];
    openingPitchHook = `We build secure, high-conversion healthcare websites that streamline patient intake and increase direct clinic appointments.`;
  } else if (
    textBlob.includes("real estate") ||
    textBlob.includes("realty") ||
    textBlob.includes("property") ||
    textBlob.includes("builder") ||
    textBlob.includes("architect") ||
    textBlob.includes("broker")
  ) {
    clientBusiness = "Real Estate & Property Development";
    businessSummary = `The client business specializes in real estate, property management, or commercial/residential developments.`;
    currentNeeds = [
      "Looking for high-impact property listing showcase, interactive virtual tours, and inbound lead capture.",
      "Requires targeted local SEO to rank for buyer and seller search queries in competitive zones.",
    ];
    recommendations = [
      `Pitch client on modern visual Web design featuring high-resolution property galleries and lead magnets.`,
      "Present proven SEO frameworks for capturing organic property inquiries.",
    ];
    targetOffering = "Real Estate Web Architecture & SEO";
    talkingPoints = [
      "Where are your highest quality buyer/investor leads originating today?",
      "How easily can prospective clients browse available inventory on mobile devices?",
    ];
    openingPitchHook = `We build modern property websites that turn passive browsers into qualified buyer inquiries through focused design and search ranking.`;
  } else if (
    textBlob.includes("saas") ||
    textBlob.includes("tech") ||
    textBlob.includes("software") ||
    textBlob.includes("app") ||
    textBlob.includes("platform") ||
    textBlob.includes("cloud")
  ) {
    clientBusiness = "Technology & Software Platforms";
    businessSummary = `The client is a technology or software organization focused on digital product delivery and product-led growth.`;
    currentNeeds = [
      "Looking to optimize their marketing site conversion rate, product messaging, and technical SEO.",
      "Needs responsive developer-grade web design and scalable customer onboarding flows.",
    ];
    recommendations = [
      `Pitch client on modern SaaS web design and interactive product tour UI as our primary focus.`,
      "Share B2B tech portfolio samples demonstrating conversion rate lift.",
    ];
    targetOffering = "SaaS Web Design & Conversion Optimization";
    talkingPoints = [
      "What is your current visitor-to-demo conversion rate on your product landing pages?",
      "How quickly is your marketing team able to deploy new campaign pages without engineering bottlenecks?",
    ];
    openingPitchHook = `We help software teams redesign their marketing web footprint to drive more qualified demo requests and product sign-ups.`;
  } else if (
    textBlob.includes("shop") ||
    textBlob.includes("store") ||
    textBlob.includes("ecommerce") ||
    textBlob.includes("retail") ||
    textBlob.includes("goods") ||
    textBlob.includes("brand")
  ) {
    clientBusiness = "E-Commerce & Consumer Retail";
    businessSummary = `The client business operates a retail or e-commerce brand selling consumer products and goods.`;
    currentNeeds = [
      "Looking for e-commerce website redesign and technical SEO to boost organic sales and reduce cart abandonment.",
      "Needs frictionless checkout experience and fast mobile page speeds.",
    ];
    recommendations = [
      `Pitch client on high-performance e-commerce Web design as we focus on it, sharing relevant online store samples.`,
      "Introduce conversion-rate optimization (CRO) strategies for cart checkout stages.",
    ];
    targetOffering = "E-Commerce Web Design & CRO";
    talkingPoints = [
      "What is your current mobile cart abandonment rate?",
      "Are you currently investing in organic search engine visibility to lower paid ad customer acquisition costs?",
    ];
    openingPitchHook = `We design high-converting e-commerce web storefronts engineered to maximize average order value and direct organic sales.`;
  } else {
    // Default / General Business
    const displayBusiness = cleanComp.likelyIndustry !== "General Business"
      ? cleanComp.likelyIndustry
      : "Commercial Enterprise & Services";

    clientBusiness = displayBusiness;
    businessSummary = `The client business operates as an independent enterprise in ${displayBusiness.toLowerCase()}, managing customer and client-facing solutions.`;
    currentNeeds = [
      `Currently looking for modern Web design and SEO expertise to increase sales and market reach for their business.`,
      `Seeking a trustworthy digital presence to outperform local competitors and capture qualified inquiries.`,
    ];
    recommendations = [
      `Pitch client about Web design as we focus on it and share relevant case studies and samples as well.`,
      `Offer a tailored digital visibility assessment to demonstrate quick-win growth avenues.`,
    ];
    targetOffering = "Custom Web Design & Search Visibility";
    talkingPoints = [
      "What are the main channels your team uses today to acquire new customer inquiries?",
      "How well does your current website represent your business's true capabilities?",
    ];
    openingPitchHook = `I took a look at ${cleanComp.cleanName || "your business"} and saw great growth potential—we specialize in modern Web Design and SEO to help businesses like yours win more direct clients.`;
  }

  return {
    leadId: lead.id,
    clientBusiness,
    businessSummary,
    currentNeeds,
    recommendations,
    targetOffering,
    talkingPoints,
    openingPitchHook,
    provider: "builtin",
    modelUsed: "neural-heuristic",
    analyzedAt: new Date().toISOString(),
  };
}
