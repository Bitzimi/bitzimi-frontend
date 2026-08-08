import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router";
import {
  Gamepad2, Power, Wrench, Percent, ChevronDown, ChevronUp,
  RefreshCw, AlertTriangle, Check, X, Edit3, Save, Plus,
  Activity, History, BarChart3, Settings, Users, Zap,
  DollarSign, TrendingUp, Eye, EyeOff, DoorOpen, Trash2, ArrowRight,
} from "lucide-react";
import { PageHeader }   from "../../components/ui/PageHeader";
import { SectionCard }  from "../../components/ui/SectionCard";
import { StatCard }     from "../../components/ui/StatCard";
import { StatusBadge }  from "../../components/ui/StatusBadge";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  adminGamesService,
  type GameConfig,
  type LobbyConfig,
  type RoomConfig,
  type GameMonitoring,
  type HistoryPage,
  type GameAnalytics,
} from "../../services/adminGamesService";

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = "config" | "monitoring" | "history" | "analytics";

const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: "config",     label: "Configuration", icon: Settings  },
  { id: "monitoring", label: "Live",           icon: Activity  },
  { id: "history",    label: "History",        icon: History   },
  { id: "analytics",  label: "Analytics",      icon: BarChart3 },
];

const CATEGORY_LABELS: Record<string, string> = {
  lobby:       "Lobby-Based",
  stake_multi: "Stake-Selection (Multiplayer)",
  pvp:         "Stake-Selection (1v1)",
};

// Canonical game order for game-by-game management
const GAME_ORDER = [
  "color_game", "spin_battle",
  "dice_clash", "pvp_coinflip",
  "dice_royale", "dice_arena",
  "reaction_tap",
] as const;

const GAME_DESCRIPTIONS: Record<string, string> = {
  color_game:   "Lobby-based colour outcome game. Manages 4 lobbies (A–D) with configurable bet limits, access levels, and room mode.",
  spin_battle:  "Lobby-based multiplayer spin wheel game. Manages 4 lobbies (A–D) with configurable bet limits and room mode.",
  dice_royale:  "Multi-player dice game — players pick a stake and join open rounds. Highest roll wins the prize pool minus fee.",
  dice_arena:   "Multi-player dice game with two winners. Players pick a stake; 1st place takes 60%, 2nd takes 40% of prize pool.",
  dice_clash:   "1v1 dice clash via matchmaking. Players are matched by stake. No lobbies.",
  pvp_coinflip: "1v1 coin flip via matchmaking. Heads or tails decides the winner. No lobbies.",
  reaction_tap: "1v1 reaction tap via matchmaking. Fastest tap wins. No lobbies. Not provably fair.",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n: number) {
  return n.toLocaleString("en-US");
}

// ── Toggle button ──────────────────────────────────────────────────────────────

function Toggle({
  checked, onChange, disabled, label,
}: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string;
}) {
  return (
    <button
      type="button" disabled={disabled} onClick={() => onChange(!checked)} aria-label={label}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900
        disabled:opacity-40 disabled:cursor-not-allowed ${checked ? "bg-indigo-600" : "bg-zinc-700"}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

// ── Fee rate editor ────────────────────────────────────────────────────────────

function FeeEditor({ gameType, current, canManage, onSaved }: {
  gameType: string; current: number; canManage: boolean; onSaved: (r: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value,   setValue]   = useState(String((current * 100).toFixed(0)));
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const save = async () => {
    const pct = parseFloat(value);
    if (isNaN(pct) || pct < 0 || pct > 50) { setError("Must be 0–50"); return; }
    setSaving(true); setError("");
    try {
      await adminGamesService.updateGame(gameType, { feeRate: pct / 100 });
      onSaved(pct / 100); setEditing(false);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (!editing) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-zinc-300">
        <Percent className="w-3.5 h-3.5 text-zinc-500" />
        {(current * 100).toFixed(0)}%
        {canManage && (
          <button onClick={() => { setValue(String((current * 100).toFixed(0))); setEditing(true); }} className="ml-1 text-zinc-500 hover:text-indigo-400 transition-colors">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <input type="number" min={0} max={50} step={1} value={value} onChange={e => setValue(e.target.value)}
        className="w-16 px-2 py-0.5 bg-zinc-800 border border-zinc-600 rounded text-sm text-white focus:border-indigo-500 focus:outline-none" />
      <span className="text-zinc-400 text-xs">%</span>
      <button onClick={save} disabled={saving} className="text-indigo-400 hover:text-indigo-300 disabled:opacity-50">
        {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
      </button>
      <button onClick={() => { setEditing(false); setError(""); }} className="text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </span>
  );
}

// ── Stake chips editor ─────────────────────────────────────────────────────────

function StakesEditor({ gameType, stakes, canManage, onSaved }: {
  gameType: string; stakes: number[]; canManage: boolean; onSaved: (s: number[]) => void;
}) {
  const [addValue, setAddValue] = useState("");
  const [saving,   setSaving]   = useState<"remove" | "add" | null>(null);
  const [error,    setError]    = useState("");

  const removeStake = async (stake: number) => {
    const next = stakes.filter(s => s !== stake);
    if (next.length === 0) { setError("Cannot remove all stakes"); return; }
    setSaving("remove"); setError("");
    try { const result = await adminGamesService.updateStakes(gameType, next); onSaved(result); }
    catch (e: any) { setError(e.message); }
    finally { setSaving(null); }
  };

  const addStake = async () => {
    const v = parseFloat(addValue);
    if (isNaN(v) || v <= 0) { setError("Enter a positive number"); return; }
    if (stakes.includes(v)) { setError(`$${v} already exists`); return; }
    setSaving("add"); setError("");
    try {
      const result = await adminGamesService.updateStakes(gameType, [...stakes, v]);
      onSaved(result); setAddValue("");
    } catch (e: any) { setError(e.message); }
    finally { setSaving(null); }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {stakes.map(s => (
          <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-200">
            ${s}
            {canManage && (
              <button
                onClick={() => removeStake(s)}
                disabled={saving !== null}
                className="text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50 ml-0.5"
                aria-label={`Remove $${s} stake`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </span>
        ))}
        {stakes.length === 0 && <span className="text-xs text-zinc-500 italic">No stakes configured</span>}
      </div>
      {canManage && (
        <div className="flex items-center gap-2">
          <input
            type="number" min={1} step={1} value={addValue} onChange={e => setAddValue(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addStake()}
            placeholder="Add stake ($)"
            className="w-28 px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={addStake} disabled={saving !== null || !addValue}
            className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-white disabled:opacity-50 transition-colors"
          >
            {saving === "add" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Add
          </button>
          {error && <span className="text-red-400 text-xs">{error}</span>}
        </div>
      )}
    </div>
  );
}

// ── Room row ───────────────────────────────────────────────────────────────────

function RoomRow({ room, canManage, onUpdate, onDelete }: {
  room: RoomConfig;
  canManage: boolean;
  onUpdate: (opts: Partial<RoomConfig>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue,   setNameValue]   = useState(room.name);
  const [saving,      setSaving]      = useState<string | null>(null);
  const [confirmDel,  setConfirmDel]  = useState(false);

  const doUpdate = async (opts: Partial<RoomConfig>) => {
    setSaving(Object.keys(opts)[0]);
    try { await onUpdate(opts); } catch { /* error shown by parent */ }
    finally { setSaving(null); }
  };

  const saveName = async () => {
    if (!nameValue.trim()) return;
    await doUpdate({ name: nameValue.trim() });
    setEditingName(false);
  };

  const doDelete = async () => {
    setSaving("delete");
    try { await onDelete(); } catch { setSaving(null); setConfirmDel(false); }
  };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-zinc-800/40 last:border-0 group">
      {/* Room ID badge */}
      <span className="flex-shrink-0 w-7 h-7 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
        {room.roomId}
      </span>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {editingName ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus value={nameValue} onChange={e => setNameValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setEditingName(false); setNameValue(room.name); } }}
              className="flex-1 px-2 py-0.5 bg-zinc-900 border border-zinc-600 rounded text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
            <button onClick={saveName} disabled={saving !== null} className="text-indigo-400 hover:text-indigo-300 disabled:opacity-50">
              {saving === "name" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </button>
            <button onClick={() => { setEditingName(false); setNameValue(room.name); }} className="text-zinc-500 hover:text-zinc-300"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-300 truncate">{room.name}</span>
            {canManage && (
              <button onClick={() => { setNameValue(room.name); setEditingName(true); }} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-indigo-400 transition-all">
                <Edit3 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        {room.capacity !== null && (
          <span className="text-[10px] text-zinc-600">cap: {room.capacity}</span>
        )}
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {room.maintenance && (
          <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">MAINT</span>
        )}
        {!room.visible && (
          <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-zinc-800 text-zinc-500">HIDDEN</span>
        )}
        <StatusBadge status={room.enabled ? "active" : "paused"} size="sm" />
      </div>

      {/* Action toggles */}
      {canManage && (
        <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Enable/disable */}
          <button
            title={room.enabled ? "Disable room" : "Enable room"}
            disabled={saving !== null}
            onClick={() => doUpdate({ enabled: !room.enabled })}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-40 ${room.enabled ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"}`}
          >
            {saving === "enabled" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
          </button>
          {/* Maintenance */}
          <button
            title={room.maintenance ? "Clear maintenance" : "Set maintenance"}
            disabled={saving !== null}
            onClick={() => doUpdate({ maintenance: !room.maintenance })}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-40 ${room.maintenance ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"}`}
          >
            {saving === "maintenance" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
          </button>
          {/* Visible */}
          <button
            title={room.visible ? "Hide room" : "Show room"}
            disabled={saving !== null}
            onClick={() => doUpdate({ visible: !room.visible })}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-40 ${room.visible ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-zinc-800 text-zinc-600 hover:bg-zinc-700"}`}
          >
            {saving === "visible" ? <RefreshCw className="w-3 h-3 animate-spin" /> : room.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </button>
          {/* Delete */}
          {confirmDel ? (
            <div className="flex items-center gap-1">
              <button onClick={doDelete} disabled={saving !== null} className="w-6 h-6 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center disabled:opacity-40">
                {saving === "delete" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              </button>
              <button onClick={() => setConfirmDel(false)} className="w-6 h-6 rounded bg-zinc-800 text-zinc-500 hover:bg-zinc-700 flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              title="Delete room"
              disabled={saving !== null}
              onClick={() => setConfirmDel(true)}
              className="w-6 h-6 rounded flex items-center justify-center bg-zinc-800 text-zinc-600 hover:bg-red-500/15 hover:text-red-400 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Lobby room manager ─────────────────────────────────────────────────────────

function LobbyRoomManager({ gameType, lobbyId, canManage }: {
  gameType: string; lobbyId: string; canManage: boolean;
}) {
  const [rooms,      setRooms]      = useState<RoomConfig[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [createName, setCreateName] = useState("");
  const [createErr,  setCreateErr]  = useState("");

  useEffect(() => {
    adminGamesService.fetchLobbyRooms(gameType, lobbyId)
      .then(setRooms).catch(() => {}).finally(() => setLoading(false));
  }, [gameType, lobbyId]);

  const handleUpdate = async (roomId: string, opts: Partial<RoomConfig>) => {
    const updated = await adminGamesService.updateLobbyRoom(gameType, lobbyId, roomId, opts);
    setRooms(prev => prev.map(r => r.roomId === roomId ? updated : r));
  };

  const handleDelete = async (roomId: string) => {
    await adminGamesService.deleteLobbyRoom(gameType, lobbyId, roomId);
    setRooms(prev => prev.filter(r => r.roomId !== roomId));
  };

  const handleCreate = async () => {
    setCreating(true); setCreateErr("");
    try {
      const room = await adminGamesService.createLobbyRoom(gameType, lobbyId, { name: createName.trim() || undefined });
      setRooms(prev => [...prev, room]);
      setCreateName(""); setShowCreate(false);
    } catch (e: any) { setCreateErr(e.message); }
    finally { setCreating(false); }
  };

  if (loading) return <div className="h-8 animate-pulse bg-zinc-800/50 rounded mt-2" />;

  return (
    <div className="mt-3 pl-3 border-l-2 border-zinc-800">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-wide text-zinc-600 flex items-center gap-1">
          <DoorOpen className="w-3 h-3" /> Rooms ({rooms.length})
        </p>
        {canManage && !showCreate && (
          <button onClick={() => setShowCreate(true)} className="text-[10px] text-zinc-600 hover:text-indigo-400 flex items-center gap-0.5 transition-colors">
            <Plus className="w-3 h-3" /> Add Room
          </button>
        )}
      </div>

      {rooms.length === 0 && !showCreate && (
        <p className="text-[10px] text-zinc-700 italic py-1">No rooms configured yet</p>
      )}

      {rooms.map(room => (
        <RoomRow
          key={room.roomId} room={room} canManage={canManage}
          onUpdate={opts => handleUpdate(room.roomId, opts)}
          onDelete={() => handleDelete(room.roomId)}
        />
      ))}

      {showCreate && (
        <div className="flex items-center gap-2 pt-2">
          <input
            autoFocus value={createName} onChange={e => setCreateName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            placeholder="Room name (optional)"
            className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-indigo-500 focus:outline-none"
          />
          <button onClick={handleCreate} disabled={creating} className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-xs text-white disabled:opacity-50">
            {creating ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Add"}
          </button>
          <button onClick={() => { setShowCreate(false); setCreateErr(""); }} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-3.5 h-3.5" />
          </button>
          {createErr && <span className="text-red-400 text-[10px]">{createErr}</span>}
        </div>
      )}
    </div>
  );
}

// ── Stake room manager ─────────────────────────────────────────────────────────

function StakeRoomManager({ gameType, stake, canManage }: {
  gameType: string; stake: number; canManage: boolean;
}) {
  const [rooms,      setRooms]      = useState<RoomConfig[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [createName, setCreateName] = useState("");
  const [createErr,  setCreateErr]  = useState("");

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
    adminGamesService.fetchStakeRooms(gameType, stake)
      .then(setRooms).catch(() => {}).finally(() => setLoading(false));
  }, [gameType, stake, expanded]);

  const handleUpdate = async (roomId: string, opts: Partial<RoomConfig>) => {
    const updated = await adminGamesService.updateStakeRoom(gameType, stake, roomId, opts);
    setRooms(prev => prev.map(r => r.roomId === roomId ? updated : r));
  };

  const handleDelete = async (roomId: string) => {
    await adminGamesService.deleteStakeRoom(gameType, stake, roomId);
    setRooms(prev => prev.filter(r => r.roomId !== roomId));
  };

  const handleCreate = async () => {
    setCreating(true); setCreateErr("");
    try {
      const room = await adminGamesService.createStakeRoom(gameType, stake, { name: createName.trim() || undefined });
      setRooms(prev => [...prev, room]);
      setCreateName(""); setShowCreate(false);
    } catch (e: any) { setCreateErr(e.message); }
    finally { setCreating(false); }
  };

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
      >
        <span className="text-xs font-medium text-zinc-300">${stake} — Rooms</span>
        <div className="flex items-center gap-2">
          {expanded && <span className="text-[10px] text-zinc-600">{rooms.length} room{rooms.length !== 1 ? "s" : ""}</span>}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {loading ? (
            <div className="h-8 animate-pulse bg-zinc-800/50 rounded mt-2" />
          ) : (
            <>
              {rooms.length === 0 && !showCreate && (
                <p className="text-[10px] text-zinc-700 italic py-2">No rooms configured</p>
              )}
              {rooms.map(room => (
                <RoomRow
                  key={room.roomId} room={room} canManage={canManage}
                  onUpdate={opts => handleUpdate(room.roomId, opts)}
                  onDelete={() => handleDelete(room.roomId)}
                />
              ))}
              {canManage && (
                showCreate ? (
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      autoFocus value={createName} onChange={e => setCreateName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleCreate()}
                      placeholder="Room name (optional)"
                      className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <button onClick={handleCreate} disabled={creating} className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-xs text-white disabled:opacity-50">
                      {creating ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Add"}
                    </button>
                    <button onClick={() => { setShowCreate(false); setCreateErr(""); }} className="text-zinc-500 hover:text-zinc-300">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {createErr && <span className="text-red-400 text-[10px]">{createErr}</span>}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="mt-2 flex items-center gap-1 text-[10px] text-zinc-600 hover:text-indigo-400 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Room
                  </button>
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create Lobby form ──────────────────────────────────────────────────────────

function CreateLobbyForm({ gameType, existingIds, onCreated, onCancel }: {
  gameType: string; existingIds: string[]; onCreated: (lobby: LobbyConfig) => void; onCancel: () => void;
}) {
  const [lobbyId, setLobbyId] = useState("");
  const [minBet,  setMinBet]  = useState("");
  const [maxBet,  setMaxBet]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const create = async () => {
    const id  = lobbyId.trim().toUpperCase();
    const min = parseFloat(minBet);
    const max = parseFloat(maxBet);

    if (!/^[A-Z0-9]{1,8}$/.test(id)) { setError("ID must be 1–8 uppercase letters/digits"); return; }
    if (existingIds.includes(id))     { setError(`Lobby ${id} already exists`); return; }
    if (isNaN(min) || min <= 0)       { setError("Min bet must be positive"); return; }
    if (isNaN(max) || max <= min)     { setError("Max bet must be greater than min bet"); return; }

    setSaving(true); setError("");
    try {
      const created = await adminGamesService.createLobby(gameType, { lobbyId: id, minBet: min, maxBet: max, enabled: true });
      onCreated(created);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="mt-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 space-y-3">
      <p className="text-xs font-medium text-zinc-300">Create New Lobby</p>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Lobby ID</label>
          <input
            type="text" maxLength={8} value={lobbyId} onChange={e => setLobbyId(e.target.value.toUpperCase())} placeholder="E"
            className="w-20 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white uppercase focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Min Bet ($)</label>
          <input
            type="number" min={1} value={minBet} onChange={e => setMinBet(e.target.value)} placeholder="1"
            className="w-24 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Max Bet ($)</label>
          <input
            type="number" min={1} value={maxBet} onChange={e => setMaxBet(e.target.value)} placeholder="100"
            className="w-28 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={create} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Create Lobby
        </button>
        <button onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
      </div>
      <p className="text-[10px] text-zinc-600">New lobby activates immediately.</p>
    </div>
  );
}

// ── Lobby row (with embedded room manager) ─────────────────────────────────────

function LobbyRow({ gameType, lobby, canManage, onUpdated, showRooms }: {
  gameType: string; lobby: LobbyConfig; canManage: boolean; onUpdated: (u: LobbyConfig) => void; showRooms: boolean;
}) {
  const [editing,      setEditing]      = useState(false);
  const [minBet,       setMinBet]       = useState(String(lobby.minBet));
  const [maxBet,       setMaxBet]       = useState(String(lobby.maxBet));
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");
  const [toggling,     setToggling]     = useState(false);
  const [roomsExpanded, setRoomsExpanded] = useState(false);
  const [accessLevel,  setAccessLevelLocal] = useState<string>(lobby.accessLevel ?? "public");
  const [savingAccess, setSavingAccess] = useState(false);

  const saveAccessLevel = async (val: string) => {
    setSavingAccess(true);
    try {
      const u = await adminGamesService.updateLobby(gameType, lobby.lobbyId, { accessLevel: val as any });
      setAccessLevelLocal(u.accessLevel ?? val);
      onUpdated({ ...lobby, ...u });
    } catch { /* silent */ }
    finally { setSavingAccess(false); }
  };

  const toggleEnabled = async () => {
    setToggling(true);
    try { const u = await adminGamesService.updateLobby(gameType, lobby.lobbyId, { enabled: !lobby.enabled }); onUpdated({ ...lobby, ...u }); }
    catch { /* silent */ }
    finally { setToggling(false); }
  };

  const saveRange = async () => {
    const mn = parseFloat(minBet); const mx = parseFloat(maxBet);
    if (isNaN(mn) || isNaN(mx) || mn <= 0 || mx <= mn) { setError("Invalid range"); return; }
    setSaving(true); setError("");
    try {
      const u = await adminGamesService.updateLobby(gameType, lobby.lobbyId, { minBet: mn, maxBet: mx });
      onUpdated({ ...lobby, ...u }); setEditing(false);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="border-b border-zinc-800/50 last:border-0">
      <div className="flex items-center gap-4 py-3">
        <div className="w-10 flex-shrink-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800 text-sm font-bold text-white">{lobby.lobbyId}</span>
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-zinc-400 text-xs">Min:</span>
              <input type="number" min={1} value={minBet} onChange={e => setMinBet(e.target.value)}
                className="w-20 px-2 py-0.5 bg-zinc-800 border border-zinc-600 rounded text-sm text-white focus:border-indigo-500 focus:outline-none" />
              <span className="text-zinc-400 text-xs">Max:</span>
              <input type="number" min={1} value={maxBet} onChange={e => setMaxBet(e.target.value)}
                className="w-24 px-2 py-0.5 bg-zinc-800 border border-zinc-600 rounded text-sm text-white focus:border-indigo-500 focus:outline-none" />
              <button onClick={saveRange} disabled={saving} className="text-indigo-400 hover:text-indigo-300 disabled:opacity-50">
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => { setEditing(false); setError(""); }} className="text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>
              {error && <span className="text-red-400 text-xs">{error}</span>}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-300">${lobby.minBet}–${lobby.maxBet}</span>
              {canManage && (
                <button onClick={() => { setMinBet(String(lobby.minBet)); setMaxBet(String(lobby.maxBet)); setEditing(true); }}
                  className="text-zinc-500 hover:text-indigo-400 transition-colors">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
        <StatusBadge status={lobby.enabled ? "active" : "paused"} />
        {canManage && <Toggle checked={lobby.enabled} onChange={toggleEnabled} disabled={toggling} label={`Toggle Lobby ${lobby.lobbyId}`} />}
        {canManage && (
          <select
            value={accessLevel}
            disabled={savingAccess}
            onChange={e => { setAccessLevelLocal(e.target.value); saveAccessLevel(e.target.value); }}
            className="text-xs bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-300 focus:border-indigo-500 focus:outline-none"
            title="Room access level"
          >
            <option value="public">Public</option>
            <option value="verified">Verified Only</option>
            <option value="vip">VIP Only</option>
            <option value="staff">Staff Only</option>
          </select>
        )}
        {!canManage && accessLevel !== "public" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-800/40">
            {accessLevel === "verified" ? "KYC" : accessLevel === "vip" ? "VIP" : "Staff"}
          </span>
        )}
        {showRooms && (
          <button
            onClick={() => setRoomsExpanded(e => !e)}
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-indigo-400 transition-colors flex-shrink-0"
            title="Manage rooms"
          >
            <DoorOpen className="w-3.5 h-3.5" />
            {roomsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>
      {showRooms && roomsExpanded && (
        <div className="pb-3 pl-12">
          <LobbyRoomManager gameType={gameType} lobbyId={lobby.lobbyId} canManage={canManage} />
        </div>
      )}
    </div>
  );
}

// ── Game card ──────────────────────────────────────────────────────────────────

function GameCard({ game, canManage, onUpdated }: {
  game: GameConfig; canManage: boolean; onUpdated: (g: GameConfig) => void;
}) {
  const [expanded,       setExpanded]       = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [toggling,       setToggling]       = useState<"enabled" | "maintenance" | "roomMode" | null>(null);

  const toggle = async (field: "enabled" | "maintenance" | "roomMode") => {
    setToggling(field);
    const apiField = field === "roomMode" ? "roomMode" : field;
    try {
      const updated = await adminGamesService.updateGame(game.gameType, { [apiField]: !(game as any)[field] });
      onUpdated({ ...game, ...updated });
    } catch { /* silent */ }
    finally { setToggling(null); }
  };

  const updateLobby = (updated: LobbyConfig) => {
    onUpdated({ ...game, lobbies: game.lobbies.map(l => l.lobbyId === updated.lobbyId ? updated : l) });
  };

  const addLobby = (lobby: LobbyConfig) => {
    onUpdated({ ...game, lobbies: [...game.lobbies, lobby] });
    setShowCreateForm(false);
  };

  const hasLobbies    = game.category === "lobby";
  const hasStakeRooms = game.category === "stake_multi";
  const supportsRooms = hasLobbies || hasStakeRooms;

  return (
    <div className={`rounded-xl border transition-colors ${
      game.maintenance ? "border-amber-500/30 bg-amber-500/5"
        : !game.enabled ? "border-zinc-700/50 bg-zinc-900/30 opacity-75"
        : "border-zinc-700/50 bg-zinc-900/50"
    }`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${game.enabled && !game.maintenance ? "bg-indigo-600/20" : "bg-zinc-800"}`}>
            <Gamepad2 className={`w-4.5 h-4.5 ${game.enabled && !game.maintenance ? "text-indigo-400" : "text-zinc-500"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-white">{game.name}</h3>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400">{CATEGORY_LABELS[game.category] ?? game.category}</span>
              {game.maintenance && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  <Wrench className="w-2.5 h-2.5" /> Maintenance
                </span>
              )}
              {supportsRooms && game.roomMode && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/15 text-violet-400 border border-violet-500/20">
                  <DoorOpen className="w-2.5 h-2.5" /> Room Mode
                </span>
              )}
            </div>
            <div className="mt-1.5">
              <FeeEditor gameType={game.gameType} current={game.feeRate} canManage={canManage}
                onSaved={rate => onUpdated({ ...game, feeRate: rate })} />
            </div>
          </div>
          {/* Toggles */}
          <div className="flex items-center gap-4 flex-shrink-0 flex-wrap justify-end">
            <div className="flex flex-col items-center gap-1">
              <Toggle checked={game.enabled} onChange={() => toggle("enabled")} disabled={!canManage || toggling !== null} label="Enable/disable game" />
              <span className="text-[10px] text-zinc-500">Enable</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Toggle checked={game.maintenance} onChange={() => toggle("maintenance")} disabled={!canManage || toggling !== null} label="Toggle maintenance mode" />
              <span className="text-[10px] text-zinc-500 flex items-center gap-0.5"><Wrench className="w-2.5 h-2.5" />Maint.</span>
            </div>
            {supportsRooms && (
              <div className="flex flex-col items-center gap-1">
                <Toggle checked={game.roomMode} onChange={() => toggle("roomMode")} disabled={!canManage || toggling !== null} label="Toggle room mode" />
                <span className="text-[10px] text-zinc-500 flex items-center gap-0.5"><DoorOpen className="w-2.5 h-2.5" />Rooms</span>
              </div>
            )}
          </div>
        </div>

        {/* Stakes + stake rooms (non-lobby games) */}
        {!hasLobbies && (
          <div className="mt-3 pt-3 border-t border-zinc-800/50">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">Available Stakes</p>
            <StakesEditor gameType={game.gameType} stakes={game.stakes} canManage={canManage}
              onSaved={stakes => onUpdated({ ...game, stakes })} />
            {hasStakeRooms && game.stakes.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] uppercase tracking-wide text-zinc-600 flex items-center gap-1">
                  <DoorOpen className="w-3 h-3" /> Rooms per Stake
                  <span className="text-zinc-700 normal-case">(future-ready)</span>
                </p>
                {game.stakes.map(stake => (
                  <StakeRoomManager key={stake} gameType={game.gameType} stake={stake} canManage={canManage} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lobby section */}
      {hasLobbies && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between px-4 py-2 border-t border-zinc-800/50 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] transition-colors"
          >
            <span>{game.lobbies.length} Lobbies — click to {expanded ? "collapse" : "manage"}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {expanded && (
            <div className="px-4 pb-4">
              {game.lobbies.map(lobby => (
                <LobbyRow
                  key={lobby.lobbyId}
                  gameType={game.gameType}
                  lobby={lobby}
                  canManage={canManage}
                  onUpdated={updateLobby}
                  showRooms={true}
                />
              ))}
              {canManage && !showCreateForm && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/50 transition-colors w-full justify-center"
                >
                  <Plus className="w-3.5 h-3.5" /> Create New Lobby
                </button>
              )}
              {showCreateForm && (
                <CreateLobbyForm
                  gameType={game.gameType}
                  existingIds={game.lobbies.map(l => l.lobbyId)}
                  onCreated={addLobby}
                  onCancel={() => setShowCreateForm(false)}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Monitoring tab ─────────────────────────────────────────────────────────────

function MonitoringTab() {
  const [data,      setData]      = useState<GameMonitoring | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await adminGamesService.fetchMonitoring();
      setData(d); setError("");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 15_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (loading) return <div className="h-40 rounded-xl bg-zinc-800/50 animate-pulse" />;
  if (error)   return <div className="text-red-400 text-sm p-4">{error}</div>;
  if (!data)   return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Users}   title="Active Players" value={fmtNum(data.totalActivePlayers)} />
        <StatCard icon={Zap}     title="Color Rounds"   value={data.colorGame.activeRounds} iconColor="text-red-400"    iconBg="bg-red-500/10" />
        <StatCard icon={Zap}     title="Spin Rounds"    value={data.spinBattle.activeRounds} iconColor="text-violet-400" iconBg="bg-violet-500/10" />
        <StatCard icon={Activity} title="Settled (24h)" value={fmtNum(data.roundsSettled24h)} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SectionCard title="Color Prediction" description={`${data.colorGame.activeRounds} active rounds · ${data.colorGame.activePlayers} players`}>
          {data.colorGame.rounds.length === 0 ? (
            <p className="text-zinc-500 text-xs py-2">No active rounds</p>
          ) : (
            <div className="space-y-1.5">
              {data.colorGame.rounds.map(r => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Lobby {r.lobbyId}</span>
                  <StatusBadge status={r.status === "waiting" ? "pending" : r.status === "result" ? "completed" : "processing"} label={r.status} size="sm" />
                  <span className="text-zinc-300">{r.playerCount} players</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Spin Battle" description={`${data.spinBattle.activeRounds} active rounds · ${data.spinBattle.activePlayers} players`}>
          {data.spinBattle.rounds.length === 0 ? (
            <p className="text-zinc-500 text-xs py-2">No active rounds</p>
          ) : (
            <div className="space-y-1.5">
              {data.spinBattle.rounds.map(r => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Lobby {r.lobbyId}</span>
                  <StatusBadge status={r.status === "waiting" ? "pending" : r.status === "result" ? "completed" : "processing"} label={r.status} size="sm" />
                  <span className="text-zinc-300">{r.playerCount} players</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Dice Royale" description={`${data.diceRoyale.activeRounds} active rounds · ${data.diceRoyale.activePlayers} players`}>
          {data.diceRoyale.rounds.length === 0 ? (
            <p className="text-zinc-500 text-xs py-2">No active rounds</p>
          ) : (
            <div className="space-y-1.5">
              {data.diceRoyale.rounds.map(r => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">${r.stake} stake</span>
                  <StatusBadge status="processing" label={r.status} size="sm" />
                  <span className="text-zinc-300">{r.playerCount} players</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="PvP + Matchmaking Queue" description={`${data.pvp.activeMatches} active matches · ${data.queue.totalWaiting} waiting`}>
          <div className="space-y-2 text-xs">
            <p className="text-zinc-400 font-medium">Active matches</p>
            {Object.entries(data.pvp.byGameType).map(([gt, count]) => (
              <div key={gt} className="flex items-center justify-between">
                <span className="text-zinc-500 capitalize">{gt.replace(/_/g, " ")}</span>
                <span className="text-zinc-300">{count}</span>
              </div>
            ))}
            {Object.keys(data.pvp.byGameType).length === 0 && <p className="text-zinc-600">None</p>}
            <p className="text-zinc-400 font-medium mt-2">Waiting in queue</p>
            {Object.entries(data.queue.byGameType).map(([gt, count]) => (
              <div key={gt} className="flex items-center justify-between">
                <span className="text-zinc-500 capitalize">{gt.replace(/_/g, " ")}</span>
                <span className="text-zinc-300">{count}</span>
              </div>
            ))}
            {Object.keys(data.queue.byGameType).length === 0 && <p className="text-zinc-600">Queue empty</p>}
          </div>
        </SectionCard>
      </div>
      <p className="text-[10px] text-zinc-600 text-right">Auto-refreshes every 15 seconds · Read-only</p>
    </div>
  );
}

// ── History tab ────────────────────────────────────────────────────────────────

const GAME_TYPES = ["color_game", "spin_battle", "dice_royale", "dice_arena", "dice_clash", "pvp_coinflip", "reaction_tap"];

function HistoryTab() {
  const [page,       setPage]       = useState<HistoryPage | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [gameFilter, setGameFilter] = useState<string>("");
  const [cursor,     setCursor]     = useState<string | undefined>(undefined);

  const load = useCallback(async (cur?: string, gt?: string) => {
    setLoading(true);
    try {
      const d = await adminGamesService.fetchHistory({ cursor: cur, limit: 25, gameType: gt || undefined });
      setPage(d); setError("");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(undefined, gameFilter); }, [gameFilter, load]);

  const nextPage = () => {
    if (!page?.nextCursor) return;
    setCursor(page.nextCursor);
    load(page.nextCursor, gameFilter);
  };

  const prevPage = () => {
    setCursor(undefined);
    load(undefined, gameFilter);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={gameFilter}
          onChange={e => { setGameFilter(e.target.value); setCursor(undefined); }}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All Games</option>
          {GAME_TYPES.map(gt => <option key={gt} value={gt}>{gt.replace(/_/g, " ")}</option>)}
        </select>
        <button onClick={() => load(cursor, gameFilter)} className="text-zinc-400 hover:text-zinc-200 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 rounded-lg bg-zinc-800/50 animate-pulse" />)}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="pb-2 text-left font-medium">Player</th>
                  <th className="pb-2 text-left font-medium">Game</th>
                  <th className="pb-2 text-right font-medium">Wagered</th>
                  <th className="pb-2 text-right font-medium">Payout</th>
                  <th className="pb-2 text-right font-medium">Fee</th>
                  <th className="pb-2 text-center font-medium">Outcome</th>
                  <th className="pb-2 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {page?.items.map(item => (
                  <tr key={item.id} className="border-b border-zinc-800/30 hover:bg-white/[0.015]">
                    <td className="py-2 pr-3 text-zinc-300 text-xs">{item.username || item.userId.slice(0, 8)}</td>
                    <td className="py-2 pr-3 text-zinc-400 text-xs capitalize">{item.gameType.replace(/_/g, " ")}{item.lobbyId ? ` (${item.lobbyId})` : ""}</td>
                    <td className="py-2 text-right text-zinc-300 text-xs">{fmtUSD(item.amount)}</td>
                    <td className="py-2 text-right text-zinc-300 text-xs">{item.payout != null ? fmtUSD(item.payout) : "—"}</td>
                    <td className="py-2 text-right text-zinc-500 text-xs">{item.fee != null ? fmtUSD(item.fee) : "—"}</td>
                    <td className="py-2 text-center">
                      <StatusBadge
                        status={item.outcome === "win" ? "completed" : item.outcome === "loss" ? "rejected" : item.outcome === "draw" ? "paused" : "pending"}
                        label={item.outcome ?? "pending"}
                        size="sm"
                      />
                    </td>
                    <td className="py-2 text-right text-zinc-500 text-xs whitespace-nowrap">
                      {item.settledAt ? new Date(item.settledAt).toLocaleTimeString() : "pending"}
                    </td>
                  </tr>
                ))}
                {!page?.items.length && (
                  <tr><td colSpan={7} className="py-6 text-center text-zinc-600 text-sm">No records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between pt-2">
            <button onClick={prevPage} disabled={!cursor} className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors">← Newest</button>
            <span className="text-xs text-zinc-600">{page?.items.length ?? 0} records</span>
            <button onClick={nextPage} disabled={!page?.hasMore} className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors">Older →</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Analytics tab ──────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [data,    setData]    = useState<GameAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    adminGamesService.fetchAnalytics()
      .then(d => { setData(d); setError(""); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-40 rounded-xl bg-zinc-800/50 animate-pulse" />;
  if (error)   return <div className="text-red-400 text-sm">{error}</div>;
  if (!data)   return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Gamepad2}   title="Total Bets (All-Time)"   value={fmtNum(data.totals.totalGames)}  />
        <StatCard icon={DollarSign} title="Total Wagered"            value={fmtUSD(data.totals.totalWagered)} iconColor="text-blue-400"    iconBg="bg-blue-500/10" />
        <StatCard icon={DollarSign} title="Total Paid Out"           value={fmtUSD(data.totals.totalPaid)}    iconColor="text-amber-400"   iconBg="bg-amber-500/10" />
        <StatCard icon={TrendingUp} title="Platform Revenue"         value={fmtUSD(data.totals.platformRevenue)} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
      </div>

      <SectionCard title={`Per-Game Breakdown (${data.period})`} description={`Since ${new Date(data.since).toLocaleDateString()}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="pb-2 text-left font-medium">Game</th>
                <th className="pb-2 text-right font-medium">Bets</th>
                <th className="pb-2 text-right font-medium">Rounds (30d)</th>
                <th className="pb-2 text-right font-medium">Wagered</th>
                <th className="pb-2 text-right font-medium">Paid</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.byGameType).map(([gt, row]) => (
                <tr key={gt} className="border-b border-zinc-800/30 hover:bg-white/[0.015]">
                  <td className="py-2 pr-4 text-zinc-300 capitalize text-xs">{gt.replace(/_/g, " ")}</td>
                  <td className="py-2 text-right text-zinc-400 text-xs">{fmtNum(row.totalGames)}</td>
                  <td className="py-2 text-right text-zinc-400 text-xs">{fmtNum(row.rounds30d)}</td>
                  <td className="py-2 text-right text-zinc-300 text-xs">{fmtUSD(row.totalWagered)}</td>
                  <td className="py-2 text-right text-zinc-300 text-xs">{fmtUSD(row.totalPaid)}</td>
                  <td className="py-2 text-right text-xs">
                    <span className={row.platformRevenue >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {fmtUSD(row.platformRevenue)}
                    </span>
                  </td>
                </tr>
              ))}
              {Object.keys(data.byGameType).length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-zinc-600 text-sm">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const API_BASE = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ?? "http://localhost:3001";

function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("bitzimi_access_token");
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  }).then(async (res) => {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? json?.message ?? "Request failed");
    return (json.data ?? json) as T;
  });
}

export default function GamesPage() {
  const { can } = useAdminAccess();
  const canView   = can("admin.games.view");
  const canManage = can("admin.games.manage");

  const [tab,        setTab]        = useState<Tab>("config");
  const [games,      setGames]      = useState<GameConfig[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Football AI toggle
  const [aiEnabled,   setAiEnabled]   = useState<boolean | null>(null);
  const [aiToggling,  setAiToggling]  = useState(false);

  const load = useCallback(async () => {
    if (!canView) return;
    try {
      const [gameData, aiConfig] = await Promise.all([
        adminGamesService.fetchConfigs(),
        adminFetch<{ isEnabled: boolean }>("/api/v1/admin/ai/config").catch(() => null),
      ]);
      setGames(gameData); setError("");
      if (aiConfig) setAiEnabled(aiConfig.isEnabled);
    } catch (e: any) { setError(e.message ?? "Failed to load game configs"); }
    finally { setLoading(false); setRefreshing(false); }
  }, [canView]);

  useEffect(() => { load(); }, [load]);

  const toggleAi = async () => {
    if (!canManage || aiToggling || aiEnabled === null) return;
    setAiToggling(true);
    try {
      const res = await adminFetch<{ isEnabled: boolean }>("/api/v1/admin/ai/config", {
        method: "PATCH",
        body: JSON.stringify({ isEnabled: !aiEnabled }),
      });
      setAiEnabled(res.isEnabled);
    } catch { /* ignore */ } finally { setAiToggling(false); }
  };

  const refresh = () => { setRefreshing(true); load(); };
  const updateGame = (g: GameConfig) => setGames(prev => prev.map(x => x.gameType === g.gameType ? g : x));

  const totalEnabled     = games.filter(g => g.enabled && !g.maintenance).length;
  const totalMaintenance = games.filter(g => g.maintenance).length;
  const totalDisabled    = games.filter(g => !g.enabled).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Game Management"
        description="Configure availability, maintenance mode, platform fees, lobbies, rooms, and stake values. Monitoring is read-only."
        badge={{ label: "Phase 5", variant: "default" }}
        actions={
          <button
            onClick={refresh} disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Gamepad2} title="Total Games"   value={games.length}         loading={loading} />
        <StatCard icon={Check}    title="Live"           value={totalEnabled}         loading={loading} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <StatCard icon={Wrench}   title="Maintenance"    value={totalMaintenance}     loading={loading} iconColor="text-amber-400"   iconBg="bg-amber-500/10" />
        <StatCard icon={Power}    title="Disabled"       value={totalDisabled}        loading={loading} iconColor="text-red-400"     iconBg="bg-red-500/10" />
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {!canManage && !loading && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          You have view-only access. Contact a super admin to modify game settings.
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-800 pb-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "config" && (
        <div className="space-y-4">
          {/* Football AI quick toggle */}
          <SectionCard title="Football AI Predictions" description="Enable or disable AI-powered football match predictions globally. For detailed management, visit the Football AI module.">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-300">
                  Status:{" "}
                  {aiEnabled === null
                    ? <span className="text-zinc-500">Loading…</span>
                    : aiEnabled
                    ? <span className="text-emerald-400 font-semibold">Enabled</span>
                    : <span className="text-red-400 font-semibold">Disabled</span>
                  }
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">Manages the Football AI prediction engine. Game outcomes are unaffected.</p>
                <Link
                  to="/admin/football/ai"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Open Football AI Module <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <Toggle
                checked={aiEnabled ?? false}
                onChange={toggleAi}
                disabled={!canManage || aiToggling || aiEnabled === null}
                label="Enable/disable Football AI"
              />
            </div>
          </SectionCard>

          {GAME_ORDER.map(gameType => {
            const game = games.find(g => g.gameType === gameType);
            return (
              <SectionCard key={gameType} title={game?.name ?? gameType} description={GAME_DESCRIPTIONS[gameType]}>
                {loading
                  ? <div className="h-24 rounded-xl bg-zinc-800/50 animate-pulse" />
                  : game
                  ? <GameCard game={game} canManage={canManage} onUpdated={updateGame} />
                  : <p className="text-zinc-500 text-sm">Game configuration unavailable.</p>
                }
              </SectionCard>
            );
          })}
        </div>
      )}

      {tab === "monitoring" && <MonitoringTab />}
      {tab === "history"    && <HistoryTab />}
      {tab === "analytics"  && <AnalyticsTab />}
    </div>
  );
}
