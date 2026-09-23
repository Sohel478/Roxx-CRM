import { Users2, Plus, Filter, Download } from "lucide-react";

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">
            Capture, qualify, and convert prospective sales leads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar placeholder */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Filter leads by name, email, phone..."
            className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>
        </div>
        <span className="text-xs text-slate-500 font-medium">Task 004 / Phase 1 Module</span>
      </div>

      {/* Empty State / Table Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
          <Users2 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">Lead Management Foundation</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
          Lead list, filtering, CSV import/export, and conversion transactions will be implemented in Phase 3 &amp; 4.
        </p>
      </div>
    </div>
  );
}
