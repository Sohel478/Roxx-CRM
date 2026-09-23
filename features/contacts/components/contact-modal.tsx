"use client";

import { useState, useEffect, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createContactAction, updateContactAction, ContactFormData } from "@/actions/contacts";
import { getCompaniesAction, CompanyItem } from "@/actions/companies";

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

  const [formData, setFormData] = useState<ContactFormData>({
    firstName: contactToEdit?.firstName || "",
    lastName: contactToEdit?.lastName || "",
    email: contactToEdit?.email || "",
    phone: contactToEdit?.phone || "",
    alternatePhone: contactToEdit?.alternatePhone || "",
    jobTitle: contactToEdit?.jobTitle || "",
    department: contactToEdit?.department || "",
    linkedinUrl: contactToEdit?.linkedinUrl || "",
    companyId: contactToEdit?.companyId || defaultCompanyId || "",
    address: contactToEdit?.address || "",
  });

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

    startTransition(async () => {
      let result;
      if (contactToEdit) {
        result = await updateContactAction(contactToEdit.id, formData);
      } else {
        result = await createContactAction(formData);
      }

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || "Failed to save contact");
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
            <label className="text-xs font-semibold text-slate-700">Company Account</label>
            <select
              value={formData.companyId || ""}
              onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
              className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">No Company (Standalone Contact)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Department</label>
            <Input
              placeholder="e.g. Technology, Operations"
              value={formData.department || ""}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">LinkedIn Profile</label>
            <Input
              type="url"
              placeholder="https://linkedin.com/in/username"
              value={formData.linkedinUrl || ""}
              onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
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
