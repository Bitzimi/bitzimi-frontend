/**
 * Admin Football — Overview/Hub
 *
 * Quick stats dashboard for football management.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Trophy, Globe, Swords, TrendingUp, BarChart2, Brain, RefreshCw, ChevronRight } from "lucide-react";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
  });
  const json = (await res.json()) as { data?: T };
  return json.data as T;
}

interface Stats { leagues: number; matches: number; predictions: number; published: number; settled: number; accuracy: number; wins: number; total: number }

const STAT_CARDS = [
  { key: "leagues",     label: "Leagues",     icon: Globe,       color: "text-blue-400",   bg: "bg-blue-500/15" },
  { key: "matches",     label: "Matches",     icon: Swords,      color: "text-orange-400", bg: "bg-orange-500/15" },
  { key: "predictions", label: "Predictions", icon: TrendingUp,  color: "text-green-400",  bg: "bg-green-500/15" },
  { key: "accuracy",    label: "Accuracy %",  icon: BarChart2,   color: "text-purple-400", bg: "bg-purple-500/15", suffix: "%" },
];

const QUICK_LINKS = [
  { label: "Manage Leagues",     path: "/admin/football/leagues",     icon: Globe       },
  { label: "Manage Matches",     path: "/admin/football/matches",     icon: Swords      },
  { label: "Manage Predictions", path: "/admin/football/predictions", icon: TrendingUp  },
  { label: "Settle Results",     path: "/admin/football/results",     icon: Trophy      },
  { label: "AI Engine",          path: "/admin/football/ai",          icon: Brain       },
];

export default function FootballOverviewPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiFetch<Stats>("/api/v1/admin/football/stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Football AI Hub</h1>
            <p className="text-xs text-zinc-500">Manage leagues, matches, predictions and results</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STAT_CARDS.map(c => (
            <div key={c.key} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
                <c.icon className={`w-4 h-4 ${c.color}`} />
              </div>
              <p className={`text-xl font-bold ${c.color}`}>
                {stats[c.key as keyof Stats]}{c.suffix ?? ""}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="text-center py-8 text-zinc-500 text-sm">Loading stats…</div>}

      {/* Quick links */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {QUICK_LINKS.map(l => (
            <button
              key={l.path}
              onClick={() => navigate(l.path)}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <l.icon className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">{l.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
