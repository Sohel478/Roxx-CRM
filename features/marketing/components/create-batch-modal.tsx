"use client";

import { useState, useEffect } from "react";
import {
  X,
  Search,
  Users2,
  Loader2,
  Sparkles,
  AlertCircle,
  Building2,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  createMarketingBatchAction,
  getSelectableLeadsForBatchAction,
} from "@/actions/marketing";

interface CreateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchCreated?: (batchId: string) => void;
  initialSelectedLeadIds?: string[];
}

const EMPTY_LEAD_IDS: string[] = [];

export function CreateBatchModal({
  isOpen,
  onClose,
  onBatchCreated,
  initialSelectedLeadIds = EMPTY_LEAD_IDS,
}: CreateBatchModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<
    {
      id: string;
      leadNumber: string;
      fullName: string;
      email: string | null;
      companyName: string | null;
      status: string;
      rating: string;
    }[]
  >([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state and load leads ONLY when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Initialize selection
    if (initialSelectedLeadIds && initialSelectedLeadIds.length > 0) {
      setSelectedIds(initialSelectedLeadIds);
    } else {
      setSelectedIds([]);
    }
    setError(null);

    let isMounted = true;
    setIsLoadingLeads(true);

    getSelectableLeadsForBatchAction({ limit: 400 })
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setLeads(res.data);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch leads for batch picker:", err);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingLeads(false);
        }
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLeads = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.fullName.toLowerCase().includes(q) ||
      (l.companyName && l.companyName.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      l.leadNumber.toLowerCase().includes(q)
    );
  });

  const toggleSelectLead = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredLeads.map((l) => l.id);
    const allSelected = filteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a name for the batch (e.g. 'New Year Email').");
      return;
    }
    if (selectedIds.length === 0) {
      setError("Please select at least 1 lead for this batch.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createMarketingBatchAction({
        name: name.trim(),
        description: description.trim() || undefined,
        leadIds: selectedIds,
      });

      if (!res.success) {
        setError(res.error || "Failed to create batch");
        setIsSubmitting(false);
        return;
      }

      setName("");
      setDescription("");
      setSelectedIds([]);
      onClose();
      if (res.data?.id && onBatchCreated) {
        onBatchCreated(res.data.id);
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Create Lead Marketing Batch
              </h2>
              <p className="text-xs text-slate-500">
                Group selected leads into a named batch for targeted email campaigns
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Batch Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Batch Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. New Year Email, Q1 E-commerce Promo, High-Value Leads"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-900"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description / Purpose (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Tailored outreach for retail decision makers"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-700"
              />
            </div>

            {/* Lead Selection Section */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Select Leads for Batch
                  </span>
                  <Badge variant="secondary" className="text-xs font-semibold bg-blue-50 text-blue-700">
                    {selectedIds.length} selected
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {filteredLeads.length > 0 &&
                  filteredLeads.every((l) => selectedIds.includes(l.id))
                    ? "Deselect All Filtered"
                    : "Select All Filtered"}
                </button>
              </div>

              {/* Search leads */}
              <div className="relative mb-2.5">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by name, company, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Leads List Box */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
                {isLoadingLeads ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Loading available leads...</span>
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No leads found matching your search.
                  </div>
                ) : (
                  filteredLeads.map((lead) => {
                    const isSelected = selectedIds.includes(lead.id);
                    return (
                      <div
                        key={lead.id}
                        onClick={() => toggleSelectLead(lead.id)}
                        className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-50/70 text-slate-900"
                            : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {lead.fullName}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 truncate">
                              {lead.companyName && (
                                <span className="flex items-center gap-1 truncate">
                                  <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{lead.companyName}</span>
                                </span>
                              )}
                              {lead.email && (
                                <span className="flex items-center gap-1 truncate text-slate-500">
                                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{lead.email}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-[10px] font-medium text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {lead.leadNumber}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                              lead.rating === "Hot"
                                ? "bg-red-50 text-red-600"
                                : lead.rating === "Warm"
                                ? "bg-amber-50 text-amber-600"
                                : "bg-blue-50 text-blue-600"
                            }`}
                          >
                            {lead.rating}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              <strong>{selectedIds.length}</strong> leads will be added to this batch
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || selectedIds.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs font-semibold px-4"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    <span>Creating Batch...</span>
                  </>
                ) : (
                  <span>Create Batch</span>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
