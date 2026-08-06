import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Column definition ────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  /** Return raw sortable value (string or number) */
  sortValue?: (row: T) => string | number;
  width?: string;          // Tailwind width class e.g. "w-32"
  align?: "left" | "right" | "center";
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  loading?: boolean;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  searchPlaceholder?: string;
  searchKeys?: (keyof T | ((row: T) => string))[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
}

const PAGE_SIZE_DEFAULT = 20;

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  emptyIcon,
  emptyTitle = "No data",
  emptyDescription,
  searchPlaceholder = "Search…",
  searchKeys,
  pageSize = PAGE_SIZE_DEFAULT,
  onRowClick,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim() || !searchKeys?.length) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      searchKeys.some(key => {
        const val = typeof key === "function" ? key(row) : String((row as any)[key] ?? "");
        return val.toLowerCase().includes(q);
      })
    );
  }, [data, search, searchKeys]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find(c => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    return [...filtered].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  if (loading) {
    return (
      <div className="space-y-2.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-zinc-800/50 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      {searchKeys && searchKeys.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-zinc-900 border border-white/[0.07] rounded-xl text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
        </div>
      )}

      {/* Count */}
      {search && (
        <p className="text-xs text-zinc-500">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
        </p>
      )}

      {/* Table wrapper */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-zinc-900/60">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`
                    px-4 py-3 text-left text-[11px] font-semibold tracking-wider text-zinc-500 uppercase whitespace-nowrap
                    ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}
                    ${col.hideOnMobile ? "hidden sm:table-cell" : ""}
                    ${col.width ?? ""}
                    ${col.sortable ? "cursor-pointer hover:text-zinc-300 select-none" : ""}
                  `}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className={`flex items-center gap-1 ${col.align === "right" ? "justify-end" : ""}`}>
                    {col.header}
                    {col.sortable && (
                      <span className="ml-0.5 text-zinc-700">
                        {sortKey === col.key
                          ? sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          : <ChevronsUpDown className="w-3 h-3" />}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-0">
                  <EmptyState
                    icon={emptyIcon ?? Search}
                    title={search ? "No results found" : emptyTitle}
                    description={search ? "Try a different search term" : emptyDescription}
                  />
                </td>
              </tr>
            ) : (
              paginated.map(row => (
                <tr
                  key={keyExtractor(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`
                    bg-[#18181b] hover:bg-zinc-800/60 transition-colors
                    ${onRowClick ? "cursor-pointer" : ""}
                  `}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={`
                        px-4 py-3.5 text-zinc-300
                        ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}
                        ${col.hideOnMobile ? "hidden sm:table-cell" : ""}
                        ${col.width ?? ""}
                      `}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 disabled:opacity-30 hover:border-zinc-500 hover:text-zinc-200 transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                    p === page
                      ? "bg-indigo-600 text-white border-transparent"
                      : "border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 disabled:opacity-30 hover:border-zinc-500 hover:text-zinc-200 transition-all"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
