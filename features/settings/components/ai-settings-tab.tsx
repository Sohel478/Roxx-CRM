"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Sparkles,
  Bot,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Zap,
  Clock,
  Layers,
  Save,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAiConfigAction, saveAiConfigAction } from "@/actions/ai-email";
import type { AiConfigInput } from "@/lib/validations/marketing";

export function AiSettingsTab() {
  const [provider, setProvider] = useState<"builtin" | "openai" | "gemini">("builtin");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [defaultCompanyPitch, setDefaultCompanyPitch] = useState("");
  const [defaultFollowUpDays, setDefaultFollowUpDays] = useState(3);
  const [defaultPacingMinutes, setDefaultPacingMinutes] = useState(2);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSaving] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    async function loadConfig() {
      setIsLoading(true);
      try {
        const res = await getAiConfigAction();
        if (res.success && res.data) {
          const cfg = res.data;
          setProvider(cfg.aiProvider || "builtin");
          setApiKey(cfg.apiKey || "");
          setDefaultCompanyPitch(cfg.defaultCompanyPitch || "");
          setDefaultFollowUpDays(cfg.defaultFollowUpDays || 3);
          setDefaultPacingMinutes(cfg.defaultPacingMinutes || 2);
        }
      } catch {
        // Fallback to defaults
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = () => {
    startSaving(async () => {
      setStatusMessage(null);
      const input: AiConfigInput = {
        aiProvider: provider,
        apiKey: apiKey.trim() ? apiKey.trim() : null,
        defaultCompanyPitch: defaultCompanyPitch.trim() ? defaultCompanyPitch.trim() : null,
        defaultFollowUpDays: Number(defaultFollowUpDays) || 3,
        defaultPacingMinutes: Number(defaultPacingMinutes) || 2,
      };

      const res = await saveAiConfigAction(input);
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: res.message || "AI configuration updated successfully.",
        });
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to update AI configuration.",
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200 text-center flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        <span>Loading AI intelligence settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner / Header */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-sm border border-purple-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 ring-1 ring-purple-400/30">
              <Sparkles className="w-4 h-4 text-purple-300" />
            </span>
            <Badge className="bg-purple-500/30 text-purple-200 border-purple-400/30 text-[10px] font-bold uppercase tracking-wider">
              Autonomous Intelligence
            </Badge>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1.5">
            AI Research &amp; Autonomous Email Cadences
          </h2>
          <p className="text-xs text-purple-200/80 leading-relaxed">
            Configure how Roxx CRM researches lead profiles (LinkedIn, domain signals, seniority level) and schedules individual 1-on-1 personalized emails and automated follow-ups.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Provider Selector Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4 text-purple-600" />
            AI Intelligence Engine Provider
          </h3>
          <p className="text-xs text-slate-500">
            Choose whether to use Roxx CRM&apos;s built-in neural heuristics engine or connect your own API key.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Built-in Option */}
          <div
            onClick={() => setProvider("builtin")}
            className={`cursor-pointer rounded-xl border p-4 transition-all relative ${
              provider === "builtin"
                ? "border-purple-600 bg-purple-50/50 ring-2 ring-purple-600/20"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-purple-600" />
                Built-in Deep Engine
              </span>
              {provider === "builtin" && (
                <span className="w-2 h-2 rounded-full bg-purple-600 ring-4 ring-purple-100" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              No API key required. High-speed heuristic analysis, lead seniority profiling, and deliverability optimization.
            </p>
            <Badge variant="secondary" className="mt-3 bg-emerald-50 text-emerald-700 text-[10px] font-bold">
              Included &amp; Ready
            </Badge>
          </div>

          {/* OpenAI Option */}
          <div
            onClick={() => setProvider("openai")}
            className={`cursor-pointer rounded-xl border p-4 transition-all relative ${
              provider === "openai"
                ? "border-purple-600 bg-purple-50/50 ring-2 ring-purple-600/20"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-emerald-600" />
                OpenAI (GPT-4o)
              </span>
              {provider === "openai" && (
                <span className="w-2 h-2 rounded-full bg-purple-600 ring-4 ring-purple-100" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Direct OpenAI API connection for deep LLM synthesis, custom tone modulation, and live web insights.
            </p>
            <Badge variant="secondary" className="mt-3 bg-slate-100 text-slate-600 text-[10px] font-bold">
              BYO API Key
            </Badge>
          </div>

          {/* Gemini Option */}
          <div
            onClick={() => setProvider("gemini")}
            className={`cursor-pointer rounded-xl border p-4 transition-all relative ${
              provider === "gemini"
                ? "border-purple-600 bg-purple-50/50 ring-2 ring-purple-600/20"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Google Gemini
              </span>
              {provider === "gemini" && (
                <span className="w-2 h-2 rounded-full bg-purple-600 ring-4 ring-purple-100" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Google Gemini 1.5 Pro multimodal synthesis with enterprise security and speed.
            </p>
            <Badge variant="secondary" className="mt-3 bg-slate-100 text-slate-600 text-[10px] font-bold">
              BYO API Key
            </Badge>
          </div>
        </div>

        {/* API Key Field (if not builtin) */}
        {provider !== "builtin" && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-500" />
              {provider === "openai" ? "OpenAI API Key" : "Google Gemini API Key"}
            </label>
            <div className="relative max-w-lg">
              <Input
                type={showApiKey ? "text" : "password"}
                placeholder={provider === "openai" ? "sk-proj-..." : "AIzaSy..."}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Keys are encrypted at rest with AES-256 and never logged or exposed in client bundles.
            </p>
          </div>
        )}
      </div>

      {/* Default Pitch & Positioning */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-purple-600" />
            Default Company Value Proposition &amp; Pitch
          </h3>
          <p className="text-xs text-slate-500">
            The AI engine automatically incorporates this value proposition into synthesized lead outreach when specific custom pitches are not provided.
          </p>
        </div>

        <div>
          <textarea
            rows={3}
            value={defaultCompanyPitch}
            onChange={(e) => setDefaultCompanyPitch(e.target.value)}
            placeholder="e.g. We help mid-market and enterprise businesses eliminate missed lead follow-ups and scale deals with intelligent sales automation."
            className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 resize-none"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Recommended length: 1–3 clear sentences highlighting the main problem you solve and the tangible business outcome.
          </p>
        </div>
      </div>

      {/* Autonomous Cadence & Pacing Defaults */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-purple-600" />
            Default Autonomous Cadence &amp; Deliverability Pacing
          </h3>
          <p className="text-xs text-slate-500">
            Control default intervals between leads to protect sender reputation and avoid spam filters.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Send Pacing Interval (Minutes)</span>
            </label>
            <Input
              type="number"
              min={1}
              max={60}
              value={defaultPacingMinutes}
              onChange={(e) => setDefaultPacingMinutes(Number(e.target.value))}
              className="text-xs h-9"
            />
            <p className="text-[11px] text-slate-400">
              Spacing between individual email dispatches. Recommended: 2–5 minutes.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Automated Step 2 Follow-Up (Days)</span>
            </label>
            <Input
              type="number"
              min={1}
              max={30}
              value={defaultFollowUpDays}
              onChange={(e) => setDefaultFollowUpDays(Number(e.target.value))}
              className="text-xs h-9"
            />
            <p className="text-[11px] text-slate-400">
              Days to wait before sending a contextual follow-up if no reply was detected. Recommended: 3–5 days.
            </p>
          </div>
        </div>

        <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-start gap-2 text-xs text-purple-900">
          <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="font-semibold">Automatic Reply Detection &amp; Sequence Kill-Switch</strong>
            <p className="text-[11px] text-purple-700">
              When a lead replies via email or a sales rep logs a reply in the lead&apos;s timeline, the AI queue automatically halts any pending follow-ups for that lead.
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs px-5 h-9 shadow-xs"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              <span>Saving Changes...</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              <span>Save AI Settings</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
