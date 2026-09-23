"use client";

import { useState, useEffect, useTransition } from "react";
import { Kanban, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCompaniesAction, CompanyItem } from "@/actions/companies";
import { getContactsAction, ContactItem } from "@/actions/contacts";
import {
  createOpportunityAction,
  updateOpportunityAction,
} from "@/actions/opportunities";
import {
  PIPELINE_STAGES,
  OpportunityItem,
  OpportunityFormData,
} from "@/lib/validations/opportunities";

interface OpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  opportunityToEdit?: OpportunityItem | null;
  defaultStage?: string;
}

export function OpportunityModal({
  isOpen,
  onClose,
  onSuccess,
  opportunityToEdit,
  defaultStage = "Qualified",
}: OpportunityModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [companyId, setCompanyId] = useState("");
  const [primaryContactId, setPrimaryContactId] = useState("");
  const [stageName, setStageName] = useState(defaultStage);
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [description, setDescription] = useState("");

  // Load companies & contacts on open
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    if (opportunityToEdit) {
      setName(opportunityToEdit.name);
      setAmount(opportunityToEdit.amount);
      setCompanyId(opportunityToEdit.companyId);
      setPrimaryContactId(opportunityToEdit.primaryContactId || "");
      setStageName(opportunityToEdit.stageName);
      setExpectedCloseDate(opportunityToEdit.expectedCloseDate || "");
      setDescription(opportunityToEdit.description || "");
    } else {
      setName("");
      setAmount(10000);
      setStageName(defaultStage);
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setExpectedCloseDate(d.toISOString().split("T")[0]);
      setDescription("");
    }

    setIsLoadingEntities(true);
    Promise.all([
      getCompaniesAction({ limit: 100 }),
      getContactsAction({ limit: 100 }),
    ])
      .then(([compRes, contRes]) => {
        if (compRes.success && compRes.data) {
          setCompanies(compRes.data.items);
          if (!opportunityToEdit && compRes.data.items.length > 0) {
            setCompanyId(compRes.data.items[0].id);
          }
        }
        if (contRes.success && contRes.data) {
          setContacts(contRes.data.items);
        }
      })
      .finally(() => setIsLoadingEntities(false));
  }, [isOpen, opportunityToEdit, defaultStage]);

  // Filter contacts by selected company if chosen
  const filteredContacts = companyId
    ? contacts.filter((c) => !c.companyId || c.companyId === companyId)
    : contacts;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: OpportunityFormData = {
      name: name.trim(),
      amount: Number(amount) || 0,
      currency: "USD",
      companyId,
      primaryContactId: primaryContactId || undefined,
      stageName,
      expectedCloseDate: expectedCloseDate || undefined,
      description: description.trim() || undefined,
    };

    startTransition(async () => {
      let res;
      if (opportunityToEdit) {
        res = await updateOpportunityAction(opportunityToEdit.id, payload);
      } else {
        res = await createOpportunityAction(payload);
      }

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || "Failed to save opportunity");
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={opportunityToEdit ? "Edit Opportunity" : "Create New Opportunity"}
      description="Track deal value, expected close date, and pipeline stage progression."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Opportunity / Deal Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme - Cloud Migration Suite"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Deal Amount (USD) <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min="0"
              step="100"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pipeline Stage
            </label>
            <select
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} ({s.probability}%)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Account / Company <span className="text-red-500">*</span>
            </label>
            {isLoadingEntities ? (
              <div className="text-xs text-slate-400 py-2">Loading companies...</div>
            ) : (
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                required
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Primary Contact (Optional)
            </label>
            <select
              value={primaryContactId}
              onChange={(e) => setPrimaryContactId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            >
              <option value="">-- No Contact Selected --</option>
              {filteredContacts.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.fullName} {ct.jobTitle ? `(${ct.jobTitle})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Expected Close Date
          </label>
          <Input
            type="date"
            value={expectedCloseDate}
            onChange={(e) => setExpectedCloseDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Description &amp; Deal Strategy
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Key decision makers, budget timeline, and technical criteria..."
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
          >
            <Kanban className="w-4 h-4" />
            <span>{isPending ? "Saving..." : opportunityToEdit ? "Update Deal" : "Create Deal"}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
