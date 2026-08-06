/**
 * Admin Platform Text Management
 *
 * Edit every piece of user-facing text on the platform without code changes.
 * Text is stored in SystemConfig with keys like text.{page}.{field}.
 * Customised entries are highlighted; admins can reset any to the platform default.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Type, RefreshCw, Search, X, RotateCcw, Check, Loader2, ChevronDown } from "lucide-react";
import { PageHeader }  from "../../components/ui/PageHeader";
import { SectionCard } from "../../components/ui/SectionCard";
import { EmptyState }  from "../../components/ui/EmptyState";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import { adminTextService, type AdminTextEntry } from "../../services/adminDataService";

// ── Inline editable row ───────────────────────────────────────────────────────

function TextRow({
  entry, canEdit, onSaved,
}: { entry: AdminTextEntry; canEdit: boolean; onSaved: (key: string, newVal: string) => void }) {
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState(entry.value);
  const [saving,   setSaving]   = useState(false);
  const [resetting, setResetting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(entry.value); }, [entry.value]);
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
      textareaRef.current.focus();
    }
  }, [editing]);

  const handleSave = async () => {
    if (draft === entry.value) { setEditing(false); return; }
    setSaving(true);
    try {
      await adminTextService.update(entry.key, draft);
      toast.success("Text updated");
      onSaved(entry.key, draft);
      setEditing(false);
    } catch (e: any) { toast.error(e.message ?? "Failed to save"); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    if (!window.confirm("Reset this text to the platform default?")) return;
    setResetting(true);
    try {
      await adminTextService.reset(entry.key);
      toast.success("Reset to default");
      onSaved(entry.key, entry.defaultValue ?? entry.value);
      setEditing(false);
    } catch (e: any) { toast.error(e.message ?? "Failed to reset"); }
    finally { setResetting(false); }
  };

  const keyLabel = entry.key.split(".").slice(2).join(".");

  return (
    <div className={`px-5 py-3 hover:bg-white/[0.01] transition-colors ${entry.isCustomised ? "border-l-2 border-indigo-500/40" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-zinc-500">{keyLabel}</span>
            {entry.isCustomised && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/12 text-indigo-400 border border-indigo-500/20 font-medium">
                customised
              </span>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={e => {
                  setDraft(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                className="w-full bg-zinc-900 border border-indigo-500/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none resize-none leading-relaxed"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Save
                </button>
                <button
                  onClick={() => { setEditing(false); setDraft(entry.value); }}
                  className="px-3 py-1.5 text-xs text-zinc-500 hover:text-white rounded-lg border border-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                {entry.isCustomised && (
                  <button
                    onClick={handleReset}
                    disabled={resetting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:text-amber-400 rounded-lg border border-white/[0.06] hover:border-amber-500/20 transition-colors disabled:opacity-40"
                  >
                    {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Reset to default
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{entry.value}</p>
          )}
        </div>

        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex-shrink-0 px-2.5 py-1 text-xs text-zinc-600 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors mt-1"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page group section ────────────────────────────────────────────────────────

function PageGroup({
  page, entries, canEdit, onSaved,
}: { page: string; entries: AdminTextEntry[]; canEdit: boolean; onSaved: (key: string, val: string) => void }) {
  const [open, setOpen] = useState(true);
  const customCount = entries.filter(e => e.isCustomised).length;

  return (
    <div className="border border-white/[0.06] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-zinc-900/40 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white capitalize">{page.replace(/-/g, " ")}</span>
          <span className="text-xs text-zinc-600">{entries.length} strings</span>
          {customCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/12 text-indigo-400 border border-indigo-500/20">
              {customCount} custom
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="divide-y divide-white/[0.04]">
          {entries.map(e => (
            <TextRow key={e.key} entry={e} canEdit={canEdit} onSaved={onSaved} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PlatformTextPage() {
  const { can } = useAdminAccess();
  const canEdit = can("admin.text.edit");

  const [pages,       setPages]       = useState<string[]>([]);
  const [entries,     setEntries]     = useState<AdminTextEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activePage,  setActivePage]  = useState<string>("all");
  const [search,      setSearch]      = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pagesResult, textResult] = await Promise.all([
        adminTextService.fetchPages(),
        adminTextService.fetchAll({ page: activePage === "all" ? undefined : activePage, search: search || undefined }),
      ]);
      setPages(pagesResult);
      setEntries(textResult);
    } catch { toast.error("Failed to load platform text"); }
    finally { setLoading(false); }
  }, [activePage, search]);

  useEffect(() => { load(); }, [activePage, search]);

  const handleSaved = (key: string, newVal: string) => {
    setEntries(prev => prev.map(e =>
      e.key === key ? { ...e, value: newVal, isCustomised: newVal !== e.defaultValue } : e
    ));
  };

  // Group by page
  const grouped = entries.reduce<Record<string, AdminTextEntry[]>>((acc, e) => {
    const page = e.key.split(".")[1] ?? "other";
    if (!acc[page]) acc[page] = [];
    acc[page].push(e);
    return acc;
  }, {});

  if (!can("admin.text.view")) {
    return <div className="max-w-7xl mx-auto"><EmptyState icon={Type} title="Access Denied" description="You do not have permission to view platform text." /></div>;
  }

  const totalCustomised = entries.filter(e => e.isCustomised).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Platform Text"
        description="Edit every piece of user-facing text on the platform. Changes take effect immediately. Customised strings are highlighted."
      />

      {/* Stats bar */}
      {!loading && (
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>{entries.length} strings</span>
          {totalCustomised > 0 && <span className="text-indigo-400">{totalCustomised} customised</span>}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/[0.06] rounded-xl px-3 py-2 flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && setSearch(searchInput.trim())}
            placeholder="Search text…"
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(""); setSearch(""); }} className="text-zinc-600 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {["all", ...pages].map(p => (
            <button
              key={p}
              onClick={() => setActivePage(p)}
              className={`px-3 py-1.5 text-xs rounded-xl capitalize transition-colors ${
                activePage === p
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-900/60 border border-white/[0.06] text-zinc-400 hover:text-white"
              }`}
            >
              {p === "all" ? "All Pages" : p.replace(/-/g, " ")}
            </button>
          ))}
        </div>

        <button onClick={load} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors ml-auto">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 animate-pulse bg-zinc-900/40 rounded-2xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon={Type} title="No text entries" description={search ? "No entries match your search." : "No platform text has been configured."} />
      ) : (
        <div className="space-y-4">
          {activePage === "all"
            ? Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([page, pageEntries]) => (
                <PageGroup key={page} page={page} entries={pageEntries} canEdit={canEdit} onSaved={handleSaved} />
              ))
            : (
                <div className="border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                  {entries.map(e => (
                    <TextRow key={e.key} entry={e} canEdit={canEdit} onSaved={handleSaved} />
                  ))}
                </div>
              )
          }
        </div>
      )}
    </div>
  );
}
