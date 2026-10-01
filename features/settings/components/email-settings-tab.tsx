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
  Copy,
  Check,
  Inbox,
  RefreshCw,
  AlertTriangle,
  Globe,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getSmtpConfigAction,
  saveSmtpConfigAction,
  testSmtpConnectionAction,
  getImapConfigAction,
  saveImapConfigAction,
  testImapConnectionAction,
  checkDomainDeliverabilityAction,
} from "@/actions/email";
import type {
  SmtpConfigDisplay,
  ImapConfigDisplay,
  DnsDeliverabilityResult,
} from "@/lib/validations/email";

interface PresetConfig {
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  notes: string;
}

const PRESETS: Record<string, PresetConfig> = {
  gmail: {
    name: "Google Workspace / Gmail",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    notes: "Requires a 16-character Google App Password (not standard login password).",
  },
  m365: {
    name: "Microsoft 365 / Outlook",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
    notes: "Ensure SMTP AUTH & IMAP are enabled for the mailbox in Microsoft 365 admin center.",
  },
  zoho: {
    name: "Zoho Mail",
    smtpHost: "smtppro.zoho.com",
    smtpPort: 465,
    smtpSecure: true,
    imapHost: "imappro.zoho.com",
    imapPort: 993,
    imapSecure: true,
    notes: "Use Zoho dedicated Application Specific Password with Port 465/993 SSL.",
  },
  custom: {
    name: "Custom Mail Server",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    notes: "Configure your internal or hosted corporate SMTP relay & IMAP mailbox.",
  },
};

export function EmailSettingsTab() {
  const [activeSubTab, setActiveSubTab] = useState<"smtp" | "deliverability" | "imap">("smtp");
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfigDisplay | null>(null);
  const [imapConfig, setImapConfig] = useState<ImapConfigDisplay | null>(null);
  const [deliverability, setDeliverability] = useState<DnsDeliverabilityResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isImapPending, startImapTransition] = useTransition();

  // Outbound SMTP Form State
  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Inbound IMAP Form State
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState(993);
  const [imapSecure, setImapSecure] = useState(true);
  const [imapUsername, setImapUsername] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [showImapPassword, setShowImapPassword] = useState(false);

  // Feedback states
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imapSuccessMessage, setImapSuccessMessage] = useState<string | null>(null);
  const [imapErrorMessage, setImapErrorMessage] = useState<string | null>(null);

  // SMTP Test modal state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(null);
  const [testErrorMessage, setTestErrorMessage] = useState<string | null>(null);

  // IMAP Test modal state
  const [showImapTestModal, setShowImapTestModal] = useState(false);
  const [isTestingImap, setIsTestingImap] = useState(false);
  const [testImapSuccessMessage, setTestImapSuccessMessage] = useState<string | null>(null);
  const [testImapErrorMessage, setTestImapErrorMessage] = useState<string | null>(null);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [smtpRes, imapRes, delivRes] = await Promise.all([
        getSmtpConfigAction(),
        getImapConfigAction(),
        checkDomainDeliverabilityAction(),
      ]);

      if (smtpRes.success && smtpRes.data) {
        setSmtpConfig(smtpRes.data);
        setHost(smtpRes.data.host || "");
        setPort(smtpRes.data.port || 587);
        setSecure(smtpRes.data.secure || false);
        setUsername(smtpRes.data.username || "");
        setPassword(smtpRes.data.hasPassword ? "••••••••••••" : "");
        setFromName(smtpRes.data.fromName || "");
        setFromEmail(smtpRes.data.fromEmail || "");
        if (smtpRes.data.fromEmail) {
          setTestRecipient(smtpRes.data.fromEmail);
        }
      }

      if (imapRes.success && imapRes.data) {
        setImapConfig(imapRes.data);
        setImapHost(imapRes.data.host || "");
        setImapPort(imapRes.data.port || 993);
        setImapSecure(imapRes.data.secure ?? true);
        setImapUsername(imapRes.data.username || "");
        setImapPassword(imapRes.data.hasPassword ? "••••••••••••" : "");
      }

      if (delivRes.success && delivRes.data) {
        setDeliverability(delivRes.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApplyPreset = (key: string) => {
    const preset = PRESETS[key];
    if (!preset) return;
    if (key !== "custom") {
      setHost(preset.smtpHost);
      setPort(preset.smtpPort);
      setSecure(preset.smtpSecure);
      setImapHost(preset.imapHost);
      setImapPort(preset.imapPort);
      setImapSecure(preset.imapSecure);
    }
    if (key === "gmail") {
      setShowGuide(true);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSaveSmtp = () => {
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
        setSuccessMessage(res.message || "Outbound SMTP configuration saved securely!");
        await loadData();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setErrorMessage(res.error || "Failed to save SMTP configuration.");
      }
    });
  };

  const handleSaveImap = () => {
    setImapErrorMessage(null);
    setImapSuccessMessage(null);

    startImapTransition(async () => {
      const res = await saveImapConfigAction({
        host: imapHost,
        port: Number(imapPort),
        secure: imapSecure,
        username: imapUsername,
        password: imapPassword === "••••••••••••" ? undefined : imapPassword,
        useSmtpCredentials: false,
      });

      if (res.success) {
        setImapSuccessMessage(res.message || "Incoming mail (IMAP) settings saved!");
        await loadData();
        setTimeout(() => setImapSuccessMessage(null), 5000);
      } else {
        setImapErrorMessage(res.error || "Failed to save IMAP configuration.");
      }
    });
  };

  const handleSyncWithSmtpCredentials = () => {
    setImapUsername(username);
    if (password) {
      setImapPassword(password);
    }
    // Auto-detect IMAP host from SMTP host
    if (host.includes("gmail") || host.includes("google")) {
      setImapHost("imap.gmail.com");
      setImapPort(993);
      setImapSecure(true);
    } else if (host.includes("office365") || host.includes("outlook")) {
      setImapHost("outlook.office365.com");
      setImapPort(993);
      setImapSecure(true);
    } else if (host.includes("zoho")) {
      setImapHost("imappro.zoho.com");
      setImapPort(993);
      setImapSecure(true);
    } else if (host.startsWith("smtp.")) {
      setImapHost(host.replace(/^smtp\./, "imap."));
      setImapPort(993);
      setImapSecure(true);
    }
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

  const handleRunImapTest = async () => {
    setTestImapErrorMessage(null);
    setTestImapSuccessMessage(null);
    setIsTestingImap(true);

    try {
      const res = await testImapConnectionAction({
        tempConfig: {
          host: imapHost,
          port: Number(imapPort),
          secure: imapSecure,
          username: imapUsername,
          password: imapPassword === "••••••••••••" ? undefined : imapPassword,
        },
      });

      if (res.success) {
        setTestImapSuccessMessage(res.message || "IMAP connection verified! Authenticated successfully.");
      } else {
        setTestImapErrorMessage(res.error || "IMAP connection failed.");
      }
    } finally {
      setIsTestingImap(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
        <p className="text-xs font-semibold">Loading organization email configuration &amp; deliverability...</p>
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
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900">
                Email Suite: Send &amp; Receive (SMTP + CRM Inbox)
              </h2>
              {smtpConfig?.isConfigured ? (
                <Badge variant="success" className="gap-1 text-[11px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected: {smtpConfig.username}
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 text-[11px] font-bold bg-amber-50 text-amber-700 border-amber-200">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Mailbox Not Connected
                </Badge>
              )}
              {smtpConfig?.isConfigured && (
                <Badge variant="secondary" className="gap-1 text-[11px] font-bold bg-blue-50 text-blue-700 border-blue-200">
                  <Inbox className="w-3.5 h-3.5" />
                  Inbox Sync Connected
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Connect your company email account (e.g. {username || "infotflux@gmail.com"}) to send sales emails to leads and automatically receive and sync client replies directly in your CRM Inbox.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === "smtp" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowTestModal(true)}
                className="text-xs font-semibold gap-1.5 h-9"
              >
                <Send className="w-3.5 h-3.5 text-blue-600" />
                <span>Test Outbound</span>
              </Button>
              <Button
                type="button"
                onClick={handleSaveSmtp}
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 h-9 shadow-xs"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>Save &amp; Connect Mailbox</span>
              </Button>
            </>
          ) : activeSubTab === "imap" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowImapTestModal(true)}
                className="text-xs font-semibold gap-1.5 h-9"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                <span>Test IMAP</span>
              </Button>
              <Button
                type="button"
                onClick={handleSaveImap}
                disabled={isImapPending}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 h-9 shadow-xs"
              >
                {isImapPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>Save IMAP</span>
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={loadData}
              className="text-xs font-semibold gap-1.5 h-9"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>Refresh DNS Check</span>
            </Button>
          )}
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveSubTab("smtp")}
          className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
            activeSubTab === "smtp"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Outbound Mail (SMTP Relay)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("deliverability")}
          className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
            activeSubTab === "deliverability"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Deliverability &amp; Anti-Spam (SPF / DKIM / DMARC)</span>
          {deliverability && deliverability.score < 80 && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("imap")}
          className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
            activeSubTab === "imap"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>Incoming Mail (IMAP &amp; Reply Sync)</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* SUB-TAB 1: OUTBOUND SMTP */}
      {/* ============================================================== */}
      {activeSubTab === "smtp" && (
        <div className="space-y-6">
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

          {/* Quick Chooser */}
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
              <button type="button" className="text-xs font-bold text-blue-700 hover:text-blue-800">
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
                  <li>In the search bar at top of Google Account, type <strong>&quot;App passwords&quot;</strong>.</li>
                  <li>Create a new app name (e.g. <code className="bg-blue-100 px-1.5 py-0.5 rounded text-[11px] font-mono">Roxx CRM</code>) and click <strong>Create</strong>.</li>
                  <li>Copy the generated 16-character code (e.g. <code className="bg-blue-100 px-1.5 py-0.5 rounded text-[11px] font-mono">abcd efgh ijkl mnop</code>) and paste it into the password field below (without spaces).</li>
                </ol>
              </div>
            )}
          </div>

          {/* Main SMTP Form */}
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
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">SMTP Host *</label>
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Port *</label>
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
                  <label className="block text-xs font-bold text-slate-700">Encryption</label>
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

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Username / Auth Email *</label>
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
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">Password / App Password *</label>
                  {smtpConfig?.hasPassword && (
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
                    placeholder={smtpConfig?.hasPassword ? "•••••••••••• (Leave as is to keep existing)" : "Enter password or App Password"}
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
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Sender Display Name *</label>
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
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Sender Email Address (&quot;From&quot;) *</label>
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
                  Must align with your authenticated SMTP domain to satisfy SPF/DKIM policies.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                <span>
                  All credentials encrypted with <strong>AES-256-GCM</strong>. Emails send via your domain directly.
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
                  onClick={handleSaveSmtp}
                  disabled={isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 h-9"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 2: DELIVERABILITY & SPAM PREVENTION */}
      {/* ============================================================== */}
      {activeSubTab === "deliverability" && (
        <div className="space-y-6">
          {/* Health Score Overview */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Outbound Health Score
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {deliverability?.score ?? 50}/100
                  </span>
                  {(deliverability?.score ?? 0) >= 80 ? (
                    <Badge variant="success" className="text-xs font-bold">
                      Optimal Deliverability
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs font-bold bg-amber-50 text-amber-800 border-amber-300">
                      Needs DNS Authentication
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  Gmail, Outlook, and Yahoo strictly require SPF, DKIM, and DMARC DNS records to prevent outbound emails from being delivered to client Spam/Junk folders.
                </p>
              </div>

              {/* Sender Alignment Badge */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 text-xs space-y-1.5 max-w-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Sender Alignment</span>
                  {deliverability?.alignmentStatus === "aligned" ? (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Aligned ✓
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Mismatched ⚠️
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {deliverability?.alignmentDetails || "Configured sender matches authenticated account."}
                </p>
              </div>
            </div>

            {/* Recommendations List */}
            {deliverability && deliverability.recommendations.length > 0 && (
              <div className="pt-4 space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Recommended Deliverability Actions:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {deliverability.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 flex items-start gap-2.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* DNS Copy-Paste Records Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" />
                <span>Required DNS Authentication Records for @{deliverability?.domain || "yourdomain.com"}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Copy and add these TXT records in your domain registrar DNS settings (GoDaddy, Cloudflare, Namecheap, Route 53, etc.) to guarantee 100% inbox deliverability.
              </p>
            </div>

            <div className="space-y-4">
              {/* Record 1: SPF */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-bold text-[11px] bg-blue-50 text-blue-700 border-blue-200">
                      SPF Record
                    </Badge>
                    <span className="text-xs font-bold text-slate-800">
                      Host: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px]">@</code>
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(deliverability?.spf.record || "", "spf")}
                    className="h-7 text-xs font-semibold gap-1 text-slate-600 hover:text-slate-900"
                  >
                    {copiedKey === "spf" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Value</span>
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-xs text-slate-800 break-all select-all">
                  {deliverability?.spf.record || "v=spf1 include:_spf.google.com ~all"}
                </div>
                <p className="text-[11px] text-slate-500">
                  {deliverability?.spf.instructions}
                </p>
              </div>

              {/* Record 2: DKIM */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-bold text-[11px] bg-purple-50 text-purple-700 border-purple-200">
                      DKIM Record
                    </Badge>
                    <span className="text-xs font-bold text-slate-800">
                      Host: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px]">{deliverability?.dkim.selector || "default"}._domainkey</code>
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(deliverability?.dkim.record || "", "dkim")}
                    className="h-7 text-xs font-semibold gap-1 text-slate-600 hover:text-slate-900"
                  >
                    {copiedKey === "dkim" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Value</span>
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-xs text-slate-800 break-all select-all">
                  {deliverability?.dkim.record}
                </div>
                <p className="text-[11px] text-slate-500">
                  {deliverability?.dkim.instructions}
                </p>
              </div>

              {/* Record 3: DMARC */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-bold text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      DMARC Policy
                    </Badge>
                    <span className="text-xs font-bold text-slate-800">
                      Host: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px]">_dmarc</code>
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(deliverability?.dmarc.record || "", "dmarc")}
                    className="h-7 text-xs font-semibold gap-1 text-slate-600 hover:text-slate-900"
                  >
                    {copiedKey === "dmarc" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Value</span>
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-xs text-slate-800 break-all select-all">
                  {deliverability?.dmarc.record}
                </div>
                <p className="text-[11px] text-slate-500">
                  {deliverability?.dmarc.instructions}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 3: INCOMING MAIL (IMAP & CRM INBOX SYNC) */}
      {/* ============================================================== */}
      {activeSubTab === "imap" && (
        <div className="space-y-6">
          {imapSuccessMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{imapSuccessMessage}</span>
            </div>
          )}

          {imapErrorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{imapErrorMessage}</span>
            </div>
          )}

          {/* Quick sync helper */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Sync Credentials with Outbound SMTP
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                If your incoming mailbox uses the same host and password as your SMTP account, click below to autofill.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSyncWithSmtpCredentials}
              className="text-xs font-semibold gap-1.5 h-8"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Copy SMTP Username &amp; Password</span>
            </Button>
          </div>

          {/* IMAP Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-blue-600" />
                    <span>IMAP Mailbox Connection</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Roxx CRM checks this mailbox to automatically detect replies from leads and contacts, and display them in your CRM Inbox.
                  </p>
                </div>
                {imapConfig?.lastSyncedAt && (
                  <span className="text-[11px] text-slate-400">
                    Last synced: {new Date(imapConfig.lastSyncedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">IMAP Server Host *</label>
                <div className="relative flex items-center">
                  <Server className="absolute left-3 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    placeholder="e.g. imap.gmail.com"
                    className="pl-9 text-xs font-medium"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Gmail: imap.gmail.com | Outlook: outlook.office365.com | Zoho: imappro.zoho.com
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Port *</label>
                  <Input
                    type="number"
                    value={imapPort}
                    onChange={(e) => setImapPort(Number(e.target.value))}
                    placeholder="993"
                    className="text-xs font-medium"
                  />
                  <p className="text-[11px] text-slate-400">993 (SSL/TLS required)</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Security</label>
                  <div className="flex items-center h-9">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={imapSecure}
                        onChange={(e) => setImapSecure(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                      <span>SSL/TLS Encrypted</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400">Recommended: ON</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">IMAP Username *</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    value={imapUsername}
                    onChange={(e) => setImapUsername(e.target.value)}
                    placeholder="sales@yourcompany.com"
                    className="pl-9 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">IMAP Password *</label>
                  {imapConfig?.hasPassword && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Password Saved &amp; Encrypted
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <Key className="absolute left-3 w-4 h-4 text-slate-400" />
                  <Input
                    type={showImapPassword ? "text" : "password"}
                    value={imapPassword}
                    onChange={(e) => setImapPassword(e.target.value)}
                    placeholder={imapConfig?.hasPassword ? "•••••••••••• (Leave as is to keep existing)" : "Enter IMAP password"}
                    className="pl-9 pr-9 text-xs font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowImapPassword(!showImapPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600"
                  >
                    {showImapPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Radio className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Synchronized messages are matched against Leads and Contacts, automatically logging timeline activities.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowImapTestModal(true)}
                  className="text-xs font-semibold gap-1.5 h-9"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                  <span>Test IMAP Connection</span>
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveImap}
                  disabled={isImapPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 h-9"
                >
                  {isImapPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>Save IMAP Settings</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SMTP Test Modal */}
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
              <label className="block text-xs font-bold text-slate-700">Recipient Email Address *</label>
              <Input
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="admin@yourcompany.com"
                className="text-xs font-medium"
              />
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
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{isTesting ? "Verifying..." : "Send Test Email"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* IMAP Test Modal */}
      {showImapTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Test IMAP Connection &amp; Authentication
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImapTestModal(false);
                  setTestImapErrorMessage(null);
                  setTestImapSuccessMessage(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Testing connection to <strong>{imapHost || "your IMAP host"}</strong> on port <strong>{imapPort}</strong> using user <strong>{imapUsername || "configured user"}</strong>.
            </p>

            {testImapSuccessMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{testImapSuccessMessage}</span>
              </div>
            )}

            {testImapErrorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold leading-relaxed">{testImapErrorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowImapTestModal(false);
                  setTestImapErrorMessage(null);
                  setTestImapSuccessMessage(null);
                }}
                className="text-xs"
              >
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleRunImapTest}
                disabled={isTestingImap || !imapHost.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 font-bold"
              >
                {isTestingImap ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>{isTestingImap ? "Testing..." : "Verify IMAP Handshake"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
