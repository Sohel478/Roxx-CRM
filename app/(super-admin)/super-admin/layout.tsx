import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
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
    redirect("/login?callbackUrl=/super-admin/dashboard");
  }

  if (!session.isSuperAdmin) {
    redirect("/dashboard");
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
