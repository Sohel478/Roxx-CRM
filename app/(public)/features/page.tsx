import Link from "next/link";
import { PublicNavbar } from "@/components/public/navbar";
import { PublicFooter } from "@/components/public/footer";
import { Button } from "@/components/ui/button";
import {
  Kanban,
  Zap,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";

export default async function FeaturesPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNavbar isAuthenticated={Boolean(session)} />

      <main className="flex-1 py-16 sm:py-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Enterprise Capabilities</span>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
              Built for Pipeline Velocity & Team Accountability
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground">
              Explore the detailed features designed to keep your sales reps focused on closing deals and your leadership informed with real-time analytics.
            </p>
          </div>

          <div className="space-y-16">
            {/* Feature Row 1: Pipeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 mb-3">
                  <Kanban className="h-4 w-4" />
                  <span>Dynamic Kanban Pipelines</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Visually Track Every Deal from Discovery to Won
                </h2>
                <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
                  Never lose visibility into where your deals stand. Move opportunities effortlessly across custom sales stages. View aggregate deal totals, win probability percentages, and projected close dates in real time.
                </p>
                <ul className="mt-6 space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Configurable probabilities and stages per organization</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Closed Lost analysis with mandatory loss reason capture</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Confetti celebrations and instant team milestone alerts</span>
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-card p-6 shadow-md">
                <div className="rounded-lg bg-muted/40 p-4 border border-border/50 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-border/40 font-semibold">
                    <span>Active Opportunities</span>
                    <span className="text-indigo-600 font-bold">$342,000 Total Value</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="p-3 bg-card rounded border border-border shadow-sm">
                      <p className="font-semibold text-foreground">Enterprise Fleet Contract</p>
                      <p className="text-muted-foreground text-[11px]">Apex Logistics Inc.</p>
                      <div className="mt-2 flex justify-between font-bold text-[11px]">
                        <span>$85,000</span>
                        <span className="text-indigo-600">Proposal (60%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Row 2: Leads & Conversion */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 rounded-xl border border-border bg-card p-6 shadow-md">
                <div className="rounded-lg bg-muted/40 p-4 border border-border/50 text-xs space-y-3">
                  <div className="p-3 bg-card rounded border border-border shadow-sm flex items-center justify-between">
                    <div>
                      <p className="font-bold text-foreground">Lead: Jonathan Miller</p>
                      <p className="text-muted-foreground text-[11px]">jmiller@starlight.io • +1 415-555-0199</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">Hot</span>
                  </div>
                  <div className="p-2.5 rounded bg-indigo-50/50 border border-indigo-200/50 text-indigo-900 dark:text-indigo-300 text-[11px]">
                    ✓ Verified: Zero duplicates found. Ready for 1-click Opportunity conversion.
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 mb-3">
                  <Zap className="h-4 w-4" />
                  <span>Lead Intelligence & Conversion</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Zero Clutter, Zero Duplicate Inquiries
                </h2>
                <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
                  Real-time duplicate checks scan email and normalized phone numbers before saving. When a prospect is ready to buy, convert the lead in 1-click into paired Company, Contact, and Opportunity records.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-20 text-center rounded-2xl bg-indigo-600 text-white p-10 sm:p-14 shadow-xl shadow-indigo-600/20">
            <h3 className="text-2xl sm:text-3xl font-bold">Ready to accelerate your revenue pipeline?</h3>
            <p className="mt-3 text-indigo-100 max-w-xl mx-auto text-sm">
              Start your 30-day Free Trial now. No credit card required. Up and running in 60 seconds.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="bg-white text-indigo-700 hover:bg-slate-100 font-bold px-8">
                  Start 30-Day Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10">
                  Try Live Demo (No Signup)
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
