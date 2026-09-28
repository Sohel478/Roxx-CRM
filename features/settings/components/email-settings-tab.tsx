"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Mail,
  ShieldCheck,
  Server,
  Key,
  User,
  AtSign,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getSmtpConfigAction,
  saveSmtpConfigAction,
  testSmtpConnectionAction,
} from "@/actions/email";
import type { SmtpConfigDisplay } from "@/lib/validations/email";

interface PresetConfig {
  name: string;
  host: string;
  port: number;
  secure: boolean;
  notes: string;
}

const PRESETS: Record<string, PresetConfig> = {
  gmail: {
    name: "Google Workspace / Gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    notes: "Requires a 16-character Google App Password (not your standard login password).",
  },
  m365: {
    name: "Microsoft 365 / Outlook",
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    notes: "Ensure SMTP AUTH is enabled for the mailbox in Microsoft 365 admin center.",
  },
  zoho: {
    name: "Zoho Mail",
    host: "smtppro.zoho.com",
    port: 465,
    secure: true,
    notes: "Use Zoho dedicated Application Specific Password with Port 465 SSL.",
  },
  custom: {
    name: "Custom SMTP Server",
    host: "",
    port: 587,
    secure: false,
    notes: "Configure your internal or hosted corporate SMTP relay server.",
  },
};

export function EmailSettingsTab() {
  const [config, setConfig] = useState<SmtpConfigDisplay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isTesting, setIsTesting] = useState(false);

  // Form State
  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Feedback states
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(null);
  const [testErrorMessage, setTestErrorMessage] = useState<string | null>(null);

  // Test modal state
  const [testRecipient, setTestRecipient] = useState("");
  const [showTestModal, setShowTestModal] = useState(false);

  const loadConfig = async () => {
    setIsLoading(true);
    const res = await getSmtpConfigAction();
    if (res.success && res.data) {
      setConfig(res.data);
      setHost(res.data.host || "");
      setPort(res.data.port || 587);
      setSecure(res.data.secure || false);
      setUsername(res.data.username || "");
      setPassword(res.data.hasPassword ? "••••••••••••" : "");
      setFromName(res.data.fromName || "");
      setFromEmail(res.data.fromEmail || "");
      if (res.data.fromEmail) {
        setTestRecipient(res.data.fromEmail);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleApplyPreset = (key: string) => {
    const preset = PRESETS[key];
    if (!preset) return;
    if (key !== "custom") {
      setHost(preset.host);
      setPort(preset.port);
      setSecure(preset.secure);
    }
    if (key === "gmail") {
      setShowGuide(true);
    }
  };

  const handleSave = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const res = await saveSmtpConfigAction({
        host,
        port: Number(port),
        secure,
        username,
        password: password === "••••••••••••" ? undefined : password,
        fromName,
        fromEmail,
      });

      if (res.success) {
        setSuccessMessage(res.message || "SMTP configuration saved securely!");
        await loadConfig();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setErrorMessage(res.error || "Failed to save SMTP configuration.");
      }
    });
  };

  const handleRunTest = async () => {
    if (!testRecipient.trim()) {
      setTestErrorMessage("Please enter a valid recipient email address for the test.");
      return;
    }

    setTestErrorMessage(null);
    setTestSuccessMessage(null);
    setIsTesting(true);

    try {
      const res = await testSmtpConnectionAction({
        recipientEmail: testRecipient.trim(),
        tempConfig: {
          host,
          port: Number(port),
          secure,
          username,
          password: password === "••••••••••••" ? undefined : password,
          fromName,
          fromEmail,
        },
      });

      if (res.success) {
        setTestSuccessMessage(res.message || "Connection verified! Test email delivered.");
      } else {
        setTestErrorMessage(res.error || "SMTP test failed.");
      }
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
        <p className="text-xs font-semibold">Loading organization email configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900">
                Email Relay &amp; Workspace SMTP
              </h2>
              {config?.isConfigured ? (
                <Badge variant="success" className="gap-1 text-[11px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected &amp; Verified
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 text-[11px] font-bold bg-amber-50 text-amber-700 border-amber-200">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Not Configured
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Connect your company&apos;s Google Workspace (Gmail), Microsoft 365, or corporate SMTP server to send sales emails directly to leads from Roxx CRM with zero shared platform fees.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowTestModal(true)}
            className="text-xs font-semibold gap-1.5 h-9"
          >
            <Send className="w-3.5 h-3.5 text-blue-600" />
            <span>Test Connection</span>
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 h-9 shadow-xs"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>Save Configuration</span>
          </Button>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      {/* Preset Quick Chooser */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Quick Setup Presets
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Click a provider to auto-fill host &amp; port settings</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(PRESETS).map(([key, p]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleApplyPreset(key)}
              className="text-left p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600">
                  {p.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                {p.notes}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Google Workspace App Password Step-by-Step Guide */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowGuide(!showGuide)}>
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs font-bold text-blue-950">
              Connecting Google Workspace or Gmail? (How to generate an App Password)
            </span>
          </div>
          <button
            type="button"
            className="text-xs font-bold text-blue-700 hover:text-blue-800"
          >
            {showGuide ? "Hide Guide ▲" : "View Instructions ▼"}
          </button>
        </div>

        {showGuide && (
          <div className="text-xs text-blue-900 space-y-2.5 pt-2 border-t border-blue-200/60 animate-in fade-in">
            <p className="leading-relaxed">
              Google Workspace and Gmail accounts require an <strong>App Password</strong> rather than your standard Google password when sending emails via external SMTP clients.
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1 font-medium leading-relaxed">
              <li>
                Open your{" "}
                <a
                  href="https://myaccount.google.com/security"
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-bold text-blue-700 inline-flex items-center gap-0.5"
                >
                  Google Account Security Settings <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Ensure <strong>2-Step Verification</strong> is switched ON.</li>
              <li>
                In the search bar at top of Google Account, type <strong>&quot;App passwords&quot;</strong> (or go to Security &gt; 2-Step Verification &gt; App Passwords).
              </li>
              <li>Create a new app name (e.g. <code className="bg-blue-100 px-1.5 py-0.5 rounded text-[11px] font-mono">Roxx CRM</code>) and click <strong>Create</strong>.</li>
              <li>Copy the generated 16-character code (e.g. <code className="bg-blue-100 px-1.5 py-0.5 rounded text-[11px] font-mono">abcd efgh ijkl mnop</code>) and paste it into the <strong>Password / App Password</strong> field below (without spaces).</li>
            </ol>
          </div>
        )}
      </div>

      {/* Main Configuration Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600" />
            <span>SMTP Server Connection Details</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Credentials are encrypted using AES-256-GCM before storage and never returned in plain text.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* SMTP Host */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              SMTP Host *
            </label>
            <div className="relative flex items-center">
              <Server className="absolute left-3 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="e.g. smtp.gmail.com"
                className="pl-9 text-xs font-medium"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Example: smtp.gmail.com, smtp.office365.com, smtppro.zoho.com
            </p>
          </div>

          {/* Port & Encryption */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Port *
              </label>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                placeholder="587"
                className="text-xs font-medium"
              />
              <p className="text-[11px] text-slate-400">587 (STARTTLS) or 465 (SSL)</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Encryption Protocol
              </label>
              <div className="flex items-center h-9">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={secure}
                    onChange={(e) => setSecure(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span>SSL/TLS (Port 465)</span>
                </label>
              </div>
              <p className="text-[11px] text-slate-400">Uncheck for 587 STARTTLS</p>
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Username / Auth Email *
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="sales@yourcompany.com"
                className="pl-9 text-xs font-medium"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Usually the full email address used to log into your mailbox
            </p>
          </div>

          {/* Password / App Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Password or App Password *
              </label>
              {config?.hasPassword && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Password Saved &amp; Encrypted
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <Key className="absolute left-3 w-4 h-4 text-slate-400" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={config?.hasPassword ? "•••••••••••• (Leave as is to keep existing)" : "Enter password or App Password"}
                className="pl-9 pr-9 text-xs font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Encrypted at rest with AES-256. For Google Workspace, enter your 16-character App Password.
            </p>
          </div>

          {/* Sender Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Sender Display Name *
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="e.g. Roxx Sales Team or John Doe"
                className="pl-9 text-xs font-medium"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              The name recipients see in their inbox header (e.g. &quot;Techflux Sales&quot;)
            </p>
          </div>

          {/* Sender Email Address */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Sender Email Address (&quot;From&quot;) *
            </label>
            <div className="relative flex items-center">
              <AtSign className="absolute left-3 w-4 h-4 text-slate-400" />
              <Input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="sales@yourcompany.com"
                className="pl-9 text-xs font-medium"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Must be authorized to send from your SMTP server (usually identical to username)
            </p>
          </div>
        </div>

        {/* Security Notice Footer */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              All SMTP passwords are encrypted using <strong>AES-256-GCM</strong> using tenant isolation. No emails are ever processed by external shared services.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTestModal(true)}
              className="text-xs font-semibold gap-1.5 h-9"
            >
              <Send className="w-3.5 h-3.5 text-blue-600" />
              <span>Test Connection</span>
            </Button>

            <Button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 h-9"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              <span>Save Changes</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Test Connection Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Test SMTP Connection &amp; Dispatch
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTestModal(false);
                  setTestErrorMessage(null);
                  setTestSuccessMessage(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              We will perform a TLS/SSL handshake with <strong>{host || "your SMTP server"}</strong> on port <strong>{port}</strong> and dispatch a live test email to verify end-to-end deliverability.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Recipient Email Address *
              </label>
              <Input
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="admin@yourcompany.com"
                className="text-xs font-medium"
              />
              <p className="text-[11px] text-slate-400">
                Enter your own email address to verify receipt in your inbox.
              </p>
            </div>

            {testSuccessMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{testSuccessMessage}</span>
              </div>
            )}

            {testErrorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold leading-relaxed">{testErrorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowTestModal(false);
                  setTestErrorMessage(null);
                  setTestSuccessMessage(null);
                }}
                className="text-xs"
              >
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleRunTest}
                disabled={isTesting || !testRecipient.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 font-bold"
              >
                {isTesting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isTesting ? "Verifying..." : "Send Test Email"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
