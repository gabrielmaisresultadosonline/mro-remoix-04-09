import { getAdminData } from "./adminConfig";

const restricted = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT NL NO PL PT RO SK SI ES SE GB CH BR".split(" "));
const refusalKey = "cadastrorend_advertising_refused";
let region: Promise<string | null> | undefined;
let initialized = false;

export function isCadastroRendLeadEligible(hasComputer: boolean, success: boolean, link: string) {
  return hasComputer && success && /^https:\/\//i.test(link.trim());
}

export function isCadastroRendRegionAllowed(country: string | null) {
  return !!country && /^[A-Z]{2}$/.test(country) && !["XX", "T1"].includes(country) && !restricted.has(country);
}

export function hasCadastroRendOptOut() {
  return localStorage.getItem(refusalKey) === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

export function refuseCadastroRendAdvertising() {
  localStorage.setItem(refusalKey, "1");
  window.fbq?.("consent", "revoke");
}

async function canSend() {
  if (hasCadastroRendOptOut()) return false;
  region ??= (async () => {
    try {
      const response = await fetch("/cdn-cgi/trace", { signal: AbortSignal.timeout(2000) });
      if (!response.ok) return null;
      const fields = Object.fromEntries((await response.text()).trim().split("\n").map(line => line.split("=")));
      return fields.h === location.hostname ? fields.loc ?? null : null;
    } catch { return null; }
  })();
  return isCadastroRendRegionAllowed(await region) && !hasCadastroRendOptOut();
}

export async function initializeCadastroRendPixel() {
  if (!await canSend()) return false;
  const settings = getAdminData()?.settings?.pixelSettings;
  if (settings?.enabled === false) return false;
  if (!initialized) {
    // Same queue contract as Meta's base snippet. No customer matching or server uploads.
    if (!window.fbq) {
      const fbq = Object.assign(function (...args: unknown[]) {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, args);
        else fbq.queue.push(args);
      }, { queue: [] as unknown[][], callMethod: undefined as ((...args: unknown[]) => void) | undefined,
        push: undefined as unknown, loaded: true, version: "2.0" });
      fbq.push = fbq;
      window.fbq = fbq;
      (window as Window & { _fbq?: typeof fbq })._fbq = fbq;
      const script = document.createElement("script");
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      script.async = true;
      document.head.appendChild(script);
    }
    window.fbq("init", settings?.pixelId || "569414052132145", {}, { agent: "lovable" });
    initialized = true;
  }
  window.fbq("consent", "grant");
  return true;
}

export async function reportCadastroRendLead(eventId: string) {
  if (!await initializeCadastroRendPixel() || !await canSend()) return;
  window.fbq("track", "Lead", { content_name: "Cadastro Rend MRO" }, { eventID: eventId });
}