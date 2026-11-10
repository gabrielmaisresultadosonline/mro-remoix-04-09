import { describe, expect, it } from 'bun:test';
import { accountFollowerSummary, businessAnalysis, createAccountProfile, filterInstagramAccounts, summarizeAccountGrowth } from '../src/lib/instagramAccountOverview';
import type { ProfileSession } from '../src/types/instagram';
import { normalizeInstagramUsername } from '../src/types/user';

const saved = { profile: { ...createAccountProfile('loja', 'Loja'), dataSource: 'screenshot', followers: 120 }, initialSnapshot: { followers: 100 } } as ProfileSession;
describe('Instagram sem novos prints', () => {
  it('pesquisa nome e @usuário sem diferenciar maiúsculas ou acentos', () => {
    expect(filterInstagramAccounts([saved], '@LOJA')).toHaveLength(1);
    expect(filterInstagramAccounts([{ ...saved, profile: { ...saved.profile, fullName: 'Calçados Ana' } }], 'calcados')).toHaveLength(1);
    expect(filterInstagramAccounts([saved], 'outra')).toHaveLength(0);
  });
  it('soma crescimento e boas-vindas somente das contas selecionadas', () => {
    const second = { ...saved, profile: createAccountProfile('segunda', 'Segunda') };
    const metrics = { loja: { instagram_username: 'loja', initial_followers: 100, current_followers: 137, welcome_total: 7, initial_captured_at: null, last_seen_at: null, online: false, metrics: [] }, segunda: { instagram_username: 'segunda', initial_followers: 200, current_followers: 220, welcome_total: 5, initial_captured_at: null, last_seen_at: null, online: false, metrics: [] } };
    expect(summarizeAccountGrowth([saved, second], metrics)).toMatchObject({ initial: 300, current: 357, growth: 57, welcome: 12, measured: 2 });
    expect(summarizeAccountGrowth([second], metrics)).toMatchObject({ growth: 20, welcome: 5 });
  });
  it('não conta leitura atual ausente como perda e não mistura imagens de outras contas', () => {
    const a = { ...saved, creatives: [{ id: 'own', imageUrl: '/own.jpg' }] } as ProfileSession;
    expect(summarizeAccountGrowth([a], {})).toMatchObject({ growth: 0, pending: 1, measured: 0 });
    expect(summarizeAccountGrowth([a], {}).images.map(i => i.id)).toEqual(['own']);
  });
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