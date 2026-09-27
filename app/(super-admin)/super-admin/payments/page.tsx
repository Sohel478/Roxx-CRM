import Link from "next/link";
import { DollarSign, ChevronRight } from "lucide-react";
import { getSuperAdminPaymentsAction } from "@/actions/admin";

export const metadata = {
  title: "Payments Ledger | Roxx CRM Super Admin",
};

export default async function SuperAdminPaymentsPage() {
  const res = await getSuperAdminPaymentsAction();
  const payments = res.data || [];

  const totalRevenue = payments
    .filter((p) => p.status === "COMPLETED" || p.status === "PAID")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const completedCount = payments.filter((p) => p.status === "COMPLETED" || p.status === "PAID").length;

  return (
    <div className="space-y-6">
      {/* Page Title & KPI summary */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-indigo-600" />
            <span>Payments Ledger & Transactions</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Reconciled payments processed across Stripe and billing adapters.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-xs shadow-sm">
          <div>
            <span className="text-slate-400">Total Revenue:</span>{" "}
            <strong className="text-slate-900 text-sm font-bold">${totalRevenue.toLocaleString()}</strong>
          </div>
          <span className="text-slate-200">|</span>
          <div>
            <span className="text-slate-400">Completed:</span>{" "}
            <strong className="text-emerald-600 font-bold">{completedCount}</strong>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">
            Transaction Records ({payments.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-grade payment log for SaaS billing
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Transaction ID</th>
                <th className="py-3.5 px-4">Organization</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Gateway</th>
                <th className="py-3.5 px-4">External Reference</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No payment transactions recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isCompleted = p.status === "COMPLETED" || p.status === "PAID";
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700 text-[11px]">
                        {p.id}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <Link
                          href={`/super-admin/organizations/${p.organizationId}`}
                          className="hover:text-indigo-600 hover:underline"
                        >
                          {p.organizationName}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        ${p.amount.toFixed(2)} {p.currency}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                            isCompleted
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : p.status === "PENDING"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                          {p.provider}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {p.externalPaymentId || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/super-admin/organizations/${p.organizationId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                        >
                          <span>Dossier</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
