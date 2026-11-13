import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getCurrentUser, logoutUser, loginUser } from "@/lib/userStorage";
import { loginToSquare } from "@/lib/squareApi";
import AffiliateResumo from "./AffiliateResumo";
import { getAffiliateCredentials, type AffiliateCredentials } from "@/lib/affiliateSession";
import type { MROUser } from "@/types/user";
import {
  ArrowRight, Camera, CheckCircle2, Copy, DollarSign, Eye, LayoutDashboard,
  Loader2, LogOut, Lock, Sparkles, TrendingUp, User as UserIcon, KeyRound,
} from "lucide-react";

interface CreatedAffiliate {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  pixKey?: string;
  links: {
    promo: string;
    promoRendaExtra: string;
    dashboard: string;
  };
}

async function readFnError(error: any, fallback: string): Promise<string> {
  try {
    const res = error?.context;
    if (res && typeof res.json === "function") {
      const body = await res.clone().json().catch(async () => ({ error: await res.text() }));
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    }
  } catch { /* ignore */ }
  return fallback;
}

export default function AfiliadosX() {
  const navigate = useNavigate();
  const [user, setUser] = useState<MROUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [created, setCreated] = useState<CreatedAffiliate | null>(null);
  const [credentials, setCredentials] = useState<AffiliateCredentials | null>(null);
  const [pixKey, setPixKey] = useState("");
  const [savingPix, setSavingPix] = useState(false);
  const [showResumo, setShowResumo] = useState(false);
  const [sendingWelcome, setSendingWelcome] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    desired_id: "",
    email: "",
    show_promo_banner: true,
    photo_url: "" as string,
  });

  const lookupExistingAffiliate = async (username: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("afiliadosx", {
        body: { action: "lookup", ...getAffiliateCredentials(username) },
      });
      if (error) return null;
      if (data?.success && data.affiliate) return data.affiliate as CreatedAffiliate;
      return null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      const current = await getCurrentUser();
      const access = getAffiliateCredentials(current?.username);
      setCredentials(access);
      const u = current || (access ? { username: access.squarecloud_username } as MROUser : null);
      setUser(u);
      if (u) {
        // Check if this MRO user is already an affiliate — if so, auto-open dashboard
        const existing = await lookupExistingAffiliate(u.username);
        if (existing) {
          setCreated(existing);
          setPixKey(existing.pixKey || "");
          setChecking(false);
          return;
        }
        setForm(f => ({
          ...f,
          first_name: f.first_name || (u.username || ""),
          desired_id: f.desired_id || (u.username || "").toLowerCase(),
        }));

      }
      setChecking(false);
    })();
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    toast.info("Sessão encerrada. Faça login novamente em /instagram.");
    navigate("/instagram");
  };

  const handlePhotoPick = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Envie uma imagem válida");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 3MB)");
      return;
    }
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `afiliadosx/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("assets").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("assets").getPublicUrl(path);
      setPhotoPreview(data.publicUrl);
      setForm(f => ({ ...f, photo_url: data.publicUrl }));
    } catch (e: any) {
      toast.error("Falha no upload: " + (e?.message || "erro"));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const submit = async () => {
    if (!user) return;
    if (!form.first_name.trim()) return toast.error("Informe seu nome");
    if (!form.email.includes("@")) return toast.error("Email inválido");
    if (form.desired_id.trim().length < 3) return toast.error("Informe o identificador do link (mínimo 3 letras/números)");
    if (!credentials) return toast.error("Seu acesso expirou. Entre novamente na ferramenta MRO.");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("afiliadosx", {
        body: {
          action: "register",
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          desired_id: form.desired_id.trim(),
          email: form.email.trim().toLowerCase(),
          ...credentials,
          photo_url: form.photo_url || null,
          show_promo_banner: form.show_promo_banner,
        },
      });
      if (error) throw new Error(await readFnError(error, "Erro ao cadastrar"));
      if (!data?.success) throw new Error(data?.error || "Erro ao cadastrar");
      setCreated(data.affiliate as CreatedAffiliate);
      if (data.welcomeEmailSent) toast.success("Afiliado ativado! Boas-vindas enviadas ao seu e-mail.");
      else toast.warning("Afiliado ativado e links salvos, mas o e-mail não foi enviado. Use Reenviar boas-vindas.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copiado"));
  };

  // -------- Not logged in gate --------
  if (checking) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  if (!user || !credentials) {
    return (
      <InlineLogin
        onSuccess={async (u) => {
          setUser(u);
          setCredentials(getAffiliateCredentials(u.username));
          // Immediately try to detect existing affiliate for this MRO user
          const existing = await lookupExistingAffiliate(u.username);
          if (existing) { setCreated(existing); setPixKey(existing.pixKey || ""); }
        }}
      />
    );
  }

  // -------- Success view --------
  if (created) {
    const base = window.location.origin;
    const items = [
      { label: "Link principal (Instagram PRO)", href: base + created.links.promo },
      { label: "Link Renda Extra", href: base + created.links.promoRendaExtra },
    ];
    return (
      <div className="min-h-screen bg-black text-white px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/40 p-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h1 className="text-3xl font-black mb-2">Você é oficialmente afiliado(a) MRO 🎉</h1>
            <p className="text-zinc-400 text-sm">
              Seus links estão disponíveis abaixo. Acompanhe suas vendas com o acesso da ferramenta MRO.
            </p>
          </Card>

          <Button
            onClick={() => setShowResumo(v => !v)}
            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-black font-black text-lg py-8 shadow-xl shadow-yellow-500/20"
          >
            <LayoutDashboard className="w-6 h-6 mr-3" />
            {showResumo ? "Fechar resumo" : "Ver resumo de vendas"}
            <ArrowRight className="w-6 h-6 ml-3" />
          </Button>

          {showResumo && credentials && <AffiliateResumo embeddedAffiliateId={created.id} credentials={credentials} />}

          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
            <p className="text-sm text-muted-foreground break-all">E-mail de recebimento: {created.email}</p>
            <Button variant="outline" disabled={sendingWelcome || !credentials} onClick={async () => {
              if (!credentials) return;
              setSendingWelcome(true);
              try {
                const { data, error } = await supabase.functions.invoke("afiliadosx", { body: { action: "resend_welcome", ...credentials } });
                if (error || !data?.success) throw new Error(data?.error || "Não foi possível enviar agora. Tente novamente.");
                toast.success("Boas-vindas enviadas ao seu e-mail!");
              } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível enviar o e-mail."); }
              finally { setSendingWelcome(false); }
            }}>{sendingWelcome ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Reenviar boas-vindas</Button>
          </div>

          <section className="border-y border-border py-6 space-y-3">
            <Label htmlFor="affiliate-pix">Chave Pix para receber comissões</Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input id="affiliate-pix" value={pixKey} maxLength={255} onChange={e => setPixKey(e.target.value)} placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória" />
              <Button disabled={savingPix || !pixKey.trim() || !credentials} onClick={async () => {
                if (!credentials) return;
                setSavingPix(true);
                try {
                  const { data, error } = await supabase.functions.invoke("afiliadosx", { body: { action: "save_pix", ...credentials, pix_key: pixKey.trim() } });
                  if (error) throw new Error(await readFnError(error, "Não foi possível salvar a chave Pix"));
                  if (!data?.success) throw new Error(data?.error || "Não foi possível salvar a chave Pix");
                  setPixKey(data.pixKey);
                  toast.success("Chave Pix salva!");
                } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar Pix"); }
                finally { setSavingPix(false); }
              }}>{savingPix ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Pix"}</Button>
            </div>
          </section>

          <Card className="bg-zinc-950 border-yellow-500/40 p-6 space-y-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500 font-black">Suas comissões por venda aprovada</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-yellow-400">Plano Vitalício</p>
                <p className="text-zinc-400 text-xs mt-1">Cliente paga R$ 1.197</p>
                <p className="text-3xl font-black text-green-400 mt-2">R$ 197</p>
                <p className="text-[11px] text-zinc-500">de comissão para você</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black p-4">
                <p className="text-xs font-black uppercase tracking-widest text-yellow-400">Plano Anual</p>
                <p className="text-zinc-400 text-xs mt-1">Cliente paga R$ 397</p>
                <p className="text-3xl font-black text-green-400 mt-2">R$ 97</p>
                <p className="text-[11px] text-zinc-500">de comissão para você</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">Os dois planos podem ser vendidos pelos mesmos links abaixo. Cada venda aprovada aparece em tempo real no seu Dashboard com o plano e a comissão correspondente.</p>
          </Card>

          <Card className="bg-zinc-950 border-zinc-800 p-6 space-y-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500 font-black">Seus links de divulgação</p>
            {items.map(it => (
              <div key={it.href} className="space-y-1">
                <p className="text-xs text-zinc-400">{it.label}</p>
                <div className="flex gap-2">
                  <Input readOnly value={it.href} className="bg-black border-zinc-800 text-yellow-400 text-xs" />
                  <Button size="sm" variant="outline" onClick={() => copy(it.href)} className="border-yellow-500/40">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </Card>

          <Button variant="outline" asChild className="w-full border-zinc-700">
            <Link to="/dashboard">Voltar para dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // -------- Registration form --------
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top bar with logged-in badge + logout */}
      <div className="w-full border-b border-zinc-900 bg-zinc-950/60 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-zinc-400">Logado como</span>
            <span className="text-yellow-400 font-black">{user.username}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-red-500/10" />
        <div className="relative max-w-5xl mx-auto px-4 py-14 text-center">
          <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-1.5 mb-6">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-black uppercase tracking-widest text-yellow-400">Exclusivo para clientes MRO</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black leading-[1.05] mb-4">
            Ganhe até <span className="text-yellow-400">R$ 197</span> por venda<br />aprovada como afiliado(a)
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto text-base md:text-lg">
            Você já usa a ferramenta — divulgue, receba R$ 197 no plano Vitalício e R$ 97 no plano Anual, e acompanhe tudo em tempo real no seu painel.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-5xl mx-auto px-4 pb-10 grid md:grid-cols-3 gap-4">
        {[
          { icon: DollarSign, title: "Duas comissões", desc: "R$ 197 por Vitalício (R$ 1.197) e R$ 97 por Anual (R$ 397) aprovado no seu link." },
          { icon: Eye,        title: "100% transparente", desc: "Você vê em tempo real tentativas e vendas aprovadas." },
          { icon: TrendingUp, title: "Dois links prontos", desc: "Instagram PRO e Renda Extra — divulgue onde quiser." },
        ].map(b => (
          <Card key={b.title} className="bg-zinc-950 border-zinc-800 p-5">
            <b.icon className="w-6 h-6 text-yellow-400 mb-3" />
            <p className="font-black mb-1">{b.title}</p>
            <p className="text-xs text-zinc-500 leading-relaxed">{b.desc}</p>
          </Card>
        ))}
      </section>

      {/* Form */}
      <section className="max-w-2xl mx-auto px-4 pb-20">
        <Card className="bg-zinc-950 border-yellow-500/30 p-6 md:p-8 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <UserIcon className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-black">Ativar meu cadastro</h2>
          </div>

          {/* Photo */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden">
              {photoPreview ? (
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-6 h-6 text-zinc-600" />
              )}
            </div>
            <div className="flex-1">
              <Label className="text-xs uppercase tracking-widest text-zinc-500 font-black">Foto (opcional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoPick(f); }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 border-zinc-700"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : "Escolher foto"}
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-500 font-black">Nome</Label>
              <Input
                value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                className="bg-black border-zinc-800 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-500 font-black">Sobrenome</Label>
              <Input
                value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                className="bg-black border-zinc-800 mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-zinc-500 font-black">Identificador do link *</Label>
            <Input
              value={form.desired_id}
              onChange={e => setForm(f => ({ ...f, desired_id: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") }))}
              placeholder="ex.: joao"
              required
              className="bg-black border-zinc-800 mt-1"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Seus links serão <span className="text-yellow-400">/promo/{form.desired_id || "seuid"}</span> e <span className="text-yellow-400">/promorendaextra/{form.desired_id || "seuid"}</span>
            </p>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-zinc-500 font-black">Email para receber comissões</Label>
            <Input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="bg-black border-zinc-800 mt-1"
            />
          </div>

          {/* Photo/name visibility toggle */}
          <div className="flex items-start justify-between gap-4 p-4 bg-black rounded-lg border border-zinc-800">
            <div className="flex-1">
              <p className="text-sm font-black">Mostrar minha foto e nome nos meus links</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Quando ligado, quem abrir seu link verá seu nome e foto como indicação. Você pode alterar isso depois no dashboard.
              </p>
            </div>
            <Switch
              checked={form.show_promo_banner}
              onCheckedChange={(v) => setForm(f => ({ ...f, show_promo_banner: v }))}
            />
          </div>


          <Button
            onClick={submit}
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black text-base py-6"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>Ativar meu cadastro <ArrowRight className="w-5 h-5 ml-2" /></>
            )}
          </Button>
        </Card>
      </section>
    </div>
  );
}

function InlineLogin({ onSuccess }: { onSuccess: (u: MROUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Preencha usuário e senha");
      return;
    }
    setLoading(true);
    try {
      const result = await loginToSquare(username.trim(), password.trim());
      if (!result.success) {
        toast.error(result.error || "Credenciais inválidas");
        return;
      }
      const session = await loginUser(
        username.trim(),
        result.daysRemaining || 365,
        undefined,
        password.trim()
      );
      if (session?.user) {
        toast.success("Login realizado!");
        onSuccess(session.user);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-1.5 mb-4">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Programa de Afiliados MRO</span>
          </div>
          <h1 className="text-3xl font-black mb-2">
            Faça seu <span className="text-yellow-400">login</span> ou cadastre-se como afiliado
          </h1>
          <p className="text-zinc-400 text-sm">
            Entre com seu acesso da ferramenta MRO Instagram e cadastre-se como afiliado.
            <span className="block mt-2 text-yellow-400/90 text-xs">
              Só clientes ativos da ferramenta podem acessar essa área.
            </span>
          </p>
        </div>

        <Card className="bg-zinc-950 border-yellow-500/30 p-6 md:p-7">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-500 font-black">Usuário MRO</Label>
              <div className="relative mt-1">
                <UserIcon className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="seu usuário"
                  autoComplete="username"
                  className="bg-black border-zinc-800 pl-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-500 font-black">Senha</Label>
              <div className="relative mt-1">
                <KeyRound className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="sua senha"
                  autoComplete="current-password"
                  className="bg-black border-zinc-800 pl-9"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black text-base py-6"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Entrar e continuar <ArrowRight className="w-5 h-5 ml-2" /></>
              )}
            </Button>
          </form>

          <div className="mt-5 pt-5 border-t border-zinc-900 text-center">
            <p className="text-[11px] text-zinc-500 mb-2">Ainda não é cliente MRO?</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/ferramentamropromo")}
              className="border-zinc-700 text-xs"
            >
              <Lock className="w-3 h-3 mr-2" />
              Ver planos em /ferramentamropromo
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
