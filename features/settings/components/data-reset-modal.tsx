"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetCrmDataAction } from "@/actions/data-management";
import type { CrmResetEntity } from "@/lib/validations/data-management";

interface DataResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: CrmResetEntity;
  count?: number;
  onSuccess?: () => void;
}

const ENTITY_CONFIG: Record<
  CrmResetEntity,
  {
    title: string;
    targetName: string;
    warning: string;
    consequences: string[];
  }
> = {
  leads: {
    title: "Reset All Leads",
    targetName: "Leads",
    warning: "You are about to permanently delete all leads belonging to your organization.",
    consequences: [
      "All active and archived leads will be wiped.",
      "Associated activities, notes, and tasks linked exclusively to leads will be cleared.",
      "Users and team assignments will not be deleted.",
    ],
  },
  companies: {
    title: "Reset All Companies",
    targetName: "Companies",
    warning: "You are about to permanently delete all companies belonging to your organization.",
    consequences: [
      "All company profiles and account data will be wiped.",
      "All associated opportunities and deals will be removed.",
      "Existing contacts will be preserved but unlinked from their deleted companies.",
    ],
  },
  contacts: {
    title: "Reset All Contacts",
    targetName: "Contacts",
    warning: "You are about to permanently delete all contacts belonging to your organization.",
    consequences: [
      "All contact persons, phone numbers, and emails will be wiped.",
      "Company profiles will remain intact without assigned contacts.",
      "Associated contact activities and notes will be cleared.",
    ],
  },
  all: {
    title: "Master CRM Data Wipe",
    targetName: "All CRM Records",
    warning: "DANGER: You are about to wipe all customer data (Leads, Companies, Contacts, Opportunities) across your entire organization.",
    consequences: [
      "Every lead, contact, company, and opportunity will be wiped.",
      "All sales pipelines, Kanban boards, and activity logs will return to empty slate.",
      "Your organization profile, team member logins, and billing plan will remain intact.",
    ],
  },
};

export function DataResetModal({
  isOpen,
  onClose,
  entity,
  count,
  onSuccess,
}: DataResetModalProps) {
  const [confirmationInput, setConfirmationInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const config = ENTITY_CONFIG[entity];
  const isMatch = confirmationInput.trim().toUpperCase() === "RESET";

  const handleClose = () => {
    if (isPending) return;
    setConfirmationInput("");
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  const handleConfirmReset = () => {
    if (!isMatch) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        const res = await resetCrmDataAction({
          entity,
          confirmationText: confirmationInput.trim(),
        });

        if (res.success) {
          setSuccessMsg(res.message || "Data successfully reset.");
          if (onSuccess) {
            onSuccess();
          }
          setTimeout(() => {
            handleClose();
          }, 1400);
        } else {
          setErrorMsg(res.error || "Failed to reset data. Please try again.");
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "An unexpected error occurred.");
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={config.title}
      description={`Permanently wipe ${config.targetName.toLowerCase()} for your organization`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Warning Banner */}
        <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-red-800">{config.warning}</p>
            <p className="text-red-700">This action is irreversible. Please proceed with caution.</p>
          </div>
        </div>

        {/* Affected Record Count */}
        {typeof count === "number" && (
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <span className="font-semibold text-slate-600">Records to be deleted:</span>
            <span className="font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded border border-slate-200 shadow-xs">
              {count} {config.targetName}
            </span>
          </div>
        )}

        {/* Consequences Bullet Points */}
        <div className="space-y-1.5 text-xs text-slate-600 px-1">
          <p className="font-bold text-slate-800">What will happen:</p>
          <ul className="list-disc pl-4 space-y-1">
            {config.consequences.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <p>{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <p>{successMsg}</p>
          </div>
        )}

        {/* Confirmation Input */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700">
            To confirm, type <span className="font-mono font-bold text-red-600">RESET</span> in the box below:
          </label>
          <Input
            type="text"
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            placeholder="Type RESET"
            disabled={isPending || Boolean(successMsg)}
            className="font-mono text-center tracking-widest text-sm uppercase placeholder:normal-case placeholder:tracking-normal"
            autoFocus
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
            className="text-xs h-9"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirmReset}
            disabled={!isMatch || isPending || Boolean(successMsg)}
            className="bg-red-600 hover:bg-red-700 text-white gap-1.5 text-xs h-9 cursor-pointer disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Wiping Data...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete &amp; Reset Now</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
