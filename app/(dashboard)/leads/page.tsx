"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { Plus, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadTable } from "@/features/leads/components/lead-table";
import { LeadModal } from "@/features/leads/components/lead-modal";
import { ImportModal } from "@/features/imports/components/import-modal";
import { exportEntityCsvAction } from "@/actions/imports";
import {
  getLeadsAction,
  deleteLeadAction,
  LeadItem,
  LeadFormData,
} from "@/actions/leads";

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [rating, setRating] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
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
        const res = await getLeadsAction({
          page,
          limit: 10,
          search: query,
          status: filterStatus,
          rating: filterRating,
        });
        if (res.success && res.data) {
          setLeads(res.data.items);
          setMeta(res.data.meta);
        }
      });
    },
    [search, status, rating]
  );

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

  const handleEdit = (lead: LeadItem) => {
    setLeadToEdit({
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName || "",
      email: lead.email || "",
      phone: lead.phone || "",
      companyName: lead.companyName || "",
      jobTitle: lead.jobTitle || "",
      source: lead.source,
      status: (lead.status as "New" | "Contacted" | "Qualified" | "Unqualified" | "Nurture" | "Converted" | "Lost") || "New",
      rating: (lead.rating as "Hot" | "Warm" | "Cold") || "Warm",
      estimatedValue: lead.estimatedValue,
      currency: lead.currency || "USD",
      description: lead.description || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteLeadAction(id);
      loadLeads();
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
        onSearchChange={(q) => setSearch(q)}
        onStatusChange={(s) => setStatus(s)}
        onRatingChange={(r) => setRating(r)}
        onPageChange={(p) => loadLeads(p)}
        onEdit={handleEdit}
        onDelete={handleDelete}
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
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => loadLeads()}
        defaultEntity="leads"
      />
    </div>
  );
}
