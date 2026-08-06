/**
 * SectionCard — the primary container for admin content sections.
 * Consistent rounded corners, border, and background across all admin pages.
 */

interface SectionCardProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({
  title, description, actions, children, className = "", noPadding = false,
}: SectionCardProps) {
  return (
    <div className={`rounded-2xl bg-[#18181b] border border-white/[0.06] overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-white/[0.06]">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
            {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-5"}>
        {children}
      </div>
    </div>
  );
}
