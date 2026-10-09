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
  Globe,
  Plus,
  X,
  FileText,
  Upload,
  Award,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAiConfigAction, saveAiConfigAction, testAiConnectionAction } from "@/actions/ai-email";
import { getCompanyMatrixAction, saveCompanyMatrixAction } from "@/actions/company-matrix";
import { AiCompanyMatrixModal } from "./ai-company-matrix-modal";
import type {
  AiConfigInput,
  CompanyMatrix,
  CompanyCaseStudy,
} from "@/lib/validations/marketing";

export function AiSettingsTab() {
  const [provider, setProvider] = useState<"builtin" | "openai" | "gemini">("builtin");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [defaultCompanyPitch, setDefaultCompanyPitch] = useState("");
  const [defaultFollowUpDays, setDefaultFollowUpDays] = useState(3);
  const [defaultPacingMinutes, setDefaultPacingMinutes] = useState(2);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestResult({
        success: false,
        message: "Please enter an API key before testing.",
      });
      return;
    }
    setIsTestingKey(true);
    setTestResult(null);
    try {
      const res = await testAiConnectionAction({
        provider,
        apiKey: apiKey.trim(),
      });
      if (res.success) {
        setTestResult({
          success: true,
          message: res.message || "Connection successful!",
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || "Connection test failed.",
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.message || "Failed to reach AI provider.",
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Company Matrix State
  const [matrix, setMatrix] = useState<CompanyMatrix>({
    websiteUrl: null,
    elevatorPitch: "",
    coreSkillsets: [],
    serviceOfferings: [],
    targetIndustries: [],
    caseStudies: [],
    outOfScopeExclusions: [],
  });

  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [newService, setNewService] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [newExclusion, setNewExclusion] = useState("");

  // New Case Study form state
  const [isAddingCaseStudy, setIsAddingCaseStudy] = useState(false);
  const [newCsTitle, setNewCsTitle] = useState("");
  const [newCsMetric, setNewCsMetric] = useState("");
  const [newCsSummary, setNewCsSummary] = useState("");
  const [newCsIndustry, setNewCsIndustry] = useState("");

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
        const [configRes, matrixRes] = await Promise.all([
          getAiConfigAction(),
          getCompanyMatrixAction(),
        ]);

        if (configRes.success && configRes.data) {
          const cfg = configRes.data;
          setProvider(cfg.aiProvider || "builtin");
          setApiKey(cfg.apiKey || "");
          setDefaultCompanyPitch(cfg.defaultCompanyPitch || "");
          setDefaultFollowUpDays(cfg.defaultFollowUpDays || 3);
          setDefaultPacingMinutes(cfg.defaultPacingMinutes || 2);
        }

        if (matrixRes.success && matrixRes.data) {
          setMatrix(matrixRes.data);
          if (matrixRes.data.elevatorPitch && !defaultCompanyPitch) {
            setDefaultCompanyPitch(matrixRes.data.elevatorPitch);
          }
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

      const updatedMatrix: CompanyMatrix = {
        ...matrix,
        elevatorPitch: defaultCompanyPitch.trim() || matrix.elevatorPitch,
      };

      try {
        const [configRes, matrixRes] = await Promise.all([
          saveAiConfigAction(input),
          saveCompanyMatrixAction(updatedMatrix),
        ]);

        if (configRes.success && matrixRes.success) {
          setStatusMessage({
            type: "success",
            text: "AI configuration and Company Capabilities Matrix updated successfully.",
          });
          setTimeout(() => setStatusMessage(null), 4000);
        } else {
          setStatusMessage({
            type: "error",
            text: configRes.error || matrixRes.error || "Failed to update configuration.",
          });
        }
      } catch (err: unknown) {
        setStatusMessage({
          type: "error",
          text: (err as Error)?.message || "An unexpected error occurred while saving.",
        });
      }
    });
  };

  // Matrix Tag Handlers
  const addTag = (
    field: "coreSkillsets" | "serviceOfferings" | "targetIndustries" | "outOfScopeExclusions",
    value: string,
    clearInput: () => void
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!matrix[field]?.includes(trimmed)) {
      setMatrix((prev) => ({
        ...prev,
        [field]: [...(prev[field] || []), trimmed],
      }));
    }
    clearInput();
  };

  const removeTag = (
    field: "coreSkillsets" | "serviceOfferings" | "targetIndustries" | "outOfScopeExclusions",
    itemToRemove: string
  ) => {
    setMatrix((prev) => ({
      ...prev,
      [field]: prev[field]?.filter((item) => item !== itemToRemove) || [],
    }));
  };

  const handleAddCaseStudy = () => {
    if (!newCsTitle.trim() || !newCsSummary.trim()) return;

    const newCs: CompanyCaseStudy = {
      id: `cs_${Date.now()}`,
      title: newCsTitle.trim(),
      metric: newCsMetric.trim() || undefined,
      summary: newCsSummary.trim(),
      industry: newCsIndustry.trim() || undefined,
    };

    setMatrix((prev) => ({
      ...prev,
      caseStudies: [...(prev.caseStudies || []), newCs],
    }));

    setNewCsTitle("");
    setNewCsMetric("");
    setNewCsSummary("");
    setNewCsIndustry("");
    setIsAddingCaseStudy(false);
  };

  const handleRemoveCaseStudy = (id?: string, index?: number) => {
    setMatrix((prev) => ({
      ...prev,
      caseStudies: prev.caseStudies?.filter((cs, i) => (id ? cs.id !== id : i !== index)) || [],
    }));
  };

  const handleApplyExtractedMatrix = (extracted: CompanyMatrix) => {
    setMatrix(extracted);
    if (extracted.elevatorPitch) {
      setDefaultCompanyPitch(extracted.elevatorPitch);
    }
    setStatusMessage({
      type: "success",
      text: "Capabilities extracted! Verify the pills below and click 'Save AI Settings' to lock them in.",
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
            AI Capabilities Matrix &amp; Autonomous Outreach
          </h2>
          <p className="text-xs text-purple-200/80 leading-relaxed">
            Train the AI on your exact technical capabilities, services, industries, and case studies. The AI will strictly match each lead&apos;s department with your verified skillset at the same peer level and never pitch out-of-scope services.
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
            
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTestingKey || !apiKey.trim()}
                className="text-xs h-8 border-slate-300 hover:bg-slate-50 gap-1.5 font-medium shadow-2xs"
              >
                {isTestingKey ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                )}
                <span>Test Connection</span>
              </Button>

              {testResult && (
                <div
                  className={`text-xs flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-lg border ${
                    testResult.success
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              Keys are encrypted at rest with AES-256 and never logged or exposed in client bundles.
            </p>
          </div>
        )}
      </div>

      {/* COMPANY CAPABILITIES & SKILLSET MATRIX */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-purple-600" />
              Company Capabilities &amp; Skillset Matrix
            </h3>
            <p className="text-xs text-slate-500 max-w-xl">
              Defines what your organization offers, core tech stacks, and hard out-of-scope boundaries. The AI references this matrix so every lead receives emails grounded in your real expertise.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setIsMatrixModalOpen(true)}
            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs h-9 px-3.5 gap-2 shrink-0 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Auto-Extract from URL or PDF</span>
          </Button>
        </div>

        {/* Elevator Pitch */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Company Elevator Pitch &amp; Primary Value Proposition
          </label>
          <textarea
            rows={3}
            value={defaultCompanyPitch}
            onChange={(e) => {
              setDefaultCompanyPitch(e.target.value);
              setMatrix((prev) => ({ ...prev, elevatorPitch: e.target.value }));
            }}
            placeholder="e.g. We help mid-market and enterprise businesses eliminate missed lead follow-ups and scale deals with intelligent sales automation."
            className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 resize-none"
          />
          <p className="text-[11px] text-slate-400">
            Used as the high-level hook when framing problems and introducing your organization.
          </p>
        </div>

        {/* Core Skillsets / Tech Stack */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>Core Skillsets &amp; Technical Capabilities</span>
            <span className="text-[11px] text-slate-400 font-normal">
              {matrix.coreSkillsets?.length || 0} skills configured
            </span>
          </label>
          <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 min-h-[50px]">
            {matrix.coreSkillsets?.map((skill, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-800 text-xs rounded-lg font-medium shadow-2xs group"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => removeTag("coreSkillsets", skill)}
                  className="text-slate-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <Input
                type="text"
                placeholder="Add skill (e.g., Python)..."
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag("coreSkillsets", newSkill, () => setNewSkill(""));
                  }
                }}
                className="h-7 text-xs w-40 bg-white"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addTag("coreSkillsets", newSkill, () => setNewSkill(""))}
                className="h-7 px-2 text-xs"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Service Offerings */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>Verified Service Offerings</span>
            <span className="text-[11px] text-slate-400 font-normal">
              {matrix.serviceOfferings?.length || 0} offerings
            </span>
          </label>
          <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 min-h-[50px]">
            {matrix.serviceOfferings?.map((svc, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-800 text-xs rounded-lg font-medium shadow-2xs"
              >
                <span>{svc}</span>
                <button
                  type="button"
                  onClick={() => removeTag("serviceOfferings", svc)}
                  className="text-purple-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <Input
                type="text"
                placeholder="Add offering (e.g., Cloud Migration)..."
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag("serviceOfferings", newService, () => setNewService(""));
                  }
                }}
                className="h-7 text-xs w-44 bg-white"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addTag("serviceOfferings", newService, () => setNewService(""))}
                className="h-7 px-2 text-xs"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Target Industries */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>Target Industries</span>
            <span className="text-[11px] text-slate-400 font-normal">
              {matrix.targetIndustries?.length || 0} industries
            </span>
          </label>
          <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 min-h-[50px]">
            {matrix.targetIndustries?.map((ind, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg font-medium shadow-2xs"
              >
                <span>{ind}</span>
                <button
                  type="button"
                  onClick={() => removeTag("targetIndustries", ind)}
                  className="text-blue-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <Input
                type="text"
                placeholder="Add industry (e.g., Fintech)..."
                value={newIndustry}
                onChange={(e) => setNewIndustry(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag("targetIndustries", newIndustry, () => setNewIndustry(""));
                  }
                }}
                className="h-7 text-xs w-40 bg-white"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addTag("targetIndustries", newIndustry, () => setNewIndustry(""))}
                className="h-7 px-2 text-xs"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Strict Out-of-Scope Exclusions */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-rose-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              Strict Out-of-Scope Exclusions (Guardrails)
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              AI will NEVER pitch or promise these
            </span>
          </label>
          <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-rose-200 bg-rose-50/30 min-h-[50px]">
            {matrix.outOfScopeExclusions?.map((excl, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-medium shadow-2xs"
              >
                <span>{excl}</span>
                <button
                  type="button"
                  onClick={() => removeTag("outOfScopeExclusions", excl)}
                  className="text-rose-400 hover:text-red-700 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <Input
                type="text"
                placeholder="Exclude service (e.g., SEO, Crypto)..."
                value={newExclusion}
                onChange={(e) => setNewExclusion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag("outOfScopeExclusions", newExclusion, () => setNewExclusion(""));
                  }
                }}
                className="h-7 text-xs w-48 bg-white border-rose-200"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addTag("outOfScopeExclusions", newExclusion, () => setNewExclusion(""))}
                className="h-7 px-2 text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Crucial safeguard: prevents the AI from proposing capabilities your company does not provide.
          </p>
        </div>

        {/* Case Studies & Proof Points */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-600" />
                Case Studies &amp; Verified Proof Points ({matrix.caseStudies?.length || 0})
              </span>
              <p className="text-[11px] text-slate-400">
                AI references relevant metrics and stories when pitching leads in corresponding industries.
              </p>
            </div>
            {!isAddingCaseStudy && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddingCaseStudy(true)}
                className="text-xs h-7 gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Case Study</span>
              </Button>
            )}
          </div>

          {/* Add Case Study Form */}
          {isAddingCaseStudy && (
            <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/30 space-y-3 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  type="text"
                  placeholder="Title (e.g. Fintech Pipeline)"
                  value={newCsTitle}
                  onChange={(e) => setNewCsTitle(e.target.value)}
                  className="text-xs h-8 bg-white"
                />
                <Input
                  type="text"
                  placeholder="Metric (e.g. 3.5x Faster Ingestion)"
                  value={newCsMetric}
                  onChange={(e) => setNewCsMetric(e.target.value)}
                  className="text-xs h-8 bg-white"
                />
                <Input
                  type="text"
                  placeholder="Industry (e.g. Fintech)"
                  value={newCsIndustry}
                  onChange={(e) => setNewCsIndustry(e.target.value)}
                  className="text-xs h-8 bg-white"
                />
              </div>
              <textarea
                rows={2}
                placeholder="Brief summary of challenge and concrete outcome achieved..."
                value={newCsSummary}
                onChange={(e) => setNewCsSummary(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingCaseStudy(false)}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCaseStudy}
                  disabled={!newCsTitle.trim() || !newCsSummary.trim()}
                  className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                >
                  Save Case Study
                </Button>
              </div>
            </div>
          )}

          {/* Case Studies List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {matrix.caseStudies?.map((cs, index) => (
              <div
                key={cs.id || index}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{cs.title}</span>
                  <div className="flex items-center gap-1.5">
                    {cs.metric && (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                        {cs.metric}
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveCaseStudy(cs.id, index)}
                      className="text-slate-400 hover:text-red-600 transition-colors ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {cs.industry && (
                  <span className="text-[10px] text-blue-600 font-semibold block">
                    {cs.industry}
                  </span>
                )}
                <p className="text-[11px] text-slate-600 leading-relaxed">{cs.summary}</p>
              </div>
            ))}
          </div>
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

      {/* Auto-Extract Matrix Modal */}
      <AiCompanyMatrixModal
        isOpen={isMatrixModalOpen}
        onClose={() => setIsMatrixModalOpen(false)}
        onApplyMatrix={handleApplyExtractedMatrix}
      />
    </div>
  );
}
