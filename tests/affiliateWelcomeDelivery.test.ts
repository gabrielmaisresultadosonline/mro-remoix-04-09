import { describe, expect, it } from 'bun:test';
import { deliverAffiliateWelcome } from '../supabase/functions/_shared/affiliate-welcome-delivery';
const mail = { from: 'support@example.test', to: 'affiliate@example.test', subject: 'Welcome', text: 'Welcome', html: '<p>Welcome</p>' };
describe('affiliate welcome delivery', () => {
  it('confirma envio somente quando SMTP aceita o destinatário informado', async () => {
    let received = ''; let closed = false;
    expect(await deliverAffiliateWelcome({ sendMail: async m => { received = m.to; return { accepted: [m.to] }; }, close: () => { closed = true; } }, mail)).toEqual({ ok: true });
    expect(received).toBe('affiliate@example.test'); expect(closed).toBe(true);
  });
  it('não anuncia sucesso quando o destinatário é recusado', async () => {
    expect(await deliverAffiliateWelcome({ sendMail: async () => ({ accepted: [], rejected: [mail.to] }), close: () => {} }, mail)).toEqual({ ok: false });
  });
  it('fecha conexão e propaga falha SMTP para permitir reenvio', async () => {
    let closed = false;
    await expect(deliverAffiliateWelcome({ sendMail: async () => { throw new Error('SMTP rejected'); }, close: () => { closed = true; } }, mail)).rejects.toThrow('SMTP rejected');
    expect(closed).toBe(true);
  });
  it('erro ao fechar não invalida mensagem já aceita', async () => {
    expect(await deliverAffiliateWelcome({ sendMail: async () => ({ accepted: [mail.to] }), close: () => { throw new Error('Closed'); } }, mail)).toEqual({ ok: true });
  });
});