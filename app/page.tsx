import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { PublicNavbar } from "@/components/public/navbar";
import { PublicFooter } from "@/components/public/footer";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Kanban,
  Users,
  BarChart3,
  ShieldCheck,
  Zap,
  FileSpreadsheet,
  Check,
  ChevronRight,
  HelpCircle,
} from "lucide-react";

export default async function LandingPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* 1. Header */}
      <PublicNavbar isAuthenticated={Boolean(session)} />

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.25),rgba(0,0,0,0))]" />
        
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Announcement Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3.5 py-1 text-xs font-medium text-indigo-700 backdrop-blur dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Roxx CRM SaaS 2.0 Live — Complete Multi-Tenant Platform</span>
            <ChevronRight className="h-3 w-3 text-indigo-500" />
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl mx-auto leading-tight">
            The Modern <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">Multi-Tenant CRM</span> Built for High-Velocity Teams
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Accelerate your pipeline from first touch to closed-won. Complete tenant data isolation, 
            intelligent deduplication, 360° contact dossiers, and real-time sales forecasting.
          </p>

          {/* Primary Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/25 text-base font-semibold w-full sm:w-auto">
                Start 30-Day Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base font-semibold w-full sm:w-auto border-border hover:bg-muted">
                <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                Explore Live Demo (1-Click)
              </Button>
            </Link>
          </div>

          {/* Trust Guarantees */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Dedicated tenant isolation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Setup in under 60 seconds</span>
            </div>
          </div>

          {/* Product Preview Card */}
          <div className="mt-14 relative mx-auto max-w-5xl rounded-xl border border-border/80 bg-card p-3 shadow-2xl shadow-indigo-500/10 dark:shadow-indigo-950/20">
            <div className="rounded-lg border border-border/50 bg-background/90 p-4 sm:p-6 overflow-hidden text-left">
              {/* Fake UI Header Bar */}
              <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-5">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-red-400/80" />
                  <div className="h-3 w-3 rounded-full bg-amber-400/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400/80" />
                  <span className="ml-3 text-xs text-muted-foreground font-mono">app.roxx-crm.com/opportunities</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                    Live Pipeline
                  </span>
                  <span className="text-xs font-semibold text-foreground">$428,500 Active Pipeline</span>
                </div>
              </div>

              {/* Mini Pipeline Kanban Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {/* Column 1: Discovery */}
                <div className="rounded-lg bg-muted/40 p-3 border border-border/40">
                  <div className="flex items-center justify-between font-semibold pb-2 border-b border-border/40">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">1. Discovery</span>
                    <span className="text-[10px] text-muted-foreground">3 Deals</span>
                  </div>
                  <div className="mt-2.5 space-y-2">
                    <div className="rounded-md bg-card p-2.5 shadow-sm border border-border">
                      <p className="font-semibold text-foreground text-xs">Cloud Migration Package</p>
                      <p className="text-[11px] text-muted-foreground">Acme Global Corp</p>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="font-bold text-foreground">$45,000</span>
                        <span className="text-amber-500 font-medium">30% Win Prob</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Proposal */}
                <div className="rounded-lg bg-muted/40 p-3 border border-border/40">
                  <div className="flex items-center justify-between font-semibold pb-2 border-b border-border/40">
                    <span className="text-amber-600 dark:text-amber-400 font-bold">2. Proposal</span>
                    <span className="text-[10px] text-muted-foreground">4 Deals</span>
                  </div>
                  <div className="mt-2.5 space-y-2">
                    <div className="rounded-md bg-card p-2.5 shadow-sm border border-border">
                      <p className="font-semibold text-foreground text-xs">Enterprise Seat Expansion</p>
                      <p className="text-[11px] text-muted-foreground">Starlight Media Ltd</p>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="font-bold text-foreground">$120,000</span>
                        <span className="text-amber-500 font-medium">60% Win Prob</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 3: Negotiation */}
                <div className="rounded-lg bg-muted/40 p-3 border border-border/40">
                  <div className="flex items-center justify-between font-semibold pb-2 border-b border-border/40">
                    <span className="text-orange-600 dark:text-orange-400 font-bold">3. Negotiation</span>
                    <span className="text-[10px] text-muted-foreground">2 Deals</span>
                  </div>
                  <div className="mt-2.5 space-y-2">
                    <div className="rounded-md bg-card p-2.5 shadow-sm border border-border">
                      <p className="font-semibold text-foreground text-xs">Annual Retainer Contract</p>
                      <p className="text-[11px] text-muted-foreground">Apex Financial Partners</p>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="font-bold text-foreground">$85,000</span>
                        <span className="text-orange-500 font-medium">80% Win Prob</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 4: Closed Won */}
                <div className="rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 p-3 border border-emerald-200/50 dark:border-emerald-800/40">
                  <div className="flex items-center justify-between font-semibold pb-2 border-b border-emerald-200/40">
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">4. Closed Won</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">✓ 100%</span>
                  </div>
                  <div className="mt-2.5 space-y-2">
                    <div className="rounded-md bg-card p-2.5 shadow-sm border border-emerald-200 dark:border-emerald-900">
                      <p className="font-semibold text-foreground text-xs">Global CRM Rollout</p>
                      <p className="text-[11px] text-muted-foreground">Nexus Technologies</p>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">$178,500</span>
                        <span className="font-bold text-emerald-600">WON 🎉</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core CRM Features Grid */}
      <section id="features" className="py-20 border-t border-border/40 bg-muted/10">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Built for Modern Sales Workflows</span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Everything Your Revenue Engine Demands
            </h2>
            <p className="mt-4 text-muted-foreground">
              Eliminate friction between marketing, business development, and account executives.
              Every feature is built for speed, transparency, and data integrity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 mb-4">
                <Kanban className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Multi-Pipeline Kanban Board</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Drag-and-drop opportunity cards between dynamic pipeline stages. Real-time probability calculations, deal aging indicators, and instant loss reason tracking.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mb-4">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Intelligent Lead Deduplication</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Detect matching emails and normalized phone numbers before saving. Convert qualified leads in 1-click into paired Company, Contact, and Opportunity records.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 mb-4">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">360° Contact Dossier & Timeline</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Complete audit trails of all interactions. Log phone calls, meeting notes, sales emails with merge tags, and manage assigned follow-up tasks in one unified view.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 mb-4">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Revenue Analytics & Funnels</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Gain deep visibility into pipeline conversion velocity, lead source ROI, loss reason root causes, and individual sales rep leaderboards.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Multi-Tenant Data Isolation</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Every query is automatically scoped to the authenticated organization. No cross-tenant leakage. Role-based access controls for Admins, Managers, and Sales Users.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 mb-4">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Bulk CSV Import & Export</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Migrate smoothly from spreadsheets or legacy CRMs. Validate rows against schema rules, download failure error logs, and export your entire dataset anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works (3 Steps) */}
      <section className="py-20 border-t border-border/40">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Quick Time to Value</span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Up and Running in 3 Simple Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-lg mb-4">
                1
              </div>
              <h3 className="text-lg font-bold text-foreground">Sign Up Your Organization</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your company name and email. Your dedicated tenant workspace and 30-day Free Trial is provisioned instantly.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-lg mb-4">
                2
              </div>
              <h3 className="text-lg font-bold text-foreground">Import & Configure Deals</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Import leads via CSV or manually create opportunities. Customize your sales stages, probabilities, and win/loss rules.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-lg mb-4">
                3
              </div>
              <h3 className="text-lg font-bold text-foreground">Accelerate Pipeline & Close</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Assign leads, automate daily task follow-ups, collaborate across reps, and track your revenue growth with live reporting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Pricing Section */}
      <section id="pricing" className="py-20 border-t border-border/40 bg-muted/10">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Transparent Plans</span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Predictable Pricing Built to Scale With You
            </h2>
            <p className="mt-4 text-muted-foreground">
              Start free for 30 days. No hidden fees or lock-ins. Upgrade or downgrade anytime directly from your dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Starter Plan */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between shadow-sm hover:border-indigo-300 transition">
              <div>
                <h3 className="text-lg font-bold text-foreground">Starter</h3>
                <p className="mt-1 text-xs text-muted-foreground">Best for small sales squads</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-foreground">$29</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>Up to <strong>3 Team Members</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span><strong>1,000</strong> Leads</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span><strong>500</strong> Opportunities</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>1 Pipeline</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>CSV Import / Export</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <Link href="/signup?plan=starter">
                  <Button variant="outline" className="w-full">Start Free Trial</Button>
                </Link>
              </div>
            </div>

            {/* Professional Plan (Popular) */}
            <div className="rounded-xl border-2 border-indigo-600 bg-card p-6 flex flex-col justify-between shadow-lg shadow-indigo-600/10 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Most Popular
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Professional</h3>
                <p className="mt-1 text-xs text-muted-foreground">For scaling sales engines</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-foreground">$79</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>Up to <strong>10 Team Members</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span><strong>10,000</strong> Leads</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span><strong>5,000</strong> Opportunities</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span><strong>5</strong> Custom Pipelines</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>Advanced Reports & Leaderboards</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>API Access</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <Link href="/signup?plan=professional">
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700">Start Free Trial</Button>
                </Link>
              </div>
            </div>

            {/* Business Plan */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between shadow-sm hover:border-indigo-300 transition">
              <div>
                <h3 className="text-lg font-bold text-foreground">Business</h3>
                <p className="mt-1 text-xs text-muted-foreground">For multi-team organizations</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-foreground">$199</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>Up to <strong>25 Team Members</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span><strong>50,000</strong> Leads</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span><strong>25,000</strong> Opportunities</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span><strong>20</strong> Custom Pipelines</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>Full Audit Logs & Security</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>AI Lead Scoring & Assist</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <Link href="/signup?plan=business">
                  <Button variant="outline" className="w-full">Start Free Trial</Button>
                </Link>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between shadow-sm hover:border-indigo-300 transition">
              <div>
                <h3 className="text-lg font-bold text-foreground">Enterprise</h3>
                <p className="mt-1 text-xs text-muted-foreground">Custom scale & compliance</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-foreground">$499</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span><strong>100+</strong> Team Members</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span><strong>250,000+</strong> Leads</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>Unlimited Pipelines</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>Dedicated Account Manager</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>Custom SLAs & Neon Postgres Pool</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <Link href="/contact">
                  <Button variant="outline" className="w-full">Contact Sales</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Demo CTA Banner */}
      <section className="py-16 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur mb-4">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Interactive Demo Organization</span>
          </div>
          <h2 className="text-3xl font-bold sm:text-4xl tracking-tight">
            Want to see Roxx CRM in action before signing up?
          </h2>
          <p className="mt-4 text-indigo-100 max-w-xl mx-auto text-sm sm:text-base">
            Explore our preloaded sandbox with realistic companies, leads, kanban deals, and reporting charts. Zero configuration needed.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/demo">
              <Button size="lg" className="bg-white text-indigo-900 hover:bg-slate-100 font-bold px-8">
                Launch Live Demo Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10">
                Create My Organization
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. FAQ Section */}
      <section className="py-20 border-t border-border/40">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Frequently Asked Questions</span>
            <h2 className="mt-2 text-3xl font-bold text-foreground">Common Inquiries</h2>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600" />
                How does multi-tenant data isolation work?
              </h4>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed pl-6">
                Every customer account is provisioned as an independent Organization. All database queries for leads, contacts, deals, and activities are strictly bound to your organization ID on the server side. No other customer can access your data.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600" />
                What happens when the 30-day Free Trial ends?
              </h4>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed pl-6">
                Your data is never deleted. When a trial expires, write operations are temporarily paused while read access remains intact. You can upgrade to any subscription plan at any time to resume write access immediately.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600" />
                Can I export our CRM records if we ever decide to leave?
              </h4>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed pl-6">
                Yes! You maintain complete ownership of your business records. Roxx CRM provides 1-click CSV export for Leads, Companies, Contacts, and Opportunities whenever you need it.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600" />
                Can Super Admins extend trials or customize plan limits?
              </h4>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed pl-6">
                Yes. Through the platform Super Admin portal, administrators can extend trials, configure custom plan limits, adjust subscription renewal dates, and inspect usage snapshots.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <PublicFooter />
    </div>
  );
}
