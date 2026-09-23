import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports &amp; Analytics</h1>
          <p className="text-sm text-slate-500">
            Pipeline health, lead conversion rates, and salesperson performance metrics.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">Reporting Engine</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
          Lead, opportunity, activity, and team performance reports with date filtering will be delivered in Phase 8.
        </p>
      </div>
    </div>
  );
}
