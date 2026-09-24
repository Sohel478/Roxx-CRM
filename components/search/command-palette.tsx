"use client";

import { useEffect, useState, useRef, useTransition, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
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
  CheckSquare,
} from "lucide-react";
import { globalSearchAction, GlobalSearchResults, GlobalSearchResultItem } from "@/actions/search";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Collect all flattenable selectable items for arrow key navigation
  const allResultItems: GlobalSearchResultItem[] = useMemo(() => {
    return results
      ? [
          ...results.leads,
          ...results.opportunities,
          ...results.companies,
          ...results.contacts,
        ]
      : [];
  }, [results]);

  const navigateTo = useCallback((href: string) => {
    onClose();
    router.push(href);
  }, [onClose, router]);

  // Reset states & focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Global keyboard shortcuts (Cmd+K, Ctrl+K, Escape, Arrow Navigation)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (allResultItems.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % allResultItems.length);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (allResultItems.length > 0) {
          setSelectedIndex((prev) => (prev - 1 + allResultItems.length) % allResultItems.length);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (allResultItems.length > 0 && allResultItems[selectedIndex]) {
          navigateTo(allResultItems[selectedIndex].href);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, allResultItems, selectedIndex, navigateTo]);

  // Live search with fast debounce
  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSelectedIndex(0);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = val.trim();
    if (!trimmed) {
      setResults(null);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearchAction(trimmed);
        if (res.success && res.data) {
          setResults(res.data);
        }
      });
    }, 120);
  };

  if (!mounted || !isOpen) return null;

  const isSearching = query.trim().length > 0;
  const hasResults = results && results.totalMatches > 0;

  let currentItemCounter = 0;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Dark backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Spotlight Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[80vh] mt-12 sm:mt-16">
        {/* Search Bar Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3 bg-white">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search leads, deals, companies, contacts or jump to..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium"
          />
          {isPending && <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />}
          {query && !isPending && (
            <button
              type="button"
              onClick={() => handleQueryChange("")}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-500 rounded border border-slate-200 transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-3 space-y-4 max-h-[60vh]">
          {/* Quick Navigation Commands (When query is empty) */}
          {!isSearching && (
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Quick Navigation Shortcuts
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => navigateTo("/dashboard")}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors group"
                  >
                    <BarChart3 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="flex-1">Executive Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo("/leads")}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors group"
                  >
                    <Users2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="flex-1">Leads &amp; Conversions</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo("/opportunities")}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors group"
                  >
                    <Kanban className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="flex-1">Opportunities &amp; Pipeline</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo("/companies")}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors group"
                  >
                    <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="flex-1">Company Accounts</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo("/contacts")}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors group"
                  >
                    <User className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="flex-1">Contacts Directory</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo("/tasks")}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors group"
                  >
                    <CheckSquare className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="flex-1">Tasks &amp; Action Items</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo("/reports")}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors group"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="flex-1">Reports &amp; Sales Analytics</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo("/settings")}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors group"
                  >
                    <Settings className="w-4 h-4 text-slate-600 shrink-0" />
                    <span className="flex-1">Settings &amp; Users</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600" />
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Quick Actions
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo("/leads")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-blue-50 text-xs font-bold text-blue-600 transition-colors"
                >
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>+ Create / Import New Lead</span>
                </button>
              </div>
            </div>
          )}

          {/* Search Results Display */}
          {isSearching && (
            <>
              {/* Searching Indicator when results are loading */}
              {isPending && !results && (
                <div className="py-8 text-center text-slate-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">
                    Searching across CRM records...
                  </p>
                </div>
              )}

              {/* Leads Matches */}
              {results && results.leads.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                    <Users2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Leads ({results.leads.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.leads.map((item) => {
                      const isSelected = selectedIndex === currentItemCounter;
                      currentItemCounter++;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigateTo(item.href)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors group ${
                            isSelected
                              ? "bg-emerald-50 border border-emerald-200"
                              : "hover:bg-slate-50 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {item.title.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 truncate">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                            </div>
                          </div>
                          {item.badge && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Opportunities Matches */}
              {results && results.opportunities.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                    <Kanban className="w-3.5 h-3.5 text-purple-600" />
                    <span>Deals &amp; Opportunities ({results.opportunities.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.opportunities.map((item) => {
                      const isSelected = selectedIndex === currentItemCounter;
                      currentItemCounter++;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigateTo(item.href)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors group ${
                            isSelected
                              ? "bg-purple-50 border border-purple-200"
                              : "hover:bg-slate-50 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                              <Kanban className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 group-hover:text-purple-700 truncate">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                            </div>
                          </div>
                          {item.badge && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 rounded-md shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Companies Matches */}
              {results && results.companies.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Companies ({results.companies.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.companies.map((item) => {
                      const isSelected = selectedIndex === currentItemCounter;
                      currentItemCounter++;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigateTo(item.href)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors group ${
                            isSelected
                              ? "bg-blue-50 border border-blue-200"
                              : "hover:bg-slate-50 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                              <Building2 className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 truncate">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                            </div>
                          </div>
                          {item.badge && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 rounded-md shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Contacts Matches */}
              {results && results.contacts.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-600" />
                    <span>Contacts ({results.contacts.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.contacts.map((item) => {
                      const isSelected = selectedIndex === currentItemCounter;
                      currentItemCounter++;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigateTo(item.href)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors group ${
                            isSelected
                              ? "bg-indigo-50 border border-indigo-200"
                              : "hover:bg-slate-50 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {item.title.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 truncate">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No Results Empty State */}
              {results && !hasResults && !isPending && (
                <div className="py-12 text-center text-slate-400">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                  <p className="text-xs font-bold text-slate-700">
                    No CRM records found matching &ldquo;{query}&rdquo;
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    Try searching for another name, company account, lead, or email address.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-3 text-slate-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">
                ↓
              </kbd>{" "}
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">
                ↵
              </kbd>{" "}
              Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">
                ESC
              </kbd>{" "}
              Close
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-400 hidden sm:inline-block">
            Spotlight Quick Search
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
