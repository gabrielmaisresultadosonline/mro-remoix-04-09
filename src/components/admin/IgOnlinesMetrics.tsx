import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminSupabase } from '@/lib/adminSupabase';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RefreshCw, Radio } from 'lucide-react';
import IgOnlinesProfileDetail from './IgOnlinesProfileDetail';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface MetricRow {
  id: string;
  instagram_username: string;
  status: string;
  followers_initial: number | null;
  followers_current: number | null;
  initial_source?: 'print' | 'extensao' | null;
  initial_captured_at?: string | null;
  followers_diff: number | null;
  period_growth: number | null;
  daily_growth: number | null;
  welcome_total: number;
  welcome_period: number;
  mass_sent_total: number;
  mass_sent_period: number;
  likes_total: number;
  likes_period: number;
  follows_total: number;
  follows_period: number;
  unfollows_total: number;
  unfollows_period: number;
  ai_replies_total: number;
  ai_replies_period: number;
  ai_people_total: number;
  ai_people_period: number;
  creatives_total: number;
  creatives_scheduled: number;
  creatives_published: number;
  last_seen_at: string;
  session_started_at: string | null;
  session_ended_at: string | null;
  metrics_updated_at: string | null;
  online: boolean;
  blocked: boolean;
  blocked_at: string | null;
}
interface Summary {
  profiles: number;
  followers_total: number | null;
  growth_period: number | null;
  welcome_period: number;
  welcome_total: number;
  mass_sent_period: number;
  mass_sent_total: number;
  likes_period: number;
  likes_total: number;
  follows_period: number;
  follows_total: number;
  unfollows_period: number;
  unfollows_total: number;
  ai_replies_period: number;
  ai_replies_total: number;
  ai_people_period: number;
  ai_people_total: number;
  creatives_total: number;
  creatives_scheduled: number;
  creatives_published: number;
  active_recent: number;
  online: number;
  last_update: string | null;
}
interface SeriesPoint {
  day: string;
  followers: number | null;
  growth: number;
  welcome: number;
  mass: number;
  likes: number;
  follows: number;
  unfollows: number;
  aiReplies: number;
  aiPeople: number;
}

const WAIT = 'Aguardando dados';
const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : WAIT;
const num = (v: number | null | undefined) => v === null || v === undefined ? WAIT : v.toLocaleString('pt-BR');
const signed = (v: number | null) => v === null ? WAIT : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR')}`;
type SortKey = 'last_seen_at' | 'followers_current' | 'followers_diff' | 'daily_growth' | 'welcome_total' | 'mass_sent_total' | 'likes_total' | 'ai_replies_total';
const tooltipStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' };

const IgOnlinesMetrics: React.FC = () => {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('last_seen_at');
  const [detail, setDetail] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await adminSupabase.functions.invoke('ig-online-api', { body: { action: 'admin_metrics', days } });
    const res = data as { success?: boolean; error?: string; rows?: MetricRow[]; summary?: Summary; series?: SeriesPoint[] } | null;
    if (err || !res?.success) setError(res?.error || err?.message || 'Falha ao carregar');
    else { setError(null); setRows(res.rows ?? []); setSummary(res.summary ?? null); setSeries(res.series ?? []); }
    setLoading(false);
  }, [days]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = window.setInterval(() => { void load(); }, 30000); return () => window.clearInterval(timer); }, [load]);

  const visible = useMemo(() => {
    const query = search.trim().replace(/^@/, '').toLowerCase();
    const list = query ? rows.filter(row => row.instagram_username.includes(query)) : [...rows];
    return list.sort((a, b) => sort === 'last_seen_at' ? b.last_seen_at.localeCompare(a.last_seen_at) : Number(b[sort] ?? -Infinity) - Number(a[sort] ?? -Infinity));
  }, [rows, search, sort]);

  const cards = [
    { label: 'Perfis acompanhados', value: num(summary?.profiles ?? null) },
    { label: 'Seguidores registrados', value: num(summary?.followers_total ?? null) },
    { label: `Crescimento (${days}d)`, value: signed(summary?.growth_period ?? null) },
    { label: `Boas-vindas (${days}d)`, value: `${num(summary?.welcome_period)} · ${num(summary?.welcome_total)} total` },
    { label: `Massa (${days}d)`, value: `${num(summary?.mass_sent_period)} · ${num(summary?.mass_sent_total)} total` },
    { label: `Curtidas (${days}d)`, value: `${num(summary?.likes_period)} · ${num(summary?.likes_total)} total` },
    { label: `Seguiu (${days}d)`, value: `${num(summary?.follows_period)} · ${num(summary?.follows_total)} total` },
    { label: `Deixou de seguir (${days}d)`, value: `${num(summary?.unfollows_period)} · ${num(summary?.unfollows_total)} total` },
    { label: `Respostas IA (${days}d)`, value: `${num(summary?.ai_replies_period)} · ${num(summary?.ai_replies_total)} total` },
    { label: `Pessoas IA (${days}d)`, value: `${num(summary?.ai_people_period)} · ${num(summary?.ai_people_total)} total` },
    { label: 'Criativos', value: `${num(summary?.creatives_total)} · ${num(summary?.creatives_published)} publicados` },
    { label: 'Agendados agora', value: num(summary?.creatives_scheduled) },
  ];
  const chartData = series.map(point => ({ ...point, label: point.day.slice(5).split('-').reverse().join('/') }));
  const activityLines = [
    ['welcome', 'Boas-vindas', 'hsl(var(--primary))'], ['mass', 'Massa', 'hsl(var(--chart-2))'],
    ['likes', 'Curtidas', 'hsl(var(--chart-3))'], ['follows', 'Seguiu', 'hsl(var(--chart-4))'],
    ['unfollows', 'Deixou de seguir', 'hsl(var(--chart-5))'], ['aiReplies', 'Respostas IA', 'hsl(var(--muted-foreground))'],
    ['aiPeople', 'Pessoas IA', 'hsl(var(--foreground))'],
  ] as const;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-2">
      {[1, 7, 30, 90, 365].map(day => <Button key={day} size="sm" variant={days === day ? 'default' : 'outline'} onClick={() => setDays(day)}>{day === 1 ? 'Hoje' : `${day} dias`}</Button>)}
      <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Atualizar</Button>
      <span className="text-xs text-muted-foreground">Atualiza a cada 30s · Último dado: {fmt(summary?.last_update)}</span>
    </div>
    {error && <p className="text-sm text-destructive">{error}</p>}

    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{cards.map(card => <Card key={card.label} className="p-3"><p className="text-xs text-muted-foreground mb-1">{card.label}</p><p className="font-bold text-lg leading-tight break-words">{card.value}</p></Card>)}</div>

    {chartData.length === 0 ? <Card className="p-6 text-center text-sm text-muted-foreground">{WAIT} — a extensão ainda não enviou métricas neste período.</Card> : <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card className="p-4"><h3 className="font-semibold text-sm">Evolução de seguidores</h3><p className="text-xs text-muted-foreground mb-3">Total conhecido das contas que já enviaram leituras.</p><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" fontSize={10} stroke="hsl(var(--muted-foreground))" /><YAxis fontSize={10} width={55} stroke="hsl(var(--muted-foreground))" /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="followers" name="Seguidores" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} connectNulls /></LineChart></ResponsiveContainer></div></Card>
      <Card className="p-4"><h3 className="font-semibold text-sm">Crescimento diário</h3><p className="text-xs text-muted-foreground mb-3">Quanto as contas ganharam ou perderam em cada dia.</p><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" fontSize={10} stroke="hsl(var(--muted-foreground))" /><YAxis fontSize={10} width={45} stroke="hsl(var(--muted-foreground))" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="growth" name="Crescimento" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
      <Card className="p-4 xl:col-span-2"><div className="flex flex-wrap justify-between gap-3 mb-3"><div><h3 className="font-semibold text-sm">Movimentação completa por dia</h3><p className="text-xs text-muted-foreground">Curtidas, seguidas, mensagens e atendimento da IA em linhas separadas.</p></div><div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">{activityLines.map(([key, label, color]) => <span key={key} className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>)}</div></div><div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" fontSize={10} stroke="hsl(var(--muted-foreground))" /><YAxis fontSize={10} width={45} stroke="hsl(var(--muted-foreground))" allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} />{activityLines.map(([key, label, color]) => <Line key={key} type="monotone" dataKey={key} name={label} stroke={color} strokeWidth={2} dot={false} />)}</LineChart></ResponsiveContainer></div></Card>
    </div>}

    <div className="flex flex-wrap items-center gap-2"><Input placeholder="Buscar @perfil..." value={search} onChange={event => setSearch(event.target.value)} className="max-w-xs" /><select value={sort} onChange={event => setSort(event.target.value as SortKey)} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Ordenar por"><option value="last_seen_at">Última atividade</option><option value="followers_current">Seguidores atuais</option><option value="followers_diff">Ganho desde o início</option><option value="daily_growth">Crescimento diário</option><option value="welcome_total">Boas-vindas</option><option value="mass_sent_total">Mensagens em massa</option><option value="likes_total">Curtidas</option><option value="ai_replies_total">Respostas IA</option></select></div>

    <Card className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted text-left"><tr>{['Perfil', 'Inicial', 'Atual', 'Ganho total', 'Cresc./dia', 'Boas-vindas', 'Massa', 'Curtidas', 'Seguiu', 'Deixou', 'IA resp./pessoas', 'Criativos', 'Conexão', ''].map(header => <th key={header} className="p-2 font-semibold whitespace-nowrap">{header}</th>)}</tr></thead><tbody>
      {visible.length === 0 && <tr><td colSpan={14} className="p-6 text-center text-muted-foreground">Nenhum perfil encontrado.</td></tr>}
      {visible.map(row => <tr key={row.id} className="border-t align-top">
        <td className="p-2 font-semibold whitespace-nowrap">@{row.instagram_username}<span className="block text-[10px] font-normal text-muted-foreground">{fmt(row.last_seen_at)}</span></td>
        <td className="p-2 whitespace-nowrap">{num(row.followers_initial)}{row.followers_initial !== null && row.initial_source && <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground" title={row.initial_captured_at ? `Referência registrada em ${fmt(row.initial_captured_at)}` : undefined}>{row.initial_source === 'print' ? 'print' : 'extensão'}</span>}</td>
        <td className="p-2">{num(row.followers_current)}</td><td className="p-2">{signed(row.followers_diff)}</td><td className="p-2">{signed(row.daily_growth)}</td>
        <td className="p-2 whitespace-nowrap">{row.metrics_updated_at ? `${num(row.welcome_total)} total` : WAIT}<span className="block text-muted-foreground">+{num(row.welcome_period)} no período</span></td>
        <td className="p-2 whitespace-nowrap">{num(row.mass_sent_total)} total<span className="block text-muted-foreground">+{num(row.mass_sent_period)} no período</span></td>
        <td className="p-2 whitespace-nowrap">{num(row.likes_total)} total<span className="block text-muted-foreground">+{num(row.likes_period)} no período</span></td>
        <td className="p-2 whitespace-nowrap">{num(row.follows_total)} total<span className="block text-muted-foreground">+{num(row.follows_period)} no período</span></td>
        <td className="p-2 whitespace-nowrap">{num(row.unfollows_total)} total<span className="block text-muted-foreground">+{num(row.unfollows_period)} no período</span></td>
        <td className="p-2 whitespace-nowrap">{num(row.ai_replies_total)} / {num(row.ai_people_total)}<span className="block text-muted-foreground">+{num(row.ai_replies_period)} / +{num(row.ai_people_period)}</span></td>
        <td className="p-2 whitespace-nowrap">{num(row.creatives_total)}<span className="block text-muted-foreground">{num(row.creatives_scheduled)} agend. · {num(row.creatives_published)} publ.</span></td>
        <td className="p-2">{row.online ? <Badge className="gap-1"><Radio className="w-3 h-3" /> Online</Badge> : <Badge variant="secondary">Offline</Badge>}{row.blocked && <Badge variant="destructive" className="ml-1">Bloqueado</Badge>}</td>
        <td className="p-2"><Button size="sm" variant="outline" onClick={() => setDetail(row.instagram_username)}>Detalhes</Button></td>
      </tr>)}
    </tbody></table></Card>
    <IgOnlinesProfileDetail instagram={detail} days={days} onClose={() => setDetail(null)} onChanged={() => void load()} />
  </div>;
};

export default IgOnlinesMetrics;
