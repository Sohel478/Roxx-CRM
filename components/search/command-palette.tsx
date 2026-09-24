"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Kanban,
  Users2,
  Building2,
  User,
  ArrowRight,
  BarChart3,
  Settings,
  Plus,
  X,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { globalSearchAction, GlobalSearchResults } from "@/actions/search";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global keyboard shortcuts (Cmd+K, Ctrl+K, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by parent or state
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Execute live search on input change
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (!val.trim()) {
      setResults(null);
      return;
    }

    startTransition(async () => {
      const res = await globalSearchAction(val);
      if (res.success && res.data) {
        setResults(res.data);
      }
    });
  };

  const navigateTo = (href: string) => {
    onClose();
    router.push(href);
  };

  if (!isOpen) return null;

  const hasResults = results && results.totalMatches > 0;
  const isSearching = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Palette Container */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[75vh]">
        {/* Search Bar Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Type a command or search deals, leads, companies, contacts..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {isPending && <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />}
          {query && !isPending && (
            <button
              type="button"
              onClick={() => handleQueryChange("")}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-500 rounded border border-slate-200">
            ESC
          </span>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-3 space-y-4">
          {/* Quick Navigation Commands (When query is empty or initial) */}
          {!isSearching && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                Quick Navigation
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => navigateTo("/dashboard")}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors group"
                >
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span className="flex-1">Executive Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo("/opportunities")}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors group"
                >
                  <Kanban className="w-4 h-4 text-purple-600" />
                  <span className="flex-1">Opportunity Pipeline</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo("/leads")}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors group"
                >
                  <Users2 className="w-4 h-4 text-emerald-600" />
                  <span className="flex-1">Leads &amp; Conversion</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo("/reports")}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors group"
                >
                  <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                  <span className="flex-1">Reports &amp; Sales Analytics</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo("/settings")}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors group"
                >
                  <Settings className="w-4 h-4 text-slate-600" />
                  <span className="flex-1">CRM Settings &amp; Team</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo("/leads")}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors group"
                >
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span className="flex-1 font-semibold text-blue-600">+ Add New Lead</span>
                </button>
              </div>
            </div>
          )}

          {/* Search Results Display */}
          {isSearching && results && (
            <>
              {/* Opportunities Matches */}
              {results.opportunities.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                    <Kanban className="w-3.5 h-3.5 text-purple-600" />
                    <span>Deals &amp; Opportunities ({results.opportunities.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.opportunities.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigateTo(item.href)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-purple-50/60 transition-colors group"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 group-hover:text-purple-700">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500">{item.subtitle}</div>
                        </div>
                        {item.badge && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-800 rounded-md">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Leads Matches */}
              {results.leads.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                    <Users2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Leads ({results.leads.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.leads.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigateTo(item.href)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-emerald-50/60 transition-colors group"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500">{item.subtitle}</div>
                        </div>
                        {item.badge && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded-md">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Companies Matches */}
              {results.companies.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Companies ({results.companies.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.companies.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigateTo(item.href)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-blue-50/60 transition-colors group"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500">{item.subtitle}</div>
                        </div>
                        {item.badge && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800 rounded-md">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Contacts Matches */}
              {results.contacts.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-600" />
                    <span>Contacts ({results.contacts.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.contacts.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigateTo(item.href)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-slate-100/70 transition-colors group"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 group-hover:text-slate-800">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500">{item.subtitle}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results Empty State */}
              {!hasResults && !isPending && (
                <div className="py-12 text-center text-slate-400">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold text-slate-600">
                    No records found matching &ldquo;{query}&rdquo;
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Try searching for another customer name, company, or deal.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">
                ↵
              </kbd>{" "}
              Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">
                ESC
              </kbd>{" "}
              Close
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-400">
            HubSpot-style Spotlight Navigation
          </span>
        </div>
      </div>
    </div>
  );
}
