import { describe, it, expect } from "vitest";
import {
  analyzeEmailDeliverability,
  type DeliverabilityInput,
} from "@/lib/email/deliverability-analyzer";

describe("Email Deliverability Analyzer Engine", () => {
  it("flags short test emails (e.g. 'test 123' / 'test 124') as HIGH_SPAM_RISK", () => {
    const result = analyzeEmailDeliverability({
      subject: "test 123",
      body: "Hello Kristi,\n\ntest 124\n\nregards",
      fromEmail: "infotflux@gmail.com",
      smtpUsername: "infotflux@gmail.com",
    });

    expect(result.rating).toBe("HIGH_SPAM_RISK");
    expect(result.score).toBeLessThan(60);

    const issueTitles = result.issues.map((i) => i.title);
    expect(issueTitles).toContain("Spam Filter Probe Trigger");
    expect(issueTitles).toContain("Critically Low Word Count");
  });

  it("flags aggressive sales/promotional keywords and ALL CAPS in subject", () => {
    const result = analyzeEmailDeliverability({
      subject: "ACT NOW SPECIAL PROMOTION 100% FREE RISK FREE GUARANTEE!!!",
      body: "Click here immediately to claim your prize and make money fast with no risk. Wire transfer details inside.",
    });

    expect(result.rating).toBe("HIGH_SPAM_RISK");
    expect(result.score).toBeLessThan(50);

    const issueTitles = result.issues.map((i) => i.title);
    expect(issueTitles).toContain("Excessive Capitalization");
    expect(issueTitles).toContain("Excessive Punctuation");
    expect(issueTitles).toContain("Spam Trigger Phrase in Subject");
  });

  it("flags sender domain mismatch (DMARC spoofing vulnerability)", () => {
    const result = analyzeEmailDeliverability({
      subject: "Checking on your account review",
      body: "Hi John, following up on our call from yesterday regarding the platform migration plan. Let me know when you have 10 minutes to review.",
      fromEmail: "ceo@apple.com",
      smtpUsername: "user@randomrelay.net",
    });

    expect(result.score).toBeLessThan(80);
    const issueTitles = result.issues.map((i) => i.title);
    expect(issueTitles).toContain("Sender Domain Mismatch (DMARC / SPF Risk)");
  });

  it("flags unclosed or raw template tags in message", () => {
    const result = analyzeEmailDeliverability({
      subject: "Quick question for {{first_name",
      body: "Hello {lead_name}, we missed our appointment today.",
    });

    const issueTitles = result.issues.map((i) => i.title);
    expect(issueTitles).toContain("Unclosed Dynamic Merge Tag");
  });

  it("scores well-crafted human 1-on-1 business emails as PRIMARY_INBOX", () => {
    const result = analyzeEmailDeliverability({
      subject: "Follow up on our CRM discussion",
      body: "Hi Sarah,\n\nThanks for taking the time to speak with our team this morning. As discussed, I've outlined the project scope and integration timeline below for your review.\n\nPlease let me know if Thursday at 2 PM works for a quick walkthrough.\n\nBest regards,\nAlex Vance\nTechflux Solutions",
      fromEmail: "alex@techflux.com",
      smtpUsername: "alex@techflux.com",
    });

    expect(result.rating).toBe("PRIMARY_INBOX");
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.issues.filter((i) => i.severity === "error").length).toBe(0);
  });
});
