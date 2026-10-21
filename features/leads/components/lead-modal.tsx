"use client";

import { useState, useEffect, useTransition } from "react";
import { AlertTriangle, Flame, Snowflake, Zap, UserCheck, Globe } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createLeadAction, updateLeadAction, checkLeadDuplicateAction } from "@/actions/leads";
import { getCurrentUserAction } from "@/actions/auth";
import { getUsersAction } from "@/actions/users";
import type { LeadFormData, LeadItem } from "@/lib/validations/leads";
import type { SessionUser } from "@/lib/auth/session";
import type { UserItem } from "@/lib/validations/settings";

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead?: LeadItem | null) => void;
  leadToEdit?: (LeadFormData & { id: string; ownerId?: string | null; ownerName?: string | null; website?: string | null }) | null;
  isTechfluxOrg?: boolean;
  defaultStatus?: string;
}

export function LeadModal({
  isOpen,
  onClose,
  onSuccess,
  leadToEdit,
  isTechfluxOrg = false,
  defaultStatus = "New",
}: LeadModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [teamMembers, setTeamMembers] = useState<UserItem[]>([]);

  const roleUpper = currentUser?.role?.toUpperCase();
  const isAdminOrManager =
    roleUpper === "ADMIN" ||
    roleUpper === "ADMINISTRATOR" ||
    roleUpper === "MANAGER" ||
    Boolean(currentUser?.isSuperAdmin);

  const extractWebsite = (l?: (LeadFormData & { id: string; ownerId?: string | null; website?: string | null }) | null) => {
    if (!l) return "";
    if (l.website) return l.website;
    const match = l.description?.match(/Website:\s*([^\s\n\r]+)/i);
    return match ? match[1] : "";
  };

  const [formData, setFormData] = useState<LeadFormData>({
    firstName: leadToEdit?.firstName || "",
    lastName: leadToEdit?.lastName || "",
    email: leadToEdit?.email || "",
    supportEmail: leadToEdit?.supportEmail || "",
    phone: leadToEdit?.phone || "",
    companyName: leadToEdit?.companyName || "",
    jobTitle: leadToEdit?.jobTitle || "",
    website: extractWebsite(leadToEdit),
    companyLinkedin: leadToEdit?.companyLinkedin || "",
    customerLinkedin: leadToEdit?.customerLinkedin || "",
    source: leadToEdit?.source || "Website",
    status: (leadToEdit?.status as any) || (defaultStatus && defaultStatus !== "ALL" ? defaultStatus : "New"),
    rating: (leadToEdit?.rating as any) || "Warm",
    estimatedValue: leadToEdit?.estimatedValue || 0,
    currency: leadToEdit?.currency || "USD",
    description: leadToEdit?.description || "",
    emailStatus: leadToEdit?.emailStatus || "NA",
    ownerId: leadToEdit?.ownerId || undefined,
  });

  useEffect(() => {
    getCurrentUserAction().then((u) => {
      if (u) {
        setCurrentUser(u);
        if (!leadToEdit) {
          setFormData((prev) => ({
            ...prev,
            ownerId: prev.ownerId || u.id,
          }));
        }
        const rUpper = u.role?.toUpperCase();
        if (
          rUpper === "ADMIN" ||
          rUpper === "ADMINISTRATOR" ||
          rUpper === "MANAGER" ||
          u.isSuperAdmin
        ) {
          getUsersAction().then((res) => {
            if (res.success && res.data) {
              setTeamMembers(res.data.filter((member) => member.isActive));
            }
          });
        }
      }
    });
  }, [leadToEdit]);

  // Synchronize form fields whenever modal opens or leadToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setDuplicateWarning(null);

    if (leadToEdit) {
      setFormData({
        firstName: leadToEdit.firstName || "",
        lastName: leadToEdit.lastName || "",
        email: leadToEdit.email || "",
        supportEmail: leadToEdit.supportEmail || "",
        phone: leadToEdit.phone || "",
        companyName: leadToEdit.companyName || "",
        jobTitle: leadToEdit.jobTitle || "",
        website: extractWebsite(leadToEdit),
        companyLinkedin: leadToEdit.companyLinkedin || "",
        customerLinkedin: leadToEdit.customerLinkedin || "",
        source: leadToEdit.source || "Website",
        status: (leadToEdit.status as any) || "New",
        rating: (leadToEdit.rating as any) || "Warm",
        estimatedValue: leadToEdit.estimatedValue || 0,
        currency: leadToEdit.currency || "USD",
        description: leadToEdit.description || "",
        emailStatus: leadToEdit.emailStatus || "NA",
        ownerId: leadToEdit.ownerId || (leadToEdit.ownerId === null ? "UNASSIGNED" : undefined),
      });
    } else {
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        supportEmail: "",
        phone: "",
        companyName: "",
        jobTitle: "",
        website: "",
        companyLinkedin: "",
        customerLinkedin: "",
        source: "Website",
        status: defaultStatus && defaultStatus !== "ALL" ? (defaultStatus as any) : "New",
        rating: "Warm",
        estimatedValue: 0,
        currency: "USD",
        description: "",
        emailStatus: "NA",
        ownerId: currentUser?.id || undefined,
      });
    }
  }, [isOpen, leadToEdit, defaultStatus, currentUser?.id]);

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
      try {
        const isExplicitlyUnassigned = formData.ownerId === "UNASSIGNED" || formData.ownerId === null;
        const targetOwnerId = isExplicitlyUnassigned
          ? null
          : (formData.ownerId || currentUser?.id || undefined);
        const selectedMember = teamMembers.find((m) => m.id === targetOwnerId);
        const resolvedName =
          targetOwnerId === null
            ? null
            : selectedMember?.name ||
              (targetOwnerId === currentUser?.id ? currentUser?.name : undefined);

        const payload: LeadFormData = {
          ...formData,
          ownerId: targetOwnerId,
          ownerName: resolvedName,
        };
        let result;
        if (leadToEdit) {
          result = await updateLeadAction(leadToEdit.id, payload);
        } else {
          result = await createLeadAction(payload);
        }

        if (result?.success) {
          onSuccess(result.data as LeadItem | null);
          onClose();
        } else {
          setError(result?.error || "Failed to save lead");
        }
      } catch (err: any) {
        setError(err?.message || "An unexpected error occurred while saving lead");
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
            <label className="text-xs font-semibold text-slate-700">Customer Email</label>
            <Input
              type="email"
              placeholder="customer@company.com"
              value={formData.email || ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Support Email</label>
            <Input
              type="email"
              placeholder="support@company.com"
              value={formData.supportEmail || ""}
              onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
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
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>Company Website URL</span>
            </label>
            <Input
              type="url"
              placeholder="https://company.com"
              value={formData.website || ""}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
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
            <label className="text-xs font-semibold text-slate-700">Company LinkedIn URL</label>
            <Input
              placeholder="https://linkedin.com/company/..."
              value={formData.companyLinkedin || ""}
              onChange={(e) => setFormData({ ...formData, companyLinkedin: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Customer (User) LinkedIn Profile URL</label>
            <Input
              placeholder="https://linkedin.com/in/..."
              value={formData.customerLinkedin || ""}
              onChange={(e) => setFormData({ ...formData, customerLinkedin: e.target.value })}
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
              {(isTechfluxOrg || formData.status === "Scraped") && (
                <option value="Scraped">Scraped</option>
              )}
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

          {isAdminOrManager && (
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Assign To (Sales Rep / Account Owner)</span>
              </label>
              <select
                value={
                  formData.ownerId === null || formData.ownerId === "UNASSIGNED"
                    ? "UNASSIGNED"
                    : (formData.ownerId || currentUser?.id || "")
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    ownerId: val === "UNASSIGNED" ? "UNASSIGNED" : (val || currentUser?.id || undefined),
                  }));
                }}
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {currentUser && (
                  <option value={currentUser.id}>Assign to Self ({currentUser.name})</option>
                )}
                <option value="UNASSIGNED">Unassigned</option>
                {teamMembers
                  .filter((member) => member.id !== currentUser?.id && member.id !== formData.ownerId)
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} — {member.role.replace(/_/g, " ")} ({member.email})
                    </option>
                  ))}
                {formData.ownerId &&
                  formData.ownerId !== "UNASSIGNED" &&
                  formData.ownerId !== currentUser?.id && (
                    <option value={formData.ownerId}>
                      {teamMembers.find((m) => m.id === formData.ownerId)?.name ||
                        leadToEdit?.ownerName ||
                        (formData.ownerId === "usr_alex" ? "Alex Sales" : "Assigned Sales Rep")}{" "}
                      (Current Owner)
                    </option>
                  )}
              </select>
              <p className="text-[11px] text-slate-400">
                Only the assigned sales rep, org managers, and admins will have access to this lead record.
              </p>
            </div>
          )}

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
