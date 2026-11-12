import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CalendarClock, CheckCircle2, FileImage, Layers } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AccountCreative, AccountMetrics } from '@/lib/instagramAccountOverview';

const number = (value: number | undefined) => value === undefined ? 'Aguardando dados' : value.toLocaleString('pt-BR');
const date = (value?: string | null) => value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
const STATUS = {
  created: { label: 'Criado', variant: 'secondary' as const },
  scheduled: { label: 'Agendado', variant: 'outline' as const },
  published: { label: 'Publicado', variant: 'default' as const },
  cancelled: { label: 'Cancelado', variant: 'secondary' as const },
  failed: { label: 'Falhou', variant: 'destructive' as const },
};

export function InstagramCreativeHistory({ creatives }: { creatives: AccountCreative[] }) {
  return <section className="space-y-3">
    <div className="flex items-center gap-2"><FileImage className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Histórico de criativos ({creatives.length})</h2></div>
    {creatives.length ? <div className="space-y-3">{creatives.map(creative => {
      const status = STATUS[creative.status] ?? STATUS.created;
      const images = [...(creative.images ?? [])].sort((a, b) => (a.image_index ?? 0) - (b.image_index ?? 0));
      return <Card key={creative.id} className="p-4 flex flex-col sm:flex-row gap-4">
        {images[0] ? <div className="relative w-full sm:w-24 shrink-0"><img src={images[0].url} alt="Capa do criativo" className="w-full sm:w-24 aspect-square object-contain bg-muted rounded-md" />{images.length > 1 && <span className="absolute right-1 top-1 bg-background/90 rounded px-1.5 py-0.5 text-xs flex items-center gap-1"><Layers className="h-3 w-3" />{images.length}</span>}</div> : <div className="hidden sm:flex w-24 h-24 items-center justify-center bg-muted rounded-md"><FileImage className="h-7 w-7 text-muted-foreground" /></div>}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2"><Badge variant={status.variant}>{status.label}</Badge><span className="text-xs text-muted-foreground break-all">@{creative.instagram_username}</span></div>
          <p className="text-sm whitespace-pre-wrap break-words line-clamp-3">{creative.caption || 'Criativo sem legenda salva.'}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Criado: {date(creative.created_at)}</span>
            {creative.scheduled_at && <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />Agendado: {date(creative.scheduled_at)}</span>}
            {creative.published_at && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Publicado: {date(creative.published_at)}</span>}
          </div>
        </div>
      </Card>;
    })}</div> : <p className="text-sm text-muted-foreground">Nenhum criativo criado, agendado ou publicado foi enviado pela extensão ainda.</p>}
  </section>;
}

export function InstagramActivityPanel({ metrics }: { metrics?: AccountMetrics | AccountMetrics[] }) {
  const list = (Array.isArray(metrics) ? metrics : metrics ? [metrics] : []).filter(Boolean);
  const hasMetrics = list.length > 0;
  const total = (key: 'welcome_total' | 'mass_sent_total' | 'likes_total' | 'follows_total' | 'unfollows_total' | 'ai_replies_total' | 'ai_people_total') =>
    hasMetrics ? list.reduce((sum, item) => sum + Number(item[key] ?? 0), 0) : undefined;
  const cards = [
    ['Boas-vindas', total('welcome_total')], ['Mensagens em massa', total('mass_sent_total')],
    ['Curtidas', total('likes_total')], ['Pessoas seguidas', total('follows_total')],
    ['Deixou de seguir', total('unfollows_total')], ['Respostas da IA', total('ai_replies_total')],
    ['Pessoas atendidas pela IA', total('ai_people_total')],
  ] as const;
  const byDay = new Map<string, { day: string; welcome: number; mass: number; likes: number; follows: number; unfollows: number; aiReplies: number; aiPeople: number }>();
  for (const item of list) for (const day of item.metrics) {
    const point = byDay.get(day.day) ?? { day: day.day, welcome: 0, mass: 0, likes: 0, follows: 0, unfollows: 0, aiReplies: 0, aiPeople: 0 };
    point.welcome += Number(day.welcome_sent ?? 0); point.mass += Number(day.mass_sent ?? 0);
    point.likes += Number(day.likes_sent ?? 0); point.follows += Number(day.follows_sent ?? 0);
    point.unfollows += Number(day.unfollows_sent ?? 0); point.aiReplies += Number(day.ai_replies_sent ?? 0);
    point.aiPeople += Number(day.ai_people_replied ?? 0); byDay.set(day.day, point);
  }
  const chart = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)).map(point => ({ ...point, label: point.day.slice(5).split('-').reverse().join('/') }));
  const creatives = list.flatMap(item => item.creatives ?? []).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const lines = [
    ['welcome', 'Boas-vindas', 'hsl(var(--primary))'], ['mass', 'Massa', 'hsl(var(--chart-2))'],
    ['likes', 'Curtidas', 'hsl(var(--chart-3))'], ['follows', 'Seguiu', 'hsl(var(--chart-4))'],
    ['unfollows', 'Deixou de seguir', 'hsl(var(--chart-5))'], ['aiReplies', 'Respostas IA', 'hsl(var(--muted-foreground))'],
    ['aiPeople', 'Pessoas IA', 'hsl(var(--foreground))'],
  ] as const;
  return <div className="space-y-6">
    <section className="space-y-3"><h2 className="text-lg font-semibold">Movimentação com a ferramenta</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">{cards.map(([label, value]) => <Card key={label} className="p-3"><p className="text-xs text-muted-foreground mb-1">{label}</p><p className="text-xl font-bold">{number(value)}</p></Card>)}</div>
    </section>
    <Card className="p-4 space-y-3"><div><h3 className="font-semibold">Atividade diária</h3><p className="text-xs text-muted-foreground">Valores recebidos da extensão, sem estimativas.</p></div>
      {chart.length ? <><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">{lines.map(([key, label, color]) => <span key={key} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>)}</div><div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" /><YAxis tick={{ fontSize: 11 }} width={45} stroke="hsl(var(--muted-foreground))" allowDecimals={false} /><Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />{lines.map(([key, label, color]) => <Line key={key} type="monotone" dataKey={key} name={label} stroke={color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />)}</LineChart></ResponsiveContainer></div></> : <p className="py-8 text-center text-sm text-muted-foreground">Aguardando a extensão enviar a movimentação diária.</p>}
    </Card>
    <InstagramCreativeHistory creatives={creatives} />
  </div>;
}
