interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: {
    label: string;
    variant?: "default" | "warning" | "danger" | "success";
  };
}

const BADGE_STYLES = {
  default: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  danger:  "bg-red-500/15 text-red-300 border-red-500/25",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
};

export function PageHeader({ title, description, actions, badge }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
      <div className="min-w-0">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
          {badge && (
            <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${BADGE_STYLES[badge.variant ?? "default"]}`}>
              {badge.label}
            </span>
          )}
        </div>
        {description && (
          <p className="text-sm text-zinc-500 max-w-xl">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
