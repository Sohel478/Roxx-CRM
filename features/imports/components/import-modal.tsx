"use client";

import { useState, useTransition, useRef } from "react";
import {
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  X,
  FileText,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { importCsvAction } from "@/actions/imports";
import { getSampleCsvTemplate } from "@/lib/csv/parser";
import {
  ImportEntityType,
  ImportResult,
} from "@/lib/validations/imports";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultEntity?: ImportEntityType;
}

export function ImportModal({
  isOpen,
  onClose,
  onSuccess,
  defaultEntity = "leads",
}: ImportModalProps) {
  const [entityType, setEntityType] = useState<ImportEntityType>(defaultEntity);
  const [csvContent, setCsvContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const { filename, csv } = getSampleCsvTemplate(entityType);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content || "");
    };
    reader.onerror = () => {
      setError("Failed to read the selected file");
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!csvContent.trim()) {
      setError("Please select a valid CSV file or paste CSV content.");
      return;
    }

    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        const res = await importCsvAction(entityType, csvContent);
        if (!res.success || !res.data) {
          setError(res.error || "Failed to process import");
          return;
        }

        setResult(res.data);
        if (res.data.importedCount > 0) {
          onSuccess();
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred during import");
      }
    });
  };

  const handleReset = () => {
    setCsvContent("");
    setFileName(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Bulk Import ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`}
      description="Upload CSV spreadsheets to rapidly import records into your CRM."
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Entity Tab Switcher */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg">
          {(["leads", "companies", "contacts"] as ImportEntityType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setEntityType(t);
                handleReset();
              }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                entityType === t
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Template Download Banner */}
        <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-100 rounded-lg text-xs">
          <div className="flex items-center gap-2 text-blue-900">
            <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Need sample format? Download our official CSV template.</span>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="font-bold text-blue-700 hover:text-blue-800 hover:underline flex items-center gap-1 shrink-0 ml-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Template</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2 p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success / Result Summary */}
        {result && (
          <div className="p-3.5 rounded-lg border bg-slate-50 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>Successfully imported {result.importedCount} of {result.totalRows} rows!</span>
              </div>
              {result.failedCount > 0 && (
                <span className="text-red-600 font-semibold">
                  {result.failedCount} errors
                </span>
              )}
            </div>

            {/* Error Rows Table */}
            {result.errors.length > 0 && (
              <div className="mt-2 max-h-36 overflow-y-auto border border-red-100 bg-red-50/50 rounded p-2 space-y-1">
                <p className="text-[11px] font-bold text-red-800">Failed Rows:</p>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-[11px] text-red-700">
                    Row {err.rowNumber}{err.field ? ` (${err.field})` : ""}: {err.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* File Dropzone / Selector */}
        {!result && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-file-input"
            />
            <label
              htmlFor="csv-file-input"
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/20 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors"
            >
              <Upload className="w-8 h-8 text-slate-400 mb-2" />
              {fileName ? (
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-900">{fileName}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Click to choose a different CSV</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800">
                    Click to browse or drop your CSV file here
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Standard comma-separated format (.csv)
                  </p>
                </div>
              )}
            </label>
          </div>
        )}

        {/* Or Paste CSV Raw Text */}
        {!result && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Or Paste CSV Data Directly
            </label>
            <textarea
              rows={4}
              value={csvContent}
              onChange={(e) => {
                setCsvContent(e.target.value);
                setFileName("Manual Input.csv");
              }}
              placeholder="firstName,lastName,email,phone,companyName..."
              className="w-full font-mono text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            {result ? "Close" : "Cancel"}
          </Button>

          {!result ? (
            <Button
              type="button"
              onClick={handleImport}
              disabled={isPending || !csvContent.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPending ? "Processing CSV..." : "Import Data"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleReset}
              className="bg-slate-900 text-white"
            >
              Import Another File
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
