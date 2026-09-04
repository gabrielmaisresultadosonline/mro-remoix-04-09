/** /IG/admin/users — listagem, busca e bloqueio de clientes (auditado). */
import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Search } from "lucide-react";
import IgAdminShell from "@/components/ig/IgAdminShell";
import { IgEmpty, IgError, IgLoading } from "@/components/ig/IgStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { igAdminApi } from "@/lib/ig/adminApi";

type UsersResponse = Awaited<ReturnType<typeof igAdminApi.users>>;

const PAGE_SIZE = 50;

const IgAdminUsers = () => {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [passwordUser, setPasswordUser] = useState<{ id: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await igAdminApi.users());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const users = data?.users ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [user.email, user.full_name, user.company].some((field) => field?.toLowerCase().includes(term)),
    );
  }, [data, search]);

  const visible = showAll || search.trim() ? filtered : filtered.slice(0, PAGE_SIZE);

  const tenantOf = (userId: string) => {
    const membership = data?.memberships.find((m) => m.user_id === userId);
    if (!membership) return null;
    return data?.tenants.find((t) => t.id === membership.tenant_id) ?? null;
  };

  const toggleBlock = async (userId: string, blocked: boolean) => {
    setBusy(userId);
    try {
      await igAdminApi.setUserBlocked(userId, blocked);
      toast({ title: blocked ? "Usuário bloqueado" : "Usuário desbloqueado" });
      await load();
    } catch (err) {
      toast({
        title: "Ação não concluída",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const resetPassword = async () => {
    if (!passwordUser) return;
    if (newPassword.length < 8) {
      toast({ title: "Senha muito curta", description: "Use no mínimo 8 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }

    setBusy(passwordUser.id);
    try {
      await igAdminApi.resetUserPassword(passwordUser.id, newPassword);
      toast({ title: "Senha redefinida", description: `A nova senha de ${passwordUser.email} já está ativa.` });
      setPasswordUser(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast({
        title: "Não foi possível redefinir a senha",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <IgAdminShell title="Usuários">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="pl-9"
            placeholder="Pesquisar por nome, e-mail ou empresa"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Pesquisar usuários"
          />
        </div>
        {!search.trim() && filtered.length > PAGE_SIZE ? (
          <Button variant="outline" size="sm" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Mostrar 50" : `Ver todos (${filtered.length})`}
          </Button>
        ) : null}
      </div>

      {error ? (
        <IgError message={error} onRetry={load} />
      ) : loading ? (
        <IgLoading label="Carregando usuários..." />
      ) : visible.length === 0 ? (
        <IgEmpty title="Nenhum usuário encontrado" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Cadastro</th>
                <th className="px-4 py-3">Último acesso</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => {
                const tenant = tenantOf(user.user_id);
                return (
                  <tr key={user.user_id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-medium">{user.full_name ?? "—"}</span>
                      {user.company ? (
                        <span className="block text-xs text-muted-foreground">{user.company}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email ?? "—"}</td>
                    <td className="px-4 py-3 uppercase text-muted-foreground">{tenant?.plan_id ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.is_blocked ? "destructive" : "secondary"}>
                        {user.is_blocked ? "Bloqueado" : "Ativo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          disabled={busy === user.user_id || !user.email}
                          onClick={() => setPasswordUser({ id: user.user_id, email: user.email ?? "usuário" })}
                          aria-label={`Redefinir senha de ${user.email ?? "usuário"}`}
                          title="Redefinir senha"
                        >
                          <KeyRound className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          size="sm"
                          variant={user.is_blocked ? "secondary" : "outline"}
                          disabled={busy === user.user_id}
                          onClick={() => void toggleBlock(user.user_id, !user.is_blocked)}
                        >
                          {user.is_blocked ? "Desbloquear" : "Bloquear"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={Boolean(passwordUser)} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para {passwordUser?.email}. A senha atual não será exibida.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ig-user-new-password">Nova senha</Label>
              <Input
                id="ig-user-new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ig-user-confirm-password">Confirmar nova senha</Label>
              <Input
                id="ig-user-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordUser(null)} disabled={Boolean(busy)}>
              Cancelar
            </Button>
            <Button onClick={() => void resetPassword()} disabled={Boolean(busy)}>
              {busy ? "Salvando..." : "Redefinir senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </IgAdminShell>
  );
};

export default IgAdminUsers;
