"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { Plus, Download, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadTable } from "@/features/leads/components/lead-table";
import { LeadModal } from "@/features/leads/components/lead-modal";
import { ImportModal } from "@/features/imports/components/import-modal";
import { DataResetModal } from "@/features/settings/components/data-reset-modal";
import { exportEntityCsvAction } from "@/actions/imports";
import {
  getLeadsAction,
  deleteLeadAction,
  pickLeadAction,
} from "@/actions/leads";
import { getCurrentUserAction } from "@/actions/auth";
import type { LeadItem, LeadFormData } from "@/lib/validations/leads";

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [rating, setRating] = useState("ALL");
  const [isTechfluxOrg, setIsTechfluxOrg] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<(LeadFormData & { id: string }) | null>(null);
  const [, startTransition] = useTransition();

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await exportEntityCsvAction("leads");
      if (res.success && res.csv && res.filename) {
        const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", res.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch {
      // Fallback to client leads export
      const csvContent =
        "data:text/csv;charset=utf-8,Number,Name,Company,Status,Rating,Value,Email,Phone\n" +
        leads
          .map(
            (l) =>
              `"${l.leadNumber}","${l.fullName}","${l.companyName || ""}","${l.status}","${l.rating}",${l.estimatedValue},"${l.email || ""}","${l.phone || ""}"`
          )
          .join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "leads.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsExporting(false);
    }
  };

  const loadLeads = useCallback(
    (page = 1, query = search, filterStatus = status, filterRating = rating) => {
      startTransition(async () => {
        try {
          const res = await getLeadsAction({
            page,
            limit: 10,
            search: query,
            status: filterStatus,
            rating: filterRating,
          });
          if (res?.success && res.data) {
            setLeads(res.data.items);
            setMeta(res.data.meta);
            if ("isTechfluxOrg" in res.data && typeof res.data.isTechfluxOrg === "boolean") {
              setIsTechfluxOrg(res.data.isTechfluxOrg);
            }
          }
        } catch (err) {
          console.error("Failed to load leads:", err);
        }
      });
    },
    [search, status, rating]
  );

  useEffect(() => {
    getCurrentUserAction().then((u) => {
      if (u) {
        const isTf =
          (u.organizationName || "").toLowerCase().includes("techflux") ||
          (u.organizationId || "").toLowerCase().includes("techflux");
        setIsTechfluxOrg(isTf);
        const roleUpper = u.role?.toUpperCase();
        setIsAdmin(
          roleUpper === "ADMIN" ||
          roleUpper === "ADMINISTRATOR" ||
          Boolean(u.isSuperAdmin)
        );
      }
    });
  }, []);

  useEffect(() => {
    loadLeads(1, search, status, rating);
  }, [loadLeads, search, status, rating]);

  // Listen for global lead creation events (e.g. from top header navbar)
  useEffect(() => {
    const handleLeadCreated = () => {
      loadLeads(1, search, status, rating);
    };
    window.addEventListener("leadCreated", handleLeadCreated);
    return () => window.removeEventListener("leadCreated", handleLeadCreated);
  }, [loadLeads, search, status, rating]);

  const handlePickLead = (id: string) => {
    startTransition(async () => {
      try {
        const res = await pickLeadAction(id);
        if (res.success) {
          loadLeads(1, search, status, rating);
        }
      } catch (err) {
        console.error("Failed to pick lead:", err);
      }
    });
  };

  const handleEdit = (lead: LeadItem) => {
    setLeadToEdit({
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName || "",
      email: lead.email || "",
      supportEmail: lead.supportEmail || "",
      phone: lead.phone || "",
      companyName: lead.companyName || "",
      jobTitle: lead.jobTitle || "",
      companyLinkedin: lead.companyLinkedin || "",
      customerLinkedin: lead.customerLinkedin || "",
      source: lead.source,
      status: (lead.status as "New" | "Contacted" | "Qualified" | "Unqualified" | "Nurture" | "Converted" | "Lost") || "New",
      rating: (lead.rating as "Hot" | "Warm" | "Cold") || "Warm",
      estimatedValue: lead.estimatedValue,
      currency: lead.currency || "USD",
      description: lead.description || "",
      ownerId: lead.ownerId || undefined,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteLeadAction(id);
        loadLeads();
      } catch (err) {
        console.error("Failed to delete lead:", err);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">
            Prospects, qualifications, deal value estimates, and conversion pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
          >
            <Upload className="w-4 h-4 mr-1.5 text-slate-500" />
            <span>Import CSV</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isExporting}
            onClick={handleExportCsv}
          >
            <Download className="w-4 h-4 mr-1.5 text-slate-500" />
            <span>{isExporting ? "Exporting..." : "Export"}</span>
          </Button>
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsResetModalOpen(true)}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
            >
              <Trash2 className="w-4 h-4 mr-1.5 text-red-500" />
              <span>Reset Leads</span>
            </Button>
          )}
          <Button
            type="button"
            onClick={() => {
              setLeadToEdit(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add Lead</span>
          </Button>
        </div>
      </div>

      {/* Table Component */}
      <LeadTable
        leads={leads}
        meta={meta}
        selectedStatus={status}
        selectedRating={rating}
        isTechfluxOrg={isTechfluxOrg}
        onSearchChange={(q) => setSearch(q)}
        onStatusChange={(s) => setStatus(s)}
        onRatingChange={(r) => setRating(r)}
        onPageChange={(p) => loadLeads(p)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPickLead={handlePickLead}
      />

      {/* Modal Dialog */}
      <LeadModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setLeadToEdit(null);
        }}
        onSuccess={() => loadLeads()}
        leadToEdit={leadToEdit}
        isTechfluxOrg={isTechfluxOrg}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => loadLeads()}
        defaultEntity="leads"
      />

      {/* Data Reset Modal */}
      <DataResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        entity="leads"
        count={meta.total || leads.length}
        onSuccess={() => loadLeads(1)}
      />
    </div>
  );
}
