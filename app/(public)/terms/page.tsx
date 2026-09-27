import { PublicNavbar } from "@/components/public/navbar";
import { PublicFooter } from "@/components/public/footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNavbar />
      <main className="flex-1 py-16 sm:py-24">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 prose dark:prose-invert">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">Terms of Service</h1>
          <p className="text-xs text-muted-foreground mt-2">Last Updated: 27 September 2026</p>
          <div className="mt-8 space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-foreground">1. Acceptance of Terms</h2>
              <p className="mt-2">
                By accessing and using Roxx CRM (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-bold text-foreground">2. Multi-Tenant Organization Accounts</h2>
              <p className="mt-2">
                Each customer registers as a distinct Organization. You are responsible for safeguarding your credentials and the actions of users invited to your tenant account.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-bold text-foreground">3. Subscriptions & Free Trials</h2>
              <p className="mt-2">
                New accounts receive a 30-day Free Trial. Upon expiration, write access is suspended unless upgraded to an active subscription. Customer data remains protected and preserved.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-bold text-foreground">4. Customer Data Ownership</h2>
              <p className="mt-2">
                You retain all rights, title, and interest in your CRM business data (leads, contacts, companies, opportunities, activities). You may export your records via CSV at any time.
              </p>
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
