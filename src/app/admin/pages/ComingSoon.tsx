/**
 * ComingSoon — placeholder for Phase B+ admin modules.
 * Accepts a title and description so each route has a meaningful page.
 */

import { useNavigate } from "react-router";
import { Construction, ArrowLeft } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";

interface ComingSoonProps {
  title: string;
  description?: string;
  phase?: string;
}

export default function ComingSoon({ title, description, phase = "Phase B" }: ComingSoonProps) {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title={title}
        description={description}
        actions={
          <button
            onClick={() => navigate("/admin")}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
        }
      />

      <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-12 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-5">
          <Construction className="w-6 h-6 text-zinc-500" />
        </div>
        <p className="text-base font-semibold text-zinc-200 mb-2">{phase} — Coming Soon</p>
        <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">
          {description ??
            `The ${title} module will be implemented in ${phase}. The architecture and routing are already in place.`}
        </p>
      </div>
    </div>
  );
}
