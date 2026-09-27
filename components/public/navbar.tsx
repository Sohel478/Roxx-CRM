"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Layers,
  ArrowRight,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PublicNavbarProps {
  isAuthenticated?: boolean;
}

export function PublicNavbar({ isAuthenticated = false }: PublicNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
            <Layers className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            Roxx<span className="text-indigo-600">CRM</span>
          </span>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
            SaaS
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center space-x-8 md:flex">
          <Link
            href="/features"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Pricing
          </Link>
          <Link
            href="/demo"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-indigo-600"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Live Demo
          </Link>
          <Link
            href="/contact"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Contact
          </Link>
        </nav>

        {/* Action Buttons */}
        <div className="hidden items-center space-x-3 md:flex">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                Go to Dashboard
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/demo">
                <Button variant="ghost" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Explore Demo
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="text-sm font-medium">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-indigo-600 shadow-sm shadow-indigo-600/20 hover:bg-indigo-700">
                  Start Free Trial
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-border bg-background px-4 pt-2 pb-6 md:hidden">
          <div className="flex flex-col space-y-3">
            <Link
              href="/features"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/demo"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              Live Demo
            </Link>
            <Link
              href="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Contact
            </Link>
            <div className="pt-2">
              {isAuthenticated ? (
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                    Go to Dashboard
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full">
                      Login
                    </Button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                      Start 30-Day Free Trial
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
