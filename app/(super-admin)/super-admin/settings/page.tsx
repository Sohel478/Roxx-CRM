import { Settings } from "lucide-react";
import { getPlatformSettingsAction } from "@/actions/admin";
import { PlatformSettingsForm } from "@/components/admin/platform-settings-form";

export const metadata = {
  title: "Platform Settings | Roxx CRM Super Admin",
};

export default async function SuperAdminSettingsPage() {
  const res = await getPlatformSettingsAction();
  const settings = res.data || {
    platformName: "Roxx CRM",
    supportEmail: "support@roxx-crm.com",
    currency: "USD",
    defaultTrialDays: 30,
    allowPublicSignup: true,
    paymentProvider: "mock",
    stripePublishableKey: "",
    stripeWebhookSecretConfigured: false,
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          <span>Platform & Billing Settings</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure platform defaults, global pricing currency, registration access, and Stripe gateway credentials.
        </p>
      </div>

      <PlatformSettingsForm initialSettings={settings} />
    </div>
  );
}
