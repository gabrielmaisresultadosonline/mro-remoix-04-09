import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { EuroPageManager } from "@/components/admin/EuroPageManager";
import {
  Loader2,
  LogIn,
  RefreshCw,
  Users,
  ShoppingCart,
  AlertTriangle,
  Mail,
  MessageCircle,
  Instagram,
  KeyRound,
  RotateCcw,
} from "lucide-react";

const SESSION_KEY = "renddx_admin_session";

interface RenddxOrder {
  id: string;
  email: string;
  username: string | null;
  phone: string | null;
  customer_name?: string | null;
  amount: number | null;
  status: string;
  nsu_order: string | null;
  created_at: string;
}

interface RenddxInstagramAccount {
  id: string;
  instagram_username: string | null;
  created_at: string;
  is_trial: boolean;
}

interface RenddxUser {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  expires_at: string | null;
  expired: boolean;
  expired_email_sent_at: string | null;
  days_remaining: number | null;
  is_active: boolean;
  last_access: string | null;
  created_at: string;
  instagram_accounts: RenddxInstagramAccount[];
}

interface RenddxStats {
  total_orders: number;
  paid: number;
  attempts: number;
  active_users: number;
  expired_users: number;
  revenue: number;
}

type TabKey = "compradores" | "tentativas" | "expirados";

const fmtDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("pt-BR");
};

const fmtMoney = (value?: number | null) =>
  (Number(value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function RenddxAdmin() {
  const { toast } = useToast();

  const [creds, setCreds] = useState<{ email: string; password: string } | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as { email: string; password: string }) : null;
    } catch {
      return null;
    }
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<RenddxOrder[]>([]);
  const [users, setUsers] = useState<RenddxUser[]>([]);
  const [stats, setStats] = useState<RenddxStats | null>(null);
  const [whatsappLink, setWhatsappLink] = useState("");
  const [tab, setTab] = useState<TabKey>("compradores");
  const [search, setSearch] = useState("");
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const callApi = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      if (!creds) return { success: false, error: "sem sessão" } as Record<string, unknown>;
      const { data, error } = await supabase.functions.invoke("renddx-admin", {
        body: { action, email: creds.email, password: creds.password, ...extra },
      });
      if (error) return { success: false, error: error.message } as Record<string, unknown>;
      return (data || { success: false }) as Record<string, unknown>;
    },
    [creds],
  );

  const loadData = useCallback(async () => {
    if (!creds) return;
    setLoading(true);
    try {
      const data = await callApi("list");
      if (data.success) {
        setOrders((data.orders as RenddxOrder[]) || []);
        setUsers((data.users as RenddxUser[]) || []);
        setStats((data.stats as RenddxStats) || null);
        setWhatsappLink(String(data.whatsapp_link || ""));
      } else {
        toast({ title: String(data.error || "Erro ao carregar dados"), variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }, [callApi, creds, toast]);

  useEffect(() => {
    if (creds) loadData();
  }, [creds, loadData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const { data, error } = await supabase.functions.invoke("renddx-admin", {
        body: { action: "login", email: email.trim(), password },
      });
      if (error || !data?.success) {
        toast({ title: "Credenciais inválidas", variant: "destructive" });
        return;
      }
      const next = { email: email.trim(), password };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      setCreds(next);
    } finally {
      setLoggingIn(false);
    }
  };

  const sendExpiredEmail = async (user: RenddxUser) => {
    setBusyUser(user.id);
    try {
      const data = await callApi("send_expired_email", { user_id: user.id });
      toast({
        title: data.success ? "E-mail de expiração enviado" : String(data.error || "Falha no envio"),
        variant: data.success ? "default" : "destructive",
      });
      if (data.success) loadData();
    } finally {
      setBusyUser(null);
    }
  };

  const renewUser = async (user: RenddxUser) => {
    setBusyUser(user.id);
    try {
      const data = await callApi("renew_user", { user_id: user.id, days: 30 });
      toast({
        title: data.success ? "Acesso renovado por 30 dias" : String(data.error || "Falha na renovação"),
        variant: data.success ? "default" : "destructive",
      });
      if (data.success) loadData();
    } finally {
      setBusyUser(null);
    }
  };

  const paidOrders = useMemo(() => orders.filter((o) => o.status === "paid"), [orders]);
  const attemptOrders = useMemo(() => orders.filter((o) => o.status !== "paid"), [orders]);
  const expiredUsers = useMemo(() => users.filter((u) => u.expired), [users]);

  const term = search.trim().toLowerCase();
  const matchOrder = (o: RenddxOrder) =>
    !term ||
    [o.email, o.username, o.phone, o.nsu_order].some((v) => String(v || "").toLowerCase().includes(term));
  const matchUser = (u: RenddxUser) =>
    !term || [u.username, u.email, u.name].some((v) => String(v || "").toLowerCase().includes(term));

  const userByUsername = useMemo(() => {
    const map = new Map<string, RenddxUser>();
    for (const u of users) map.set(u.username.toLowerCase(), u);
    return map;
  }, [users]);

  if (!creds) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <h1 className="mb-1 text-2xl font-bold text-foreground">Admin Renddx</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Compradores, tentativas e acessos expirados do plano de 30 dias.
            </p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">E-mail</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Senha</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loggingIn}>
                {loggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "compradores", label: "Compradores", count: paidOrders.length },
    { key: "tentativas", label: "Tentativas", count: attemptOrders.length },
    { key: "expirados", label: "Expirados", count: expiredUsers.length },
  ];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Admin Renddx</h1>
            <p className="text-sm text-muted-foreground">Plano de 30 dias · origem /renddx</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {whatsappLink && (
              <Button variant="outline" size="sm" asChild>
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                sessionStorage.removeItem(SESSION_KEY);
                setCreds(null);
              }}
            >
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <ShoppingCart className="h-5 w-5 text-primary" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">Compras pagas</p>
                <p className="text-xl font-bold text-foreground">{stats?.paid ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-5 w-5 text-primary" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">Ativos</p>
                <p className="text-xl font-bold text-foreground">{stats?.active_users ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">Expirados</p>
                <p className="text-xl font-bold text-foreground">{stats?.expired_users ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">Faturamento</p>
                <p className="text-xl font-bold text-foreground">{fmtMoney(stats?.revenue)}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <EuroPageManager creds={creds} page="renddx" pageLabel="/renddx" showVisits={false} />

        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => (
            <Button
              key={t.key}
              variant={tab === t.key ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <Badge variant="secondary" className="ml-2">
                {t.count}
              </Badge>
            </Button>
          ))}
          <Input
            placeholder="Pesquisar por e-mail, usuário ou telefone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-xs"
          />
        </div>

        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </p>
        )}

        {tab !== "expirados" && (
          <section className="space-y-3">
            {(tab === "compradores" ? paidOrders : attemptOrders).filter(matchOrder).map((o) => {
              const user = o.username ? userByUsername.get(o.username.toLowerCase()) : undefined;
              return (
                <Card key={o.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-[180px] flex-1">
                      <p className="font-semibold text-foreground">{o.username || "sem usuário"}</p>
                      {o.customer_name && <p className="text-sm text-muted-foreground">{o.customer_name}</p>}
                      <p className="break-all text-xs text-muted-foreground">{o.email}</p>
                    </div>
                    <Badge variant={o.status === "paid" ? "default" : "secondary"} className="uppercase">
                      {o.status}
                    </Badge>
                    <span className="text-sm font-semibold text-foreground">{fmtMoney(o.amount)}</span>
                    {user?.expired && (
                      <Badge variant="destructive" className="uppercase">
                        Expirado
                      </Badge>
                    )}
                    {user && !user.expired && user.days_remaining !== null && (
                      <Badge variant="outline">{user.days_remaining} dias restantes</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</span>
                    {user && user.instagram_accounts.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <Instagram className="h-3 w-3" aria-hidden="true" />
                        {user.instagram_accounts.map((a) => (
                          <Badge key={a.id} variant="outline" className="text-[10px]">
                            @{a.instagram_username}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {!loading && (tab === "compradores" ? paidOrders : attemptOrders).filter(matchOrder).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
            )}
          </section>
        )}

        {tab === "expirados" && (
          <section className="space-y-3">
            {expiredUsers.filter(matchUser).map((u) => (
              <Card key={u.id} className={cn("border-destructive/40")}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[180px] flex-1">
                      <p className="font-semibold text-foreground">{u.username}</p>
                      <p className="break-all text-xs text-muted-foreground">{u.email || "sem e-mail"}</p>
                    </div>
                    <Badge variant="destructive" className="uppercase">
                      Expirado em {u.expires_at ? new Date(u.expires_at).toLocaleDateString("pt-BR") : "-"}
                    </Badge>
                    <Badge variant={u.is_active ? "secondary" : "outline"}>
                      {u.is_active ? "ainda ativo" : "bloqueado"}
                    </Badge>
                    <Badge variant="outline">
                      {u.expired_email_sent_at ? `aviso enviado ${fmtDate(u.expired_email_sent_at)}` : "aviso não enviado"}
                    </Badge>
                  </div>

                  {u.instagram_accounts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <Instagram className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                      {u.instagram_accounts.map((a) => (
                        <Badge key={a.id} variant="outline" className="text-[10px]">
                          @{a.instagram_username}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendExpiredEmail(u)}
                      disabled={busyUser === u.id || !u.email}
                    >
                      {busyUser === u.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="mr-1 h-4 w-4" />
                      )}
                      Reenviar aviso
                    </Button>
                    <Button size="sm" onClick={() => renewUser(u)} disabled={busyUser === u.id}>
                      <RotateCcw className="mr-1 h-4 w-4" /> Renovar 30 dias
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loading && expiredUsers.filter(matchUser).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum usuário expirado.</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
