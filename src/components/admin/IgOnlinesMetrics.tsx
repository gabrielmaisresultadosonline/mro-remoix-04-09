import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminSupabase } from '@/lib/adminSupabase';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RefreshCw, Radio } from 'lucide-react';
import IgOnlinesProfileDetail from './IgOnlinesProfileDetail';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

interface MetricRow {
  id: string;
  instagram_username: string;
  status: string;
  followers_initial: number | null;
  followers_current: number | null;
  followers_diff: number | null;
  period_growth: number | null;
  daily_growth: number | null;
  welcome_total: number;
  welcome_period: number;
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
  active_recent: number;
  online: number;
  last_update: string | null;
}
interface SeriesPoint { day: string; followers: number | null; growth: number; welcome: number }

const WAIT = 'Aguardando dados';
const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : WAIT;
const num = (v: number | null | undefined) => (v === null || v === undefined ? WAIT : v.toLocaleString('pt-BR'));
const signed = (v: number | null) => (v === null ? WAIT : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR')}`);

type SortKey = 'last_seen_at' | 'followers_current' | 'followers_diff' | 'daily_growth' | 'welcome_total';

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
    const { data, error: err } = await adminSupabase.functions.invoke('ig-online-api', {
      body: { action: 'admin_metrics', days },
    });
    const res = data as { success?: boolean; error?: string; rows?: MetricRow[]; summary?: Summary; series?: SeriesPoint[] } | null;
    if (err || !res?.success) setError(res?.error || err?.message || 'Falha ao carregar');
    else {
      setError(null);
      setRows(res.rows ?? []);
      setSummary(res.summary ?? null);
      setSeries(res.series ?? []);
    }
    setLoading(false);
  }, [days]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = window.setInterval(() => { void load(); }, 30000);
    return () => window.clearInterval(t);
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().replace(/^@/, '').toLowerCase();
    const list = q ? rows.filter((r) => r.instagram_username.includes(q)) : [...rows];
    return list.sort((a, b) => {
      if (sort === 'last_seen_at') return b.last_seen_at.localeCompare(a.last_seen_at);
      return Number(b[sort] ?? -Infinity) - Number(a[sort] ?? -Infinity);
    });
  }, [rows, search, sort]);

  const cards = [
    { label: 'Perfis cadastrados', value: num(summary?.profiles ?? null) },
    { label: 'Seguidores registrados', value: num(summary?.followers_total ?? null) },
    { label: `Crescimento (${days}d)`, value: signed(summary?.growth_period ?? null) },
    { label: `Boas-vindas (${days}d)`, value: num(summary ? summary.welcome_period : null) },
    { label: 'Ativos últimas 24h', value: num(summary?.active_recent ?? null) },
    { label: 'Última atualização', value: fmt(summary?.last_update), small: true },
  ];

  const chartData = series.map((s) => ({ ...s, label: s.day.slice(5).split('-').reverse().join('/') }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[1, 7, 30, 90, 365].map((d) => (
          <Button key={d} size="sm" variant={days === d ? 'default' : 'outline'} onClick={() => setDays(d)}>
            {d === 1 ? 'Hoje' : `${d} dias`}
          </Button>
        ))}
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading} className="gap-2">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Atualizar
        </Button>
        <span className="text-xs text-muted-foreground">Atualiza sozinho a cada 30s</span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-3">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={cn('font-bold', c.small ? 'text-sm' : 'text-2xl')}>{c.value}</p>
          </Card>
        ))}
      </div>

      {chartData.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">{WAIT} — a extensão ainda não enviou métricas neste período.</Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {[
            { title: 'Evolução de seguidores', key: 'followers', type: 'line' },
            { title: 'Crescimento diário', key: 'growth', type: 'bar' },
            { title: 'Boas-vindas por dia', key: 'welcome', type: 'bar' },
          ].map((g) => (
            <Card key={g.key} className="p-3">
              <p className="text-sm font-semibold mb-2">{g.title}</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  {g.type === 'line' ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" fontSize={10} />
                      <YAxis fontSize={10} width={50} />
                      <Tooltip />
                      <Line type="monotone" dataKey={g.key} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  ) : (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" fontSize={10} />
                      <YAxis fontSize={10} width={40} />
                      <Tooltip />
                      <Bar dataKey={g.key} fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar @perfil..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label="Ordenar por"
        >
          <option value="last_seen_at">Última atividade</option>
          <option value="followers_current">Seguidores atuais</option>
          <option value="followers_diff">Ganho desde o início</option>
          <option value="daily_growth">Crescimento diário</option>
          <option value="welcome_total">Boas-vindas</option>
        </select>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted text-left">
            <tr>
              {['Perfil', 'Inicial', 'Atual', 'Diferença', 'Cresc./dia', 'Boas-vindas', 'Última atividade', 'Início sessão', 'Fim sessão', 'Conexão', ''].map((h) => (
                <th key={h} className="p-2 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Nenhum perfil encontrado.</td></tr>
            )}
            {visible.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-semibold whitespace-nowrap">@{r.instagram_username}</td>
                <td className="p-2">{num(r.followers_initial)}</td>
                <td className="p-2">{num(r.followers_current)}</td>
                <td className="p-2">{signed(r.followers_diff)}</td>
                <td className="p-2">{signed(r.daily_growth)}</td>
                <td className="p-2">{r.metrics_updated_at ? num(r.welcome_total) : WAIT}</td>
                <td className="p-2 whitespace-nowrap">{fmt(r.last_seen_at)}</td>
                <td className="p-2 whitespace-nowrap">{fmt(r.session_started_at)}</td>
                <td className="p-2 whitespace-nowrap">
                  {r.session_ended_at ? fmt(r.session_ended_at) : r.session_started_at ? 'Em andamento' : WAIT}
                </td>
                <td className="p-2">
                  {r.online ? <Badge className="gap-1"><Radio className="w-3 h-3" /> Online</Badge> : <Badge variant="secondary">Offline</Badge>}
                  {r.blocked && <Badge variant="destructive" className="ml-1">Bloqueado</Badge>}
                </td>
                <td className="p-2">
                  <Button size="sm" variant="outline" onClick={() => setDetail(r.instagram_username)}>Detalhes</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <IgOnlinesProfileDetail instagram={detail} days={days} onClose={() => setDetail(null)} onChanged={() => void load()} />
    </div>
  );
};

export default IgOnlinesMetrics;
