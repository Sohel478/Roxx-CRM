import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

export function DemoBanner() {
  return (
    <aside aria-label="Demo sandbox notice" className="bg-gradient-to-r from-purple-700 via-indigo-600 to-indigo-700 text-white px-4 py-2 text-xs font-medium flex flex-wrap items-center justify-between gap-2 shadow-sm sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <span className="p-1 rounded bg-white/20 text-white">
          <Sparkles className="w-3.5 h-3.5" />
        </span>
        <span>
          <strong>Live Demo Sandbox:</strong> You are exploring pre-seeded customer data in isolated demonstration mode.
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-indigo-700 font-bold hover:bg-slate-100 transition-colors shadow-xs"
        >
          <span>Start 30-Day Free Trial</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </aside>
  );
}
