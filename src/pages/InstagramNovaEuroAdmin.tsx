import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EuroPageManager } from "@/components/admin/EuroPageManager";
import { 
  Loader2, 
  Lock, 
  LogOut, 
  Search, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  XCircle,
  Mail,
  User,
  Calendar,
  Euro,
  Copy,
  Phone,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Send,
  Activity
} from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ADMIN_EMAIL = "mro@gmail.com";
const ADMIN_PASSWORD = "Ga145523@";

// Configurações do template de mensagem
const MEMBER_LINK = "https://maisresultadosonline.com.br/instagram";
const GROUP_LINK = "https://chat.whatsapp.com/JdEHa4jeLSUKTQFCNp7YXi";

interface EuroOrder {
  id: string;
  email: string;
  username: string;
  phone: string | null;
  plan_type: string;
  amount: number;
  status: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  api_created: boolean | null;
  email_sent: boolean | null;
  paid_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface VerificationAttempt {
  orderId: string;
  timestamp: Date;
  result: "success" | "pending" | "error";
  message: string;
}

interface WebhookLog {
  id: string;
  created_at: string;
  event_type: string;
  order_nsu: string | null;
  transaction_nsu: string | null;
  email: string | null;
  username: string | null;
  affiliate_id: string | null;
  amount: number | null;
  status: string;
  payload: any;
  result_message: string | null;
  order_found: boolean;
  order_id: string | null;
}

export default function InstagramNovaEuroAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [orders, setOrders] = useState<EuroOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "paid" | "completed">("all");
  
  const autoCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [lastAutoCheck, setLastAutoCheck] = useState<Date | null>(null);
  
  // Verification attempts tracking
  const [verificationAttempts, setVerificationAttempts] = useState<VerificationAttempt[]>([]);
  const [showAttemptsDialog, setShowAttemptsDialog] = useState(false);
  
  // Summary dialog
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [summaryEmail, setSummaryEmail] = useState("");
  const [summaryName, setSummaryName] = useState("");
  const [sendingSummary, setSendingSummary] = useState(false);
  
  // Webhook logs
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [showWebhookLogsDialog, setShowWebhookLogsDialog] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // State para seções colapsáveis
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    completed: true,
    paid: true,
    pending: false,
  });

  // Check if already authenticated
  useEffect(() => {
    const auth = localStorage.getItem("mro_euro_admin_auth");
    if (auth === "true") {
      setIsAuthenticated(true);
      loadOrders();
    }
  }, []);

  // Verificação automática a cada 30 segundos
  useEffect(() => {
    if (isAuthenticated && autoCheckEnabled) {
      checkPendingPayments();
      
      autoCheckIntervalRef.current = setInterval(() => {
        checkPendingPayments();
      }, 30000);
      
      return () => {
        if (autoCheckIntervalRef.current) {
          clearInterval(autoCheckIntervalRef.current);
        }
      };
    }
  }, [isAuthenticated, autoCheckEnabled]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);

    setTimeout(() => {
      if (loginEmail === ADMIN_EMAIL && loginPassword === ADMIN_PASSWORD) {
        localStorage.setItem("mro_euro_admin_auth", "true");
        setIsAuthenticated(true);
        loadOrders();
        toast.success("Login realizado com sucesso!");
      } else {
        toast.error("Email ou senha incorretos");
      }
      setLoginLoading(false);
    }, 500);
  };

  const handleLogout = () => {
    localStorage.removeItem("mro_euro_admin_auth");
    setIsAuthenticated(false);
    setOrders([]);
    if (autoCheckIntervalRef.current) {
      clearInterval(autoCheckIntervalRef.current);
    }
    toast.info("Logout realizado");
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("mro_euro_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading orders:", error);
        toast.error("Erro ao carregar pedidos");
        return;
      }

      // Remover duplicatas por email - manter apenas o registro mais recente com status pago/completed
      // Para emails com múltiplos pagamentos, manter apenas 1 (o mais recente)
      const ordersData = data || [];
      const emailMap = new Map<string, EuroOrder>();
      const uniqueOrders: EuroOrder[] = [];

      for (const order of ordersData) {
        const emailLower = order.email.toLowerCase();
        
        // Se status é pending, sempre incluir (pode ter múltiplos pendentes)
        if (order.status === "pending") {
          uniqueOrders.push(order);
          continue;
        }

        // Para paid/completed, manter apenas 1 por email (o mais recente, que vem primeiro pois está ordenado desc)
        if (!emailMap.has(emailLower)) {
          emailMap.set(emailLower, order);
          uniqueOrders.push(order);
        }
        // Se já existe um registro para este email, ignorar duplicatas
      }

      setOrders(uniqueOrders);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Carregar logs do webhook
  const loadWebhookLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("infinitepay_webhook_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading webhook logs:", error);
        toast.error("Erro ao carregar logs do webhook");
        return;
      }

      setWebhookLogs(data || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao carregar logs");
    } finally {
      setLoadingLogs(false);
    }
  };

  // Add verification attempt to log
  const addVerificationAttempt = (orderId: string, result: "success" | "pending" | "error", message: string) => {
    setVerificationAttempts(prev => [
      {
        orderId,
        timestamp: new Date(),
        result,
        message
      },
      ...prev.slice(0, 99) // Keep last 100 attempts
    ]);
  };

  // Verificar pagamentos pendentes automaticamente
  const checkPendingPayments = async () => {
    try {
      const pendingOrders = orders.filter(o => o.status === "pending");
      
      if (pendingOrders.length === 0) {
        setLastAutoCheck(new Date());
        loadOrders();
        return;
      }

      console.log(`[AUTO-CHECK EURO] Verificando ${pendingOrders.length} pedidos pendentes...`);
      
      for (const order of pendingOrders) {
        try {
          const { data, error } = await supabase.functions.invoke("verify-euro-payment", {
            body: { order_id: order.id }
          });

          if (error) {
            addVerificationAttempt(order.id, "error", `Erro: ${error.message}`);
            continue;
          }

          if (data?.status === "completed" || data?.status === "paid") {
            console.log(`[AUTO-CHECK EURO] Pagamento confirmado para ${order.username}`);
            toast.success(`Pagamento confirmado: ${order.username}`);
            addVerificationAttempt(order.id, "success", `Pagamento ${data.status} - ${order.username}`);
          } else {
            addVerificationAttempt(order.id, "pending", `Ainda pendente - ${order.username}`);
          }
        } catch (e) {
          console.error(`[AUTO-CHECK EURO] Erro ao verificar ${order.id}:`, e);
          addVerificationAttempt(order.id, "error", `Exceção: ${String(e)}`);
        }
      }

      setLastAutoCheck(new Date());
      loadOrders();
    } catch (error) {
      console.error("[AUTO-CHECK EURO] Erro:", error);
    }
  };

  const checkPayment = async (order: EuroOrder) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-euro-payment", {
        body: { order_id: order.id }
      });

      if (error) {
        toast.error("Erro ao verificar pagamento");
        addVerificationAttempt(order.id, "error", `Erro manual: ${error.message}`);
        return;
      }

      if (data.status === "completed") {
        toast.success("Pagamento confirmado e acesso liberado!");
        addVerificationAttempt(order.id, "success", "Verificação manual: Completo");
      } else if (data.status === "paid") {
        toast.info("Pagamento confirmado! Processando acesso...");
        addVerificationAttempt(order.id, "success", "Verificação manual: Pago");
      } else {
        toast.info("Pagamento ainda não confirmado");
        addVerificationAttempt(order.id, "pending", "Verificação manual: Pendente");
      }

      loadOrders();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao verificar");
      addVerificationAttempt(order.id, "error", `Exceção manual: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Aprovar pagamento manualmente
  const approveManually = async (order: EuroOrder) => {
    if (!confirm(`Tem certeza que deseja aprovar MANUALMENTE o pagamento de ${order.username}?\n\nIsso irá criar o acesso mesmo sem confirmação do Stripe.`)) {
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-euro-payment", {
        body: { 
          order_id: order.id,
          manual_approve: true
        }
      });

      if (error) {
        toast.error("Erro ao aprovar manualmente");
        addVerificationAttempt(order.id, "error", `Aprovação manual erro: ${error.message}`);
        return;
      }

      if (data.status === "completed") {
        toast.success("Aprovação manual realizada! Acesso liberado.");
        addVerificationAttempt(order.id, "success", "APROVAÇÃO MANUAL: Completo");
      } else {
        toast.warning(data.message || "Aprovação parcial");
        addVerificationAttempt(order.id, "pending", `Aprovação manual: ${data.message}`);
      }

      loadOrders();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao aprovar manualmente");
      addVerificationAttempt(order.id, "error", `Exceção aprovação manual: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Enviar resumo de vendas
  const sendSalesSummary = async () => {
    if (!summaryEmail.includes("@")) {
      toast.error("Email inválido");
      return;
    }

    setSendingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("euro-sales-summary", {
        body: {
          affiliateEmail: summaryEmail,
          affiliateName: summaryName || "Afiliado",
          sendEmail: true
        }
      });

      if (error) {
        toast.error("Erro ao enviar resumo");
        return;
      }

      if (data.emailSent) {
        toast.success("Resumo enviado por email com sucesso!");
      } else {
        toast.warning(data.message || "Resumo gerado mas email não enviado");
      }

      setShowSummaryDialog(false);
      setSummaryEmail("");
      setSummaryName("");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao enviar resumo");
    } finally {
      setSendingSummary(false);
    }
  };

  const generateCopyMessage = (order: EuroOrder) => {
    return `Obrigado por fazer parte do nosso sistema!✅

🚀🔥 *Ferramenta para Instagram Vip acesso!*

Preciso que assista os vídeos da área de membros com o link abaixo:

( ${MEMBER_LINK} ) 

1 - Acesse Área Membros

2 - Acesse ferramenta para instagram

Para acessar a ferramenta e área de membros, utilize os acessos:

*usuário:* ${order.username}

*senha:* ${order.username}

⚠ Assista todos os vídeos, por favor!

Participe também do nosso GRUPO DE AVISOS

${GROUP_LINK}`;
  };

  const copyToClipboard = async (order: EuroOrder) => {
    const message = generateCopyMessage(order);
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensagem copiada para área de transferência!");
    } catch (e) {
      toast.error("Erro ao copiar");
    }
  };

  const deleteOrder = async (order: EuroOrder) => {
    if (!confirm(`Tem certeza que deseja excluir o pedido de ${order.username}?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from("mro_euro_orders")
        .delete()
        .eq("id", order.id);

      if (error) {
        console.error("Error deleting order:", error);
        toast.error("Erro ao excluir pedido");
        return;
      }

      toast.success("Pedido excluído com sucesso!");
      loadOrders();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao excluir pedido");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Completo</Badge>;
      case "paid":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Pago</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30"><XCircle className="w-3 h-3 mr-1" /> {status}</Badge>;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.stripe_session_id && order.stripe_session_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.phone && order.phone.includes(searchTerm));
    
    const matchesFilter = filterStatus === "all" || order.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  // Agrupar pedidos por status
  const groupedOrders = {
    completed: filteredOrders.filter(o => o.status === "completed"),
    paid: filteredOrders.filter(o => o.status === "paid"),
    pending: filteredOrders.filter(o => o.status === "pending"),
  };

  // Calcular dias restantes (365 dias a partir do pagamento)
  const getDaysRemaining = (order: EuroOrder) => {
    if (!order.paid_at) return null;
    const paidDate = new Date(order.paid_at);
    const expirationDate = addDays(paidDate, 365);
    const daysLeft = differenceInDays(expirationDate, new Date());
    return daysLeft > 0 ? daysLeft : 0;
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Stats
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "pending").length,
    paid: orders.filter(o => o.status === "paid" || o.status === "completed").length,
    completed: orders.filter(o => o.status === "completed").length,
    totalRevenue: orders.filter(o => o.status === "paid" || o.status === "completed").reduce((sum, o) => sum + Number(o.amount), 0)
  };

  // Renderizar card de pedido compacto
  const renderOrderCard = (order: EuroOrder, compact = false) => {
    const daysRemaining = getDaysRemaining(order);
    
    return (
      <div 
        key={order.id} 
        className={`bg-zinc-800/30 border border-zinc-700/50 rounded-lg ${compact ? "p-3" : "p-4"}`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className={`flex-1 grid grid-cols-2 ${compact ? "md:grid-cols-5" : "md:grid-cols-5"} gap-3`}>
            <div>
              <div className="flex items-center gap-1 text-zinc-400 text-xs mb-0.5">
                <Mail className="w-3 h-3" /> Email
              </div>
              <p className="text-white text-xs font-medium truncate">{order.email}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-zinc-400 text-xs mb-0.5">
                <User className="w-3 h-3" /> Usuário
              </div>
              <p className="text-white text-xs font-mono">{order.username}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-zinc-400 text-xs mb-0.5">
                <Phone className="w-3 h-3" /> Celular
              </div>
              <p className="text-white text-xs">{order.phone || "-"}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-zinc-400 text-xs mb-0.5">
                <Euro className="w-3 h-3" /> Valor
              </div>
              <p className="text-white text-xs">€{Number(order.amount).toFixed(2)}</p>
            </div>
            {daysRemaining !== null && (
              <div>
                <div className="flex items-center gap-1 text-zinc-400 text-xs mb-0.5">
                  <Calendar className="w-3 h-3" /> Dias Restantes
                </div>
                <p className={`text-xs font-bold ${daysRemaining > 30 ? "text-green-400" : daysRemaining > 7 ? "text-yellow-400" : "text-red-400"}`}>
                  {daysRemaining} dias
                </p>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 flex-wrap">
            {(order.status === "completed" || order.status === "paid") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(order)}
                className="border-green-500/50 text-green-400 hover:bg-green-500/10 h-7 px-2 text-xs"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copiar
              </Button>
            )}
            
            {order.status === "pending" && (
              <>
                <Button
                  size="sm"
                  onClick={() => checkPayment(order)}
                  className="bg-blue-500 hover:bg-blue-600 h-7 px-2 text-xs"
                  disabled={loading}
                  title="Verificar pagamento no Stripe"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Verificar
                </Button>
                <Button
                  size="sm"
                  onClick={() => approveManually(order)}
                  className="bg-green-600 hover:bg-green-700 h-7 px-2 text-xs"
                  disabled={loading}
                  title="Aprovar manualmente (sem verificar Stripe)"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Aprovar
                </Button>
              </>
            )}

            {order.status === "paid" && !order.api_created && (
              <Button
                size="sm"
                onClick={() => approveManually(order)}
                className="bg-orange-500 hover:bg-orange-600 h-7 px-2 text-xs"
                disabled={loading}
                title="Reprocessar criação de acesso"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Criar Acesso
              </Button>
            )}
            
            {order.api_created && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs py-0.5">
                API ✓
              </Badge>
            )}
            
            {order.email_sent && (
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs py-0.5">
                Email ✓
              </Badge>
            )}
            
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteOrder(order)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
              title="Excluir pedido"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        
        <div className="mt-2 pt-2 border-t border-zinc-700/30 flex items-center gap-3 text-[10px] text-zinc-500 flex-wrap">
          <span>Session: {order.stripe_session_id?.substring(0, 20)}...</span>
          {order.paid_at && (
            <span className="text-green-500">Pago: {format(new Date(order.paid_at), "dd/MM HH:mm", { locale: ptBR })}</span>
          )}
          <span className="text-zinc-600">Criado: {format(new Date(order.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
        </div>
      </div>
    );
  };

  // Configuração das seções
  const sections = [
    { key: "completed", label: "Completos", color: "green", icon: CheckCircle, orders: groupedOrders.completed },
    { key: "paid", label: "Pagos", color: "blue", icon: CheckCircle, orders: groupedOrders.paid },
    { key: "pending", label: "Pendentes", color: "yellow", icon: Clock, orders: groupedOrders.pending },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-800/80 border-zinc-700">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-blue-400" />
            </div>
            <CardTitle className="text-xl text-white">Admin MRO Euro</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="bg-zinc-700/50 border-zinc-600 text-white"
                  required
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Senha"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="bg-zinc-700/50 border-zinc-600 text-white"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold"
                disabled={loginLoading}
              >
                {loginLoading ? <Loader2 className="animate-spin" /> : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Euro className="w-6 h-6 text-blue-400" />
              Admin MRO Euro
            </h1>
            <p className="text-zinc-400 text-sm">Gerenciamento de pedidos em Euro (Stripe)</p>
            {lastAutoCheck && (
              <p className="text-zinc-500 text-xs mt-1">
                Última verificação: {format(lastAutoCheck, "HH:mm:ss", { locale: ptBR })}
                {autoCheckEnabled && " (auto: 30s)"}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setShowAttemptsDialog(true)}
              variant="outline"
              size="sm"
              className="border-zinc-600 text-zinc-300"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Tentativas ({verificationAttempts.length})
            </Button>
            <Button
              onClick={() => { setShowWebhookLogsDialog(true); loadWebhookLogs(); }}
              variant="outline"
              size="sm"
              className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
            >
              <Activity className="w-4 h-4 mr-2" />
              Webhook Logs
            </Button>
            <Button
              onClick={() => setShowSummaryDialog(true)}
              variant="outline"
              size="sm"
              className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
            >
              <FileText className="w-4 h-4 mr-2" />
              Resumo
            </Button>
            <Button
              onClick={() => setAutoCheckEnabled(!autoCheckEnabled)}
              variant="outline"
              size="sm"
              className={`border-zinc-600 ${autoCheckEnabled ? "text-green-400 border-green-500/50" : "text-zinc-400"}`}
            >
              {autoCheckEnabled ? "Auto ✓" : "Auto ✗"}
            </Button>
            <Button
              onClick={() => { loadOrders(); checkPendingPayments(); }}
              variant="outline"
              className="border-zinc-600 text-zinc-300"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        <EuroPageManager creds={{ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }} />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardContent className="p-4">
              <p className="text-zinc-400 text-sm">Total</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-4">
              <p className="text-yellow-400 text-sm">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-4">
              <p className="text-blue-400 text-sm">Pagos</p>
              <p className="text-2xl font-bold text-blue-400">{stats.paid}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-4">
              <p className="text-green-400 text-sm">Completos</p>
              <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-4">
              <p className="text-blue-400 text-sm">Receita</p>
              <p className="text-2xl font-bold text-blue-400">€{stats.totalRevenue.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="Buscar por email, usuário, telefone ou session ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-zinc-800/50 border-zinc-700 text-white"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {["all", "pending", "paid", "completed"].map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(status as typeof filterStatus)}
                className={filterStatus === status 
                  ? "bg-blue-500 text-white" 
                  : "border-zinc-600 text-zinc-300"
                }
              >
                {status === "all" ? "Todos" : status === "pending" ? "Pendentes" : status === "paid" ? "Pagos" : "Completos"}
              </Button>
            ))}
          </div>
        </div>

        {/* Orders List - Collapsible Sections */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardContent className="p-8 text-center">
              <p className="text-zinc-400">Nenhum pedido encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sections.map(({ key, label, color, icon: Icon, orders: sectionOrders }) => {
              if (sectionOrders.length === 0) return null;
              
              const isOpen = openSections[key];
              const colorClasses: Record<string, string> = {
                green: "bg-green-500/10 border-green-500/40 hover:bg-green-500/20",
                blue: "bg-blue-500/10 border-blue-500/40 hover:bg-blue-500/20",
                yellow: "bg-yellow-500/10 border-yellow-500/40 hover:bg-yellow-500/20",
              };
              const textClasses: Record<string, string> = {
                green: "text-green-400",
                blue: "text-blue-400",
                yellow: "text-yellow-400",
              };
              
              return (
                <Collapsible key={key} open={isOpen} onOpenChange={() => toggleSection(key)}>
                  <CollapsibleTrigger asChild>
                    <div 
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${colorClasses[color]}`}
                    >
                      <div className="flex items-center gap-3">
                        {isOpen ? (
                          <ChevronDown className={`w-5 h-5 ${textClasses[color]}`} />
                        ) : (
                          <ChevronRight className={`w-5 h-5 ${textClasses[color]}`} />
                        )}
                        <Icon className={`w-5 h-5 ${textClasses[color]}`} />
                        <span className={`font-semibold ${textClasses[color]}`}>{label}</span>
                        <Badge className={`${colorClasses[color]} ${textClasses[color]} border-none`}>
                          {sectionOrders.length}
                        </Badge>
                      </div>
                      <span className="text-zinc-400 text-sm">
                        {isOpen ? "Clique para ocultar" : "Clique para expandir"}
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-2 pl-2 border-l-2 border-zinc-700/50 ml-4">
                      {sectionOrders.map((order) => renderOrderCard(order, true))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>

      {/* Verification Attempts Dialog */}
      <Dialog open={showAttemptsDialog} onOpenChange={setShowAttemptsDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-400" />
              Tentativas de Verificação
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Histórico das últimas {verificationAttempts.length} tentativas de verificação de pagamento
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {verificationAttempts.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">Nenhuma tentativa registrada ainda</p>
            ) : (
              verificationAttempts.map((attempt, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg border ${
                    attempt.result === "success" 
                      ? "bg-green-500/10 border-green-500/30" 
                      : attempt.result === "error"
                      ? "bg-red-500/10 border-red-500/30"
                      : "bg-yellow-500/10 border-yellow-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {attempt.result === "success" && <CheckCircle className="w-4 h-4 text-green-400" />}
                      {attempt.result === "error" && <XCircle className="w-4 h-4 text-red-400" />}
                      {attempt.result === "pending" && <Clock className="w-4 h-4 text-yellow-400" />}
                      <span className={`text-sm ${
                        attempt.result === "success" ? "text-green-400" :
                        attempt.result === "error" ? "text-red-400" : "text-yellow-400"
                      }`}>
                        {attempt.message}
                      </span>
                    </div>
                    <span className="text-zinc-500 text-xs">
                      {format(attempt.timestamp, "HH:mm:ss", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVerificationAttempts([])}
              className="border-zinc-600 text-zinc-300"
            >
              Limpar Histórico
            </Button>
            <Button onClick={() => setShowAttemptsDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales Summary Dialog */}
      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Enviar Resumo de Vendas
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Envie um resumo das vendas Euro para um email específico
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
              <p className="text-zinc-400 text-sm mb-2">Resumo atual:</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-zinc-500 text-xs">Total de Vendas</p>
                  <p className="text-white text-lg font-bold">{stats.paid}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs">Receita Total</p>
                  <p className="text-green-400 text-lg font-bold">€{stats.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </div>
            
            <div>
              <label className="text-zinc-400 text-sm mb-1 block">Nome do Destinatário</label>
              <Input
                placeholder="Ex: João Silva"
                value={summaryName}
                onChange={(e) => setSummaryName(e.target.value)}
                className="bg-zinc-800/50 border-zinc-600 text-white"
              />
            </div>
            
            <div>
              <label className="text-zinc-400 text-sm mb-1 block">Email do Destinatário *</label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={summaryEmail}
                onChange={(e) => setSummaryEmail(e.target.value)}
                className="bg-zinc-800/50 border-zinc-600 text-white"
                required
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSummaryDialog(false)}
              className="border-zinc-600 text-zinc-300"
            >
              Cancelar
            </Button>
            <Button 
              onClick={sendSalesSummary}
              disabled={sendingSummary || !summaryEmail}
              className="bg-purple-500 hover:bg-purple-600"
            >
              {sendingSummary ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar Resumo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook Logs Dialog */}
      <Dialog open={showWebhookLogsDialog} onOpenChange={setShowWebhookLogsDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-400" />
              Logs do Webhook InfiniPay
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Histórico dos últimos webhooks recebidos do InfiniPay
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-2">
            {loadingLogs ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
              </div>
            ) : webhookLogs.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">Nenhum log registrado ainda</p>
            ) : (
              webhookLogs.map((log) => (
                <div 
                  key={log.id}
                  className={`p-3 rounded-lg border ${
                    log.status === "success" 
                      ? "bg-green-500/10 border-green-500/30" 
                      : log.status === "not_found"
                      ? "bg-red-500/10 border-red-500/30"
                      : "bg-yellow-500/10 border-yellow-500/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {log.status === "success" && <CheckCircle className="w-4 h-4 text-green-400" />}
                      {log.status === "not_found" && <XCircle className="w-4 h-4 text-red-400" />}
                      {log.status !== "success" && log.status !== "not_found" && <Clock className="w-4 h-4 text-yellow-400" />}
                      <Badge className={`${
                        log.status === "success" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                        log.status === "not_found" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                        "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                      }`}>
                        {log.event_type}
                      </Badge>
                      {log.order_found && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          Pedido Encontrado
                        </Badge>
                      )}
                    </div>
                    <span className="text-zinc-500 text-xs whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-500">NSU:</span>
                      <span className="text-white ml-1 font-mono">{log.order_nsu || "-"}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Email:</span>
                      <span className="text-white ml-1">{log.email || "-"}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Usuário:</span>
                      <span className="text-white ml-1 font-mono">{log.username || "-"}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Afiliado:</span>
                      <span className="text-purple-400 ml-1">{log.affiliate_id || "-"}</span>
                    </div>
                  </div>
                  
                  {log.result_message && (
                    <p className={`mt-2 text-xs ${
                      log.status === "success" ? "text-green-400" :
                      log.status === "not_found" ? "text-red-400" : "text-yellow-400"
                    }`}>
                      {log.result_message}
                    </p>
                  )}
                  
                  {log.amount && (
                    <p className="text-xs text-zinc-400 mt-1">
                      Valor: R$ {(log.amount / 100).toFixed(2)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
          
          <DialogFooter className="pt-4 border-t border-zinc-700">
            <Button
              variant="outline"
              onClick={loadWebhookLogs}
              disabled={loadingLogs}
              className="border-zinc-600 text-zinc-300"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingLogs ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button onClick={() => setShowWebhookLogsDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
