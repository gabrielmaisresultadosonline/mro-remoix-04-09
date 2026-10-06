import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { fmtDate, planLabel, wlAdmin, type WlClient, type WlUser } from '@/lib/whitelabel';

interface Account { id: string; instagram_username: string; is_trial: boolean }
interface Props { client: WlClient; user?: WlUser; onChanged: () => void }

/** Linha de cliente de um revendedor, com ações administrativas completas. */
export function WhitelabelClientRow({ client: c, user, onChanged }: Props) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const op = async (o: string, extra: Record<string, unknown> = {}, ok = 'Feito') => {
    try {
      const res = await wlAdmin<{ accounts?: Account[] }>('admin_client', { id: c.id, op: o, ...extra });
      if (o === 'accounts') setAccounts(res.accounts ?? []);
      else { toast.success(ok); onChanged(); if (o === 'remove_account') op('accounts'); }
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="rounded-md border border-border p-3 text-sm space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <b>{c.username}</b> <span className="text-muted-foreground">· {c.email}</span>{' '}
          <Badge variant="secondary">{planLabel(c.plan)}</Badge>{' '}
          {user && !user.is_active && <Badge variant="destructive">Bloqueado</Badge>}
          <p className="text-xs text-muted-foreground">
            Criado {fmtDate(c.created_at)} · {c.origin === 'link' ? 'via link' : 'manual'} · Senha: {user?.password_plain ?? '—'} · Contas plano {user?.plan_accounts ?? '—'} + extras {user?.extra_accounts ?? 0} · Testes usados {user?.trials_used ?? 0}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => { const p = prompt('Nova senha'); if (p) op('password', { password: p }, 'Senha alterada'); }}>Senha</Button>
          <Button size="sm" variant="outline" onClick={() => { const v = prompt('Total de contas extras', String(user?.extra_accounts ?? 0)); if (v !== null) op('extras', { value: v }, 'Extras salvos'); }}>Extras</Button>
          <Button size="sm" variant="outline" onClick={() => op(user?.is_active === false ? 'unblock' : 'block', {}, 'Status alterado')}>{user?.is_active === false ? 'Desbloquear' : 'Bloquear'}</Button>
          <Button size="sm" variant="outline" onClick={() => (accounts ? setAccounts(null) : op('accounts'))}>Contas</Button>
          <Button size="sm" variant="destructive" onClick={() => confirm(`Excluir ${c.username}?`) && op('delete', {}, 'Cliente excluído')}>Excluir</Button>
        </div>
      </div>
      {accounts && (
        <div className="space-y-1">
          {accounts.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma conta cadastrada.</p>}
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1">
              <span>@{a.instagram_username}{a.is_trial && ' (teste)'}</span>
              <Button size="sm" variant="ghost" className="h-6" onClick={() => confirm(`Remover @${a.instagram_username}?`) && op('remove_account', { account_id: a.id }, 'Conta removida')}>Remover</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
