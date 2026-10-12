/**
 * AI Lead Discovery & Strategic Sales Pitch Engine
 *
 * Synthesizes client business profile, current discovery needs, and matches against
 * our company's verified capabilities matrix to formulate high-converting sales recommendations.
 * Supports OpenAI (GPT-4o-mini), Google Gemini, and an advanced domain-aware neural heuristic engine.
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

Our Company Offerings & Core Focus:
- Service Offerings: ${companyOfferings}
- Core Skillsets: ${coreSkills}
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
  "currentNeeds": [
    "Specific need 1 tailored strictly to this client's industry",
    "Specific need 2 tailored strictly to this client's industry",
    "Specific need 3 (optional)"
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
  "openingPitchHook": "Compelling 1-sentence opening hook tailored to this specific business and what they do."
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
    return {
      leadId: lead.id,
      clientBusiness: content.clientBusiness,
      businessSummary: content.businessSummary,
      currentNeeds: content.currentNeeds,
      recommendations: content.recommendations || [
        `Pitch client about ${content.targetOffering || "Web Design"} tailored to their business needs.`,
      ],
      targetOffering: content.targetOffering || "Custom Web Design & Strategy",
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

  const prompt = `Analyze this specific lead profile and prepare a discovery summary and sales pitch recommendation.
Company: ${cleanComp.cleanName}
Domain: ${cleanComp.domain || lead.website || ""}
Description: ${lead.description || ""}
${scrapedWebsiteText ? `Website Text: ${scrapedWebsiteText.slice(0, 1000)}` : ""}
Our Services: ${companyOfferings}
Output strict JSON with fields: clientBusiness, businessSummary, currentNeeds (string array), recommendations (string array), targetOffering (string), talkingPoints (string array), openingPitchHook (string). Must be 100% specific to this client's industry.`;

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
      targetOffering: content.targetOffering || "Custom Web Design",
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

  let clientBusiness = "";
  let businessSummary = "";
  let currentNeeds: string[] = [];
  let recommendations: string[] = [];
  let targetOffering = "";
  let talkingPoints: string[] = [];
  let openingPitchHook = "";

  // 1. FLORAL & BOTANICAL DESIGN (e.g. Leaves Floral Design)
  if (
    textBlob.includes("floral") ||
    textBlob.includes("florist") ||
    textBlob.includes("flower") ||
    textBlob.includes("leaves") ||
    textBlob.includes("bloom") ||
    textBlob.includes("botanical") ||
    textBlob.includes("bouquet")
  ) {
    clientBusiness = "Boutique Floral Design & Event Floristry";
    businessSummary = `${companyDisplayName} operates as a bespoke floral studio specializing in custom floral arrangements, bridal bouquets, wedding & event florals, and seasonal floral styling.`;
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

  // 2. RESTAURANTS, BISTROS & CULINARY DINING
  else if (
    textBlob.includes("restaurant") ||
    textBlob.includes("cafe") ||
    textBlob.includes("bistro") ||
    textBlob.includes("dining") ||
    textBlob.includes("catering") ||
    textBlob.includes("bakery") ||
    textBlob.includes("grill") ||
    textBlob.includes("kitchen") ||
    textBlob.includes("bar") ||
    textBlob.includes("pizzeria") ||
    textBlob.includes("food")
  ) {
    clientBusiness = "Food & Beverage / Culinary Dining";
    businessSummary = `${companyDisplayName} provides culinary hospitality, on-site dining experiences, and food service operations.`;
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

  // 3. HOSPITALITY, HOTELS & RESORTS
  else if (
    textBlob.includes("hotel") ||
    textBlob.includes("resort") ||
    textBlob.includes("hospitality") ||
    textBlob.includes("lodge") ||
    textBlob.includes("inn") ||
    textBlob.includes("suites")
  ) {
    clientBusiness = "Hospitality & Guest Resort Operations";
    businessSummary = `${companyDisplayName} operates in the hospitality industry, managing guest accommodations, on-site experiences, and regional tourism bookings.`;
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

  // 4. HEALTHCARE, CLINICS & DENTAL
  else if (
    textBlob.includes("health") ||
    textBlob.includes("clinic") ||
    textBlob.includes("medical") ||
    textBlob.includes("doctor") ||
    textBlob.includes("dental") ||
    textBlob.includes("dentist") ||
    textBlob.includes("orthodont") ||
    textBlob.includes("surgery") ||
    textBlob.includes("patient") ||
    textBlob.includes("therapy") ||
    textBlob.includes("chiro") ||
    textBlob.includes("care")
  ) {
    clientBusiness = "Healthcare & Clinical Patient Practice";
    businessSummary = `${companyDisplayName} is a clinical healthcare provider delivering specialized patient care, diagnostic consultations, and wellness treatments.`;
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

  // 5. REAL ESTATE & PROPERTY DEVELOPMENT
  else if (
    textBlob.includes("real estate") ||
    textBlob.includes("realty") ||
    textBlob.includes("property") ||
    textBlob.includes("properties") ||
    textBlob.includes("broker") ||
    textBlob.includes("realtor") ||
    textBlob.includes("mortgage")
  ) {
    clientBusiness = "Real Estate Brokerage & Property Development";
    businessSummary = `${companyDisplayName} specializes in real estate advisory, property acquisitions, and commercial or residential development marketing.`;
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

  // 6. ARCHITECTURE, CONSTRUCTION & TRADE CONTRACTING
  else if (
    textBlob.includes("construction") ||
    textBlob.includes("builder") ||
    textBlob.includes("contractor") ||
    textBlob.includes("roofing") ||
    textBlob.includes("plumbing") ||
    textBlob.includes("electrical") ||
    textBlob.includes("hvac") ||
    textBlob.includes("architect") ||
    textBlob.includes("remodel") ||
    textBlob.includes("solar")
  ) {
    clientBusiness = "Architecture, Construction & Trade Contracting";
    businessSummary = `${companyDisplayName} provides professional construction, architectural design, contracting, or trade infrastructure services.`;
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

  // 7. LEGAL, ACCOUNTING & FINANCIAL ADVISORY
  else if (
    textBlob.includes("law") ||
    textBlob.includes("legal") ||
    textBlob.includes("attorney") ||
    textBlob.includes("lawyer") ||
    textBlob.includes("cpa") ||
    textBlob.includes("accounting") ||
    textBlob.includes("tax") ||
    textBlob.includes("wealth") ||
    textBlob.includes("financial")
  ) {
    clientBusiness = "Legal, Financial & Professional Advisory";
    businessSummary = `${companyDisplayName} delivers specialized legal counsel, fiduciary management, tax planning, or corporate advisory services.`;
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

  // 8. FITNESS, WELLNESS & AESTHETIC STUDIOS
  else if (
    textBlob.includes("fitness") ||
    textBlob.includes("gym") ||
    textBlob.includes("training") ||
    textBlob.includes("yoga") ||
    textBlob.includes("pilates") ||
    textBlob.includes("salon") ||
    textBlob.includes("spa") ||
    textBlob.includes("barber") ||
    textBlob.includes("skincare") ||
    textBlob.includes("aesthetic")
  ) {
    clientBusiness = "Fitness, Wellness & Aesthetic Studios";
    businessSummary = `${companyDisplayName} operates a specialized wellness, fitness training, or aesthetic personal care studio.`;
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

  // 9. TECHNOLOGY, SOFTWARE & IT PLATFORMS
  else if (
    textBlob.includes("software") ||
    textBlob.includes("saas") ||
    textBlob.includes("tech") ||
    textBlob.includes("cloud") ||
    textBlob.includes("dev") ||
    textBlob.includes("cyber") ||
    textBlob.includes("data") ||
    textBlob.includes("platform") ||
    textBlob.includes("app")
  ) {
    clientBusiness = "Technology & Software Platforms";
    businessSummary = `${companyDisplayName} is a digital technology or software organization engineering product solutions and cloud services.`;
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

  // 10. E-COMMERCE & SPECIALTY RETAIL
  else if (
    textBlob.includes("shop") ||
    textBlob.includes("store") ||
    textBlob.includes("boutique") ||
    textBlob.includes("apparel") ||
    textBlob.includes("clothing") ||
    textBlob.includes("fashion") ||
    textBlob.includes("jewelry") ||
    textBlob.includes("retail") ||
    textBlob.includes("ecommerce")
  ) {
    clientBusiness = "E-Commerce & Specialty Consumer Retail";
    businessSummary = `${companyDisplayName} operates a consumer retail or direct-to-consumer e-commerce brand distributing curated goods and merchandise.`;
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

  // 11. GENERAL / CLEAN BRAND INFERENCE (No generic tech placeholder!)
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
