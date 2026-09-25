import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { markHubReturn } from "@/lib/hubReturn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import PlanExpiredOverlay from "@/components/PlanExpiredOverlay";
import { Loader2, Lock, LogIn, LogOut, ArrowRight, ShoppingCart, Eye, Package, Settings, Mail, KeyRound, AlertCircle, RefreshCw } from "lucide-react";


const API_TIMEOUT_MS = 30_000; // 30 segundos

/**
 * Invoca uma Edge Function com timeout. Se estourar, rejeita com erro claro.
 */
async function invokeWithTimeout<T extends Record<string, any> = Record<string, any>>(
  fn: "hub-api" | "mro-tool-api",
  body: Record<string, unknown>,
  timeoutMs = API_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { data, error } = await supabase.functions.invoke<T>(fn, {
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (error) throw error;
    return data as T;
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tempo esgotado — o servidor demorou demais para responder. Tente novamente.");
    }
    throw err;
  }
}

export const DASHBOARD_SESSION_KEY = "mro_dashboard_session";

export interface DashboardSession {
  username: string | null;
  email: string | null;
  name: string | null;
  password: string;
}

export interface HubProduct {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumb_url: string | null;
  app_route: string | null;
  sales_page_url: string | null;
  price: number;
  access_source: string;
  is_redirect_only?: boolean;
  unlocked: boolean;
  status?: 'active' | 'construction';
  order_index?: number;
  is_pinned?: boolean;
  new_until?: string | null;
  badge_text?: string | null;
  is_ebook_hub?: boolean;
}


export function getDashboardSession(): DashboardSession | null {
  try {
    const raw = localStorage.getItem(DASHBOARD_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardSession;
    if (!parsed?.username && !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState<DashboardSession | null>(() => getDashboardSession());
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [products, setProducts] = useState<HubProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const [lockedProduct, setLockedProduct] = useState<HubProduct | null>(null);
  const [showBuyForm, setShowBuyForm] = useState(false);
  const [buyName, setBuyName] = useState("");
  const [buyEmail, setBuyEmail] = useState("");
  const [buyPhone, setBuyPhone] = useState("");
  const [buying, setBuying] = useState(false);

  // ---- Perfil / Configurações ----
  interface HubProfile {
    username: string;
    email: string;
    name: string;
    whatsapp: string;
    has_email: boolean;
  }
  const [profile, setProfile] = useState<HubProfile | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formWhats, setFormWhats] = useState("");
  const [formNewPassword, setFormNewPassword] = useState("");
  const [formConfirmPassword, setFormConfirmPassword] = useState("");

  // ---- Recuperar acesso ----
  const [showRecover, setShowRecover] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recovering, setRecovering] = useState(false);

  // Unificação de acessos quando o e-mail já pertence a outro login
  const [mergeEmail, setMergeEmail] = useState("");
  const [mergeConflicts, setMergeConflicts] = useState<{ tool: string; username: string; current?: boolean }[]>([]);
  const [mergePrimary, setMergePrimary] = useState("");
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<{
    email: string;
    emailSent: boolean;
    primary: { username: string; password: string };
    accounts: { tool: string; username: string; password: string }[];
  } | null>(null);

  const profileNameIsComplete = (value: string | null | undefined) => (value || "").trim().length >= 3;
  const profileWhatsIsComplete = (value: string | null | undefined) => (value || "").replace(/\D/g, "").length >= 10;

  const loadProfile = useCallback(async (current: DashboardSession) => {
    try {
      const data = await invokeWithTimeout("hub-api", {
        action: "profile",
        username: current.username || "",
        email: current.email || "",
        password: current.password,
      });
      if (data?.success && data.profile) {
        const p = data.profile as HubProfile;
        setProfile(p);
        setFormName(p.name || current.name || "");
        setFormEmail(p.email || "");
        setFormWhats(p.whatsapp || "");
        const nameOk = profileNameIsComplete(p.name || current.name);
        const whatsOk = profileWhatsIsComplete(p.whatsapp);
        setNeedsEmail(!p.email || !nameOk || !whatsOk);
      }
    } catch {
      /* silencioso: o dashboard continua funcionando sem o perfil */
    }
  }, []);


  const loadProducts = useCallback(async (current: DashboardSession) => {
    setLoading(true);
    setLoadingError(null);
    try {
      const data = await invokeWithTimeout("hub-api", {
        action: "products",
        username: current.username || "",
        email: current.email || "",
      });
      if (data?.success) {
        const list = data.products as HubProduct[];
        const sorted = [...list].sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          const orderA = a.order_index ?? 0;
          const orderB = b.order_index ?? 0;
          if (orderA !== orderB) return orderA - orderB;
          return a.title.localeCompare(b.title);
        });
        setProducts(sorted);
        const identity = data.identity as { email?: string | null; username?: string | null } | undefined;
        if (identity && ((identity.email && !current.email) || (identity.username && !current.username))) {
          const merged: DashboardSession = {
            ...current,
            email: current.email || identity.email || null,
            username: current.username || identity.username || null,
          };
          localStorage.setItem(DASHBOARD_SESSION_KEY, JSON.stringify(merged));
          setSession(merged);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar seus produtos.";
      setLoadingError(msg);
      toast({ title: "Erro ao carregar produtos", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);


  /**
   * Plano com prazo (ex.: 30 dias vendidos em /renddx). Quando expira, o backend
   * é a fonte da verdade e a dashboard inteira fica bloqueada por um popup.
   */
  const [planExpired, setPlanExpired] = useState<{ expires_at: string | null; whatsapp: string } | null>(null);

  const checkPlanStatus = useCallback(async (current: DashboardSession) => {
    try {
      const data = await invokeWithTimeout(
        "mro-tool-api",
        {
          action: "plan_status",
          username: current.username || "",
          email: current.email || "",
        },
        20_000 // timeout menor para status — 20s é suficiente
      );
      if (data?.success && data.found && data.expired) {
        setPlanExpired({
          expires_at: data.expires_at ?? null,
          whatsapp:
            data.whatsapp ||
            "https://wa.me/555192835863?text=" +
              encodeURIComponent("Olá vim pelo renda extra, já usei 30 dias gostaria de saber sobre o desconto."),
        });
      } else {
        setPlanExpired(null);
      }
    } catch {
      /* falha de rede não deve bloquear a dashboard */
      setPlanExpired(null);
    }
  }, []);

  useEffect(() => {
    if (session) {
      loadProducts(session);
      loadProfile(session);
      checkPlanStatus(session);
    }
  }, [session, loadProducts, loadProfile, checkPlanStatus]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      toast({ title: "Preencha usuário/e-mail e senha", variant: "destructive" });
      return;
    }
    setLoggingIn(true);
    setLoginError(null);
    try {
      const data = await invokeWithTimeout("hub-api", {
        action: "login",
        identifier: identifier.trim(),
        password,
      });
      if (data?.success) {
        const next: DashboardSession = {
          username: data.user.username || null,
          email: data.user.email || null,
          name: data.user.name || null,
          password,
        };
        localStorage.setItem(DASHBOARD_SESSION_KEY, JSON.stringify(next));
        setSession(next);
      } else {
        const errMsg = data?.error || "Não foi possível entrar. Verifique usuário e senha.";
        setLoginError(errMsg);
        toast({ title: errMsg, variant: "destructive" });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Erro ao conectar. Tente novamente.";
      setLoginError(errMsg);
      toast({ title: "Erro de conexão", description: errMsg, variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(DASHBOARD_SESSION_KEY);
    setSession(null);
    setProducts([]);
    setProfile(null);
    setNeedsEmail(false);
    setLoadingError(null);
    setLoginError(null);
  };

  /**
   * Salva os dados do cliente (nome, e-mail, WhatsApp e senha) no banco.
   */
  const saveProfile = async (requireEmail: boolean) => {
    if (!session) return;
    const email = formEmail.trim().toLowerCase();
    if ((requireEmail || email) && !email.includes("@")) {
      toast({ title: "Informe um e-mail válido", variant: "destructive" });
      return;
    }
    const nameValue = formName.trim();
    const whatsDigits = formWhats.replace(/\D/g, "");
    if (requireEmail) {
      if (nameValue.length < 3) {
        toast({ title: "Informe seu nome completo", variant: "destructive" });
        return;
      }
      if (whatsDigits.length < 10 || whatsDigits.length > 13) {
        toast({ title: "Informe um WhatsApp válido com DDD", variant: "destructive" });
        return;
      }
    }
    if (formNewPassword && formNewPassword !== formConfirmPassword) {
      toast({ title: "As senhas não conferem", variant: "destructive" });
      return;
    }
    setSavingProfile(true);
    try {
      const data = await invokeWithTimeout("hub-api", {
        action: "update_profile",
        username: session.username || "",
        email: session.email || "",
        password: session.password,
        new_email: email,
        new_name: formName.trim(),
        new_whatsapp: formWhats,
        new_password: formNewPassword || undefined,
      });
      if (!data?.success) {
        if (data?.conflict) {
          setMergeEmail(email);
          const list = Array.isArray(data.conflict_accounts) ? data.conflict_accounts : [];
          setMergeConflicts(list);
          setMergePrimary(
            list.find((c: { current?: boolean }) => c.current)?.username || session.username || list[0]?.username || "",
          );
          return;
        }
        toast({ title: data?.error || "Não foi possível salvar", variant: "destructive" });
        return;
      }
      const next: DashboardSession = {
        username: session.username || (data.profile as { username?: string })?.username || null,
        email: (data.profile as { email?: string })?.email || email || session.email,
        name: (data.profile as { name?: string })?.name || formName.trim() || session.name,
        password: (data.password as string) || session.password,
      };
      localStorage.setItem(DASHBOARD_SESSION_KEY, JSON.stringify(next));
      setSession(next);
      setProfile((prev) =>
        prev
          ? { ...prev, email: next.email || "", name: next.name || "", whatsapp: formWhats, has_email: !!next.email }
          : prev,
      );
      setFormNewPassword("");
      setFormConfirmPassword("");
      setNeedsEmail(false);
      setShowConfig(false);
      toast({ title: "Dados salvos com sucesso" });
    } catch {
      toast({ title: "Erro ao salvar seus dados", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  /**
   * Unifica todos os acessos do cliente no mesmo e-mail e dispara o resumo por e-mail.
   */
  const handleMerge = async () => {
    if (!session || !mergeEmail) return;
    setMerging(true);
    try {
      const data = await invokeWithTimeout("hub-api", {
        action: "merge_accounts",
        username: session.username || "",
        email: session.email || "",
        password: session.password,
        target_email: mergeEmail,
        primary_username: mergePrimary || mergeConflicts[0]?.username || session.username || "",
        new_name: formName.trim(),
        new_whatsapp: formWhats,
      });
      if (!data?.success) {
        toast({ title: data?.error || "Não foi possível unificar", variant: "destructive" });
        return;
      }
      const normalizedWhats = formWhats.replace(/\D/g, "");
      const next: DashboardSession = {
        ...session,
        email: data.email || mergeEmail,
        name: (data.profile as { name?: string })?.name || formName.trim() || session.name,
      };
      localStorage.setItem(DASHBOARD_SESSION_KEY, JSON.stringify(next));
      setSession(next);
      setProfile((prev) => ({
        username: prev?.username || session.username || ((data.primary as { username?: string })?.username) || "",
        email: data.email || mergeEmail,
        name: (data.profile as { name?: string })?.name || formName.trim() || prev?.name || "",
        whatsapp: (data.profile as { whatsapp?: string })?.whatsapp || normalizedWhats || prev?.whatsapp || "",
        has_email: true,
      }));
      setFormName((data.profile as { name?: string })?.name || formName.trim());
      setFormWhats((data.profile as { whatsapp?: string })?.whatsapp || normalizedWhats);
      setFormEmail(data.email || mergeEmail);
      setNeedsEmail(false);
      setShowConfig(false);
      setMergeConflicts([]);
      setMergeResult({
        email: data.email || mergeEmail,
        emailSent: !!data.emailSent,
        primary: data.primary || { username: session.username || "", password: session.password },
        accounts: Array.isArray(data.accounts) ? data.accounts : [],
      });
    } catch {
      toast({ title: "Erro ao unificar seus acessos", variant: "destructive" });
    } finally {
      setMerging(false);
    }
  };

  /** Envia um único lembrete de acesso para o e-mail vinculado ao cliente. */
  const handleRecover = async () => {
    const email = recoverEmail.trim().toLowerCase();
    if (!email.includes("@")) {
      toast({ title: "Informe um e-mail válido", variant: "destructive" });
      return;
    }
    setRecovering(true);
    try {
      const data = await invokeWithTimeout("hub-api", { action: "recover_access", email });
      if (data?.success) {
        toast({ title: "Enviamos seu acesso", description: `Confira a caixa de entrada de ${email}.` });
        setShowRecover(false);
        setRecoverEmail("");
      } else {
        toast({ title: data?.error || "Não foi possível recuperar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao recuperar acesso", variant: "destructive" });
    } finally {
      setRecovering(false);
    }
  };

  /**
   * Abre o produto já autenticado.
   */
  const openProduct = async (product: HubProduct) => {
    if (!session) return;
    setOpening(product.id);
    try {
      if (product.access_source === "mro_tool" && session.username) {
        const { loginToSquare } = await import("@/lib/squareApi");
        const { loginUser } = await import("@/lib/userStorage");
        try {
          const result = await loginToSquare(session.username, session.password);
          if (result.success) {
            await loginUser(session.username, result.daysRemaining || 365, session.email || undefined, session.password);
          }
        } catch {
          /* segue para a tela de login da ferramenta se falhar */
        }
      }

      if (product.access_source === "zapmro" && session.username) {
        localStorage.setItem("zapmro_authenticated", "true");
        localStorage.setItem("zapmro_username", session.username);
        localStorage.setItem("zapmro_password", session.password);
        if (session.email) localStorage.setItem("zapmro_email", session.email);
      }

      if (product.access_source === "postscomia" || product.slug === "postscomia") {
        let memberEmail = session.email;
        if (!memberEmail) {
          try {
            const data = await invokeWithTimeout("hub-api", {
              action: "products",
              username: session.username || "",
              email: "",
            });
            memberEmail = (data?.identity?.email as string | undefined) || null;
          } catch {
            /* segue com o fallback por usuário */
          }
        }
        const memberName = session.name || memberEmail || session.username || "Aluno";
        localStorage.setItem(
          "postscomia_member",
          JSON.stringify({
            email: memberEmail || "",
            name: memberName,
            username: session.username || null,
            via_hub: true,
          }),
        );
      }

      const isLotarGrupos =
        product.access_source === "lotargrupos" ||
        product.slug === "lotar-grupos" ||
        product.slug === "lotargrupos";

      if (isLotarGrupos) {
        const identifier = session.username || session.email;
        if (!identifier) {
          toast({ title: "Não foi possível identificar seu acesso", variant: "destructive" });
          return;
        }

        let ssoData: Record<string, any>;
        try {
          ssoData = await invokeWithTimeout("hub-api", {
            action: "login",
            identifier,
            password: session.password,
            issue_lotargrupos_sso: true,
            lotargrupos_product_id: product.id,
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "O servidor não respondeu.";
          toast({
            title: "Não foi possível abrir o Lotar Grupos",
            description: message,
            variant: "destructive",
          });
          return;
        }

        const tokenHash = typeof ssoData?.lotargrupos_token_hash === "string"
          ? ssoData.lotargrupos_token_hash
          : "";

        if (!ssoData?.success || !tokenHash) {
          toast({
            title: "Não foi possível abrir o Lotar Grupos",
            description:
              typeof ssoData?.lotargrupos_sso_error === "string"
                ? ssoData.lotargrupos_sso_error
                : typeof ssoData?.error === "string"
                  ? ssoData.error
                  : "A atualização do acesso ainda não chegou ao servidor.",
            variant: "destructive",
          });
          return;
        }

        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "magiclink",
        });

        if (verifyError) {
          toast({ title: "Falha ao iniciar sua sessão", variant: "destructive" });
          return;
        }

        markHubReturn();
        navigate("/lotargrupos/dashboard");
        return;
      }

      markHubReturn();

      if (product.app_route && product.app_route !== "/dashboard") {
        navigate(product.app_route);
      } else {
        navigate(`/dashboard/produto/${product.slug}`);
      }

    } finally {
      setOpening(null);
    }
  };

  const handleCardClick = (product: HubProduct) => {
    if (product.slug === 'lotar-grupos' || product.slug === 'lotargrupos') {
      if (product.unlocked) {
        void openProduct(product);
      } else {
        navigate('/lotargrupos');
      }
      return;
    }

    if (product.status === 'construction') {
      toast({
        title: "Em Construção 🚧",
        description: "Este produto está sendo finalizado e estará disponível em breve.",
        variant: "default"
      });
      return;
    }

    if (product.is_redirect_only) {
      if (product.sales_page_url) {
        window.open(product.sales_page_url, "_blank");
      }
      return;
    }

    if (product.unlocked) {
      if (product.app_route) void openProduct(product);
      else {
        markHubReturn();
        navigate(`/dashboard/produto/${product.slug}`);
      }
      return;
    }
    setBuyName(session?.name || "");
    setBuyEmail(session?.email || "");
    setBuyPhone("");
    setLockedProduct(product);
  };

  const handleBuy = async () => {
    if (!lockedProduct) return;
    if (!buyName.trim() || !buyEmail.includes("@")) {
      toast({ title: "Informe nome e e-mail válidos", variant: "destructive" });
      return;
    }
    setBuying(true);
    try {
      const data = await invokeWithTimeout("hub-api", {
        action: "create_checkout",
        slug: lockedProduct.slug,
        name: buyName.trim(),
        email: buyEmail.trim().toLowerCase(),
        whatsapp: buyPhone,
      });
      if (data?.success && (data as { payment_link?: string }).payment_link) {
        window.open((data as { payment_link: string }).payment_link, "_blank");
        toast({ title: "Pagamento gerado", description: "Assim que confirmado o acesso é liberado automaticamente." });
        setLockedProduct(null);
      } else {
        toast({ title: (data as { error?: string }).error || "Erro ao gerar pagamento", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao gerar pagamento", variant: "destructive" });
    } finally {
      setBuying(false);
    }
  };

  const greeting = useMemo(() => session?.name || session?.username || session?.email || "", [session]);

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard MRO</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Entre com seu usuário ou e-mail para acessar todos os seus produtos em um só lugar.
              </p>
            </div>

            {/* Erro visível no login */}
            {loginError && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Usuário ou e-mail</Label>
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setLoginError(null); }}
                  placeholder="seu usuário ou e-mail"
                  autoComplete="username"
                  disabled={loggingIn}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setLoginError(null); }}
                  placeholder="sua senha"
                  autoComplete="current-password"
                  disabled={loggingIn}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loggingIn}>
                {loggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {loggingIn ? "Entrando..." : "Entrar"}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                onClick={() => setShowRecover(true)}
              >
                Esqueci minha senha
              </button>
            </form>
          </CardContent>
        </Card>

        <Dialog open={showRecover} onOpenChange={setShowRecover}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Recuperar acesso</DialogTitle>
              <DialogDescription>
                Informe o e-mail cadastrado. Enviamos um único lembrete com seu acesso — ele vale para todos os seus produtos.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="recover-email">E-mail de acesso</Label>
                <Input
                  id="recover-email"
                  type="email"
                  value={recoverEmail}
                  onChange={(e) => setRecoverEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                />
              </div>
              <Button className="w-full" onClick={handleRecover} disabled={recovering}>
                {recovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Enviar meu acesso
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      {planExpired && (
        <PlanExpiredOverlay
          whatsappLink={planExpired.whatsapp}
          displayName={session?.name || session?.username || null}
          expiredAt={planExpired.expires_at}
          onLogout={handleLogout}
        />
      )}
      <div className="bg-warning text-warning-foreground text-center py-2.5 px-4 text-sm font-medium">
        Estamos atualizando nossa área e incluindo novidades. Pode utilizar normalmente.
      </div>
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Seus produtos</h1>
            <p className="text-sm text-muted-foreground">Olá, {greeting}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
              <Settings className="h-4 w-4" /> Config
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Estado de carregamento com spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carregando seus produtos…</p>
          </div>
        ) : loadingError ? (
          /* Estado de erro com mensagem e botão de tentar novamente */
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">{loadingError}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoadingError(null);
                  loadProducts(session);
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">Nenhum produto disponível no momento.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Card
                key={product.id}
                className={cn(
                  "overflow-hidden transition-all duration-300",
                  product.status === 'construction' ? "opacity-75 grayscale-[0.3]" : "cursor-pointer hover:shadow-lg"
                )}
                onClick={() => handleCardClick(product)}
              >
                <div className="relative aspect-video bg-muted">
                  {product.is_pinned && (
                    <div className="absolute top-2 left-2 z-10">
                      <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-none px-2 py-0.5 shadow-lg font-black text-[10px] uppercase tracking-tighter">
                        FIXADO
                      </Badge>
                    </div>
                  )}
                  {product.new_until && new Date(product.new_until) > new Date() && (
                    <div className="absolute top-2 right-2 z-10">
                      <Badge className="bg-[#facc15] hover:bg-[#eab308] text-black border-none px-2 py-0.5 shadow-lg font-black text-[10px] uppercase tracking-tighter animate-pulse">
                        NOVO
                      </Badge>
                    </div>
                  )}
                  {product.badge_text && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-yellow-400 hover:bg-yellow-500 text-black border-none px-2 py-0.5 shadow-lg font-black text-[10px] uppercase tracking-tighter">
                        {product.badge_text}
                      </Badge>
                    </div>
                  )}
                  {product.thumb_url ? (
                    <img src={product.thumb_url} alt={product.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Package className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}

                  {!product.unlocked && product.status !== 'construction' && !product.is_redirect_only && (
                    <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center">
                      <Lock className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  {product.status === 'construction' && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                      <div className="text-center p-4">
                        <Settings className="h-8 w-8 text-white mx-auto mb-2 animate-spin-slow" />
                        <p className="text-white font-black text-xs uppercase tracking-tighter">Em Construção</p>
                      </div>
                    </div>
                  )}
                </div>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-foreground">{product.title}</h2>
                    <Badge variant={product.status === 'construction' ? "destructive" : (product.unlocked ? "default" : "secondary")}>
                      {product.status === 'construction' ? "Em Construção" : (product.unlocked ? "Liberado" : "Bloqueado")}
                    </Badge>
                  </div>
                  {product.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{product.description}</p>
                  )}
                  <Button
                    className="w-full mt-2"
                    variant={product.status === 'construction' ? "outline" : (product.unlocked || product.is_redirect_only ? "default" : "secondary")}
                    disabled={opening === product.id || product.status === 'construction'}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (product.is_redirect_only) {
                        if (product.sales_page_url) window.open(product.sales_page_url as string, "_blank");
                      } else if (product.unlocked) {
                        openProduct(product);
                      } else {
                        handleCardClick(product);
                      }
                    }}
                  >
                    {opening === product.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : product.status === 'construction' ? (
                      "Em breve"
                    ) : product.is_redirect_only ? (
                      <><ArrowRight className="h-4 w-4" /> Acessar Agora</>
                    ) : product.unlocked ? (
                      <><ArrowRight className="h-4 w-4" /> Acessar</>
                    ) : (
                      <><Lock className="h-4 w-4" /> Desbloquear</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!lockedProduct} onOpenChange={(open) => {
        if (!open) {
          setLockedProduct(null);
          setShowBuyForm(false);
        }
      }}>
        <DialogContent className="sm:max-w-md w-[95vw] max-w-[450px] p-0 overflow-hidden border-0 bg-white shadow-2xl max-h-[90vh] flex flex-col">
          <div className="bg-[#10b981] py-3 px-4 text-center shrink-0">
             <p className="text-white font-black text-sm uppercase tracking-wider animate-pulse">
                🔓 COMPRE PARA DESBLOQUEAR !
             </p>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-2xl font-black text-black leading-tight tracking-tight uppercase">
                {lockedProduct?.title}
              </DialogTitle>
              <DialogDescription className="text-zinc-600 font-medium text-sm leading-relaxed">
                {lockedProduct?.description || "Este produto ainda não está liberado no seu acesso."}
              </DialogDescription>
            </DialogHeader>

            {!showBuyForm ? (
              <div className="flex flex-col gap-4 py-2">
                <Button
                  className="w-full h-16 bg-[#059669] hover:bg-[#047857] text-white font-black text-xl uppercase tracking-tight rounded-xl shadow-lg transition-all active:scale-95 flex flex-col items-center justify-center"
                  onClick={() => setShowBuyForm(true)}
                >
                  <span className="text-[10px] opacity-80 font-bold mb-0.5">QUERO DESBLOQUEAR AGORA</span>
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Comprar {lockedProduct?.price ? `R$ ${Number(lockedProduct.price).toFixed(0)}` : ""}
                  </div>
                </Button>

                {lockedProduct?.sales_page_url && (
                  <Button
                    variant="outline"
                    className="w-full h-14 border-zinc-200 text-zinc-700 hover:text-black hover:bg-zinc-50 font-black text-base uppercase rounded-xl transition-all active:scale-95 flex flex-col items-center justify-center"
                    onClick={() => window.open(lockedProduct.sales_page_url as string, "_blank")}
                  >
                    <span className="text-[10px] opacity-60 font-bold mb-0.5">QUERO SABER MAIS</span>
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" /> Conhecer primeiro
                    </div>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-1.5">
                  <Label htmlFor="buy-name" className="text-zinc-900 font-bold text-xs uppercase ml-1">Nome completo</Label>
                  <Input
                    id="buy-name"
                    value={buyName}
                    onChange={(e) => setBuyName(e.target.value)}
                    className="bg-white border-zinc-200 text-black h-11 focus:ring-2 focus:ring-[#10b981] focus:border-transparent rounded-lg font-medium"
                    placeholder="Seu nome"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="buy-email" className="text-zinc-900 font-bold text-xs uppercase ml-1">E-mail</Label>
                  <Input
                    id="buy-email"
                    type="email"
                    value={buyEmail}
                    onChange={(e) => setBuyEmail(e.target.value)}
                    className="bg-white border-zinc-200 text-black h-11 focus:ring-2 focus:ring-[#10b981] focus:border-transparent rounded-lg font-medium"
                    placeholder="seu@email.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="buy-phone" className="text-zinc-900 font-bold text-xs uppercase ml-1">WhatsApp (DDD + número)</Label>
                  <Input
                    id="buy-phone"
                    value={buyPhone}
                    onChange={(e) => setBuyPhone(e.target.value)}
                    placeholder="11999999999"
                    className="bg-white border-zinc-200 text-black h-11 focus:ring-2 focus:ring-[#10b981] focus:border-transparent rounded-lg font-medium"
                  />
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <Button
                    className="w-full h-14 bg-[#059669] hover:bg-[#047857] text-white font-black text-lg uppercase tracking-tight rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                    onClick={handleBuy}
                    disabled={buying}
                  >
                    {buying ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
                    Pagar agora
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full text-zinc-400 font-bold text-xs uppercase"
                    onClick={() => setShowBuyForm(false)}
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cadastro obrigatório de e-mail para quem ainda não tem */}
      <Dialog open={needsEmail && !showConfig && mergeConflicts.length === 0 && !mergeResult} onOpenChange={() => { /* obrigatório */ }}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle>Complete seu cadastro</DialogTitle>
            <DialogDescription>
              Precisamos do seu e-mail, nome e WhatsApp para vincular seus acessos e permitir a recuperação de senha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome de acesso</Label>
              <Input value={profile?.username || session.username || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="force-email">E-mail *</Label>
              <Input
                id="force-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="force-name">Nome completo *</Label>
              <Input id="force-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Seu nome completo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="force-whats">WhatsApp *</Label>
              <Input id="force-whats" value={formWhats} onChange={(e) => setFormWhats(e.target.value)} placeholder="11999999999" />
            </div>
            <Button className="w-full" onClick={() => saveProfile(true)} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Salvar e continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Configurações da conta */}
      <Dialog open={showConfig} onOpenChange={(open) => setShowConfig(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurações da conta</DialogTitle>
            <DialogDescription>
              Atualize seus dados de acesso. O nome de acesso não pode ser alterado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome de acesso</Label>
              <Input value={profile?.username || session.username || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-name">Nome</Label>
              <Input id="cfg-name" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-email">E-mail</Label>
              <Input id="cfg-email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-whats">WhatsApp (opcional)</Label>
              <Input id="cfg-whats" value={formWhats} onChange={(e) => setFormWhats(e.target.value)} placeholder="11999999999" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cfg-pass">Nova senha</Label>
                <Input
                  id="cfg-pass"
                  type="password"
                  value={formNewPassword}
                  onChange={(e) => setFormNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cfg-pass2">Confirmar senha</Label>
                <Input
                  id="cfg-pass2"
                  type="password"
                  value={formConfirmPassword}
                  onChange={(e) => setFormConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <Button className="w-full" onClick={() => saveProfile(false)} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* E-mail já vinculado a outro acesso → oferecer unificação */}
      <Dialog open={mergeConflicts.length > 0} onOpenChange={(open) => !open && setMergeConflicts([])}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto border-2 border-yellow-500/40 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-yellow-400">
              Este e-mail já está vinculado a outro acesso
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Encontramos outros acessos usando <span className="font-bold text-white">{mergeEmail}</span>. Deseja unificar tudo em uma única conta?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
              <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-yellow-500">Escolha o acesso principal</p>
              <ul className="space-y-2">
                {mergeConflicts.map((c, i) => {
                  const selected = (mergePrimary || mergeConflicts[0]?.username) === c.username;
                  return (
                    <li key={`${c.tool}-${c.username}-${i}`}>
                      <button
                        type="button"
                        onClick={() => setMergePrimary(c.username)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                          selected ? "border-yellow-500 bg-yellow-500/10" : "border-zinc-800 bg-transparent hover:border-zinc-600",
                        )}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                              selected ? "border-yellow-400" : "border-zinc-600",
                            )}
                          >
                            {selected && <span className="h-2 w-2 rounded-full bg-yellow-400" />}
                          </span>
                          <span className="font-bold text-white break-all">{c.username}</span>
                          {c.current && (
                            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-400">
                              Seu acesso atual
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-[10px] font-black uppercase text-yellow-400">
                          {c.tool}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[11px] text-zinc-500">
                O acesso selecionado será o seu login principal.
              </p>
            </div>

            <p className="text-xs leading-relaxed text-zinc-400">
              Ao unificar, todos os seus produtos passam a ficar no mesmo e-mail.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="w-full border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-900 sm:w-1/3"
                onClick={() => setMergeConflicts([])}
                disabled={merging}
              >
                Agora não
              </Button>
              <Button
                className="w-full bg-yellow-500 font-black uppercase tracking-wide text-black hover:bg-yellow-400 sm:w-2/3"
                onClick={handleMerge}
                disabled={merging}
              >
                {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Sim, unificar tudo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resumo pós-unificação */}
      <Dialog open={!!mergeResult} onOpenChange={(open) => !open && setMergeResult(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto border-2 border-yellow-500/40 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-yellow-400">Acessos unificados!</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Tudo o que você tem liberado agora está no mesmo acesso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-yellow-500/40 bg-black/60 p-4">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-yellow-500">Entrar pelo e-mail</p>
              <p className="text-sm text-zinc-300">
                E-mail: <span className="font-bold text-white break-all">{mergeResult?.email}</span>
                <br />
                Senha: <span className="font-bold text-white break-all">{mergeResult?.primary.password}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-yellow-500">Entrar pelo usuário</p>
              <p className="text-sm text-zinc-300">
                Usuário: <span className="font-bold text-white break-all">{mergeResult?.primary.username}</span>
                <br />
                Senha: <span className="font-bold text-white break-all">{mergeResult?.primary.password}</span>
              </p>
            </div>

            {!!mergeResult?.accounts.length && (
              <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-zinc-500">Vinculados a você</p>
                <ul className="space-y-2">
                  {mergeResult.accounts.map((a, i) => (
                    <li key={`${a.tool}-${a.username}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold text-white break-all">{a.username}</span>
                      <span className="shrink-0 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-[10px] font-black uppercase text-yellow-400">
                        {a.tool}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-zinc-400">
              {mergeResult?.emailSent
                ? `Enviamos um e-mail para ${mergeResult?.email} com todos os seus acessos.`
                : "Não conseguimos enviar o e-mail de resumo agora, mas seus acessos já estão unificados."}
            </p>

            <Button
              className="w-full bg-yellow-500 font-black uppercase tracking-wide text-black hover:bg-yellow-400"
              onClick={() => setMergeResult(null)}
            >
              <Mail className="h-4 w-4" />
              Entendi, continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
