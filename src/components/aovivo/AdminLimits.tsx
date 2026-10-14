import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { aovivo, type AoVivoUser } from "@/lib/aovivoApi";

/** Admin libera mais de 1 ao vivo para usuários da MRO Ferramenta. */
export const AdminLimits = () => {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AoVivoUser[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      aovivo.users(q).then((r) => setUsers(r.users)).catch(() => setUsers([]));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const save = async (u: AoVivoUser, value: number) => {
    try { await aovivo.setLimit(u.id, value); toast({ title: `@${u.username} agora pode ter ${value} ao vivo` }); }
    catch (e) { toast({ title: "Ops", description: (e as Error).message, variant: "destructive" }); }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h2 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-primary" />Liberar lives por usuário</h2>
      <Input placeholder="Buscar usuário ou e-mail da MRO Ferramenta" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="max-h-80 space-y-1.5 overflow-auto">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="flex-1 truncate">@{u.username} <span className="text-muted-foreground">· {u.streams} criada(s)</span></span>
            <Input type="number" min={0} max={50} defaultValue={u.max_streams} className="h-8 w-20" id={`lim-${u.id}`} aria-label="Limite de lives" />
            <Button size="sm" variant="outline" onClick={() => {
              const el = document.getElementById(`lim-${u.id}`) as HTMLInputElement | null;
              void save(u, Number(el?.value ?? 1));
            }}>Salvar</Button>
          </li>
        ))}
      </ul>
    </section>
  );
};
