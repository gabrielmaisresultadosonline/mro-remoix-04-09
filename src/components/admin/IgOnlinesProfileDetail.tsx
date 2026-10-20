import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminSupabase } from '@/lib/adminSupabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Lock, Unlock, Radio } from 'lucide-react';

interface Props { instagram: string | null; days: number; onClose: () => void; onChanged: () => void }
interface Session {
  instagram_username: string; last_seen_at: string; first_seen_at: string; online: boolean;
  followers_initial: number | null; followers_current: number | null; welcome_total: number;
  session_started_at: string | null; session_ended_at: string | null; metrics_updated_at: string | null;
  blocked: boolean; block_message: string | null; blocked_at: string | null; unblocked_at: string | null;
  browser: string; os: string;
}
interface Metric { day: string; followers_start: number | null; followers_end: number | null; welcome_sent: number }
interface Ev { created_at: string; browser: string; ip: string | null; url: string | null }

const WAIT = 'Aguardando dados';
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : WAIT);
const n = (v: number | null | undefined) => (v === null || v === undefined ? WAIT : v.toLocaleString('pt-BR'));
const dur = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}min`;
};

const IgOnlinesProfileDetail: React.FC<Props> = ({ instagram, days, onClose, onChanged }) => {
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [msg, setMsg] = useState('');
  const [defMsg, setDefMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!instagram) return;
    const { data, error } = await adminSupabase.functions.invoke('ig-online-api', { body: { action: 'admin_profile_detail', instagram } });
    const r = data as { success?: boolean; error?: string; session?: Session; metrics?: Metric[]; events?: Ev[]; default_block_message?: string } | null;
    if (error || !r?.success || !r.session) {
      toast({ title: 'Não foi possível carregar', description: r?.error || error?.message, variant: 'destructive' });
      return;
    }
    setSession(r.session); setMetrics(r.metrics ?? []); setEvents(r.events ?? []);
    setDefMsg(r.default_block_message ?? '');
    setMsg(r.session.block_message ?? '');
  }, [instagram, toast]);

  useEffect(() => { setSession(null); void load(); }, [load]);

  const periodMetrics = useMemo(() => {
    const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
    return metrics.filter((m) => m.day >= since);
  }, [metrics, days]);
  const newFollowers = useMemo(() => {
    const valid = periodMetrics.filter((m) => m.followers_start !== null && m.followers_end !== null);
    return valid.length ? valid.reduce((a, m) => a + (Number(m.followers_end) - Number(m.followers_start)), 0) : null;
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
    const { data, error } = await adminSupabase.functions.invoke('ig-online-api', {
      body: { action: 'admin_set_block', instagram: session.instagram_username, blocked, block_message: msg },
    });
    setSaving(false);
    const r = data as { success?: boolean; error?: string } | null;
    if (error || !r?.success) {
      toast({ title: 'Falha ao salvar', description: r?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: blocked ? 'Perfil bloqueado' : 'Perfil desbloqueado' });
    await load();
    onChanged();
  };

  const info: [string, string][] = session ? [
    ['Última atividade', fmt(session.last_seen_at)],
    ['Última utilização da ferramenta', fmt(session.metrics_updated_at)],
    ['Tempo conectado', sessionTime],
    ['Seguidores iniciais', n(session.followers_initial)],
    ['Seguidores atuais', n(session.followers_current)],
    [`Novos seguidores (${days}d)`, newFollowers === null ? WAIT : `${newFollowers > 0 ? '+' : ''}${newFollowers.toLocaleString('pt-BR')}`],
    ['Boas-vindas enviadas (total)', session.metrics_updated_at ? n(session.welcome_total) : WAIT],
    ['Navegador', `${session.browser || '—'} · ${session.os || '—'}`],
  ] : [];

  return (
    <Dialog open={!!instagram} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            @{instagram}
            {session?.online ? <Badge className="gap-1"><Radio className="w-3 h-3" /> Online</Badge> : <Badge variant="secondary">Offline</Badge>}
            {session?.blocked && <Badge variant="destructive">Bloqueado</Badge>}
          </DialogTitle>
          <DialogDescription>Dados recebidos da extensão. Desconectado mostra a última atividade conhecida.</DialogDescription>
        </DialogHeader>

        {!session ? <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p> : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {info.map(([k, v]) => (
                <Card key={k} className="p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="font-semibold text-sm">{v}</p></Card>
              ))}
            </div>

            <Card className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold text-sm">Bloqueio de acesso</h4>
                <span className="text-xs text-muted-foreground">
                  {session.blocked ? `Bloqueado desde ${fmt(session.blocked_at)}` : session.unblocked_at ? `Liberado em ${fmt(session.unblocked_at)}` : 'Liberado'}
                </span>
              </div>
              <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={defMsg} rows={3} maxLength={1000} />
              <p className="text-xs text-muted-foreground">Em branco usa a mensagem padrão. Vale só para este perfil.</p>
              <div className="flex flex-wrap gap-2">
                {session.blocked ? (
                  <>
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => void setBlock(true)}>Atualizar mensagem</Button>
                    <Button size="sm" disabled={saving} onClick={() => void setBlock(false)} className="gap-1"><Unlock className="w-3 h-3" /> Desbloquear</Button>
                  </>
                ) : (
                  <Button size="sm" variant="destructive" disabled={saving} onClick={() => void setBlock(true)} className="gap-1"><Lock className="w-3 h-3" /> Bloquear perfil</Button>
                )}
              </div>
            </Card>

            <Card className="p-3 overflow-x-auto">
              <h4 className="font-semibold text-sm mb-2">Histórico de métricas</h4>
              {metrics.length === 0 ? <p className="text-xs text-muted-foreground">{WAIT}</p> : (
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-muted-foreground"><th className="p-1">Dia</th><th className="p-1">Início</th><th className="p-1">Fim</th><th className="p-1">Ganho</th><th className="p-1">Boas-vindas</th></tr></thead>
                  <tbody>{metrics.map((m) => (
                    <tr key={m.day} className="border-t">
                      <td className="p-1">{m.day.split('-').reverse().join('/')}</td>
                      <td className="p-1">{n(m.followers_start)}</td>
                      <td className="p-1">{n(m.followers_end)}</td>
                      <td className="p-1">{m.followers_start !== null && m.followers_end !== null ? Number(m.followers_end) - Number(m.followers_start) : WAIT}</td>
                      <td className="p-1">{m.welcome_sent}</td>
                    </tr>))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card className="p-3">
              <h4 className="font-semibold text-sm mb-2">Histórico de utilização</h4>
              {events.length === 0 ? <p className="text-xs text-muted-foreground">{WAIT}</p> : (
                <ul className="text-xs space-y-1 max-h-48 overflow-y-auto">
                  {events.map((e) => (
                    <li key={e.created_at} className="border-t pt-1">{fmt(e.created_at)} · {e.browser} · {e.ip ?? 'sem IP'}</li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default IgOnlinesProfileDetail;
