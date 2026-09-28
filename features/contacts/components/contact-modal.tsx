"use client";

import { useState, useEffect, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createContactAction, updateContactAction } from "@/actions/contacts";
import type { ContactFormData } from "@/lib/validations/contacts";
import { getCompaniesAction } from "@/actions/companies";
import type { CompanyItem } from "@/lib/validations/companies";
import { Building2 } from "lucide-react";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contactToEdit?: (ContactFormData & { id: string }) | null;
  defaultCompanyId?: string;
}

export function ContactModal({
  isOpen,
  onClose,
  onSuccess,
  contactToEdit,
  defaultCompanyId,
}: ContactModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [companyMode, setCompanyMode] = useState<"select" | "create">("select");

  const [formData, setFormData] = useState<ContactFormData>({
    firstName: contactToEdit?.firstName || "",
    lastName: contactToEdit?.lastName || "",
    email: contactToEdit?.email || "",
    phone: contactToEdit?.phone || "",
    alternatePhone: contactToEdit?.alternatePhone || "",
    jobTitle: contactToEdit?.jobTitle || "",
    department: contactToEdit?.department || "",
    linkedinUrl: contactToEdit?.linkedinUrl || "",
    instagramUrl: (contactToEdit as any)?.instagramUrl || "",
    companyId: contactToEdit?.companyId || defaultCompanyId || "",
    newCompanyName: "",
    newCompanyWebsite: "",
    address: contactToEdit?.address || "",
  });

  // Synchronize form fields whenever modal opens or contactToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setCompanyMode("select");

    if (contactToEdit) {
      setFormData({
        firstName: contactToEdit.firstName || "",
        lastName: contactToEdit.lastName || "",
        email: contactToEdit.email || "",
        phone: contactToEdit.phone || "",
        alternatePhone: (contactToEdit as any).alternatePhone || "",
        jobTitle: contactToEdit.jobTitle || "",
        department: contactToEdit.department || "",
        linkedinUrl: (contactToEdit as any).linkedinUrl || "",
        instagramUrl: (contactToEdit as any).instagramUrl || "",
        companyId: contactToEdit.companyId || defaultCompanyId || "",
        newCompanyName: "",
        newCompanyWebsite: "",
        address: (contactToEdit as any).address || "",
      });
    } else {
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        alternatePhone: "",
        jobTitle: "",
        department: "",
        linkedinUrl: "",
        instagramUrl: "",
        companyId: defaultCompanyId || "",
        newCompanyName: "",
        newCompanyWebsite: "",
        address: "",
      });
    }
  }, [isOpen, contactToEdit, defaultCompanyId]);

  useEffect(() => {
    async function loadCompanies() {
      const res = await getCompaniesAction({ limit: 100 });
      if (res.success && res.data) {
        setCompanies(res.data.items);
      }
    }
    if (isOpen) {
      loadCompanies();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (companyMode === "create" && (!formData.newCompanyName || !formData.newCompanyName.trim())) {
      setError("Please provide a company name when creating a new company.");
      return;
    }

    startTransition(async () => {
      try {
        const payload: ContactFormData = {
          ...formData,
          companyId: companyMode === "select" ? (formData.companyId || "") : "",
          newCompanyName: companyMode === "create" ? (formData.newCompanyName?.trim() || "") : "",
          newCompanyWebsite: companyMode === "create" ? (formData.newCompanyWebsite?.trim() || "") : "",
        };

        let result;
        if (contactToEdit) {
          result = await updateContactAction(contactToEdit.id, payload);
        } else {
          result = await createContactAction(payload);
        }

        if (result?.success) {
          onSuccess();
          onClose();
        } else {
          setError(result?.error || "Failed to save contact");
        }
      } catch (err: any) {
        setError(err?.message || "An unexpected error occurred while saving contact");
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={contactToEdit ? "Edit Contact" : "Add New Contact"}
      description="Record key client decision-makers, title, and communication channels."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              First Name <span className="text-red-500">*</span>
            </label>
            <Input
              required
              placeholder="e.g. Sarah"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Last Name</label>
            <Input
              placeholder="e.g. Connor"
              value={formData.lastName || ""}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Email Address</label>
            <Input
              type="email"
              placeholder="s.connor@example.com"
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
            <label className="text-xs font-semibold text-slate-700">Job Title</label>
            <Input
              placeholder="e.g. VP of Engineering"
              value={formData.jobTitle || ""}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Department</label>
            <Input
              placeholder="e.g. Technology, Operations"
              value={formData.department || ""}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            />
          </div>

          {/* Company Selector or Inline Creator */}
          <div className="sm:col-span-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-semibold text-slate-800">Company Account</span>
              </div>
              <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5 text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCompanyMode("select");
                    setFormData((prev) => ({ ...prev, newCompanyName: "", newCompanyWebsite: "" }));
                  }}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    companyMode === "select"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Select Existing Company
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCompanyMode("create");
                    setFormData((prev) => ({ ...prev, companyId: "" }));
                  }}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    companyMode === "create"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  + Add New Company
                </button>
              </div>
            </div>

            {companyMode === "select" ? (
              <div className="space-y-1">
                <select
                  value={formData.companyId || ""}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="">No Company (Standalone Contact)</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Select an existing organization or click &quot;+ Add New Company&quot; to add a new one directly.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      required={companyMode === "create"}
                      placeholder="e.g. Acme Corporation"
                      value={formData.newCompanyName || ""}
                      onChange={(e) => setFormData({ ...formData, newCompanyName: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Company Website</label>
                    <Input
                      placeholder="e.g. https://acme.com"
                      value={formData.newCompanyWebsite || ""}
                      onChange={(e) => setFormData({ ...formData, newCompanyWebsite: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  This company will be saved to your Companies directory automatically. Additional company details can be added anytime in the Companies tab.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">LinkedIn Profile</label>
            <Input
              placeholder="https://linkedin.com/in/username"
              value={formData.linkedinUrl || ""}
              onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Instagram Profile / URL</label>
            <Input
              placeholder="https://instagram.com/username or @username"
              value={formData.instagramUrl || ""}
              onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : contactToEdit ? "Update Contact" : "Create Contact"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
