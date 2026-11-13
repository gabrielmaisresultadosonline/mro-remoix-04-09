import { ArrowRight, CreditCard, Flame, Shield } from "lucide-react";

/**
 * CTAs de promoção espalhados pelo meio da página de vendas.
 * Só apresentam: o clique rola até o container de preços (mesmo comportamento
 * do botão principal) e não muda preço, checkout nem provisionamento.
 */

const BUTTON_CLASS =
  "bn-cta bn-cta-green bg-cta text-cta-foreground font-black uppercase tracking-wide rounded-full px-7 sm:px-12 py-4 sm:py-6 text-base sm:text-2xl inline-flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-[0.99]";

type PromoCtaProps = {
  /** Texto do botão, ex.: "APROVEITAR PROMO". */
  label: string;
  /** Chama a rolagem até a seção de preços. */
  onCta: () => void;
  /** Faixa larga com destaque (padrão) ou botão centralizado simples. */
  variant?: "band" | "inline";
  /** Tarja pequena acima do botão (band). */
  eyebrow?: string;
  /** Frase de apoio acima do botão (band). */
  caption?: string;
};

export function PromoCtaBand({
  label,
  onCta,
  variant = "band",
  eyebrow = "Desconto Black November",
  caption,
}: PromoCtaProps) {
  if (variant === "inline") {
    return (
      <div className="flex justify-center px-3 sm:px-4 py-6 sm:py-8">
        <button type="button" onClick={onCta} className={BUTTON_CLASS}>
          {label} <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    );
  }

  return (
    <section className="py-8 sm:py-12 px-3 sm:px-4">
      <div className="bn-cta-band max-w-4xl mx-auto text-center rounded-2xl sm:rounded-3xl border-2 border-primary/60 bg-card/80 px-4 sm:px-10 py-8 sm:py-12">
        <span className="bn-pulse inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-[11px] sm:text-xs font-black uppercase tracking-[0.25em]">
          <Flame className="w-3.5 h-3.5" /> {eyebrow}
        </span>

        {caption && (
          <p className="text-foreground text-lg sm:text-2xl font-bold mt-4 sm:mt-5 leading-snug">
            {caption}
          </p>
        )}

        <div className="mt-6 sm:mt-7 flex justify-center">
          <button type="button" onClick={onCta} className={BUTTON_CLASS}>
            {label} <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="mt-4 sm:mt-5 flex items-center justify-center gap-4 sm:gap-6 text-[11px] sm:text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" /> Compra segura
          </span>
          <span className="flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5" /> PIX ou cartão
          </span>
        </div>
      </div>
    </section>
  );
}

export default PromoCtaBand;
