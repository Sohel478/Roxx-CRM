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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter */}
            <div className="rounded-xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between shadow-sm relative">
              <div className="mb-4">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  30-Day Free Trial Included
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Starter</h3>
                <p className="text-xs text-muted-foreground mt-1">For small teams building momentum</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">₹250</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>
                <div className="mt-6 border-t border-border/60 pt-6 space-y-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>Up to 20</strong> Team Seats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>10,000</strong> Leads</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>5,000</strong> Companies & Contacts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>5,000</strong> Opportunities</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>3</strong> Pipelines</span>
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

            {/* Growth */}
            <div className="rounded-xl border-2 border-indigo-600 bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xl shadow-indigo-600/10 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Best Value
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Growth</h3>
                <p className="text-xs text-muted-foreground mt-1">For expanding teams and scaling revenue</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">₹450</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>
                <div className="mt-6 border-t border-border/60 pt-6 space-y-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>21 to 50</strong> Team Seats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>50,000</strong> Leads</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>25,000</strong> Companies & Contacts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>25,000</strong> Opportunities</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>10</strong> Custom Pipelines</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Advanced Analytics & Win/Loss</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Developer API Access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>AI Lead Scoring</span>
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <Link href="/signup?plan=growth">
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700">Start 30-Day Free Trial</Button>
                </Link>
              </div>
            </div>

            {/* Enterprise */}
            <div className="rounded-xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-foreground">Enterprise</h3>
                <p className="text-xs text-muted-foreground mt-1">For large-scale organizations</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">Custom</span>
                  <span className="text-xs text-muted-foreground">pricing</span>
                </div>
                <div className="mt-6 border-t border-border/60 pt-6 space-y-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>50+</strong> Team Seats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>Unlimited</strong> Leads & Records</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Unlimited Pipelines</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Enterprise Audit Trail</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Dedicated DB Connection Pool</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>99.99% SLA Uptime</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Dedicated Account Manager</span>
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <Link href="/contact">
                  <Button variant="outline" className="w-full">Contact Us</Button>
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
