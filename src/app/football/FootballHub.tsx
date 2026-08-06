/**
 * Football AI Hub — Phase 16
 *
 * Shell with mobile bottom nav + desktop sidebar nav.
 * 6 sections: Home, Today's Predictions, Elite Picks, History, Statistics, Profile.
 */

import { useState } from "react";
import { Routes, Route, NavLink, useNavigate } from "react-router";
import {
  Home, TrendingUp, Star, Clock, BarChart2, User, ArrowLeft, Trophy, Zap,
} from "lucide-react";
import FootballHubHome from "./sections/FootballHubHome";
import TodaysPredictions from "./sections/TodaysPredictions";
import ElitePicks from "./sections/ElitePicks";
import PredictionHistory from "./sections/PredictionHistory";
import Statistics from "./sections/Statistics";
import HubProfile from "./sections/HubProfile";
import FootballPoints from "./sections/FootballPoints";

const NAV_ITEMS = [
  { label: "Home",    path: "",           icon: Home,       end: true },
  { label: "Today",   path: "today",      icon: TrendingUp  },
  { label: "Elite",   path: "elite",      icon: Star        },
  { label: "History", path: "history",    icon: Clock       },
  { label: "Stats",   path: "statistics", icon: BarChart2   },
  { label: "Points",  path: "points",     icon: Zap         },
  { label: "Profile", path: "profile",    icon: User        },
];

export default function FootballHub() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col border-r border-white/[0.06] bg-zinc-900/80 transition-all duration-200 ${collapsed ? "w-16" : "w-56"}`}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-white leading-tight">Football AI</p>
              <p className="text-[10px] text-zinc-500">Prediction Hub</p>
            </div>
          )}
        </div>

        {/* Back button */}
        <button
          onClick={() => navigate("/game")}
          className="flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-all text-sm"
        >
          <ArrowLeft className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Back to Games</span>}
        </button>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.label}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-green-600/20 text-green-400 border border-green-500/30"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="px-4 py-4 text-zinc-600 hover:text-zinc-400 transition-all text-xs border-t border-white/[0.06] flex items-center justify-center"
        >
          {collapsed ? "→" : "←"}
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top header — back to Game Center */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-zinc-900/80 flex-shrink-0">
          <button
            onClick={() => navigate("/game")}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all -ml-1"
            aria-label="Back to Game Center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm font-semibold text-white">Football AI Hub</p>
          </div>
        </div>

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-auto">
          <Routes>
            <Route index element={<FootballHubHome />} />
            <Route path="today"      element={<TodaysPredictions />} />
            <Route path="elite"      element={<ElitePicks />} />
            <Route path="history"    element={<PredictionHistory />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="points"     element={<FootballPoints />} />
            <Route path="profile"    element={<HubProfile />} />
          </Routes>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur border-t border-white/[0.08] flex z-50">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.label}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-medium transition-all ${
                  isActive ? "text-green-400" : "text-zinc-500"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
