import { openWhatsAppChat } from "@/lib/whatsapp";

interface Props {
  /** Phone in any format; digits are normalized to E.164 by openWhatsAppChat. */
  phone: string;
  /** Pre-filled message sent to WhatsApp. */
  message: string;
  /** Accessibility label for the button. */
  ariaLabel?: string;
  /** Short text shown next to the icon on hover (desktop). */
  hoverLabel?: string;
}

/**
 * Floating WhatsApp button pinned to the bottom-right corner.
 * Uses the semantic `cta` tokens (WhatsApp brand green) so it keeps the same
 * color across the scoped sales themes and dark mode.
 */
const FloatingWhatsAppCta = ({
  phone,
  message,
  ariaLabel = "Falar no WhatsApp",
  hoverLabel,
}: Props) => {
  const handleClick = () => {
    openWhatsAppChat(phone, message);
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={handleClick}
      className="group fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-cta text-cta-foreground shadow-[0_10px_34px_hsl(var(--cta)/0.45)] transition-transform duration-200 hover:scale-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-cta/40 active:scale-95 md:h-16 md:w-16"
    >
      {/* Pulsing halo */}
      <span
        aria-hidden="true"
        className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cta opacity-25"
      />
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        className="relative h-7 w-7 fill-current md:h-8 md:w-8"
      >
        <path d="M16 .396C7.164.396 0 7.56 0 16.396c0 2.876.756 5.688 2.192 8.164L.06 32l7.664-2.008a15.94 15.94 0 0 0 8.276 2.312c8.836 0 16-7.164 16-16S24.836.396 16 .396Zm0 29.208a13.14 13.14 0 0 1-7.212-2.164l-.516-.32-4.552 1.192 1.212-4.436-.336-.54A13.14 13.14 0 1 1 29.14 16.4c0 7.264-5.876 13.204-13.14 13.204Zm7.56-9.876c-.412-.208-2.44-1.204-2.816-1.34-.376-.14-.652-.208-.928.208-.276.412-1.064 1.34-1.304 1.616-.24.276-.48.312-.892.104-.412-.208-1.74-.64-3.312-2.04-1.224-1.092-2.052-2.436-2.292-2.848-.24-.412-.024-.632.18-.836.184-.184.412-.48.616-.72.208-.24.276-.412.412-.688.14-.276.068-.516-.036-.72-.104-.208-.928-2.24-1.276-3.064-.336-.808-.68-.696-.928-.708l-.792-.012c-.276 0-.72.104-1.096.516-.376.412-1.44 1.408-1.44 3.436 0 2.028 1.476 3.988 1.68 4.264.208.276 2.904 4.428 7.036 6.204.984.424 1.752.68 2.352.868.988.316 1.888.272 2.6.164.792-.116 2.44-.996 2.784-1.96.344-.964.344-1.788.24-1.96-.104-.176-.376-.276-.788-.484Z" />
      </svg>

      {/* Optional short label revealed on hover (desktop only) */}
      {hoverLabel ? (
        <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-lg bg-card px-3 py-2 text-xs font-semibold text-card-foreground opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 md:block">
          {hoverLabel}
        </span>
      ) : null}
    </button>
  );
};

export default FloatingWhatsAppCta;
