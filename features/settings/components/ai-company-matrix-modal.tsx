"use client";

import { useState, useTransition } from "react";
import {
  Globe,
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  ShieldAlert,
  Award,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import {
  extractCompanyMatrixFromUrlAction,
  extractCompanyMatrixFromFileAction,
} from "@/actions/company-matrix";
import type { CompanyMatrix } from "@/lib/validations/marketing";

interface AiCompanyMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyMatrix: (extractedMatrix: CompanyMatrix) => void;
}

export function AiCompanyMatrixModal({
  isOpen,
  onClose,
  onApplyMatrix,
}: AiCompanyMatrixModalProps) {
  const [activeTab, setActiveTab] = useState<"url" | "file">("url");
  const [urlInput, setUrlInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isExtracting, startExtracting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [extractedMatrix, setExtractedMatrix] = useState<CompanyMatrix | null>(null);
  const [extractedPreview, setExtractedPreview] = useState<string | null>(null);

  const handleExtractUrl = () => {
    if (!urlInput.trim()) {
      setError("Please enter a valid website URL (e.g., https://mycompany.com)");
      return;
    }

    setError(null);
    startExtracting(async () => {
      try {
        const res = await extractCompanyMatrixFromUrlAction({ url: urlInput.trim() });
        if (res.success && res.matrix) {
          setExtractedMatrix(res.matrix);
          setExtractedPreview(res.extractedTextPreview || null);
        } else {
          setError(res.error || "Failed to extract capabilities from the provided URL.");
        }
      } catch (err: unknown) {
        setError((err as Error)?.message || "Network or server error during URL analysis.");
      }
    });
  };

  const handleExtractFile = () => {
    if (!selectedFile) {
      setError("Please choose a company PDF, portfolio deck, or text file to upload.");
      return;
    }

    setError(null);
    startExtracting(async () => {
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const res = await extractCompanyMatrixFromFileAction(formData);
        if (res.success && res.matrix) {
          setExtractedMatrix(res.matrix);
          setExtractedPreview(res.extractedTextPreview || null);
        } else {
          setError(res.error || "Failed to extract capabilities from the uploaded file.");
        }
      } catch (err: unknown) {
        setError((err as Error)?.message || "Failed to upload and parse document.");
      }
    });
  };

  const handleApply = () => {
    if (extractedMatrix) {
      onApplyMatrix(extractedMatrix);
      onClose();
    }
  };

  const resetState = () => {
    setExtractedMatrix(null);
    setExtractedPreview(null);
    setError(null);
    setUrlInput("");
    setSelectedFile(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetState();
        onClose();
      }}
      title="Auto-Extract Company Capabilities & Skillset Matrix"
      description="Feed your website URL or upload a company/portfolio PDF deck. AI will automatically parse your core offerings, skills, case studies, and out-of-scope boundaries."
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Tabs */}
        {!extractedMatrix && (
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setActiveTab("url");
                setError(null);
              }}
              className={`flex items-center gap-2 pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "url"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Globe className="w-4 h-4" />
              Website URL
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("file");
                setError(null);
              }}
              className={`flex items-center gap-2 pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "file"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileText className="w-4 h-4" />
              Upload PDF / Deck / Document
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Input Mode */}
        {!extractedMatrix && (
          <div className="space-y-4">
            {activeTab === "url" ? (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Company or Agency Website URL
                </label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://yourcompany.com"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    disabled={isExtracting}
                    className="text-xs h-10"
                  />
                  <Button
                    type="button"
                    onClick={handleExtractUrl}
                    disabled={isExtracting || !urlInput.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-10 px-4 shrink-0 shadow-xs"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Extract Matrix
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500">
                  AI will scrape your homepage, about, and services sections to identify your verified capabilities, tech stacks, and industries.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Company Profile, Portfolio Deck, or Pitch PDF
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-purple-300 transition-colors bg-slate-50/50">
                  <Upload className="w-8 h-8 text-purple-600 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-medium text-slate-700 mb-1">
                    {selectedFile ? selectedFile.name : "Select or drag & drop your company document"}
                  </p>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Supports .pdf, .txt, or .md files (up to 10MB)
                  </p>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept=".pdf,.txt,.md"
                      disabled={isExtracting}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setSelectedFile(file);
                      }}
                    />
                    <span className="cursor-pointer bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-xs px-3 py-1.5 rounded-lg shadow-xs transition-colors">
                      Browse File
                    </span>
                  </label>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={handleExtractFile}
                    disabled={isExtracting || !selectedFile}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-10 px-5 shadow-xs"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Parsing Document...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Synthesize Deck
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Extracted Result Preview */}
        {extractedMatrix && (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">
                  Capabilities synthesized successfully! Review below before applying.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExtractedMatrix(null)}
                className="text-xs text-emerald-700 underline hover:text-emerald-900"
              >
                Scan Another
              </button>
            </div>

            {/* Elevator Pitch */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Synthesized Elevator Pitch:
              </span>
              <p className="text-xs text-slate-800 font-medium leading-relaxed">
                {extractedMatrix.elevatorPitch}
              </p>
            </div>

            {/* Grid of Extracted Capabilities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Service Offerings */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                  Service Offerings ({extractedMatrix.serviceOfferings.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {extractedMatrix.serviceOfferings.map((svc, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-[11px] font-medium"
                    >
                      {svc}
                    </span>
                  ))}
                </div>
              </div>

              {/* Core Skillsets */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Core Skillsets / Tech ({extractedMatrix.coreSkillsets.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {extractedMatrix.coreSkillsets.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[11px] font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Target Industries */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  Target Industries ({extractedMatrix.targetIndustries.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {extractedMatrix.targetIndustries.map((ind, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[11px] font-medium"
                    >
                      {ind}
                    </span>
                  ))}
                </div>
              </div>

              {/* Out-of-Scope Exclusions */}
              <div className="bg-white p-3 rounded-xl border border-rose-200 space-y-2">
                <span className="font-bold text-rose-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  Out-of-Scope Exclusions ({extractedMatrix.outOfScopeExclusions?.length || 0})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {extractedMatrix.outOfScopeExclusions?.map((excl, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-[11px] font-medium"
                    >
                      {excl}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  AI will strictly avoid offering these services to leads.
                </p>
              </div>
            </div>

            {/* Case Studies */}
            {extractedMatrix.caseStudies && extractedMatrix.caseStudies.length > 0 && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  Identified Proof Points &amp; Case Studies ({extractedMatrix.caseStudies.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {extractedMatrix.caseStudies.map((cs, i) => (
                    <div
                      key={cs.id || i}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{cs.title}</span>
                        {cs.metric && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                            {cs.metric}
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-600 text-[10px] leading-relaxed">{cs.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExtractedMatrix(null)}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleApply}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-9 px-4 gap-1.5 shadow-xs"
              >
                <span>Apply to Company Matrix</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
