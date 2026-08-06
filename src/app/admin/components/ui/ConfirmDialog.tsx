import { AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";

type Variant = "danger" | "warning" | "success" | "info";

const VARIANT_CONFIG = {
  danger:  { icon: XCircle,       iconClass: "text-red-400",    btnClass: "bg-red-600 hover:bg-red-500" },
  warning: { icon: AlertTriangle, iconClass: "text-amber-400",  btnClass: "bg-amber-600 hover:bg-amber-500" },
  success: { icon: CheckCircle2,  iconClass: "text-emerald-400",btnClass: "bg-emerald-600 hover:bg-emerald-500" },
  info:    { icon: Info,          iconClass: "text-indigo-400", btnClass: "bg-indigo-600 hover:bg-indigo-500" },
};

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional note input */
  noteLabel?: string;
  noteValue?: string;
  onNoteChange?: (v: string) => void;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel",
  variant = "danger", onConfirm, onCancel,
  noteLabel, noteValue, onNoteChange,
}: ConfirmDialogProps) {
  if (!open) return null;

  const { icon: Icon, iconClass, btnClass } = VARIANT_CONFIG[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative w-full max-w-sm bg-[#1c1c22] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
        {/* Icon */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${iconClass}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Optional note */}
        {noteLabel && onNoteChange && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">{noteLabel}</label>
            <textarea
              value={noteValue}
              onChange={e => onNoteChange(e.target.value)}
              rows={2}
              placeholder="Optional note…"
              className="w-full text-sm bg-zinc-900 border border-white/[0.07] rounded-xl px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 text-sm font-medium transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 rounded-xl text-white text-sm font-medium transition-all ${btnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
