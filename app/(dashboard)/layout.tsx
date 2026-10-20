import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { DemoBanner } from "@/components/layout/demo-banner";
import { getSession } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Super Admin is for platform administration only - strictly isolated from tenant CRM
  if (session.isSuperAdmin) {
    redirect("/super-admin/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar navigation */}
      <Sidebar session={session} />

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen min-w-0">
        {session.isDemo && <DemoBanner />}
        <Navbar session={session} />
        <main className="flex-1 p-4 sm:p-6 w-full min-w-0 max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
