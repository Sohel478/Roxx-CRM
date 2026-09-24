"use client";

import { useState, useEffect, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCompanyAction, updateCompanyAction, CompanyFormData } from "@/actions/companies";

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyToEdit?: (CompanyFormData & { id: string }) | null;
}

export function CompanyModal({ isOpen, onClose, onSuccess, companyToEdit }: CompanyModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CompanyFormData>({
    name: companyToEdit?.name || "",
    industry: companyToEdit?.industry || "",
    website: companyToEdit?.website || "",
    email: companyToEdit?.email || "",
    phone: companyToEdit?.phone || "",
    city: companyToEdit?.city || "",
    country: companyToEdit?.country || "",
    status: (companyToEdit?.status as any) || "Active",
    description: companyToEdit?.description || "",
  });

  // Synchronize form fields whenever modal opens or companyToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    setError(null);

    if (companyToEdit) {
      setFormData({
        name: companyToEdit.name || "",
        industry: companyToEdit.industry || "",
        website: companyToEdit.website || "",
        email: companyToEdit.email || "",
        phone: companyToEdit.phone || "",
        city: companyToEdit.city || "",
        country: companyToEdit.country || "",
        status: (companyToEdit.status as any) || "Active",
        description: (companyToEdit as any).description || "",
      });
    } else {
      setFormData({
        name: "",
        industry: "",
        website: "",
        email: "",
        phone: "",
        city: "",
        country: "",
        status: "Active",
        description: "",
      });
    }
  }, [isOpen, companyToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        let result;
        if (companyToEdit) {
          result = await updateCompanyAction(companyToEdit.id, formData);
        } else {
          result = await createCompanyAction(formData);
        }

        if (result?.success) {
          onSuccess();
          onClose();
        } else {
          setError(result?.error || "Failed to save company");
        }
      } catch (err: any) {
        setError(err?.message || "An unexpected error occurred while saving");
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={companyToEdit ? "Edit Company" : "Add New Company"}
      description="Manage account details, industry, and contact information."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700">
              Company Name <span className="text-red-500">*</span>
            </label>
            <Input
              required
              placeholder="e.g. Acme Corporation"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Industry</label>
            <Input
              placeholder="e.g. Software, Logistics, Healthcare"
              value={formData.industry || ""}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="Active">Active</option>
              <option value="Prospect">Prospect</option>
              <option value="Customer">Customer</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Website</label>
            <Input
              type="url"
              placeholder="https://example.com"
              value={formData.website || ""}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Email</label>
            <Input
              type="email"
              placeholder="info@company.com"
              value={formData.email || ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Phone</label>
            <Input
              placeholder="+1 (555) 000-0000"
              value={formData.phone || ""}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">City / Country</label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="City"
                value={formData.city || ""}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
              <Input
                placeholder="Country"
                value={formData.country || ""}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700">Description / Notes</label>
            <textarea
              rows={3}
              placeholder="Key notes, business model, target requirements..."
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
            {isPending ? "Saving..." : companyToEdit ? "Update Company" : "Create Company"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
