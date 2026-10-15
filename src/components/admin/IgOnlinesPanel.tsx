import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminSupabase } from '@/lib/adminSupabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Radio, RefreshCw, Send, Trash2, FileCode, Users, AlertTriangle, History, Power,
} from 'lucide-react';
import IgOnlinesDocs from './IgOnlinesDocs';

type Status = 'client' | 'trial' | 'unknown';

interface IgSession {
  id: string;
  instagram_username: string;
  mro_username: string | null;
  status: Status;
  flagged: boolean;
  browser: string;
  os: string;
  ip: string | null;
  last_url: string | null;
  extension_version: string | null;
  total_pings: number;
  first_seen_at: string;
  last_seen_at: string;
  online: boolean;
}

interface IgMessage {
  id: string;
  target_instagram: string | null;
  target_scope: 'one' | 'all' | 'unknown';
  title: string;
  body: string;
  image_url: string | null;
  buttons: { label: string; url: string }[];
  blocking: boolean;
  lock_seconds: number;
  repeat_daily: boolean;
  active: boolean;
  created_at: string;
  delivered: number;
  shown: number;
  closed: number;
  clicked: number;
}

interface IgEvent {
  id: string;
  created_at: string;
  browser: string;
  ip: string | null;
  url: string | null;
  status: string;
}

const STATUS_LABEL: Record<Status, string> = {
  client: 'Cliente',
  trial: 'Teste grátis',
  unknown: 'Fora do banco',
};

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';

type SubTab = 'profiles' | 'messages' | 'docs';

const IgOnlinesPanel: React.FC = () => {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<SubTab>('profiles');
  const [sessions, setSessions] = useState<IgSession[]>([]);
  const [messages, setMessages] = useState<IgMessage[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [history, setHistory] = useState<{ ig: string; events: IgEvent[] } | null>(null);

  // Formulário de aviso
  const [msgOpen, setMsgOpen] = useState(false);
  const [scope, setScope] = useState<'one' | 'all' | 'unknown'>('one');
  const [targetIg, setTargetIg] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [blocking, setBlocking] = useState(false);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [buttons, setButtons] = useState<{ label: string; url: string }[]>([{ label: '', url: '' }]);
  const [sending, setSending] = useState(false);

  const call = useCallback(async <T,>(action: string, payload: Record<string, unknown> = {}): Promise<T | null> => {
    const { data, error } = await adminSupabase.functions.invoke('ig-online-api', { body: { action, ...payload } });
    const result = data as ({ success?: boolean; error?: string } & T) | null;
    if (error || result?.success === false) {
      toast({
        title: 'Não foi possível concluir',
        description: result?.error || error?.message || 'Tente novamente.',
        variant: 'destructive',
      });
      return null;
    }
    return result as T;
  }, [toast]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    const res = await call<{ sessions: IgSession[] }>('admin_list', { search });
    if (res) setSessions(res.sessions ?? []);
    setLoading(false);
  }, [call, search]);

  const loadMessages = useCallback(async () => {
    const res = await call<{ messages: IgMessage[] }>('admin_messages');
    if (res) setMessages(res.messages ?? []);
  }, [call]);

  useEffect(() => { void loadSessions(); void loadMessages(); }, [loadSessions, loadMessages]);

  // Atualização automática: a lista mostra quem está online agora.
  useEffect(() => {
    if (subTab !== 'profiles') return;
    const timer = window.setInterval(() => { void loadSessions(); }, 30000);
    return () => window.clearInterval(timer);
  }, [subTab, loadSessions]);

  const stats = useMemo(() => ({
    total: sessions.length,
    online: sessions.filter((s) => s.online).length,
    clients: sessions.filter((s) => s.status === 'client').length,
    trials: sessions.filter((s) => s.status === 'trial').length,
    unknown: sessions.filter((s) => s.status === 'unknown').length,
  }), [sessions]);

  const visible = onlyFlagged ? sessions.filter((s) => s.status === 'unknown') : sessions;

  const openMessageFor = (ig?: string) => {
    setScope(ig ? 'one' : 'all');
    setTargetIg(ig ?? '');
    setTitle('');
    setText('');
    setImageUrl('');
    setBlocking(false);
    setLockSeconds(0);
    setRepeatDaily(false);
    setButtons([{ label: '', url: '' }]);
    setMsgOpen(true);
  };

  const submitMessage = async () => {
    setSending(true);
    const res = await call('admin_send_message', {
      target_scope: scope,
      target_instagram: targetIg,
      title,
      body: text,
      image_url: imageUrl,
      blocking,
      lock_seconds: lockSeconds,
      repeat_daily: repeatDaily,
      buttons: buttons.filter((b) => b.label && b.url),
    });
    setSending(false);
    if (res) {
      toast({ title: 'Aviso criado', description: 'Será exibido no próximo acesso do perfil.' });
      setMsgOpen(false);
      void loadMessages();
    }
  };

  const openHistory = async (ig: string) => {
    const res = await call<{ events: IgEvent[] }>('admin_history', { instagram: ig });
    if (res) setHistory({ ig, events: res.events ?? [] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {([
          { id: 'profiles' as const, label: 'Perfis logados', icon: <Users className="w-4 h-4" /> },
          { id: 'messages' as const, label: 'Avisos enviados', icon: <Send className="w-4 h-4" /> },
          { id: 'docs' as const, label: 'Documentação da extensão', icon: <FileCode className="w-4 h-4" /> },
        ]).map((tab) => (
          <Button key={tab.id} size="sm" variant={subTab === tab.id ? 'default' : 'outline'} className="gap-2" onClick={() => setSubTab(tab.id)}>
            {tab.icon}{tab.label}
          </Button>
        ))}
      </div>

      {subTab === 'profiles' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Perfis', value: stats.total },
              { label: 'Online agora', value: stats.online },
              { label: 'Clientes', value: stats.clients },
              { label: 'Teste grátis', value: stats.trials },
              { label: 'Fora do banco', value: stats.unknown },
            ].map((s) => (
              <Card key={s.label} className="p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Buscar @instagram..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void loadSessions(); }}
              className="max-w-xs"
            />
            <Button size="sm" variant="outline" onClick={() => void loadSessions()} disabled={loading} className="gap-2">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Atualizar
            </Button>
            <Button size="sm" variant={onlyFlagged ? 'default' : 'outline'} onClick={() => setOnlyFlagged((v) => !v)} className="gap-2">
              <AlertTriangle className="w-4 h-4" /> Só fora do banco
            </Button>
            <Button size="sm" onClick={() => openMessageFor()} className="gap-2">
              <Send className="w-4 h-4" /> Aviso para todos
            </Button>
          </div>

          <div className="space-y-2">
            {visible.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum perfil registrado ainda.</p>
            )}
            {visible.map((s) => (
              <Card key={s.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">@{s.instagram_username}</span>
                    {s.online && (
                      <Badge className="gap-1"><Radio className="w-3 h-3" /> Online</Badge>
                    )}
                    <Badge variant={s.status === 'unknown' ? 'destructive' : 'secondary'}>{STATUS_LABEL[s.status]}</Badge>
                    {s.mro_username && <span className="text-xs text-muted-foreground">usuário: {s.mro_username}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {s.browser} · {s.os} · {s.ip ?? 'sem IP'} · versão {s.extension_version || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Último acesso: {fmt(s.last_seen_at)} · Primeiro: {fmt(s.first_seen_at)} · {s.total_pings} registros
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => void openHistory(s.instagram_username)}>
                    <History className="w-3 h-3" /> Histórico
                  </Button>
                  <Button size="sm" className="gap-1" onClick={() => openMessageFor(s.instagram_username)}>
                    <Send className="w-3 h-3" /> Enviar aviso
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={async () => {
                      if (!confirm(`Remover o registro de @${s.instagram_username}?`)) return;
                      const ok = await call('admin_delete_session', { id: s.id });
                      if (ok) void loadSessions();
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {subTab === 'messages' && (
        <div className="space-y-3">
          <Button size="sm" onClick={() => openMessageFor()} className="gap-2">
            <Send className="w-4 h-4" /> Novo aviso
          </Button>
          {messages.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nenhum aviso criado.</p>}
          {messages.map((m) => (
            <Card key={m.id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{m.title || '(sem título)'}</span>
                <Badge variant={m.active ? 'default' : 'secondary'}>{m.active ? 'Ativo' : 'Pausado'}</Badge>
                <Badge variant="outline">
                  {m.target_scope === 'all' ? 'Todos' : m.target_scope === 'unknown' ? 'Fora do banco' : `@${m.target_instagram}`}
                </Badge>
                {m.blocking && <Badge variant="destructive">Bloqueante</Badge>}
                {m.repeat_daily && <Badge variant="outline">Diário</Badge>}
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{m.body}</p>
              <p className="text-xs text-muted-foreground">
                Criado em {fmt(m.created_at)} · entregues {m.delivered} · vistos {m.shown} · fechados {m.closed} · cliques {m.clicked}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={async () => {
                    const ok = await call('admin_toggle_message', { id: m.id, active: !m.active });
                    if (ok) void loadMessages();
                  }}
                >
                  <Power className="w-3 h-3" /> {m.active ? 'Pausar' : 'Ativar'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={async () => {
                    if (!confirm('Excluir este aviso?')) return;
                    const ok = await call('admin_delete_message', { id: m.id });
                    if (ok) void loadMessages();
                  }}
                >
                  <Trash2 className="w-3 h-3" /> Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {subTab === 'docs' && <IgOnlinesDocs />}

      {/* Criar aviso */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar aviso na tela</DialogTitle>
            <DialogDescription>Aparece para o perfil assim que ele abrir o Instagram com a extensão.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              {([['one', 'Um perfil'], ['all', 'Todos'], ['unknown', 'Fora do banco']] as const).map(([id, label]) => (
                <Button key={id} size="sm" variant={scope === id ? 'default' : 'outline'} onClick={() => setScope(id)}>{label}</Button>
              ))}
            </div>

            {scope === 'one' && (
              <div className="space-y-1">
                <Label htmlFor="ig-target">Instagram de destino</Label>
                <Input id="ig-target" value={targetIg} onChange={(e) => setTargetIg(e.target.value)} placeholder="@perfil" />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="ig-title">Título</Label>
              <Input id="ig-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ig-body">Mensagem</Label>
              <Textarea id="ig-body" rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ig-image">Imagem (link, opcional)</Label>
              <Input id="ig-image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>

            <div className="space-y-2">
              <Label>Botões (até 3)</Label>
              {buttons.map((b, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Texto" value={b.label} onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <Input placeholder="https://..." value={b.url} onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                </div>
              ))}
              {buttons.length < 3 && (
                <Button size="sm" variant="outline" onClick={() => setButtons((p) => [...p, { label: '', url: '' }])}>Adicionar botão</Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={blocking ? 'default' : 'outline'} onClick={() => setBlocking((v) => !v)}>
                {blocking ? 'Impossível fechar' : 'Pode fechar'}
              </Button>
              <Button size="sm" variant={repeatDaily ? 'default' : 'outline'} onClick={() => setRepeatDaily((v) => !v)}>
                {repeatDaily ? 'Repete todo dia' : 'Mostrar uma vez'}
              </Button>
              <div className="flex items-center gap-2">
                <Label htmlFor="ig-lock" className="text-xs">Trava (s)</Label>
                <Input id="ig-lock" type="number" min={0} max={60} value={lockSeconds} onChange={(e) => setLockSeconds(Number(e.target.value))} className="w-20" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMsgOpen(false)}>Cancelar</Button>
            <Button onClick={() => void submitMessage()} disabled={sending}>{sending ? 'Enviando...' : 'Enviar aviso'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico */}
      <Dialog open={!!history} onOpenChange={(open) => !open && setHistory(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Acessos de @{history?.ig}</DialogTitle>
            <DialogDescription>Dia, hora, navegador e página de cada acesso detectado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(history?.events ?? []).map((e) => (
              <div key={e.id} className="text-xs border rounded-md p-2">
                <p className="font-medium">{fmt(e.created_at)}</p>
                <p className="text-muted-foreground">{e.browser} · {e.ip ?? 'sem IP'}</p>
                {e.url && <p className="text-muted-foreground break-all">{e.url}</p>}
              </div>
            ))}
            {history && history.events.length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IgOnlinesPanel;
