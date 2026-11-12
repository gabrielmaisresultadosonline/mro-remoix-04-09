import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminSupabase } from '@/lib/adminSupabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Lock, Unlock, Radio } from 'lucide-react';
import { InstagramCreativeHistory } from '@/components/InstagramActivityPanel';
import type { AccountCreative } from '@/lib/instagramAccountOverview';

interface Props { instagram: string | null; days: number; onClose: () => void; onChanged: () => void }
interface Session {
  instagram_username: string; last_seen_at: string; first_seen_at: string; online: boolean;
  followers_initial: number | null; followers_current: number | null; welcome_total: number;
  mass_sent_total: number; likes_total: number; follows_total: number; unfollows_total: number;
  ai_replies_total: number; ai_people_total: number;
  session_started_at: string | null; session_ended_at: string | null; metrics_updated_at: string | null;
  blocked: boolean; block_message: string | null; blocked_at: string | null; unblocked_at: string | null;
  browser: string; os: string;
}
interface Metric {
  day: string; followers_start: number | null; followers_end: number | null; followers_gained: number; welcome_sent: number;
  mass_sent: number; likes_sent: number; follows_sent: number; unfollows_sent: number;
  ai_replies_sent: number; ai_people_replied: number;
}
interface BlockLog { action: 'blocked' | 'unblocked' | 'message_updated'; block_message: string | null; created_at: string }
const BLOCK_LABEL: Record<BlockLog['action'], string> = { blocked: 'Bloqueado', unblocked: 'Desbloqueado', message_updated: 'Mensagem alterada' };
interface Ev { created_at: string; browser: string; ip: string | null; url: string | null }
interface Outreach { kind: 'welcome' | 'mass'; recipient: string; campaign_id: string | null; sent_at: string }

const WAIT = 'Aguardando dados';
const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : WAIT;
const n = (v: number | null | undefined) => v === null || v === undefined ? WAIT : Number(v).toLocaleString('pt-BR');
const dur = (ms: number) => { const minutes = Math.max(0, Math.round(ms / 60000)); return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`; };

const IgOnlinesProfileDetail: React.FC<Props> = ({ instagram, days, onClose, onChanged }) => {
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [blockLog, setBlockLog] = useState<BlockLog[]>([]);
  const [outreach, setOutreach] = useState<Outreach[]>([]);
  const [creatives, setCreatives] = useState<AccountCreative[]>([]);
  const [msg, setMsg] = useState('');
  const [defMsg, setDefMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!instagram) return;
    const { data, error } = await adminSupabase.functions.invoke('ig-online-api', { body: { action: 'admin_profile_detail', instagram } });
    const response = data as { success?: boolean; error?: string; session?: Session; metrics?: Metric[]; events?: Ev[]; block_history?: BlockLog[]; outreach?: Outreach[]; creatives?: AccountCreative[]; default_block_message?: string } | null;
    if (error || !response?.success || !response.session) {
      toast({ title: 'Não foi possível carregar', description: response?.error || error?.message, variant: 'destructive' }); return;
    }
    setSession(response.session); setMetrics(response.metrics ?? []); setEvents(response.events ?? []); setBlockLog(response.block_history ?? []);
    setOutreach(response.outreach ?? []); setCreatives(response.creatives ?? []);
    setDefMsg(response.default_block_message ?? ''); setMsg(response.session.block_message ?? '');
  }, [instagram, toast]);
  useEffect(() => { setSession(null); void load(); }, [load]);

  const periodMetrics = useMemo(() => {
    const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
    return metrics.filter(metric => metric.day >= since);
  }, [metrics, days]);
  const newFollowers = useMemo(() => {
    const valid = periodMetrics.filter(metric => (metric.followers_start !== null && metric.followers_end !== null) || metric.followers_gained > 0);
    if (!valid.length) return null;
    return valid.reduce((total, metric) => {
      const difference = metric.followers_start !== null && metric.followers_end !== null ? Number(metric.followers_end) - Number(metric.followers_start) : null;
      return total + (difference !== null && difference !== 0 ? difference : Number(metric.followers_gained ?? 0) > 0 ? Number(metric.followers_gained) : difference ?? 0);
    }, 0);
  }, [periodMetrics]);
  const sessionTime = useMemo(() => {
    if (!session?.session_started_at) return WAIT;
    const start = new Date(session.session_started_at).getTime();
    if (session.session_ended_at) return `${dur(new Date(session.session_ended_at).getTime() - start)} (última sessão encerrada)`;
    const end = session.online ? Date.now() : new Date(session.last_seen_at).getTime();
    return `${dur(end - start)} ${session.online ? '(sessão atual)' : '(até a última atividade)'}`;
  }, [session]);

  const setBlock = async (blocked: boolean) => {
    if (!session) return;
    setSaving(true);
    const { data, error } = await adminSupabase.functions.invoke('ig-online-api', { body: { action: 'admin_set_block', instagram: session.instagram_username, blocked, block_message: msg } });
    setSaving(false);
    const response = data as { success?: boolean; error?: string } | null;
    if (error || !response?.success) { toast({ title: 'Falha ao salvar', description: response?.error || error?.message, variant: 'destructive' }); return; }
    toast({ title: blocked ? 'Perfil bloqueado' : 'Perfil desbloqueado' }); await load(); onChanged();
  };

  const info: [string, string][] = session ? [
    ['Última atividade', fmt(session.last_seen_at)], ['Última utilização da ferramenta', fmt(session.metrics_updated_at)],
    ['Tempo conectado', sessionTime], ['Seguidores iniciais', n(session.followers_initial)], ['Seguidores atuais', n(session.followers_current)],
    [`Novos seguidores (${days}d)`, newFollowers === null ? WAIT : `${newFollowers > 0 ? '+' : ''}${newFollowers.toLocaleString('pt-BR')}`],
    ['Boas-vindas (total)', session.metrics_updated_at ? n(session.welcome_total) : WAIT], ['Mensagens em massa (total)', n(session.mass_sent_total)],
    ['Curtidas (total)', n(session.likes_total)], ['Pessoas seguidas (total)', n(session.follows_total)],
    ['Deixou de seguir (total)', n(session.unfollows_total)], ['Respostas da IA (total)', n(session.ai_replies_total)],
    ['Pessoas atendidas pela IA (total)', n(session.ai_people_total)], ['Navegador', `${session.browser || '—'} · ${session.os || '—'}`],
  ] : [];

  return <Dialog open={!!instagram} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2">@{instagram}{session?.online ? <Badge className="gap-1"><Radio className="w-3 h-3" /> Online</Badge> : <Badge variant="secondary">Offline</Badge>}{session?.blocked && <Badge variant="destructive">Bloqueado</Badge>}</DialogTitle><DialogDescription>Movimentação, destinatários e criativos recebidos da extensão. Nada é estimado.</DialogDescription></DialogHeader>
      {!session ? <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p> : <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{info.map(([key, value]) => <Card key={key} className="p-3"><p className="text-xs text-muted-foreground">{key}</p><p className="font-semibold text-sm">{value}</p></Card>)}</div>

        <Card className="p-3 overflow-x-auto"><h4 className="font-semibold text-sm mb-2">Histórico diário completo</h4>{metrics.length === 0 ? <p className="text-xs text-muted-foreground">{WAIT}</p> : <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground">{['Dia', 'Início', 'Fim', 'Ganho', 'Boas-vindas', 'Massa', 'Curtidas', 'Seguiu', 'Deixou', 'IA resp.', 'IA pessoas'].map(header => <th key={header} className="p-1 whitespace-nowrap">{header}</th>)}</tr></thead><tbody>{metrics.map(metric => <tr key={metric.day} className="border-t"><td className="p-1 whitespace-nowrap">{metric.day.split('-').reverse().join('/')}</td><td className="p-1">{n(metric.followers_start)}</td><td className="p-1">{n(metric.followers_end)}</td><td className="p-1">{metric.followers_start !== null && metric.followers_end !== null && Number(metric.followers_end) !== Number(metric.followers_start) ? Number(metric.followers_end) - Number(metric.followers_start) : metric.followers_gained > 0 ? metric.followers_gained : metric.followers_start !== null && metric.followers_end !== null ? 0 : WAIT}</td><td className="p-1">{n(metric.welcome_sent)}</td><td className="p-1">{n(metric.mass_sent)}</td><td className="p-1">{n(metric.likes_sent)}</td><td className="p-1">{n(metric.follows_sent)}</td><td className="p-1">{n(metric.unfollows_sent)}</td><td className="p-1">{n(metric.ai_replies_sent)}</td><td className="p-1">{n(metric.ai_people_replied)}</td></tr>)}</tbody></table>}</Card>

        <InstagramCreativeHistory creatives={creatives} />

        <Card className="p-4"><div className="flex flex-wrap items-center justify-between gap-2 mb-3"><h4 className="font-semibold text-sm">Histórico de Envios (Local) sincronizado</h4><div className="flex gap-2"><Badge variant="secondary">{outreach.filter(item => item.kind === 'welcome').length} boas-vindas</Badge><Badge variant="secondary">{outreach.filter(item => item.kind === 'mass').length} em massa</Badge></div></div>
          <p className="text-xs text-muted-foreground mb-3">A extensão consulta estes destinatários para não enviar de novo. Boas-vindas e massa têm listas independentes.</p>
          {outreach.length ? <div className="max-h-72 overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th className="p-2">Tipo</th><th className="p-2">Destinatário</th><th className="p-2">Campanha</th><th className="p-2">Enviado em</th></tr></thead><tbody>{outreach.map((item, index) => <tr key={`${item.kind}-${item.recipient}-${index}`} className="border-t"><td className="p-2"><Badge variant={item.kind === 'welcome' ? 'default' : 'secondary'}>{item.kind === 'welcome' ? 'Boas-vindas' : 'Massa'}</Badge></td><td className="p-2">@{item.recipient}</td><td className="p-2">{item.campaign_id || '—'}</td><td className="p-2 whitespace-nowrap">{fmt(item.sent_at)}</td></tr>)}</tbody></table></div> : <p className="text-xs text-muted-foreground">Nenhum destinatário sincronizado ainda.</p>}
        </Card>

        <Card className="p-4 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-sm">Bloqueio de acesso</h4><span className="text-xs text-muted-foreground">{session.blocked ? `Bloqueado desde ${fmt(session.blocked_at)}` : session.unblocked_at ? `Liberado em ${fmt(session.unblocked_at)}` : 'Liberado'}</span></div><Textarea value={msg} onChange={event => setMsg(event.target.value)} placeholder={defMsg} rows={3} maxLength={1000} /><p className="text-xs text-muted-foreground">Em branco usa a mensagem padrão. Vale só para este perfil.</p><div className="flex flex-wrap gap-2">{session.blocked ? <><Button size="sm" variant="outline" disabled={saving} onClick={() => void setBlock(true)}>Atualizar mensagem</Button><Button size="sm" disabled={saving} onClick={() => void setBlock(false)} className="gap-1"><Unlock className="w-3 h-3" /> Desbloquear</Button></> : <Button size="sm" variant="destructive" disabled={saving} onClick={() => void setBlock(true)} className="gap-1"><Lock className="w-3 h-3" /> Bloquear perfil</Button>}</div>{blockLog.length > 0 && <ul className="text-xs space-y-1 border-t pt-2">{blockLog.map(history => <li key={history.created_at}>{fmt(history.created_at)} · <strong>{BLOCK_LABEL[history.action]}</strong>{history.block_message ? ` — ${history.block_message}` : ''}</li>)}</ul>}</Card>

        <Card className="p-3"><h4 className="font-semibold text-sm mb-2">Histórico de utilização</h4>{events.length === 0 ? <p className="text-xs text-muted-foreground">{WAIT}</p> : <ul className="text-xs space-y-1 max-h-48 overflow-y-auto">{events.map(event => <li key={event.created_at} className="border-t pt-1">{fmt(event.created_at)} · {event.browser} · {event.ip ?? 'sem IP'}</li>)}</ul>}</Card>
      </div>}
    </DialogContent>
  </Dialog>;
};

export default IgOnlinesProfileDetail;
