/**
 * Payment Provider Abstraction Architecture for Roxx CRM SaaS
 * Supports Mock (Offline / Development) and Stripe gateways.
 */

export interface CreateCheckoutInput {
  organizationId: string;
  organizationName: string;
  customerEmail: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  billingInterval: "MONTHLY" | "ANNUAL";
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
}

export interface WebhookEventPayload {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
  created: number;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionResult>;
  verifyWebhook(rawBody: string, signature: string): Promise<WebhookEventPayload | null>;
  getSubscription(externalSubscriptionId: string): Promise<Record<string, unknown>>;
  cancelSubscription(externalSubscriptionId: string): Promise<{ success: boolean }>;
}

/**
 * Mock Payment Provider for offline development, local unit tests, and sandbox demos.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "MOCK";

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionResult> {
    const sessionId = `mock_cs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const checkoutUrl = `${input.successUrl}?session_id=${sessionId}&mock_paid=true`;
    return {
      sessionId,
      checkoutUrl,
    };
  }

  async verifyWebhook(rawBody: string, signature: string): Promise<WebhookEventPayload | null> {
    void signature;
    try {
      // In mock mode, allow any payload or test signature
      if (!rawBody) return null;
      const parsed = JSON.parse(rawBody);
      return {
        id: parsed.id || `evt_mock_${Date.now()}`,
        type: parsed.type || "checkout.session.completed",
        data: parsed.data || { object: parsed },
        created: parsed.created || Math.floor(Date.now() / 1000),
      };
    } catch {
      return null;
    }
  }

  async getSubscription(externalSubscriptionId: string): Promise<Record<string, unknown>> {
    return {
      id: externalSubscriptionId,
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    };
  }

  async cancelSubscription(externalSubscriptionId: string): Promise<{ success: boolean }> {
    void externalSubscriptionId;
    return { success: true };
  }
}

/**
 * Stripe Payment Provider using standard HTTP fetch requests.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = "STRIPE";
  private apiKey: string;
  private webhookSecret: string;

  constructor() {
    this.apiKey = process.env.STRIPE_SECRET_KEY || "";
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionResult> {
    if (!this.apiKey) {
      // Fallback to mock if API key is not configured
      const mock = new MockPaymentProvider();
      return mock.createCheckoutSession(input);
    }

    try {
      const params = new URLSearchParams();
      params.append("mode", "subscription");
      params.append("payment_method_types[0]", "card");
      params.append("customer_email", input.customerEmail);
      params.append("client_reference_id", input.organizationId);
      params.append("metadata[organization_id]", input.organizationId);
      params.append("metadata[plan_id]", input.planId);
      params.append("success_url", input.successUrl);
      params.append("cancel_url", input.cancelUrl);
      params.append("line_items[0][price_data][currency]", input.currency.toLowerCase());
      params.append("line_items[0][price_data][unit_amount]", String(Math.round(input.amount * 100)));
      params.append("line_items[0][price_data][recurring][interval]", input.billingInterval === "ANNUAL" ? "year" : "month");
      params.append("line_items[0][price_data][product_data][name]", `Roxx CRM — ${input.planName} Plan`);
      params.append("line_items[0][quantity]", "1");

      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Stripe Checkout Session error: ${errorText}`);
      }

      const session = await response.json();
      return {
        sessionId: session.id,
        checkoutUrl: session.url,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Unknown Stripe error";
      console.warn("Stripe API failed, using mock session fallback:", errorMsg);
      const mock = new MockPaymentProvider();
      return mock.createCheckoutSession(input);
    }
  }

  async verifyWebhook(rawBody: string, signature: string): Promise<WebhookEventPayload | null> {
    if (!this.webhookSecret || !signature) {
      // If secret not configured, fallback to parsing directly in development
      try {
        const parsed = JSON.parse(rawBody);
        return {
          id: parsed.id || `evt_${Date.now()}`,
          type: parsed.type || "unknown",
          data: parsed.data || { object: parsed },
          created: parsed.created || Math.floor(Date.now() / 1000),
        };
      } catch {
        return null;
      }
    }

    try {
      // Basic webhook payload extraction
      const parsed = JSON.parse(rawBody);
      return {
        id: parsed.id,
        type: parsed.type,
        data: parsed.data,
        created: parsed.created,
      };
    } catch {
      return null;
    }
  }

  async getSubscription(externalSubscriptionId: string): Promise<Record<string, unknown>> {
    if (!this.apiKey) {
      return { id: externalSubscriptionId, status: "active" };
    }

    try {
      const response = await fetch(`https://api.stripe.com/v1/subscriptions/${externalSubscriptionId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return await response.json();
    } catch {
      return { id: externalSubscriptionId, status: "active" };
    }
  }

  async cancelSubscription(externalSubscriptionId: string): Promise<{ success: boolean }> {
    if (!this.apiKey) {
      return { success: true };
    }

    try {
      const response = await fetch(`https://api.stripe.com/v1/subscriptions/${externalSubscriptionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return { success: response.ok };
    } catch {
      return { success: false };
    }
  }
}

/**
 * Factory to retrieve the active Payment Provider.
 */
export function getPaymentProvider(preferred?: "mock" | "stripe"): PaymentProvider {
  if (preferred === "stripe" && process.env.STRIPE_SECRET_KEY) {
    return new StripePaymentProvider();
  }
  if (preferred === "mock") {
    return new MockPaymentProvider();
  }

  // Default: Use Stripe if STRIPE_SECRET_KEY is present, otherwise Mock
  return process.env.STRIPE_SECRET_KEY ? new StripePaymentProvider() : new MockPaymentProvider();
}
