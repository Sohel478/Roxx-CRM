import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPaymentProvider } from "@/lib/billing/payment-provider";
import { prisma } from "@/lib/db/prisma";
import { ensureDatabaseSchema } from "@/lib/db/migrate";
import {
  mockOrganizationsStore,
  mockSubscriptionEventsStore,
  mockPaymentsStore,
} from "@/lib/db/mock-store";

function isMockMode(): boolean {
  return (
    !process.env.DATABASE_URL ||
    process.env.DATABASE_URL.includes("ep-sample-pooler") ||
    process.env.DATABASE_URL.includes("user:password")
  );
}

function mapPlanToEnum(plan: string): "FREE_TRIAL" | "STARTER_20" | "GROWTH_50" | "ENTERPRISE" {
  const p = plan.toUpperCase();
  if (p.includes("ENTERPRISE")) return "ENTERPRISE";
  if (p.includes("BUSINESS") || p.includes("GROWTH")) return "GROWTH_50";
  if (p.includes("STARTER") || p.includes("PROFESSIONAL")) return "STARTER_20";
  return "FREE_TRIAL";
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get("stripe-signature") ||
      request.headers.get("x-webhook-signature") ||
      "mock_signature";

    const provider = getPaymentProvider();
    const event = await provider.verifyWebhook(rawBody, signature);

    if (!event) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    await ensureDatabaseSchema();

    const eventType = event.type;
    const sessionObj = event.data?.object || {};
    const metadata = (typeof sessionObj.metadata === "object" && sessionObj.metadata !== null
      ? (sessionObj.metadata as Record<string, unknown>)
      : {}) as Record<string, unknown>;

    const organizationId =
      (typeof metadata.organization_id === "string" ? metadata.organization_id : null) ||
      (typeof sessionObj.client_reference_id === "string" ? sessionObj.client_reference_id : null) ||
      (typeof sessionObj.organization_id === "string" ? sessionObj.organization_id : null);

    const planId =
      (typeof metadata.plan_id === "string" ? metadata.plan_id : null) ||
      (typeof sessionObj.plan_id === "string" ? sessionObj.plan_id : null) ||
      "professional";

    if (!organizationId) {
      return NextResponse.json(
        { received: true, message: "No organizationId found in webhook metadata, skipping." },
        { status: 200 }
      );
    }

    const amount = Number(
      typeof sessionObj.amount_total === "number"
        ? sessionObj.amount_total / 100
        : typeof sessionObj.amount === "number"
        ? sessionObj.amount
        : 79
    );
    const currency = String(sessionObj.currency || "USD").toUpperCase();
    const externalId = String(sessionObj.id || `evt_${Date.now()}`);

    // ------------------------------------------------------------------------
    // MOCK MODE DB
    // ------------------------------------------------------------------------
    if (isMockMode()) {
      if (eventType === "checkout.session.completed" || eventType === "invoice.paid") {
        const org = mockOrganizationsStore.find((o) => o.id === organizationId);
        if (org) {
          org.subscriptionStatus = "ACTIVE";
          org.subscriptionPlan = mapPlanToEnum(planId);
          const nextRenewal = new Date();
          nextRenewal.setDate(nextRenewal.getDate() + 30);
          org.subscriptionEndsAt = nextRenewal.toISOString();
        }

        // Idempotent payment recording
        const alreadyExists = mockPaymentsStore.some((p) => p.externalPaymentId === externalId);
        if (!alreadyExists) {
          mockPaymentsStore.unshift({
            id: `pay_${Date.now()}`,
            organizationId,
            subscriptionId: `sub_${organizationId}`,
            amount,
            currency,
            status: "COMPLETED",
            provider: provider.name,
            externalPaymentId: externalId,
            createdAt: new Date().toISOString(),
          });

          mockSubscriptionEventsStore.unshift({
            id: `sub_evt_${Date.now()}`,
            subscriptionId: `sub_${organizationId}`,
            organizationId,
            eventType: "PAYMENT_SUCCEEDED",
            oldPlanId: null,
            newPlanId: planId,
            notes: `Automated payment of $${amount} ${currency} recorded via ${provider.name}`,
            createdBy: "SYSTEM_WEBHOOK",
            createdAt: new Date().toISOString(),
          });
        }
      }

      return NextResponse.json({ received: true, handled: true });
    }

    // ------------------------------------------------------------------------
    // POSTGRES DB
    // ------------------------------------------------------------------------
    if (eventType === "checkout.session.completed" || eventType === "invoice.paid") {
      const nextRenewal = new Date();
      nextRenewal.setDate(nextRenewal.getDate() + 30);

      // 1. Update Organization
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          subscriptionStatus: "ACTIVE",
          subscriptionPlan: mapPlanToEnum(planId),
          subscriptionEndsAt: nextRenewal,
        },
      });

      // 2. Locate or create active Subscription
      let sub = await prisma.subscription.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      });

      // Find plan record
      const dbPlan = await prisma.plan.findFirst({
        where: {
          OR: [{ id: planId }, { slug: planId.toLowerCase() }],
        },
      });

      if (!sub && dbPlan) {
        sub = await prisma.subscription.create({
          data: {
            organizationId,
            planId: dbPlan.id,
            status: "ACTIVE",
            startDate: new Date(),
            renewalDate: nextRenewal,
            billingInterval: "MONTHLY",
          },
        });
      } else if (sub) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: "ACTIVE",
            renewalDate: nextRenewal,
            planId: dbPlan ? dbPlan.id : sub.planId,
          },
        });
      }

      // 3. Idempotently record Payment
      const existingPayment = await prisma.payment.findFirst({
        where: { externalPaymentId: externalId },
      });

      if (!existingPayment && sub) {
        await prisma.payment.create({
          data: {
            organizationId,
            subscriptionId: sub.id,
            amount,
            currency,
            status: "COMPLETED",
            provider: provider.name,
            externalPaymentId: externalId,
          },
        });

        await prisma.subscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            organizationId,
            eventType: "PAYMENT_SUCCEEDED",
            newPlanId: dbPlan?.id || planId,
            notes: `Payment of $${amount} ${currency} verified via ${provider.name}`,
            createdBy: "SYSTEM_WEBHOOK",
          },
        });

        await prisma.auditLog.create({
          data: {
            organizationId,
            action: "SUBSCRIPTION_PAYMENT_PROCESSED",
            entityType: "Payment",
            entityId: externalId,
            newValues: { amount, currency, provider: provider.name, planId },
          },
        });
      }
    } else if (
      eventType === "customer.subscription.deleted" ||
      eventType === "subscription.cancelled"
    ) {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { subscriptionStatus: "EXPIRED" },
      });

      const sub = await prisma.subscription.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      });

      if (sub) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "EXPIRED", cancelledAt: new Date() },
        });

        await prisma.subscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            organizationId,
            eventType: "EXPIRED",
            notes: "Subscription expired or cancelled via billing webhook",
            createdBy: "SYSTEM_WEBHOOK",
          },
        });
      }
    }

    return NextResponse.json({ received: true, handled: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Webhook processing error";
    console.error("[Billing Webhook Error]:", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
