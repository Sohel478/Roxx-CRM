"use client";

import { useState, useEffect, useTransition } from "react";
import { AlertTriangle, Flame, Snowflake, Zap } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createLeadAction, updateLeadAction, checkLeadDuplicateAction, LeadFormData } from "@/actions/leads";

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leadToEdit?: (LeadFormData & { id: string }) | null;
}

export function LeadModal({ isOpen, onClose, onSuccess, leadToEdit }: LeadModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);

  const [formData, setFormData] = useState<LeadFormData>({
    firstName: leadToEdit?.firstName || "",
    lastName: leadToEdit?.lastName || "",
    email: leadToEdit?.email || "",
    phone: leadToEdit?.phone || "",
    companyName: leadToEdit?.companyName || "",
    jobTitle: leadToEdit?.jobTitle || "",
    source: leadToEdit?.source || "Website",
    status: (leadToEdit?.status as any) || "New",
    rating: (leadToEdit?.rating as any) || "Warm",
    estimatedValue: leadToEdit?.estimatedValue || 0,
    currency: leadToEdit?.currency || "USD",
    description: leadToEdit?.description || "",
  });

  // Duplicate detection debounced check
  useEffect(() => {
    if (!isOpen || leadToEdit) return;

    const timer = setTimeout(async () => {
      if (formData.email || formData.phone) {
        const res = await checkLeadDuplicateAction({
          email: formData.email,
          phone: formData.phone,
        });
        if (res.isDuplicate && res.match) {
          setDuplicateWarning(res.match);
        } else {
          setDuplicateWarning(null);
        }
      } else {
        setDuplicateWarning(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.email, formData.phone, isOpen, leadToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      let result;
      if (leadToEdit) {
        result = await updateLeadAction(leadToEdit.id, formData);
      } else {
        result = await createLeadAction(formData);
      }

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || "Failed to save lead");
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={leadToEdit ? "Edit Sales Lead" : "Capture New Lead"}
      description="Record lead contact information, source, qualification status, and potential value."
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Duplicate Warning Alert */}
        {duplicateWarning && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-800 text-xs animate-in fade-in duration-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Potential Duplicate Lead Detected</p>
              <p className="mt-0.5 text-amber-700">
                A lead with this contact information already exists:{" "}
                <span className="font-bold">{duplicateWarning.name}</span>
                {duplicateWarning.companyName ? ` at ${duplicateWarning.companyName}` : ""} (
                {duplicateWarning.leadNumber}). You may still proceed if this is an intentional new lead.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              First Name <span className="text-red-500">*</span>
            </label>
            <Input
              required
              placeholder="e.g. Elena"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Last Name</label>
            <Input
              placeholder="e.g. Rostova"
              value={formData.lastName || ""}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Email Address</label>
            <Input
              type="email"
              placeholder="elena@company.com"
              value={formData.email || ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Phone Number</label>
            <Input
              placeholder="+1 (555) 000-0000"
              value={formData.phone || ""}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Company Name</label>
            <Input
              placeholder="e.g. Cyberdyne Systems"
              value={formData.companyName || ""}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Job Title</label>
            <Input
              placeholder="e.g. Director of Operations"
              value={formData.jobTitle || ""}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Lead Source</label>
            <select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="Website">Website</option>
              <option value="Referral">Referral</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Cold Email">Cold Email</option>
              <option value="Google">Google Search</option>
              <option value="Facebook">Facebook</option>
              <option value="Instagram">Instagram</option>
              <option value="Upwork">Upwork</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Initial Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Unqualified">Unqualified</option>
              <option value="Nurture">Nurture</option>
              <option value="Lost">Lost</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Rating / Temperature</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, rating: "Hot" })}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                  formData.rating === "Hot"
                    ? "bg-red-50 text-red-700 border-red-300 ring-2 ring-red-400/20"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-red-500" />
                <span>Hot</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, rating: "Warm" })}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                  formData.rating === "Warm"
                    ? "bg-amber-50 text-amber-700 border-amber-300 ring-2 ring-amber-400/20"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Warm</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, rating: "Cold" })}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                  formData.rating === "Cold"
                    ? "bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-400/20"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Snowflake className="w-3.5 h-3.5 text-blue-500" />
                <span>Cold</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Estimated Deal Value ($)</label>
            <Input
              type="number"
              min="0"
              step="100"
              placeholder="0"
              value={formData.estimatedValue}
              onChange={(e) => setFormData({ ...formData, estimatedValue: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700">Lead Description &amp; Context</label>
            <textarea
              rows={3}
              placeholder="Customer needs, pain points, budget authority, timeline notes..."
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : leadToEdit ? "Update Lead" : "Create Lead"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
