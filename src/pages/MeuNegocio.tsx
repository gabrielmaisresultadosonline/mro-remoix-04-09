import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bot, Instagram, Loader2, Play, Plus, RefreshCw, Save, Search, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Logo } from '@/components/Logo';
import { StrategyGenerator } from '@/components/StrategyGenerator';
import { StrategyDisplay } from '@/components/StrategyDisplay';
import { InstagramGrowthOverview } from '@/components/InstagramGrowthOverview';
import { InstagramAccountImages } from '@/components/InstagramAccountImages';
import { InstagramActivityPanel } from '@/components/InstagramActivityPanel';
import { useToast } from '@/hooks/use-toast';
import { getCurrentUser, getRegisteredIGs, isAuthenticated, addRegisteredIG, loadUserFromCloud, saveUserToCloud, syncIGsFromSquare, updateUserEmail } from '@/lib/userStorage';
import { getSession, addProfile, setActiveProfile, addStrategy, saveSession, getArchivedProfiles, initializeFromCloud, setCloudSyncCallback, restoreProfileFromArchive } from '@/lib/storage';
import { verifyRegisteredIGs, canRegisterIG, addIGToSquare } from '@/lib/squareApi';
import { normalizeInstagramUsername } from '@/types/user';
import { getAffiliateCredentials } from '@/lib/affiliateSession';
import { accountImages, accountFollowerSummary, accountUsageSummary, businessAnalysis, createAccountProfile, filterInstagramAccounts, type AccountMetrics } from '@/lib/instagramAccountOverview';
import { supabase } from '@/integrations/supabase/client';
import type { ProfileSession } from '@/types/instagram';

const number = (value: number | null) => value === null ? 'Aguardando dados' : value.toLocaleString('pt-BR');
const date = (value?: string | null) => value ? new Date(value).toLocaleString('pt-BR') : 'Aguardando atividade';

function AccountGrowth({ account, metrics }: { account: ProfileSession; metrics?: AccountMetrics }) {
  const summary = accountFollowerSummary(account, metrics);
  const usage = accountUsageSummary(account, metrics);
  const points = [
    ...(summary.initial !== null ? [{ day: metrics?.initial_captured_at ?? account.startedAt, followers_end: summary.initial }] : []),
    ...(metrics?.metrics.filter(m => m.followers_end !== null) ?? []),
  ];
  const values = points.map(p => p.followers_end ?? 0);
  const low = Math.min(...values), high = Math.max(...values);
  const polyline = values.map((v, i) => `${24 + i / Math.max(1, values.length - 1) * 552},${140 - (v - low) / Math.max(1, high - low) * 112}`).join(' ');
  return <div className="space-y-5">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[['Seguidores iniciais', number(summary.initial)], ['Seguidores atuais', number(summary.current)], ['Crescimento', summary.growth === null ? 'Aguardando dados' : `${summary.growth > 0 ? '+' : ''}${number(summary.growth)}`], ['Boas-vindas enviadas', number(metrics?.welcome_total ?? null)]].map(([label, value]) => <div key={label} className="min-w-0"><p className="text-xs text-muted-foreground mb-1">{label}</p><p className="font-semibold text-sm sm:text-lg break-words">{value}</p>{label === 'Seguidores iniciais' && <div className="mt-2 text-xs text-muted-foreground space-y-1"><p>Início: {usage?.date ?? 'Aguardando data inicial'}</p>{usage && <p>Tempo de uso: {usage.duration}</p>}</div>}</div>)}
    </div>
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground"><span>Último acesso: {date(metrics?.last_seen_at)}</span><span className="text-primary">{metrics?.online ? 'Em atividade' : 'Sem atividade recente'}</span></div>
    {values.length > 1 ? <div><p className="text-sm font-semibold mb-2">Crescimento de seguidores</p><svg role="img" aria-label="Gráfico de crescimento de seguidores" viewBox="0 0 600 170" className="w-full h-40"><path d="M24 12 V144 H580" fill="none" className="instagram-growth-axis" /><polyline points={polyline} fill="none" strokeWidth="3" strokeLinejoin="round" className="instagram-growth-line" /><text x="24" y="165" fill="currentColor" fontSize="11">{new Date(points[0].day).toLocaleDateString('pt-BR')}</text><text x="575" y="165" fill="currentColor" textAnchor="end" fontSize="11">{new Date(points[points.length - 1].day).toLocaleDateString('pt-BR')}</text></svg></div> : <p className="text-sm text-muted-foreground">Aguardando as próximas leituras do perfil para mostrar o crescimento.</p>}
    <InstagramActivityPanel metrics={metrics} />
  </div>;
}

export default function MeuNegocioPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [view, setView] = useState<'home' | 'strategy' | 'growth'>('home');
  const [accountQuery, setAccountQuery] = useState('');
  const [accounts, setAccounts] = useState<ProfileSession[]>([]);
  const [metrics, setMetrics] = useState<Record<string, AccountMetrics>>({});
  const [metricsError, setMetricsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [email, setEmail] = useState(getCurrentUser()?.email ?? '');
  const [registeredMore, setRegisteredMore] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const mounted = useRef(true);
  const writing = useRef(false);
  const user = getCurrentUser();
  const active = accounts.find(a => a.id === selected);
  const filteredAccounts = filterInstagramAccounts(accounts, accountQuery);

  function readAccounts() { setAccounts(getSession().profiles); }
  async function persist() {
    const current = getCurrentUser();
    if (!current) return false;
    const session = getSession();
    return saveUserToCloud(current.username, current.email, current.daysRemaining, session.profiles.filter(a => !a.isHistorical), getArchivedProfiles(), current.lifetimeCreativeUsedAt);
  }
  async function refreshMetrics() {
    const current = getCurrentUser();
    if (!current || writing.current) return;
    const credentials = getAffiliateCredentials(current.username);
    if (!credentials) { setMetricsError('Entre novamente pelo dashboard para atualizar as métricas.'); return; }
    const profiles = getSession().profiles;
    const { data, error } = await supabase.functions.invoke('ig-online-api', { body: { action: 'user_metrics', username: current.username, password: credentials.password, instagrams: profiles.map(a => a.profile.username) } });
    if (!mounted.current) return;
    if (error || !data?.success) { setMetricsError('Não foi possível atualizar agora. Seus dados salvos permanecem disponíveis.'); return; }
    setMetricsError('');
    setMetrics(Object.fromEntries((data.profiles ?? []).map((m: AccountMetrics) => [m.instagram_username, m])));
  }
  useEffect(() => {
    mounted.current = true;
    if (!isAuthenticated()) { navigate('/dashboard', { replace: true }); return; }
    setCloudSyncCallback(saveUserToCloud);
    async function load() {
      const current = getCurrentUser();
      if (!current) return;
      try {
        const cloud = await loadUserFromCloud(current.username);
        if (!mounted.current) return;
        if (cloud) initializeFromCloud(cloud.profileSessions, cloud.archivedProfiles);
        const registered = await verifyRegisteredIGs(current.username);
        if (!mounted.current) return;
        const usernames = registered.success ? registered.instagrams ?? [] : getRegisteredIGs().map(ig => ig.username);
        if (current.email) await syncIGsFromSquare(usernames, current.email);
        for (const username of usernames) {
          if (getSession().profiles.some(a => a.profile.username.toLowerCase() === username.toLowerCase())) continue;
          if (restoreProfileFromArchive(username)) continue;
          addProfile(createAccountProfile(username, username), businessAnalysis(''));
        }
        readAccounts();
        await refreshMetrics();
      } catch { toast({ title: 'Os dados salvos foram mantidos', description: 'Tente atualizar novamente.', variant: 'destructive' }); readAccounts(); }
      finally { if (mounted.current) setLoading(false); }
    }
    void load();
    const timer = window.setInterval(() => { void refreshMetrics(); }, 30_000);
    return () => { mounted.current = false; window.clearInterval(timer); };
  }, [navigate]);

  async function register(event: React.FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    const username = normalizeInstagramUsername(input);
    if (!/^[a-z0-9._]{1,30}$/.test(username)) { toast({ title: 'Informe um link, @nome ou nome de usuário válido do Instagram', variant: 'destructive' }); return; }
    setBusy(true); writing.current = true;
    try {
      if (!user.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido para vincular sua conta.');
        await updateUserEmail(email.trim());
      }
      const check = await canRegisterIG(user.username, username);
      if (!check.canRegister && !check.alreadyExists) throw new Error(check.error ?? 'Limite de contas atingido.');
      if (!check.alreadyExists) {
        const result = await addIGToSquare(user.username, username);
        if (!result.success) throw new Error(result.error ?? 'Não foi possível cadastrar.');
      }
      await addRegisteredIG(username, getCurrentUser()?.email ?? email, true);
      const existing = getSession().profiles.find(a => a.profile.username === username);
      if (!existing && !restoreProfileFromArchive(username)) addProfile(createAccountProfile(username, username), businessAnalysis(''));
      if (!await persist()) throw new Error('A conta foi vinculada, mas falta salvar os dados. Tente novamente sem cadastrar outra conta.');
      readAccounts(); setInput(''); setRegisteredMore(true);
    } catch (e) { toast({ title: 'Cadastro', description: e instanceof Error ? e.message : 'Tente novamente.', variant: 'destructive' }); }
    finally { setBusy(false); writing.current = false; void refreshMetrics(); }
  }
  function openStrategy(account: ProfileSession) {
    setActiveProfile(account.id); setSelected(account.id); setDescription(account.businessDescription ?? ''); setView('strategy');
  }
  async function saveDescription() {
    if (!active || description.trim().length < 10) { toast({ title: 'Conte um pouco mais sobre seu negócio', variant: 'destructive' }); return; }
    setBusy(true); writing.current = true;
    try {
      const session = getSession();
      const account = session.profiles.find(a => a.id === active.id);
      if (!account) return;
      account.businessDescription = description.trim();
      account.analysis = businessAnalysis(description, account.analysis);
      saveSession(session);
      if (!await persist()) throw new Error('Não foi possível salvar no servidor. Tente novamente.');
      readAccounts(); toast({ title: 'Descrição salva' });
    } catch (e) { toast({ title: 'Não foi possível salvar', description: e instanceof Error ? e.message : 'Tente novamente.', variant: 'destructive' }); }
    finally { setBusy(false); writing.current = false; }
  }
  function accountList() {
    return filteredAccounts.length ? <Accordion type="single" collapsible className="space-y-3">{filteredAccounts.map(account => <AccordionItem key={account.id} value={account.id} className="border border-border rounded-lg bg-card px-4 sm:px-5">
      <div className="flex items-center gap-3"><AccordionTrigger className="min-w-0 flex-1 text-left hover:no-underline"><span className="flex items-center gap-3 min-w-0"><Instagram className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0"><span className="block font-semibold break-all">@{account.profile.username}</span><span className="block text-xs text-muted-foreground font-normal break-words">{account.profile.fullName || account.profile.username}{account.isHistorical ? ' · Histórico' : ''}</span></span></span></AccordionTrigger><Button variant="ghost" size="icon" title={`Estratégias de @${account.profile.username}`} aria-label={`Estratégias de @${account.profile.username}`} onClick={() => openStrategy(account)}><Bot className="h-5 w-5 text-primary" /></Button></div>
      <AccordionContent><div className="space-y-6"><AccountGrowth account={account} metrics={metrics[account.profile.username]} /><InstagramAccountImages images={accountImages(account, metrics[account.profile.username])} /></div></AccordionContent>
    </AccordionItem>)}</Accordion> : <p className="text-muted-foreground py-8 text-center">{accounts.length ? 'Nenhuma conta encontrada.' : 'Nenhuma conta cadastrada.'}</p>;
  }
  if (loading) return <div className="dash-member min-h-screen bg-background text-foreground flex items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Carregando contas" /></div>;
  return <div className="instagram-workspace dash-member min-h-screen bg-background text-foreground">
    <header className="border-b border-border"><div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4"><Logo size="sm" /><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => view === 'home' ? navigate('/dashboard') : setView('home')}><ArrowLeft className="h-4 w-4 mr-2" />{view === 'home' ? 'Dashboard' : 'Voltar ao início'}</Button><Button onClick={() => navigate('/mro-ferramenta')} className="font-semibold"><Play className="h-4 w-4 mr-2" />Acessar tutoriais</Button></div></div></header>
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <div><p className="text-primary text-xs font-semibold uppercase mb-2">Ferramenta MRO</p><h1 className="text-2xl sm:text-3xl font-bold">{view === 'home' ? 'Seu Instagram na MRO' : view === 'growth' ? 'Crescimentos' : `Estratégias · @${active?.profile.username ?? ''}`}</h1></div>
      {view === 'home' && <div className="grid sm:grid-cols-2 gap-6 border-y border-border py-6"><div className="space-y-3"><span className="text-sm text-muted-foreground">Passo 1</span><h2 className="text-xl font-semibold">Cadastre a conta do Instagram</h2><Button variant="outline" onClick={() => { setRegisteredMore(false); setRegistrationOpen(true); }} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Cadastrar Instagram</Button></div><div className="space-y-3"><span className="text-sm text-muted-foreground">Passo 2</span><h2 className="text-xl font-semibold">Acesse os tutoriais</h2><Button onClick={() => navigate('/mro-ferramenta')} className="w-full sm:w-auto"><Play className="h-4 w-4 mr-2" />Acessar tutoriais</Button></div></div>}
      {view === 'home' && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Contas cadastradas <span className="text-muted-foreground">({accounts.length})</span></h2><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setView('growth')}><BarChart3 className="h-4 w-4 mr-2" />Crescimentos</Button><Button variant="ghost" size="sm" onClick={() => { void refreshMetrics(); }}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button></div></div><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Pesquisar contas cadastradas" placeholder="Pesquisar por nome ou @usuário" value={accountQuery} onChange={event => setAccountQuery(event.target.value)} className="pl-10" /></div>{metricsError && <p role="status" className="text-sm text-muted-foreground">{metricsError}</p>}{accountList()}</section>}
      {view === 'growth' && <><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate('/dashboard')}><ArrowLeft className="h-4 w-4 mr-2" />Voltar para dashboard</Button><Button variant="ghost" onClick={() => { void refreshMetrics(); }}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button></div>{metricsError && <p role="status" className="text-sm text-muted-foreground">{metricsError}</p>}<InstagramGrowthOverview accounts={accounts} metrics={metrics} /></>}

      {view === 'strategy' && active && <div className="space-y-6"><AccountGrowth account={active} metrics={metrics[active.profile.username]} /><div className="border-y border-border py-6 space-y-3"><Label htmlFor="business-description" className="text-lg font-semibold">Conte como funciona seu negócio e sua ideia inicial</Label><Textarea id="business-description" value={description} maxLength={4000} rows={6} onChange={e => setDescription(e.target.value)} placeholder="O que você vende, quem deseja alcançar e quais são seus objetivos?" /><Button disabled={busy} onClick={() => { void saveDescription(); }}><Save className="h-4 w-4 mr-2" />{busy ? 'Salvando…' : 'Salvar descrição'}</Button></div>{active.businessDescription && <StrategyGenerator profile={{ ...active.profile, bio: `${active.profile.bio}\nNegócio e objetivos: ${active.businessDescription}` }} analysis={active.analysis} profileId={active.id} existingStrategies={active.strategies} onStrategyGenerated={strategy => { setActiveProfile(active.id); addStrategy(strategy); readAccounts(); void persist().then(saved => { if (!saved) toast({ title: 'Estratégia criada, mas não sincronizada', description: 'Tente salvar novamente.', variant: 'destructive' }); }); }} />}{active.strategies.map(strategy => <StrategyDisplay key={strategy.id} strategy={strategy} />)}<Button variant="outline" onClick={() => { navigate('/dashboard'); }}><ArrowRight className="h-4 w-4 mr-2" />Acessar dashboard</Button></div>}
    </main>
    <Dialog open={registrationOpen} onOpenChange={open => { if (!busy) setRegistrationOpen(open); }}><DialogContent className="dash-member bg-background text-foreground border-border rounded-lg w-[calc(100%-2rem)] max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{registeredMore ? 'Conta cadastrada!' : 'Cadastrar Instagram'}</DialogTitle><DialogDescription>{registeredMore ? 'Deseja cadastrar mais uma conta agora?' : 'Nova conta'}</DialogDescription></DialogHeader>
      {registeredMore ? <div className="flex flex-col sm:flex-row gap-3"><Button variant="outline" className="flex-1" onClick={() => setRegisteredMore(false)}>Sim</Button><Button className="flex-1" onClick={() => { setRegistrationOpen(false); setRegisteredMore(false); navigate('/mro-ferramenta'); }}>Por enquanto não</Button></div> : <form onSubmit={register} className="space-y-5">{!user?.email && <div className="space-y-2"><Label htmlFor="account-email">E-mail</Label><Input id="account-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>}<div className="space-y-2"><Label htmlFor="instagram-link">Cadastre a conta do Instagram que vai utilizar para o crescimento</Label><Input id="instagram-link" required maxLength={255} value={input} onChange={e => setInput(e.target.value)} placeholder="Link, @nome ou nome do Instagram" autoCapitalize="none" autoCorrect="off" /></div><Button type="submit" disabled={busy} className="w-full sm:w-auto">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Cadastrar</Button></form>}
    </DialogContent></Dialog>
  </div>;
}
