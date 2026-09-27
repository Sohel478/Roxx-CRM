import Link from "next/link";
import { Layers, ShieldCheck } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/20 py-12 lg:py-16">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand Col */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center space-x-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Layers className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">
                Roxx<span className="text-indigo-600">CRM</span>
              </span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground leading-relaxed">
              Enterprise-grade multi-tenant CRM SaaS designed for modern sales teams. 
              Accelerate pipeline velocity, automate follow-ups, and convert leads with precision.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Systems Operational (99.98% Uptime)</span>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-foreground">Product</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/features" className="hover:text-foreground transition">Features</Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground transition">Pricing</Link>
              </li>
              <li>
                <Link href="/demo" className="hover:text-foreground transition">Live Demo</Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-foreground transition">Start Free Trial</Link>
              </li>
            </ul>
          </div>

          {/* Platform & Security */}
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-foreground">Platform</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/login" className="hover:text-foreground transition">Sign In</Link>
              </li>
              <li>
                <Link href="/super-admin" className="hover:text-foreground transition">Super Admin</Link>
              </li>
              <li>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> Isolated Tenants
                </span>
              </li>
              <li>
                <span className="text-xs text-muted-foreground">Neon PostgreSQL Engine</span>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-foreground">Legal & Privacy</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/privacy" className="hover:text-foreground transition">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground transition">Terms of Service</Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground transition">Support & Contact</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Roxx CRM SaaS Inc. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built with Next.js, Prisma & Tailwind CSS
          </p>
        </div>
      </div>
    </footer>
  );
}
