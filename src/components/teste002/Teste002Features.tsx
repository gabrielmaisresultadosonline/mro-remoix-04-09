import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Feature {
  id: string;
  title: string;
  text: string;
  allowed: boolean;
}

const FEATURES: Feature[] = [
  { id: "01", title: "Rastreia públicos de concorrentes e páginas", text: "Reúne seguidores, curtidores e quem comenta em listas organizadas.", allowed: false },
  { id: "02", title: "Envia mensagens em massa", text: "Contato com públicos de páginas, concorrentes e listas de @nomes.", allowed: false },
  { id: "03", title: "Atendente com Agente I.A", text: "Integrado ao ChatGPT, responde e conduz conversas comerciais.", allowed: false },
  { id: "04", title: "CRM Kanban", text: "Organize as conversas do Instagram pelo estágio de cada lead.", allowed: false },
  { id: "05", title: "Publica Stories diários", text: "Stories automáticos nos horários que você definir.", allowed: false },
  { id: "06", title: "Boas-vindas para novos seguidores", text: "Mensagem automática para cada novo seguidor.", allowed: true },
  { id: "07", title: "Seguir e curtir", text: "Interaja com públicos do seu nicho. (Deixar de seguir fica bloqueado no teste.)", allowed: true },
  { id: "08", title: "Inteligência I.A para estratégias", text: "Sugestões de conteúdo, scripts de vendas e posicionamento.", allowed: false },
];

/** Lista das funções: liberadas em amarelo; bloqueadas em vermelho riscado. */
export const Teste002Features = () => (
  <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
    {FEATURES.map((f) => (
      <li
        key={f.id}
        className={cn(
          "flex gap-3 rounded-xl border p-4",
          f.allowed ? "border-primary/60 bg-primary/10" : "border-destructive/40 bg-destructive/5",
        )}
      >
        {f.allowed ? (
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        ) : (
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
        )}
        <div>
          <p className={cn("font-bold", f.allowed ? "text-primary" : "text-destructive line-through")}>
            {f.id} · {f.title}
          </p>
          <p className={cn("text-sm", f.allowed ? "text-muted-foreground" : "text-destructive/80 line-through")}>{f.text}</p>
          <p className={cn("mt-1 text-xs font-bold uppercase", f.allowed ? "text-primary" : "text-destructive")}>
            {f.allowed ? "Liberado no teste" : "Não liberado no teste"}
          </p>
        </div>
      </li>
    ))}
  </ul>
);
