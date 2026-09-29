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
  bulkAssignLeadsAction,
  bulkDeleteLeadsAction,
} from "@/actions/leads";
import { getCurrentUserAction } from "@/actions/auth";
import { getUsersAction } from "@/actions/users";
import type { LeadItem, LeadFormData } from "@/lib/validations/leads";
import type { UserItem } from "@/lib/validations/settings";

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [rating, setRating] = useState("ALL");
  const [isTechfluxOrg, setIsTechfluxOrg] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserItem[]>([]);
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
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
        const admin =
          roleUpper === "ADMIN" ||
          roleUpper === "ADMINISTRATOR" ||
          Boolean(u.isSuperAdmin);
        const manager = roleUpper === "MANAGER";
        setIsAdmin(admin);
        setIsManager(manager);

        if (admin || manager) {
          getUsersAction().then((res) => {
            if (res.success && res.data) {
              setTeamMembers(res.data.filter((member) => member.isActive));
            }
          });
        }
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

  const handleToggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const pageIds = leads.map((l) => l.id);
    const allSelected =
      pageIds.length > 0 && pageIds.every((id) => selectedLeadIds.includes(id));
    if (allSelected) {
      setSelectedLeadIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedLeadIds([]);
  };

  const handleBulkAssign = async (ownerId: string) => {
    if (selectedLeadIds.length === 0) return;
    setIsBulkAssigning(true);
    try {
      const res = await bulkAssignLeadsAction(selectedLeadIds, ownerId);
      if (res.success) {
        setSelectedLeadIds([]);
        loadLeads();
      } else {
        alert(res.error || "Failed to bulk assign leads");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to bulk assign leads");
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeadIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const res = await bulkDeleteLeadsAction(selectedLeadIds);
      if (res.success) {
        setSelectedLeadIds([]);
        loadLeads();
      } else {
        alert(res.error || "Failed to bulk delete leads");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to bulk delete leads");
    } finally {
      setIsBulkDeleting(false);
    }
  };

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
        setSelectedLeadIds((prev) => prev.filter((i) => i !== id));
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
        selectedLeadIds={selectedLeadIds}
        isAdminOrManager={isAdmin || isManager}
        teamMembers={teamMembers}
        isBulkAssigning={isBulkAssigning}
        isBulkDeleting={isBulkDeleting}
        onSearchChange={(q) => {
          setSelectedLeadIds([]);
          setSearch(q);
        }}
        onStatusChange={(s) => {
          setSelectedLeadIds([]);
          setStatus(s);
        }}
        onRatingChange={(r) => {
          setSelectedLeadIds([]);
          setRating(r);
        }}
        onPageChange={(p) => loadLeads(p)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPickLead={handlePickLead}
        onToggleSelectLead={handleToggleSelectLead}
        onToggleSelectAll={handleToggleSelectAll}
        onBulkAssign={handleBulkAssign}
        onBulkDelete={handleBulkDelete}
        onClearSelection={handleClearSelection}
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
