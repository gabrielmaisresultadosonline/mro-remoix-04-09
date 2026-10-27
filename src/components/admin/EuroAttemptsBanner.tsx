import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Euro } from "lucide-react";

/** Tarja informativa: tentativas de compra da página Euro e atalho para o painel próprio. */
export function EuroAttemptsBanner() {
  const [counts, setCounts] = useState<{ total: number; pending: number; paid: number } | null>(null);

  useEffect(() => {
    supabase.from("mro_euro_orders").select("status").then(({ data }) => {
      const rows = data || [];
      setCounts({
        total: rows.length,
        pending: rows.filter((r) => r.status === "pending").length,
        paid: rows.filter((r) => r.status === "paid" || r.status === "completed").length,
      });
    });
  }, []);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm text-blue-200">
      <span className="flex items-center gap-2 font-semibold">
        <Euro className="w-4 h-4" /> EURO
        {counts && <span className="font-normal">· {counts.total} tentativas · {counts.pending} pendentes · {counts.paid} pagas</span>}
      </span>
      <Link to="/instagram-nova-euro/admin" className="underline font-medium">Abrir painel /instagram-nova-euro/admin</Link>
    </div>
  );
}
