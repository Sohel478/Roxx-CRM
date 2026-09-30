"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Phone,
  ArrowLeft,
  Building2,
  Globe,
  Instagram,
  Activity,
  Trash2,
  Edit2,
  UserCheck,
} from "lucide-react";
import {
  getContactByIdAction,
  deleteContactAction,
  assignContactAction,
} from "@/actions/contacts";
import { getCurrentUserAction } from "@/actions/auth";
import { getUsersAction } from "@/actions/users";
import { ContactModal } from "@/features/contacts/components/contact-modal";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/session";
import type { UserItem } from "@/lib/validations/settings";

interface ContactDetailData {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  company?: { id: string; name: string; industry?: string | null } | null;
  address?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [contact, setContact] = useState<ContactDetailData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [teamMembers, setTeamMembers] = useState<UserItem[]>([]);

  const roleUpper = currentUser?.role?.toUpperCase();
  const isAdminOrManager =
    roleUpper === "ADMIN" ||
    roleUpper === "ADMINISTRATOR" ||
    roleUpper === "MANAGER" ||
    Boolean(currentUser?.isSuperAdmin);

  useEffect(() => {
    getCurrentUserAction().then((u) => {
      if (u) {
        setCurrentUser(u);
        const rUpper = u.role?.toUpperCase();
        if (
          rUpper === "ADMIN" ||
          rUpper === "ADMINISTRATOR" ||
          rUpper === "MANAGER" ||
          u.isSuperAdmin
        ) {
          getUsersAction().then((res) => {
            if (res.success && res.data) {
              setTeamMembers(res.data.filter((m) => m.isActive));
            }
          });
        }
      }
    });
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await getContactByIdAction(id);
    if (res.success && res.data) {
      setContact(res.data as unknown as ContactDetailData);
      setErrorMsg(null);
    } else {
      setErrorMsg(res.error || "Contact not found");
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAssignContact = (newOwnerId: string) => {
    if (!newOwnerId) return;
    startTransition(async () => {
      const res = await assignContactAction(id, newOwnerId);
      if (res.success) {
        await load();
      }
    });
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <p className="text-sm font-semibold">Loading contact profile...</p>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-base font-bold text-slate-800">
          {errorMsg || "Contact Not Found"}
        </p>
        <p className="text-xs text-slate-500">
          {errorMsg?.includes("Unauthorized")
            ? "You do not have permission to view this contact because it is assigned to another sales representative."
            : "The requested contact does not exist or has been removed."}
        </p>
        <Button variant="outline" onClick={() => router.push("/contacts")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Contacts
        </Button>
      </div>
    );
  }

  const fullName = `${contact.firstName} ${contact.lastName || ""}`.trim();

  const handleDelete = () => {
    if (!confirm(`Are you sure you want to delete contact "${fullName}"?`)) return;
    startTransition(async () => {
      await deleteContactAction(id);
      router.push("/contacts");
    });
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/contacts"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to all contacts
        </Link>
      </div>

      {/* Header Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center text-xl font-bold shadow-md shrink-0">
            {contact.firstName.slice(0, 1)}
            {contact.lastName ? contact.lastName.slice(0, 1) : ""}
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{fullName}</h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <span>{contact.jobTitle || "Contact"}</span>
              {contact.department && (
                <>
                  <span>&bull;</span>
                  <span>{contact.department}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Contact Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Send Email</span>
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Contact</span>
            </a>
          )}
          {contact.linkedinUrl && (
            <a
              href={contact.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>LinkedIn</span>
            </a>
          )}
          {contact.instagramUrl && (
            <a
              href={contact.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Instagram className="w-3.5 h-3.5 text-pink-600" />
              <span>Instagram</span>
            </a>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5 text-xs h-8"
            title="Edit Contact"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={handleDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 flex items-center gap-1.5 text-xs h-8"
            title="Delete Contact"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      {/* Grid: Company Affiliation & Communication Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Affiliation & Details */}
        <div className="space-y-6">
          {/* Company Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Company Affiliation
            </h2>
            {contact.company ? (
              <div className="space-y-2 text-xs">
                <Link
                  href={`/companies/${contact.company.id || contact.companyId}`}
                  className="font-bold text-base text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1.5"
                >
                  <Building2 className="w-4 h-4 text-slate-400" />
                  {contact.company.name || contact.companyName}
                </Link>
                <p className="text-slate-500">
                  {contact.company.industry || "Enterprise Account"}
                </p>
                <Link
                  href={`/companies/${contact.company.id || contact.companyId}`}
                  className="inline-block text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors mt-2"
                >
                  View Company Profile &rarr;
                </Link>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No company linked to this contact.</p>
            )}
          </div>

          {/* Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Contact Info
            </h2>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Email</span>
                <span className="text-slate-800 font-semibold">{contact.email || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Primary Phone</span>
                <span className="text-slate-800 font-semibold">{contact.phone || "—"}</span>
              </div>
              {contact.alternatePhone && (
                <div>
                  <span className="text-slate-400 block font-medium">Alternate Phone</span>
                  <span className="text-slate-800 font-semibold">{contact.alternatePhone}</span>
                </div>
              )}
              {contact.linkedinUrl && (
                <div>
                  <span className="text-slate-400 block font-medium">LinkedIn</span>
                  <a
                    href={contact.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline font-semibold flex items-center gap-1 mt-0.5"
                  >
                    <Globe className="w-3 h-3" />
                    <span>View Profile</span>
                  </a>
                </div>
              )}
              {contact.instagramUrl && (
                <div>
                  <span className="text-slate-400 block font-medium">Instagram</span>
                  <a
                    href={contact.instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-pink-600 hover:underline font-semibold flex items-center gap-1 mt-0.5"
                  >
                    <Instagram className="w-3 h-3" />
                    <span>View Profile</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Assigned Owner Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span>Assigned Owner</span>
              </h2>
              {isAdminOrManager && (
                <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded">
                  Admin / Manager
                </span>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400 font-medium">Current Owner</span>
                <span className="font-semibold text-slate-800">
                  {contact.ownerName || "Unassigned"}
                </span>
              </div>

              {isAdminOrManager && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 block">
                    Reassign Contact
                  </label>
                  <select
                    value={contact.ownerId || ""}
                    disabled={isPending}
                    onChange={(e) => handleAssignContact(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <option value="">Choose Sales Rep / Manager</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role.replace(/_/g, " ")})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Reassigning updates ownership and visibility for sales reps immediately.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Communication History & Tasks */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Interaction History</h2>
              </div>
              <span className="text-xs text-slate-400">Activities active in Phase 7</span>
            </div>
            <p className="text-xs text-slate-400 text-center py-8">
              Calls, meetings, emails, and follow-up activities with {contact.firstName} will appear here.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Contact Modal */}
      <ContactModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={load}
        contactToEdit={
          contact
            ? {
                id: contact.id,
                firstName: contact.firstName,
                lastName: contact.lastName || "",
                email: contact.email || "",
                phone: contact.phone || "",
                alternatePhone: contact.alternatePhone || "",
                jobTitle: contact.jobTitle || "",
                department: contact.department || "",
                linkedinUrl: contact.linkedinUrl || "",
                companyId: contact.companyId || "",
                address: contact.address || "",
              }
            : null
        }
      />
    </div>
  );
}
