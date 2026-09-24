"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Globe,
  Mail,
  Phone,
  Search,
  MoreVertical,
  ExternalLink,
  Edit2,
  Trash2,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { CompanyItem } from "@/lib/validations/companies";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CompanyTableProps {
  companies: CompanyItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: string) => void;
  onEdit: (company: CompanyItem) => void;
  onDelete: (id: string) => void;
  selectedStatus: string;
}

export function CompanyTable({
  companies,
  meta,
  onPageChange,
  onSearchChange,
  onStatusChange,
  onEdit,
  onDelete,
  selectedStatus,
}: CompanyTableProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Customer":
        return <Badge variant="success">Customer</Badge>;
      case "Prospect":
        return <Badge variant="warning">Prospect</Badge>;
      case "Active":
        return <Badge variant="info">Active</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search companies by name, industry, city..."
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Prospect">Prospect</option>
            <option value="Customer">Customer</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Company Name</th>
                <th className="py-3 px-4">Industry</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4 text-center">Contacts</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">No companies found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Create your first company account or adjust your filters.
                    </p>
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Name */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <Link
                        href={`/companies/${company.id}`}
                        className="hover:text-blue-600 flex items-center gap-2 group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {company.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate group-hover:underline">{company.name}</span>
                      </Link>
                    </td>

                    {/* Industry */}
                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      {company.industry || "—"}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">{getStatusBadge(company.status)}</td>

                    {/* Contact Info */}
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        {company.website && (
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100"
                            title={company.website}
                          >
                            <Globe className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {company.email && (
                          <a
                            href={`mailto:${company.email}`}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100"
                            title={company.email}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {company.phone && (
                          <a
                            href={`tel:${company.phone}`}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100"
                            title={company.phone}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {[company.city, company.country].filter(Boolean).join(", ") || "—"}
                    </td>

                    {/* Contacts count */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                        <Users className="w-3 h-3 text-slate-400" />
                        {company.contactCount}
                      </span>
                    </td>

                    {/* Row Actions */}
                    <td className="py-3.5 px-4 text-right relative">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/companies/${company.id}`}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => onEdit(company)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete ${company.name}?`)) {
                              onDelete(company.id);
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
            Showing <span className="font-semibold text-slate-800">{companies.length}</span> of{" "}
            <span className="font-semibold text-slate-800">{meta.total}</span> companies
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
