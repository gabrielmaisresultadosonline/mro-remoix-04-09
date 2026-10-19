import { AlertTriangle, MessageCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PlanExpiredOverlayProps {
  /** Link de renovação (usado quando onWhatsApp não é informado). */
  whatsappLink: string;
  /** Ação ao clicar no botão do WhatsApp (ex.: navegar para /whatsapp). */
  onWhatsApp?: () => void;
  /** Nome/usuário exibido no aviso. */
  displayName?: string | null;
  /** Data em que o acesso expirou. */
  expiredAt?: string | null;
  onLogout?: () => void;
}

/**
 * Bloqueio de tela inteira exibido quando o plano de 30 dias expira.
 * pointer-events-auto garante cliques mesmo se algum diálogo travar o body.
 */
export const PlanExpiredOverlay = ({
  whatsappLink,
  onWhatsApp,
  displayName,
  expiredAt,
  onLogout,
}: PlanExpiredOverlayProps) => {
  const formatted = (() => {
    if (!expiredAt) return null;
    const d = new Date(expiredAt);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
  })();

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="plan-expired-title"
      className="pointer-events-auto fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur-sm"
    >
      <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-destructive/40 bg-card p-6 text-center shadow-2xl sm:p-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
        </div>

        <h2 id="plan-expired-title" className="text-2xl font-bold text-foreground sm:text-3xl">
          Seu plano expirou
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {displayName ? <span className="font-semibold text-foreground">{displayName}</span> : "Olá"}, o
          seu período de <span className="font-semibold text-foreground">30 dias</span> chegou ao fim
          {formatted ? ` em ${formatted}` : ""}. O acesso à ferramenta e aos produtos está bloqueado até a
          renovação.
        </p>

        <div className="mt-5 rounded-xl border border-border bg-muted/50 p-4 text-left">
          <p className="text-sm text-muted-foreground">
            Para liberar novamente, entre em contato conosco pelo WhatsApp e confira as condições e descontos
            disponíveis para você.
          </p>
        </div>

        <Button
          type="button"
          size="lg"
          className="mt-6 h-auto w-full whitespace-normal break-words bg-cta py-4 text-base font-bold text-primary-foreground hover:bg-cta/90"
          onClick={() => {
            if (onWhatsApp) onWhatsApp();
            else window.location.href = whatsappLink;
          }}
        >
          <MessageCircle className="mr-2 h-5 w-5 shrink-0" aria-hidden="true" />
          FALAR NO WHATSAPP
        </Button>

        {onLogout && (
          <Button type="button" variant="ghost" size="sm" className="mt-4 text-muted-foreground" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Sair da conta
          </Button>
        )}
      </div>
    </div>
  );
};

export default PlanExpiredOverlay;
