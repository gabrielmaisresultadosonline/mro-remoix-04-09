export interface WelcomeMail {
  from: string; to: string; subject: string; text: string; html: string;
}
export interface WelcomeTransport {
  sendMail: (mail: WelcomeMail) => Promise<{ accepted?: unknown[]; rejected?: unknown[] }>;
  close: () => void;
}
export async function deliverAffiliateWelcome(transport: WelcomeTransport, mail: WelcomeMail) {
  try {
    const result = await transport.sendMail(mail);
    return { ok: Boolean(result.accepted?.some(address => String(address).toLowerCase() === mail.to.toLowerCase())) };
  } finally {
    // Closing a successful connection must never turn an accepted send into a failed one.
    try { transport.close(); } catch { /* connection already closed */ }
  }
}