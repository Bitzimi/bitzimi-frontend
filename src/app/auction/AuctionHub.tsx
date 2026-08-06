/**
 * AuctionHub — Phase 22.2
 *
 * Shell container with:
 *   • Desktop sidebar nav
 *   • Mobile top header + bottom nav
 *   • Back to /game
 *   • Routes: / (home), /collection, /:id (detail)
 */

import { Routes, Route, NavLink, useNavigate, useLocation } from "react-router";
import { Gavel, Home, Trophy, ArrowLeft, ChevronLeft } from "lucide-react";
import { useFeature } from "../contexts/FeatureContext";
import AuctionHome from "./pages/AuctionHome";
import AuctionDetail from "./pages/AuctionDetail";
import AuctionCollection from "./pages/AuctionCollection";

const NAV_ITEMS = [
  { label: "Marketplace", path: "",           icon: Home,   end: true },
  { label: "My Prizes",   path: "collection", icon: Trophy            },
];

function NavItem({ item }: { item: typeof NAV_ITEMS[number] }) {
  return (
    <NavLink
      to={item.path}
      end={item.end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? "bg-amber-600/20 text-amber-400 border border-amber-500/25 shadow-sm"
            : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
        }`
      }
    >
      <item.icon className="w-4 h-4 flex-shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  );
}

function MobileNavItem({ item }: { item: typeof NAV_ITEMS[number] }) {
  return (
    <NavLink
      to={item.path}
      end={item.end}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
          isActive ? "text-amber-400" : "text-zinc-500 hover:text-zinc-300"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className={`p-1.5 rounded-xl transition-all ${isActive ? "bg-amber-500/15" : ""}`}>
            <item.icon className="w-5 h-5" />
          </div>
          {item.label}
        </>
      )}
    </NavLink>
  );
}

export default function AuctionHub() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasFlag } = useFeature();

  if (!hasFlag("auction_marketplace")) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <Gavel className="w-10 h-10 text-zinc-600 mx-auto" />
          <h2 className="text-lg font-semibold text-white">Auction Marketplace Unavailable</h2>
          <p className="text-sm text-zinc-400">The auction marketplace is currently disabled. Check back soon.</p>
          <button onClick={() => navigate("/game")} className="mt-4 text-sm text-amber-400 hover:text-amber-300 transition-colors">
            ← Back to Games
          </button>
        </div>
      </div>
    );
  }

  // Detect if we're in a detail page (deeper route)
  const isDetail = /^\/auction\/[^/]+$/.test(location.pathname) &&
    !location.pathname.endsWith("/collection");

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* ── Desktop sidebar ────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 border-r border-white/[0.05] bg-zinc-900/60 flex-shrink-0">
        {/* Brand header */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.05]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-900/30">
            <Gavel className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Auction</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Marketplace</p>
          </div>
        </div>

        {/* Back to games */}
        <button
          onClick={() => navigate("/game")}
          className="flex items-center gap-2.5 mx-2 mt-2 px-3 py-2.5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-all text-sm"
        >
          <ArrowLeft className="w-4 h-4 flex-shrink-0" />
          <span>Back to Games</span>
        </button>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.label} item={item} />
          ))}
        </nav>

        {/* Footer note */}
        <div className="px-4 py-4 border-t border-white/[0.04]">
          <p className="text-[10px] text-zinc-700 leading-relaxed">
            Auction Marketplace · Phase 22
          </p>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.05] bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-20">
          {isDetail ? (
            <button
              onClick={() => navigate("/auction")}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => navigate("/game")}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
              <Gavel className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-white">Auction Marketplace</span>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 flex flex-col">
          <Routes>
            <Route index          element={<AuctionHome />} />
            <Route path="collection" element={<AuctionCollection />} />
            <Route path=":id"     element={<AuctionDetail />} />
          </Routes>
        </div>

        {/* Mobile bottom nav — hidden when viewing detail */}
        {!isDetail && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/95 border-t border-white/[0.05] backdrop-blur-md z-20">
            <div className="flex safe-area-inset-bottom">
              {NAV_ITEMS.map((item) => (
                <MobileNavItem key={item.label} item={item} />
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
