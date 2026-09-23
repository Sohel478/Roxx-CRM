import Link from "next/link";
import {
  Users2,
  Kanban,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from "lucide-react";

export default function DashboardPage() {
  const stats = [
    {
      title: "New Leads",
      value: "24",
      change: "+12% this week",
      trend: "up",
      icon: Users2,
      color: "text-blue-600 bg-blue-50 border-blue-100",
    },
    {
      title: "Follow-ups Today",
      value: "8",
      change: "2 overdue",
      trend: "alert",
      icon: Clock,
      color: "text-amber-600 bg-amber-50 border-amber-100",
    },
    {
      title: "Open Pipeline Value",
      value: "$142,500",
      change: "18 active deals",
      trend: "neutral",
      icon: Kanban,
      color: "text-purple-600 bg-purple-50 border-purple-100",
    },
    {
      title: "Won This Month",
      value: "$38,400",
      change: "4 deals closed",
      trend: "up",
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sales Dashboard</h1>
          <p className="text-sm text-slate-500">
            Welcome back! Here is what requires your attention today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/leads"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            Create Lead
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {stat.title}
                </span>
                <div className={`p-2 rounded-lg border ${stat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">
                  {stat.value}
                </span>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <span>{stat.change}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid: Pipeline Stages & Today's Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Overview Card */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Pipeline by Stage</h2>
              <p className="text-xs text-slate-500">Current distribution of active opportunities</p>
            </div>
            <Link
              href="/opportunities"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View Kanban <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Simple Pipeline Bars */}
          <div className="space-y-3 pt-2">
            {[
              { stage: "New / Qualified", count: 6, value: "$28,000", pct: "70%" },
              { stage: "Discovery", count: 4, value: "$32,500", pct: "50%" },
              { stage: "Proposal Sent", count: 5, value: "$45,000", pct: "65%" },
              { stage: "Negotiation", count: 3, value: "$37,000", pct: "40%" },
            ].map((item) => (
              <div key={item.stage} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span>{item.stage} ({item.count} deals)</span>
                  <span className="font-semibold text-slate-900">{item.value}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: item.pct }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Follow-up Reminders */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Today&apos;s Follow-ups</h2>
            <Link
              href="/tasks"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {[
              {
                title: "Call Ahmed at Acme Corp",
                time: "11:00 AM",
                type: "Call",
                isOverdue: false,
              },
              {
                title: "Send updated proposal to TechNova",
                time: "02:30 PM",
                type: "Email",
                isOverdue: false,
              },
              {
                title: "Follow up on contract review",
                time: "Yesterday",
                type: "Task",
                isOverdue: true,
              },
            ].map((task, i) => (
              <div
                key={i}
                className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex items-start justify-between gap-2"
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-900">{task.title}</p>
                  <p className="text-[11px] text-slate-500">Due: {task.time}</p>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                    task.isOverdue
                      ? "bg-red-50 text-red-700 border border-red-100"
                      : "bg-blue-50 text-blue-700 border border-blue-100"
                  }`}
                >
                  {task.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
