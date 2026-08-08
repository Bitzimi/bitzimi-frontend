/**
 * Admin Content Library Page
 *
 * Manage FAQs, Help articles, Blog posts, and Announcements.
 * Each post can be drafted, edited, and published.
 */
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  BookOpen, RefreshCw, Plus, Search, X, Edit2, Trash2,
  Globe, EyeOff,
} from "lucide-react";
import { PageHeader }  from "../../components/ui/PageHeader";
import { SectionCard } from "../../components/ui/SectionCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState }  from "../../components/ui/EmptyState";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  adminContentService,
  type AdminContentItem,
  type AdminContentDetail,
  type ContentCategory,
  type ContentStatus,
} from "../../services/adminDataService";

const CATEGORIES: Array<{ value: ContentCategory | ""; label: string }> = [
  { value: "",             label: "All Categories" },
  { value: "faq",          label: "FAQ"            },
  { value: "help",         label: "Help"           },
  { value: "blog",         label: "Blog"           },
  { value: "announcement", label: "Announcements"  },
];

const CATEGORY_COLORS: Record<ContentCategory, string> = {
  faq:          "bg-sky-500/12 text-sky-400 border-sky-500/20",
  help:         "bg-emerald-500/12 text-emerald-400 border-emerald-500/20",
  blog:         "bg-indigo-500/12 text-indigo-400 border-indigo-500/20",
  announcement: "bg-amber-500/12 text-amber-400 border-amber-500/20",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Editor Drawer ─────────────────────────────────────────────────────────────

function ContentEditorDrawer({
  postId, onClose, onSaved,
}: { postId: string | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    category: "faq" as ContentCategory,
    title: "", body: "", excerpt: "", slug: "",
  });
  const [loading,  setLoading]  = useState(!!postId);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (!postId) { setLoading(false); return; }
    setLoading(true);
    adminContentService.fetchOne(postId)
      .then(d => setForm({ category: d.category, title: d.title, body: d.body, excerpt: d.excerpt ?? "", slug: d.slug }))
      .catch(() => toast.error("Failed to load post"))
      .finally(() => setLoading(false));
  }, [postId]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    setSaving(true);
    try {
      if (postId) {
        await adminContentService.update(postId, { title: form.title, body: form.body, excerpt: form.excerpt || null, slug: form.slug || undefined });
      } else {
        await adminContentService.create({ category: form.category, title: form.title, body: form.body, excerpt: form.excerpt || undefined, slug: form.slug || undefined });
      }
      toast.success(postId ? "Post updated" : "Post created");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-end">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <aside className="relative z-10 h-full w-full max-w-2xl bg-[#111115] border-l border-white/[0.06] flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
            <h2 className="text-sm font-semibold text-white">{postId ? "Edit Post" : "New Post"}</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!postId && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value as ContentCategory }))}
                    className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    {CATEGORIES.filter(c => c.value).map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Title</label>
                <input
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Post title…"
                  className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Slug (URL)</label>
                <input
                  value={form.slug}
                  onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
                  placeholder="auto-generated from title if empty"
                  className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Excerpt (optional)</label>
                <textarea
                  value={form.excerpt}
                  onChange={e => setForm(p => ({ ...p, excerpt: e.target.value }))}
                  rows={2}
                  placeholder="Short summary shown in lists…"
                  className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Body (Markdown)</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  rows={18}
                  placeholder="# Heading&#10;&#10;Write your content here in Markdown..."
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
              {saving ? "Saving…" : (postId ? "Save Changes" : "Create Post")}
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContentPage() {
  const { can } = useAdminAccess();
  const canEdit = can("admin.content.edit");

  const [items,       setItems]       = useState<AdminContentItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor,  setNextCursor]  = useState<string | null>(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [search,      setSearch]      = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category,    setCategory]    = useState<ContentCategory | "">("");
  const [status,      setStatus]      = useState<ContentStatus | "">("");
  const [editorId,    setEditorId]    = useState<string | null | undefined>(undefined); // undefined = closed, null = new
  const [actioning,   setActioning]   = useState<Record<string, boolean>>({});

  const load = useCallback(async (reset = true) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const opts: any = { limit: 50 };
      if (category) opts.category = category;
      if (status)   opts.status   = status;
      if (search)   opts.search   = search;
      if (!reset && nextCursor) opts.cursor = nextCursor;
      const result = await adminContentService.fetchList(opts);
      if (reset) setItems(result.items); else setItems(p => [...p, ...result.items]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch { toast.error("Failed to load content"); }
    finally { if (reset) setLoading(false); else setLoadingMore(false); }
  }, [category, status, search, nextCursor]);

  useEffect(() => { load(true); }, [category, status, search]);

  const handlePublish = async (item: AdminContentItem) => {
    setActioning(p => ({ ...p, [item.id]: true }));
    try {
      if (item.status === "published") {
        await adminContentService.unpublish(item.id);
        toast.success("Post unpublished");
      } else {
        await adminContentService.publish(item.id);
        toast.success("Post published");
      }
      setItems(p => p.map(x => x.id === item.id ? { ...x, status: item.status === "published" ? "draft" : "published" } : x));
    } catch (e: any) { toast.error(e.message ?? "Action failed"); }
    finally { setActioning(p => ({ ...p, [item.id]: false })); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    setActioning(p => ({ ...p, [id]: true }));
    try {
      await adminContentService.delete(id);
      setItems(p => p.filter(x => x.id !== id));
      toast.success("Post deleted");
    } catch (e: any) { toast.error(e.message ?? "Delete failed"); }
    finally { setActioning(p => ({ ...p, [id]: false })); }
  };

  if (!can("admin.content.view")) {
    return <div className="max-w-7xl mx-auto"><EmptyState icon={BookOpen} title="Access Denied" description="You do not have permission to view content." /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Content Library"
        description="Manage FAQs, help articles, blog posts, and announcements. Publish or draft content as needed."
        actions={canEdit ? (
          <button
            onClick={() => setEditorId(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
          >
            <Plus className="w-4 h-4" />New Post
          </button>
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
            placeholder="Search posts…"
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
          />
          {searchInput && <button onClick={() => { setSearchInput(""); setSearch(""); }} className="text-zinc-600 hover:text-white"><X className="w-3 h-3" /></button>}
        </div>

        <select
          value={category}
          onChange={e => setCategory(e.target.value as any)}
          className="bg-zinc-900/60 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
        >
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <select
          value={status}
          onChange={e => setStatus(e.target.value as any)}
          className="bg-zinc-900/60 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>

        <button onClick={() => load(true)} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors ml-auto">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </button>
      </div>

      <SectionCard noPadding>
        {loading ? (
          <div className="divide-y divide-white/[0.04]">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 animate-pulse bg-zinc-900/40 m-2 rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No content posts"
            description={search ? "No posts match your search." : "Create your first content post to get started."}
            action={canEdit ? { label: "New Post", onClick: () => setEditorId(null) } : undefined}
          />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.01]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${CATEGORY_COLORS[item.category]}`}>
                      {item.category}
                    </span>
                    <span className="text-sm font-medium text-white truncate">{item.title}</span>
                  </div>
                  {item.excerpt && <p className="text-xs text-zinc-500 truncate mt-0.5">{item.excerpt}</p>}
                  <p className="text-[10px] text-zinc-600 mt-1">
                    {item.publishedAt ? `Published ${fmtDate(item.publishedAt)}` : `Created ${fmtDate(item.createdAt)}`}
                  </p>
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
                      onClick={() => handleDelete(item.id)}
                      disabled={actioning[item.id]}
                      className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div className="px-5 py-3 border-t border-white/[0.04]">
            <button onClick={() => load(false)} disabled={loadingMore} className="text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors">
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </SectionCard>

      {editorId !== undefined && (
        <ContentEditorDrawer
          postId={editorId}
          onClose={() => setEditorId(undefined)}
          onSaved={() => load(true)}
        />
      )}
    </div>
  );
}
