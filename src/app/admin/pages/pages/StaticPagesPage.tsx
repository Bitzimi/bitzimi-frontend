/**
 * Admin Static Pages Page
 *
 * Manage platform static pages (About, FAQ, Privacy, Terms, etc.).
 * System pages cannot be deleted. All pages support draft/published workflow.
 */
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { FileText, RefreshCw, Plus, Edit2, Trash2, Globe, EyeOff, Lock, Loader2, Search, X } from "lucide-react";
import { PageHeader }  from "../../components/ui/PageHeader";
import { SectionCard } from "../../components/ui/SectionCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState }  from "../../components/ui/EmptyState";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  adminStaticPagesService,
  type AdminStaticPageItem,
} from "../../services/adminDataService";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Editor Drawer ─────────────────────────────────────────────────────────────

function PageEditorDrawer({
  pageId, onClose, onSaved,
}: { pageId: string | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ slug: "", title: "", body: "", sortOrder: 0 });
  const [loading, setLoading] = useState(!!pageId);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (!pageId) { setLoading(false); return; }
    setLoading(true);
    adminStaticPagesService.fetchOne(pageId)
      .then(d => setForm({ slug: d.slug, title: d.title, body: d.body, sortOrder: d.sortOrder }))
      .catch(() => toast.error("Failed to load page"))
      .finally(() => setLoading(false));
  }, [pageId]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    setSaving(true);
    try {
      if (pageId) {
        await adminStaticPagesService.update(pageId, { title: form.title, body: form.body, sortOrder: form.sortOrder });
      } else {
        await adminStaticPagesService.create({ slug: form.slug, title: form.title, body: form.body, sortOrder: form.sortOrder });
      }
      toast.success(pageId ? "Page updated" : "Page created");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative z-10 h-full w-full max-w-2xl bg-[#111115] border-l border-white/[0.06] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <h2 className="text-sm font-semibold text-white">{pageId ? "Edit Page" : "New Page"}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">✕</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!pageId && (
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Slug (URL)</label>
                <input
                  value={form.slug}
                  onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
                  placeholder="e.g. about-us"
                  className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 font-mono"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Title</label>
              <input
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Page title"
                className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={e => setForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-32 bg-zinc-900 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Body (Markdown)</label>
              <textarea
                value={form.body}
                onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                rows={22}
                placeholder="# Page Title&#10;&#10;Write the page content in Markdown..."
                className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none font-mono leading-relaxed"
              />
            </div>
          </div>
        )}

        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-t border-white/[0.06]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-xl border border-white/[0.06] hover:border-white/[0.10] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : (pageId ? "Save Changes" : "Create Page")}
          </button>
        </div>
      </aside>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StaticPagesPage() {
  const { can } = useAdminAccess();
  const canEdit = can("admin.pages.edit");

  const [items,       setItems]       = useState<AdminStaticPageItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [seeding,     setSeeding]     = useState(false);
  const [editorId,    setEditorId]    = useState<string | null | undefined>(undefined);
  const [actioning,   setActioning]   = useState<Record<string, boolean>>({});
  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]      = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "draft" | "published">("");

  const load = async (s = search, st = statusFilter) => {
    setLoading(true);
    try {
      const result = await adminStaticPagesService.fetchList({
        search: s || undefined,
        status: st || undefined,
      });
      setItems(result);
    } catch { toast.error("Failed to load pages"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, statusFilter]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await adminStaticPagesService.seed();
      toast.success("Default pages seeded");
      await load();
    } catch (e: any) { toast.error(e.message ?? "Seed failed"); }
    finally { setSeeding(false); }
  };

  const handlePublish = async (item: AdminStaticPageItem) => {
    setActioning(p => ({ ...p, [item.id]: true }));
    try {
      if (item.status === "published") {
        await adminStaticPagesService.unpublish(item.id);
        toast.success("Page unpublished");
      } else {
        await adminStaticPagesService.publish(item.id);
        toast.success("Page published");
      }
      setItems(p => p.map(x => x.id === item.id ? { ...x, status: item.status === "published" ? "draft" : "published" } : x));
    } catch (e: any) { toast.error(e.message ?? "Action failed"); }
    finally { setActioning(p => ({ ...p, [item.id]: false })); }
  };

  const handleDelete = async (item: AdminStaticPageItem) => {
    if (item.isSystem) { toast.error("System pages cannot be deleted"); return; }
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    setActioning(p => ({ ...p, [item.id]: true }));
    try {
      await adminStaticPagesService.delete(item.id);
      setItems(p => p.filter(x => x.id !== item.id));
      toast.success("Page deleted");
    } catch (e: any) { toast.error(e.message ?? "Delete failed"); }
    finally { setActioning(p => ({ ...p, [item.id]: false })); }
  };

  if (!can("admin.pages.view")) {
    return <div className="max-w-7xl mx-auto"><EmptyState icon={FileText} title="Access Denied" description="You do not have permission to view static pages." /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Static Pages"
        description="Manage platform static pages: About, FAQ, Privacy Policy, Terms, and more. System pages cannot be deleted."
        actions={canEdit ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-zinc-300 transition-colors disabled:opacity-50"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Seed Defaults
            </button>
            <button
              onClick={() => setEditorId(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
            >
              <Plus className="w-4 h-4" />New Page
            </button>
          </div>
        ) : undefined}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/[0.06] rounded-xl px-3 py-2 flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && setSearch(searchInput.trim())}
            placeholder="Search pages…"
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(""); setSearch(""); }} className="text-zinc-600 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="bg-zinc-900/60 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>

        <button onClick={() => load()} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors ml-auto">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </button>
      </div>

      <SectionCard noPadding>
        {loading ? (
          <div className="divide-y divide-white/[0.04]">
            {[...Array(6)].map((_, i) => <div key={i} className="h-16 animate-pulse bg-zinc-900/40 m-2 rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No static pages"
            description="Seed default pages to get started, or create a custom page."
            action={canEdit ? { label: "Seed Defaults", onClick: handleSeed } : undefined}
          />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.01]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {item.isSystem && (
                      <span title="System page — cannot be deleted" className="flex-shrink-0">
                        <Lock className="w-3 h-3 text-zinc-600" />
                      </span>
                    )}
                    <span className="text-sm font-medium text-white truncate">{item.title}</span>
                    <span className="text-xs text-zinc-600 font-mono flex-shrink-0">/{item.slug}</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-0.5">Updated {fmtDate(item.updatedAt)} · Order {item.sortOrder}</p>
                </div>

                <StatusBadge status={item.status === "published" ? "active" : "paused"} label={item.status === "published" ? "Published" : "Draft"} />

                {canEdit && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handlePublish(item)}
                      disabled={actioning[item.id]}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                        item.status === "published"
                          ? "text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10"
                          : "text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                      }`}
                      title={item.status === "published" ? "Unpublish" : "Publish"}
                    >
                      {item.status === "published" ? <EyeOff className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setEditorId(item.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={actioning[item.id] || item.isSystem}
                      className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title={item.isSystem ? "System pages cannot be deleted" : "Delete"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </SectionCard>

      {editorId !== undefined && (
        <PageEditorDrawer
          pageId={editorId}
          onClose={() => setEditorId(undefined)}
          onSaved={load}
        />
      )}
    </div>
  );
}
