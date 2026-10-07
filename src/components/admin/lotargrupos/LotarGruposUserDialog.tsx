import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

export interface LotarUser { id: string; name: string; email: string }

interface Props {
  user: LotarUser;
  onClose: () => void;
  onSaved: () => void;
  invokeAdmin: (action: string, payload?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

/** Edita nome, e-mail e senha do aluno e reenvia os dados de acesso por e-mail. */
export function LotarGruposUserDialog({ user, onClose, onSaved, invokeAdmin }: Props) {
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [password, setPassword] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await invokeAdmin("admin_set_credentials", { id: user.id, name, email, password, send_email: sendEmail });
      const sent = res.email_sent === true;
      toast({
        title: "Aluno atualizado!",
        description: password && sendEmail
          ? (sent ? "E-mail com os dados de acesso enviado." : "Salvo, mas o e-mail não pôde ser enviado.")
          : undefined,
        variant: password && sendEmail && !sent ? "destructive" : undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: "Erro ao salvar", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Editar aluno</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><Label>E-mail (usado para entrar no dashboard)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div>
            <Label>Nova senha</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Deixe vazio para manter a atual" minLength={6} maxLength={72} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} disabled={!password} />
            Enviar e-mail e senha para o aluno
          </label>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
