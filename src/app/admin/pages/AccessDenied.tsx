import { useNavigate } from "react-router";
import { ShieldOff, ArrowLeft, Home } from "lucide-react";
import type { Permission } from "../types/index";

interface AccessDeniedProps {
  reason: "no_role" | "no_permission";
  permission?: Permission;
}

export default function AccessDenied({ reason, permission }: AccessDeniedProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
          <ShieldOff className="w-7 h-7 text-red-400" />
        </div>

        {/* Status code */}
        <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-2">
          403 — Access Denied
        </p>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-white mb-3">
          {reason === "no_role"
            ? "You don't have admin access"
            : "Insufficient permissions"}
        </h1>

        {/* Description */}
        <p className="text-zinc-400 text-sm leading-relaxed mb-8">
          {reason === "no_role"
            ? "Your account does not have an admin role. If you believe this is an error, contact your system administrator."
            : `Your role does not include the "${permission}" permission required for this section.`}
        </p>

        {/* Divider */}
        <div className="h-px bg-zinc-800 mb-8" />

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </button>
          <button
            onClick={() => navigate("/wallet")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-sm font-medium"
          >
            <Home className="w-4 h-4" />
            Back to platform
          </button>
        </div>

        {/* Footer note */}
        <p className="text-zinc-600 text-xs mt-8">
          Bitzimi Admin · Access is role-based and enforced server-side
        </p>
      </div>
    </div>
  );
}
