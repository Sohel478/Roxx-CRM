"use client";

import Link from "next/link";
import {
  UserSquare2,
  Mail,
  Phone,
  Search,
  Building2,
  ExternalLink,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ContactItem } from "@/lib/validations/contacts";
import { Button } from "@/components/ui/button";

interface ContactTableProps {
  contacts: ContactItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  onEdit: (contact: ContactItem) => void;
  onDelete: (id: string) => void;
}

export function ContactTable({
  contacts,
  meta,
  onPageChange,
  onSearchChange,
  onEdit,
  onDelete,
}: ContactTableProps) {
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search contacts by name, email, title, company..."
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Job Title &amp; Dept</th>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <UserSquare2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">No contacts found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Add decision-makers to track communications.
                    </p>
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Name */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="hover:text-blue-600 flex items-center gap-2 group"
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {contact.firstName.slice(0, 1)}
                          {contact.lastName ? contact.lastName.slice(0, 1) : ""}
                        </div>
                        <span className="truncate group-hover:underline">{contact.fullName}</span>
                      </Link>
                    </td>

                    {/* Job Title & Dept */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <p className="font-medium text-slate-800">{contact.jobTitle || "—"}</p>
                      {contact.department && (
                        <p className="text-[11px] text-slate-400">{contact.department}</p>
                      )}
                    </td>

                    {/* Company */}
                    <td className="py-3.5 px-4 text-xs">
                      {contact.companyId ? (
                        <Link
                          href={`/companies/${contact.companyId}`}
                          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 hover:underline font-medium"
                        >
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{contact.companyName || "View Company"}</span>
                        </Link>
                      ) : (
                        <span className="text-slate-400 italic">No Company</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="hover:text-blue-600 flex items-center gap-1.5"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{contact.email}</span>
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          className="hover:text-blue-600 flex items-center gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{contact.phone}</span>
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Row Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => onEdit(contact)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete ${contact.fullName}?`)) {
                              onDelete(contact.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-800">{contacts.length}</span> of{" "}
            <span className="font-semibold text-slate-800">{meta.total}</span> contacts
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => onPageChange(meta.page - 1)}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Previous
            </Button>
            <span className="text-slate-600 font-medium px-1">
              Page {meta.page} of {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => onPageChange(meta.page + 1)}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
