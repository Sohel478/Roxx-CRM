"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Globe,
  Mail,
  Phone,
  ArrowLeft,
  Users,
  Kanban,
  Plus,
  MapPin,
  Trash2,
  Edit2,
} from "lucide-react";
import { getCompanyByIdAction, deleteCompanyAction } from "@/actions/companies";
import { CompanyModal } from "@/features/companies/components/company-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CompanyContact {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
}

interface CompanyDetailData {
  id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  status: string;
  description?: string | null;
  createdAt: string;
  contacts?: CompanyContact[];
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [company, setCompany] = useState<CompanyDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await getCompanyByIdAction(id);
    if (res.success && res.data) {
      setCompany(res.data as unknown as CompanyDetailData);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <p className="text-sm font-semibold">Loading company details...</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-base font-bold text-slate-800">Company Not Found</p>
        <Button variant="outline" onClick={() => router.push("/companies")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Companies
        </Button>
      </div>
    );
  }

  const handleDelete = () => {
    if (!confirm(`Are you sure you want to delete company "${company.name}"?`)) return;
    startTransition(async () => {
      await deleteCompanyAction(id);
      router.push("/companies");
    });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb / Back button */}
      <div>
        <Link
          href="/companies"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to all companies
        </Link>
      </div>

      {/* Company Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-blue-500/20 shrink-0">
            {company.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{company.name}</h1>
              <Badge variant={company.status === "Customer" ? "success" : "info"}>
                {company.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {company.industry || "General Enterprise"} &bull; Added {new Date(company.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Header Contact Details & Actions */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition-colors font-medium"
            >
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>Visit Website</span>
            </a>
          )}
          {company.email && (
            <a
              href={`mailto:${company.email}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition-colors font-medium"
            >
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{company.email}</span>
            </a>
          )}
          {company.phone && (
            <a
              href={`tel:${company.phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition-colors font-medium"
            >
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>{company.phone}</span>
            </a>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5 text-xs h-8"
            title="Edit Company"
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
            title="Delete Company"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      {/* Grid: Details & Linked Contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Notes */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              About Company
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Headquarters</span>
                <span className="text-slate-700 font-semibold flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {[company.city, company.state, company.country].filter(Boolean).join(", ") || "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Industry Classification</span>
                <span className="text-slate-700 font-semibold mt-0.5 block">
                  {company.industry || "Not categorized"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Description</span>
                <p className="text-slate-600 mt-1 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {company.description || "No description provided."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Associated Contacts & Deals */}
        <div className="lg:col-span-2 space-y-6">
          {/* Associated Contacts */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Associated Contacts</h2>
              </div>
              <Link
                href="/contacts"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Contact
              </Link>
            </div>

            {company.contacts && company.contacts.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {company.contacts.map((contact: CompanyContact) => (
                  <div
                    key={contact.id}
                    className="py-3 flex items-center justify-between text-xs hover:bg-slate-50/50 rounded-lg px-2"
                  >
                    <div>
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="font-bold text-slate-900 hover:text-blue-600"
                      >
                        {contact.firstName} {contact.lastName || ""}
                      </Link>
                      <p className="text-slate-500">{contact.jobTitle || "Contact"}</p>
                    </div>
                    <div className="text-right text-slate-500">
                      <p>{contact.email || "—"}</p>
                      <p>{contact.phone || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">
                No individual contacts linked to this company yet.
              </p>
            )}
          </div>

          {/* Opportunities summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Kanban className="w-4 h-4 text-purple-600" />
                <h2 className="text-sm font-bold text-slate-900">Sales Opportunities</h2>
              </div>
              <Link
                href="/opportunities"
                className="text-xs font-semibold text-purple-600 hover:text-purple-700"
              >
                Pipeline View &rarr;
              </Link>
            </div>
            <p className="text-xs text-slate-400 text-center py-6">
              Opportunity pipeline integration active in Phase 6.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Company Modal */}
      <CompanyModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={load}
        companyToEdit={
          company
            ? {
                id: company.id,
                name: company.name,
                industry: company.industry || "",
                website: company.website || "",
                email: company.email || "",
                phone: company.phone || "",
                city: company.city || "",
                country: company.country || "",
                status: (company.status as "Active" | "Prospect" | "Customer" | "Inactive") || "Active",
                description: company.description || "",
              }
            : null
        }
      />
    </div>
  );
}
