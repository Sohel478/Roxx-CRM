"use client";

import { useState } from "react";
import { Save, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import type { SuperAdminPlatformSettings } from "@/lib/validations/admin";
import { updatePlatformSettingsAction } from "@/actions/admin";

interface PlatformSettingsFormProps {
  initialSettings: SuperAdminPlatformSettings;
}

export function PlatformSettingsForm({ initialSettings }: PlatformSettingsFormProps) {
  const [settings, setSettings] = useState<SuperAdminPlatformSettings>(initialSettings);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const res = await updatePlatformSettingsAction(settings);
      if (res.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(res.error || "Failed to update platform settings");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {saved && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Platform settings have been successfully updated!</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* General Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900">General Platform Information</h2>
        <p className="text-xs text-slate-500">
          Global branding and communication details displayed across emails and customer portals.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Platform Brand Name
            </label>
            <input
              type="text"
              value={settings.platformName}
              onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Platform Support Email
            </label>
            <input
              type="email"
              value={settings.supportEmail}
              onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Base Billing Currency
            </label>
            <select
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="USD">USD ($ - US Dollar)</option>
              <option value="EUR">EUR (€ - Euro)</option>
              <option value="GBP">GBP (£ - British Pound)</option>
              <option value="INR">INR (₹ - Indian Rupee)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Default Free Trial Duration (Days)
            </label>
            <input
              type="number"
              min="1"
              max="90"
              value={settings.defaultTrialDays}
              onChange={(e) =>
                setSettings({ ...settings, defaultTrialDays: parseInt(e.target.value, 10) || 30 })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.allowPublicSignup}
              onChange={(e) => setSettings({ ...settings, allowPublicSignup: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span className="text-xs font-semibold text-slate-700">
              Allow self-service public customer registration (/signup)
            </span>
          </label>
          <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
            When disabled, only Super Admins can provision new tenant organizations.
          </p>
        </div>
      </div>

      {/* Payment & Billing Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <span>Payment Gateway & Billing Provider</span>
        </h2>
        <p className="text-xs text-slate-500">
          Configure Stripe API keys, sandbox mock mode, and webhook receivers.
        </p>

        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Active Payment Provider
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <label
                className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between text-xs font-semibold transition-all ${
                  settings.paymentProvider === "mock"
                    ? "bg-indigo-50/50 border-indigo-600 text-indigo-900"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>Mock Provider (Offline / Dev)</span>
                <input
                  type="radio"
                  name="paymentProvider"
                  value="mock"
                  checked={settings.paymentProvider === "mock"}
                  onChange={() => setSettings({ ...settings, paymentProvider: "mock" })}
                  className="text-indigo-600"
                />
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between text-xs font-semibold transition-all ${
                  settings.paymentProvider === "stripe"
                    ? "bg-indigo-50/50 border-indigo-600 text-indigo-900"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>Stripe (Live / Test API)</span>
                <input
                  type="radio"
                  name="paymentProvider"
                  value="stripe"
                  checked={settings.paymentProvider === "stripe"}
                  onChange={() => setSettings({ ...settings, paymentProvider: "stripe" })}
                  className="text-indigo-600"
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Stripe Publishable Key
            </label>
            <input
              type="text"
              placeholder="pk_test_..."
              value={settings.stripePublishableKey}
              onChange={(e) => setSettings({ ...settings, stripePublishableKey: e.target.value })}
              className="w-full max-w-xl px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 max-w-xl text-xs space-y-2">
            <div className="font-semibold text-slate-800">Webhook Receiver Endpoint</div>
            <code className="block bg-slate-100 p-2 rounded text-[11px] font-mono text-slate-700 break-all select-all">
              /api/v1/billing/webhook
            </code>
            <div className="flex items-center gap-2 pt-1 text-[11px]">
              <span className="text-slate-500">Webhook Signature Secret:</span>
              {settings.stripeWebhookSecretConfigured ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Configured in Environment
                </span>
              ) : (
                <span className="text-slate-500 font-medium">
                  Using mock signature verification for local testing
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{loading ? "Saving Settings..." : "Save Platform Settings"}</span>
        </button>
      </div>
    </form>
  );
}
