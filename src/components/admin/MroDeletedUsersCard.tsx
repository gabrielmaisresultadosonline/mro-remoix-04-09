import React, { useCallback, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trash2, RotateCcw, RefreshCw } from 'lucide-react';

interface DeletedUser {
  id: string;
  username: string;
  email: string | null;
  accounts: { instagram_username: string }[];
  deleted_at: string;
}

interface MroDeletedUsersCardProps {
  onRestored: () => void;
}

/** Lixeira: usuários excluídos da MRO Ferramenta, com restauração completa. */
export const MroDeletedUsersCard: React.FC<MroDeletedUsersCardProps> = ({ onRestored }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DeletedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mro-tool-api', { body: { action: 'list_deleted_users' } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Erro');
      setItems(data.deleted || []);
    } catch (err) {
      toast({ title: 'Erro ao carregar excluídos', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const restore = async (item: DeletedUser) => {
    setBusy(item.id);
    try {
      const { data, error } = await supabase.functions.invoke('mro-tool-api', { body: { action: 'restore_user', id: item.id } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Erro');
      toast({ title: 'Usuário restaurado!', description: `${item.username} voltou com ${data.accounts ?? 0} conta(s).` });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      onRestored();
    } catch (err) {
      toast({ title: 'Não foi possível restaurar', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-destructive" />
          <h3 className="font-semibold">Usuários excluídos (lixeira)</h3>
        </div>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => { setOpen(true); load(); }} disabled={loading}>
          <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
          {open ? 'Atualizar' : 'Ver excluídos'}
        </Button>
      </div>
      {open && !loading && items.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum usuário na lixeira.</p>
      )}
      {open && items.map((item) => (
        <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2 border rounded-md p-3">
          <div className="space-y-1">
            <p className="font-medium">{item.username}</p>
            <p className="text-xs text-muted-foreground">
              {item.email || 'sem e-mail'} · excluído em {new Date(item.deleted_at).toLocaleString('pt-BR')}
            </p>
            <div className="flex flex-wrap gap-1">
              {(item.accounts || []).map((a) => (
                <Badge key={a.instagram_username} variant="secondary">@{a.instagram_username}</Badge>
              ))}
            </div>
          </div>
          <Button size="sm" className="gap-2" disabled={busy === item.id} onClick={() => restore(item)}>
            <RotateCcw className="w-4 h-4" /> Restaurar usuário e acessos
          </Button>
        </div>
      ))}
    </Card>
  );
};

export default MroDeletedUsersCard;
