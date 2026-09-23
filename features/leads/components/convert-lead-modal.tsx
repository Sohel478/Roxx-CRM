"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Building2,
  User,
  Kanban,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCompaniesAction, CompanyItem } from "@/actions/companies";
import { convertLeadAction } from "@/actions/lead-conversion";
import {
  ConversionFormData,
  ConversionResult,
} from "@/lib/validations/lead-conversion";

interface ConvertLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: ConversionResult) => void;
  lead: {
    id: string;
    leadNumber: string;
    firstName: string;
    lastName?: string | null;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    companyName?: string | null;
    jobTitle?: string | null;
    estimatedValue: number;
    currency?: string;
  };
}

export function ConvertLeadModal({
  isOpen,
  onClose,
  onSuccess,
  lead,
}: ConvertLeadModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [existingCompanies, setExistingCompanies] = useState<CompanyItem[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);

  // Form states
  const [companyMode, setCompanyMode] = useState<"NEW" | "EXISTING">("NEW");
  const [companyName, setCompanyName] = useState(lead.companyName || "");
  const [companyId, setCompanyId] = useState("");

  const [contactFirstName, setContactFirstName] = useState(lead.firstName || "");
  const [contactLastName, setContactLastName] = useState(lead.lastName || "");
  const [contactEmail, setContactEmail] = useState(lead.email || "");
  const [contactPhone, setContactPhone] = useState(lead.phone || "");
  const [contactJobTitle, setContactJobTitle] = useState(lead.jobTitle || "");

  const [createOpportunity, setCreateOpportunity] = useState(true);
  const [opportunityName, setOpportunityName] = useState(
    `${lead.companyName || lead.fullName} - Initial Deal`
  );
  const [opportunityAmount, setOpportunityAmount] = useState<number>(lead.estimatedValue || 0);
  const [opportunityStage, setOpportunityStage] = useState("Qualified");

  // Default close date +30 days
  const defaultCloseDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  };
  const [expectedCloseDate, setExpectedCloseDate] = useState(defaultCloseDate());

  // Fetch companies for "EXISTING" mode
  useEffect(() => {
    if (!isOpen) return;

    // Reset pre-fills with latest lead props
    setCompanyName(lead.companyName || "");
    setContactFirstName(lead.firstName || "");
    setContactLastName(lead.lastName || "");
    setContactEmail(lead.email || "");
    setContactPhone(lead.phone || "");
    setContactJobTitle(lead.jobTitle || "");
    setOpportunityName(`${lead.companyName || lead.fullName} - Initial Deal`);
    setOpportunityAmount(lead.estimatedValue || 0);
    setError(null);

    setIsLoadingCompanies(true);
    getCompaniesAction({ limit: 100 })
      .then((res) => {
        if (res.success && res.data) {
          setExistingCompanies(res.data.items);
          if (res.data.items.length > 0) {
            setCompanyId(res.data.items[0].id);
          }
        }
      })
      .finally(() => setIsLoadingCompanies(false));
  }, [isOpen, lead]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: ConversionFormData = {
      companyMode,
      companyName: companyMode === "NEW" ? companyName.trim() : undefined,
      companyId: companyMode === "EXISTING" ? companyId : undefined,
      contactFirstName: contactFirstName.trim(),
      contactLastName: contactLastName.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      contactJobTitle: contactJobTitle.trim() || undefined,
      createOpportunity,
      opportunityName: createOpportunity ? opportunityName.trim() : undefined,
      opportunityAmount: createOpportunity ? Number(opportunityAmount) || 0 : 0,
      opportunityStage,
      expectedCloseDate: createOpportunity && expectedCloseDate ? expectedCloseDate : undefined,
    };

    startTransition(async () => {
      const res = await convertLeadAction(lead.id, payload);
      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
      } else {
        setError(res.error || "Failed to convert lead. Please try again.");
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Convert Lead to Account"
      description={`Transform ${lead.fullName} into a permanent customer account, contact, and opportunity.`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Company Account */}
        <div className="bg-slate-50/75 rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                1. Company Account
              </h3>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCompanyMode("NEW")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  companyMode === "NEW"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Create New
              </button>
              <button
                type="button"
                onClick={() => setCompanyMode("EXISTING")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  companyMode === "EXISTING"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Link Existing
              </button>
            </div>
          </div>

          {companyMode === "NEW" ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corporation"
                required
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Existing Company <span className="text-red-500">*</span>
              </label>
              {isLoadingCompanies ? (
                <div className="text-xs text-slate-400 py-2">Loading companies...</div>
              ) : existingCompanies.length === 0 ? (
                <div className="text-xs text-amber-600 py-1">
                  No existing companies found. Please switch to &quot;Create New&quot;.
                </div>
              ) : (
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  required
                >
                  {existingCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city ? `${c.city}, ` : ""}{c.country || "Active"})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Section 2: Primary Contact */}
        <div className="bg-slate-50/75 rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              2. Primary Contact
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={contactFirstName}
                onChange={(e) => setContactFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Last Name
              </label>
              <Input
                value={contactLastName}
                onChange={(e) => setContactLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Job Title
              </label>
              <Input
                value={contactJobTitle}
                onChange={(e) => setContactJobTitle(e.target.value)}
                placeholder="e.g. VP of Operations"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Opportunity / Deal */}
        <div className="bg-slate-50/75 rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Kanban className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                3. Sales Opportunity
              </h3>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={createOpportunity}
                onChange={(e) => setCreateOpportunity(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span>Create Deal</span>
            </label>
          </div>

          {createOpportunity && (
            <div className="space-y-3 pt-1 border-t border-slate-200/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deal Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={opportunityName}
                    onChange={(e) => setOpportunityName(e.target.value)}
                    required={createOpportunity}
                    placeholder="e.g. Acme - Enterprise License"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deal Amount (USD) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={opportunityAmount}
                    onChange={(e) => setOpportunityAmount(Number(e.target.value))}
                    required={createOpportunity}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pipeline Stage
                  </label>
                  <select
                    value={opportunityStage}
                    onChange={(e) => setOpportunityStage(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  >
                    <option value="New">New</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Discovery">Discovery</option>
                    <option value="Proposal">Proposal</option>
                    <option value="Negotiation">Negotiation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Close Date
                  </label>
                  <Input
                    type="date"
                    value={expectedCloseDate}
                    onChange={(e) => setExpectedCloseDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Informational Banner */}
        <div className="p-3.5 bg-blue-50/60 border border-blue-200/70 rounded-xl flex items-start gap-2.5 text-xs text-blue-800 leading-relaxed">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Atomic Transaction Guarantee:</span> When you
            confirm, the Lead will be permanently marked as <strong>Converted</strong>. All records
            are linked together immediately. If any step fails, no data is altered.
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isPending ? "Converting..." : "Confirm & Convert Lead"}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
