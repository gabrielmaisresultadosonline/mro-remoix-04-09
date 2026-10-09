import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EMPTY_NOTICE, Teste002NoticeEditor } from "@/components/teste002/Teste002NoticeEditor";
import { teste002Call, type Teste002AdminUser, type Teste002Notice, type Teste002Report } from "@/lib/teste002";

interface Props { token: string; notices: Teste002Notice[]; report: Teste002Report | null; users: Teste002AdminUser[]; reload: () => void }

/** Aba Avisos: lista, edição e relatório de quem viu e quem não viu cada aviso. */
export const Teste002NoticesTab = ({ token, notices, report, users, reload }: Props) => {
  const [editing, setEditing] = useState<Teste002Notice | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const act = async (body: Record<string, unknown>, msg: string) => {
    try { await teste002Call({ ...body, token }); toast.success(msg); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  if (editing) return <Teste002NoticeEditor token={token} initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />;

  return (
    <div className="space-y-4">
      <Button className="gap-2 font-bold" onClick={() => setEditing({ ...EMPTY_NOTICE })}><Plus className="h-4 w-4" />Novo aviso</Button>
      {notices.length === 0 ? <p className="text-muted-foreground">Nenhum aviso criado.</p> : null}
      {notices.map((n) => {
        const r = n.id ? report?.by_notice[n.id] : undefined;
        const seen = new Set(r?.seen_users ?? []);
        return (
          <article key={n.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold">{n.title}</p>
                <p className="text-xs text-muted-foreground">
                  Horários: {n.schedule_times.join(", ")} · {n.repeat_daily ? "repete todo dia" : "uma vez"} · trava {n.lock_seconds}s · {n.buttons.length} botão(ões)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={n.is_active} aria-label="Ativar aviso" onCheckedChange={(v) => void act({ action: "notice_toggle", id: n.id, is_active: v }, v ? "Aviso ativado" : "Aviso pausado")} />
                <Button size="icon" variant="outline" aria-label="Editar" onClick={() => setEditing(n)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" aria-label="Excluir" onClick={() => { if (confirm("Excluir este aviso e o relatório dele?")) void act({ action: "notice_delete", id: n.id }, "Aviso excluído"); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge>Viram: {r?.seen ?? 0}</Badge><Badge variant="secondary">Não viram: {r?.not_seen ?? users.length}</Badge>
              <Badge variant="outline">Exibições: {r?.shown ?? 0}</Badge><Badge variant="outline">Fechamentos: {r?.closed ?? 0}</Badge>
              <Badge variant="outline">Cliques: {r?.clicks ?? 0}</Badge>
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpenId(openId === n.id ? null : n.id ?? null)}>{openId === n.id ? "Ocultar quem viu" : "Ver quem viu / não viu"}</Button>
            {openId === n.id ? (
              <ul className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto text-sm md:grid-cols-2">
                {users.map((u) => (
                  <li key={u.id} className="flex justify-between gap-2 rounded border border-border/60 px-2 py-1">
                    <span className="truncate">{u.full_name} {u.instagram_username ? `(@${u.instagram_username})` : ""}</span>
                    <span className={seen.has(u.id) ? "text-primary" : "text-muted-foreground"}>{seen.has(u.id) ? "Viu" : "Não viu"}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        );
      })}
    </div>
  );
};
