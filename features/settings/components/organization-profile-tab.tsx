"use client";

import { useState, useTransition } from "react";
import {
  Building2,
  Globe2,
  Coins,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrganizationSettings } from "@/lib/validations/settings";
import { updateOrganizationSettingsAction } from "@/actions/settings";

interface OrganizationProfileTabProps {
  initialSettings: OrganizationSettings;
  onRefresh: () => void;
}

export function OrganizationProfileTab({
  initialSettings,
  onRefresh,
}: OrganizationProfileTabProps) {
  const [name, setName] = useState(initialSettings.name);
  const [timezone, setTimezone] = useState(initialSettings.timezone);
  const [defaultCurrency, setDefaultCurrency] = useState(initialSettings.defaultCurrency);
  const [fiscalYearStart, setFiscalYearStart] = useState(initialSettings.fiscalYearStart);
  const [dateFormat, setDateFormat] = useState(initialSettings.dateFormat);

  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    startTransition(async () => {
      const res = await updateOrganizationSettingsAction({
        name,
        timezone,
        defaultCurrency,
        fiscalYearStart,
        dateFormat,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to update organization settings");
      } else {
        setSuccessMsg("Organization configuration saved successfully.");
        onRefresh();
      }
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden max-w-4xl">
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">
          Organization Profile &amp; Preferences
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure default corporate identity, currency conversions, reporting timezones, and fiscal cycles.
        </p>
      </div>

      <form onSubmit={handleSave} className="p-6 space-y-6">
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Org Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Legal Organization Name *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Roxx Technologies Inc."
                className="pl-9 text-xs"
              />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Displayed on invoices, customer exports, and email communications.
            </span>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Primary System Timezone *
            </label>
            <div className="relative">
              <Globe2 className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="America/New_York (EST)">America/New_York (EST / EDT)</option>
                <option value="America/Los_Angeles (PST)">America/Los_Angeles (PST / PDT)</option>
                <option value="America/Chicago (CST)">America/Chicago (CST / CDT)</option>
                <option value="Europe/London (GMT)">Europe/London (GMT / BST)</option>
                <option value="Europe/Paris (CET)">Europe/Paris (CET / CEST)</option>
                <option value="Asia/Dubai (GST)">Asia/Dubai (GST - UTC+4)</option>
                <option value="Asia/Kolkata (IST)">Asia/Kolkata (IST - UTC+5:30)</option>
                <option value="Asia/Singapore (SGT)">Asia/Singapore (SGT - UTC+8)</option>
                <option value="UTC">Coordinated Universal Time (UTC)</option>
              </select>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              All pipeline close dates and audit trails standardize to this zone.
            </span>
          </div>

          {/* Default Currency */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Default Financial Currency *
            </label>
            <div className="relative">
              <Coins className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <select
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">USD - United States Dollar ($)</option>
                <option value="EUR">EUR - Euro (€)</option>
                <option value="GBP">GBP - British Pound Sterling (£)</option>
                <option value="AED">AED - UAE Dirham (AED)</option>
                <option value="INR">INR - Indian Rupee (₹)</option>
                <option value="CAD">CAD - Canadian Dollar (C$)</option>
                <option value="AUD">AUD - Australian Dollar (A$)</option>
              </select>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Pipeline values, deal sizes, and analytics will display in this currency.
            </span>
          </div>

          {/* Fiscal Year Start */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Fiscal Year Begins *
            </label>
            <div className="relative">
              <CalendarDays className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <select
                value={fiscalYearStart}
                onChange={(e) => setFiscalYearStart(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="January">January (Calendar Year)</option>
                <option value="February">February</option>
                <option value="March">March</option>
                <option value="April">April (UK / India standard)</option>
                <option value="May">May</option>
                <option value="June">June</option>
                <option value="July">July (US Federal standard)</option>
                <option value="August">August</option>
                <option value="September">September</option>
                <option value="October">October</option>
                <option value="November">November</option>
                <option value="December">December</option>
              </select>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Determines QTD / YTD calculations in sales executive reports.
            </span>
          </div>

          {/* Date Format */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Date Display Format *
            </label>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601 standard)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY (European / Global)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (US format)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button
            type="submit"
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save Preferences</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
