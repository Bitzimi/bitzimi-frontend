import { useState, useEffect, useMemo, useCallback } from "react";
import {
  DollarSign, Plus, Search, Save, Trash2, RefreshCw, AlertTriangle,
  CheckCircle2, ToggleLeft, ToggleRight, ArrowUp, ArrowDown,
  Star, Zap, Globe,
} from "lucide-react";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

async function currencyFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? "API error"), { status: res.status });
  return json.data as T;
}

interface CurrencyEntry {
  code:       string;
  name:       string;
  symbol:     string;
  rate:       number;
  rateSource: "manual" | "automatic";
  enabled:    boolean;
  sortOrder:  number;
  country:    string | null;
  flag:       string | null;
  isDefault:  boolean;
  updatedAt:  string;
  updatedBy:  string | null;
}

const EMPTY_FORM = { code: "", name: "", symbol: "", rate: "1", rateSource: "manual" as "manual" | "automatic", sortOrder: "999", country: "", flag: "" };

export default function AdminCurrencyPage() {
  const { hasPermission } = useAdminAccess();
  const canEdit = hasPermission("admin.config.edit");

  const [currencies, setCurrencies]         = useState<CurrencyEntry[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [editRates, setEditRates]           = useState<Record<string, string>>({});
  const [editSymbols, setEditSymbols]       = useState<Record<string, string>>({});
  const [editNames, setEditNames]           = useState<Record<string, string>>({});
  const [editCountries, setEditCountries]   = useState<Record<string, string>>({});
  const [editFlags, setEditFlags]           = useState<Record<string, string>>({});
  const [editOrders, setEditOrders]         = useState<Record<string, string>>({});
  const [editSources, setEditSources]       = useState<Record<string, "manual" | "automatic">>({});
  const [saving, setSaving]                 = useState<Record<string, boolean>>({});
  const [saveOk, setSaveOk]                 = useState<Record<string, boolean>>({});
  const [error, setError]                   = useState("");
  const [deleteTarget, setDeleteTarget]     = useState<CurrencyEntry | null>(null);
  const [showAdd, setShowAdd]               = useState(false);
  const [addForm, setAddForm]               = useState(EMPTY_FORM);
  const [addError, setAddError]             = useState("");
  const [addLoading, setAddLoading]         = useState(false);
  const [syncing, setSyncing]               = useState(false);
  const [syncResult, setSyncResult]         = useState<{ synced: string[]; skipped: string[]; errors: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await currencyFetch<CurrencyEntry[]>("/api/v1/admin/currency");
      setCurrencies(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return currencies.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.country ?? "").toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q)
    );
  }, [currencies, search]);

  function isDirty(c: CurrencyEntry) {
    return (
      (editRates[c.code]     !== undefined && editRates[c.code]     !== String(c.rate))     ||
      (editSymbols[c.code]   !== undefined && editSymbols[c.code]   !== c.symbol)           ||
      (editNames[c.code]     !== undefined && editNames[c.code]     !== c.name)             ||
      (editCountries[c.code] !== undefined && editCountries[c.code] !== (c.country ?? ""))  ||
      (editFlags[c.code]     !== undefined && editFlags[c.code]     !== (c.flag ?? ""))     ||
      (editOrders[c.code]    !== undefined && editOrders[c.code]    !== String(c.sortOrder))||
      (editSources[c.code]   !== undefined && editSources[c.code]   !== c.rateSource)
    );
  }

  async function saveRow(c: CurrencyEntry) {
    setSaving(p => ({ ...p, [c.code]: true }));
    try {
      const patch: Record<string, any> = {};
      if (editRates[c.code]     !== undefined) patch.rate       = parseFloat(editRates[c.code]);
      if (editSymbols[c.code]   !== undefined) patch.symbol     = editSymbols[c.code];
      if (editNames[c.code]     !== undefined) patch.name       = editNames[c.code];
      if (editCountries[c.code] !== undefined) patch.country    = editCountries[c.code] || null;
      if (editFlags[c.code]     !== undefined) patch.flag       = editFlags[c.code] || null;
      if (editOrders[c.code]    !== undefined) patch.sortOrder  = parseInt(editOrders[c.code], 10);
      if (editSources[c.code]   !== undefined) patch.rateSource = editSources[c.code];
      const updated = await currencyFetch<CurrencyEntry>(`/api/v1/admin/currency/${c.code}`, { method: "PATCH", body: JSON.stringify(patch) });
      setCurrencies(prev => prev.map(x => x.code === updated.code ? updated : x).sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)));
      setEditRates(p => { const n = { ...p }; delete n[c.code]; return n; });
      setEditSymbols(p => { const n = { ...p }; delete n[c.code]; return n; });
      setEditNames(p => { const n = { ...p }; delete n[c.code]; return n; });
      setEditCountries(p => { const n = { ...p }; delete n[c.code]; return n; });
      setEditFlags(p => { const n = { ...p }; delete n[c.code]; return n; });
      setEditOrders(p => { const n = { ...p }; delete n[c.code]; return n; });
      setEditSources(p => { const n = { ...p }; delete n[c.code]; return n; });
      setSaveOk(p => ({ ...p, [c.code]: true }));
      setTimeout(() => setSaveOk(p => ({ ...p, [c.code]: false })), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(p => ({ ...p, [c.code]: false }));
    }
  }

  async function toggleEnabled(c: CurrencyEntry) {
    if (!canEdit || c.code === "USD") return;
    try {
      const updated = await currencyFetch<CurrencyEntry>(`/api/v1/admin/currency/${c.code}`, { method: "PATCH", body: JSON.stringify({ enabled: !c.enabled }) });
      setCurrencies(prev => prev.map(x => x.code === updated.code ? updated : x));
    } catch (e: any) { setError(e.message); }
  }

  async function setDefault(c: CurrencyEntry) {
    if (!canEdit || c.isDefault) return;
    try {
      const updated = await currencyFetch<CurrencyEntry>(`/api/v1/admin/currency/${c.code}`, { method: "PATCH", body: JSON.stringify({ isDefault: true }) });
      setCurrencies(prev => prev.map(x => ({ ...x, isDefault: x.code === updated.code })));
    } catch (e: any) { setError(e.message); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await currencyFetch(`/api/v1/admin/currency/${deleteTarget.code}`, { method: "DELETE" });
      setCurrencies(prev => prev.filter(x => x.code !== deleteTarget.code));
      setDeleteTarget(null);
    } catch (e: any) { setError(e.message); }
  }

  async function handleAdd() {
    if (!addForm.code || !addForm.name || !addForm.symbol) { setAddError("Code, name and symbol are required"); return; }
    const rate = parseFloat(addForm.rate);
    if (!isFinite(rate) || rate <= 0) { setAddError("Rate must be a positive number"); return; }
    setAddLoading(true); setAddError("");
    try {
      const created = await currencyFetch<CurrencyEntry>("/api/v1/admin/currency", {
        method: "POST",
        body: JSON.stringify({
          code:       addForm.code.toUpperCase(),
          name:       addForm.name,
          symbol:     addForm.symbol,
          rate,
          rateSource: addForm.rateSource,
          sortOrder:  parseInt(addForm.sortOrder, 10) || 999,
          country:    addForm.country || undefined,
          flag:       addForm.flag || undefined,
        }),
      });
      setCurrencies(prev => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)));
      setShowAdd(false);
      setAddForm(EMPTY_FORM);
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function syncRates() {
    if (!canEdit) return;
    setSyncing(true); setSyncResult(null);
    try {
      const result = await currencyFetch<{ synced: string[]; skipped: string[]; errors: string[] }>("/api/v1/admin/currency/sync-rates", { method: "POST" });
      setSyncResult(result);
      if (result.synced.length > 0) await load();
    } catch (e: any) {
      setSyncResult({ synced: [], skipped: [], errors: [e.message] });
    } finally {
      setSyncing(false);
    }
  }

  function moveSortOrder(c: CurrencyEntry, direction: "up" | "down") {
    const sorted = [...currencies].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
    const idx = sorted.findIndex(x => x.code === c.code);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swap = sorted[swapIdx];
    const newOrderA = swap.sortOrder;
    const newOrderB = c.sortOrder;
    // Patch both
    Promise.all([
      currencyFetch<CurrencyEntry>(`/api/v1/admin/currency/${c.code}`,    { method: "PATCH", body: JSON.stringify({ sortOrder: newOrderA }) }),
      currencyFetch<CurrencyEntry>(`/api/v1/admin/currency/${swap.code}`, { method: "PATCH", body: JSON.stringify({ sortOrder: newOrderB }) }),
    ]).then(([updatedA, updatedB]) => {
      setCurrencies(prev => prev.map(x => {
        if (x.code === updatedA.code) return updatedA;
        if (x.code === updatedB.code) return updatedB;
        return x;
      }).sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)));
    }).catch(e => setError(e.message));
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading currencies…
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <DollarSign className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Currency Management</h1>
            <p className="text-sm text-muted-foreground">Display currencies only — all balances remain in USD internally</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={syncRates}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors disabled:opacity-50"
            >
              <Zap className={`h-4 w-4 ${syncing ? "animate-pulse" : ""}`} />
              {syncing ? "Syncing…" : "Sync Auto Rates"}
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Currency
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-200">×</button>
        </div>
      )}

      {/* Sync result */}
      {syncResult && (
        <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-950/30 text-sm space-y-1">
          <p className="font-medium text-blue-300">Rate Sync Result</p>
          {syncResult.synced.length > 0 && <p className="text-green-400">✓ Updated: {syncResult.synced.join(", ")}</p>}
          {syncResult.errors.length > 0 && <p className="text-red-400">✗ Errors: {syncResult.errors.join("; ")}</p>}
          {syncResult.skipped.length > 0 && <p className="text-yellow-400">⚠ Skipped: {syncResult.skipped.join(", ")}</p>}
          <button onClick={() => setSyncResult(null)} className="text-blue-400 hover:text-blue-200 text-xs">Dismiss</button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search currencies…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/40"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                <th className="px-3 py-2.5 text-left font-medium w-8">Order</th>
                <th className="px-3 py-2.5 text-left font-medium">Currency</th>
                <th className="px-3 py-2.5 text-left font-medium">Symbol</th>
                <th className="px-3 py-2.5 text-left font-medium">Rate (1 USD =)</th>
                <th className="px-3 py-2.5 text-left font-medium">Source</th>
                <th className="px-3 py-2.5 text-left font-medium">Country</th>
                <th className="px-3 py-2.5 text-left font-medium">Status</th>
                <th className="px-3 py-2.5 text-left font-medium">Default</th>
                <th className="px-3 py-2.5 text-left font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(c => {
                const dirty  = isDirty(c);
                const saving_ = saving[c.code];
                const ok     = saveOk[c.code];
                return (
                  <tr key={c.code} className="hover:bg-muted/20 transition-colors">
                    {/* Sort order */}
                    <td className="px-3 py-2">
                      {canEdit && (
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => moveSortOrder(c, "up")}   className="text-muted-foreground hover:text-foreground transition-colors" title="Move up">
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button onClick={() => moveSortOrder(c, "down")} className="text-muted-foreground hover:text-foreground transition-colors" title="Move down">
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Code + name + flag */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{c.flag ?? ""}</span>
                        <div>
                          <div className="font-mono font-semibold text-foreground">{c.code}</div>
                          {canEdit ? (
                            <input
                              className="text-xs text-muted-foreground bg-transparent border-b border-transparent hover:border-border focus:border-purple-500 focus:outline-none w-32"
                              value={editNames[c.code] ?? c.name}
                              onChange={e => setEditNames(p => ({ ...p, [c.code]: e.target.value }))}
                            />
                          ) : (
                            <div className="text-xs text-muted-foreground">{c.name}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Symbol */}
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <input
                          className="w-16 px-1.5 py-0.5 text-sm bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/40"
                          value={editSymbols[c.code] ?? c.symbol}
                          onChange={e => setEditSymbols(p => ({ ...p, [c.code]: e.target.value }))}
                        />
                      ) : (
                        <span className="font-mono">{c.symbol}</span>
                      )}
                    </td>

                    {/* Rate */}
                    <td className="px-3 py-2">
                      {canEdit && c.rateSource === "manual" ? (
                        <input
                          type="number"
                          step="any"
                          min="0.000001"
                          className="w-28 px-1.5 py-0.5 text-sm bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/40"
                          value={editRates[c.code] ?? String(c.rate)}
                          onChange={e => setEditRates(p => ({ ...p, [c.code]: e.target.value }))}
                        />
                      ) : (
                        <span className="font-mono text-green-400">{c.rate.toLocaleString()}</span>
                      )}
                    </td>

                    {/* Rate source */}
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <select
                          className="text-xs bg-background border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none"
                          value={editSources[c.code] ?? c.rateSource}
                          onChange={e => setEditSources(p => ({ ...p, [c.code]: e.target.value as "manual" | "automatic" }))}
                        >
                          <option value="manual">Manual</option>
                          <option value="automatic">Auto</option>
                        </select>
                      ) : (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${c.rateSource === "automatic" ? "bg-blue-500/15 text-blue-400" : "bg-gray-500/15 text-gray-400"}`}>
                          {c.rateSource === "automatic" ? "Auto" : "Manual"}
                        </span>
                      )}
                    </td>

                    {/* Country */}
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <div className="flex items-center gap-1">
                          <input
                            className="w-24 px-1.5 py-0.5 text-xs bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/40"
                            placeholder="Country"
                            value={editCountries[c.code] ?? (c.country ?? "")}
                            onChange={e => setEditCountries(p => ({ ...p, [c.code]: e.target.value }))}
                          />
                          <input
                            className="w-10 px-1 py-0.5 text-xs bg-background border border-border rounded text-foreground focus:outline-none"
                            placeholder="🏳"
                            value={editFlags[c.code] ?? (c.flag ?? "")}
                            onChange={e => setEditFlags(p => ({ ...p, [c.code]: e.target.value }))}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{c.country ?? "—"}</span>
                      )}
                    </td>

                    {/* Enabled */}
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleEnabled(c)}
                        disabled={!canEdit || c.code === "USD"}
                        className="flex items-center gap-1.5 transition-colors disabled:cursor-not-allowed"
                        title={c.code === "USD" ? "Base currency — always enabled" : c.enabled ? "Disable" : "Enable"}
                      >
                        {c.enabled
                          ? <ToggleRight className="h-5 w-5 text-green-400" />
                          : <ToggleLeft  className="h-5 w-5 text-muted-foreground" />}
                        <span className={`text-xs ${c.enabled ? "text-green-400" : "text-muted-foreground"}`}>
                          {c.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </button>
                    </td>

                    {/* Default */}
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setDefault(c)}
                        disabled={!canEdit || c.isDefault || !c.enabled}
                        className="transition-colors disabled:cursor-not-allowed"
                        title={c.isDefault ? "Default display currency" : "Set as default"}
                      >
                        <Star className={`h-4 w-4 ${c.isDefault ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`} />
                      </button>
                    </td>

                    {/* Save + Delete */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {canEdit && dirty && (
                          <button
                            onClick={() => saveRow(c)}
                            disabled={saving_}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded hover:bg-purple-600/30 transition-colors disabled:opacity-50"
                          >
                            {saving_ ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Save
                          </button>
                        )}
                        {ok && !dirty && (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle2 className="h-3 w-3" /> Saved
                          </span>
                        )}
                        {canEdit && c.code !== "USD" && (
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                            title="Delete currency"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    {search ? "No currencies match your search." : "No currencies configured."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{currencies.filter(c => c.enabled).length} enabled</span>
        <span>·</span>
        <span>{currencies.filter(c => c.rateSource === "automatic").length} auto-rate</span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Globe className="h-3 w-3" />
          {currencies.length} total
        </span>
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen
          title="Delete Currency"
          description={`Remove ${deleteTarget.flag ?? ""} ${deleteTarget.name} (${deleteTarget.code})? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Add Currency Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Add Currency</h2>
              <button onClick={() => { setShowAdd(false); setAddForm(EMPTY_FORM); setAddError(""); }} className="text-muted-foreground hover:text-foreground">×</button>
            </div>

            {addError && (
              <div className="flex items-center gap-2 p-2 rounded bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
                <AlertTriangle className="h-3.5 w-3.5" /> {addError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {([
                { label: "ISO Code *", field: "code",    placeholder: "AED, CAD…", upper: true },
                { label: "Flag Emoji", field: "flag",    placeholder: "🇦🇪" },
                { label: "Name *",     field: "name",    placeholder: "UAE Dirham", span: true },
                { label: "Symbol *",   field: "symbol",  placeholder: "د.إ" },
                { label: "Country",    field: "country", placeholder: "UAE" },
                { label: "Rate *",     field: "rate",    placeholder: "3.67", type: "number" },
                { label: "Sort Order", field: "sortOrder", placeholder: "999", type: "number" },
              ] as Array<{ label: string; field: keyof typeof addForm; placeholder: string; upper?: boolean; span?: boolean; type?: string }>).map(({ label, field, placeholder, upper, span, type }) => (
                <div key={field} className={span ? "col-span-2" : ""}>
                  <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                  <input
                    type={type ?? "text"}
                    step={type === "number" ? "any" : undefined}
                    placeholder={placeholder}
                    value={addForm[field]}
                    onChange={e => setAddForm(p => ({ ...p, [field]: upper ? e.target.value.toUpperCase() : e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              ))}

              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Rate Source</label>
                <div className="flex gap-3">
                  {(["manual", "automatic"] as const).map(src => (
                    <label key={src} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="rateSource" value={src} checked={addForm.rateSource === src} onChange={() => setAddForm(p => ({ ...p, rateSource: src }))} className="accent-purple-500" />
                      <span className="text-sm text-foreground capitalize">{src}</span>
                    </label>
                  ))}
                </div>
                {addForm.rateSource === "automatic" && (
                  <p className="text-xs text-muted-foreground mt-1">Rate will be overwritten on next sync. Initial rate still required.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setShowAdd(false); setAddForm(EMPTY_FORM); setAddError(""); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button onClick={handleAdd} disabled={addLoading} className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50">
                {addLoading ? "Adding…" : "Add Currency"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
