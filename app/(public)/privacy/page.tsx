import { PublicNavbar } from "@/components/public/navbar";
import { PublicFooter } from "@/components/public/footer";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNavbar />
      <main className="flex-1 py-16 sm:py-24">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 prose dark:prose-invert">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground mt-2">Last Updated: 27 September 2026</p>
          <div className="mt-8 space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-foreground">1. Information We Collect</h2>
              <p className="mt-2">
                We collect information you provide directly to us when creating an organization, inviting team members, logging activities, and importing business contacts.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-bold text-foreground">2. Tenant Isolation & Data Security</h2>
              <p className="mt-2">
                We implement strict row-level and application-level isolation. Your data is encrypted in transit using TLS 1.3 and at rest using Neon PostgreSQL AES-256 storage encryption.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-bold text-foreground">3. No Sale of Customer Data</h2>
              <p className="mt-2">
                We never sell, rent, or monetize your CRM contacts, leads, or business records to any third party. Your CRM data is strictly yours.
              </p>
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
