"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyTable } from "@/features/companies/components/company-table";
import { CompanyModal } from "@/features/companies/components/company-modal";
import {
  getCompaniesAction,
  deleteCompanyAction,
  CompanyItem,
  CompanyFormData,
} from "@/actions/companies";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState<(CompanyFormData & { id: string }) | null>(null);
  const [, startTransition] = useTransition();

  const loadCompanies = useCallback(
    (page = 1, query = search, filterStatus = status) => {
      startTransition(async () => {
        const res = await getCompaniesAction({ page, limit: 10, search: query, status: filterStatus });
        if (res.success && res.data) {
          setCompanies(res.data.items);
          setMeta(res.data.meta);
        }
      });
    },
    [search, status]
  );

  useEffect(() => {
    loadCompanies(1, search, status);
  }, [loadCompanies, search, status]);

  const handleEdit = (company: CompanyItem) => {
    setCompanyToEdit({
      id: company.id,
      name: company.name,
      industry: company.industry || "",
      website: company.website || "",
      email: company.email || "",
      phone: company.phone || "",
      city: company.city || "",
      country: company.country || "",
      status: (company.status as "Active" | "Prospect" | "Customer" | "Inactive") || "Active",
      description: "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteCompanyAction(id);
      loadCompanies();
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Companies</h1>
          <p className="text-sm text-slate-500">
            Accounts, target clients, and associated key decision-makers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              // Quick export mock CSV
              const csvContent =
                "data:text/csv;charset=utf-8,Name,Industry,Status,Email,Phone\n" +
                companies.map((c) => `"${c.name}","${c.industry || ""}","${c.status}","${c.email || ""}","${c.phone || ""}"`).join("\n");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", "companies.csv");
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            <Download className="w-4 h-4 mr-1.5 text-slate-500" />
            <span>Export</span>
          </Button>
          <Button
            type="button"
            onClick={() => {
              setCompanyToEdit(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add Company</span>
          </Button>
        </div>
      </div>

      {/* Companies Table Component */}
      <CompanyTable
        companies={companies}
        meta={meta}
        selectedStatus={status}
        onSearchChange={(q) => setSearch(q)}
        onStatusChange={(s) => setStatus(s)}
        onPageChange={(p) => loadCompanies(p)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Modal Dialog for Create/Edit */}
      <CompanyModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setCompanyToEdit(null);
        }}
        onSuccess={() => loadCompanies()}
        companyToEdit={companyToEdit}
      />
    </div>
  );
}
