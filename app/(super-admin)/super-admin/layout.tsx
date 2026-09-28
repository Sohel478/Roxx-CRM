import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { SuperAdminSidebar } from "@/components/admin/super-admin-sidebar";
import { SuperAdminHeader } from "@/components/admin/super-admin-header";

export const metadata = {
  title: "Super Admin Console | Roxx CRM SaaS",
  description: "Platform Administration, Multi-Tenant Management, and Billing",
};

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login?callbackUrl=/super-admin/dashboard&portal=super_admin");
  }

  if (!session.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Super Admin Access Restricted</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            You are currently signed in as <span className="font-semibold text-slate-200">{session.email}</span> ({session.organizationName || "Tenant"}).
            <br />
            The Super Admin Portal is strictly reserved for the SaaS Owner (<span className="text-purple-400 font-medium">sohel@techflux.in</span>).
          </p>
          <div className="space-y-3">
            <Link
              href="/login?callbackUrl=/super-admin/dashboard&portal=super_admin&reset=1"
              className="w-full inline-flex items-center justify-center py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              Sign In as Super Admin
            </Link>
            <Link
              href="/dashboard"
              className="w-full inline-flex items-center justify-center py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg border border-slate-700 transition-colors"
            >
              Return to Tenant CRM
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Super Admin fixed sidebar */}
      <SuperAdminSidebar user={{ name: session.name, email: session.email }} />

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <SuperAdminHeader />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
