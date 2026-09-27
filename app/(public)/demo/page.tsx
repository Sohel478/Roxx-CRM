"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicNavbar } from "@/components/public/navbar";
import { PublicFooter } from "@/components/public/footer";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ShieldCheck,
  ArrowRight,
  UserCheck,
  Briefcase,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { loginAsDemoAction } from "@/actions/demo";

export default function DemoPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleLaunchDemo = (role: "ADMIN" | "SALES_USER") => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await loginAsDemoAction(role);
        if (res.success) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setError(res.error || "Failed to launch demo session");
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Something went wrong launching demo";
        setError(errorMsg);
      }
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNavbar />

      <main className="flex-1 py-16 sm:py-24">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 mb-4 border border-amber-200 dark:border-amber-800/40">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Instant Sandbox Environment</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
              Experience Roxx CRM in Live Demo Mode
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground">
              Test drive the entire CRM product without creating an account or providing a credit card.
              Preloaded with realistic leads, companies, pipeline deals, follow-up tasks, and sales activity logs.
            </p>
          </div>

          {error && (
            <div className="mb-8 max-w-md mx-auto rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Launch Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Demo Admin */}
            <div className="rounded-xl border-2 border-indigo-500/40 bg-card p-8 shadow-lg shadow-indigo-500/5 flex flex-col justify-between hover:border-indigo-600 transition">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 mb-5">
                  <UserCheck className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Explore as Organization Admin</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Full administrative permissions. Inspect team member settings, pipeline configuration, audit trails, and global sales dashboards.
                </p>
                <div className="mt-6 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Manage all leads, companies, and opportunities</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Configure custom sales pipeline stages</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>View team productivity reports & leaderboards</span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Button
                  onClick={() => handleLaunchDemo("ADMIN")}
                  disabled={isPending}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold shadow-md shadow-indigo-600/20"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Launching Demo...
                    </>
                  ) : (
                    <>
                      Launch as Demo Admin
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Demo Sales User */}
            <div className="rounded-xl border border-border bg-card p-8 shadow-sm flex flex-col justify-between hover:border-border/80 transition">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mb-5">
                  <Briefcase className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Explore as Sales Representative</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Experience daily sales workflow: manage assigned leads, log calls and meeting notes, drag deals across Kanban stages, and track tasks.
                </p>
                <div className="mt-6 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Assigned opportunity & lead pipeline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Inline activity logger & task completion</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Contact dossiers with email templates</span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Button
                  onClick={() => handleLaunchDemo("SALES_USER")}
                  disabled={isPending}
                  variant="outline"
                  className="w-full h-11 text-sm font-semibold border-border hover:bg-muted"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Launching Demo...
                    </>
                  ) : (
                    <>
                      Launch as Sales Rep
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Demo Sandbox Policy Callout */}
          <div className="mt-12 max-w-2xl mx-auto rounded-xl border border-border/60 bg-muted/30 p-5 text-xs text-muted-foreground">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Sandbox Security & Isolation Guarantee</p>
                <p className="mt-1 leading-relaxed">
                  The Demo Organization is isolated from live production customer tenants. Super Admin access and subscription modifications are restricted. 
                  Ready to test with your own team?{" "}
                  <Link href="/signup" className="text-indigo-600 font-semibold underline hover:text-indigo-700">
                    Create your own 30-Day Free Trial Organization →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
