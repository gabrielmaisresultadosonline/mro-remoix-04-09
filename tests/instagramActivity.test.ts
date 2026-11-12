import { describe, expect, it } from 'bun:test';
import { nextCreativeStatus, normalizeCreativeStatus } from '../server/src/functions/ig-online-creatives';

describe('regras visíveis de atividade e criativos', () => {
  it('mantém boas-vindas e mensagens em massa como conceitos separados', () => {
    expect(normalizeCreativeStatus('agendado')).toBe('scheduled');
    expect(normalizeCreativeStatus('publicado')).toBe('published');
  });
  it('não permite que um agendamento atrasado substitua uma publicação concluída', () => {
    expect(nextCreativeStatus('published', 'scheduled')).toBe('published');
  });
});
