import Link from "next/link";
import { PublicNavbar } from "@/components/public/navbar";
import { PublicFooter } from "@/components/public/footer";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { getSession } from "@/lib/auth/session";

export default async function PricingPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNavbar isAuthenticated={Boolean(session)} />

      <main className="flex-1 py-16 sm:py-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Simple, Transparent Pricing</span>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
              Invest in Revenue Acceleration
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground">
              Every plan includes a 30-day full-featured trial, automatic database backups, and complete multi-tenant security isolation.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Starter */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between shadow-sm">
              <div>
                <h3 className="text-lg font-bold text-foreground">Starter</h3>
                <p className="text-xs text-muted-foreground mt-1">For small teams finding product-market fit</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">$29</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>
                <div className="mt-6 border-t border-border/60 pt-6 space-y-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>3</strong> Team Seats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>1,000</strong> Leads</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>500</strong> Companies</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>1,000</strong> Contacts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>500</strong> Opportunities</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>1 Pipeline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>CSV Import & Export</span>
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <Link href="/signup?plan=starter">
                  <Button variant="outline" className="w-full">Start 30-Day Free Trial</Button>
                </Link>
              </div>
            </div>

            {/* Professional */}
            <div className="rounded-xl border-2 border-indigo-600 bg-card p-6 flex flex-col justify-between shadow-xl shadow-indigo-600/10 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Best Value
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Professional</h3>
                <p className="text-xs text-muted-foreground mt-1">For growing revenue engines</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">$79</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>
                <div className="mt-6 border-t border-border/60 pt-6 space-y-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>10</strong> Team Seats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>10,000</strong> Leads</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>5,000</strong> Companies</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>10,000</strong> Contacts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>5,000</strong> Opportunities</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>5</strong> Custom Pipelines</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Advanced Analytics & Win/Loss</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Developer API Access</span>
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <Link href="/signup?plan=professional">
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700">Start 30-Day Free Trial</Button>
                </Link>
              </div>
            </div>

            {/* Business */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between shadow-sm">
              <div>
                <h3 className="text-lg font-bold text-foreground">Business</h3>
                <p className="text-xs text-muted-foreground mt-1">For multi-team departments</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">$199</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>
                <div className="mt-6 border-t border-border/60 pt-6 space-y-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>25</strong> Team Seats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>50,000</strong> Leads</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>25,000</strong> Companies</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>50,000</strong> Contacts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>25,000</strong> Opportunities</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>20</strong> Custom Pipelines</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Enterprise Audit Trail</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>AI Lead Scoring</span>
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <Link href="/signup?plan=business">
                  <Button variant="outline" className="w-full">Start 30-Day Free Trial</Button>
                </Link>
              </div>
            </div>

            {/* Enterprise */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between shadow-sm">
              <div>
                <h3 className="text-lg font-bold text-foreground">Enterprise</h3>
                <p className="text-xs text-muted-foreground mt-1">For mission-critical deployments</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">$499</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>
                <div className="mt-6 border-t border-border/60 pt-6 space-y-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>100+</strong> Team Seats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>250,000+</strong> Leads</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Unlimited Pipelines</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Dedicated DB Connection Pool</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>99.99% SLA Uptime</span>
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <Link href="/contact">
                  <Button variant="outline" className="w-full">Contact Sales</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
