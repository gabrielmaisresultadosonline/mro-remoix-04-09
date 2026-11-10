import { describe, expect, it } from 'bun:test';
import { accountImages, groupAccountImages, accountFollowerSummary, accountUsageSummary, businessAnalysis, createAccountProfile, filterInstagramAccounts, summarizeAccountGrowth } from '../src/lib/instagramAccountOverview';
import type { ProfileSession } from '../src/types/instagram';
import { normalizeInstagramUsername } from '../src/types/user';

const saved = { profile: { ...createAccountProfile('loja', 'Loja'), dataSource: 'screenshot', followers: 120 }, initialSnapshot: { followers: 100 } } as ProfileSession;
describe('Instagram sem novos prints', () => {
  it('vincula imagens da galeria somente ao próprio Instagram, preservando criativos antigos', () => {
    const metrics = { instagram_username: 'loja', initial_followers: 100, current_followers: 137, initial_captured_at: null, last_seen_at: null, welcome_total: 7, online: false, metrics: [], images: [{ id: 'own', instagram_username: 'LOJA', url: '/own.jpg', caption: null, publication_id: 'p', image_index: 0 }, { id: 'other', instagram_username: 'outrocliente', url: '/other.jpg', caption: null, publication_id: 'p', image_index: 0 }] };
    expect(accountImages({ ...saved, creatives: [{ id: 'legacy', imageUrl: '/legacy.jpg' }] } as ProfileSession, metrics).map(i => i.id)).toEqual(['own', 'legacy']);
  });
  it('agrupa todos os slides em ordem sem misturar publicações de outras contas', () => {
    const images = [2, 0, 1].map(i => ({ id: `slide${i}`, imageUrl: `/${i}.jpg`, username: 'loja', publication_id: 'p', image_index: i }));
    const groups = groupAccountImages([...images, { ...images[0], username: 'segunda' }]);
    expect(groups).toHaveLength(2);
    expect(groups[0].map(i => i.image_index)).toEqual([0, 1, 2]);
  });
  it('usa a data inicial persistida da API e calcula meses completos e dias até hoje', () => {
    const metrics = { instagram_username: 'loja', initial_followers: 100, current_followers: 137, initial_captured_at: '2026-08-09T12:00:00Z', last_seen_at: null, welcome_total: 7, online: false, metrics: [] };
    expect(accountUsageSummary({ ...saved, startedAt: '2026-11-01T12:00:00Z' }, metrics, new Date('2026-11-10T02:01:00Z'))).toMatchObject({ date: '09/08/2026', months: 3, days: 0, totalDays: 92 });
  });
  it('preserva a data do print antigo quando a API não possui data inicial', () => {
    const account = { ...saved, initialSnapshot: { ...saved.initialSnapshot, date: '2026-10-01T12:00:00Z' }, startedAt: '2026-11-01T12:00:00Z' };
    expect(accountUsageSummary(account, undefined, new Date('2026-11-10T02:01:00Z'))).toMatchObject({ date: '01/10/2026', months: 1, days: 8, totalDays: 39 });
  });
  it('calcula mês completo no último dia do mês sem meses fixos de 30 dias', () => {
    expect(accountUsageSummary({ ...saved, startedAt: '2026-01-31T12:00:00Z' }, undefined, new Date('2026-02-28T12:00:00Z'))).toMatchObject({ months: 1, days: 0, totalDays: 28 });
  });
  it('não inventa data ausente nem tempo negativo', () => {
    expect(accountUsageSummary(saved)).toBeNull();
    expect(accountUsageSummary({ ...saved, startedAt: '2026-12-01T12:00:00Z' }, undefined, new Date('2026-11-09T12:00:00Z'))).toMatchObject({ months: 0, days: 0, totalDays: 0 });
  });
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