import { UserSquare2, Plus } from "lucide-react";

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500">
            People and decision-makers associated with companies and opportunities.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Contact</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
          <UserSquare2 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">Contacts Directory</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
          Individual contact records and communication history will be delivered in Phase 3.
        </p>
      </div>
    </div>
  );
}
