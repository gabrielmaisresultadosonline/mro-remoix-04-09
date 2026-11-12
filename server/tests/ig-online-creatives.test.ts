import { describe, expect, it } from 'bun:test';
import { nextCreativeStatus, normalizeCreativeStatus, optionalDate } from '../src/functions/ig-online-creatives';

describe('histórico de criativos', () => {
  it('separa criação, agendamento e publicação e aceita os nomes da extensão', () => {
    expect(normalizeCreativeStatus('criado')).toBe('created');
    expect(normalizeCreativeStatus('agendado')).toBe('scheduled');
    expect(normalizeCreativeStatus('publicado')).toBe('published');
  });
  it('não deixa um evento antigo de agendamento apagar o estado publicado', () => {
    expect(nextCreativeStatus('published', 'scheduled')).toBe('published');
    expect(nextCreativeStatus('scheduled', 'published')).toBe('published');
  });
  it('rejeita data inválida em vez de gravar um agendamento falso', () => {
    expect(optionalDate('data-invalida')).toBeUndefined();
    expect(optionalDate('2026-11-12T17:00:00Z')).toBe('2026-11-12T17:00:00.000Z');
  });
});
