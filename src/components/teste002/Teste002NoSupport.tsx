import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Teste002NoSupportProps { compact?: boolean }

/** Aviso bem visível: o teste grátis não tem suporte; suporte só para clientes dos planos. */
export const Teste002NoSupport = ({ compact = false }: Teste002NoSupportProps) => (
  <div
    role="alert"
    className={cn(
      "flex gap-3 rounded-2xl border-2 border-primary bg-primary/15 text-foreground",
      compact ? "p-3 text-sm" : "p-5",
    )}
  >
    <AlertTriangle className={cn("shrink-0 text-primary", compact ? "h-5 w-5" : "h-8 w-8")} aria-hidden />
    <div>
      <p className={cn("t2-title text-primary", compact ? "text-sm" : "text-lg")}>TESTE GRÁTIS NÃO TEM SUPORTE</p>
      <p className="mt-1">Assista ao vídeo para instalar e usar o seu teste.</p>
      <p className="mt-1 text-muted-foreground">
        Suporte por WhatsApp, suporte por AnyDesk e suporte em grupo são apenas para clientes dos nossos planos.
      </p>
    </div>
  </div>
);
