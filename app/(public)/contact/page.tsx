import { PublicNavbar } from "@/components/public/navbar";
import { PublicFooter } from "@/components/public/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { getSession } from "@/lib/auth/session";

export default async function ContactPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNavbar isAuthenticated={Boolean(session)} />

      <main className="flex-1 py-16 sm:py-24">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Get in Touch</span>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
              We&apos;re Here to Help
            </h1>
            <p className="mt-3 text-muted-foreground text-sm sm:text-base">
              Have questions about our multi-tenant SaaS architecture, enterprise pricing, or custom integrations? Contact our product team.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 bg-card border border-border rounded-2xl p-8 sm:p-12 shadow-sm">
            {/* Contact Details */}
            <div className="flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-foreground">Talk to our Sales & Solutions Team</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  We respond to all enterprise inquiries within 2 business hours.
                </p>

                <div className="mt-8 space-y-5 text-sm">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <span>support@roxx-crm.com</span>
                  </div>

                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                      <Phone className="h-4 w-4" />
                    </div>
                    <span>+1 (800) 555-ROXX</span>
                  </div>

                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <span>San Francisco, CA & Remote Worldwide</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 rounded-lg bg-muted/40 p-4 border border-border/50 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Need Immediate Sandbox Testing?</p>
                <p className="mt-1">
                  You can explore our interactive Live Demo directly without waiting for a sales call.
                </p>
              </div>
            </div>

            {/* Inquiry Form */}
            <div className="flex flex-col space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Full Name</label>
                <Input placeholder="Sarah Connor" className="mt-1.5" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Work Email</label>
                <Input type="email" placeholder="sarah@company.com" className="mt-1.5" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Company Name</label>
                <Input placeholder="Cyberdyne Systems" className="mt-1.5" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Message</label>
                <textarea
                  rows={4}
                  placeholder="How can we assist your revenue team?"
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 font-semibold mt-2">
                <Send className="mr-2 h-4 w-4" />
                Send Inquiry
              </Button>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
