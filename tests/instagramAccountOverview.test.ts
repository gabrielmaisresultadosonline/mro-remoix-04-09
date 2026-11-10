import { describe, expect, it } from 'bun:test';
import { accountFollowerSummary, businessAnalysis, createAccountProfile } from '../src/lib/instagramAccountOverview';
import type { ProfileSession } from '../src/types/instagram';
import { normalizeInstagramUsername } from '../src/types/user';

const saved = { profile: { ...createAccountProfile('loja', 'Loja'), dataSource: 'screenshot', followers: 120 }, initialSnapshot: { followers: 100 } } as ProfileSession;
describe('Instagram sem novos prints', () => {
  it('cadastra pelo link e salva somente o usuário sem @', () => {
    expect(normalizeInstagramUsername('https://www.instagram.com/Minha.Loja/?igsh=abc')).toBe('minha.loja');
  });
  it('cadastra pelo @nome sem manter o @', () => {
    expect(normalizeInstagramUsername('@Minha.Loja')).toBe('minha.loja');
  });
  it('cadastra pelo nome de usuário sozinho', () => {
    expect(normalizeInstagramUsername('Minha.Loja')).toBe('minha.loja');
  });
  it('preserva seguidores iniciais lidos do print e aguarda dados atuais', () => {
    expect(accountFollowerSummary(saved)).toEqual({ initial: 100, current: null, growth: null });
  });
  it('usa referência central e leitura atual da API sem alterar o print', () => {
    const metrics = { instagram_username: 'loja', initial_followers: 100, current_followers: 137, initial_captured_at: null, last_seen_at: null, welcome_total: 7, online: false, metrics: [] };
    expect(accountFollowerSummary(saved, metrics)).toEqual({ initial: 100, current: 137, growth: 37 });
    expect(saved.initialSnapshot.followers).toBe(100);
  });
  it('não trata zero do cadastro como referência inicial', () => {
    expect(accountFollowerSummary({ ...saved, profile: createAccountProfile('nova', 'Nova') }).initial).toBeNull();
  });
  it('novas contas não exigem print e a descrição alimenta a estratégia', () => {
    expect(createAccountProfile('loja', 'Loja').needsScreenshotAnalysis).toBe(false);
    expect(businessAnalysis('Vendo roupas infantis').niche).toBe('Vendo roupas infantis');
  });
});