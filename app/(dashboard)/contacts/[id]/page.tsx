"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Phone,
  ArrowLeft,
  Building2,
  Globe,
  Activity,
} from "lucide-react";
import { getContactByIdAction } from "@/actions/contacts";
import { Button } from "@/components/ui/button";

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
  companyId?: string | null;
  companyName?: string | null;
  company?: { id: string; name: string; industry?: string | null } | null;
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [contact, setContact] = useState<ContactDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const res = await getContactByIdAction(id);
      if (res.success && res.data) {
        setContact(res.data as unknown as ContactDetailData);
      }
      setIsLoading(false);
    }
    load();
  }, [id]);

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
        <p className="text-base font-bold text-slate-800">Contact Not Found</p>
        <Button variant="outline" onClick={() => router.push("/contacts")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Contacts
        </Button>
      </div>
    );
  }

  const fullName = `${contact.firstName} ${contact.lastName || ""}`.trim();

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
              <Globe className="w-3.5 h-3.5" />
              <span>LinkedIn</span>
            </a>
          )}
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
    </div>
  );
}
