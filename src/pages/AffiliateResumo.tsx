import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  Lock, 
  CheckCircle, 
  Clock, 
  DollarSign,
  Phone,
  User,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SaleItem {
  customerEmail: string;
  customerName: string;
  phone: string;
  amount: number;
  date: string;
  nsuOrder?: string;
  commissionPaid?: boolean;
  plan?: 'vitalicio' | 'anual';
  commission?: number;
}

interface AttemptItem {
  email: string;
  username: string;
  phone: string;
  date: string;
  totalAttempts?: number;
}

interface ResumoData {
  affiliateId: string;
  affiliateName: string;
  totalSales: number;
  totalCommission: number;
  paidCommissionsTotal?: number;
  pendingCommissionsTotal?: number;
  salesList: SaleItem[];
  attemptsList: AttemptItem[];
  multipleAttemptsList: AttemptItem[];
  promoStatus: string;
  createdAt?: string;
  updatedAt: string;
}

export default function AffiliateResumo() {
  const { affiliateId } = useParams();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  
  const [resumoData, setResumoData] = useState<ResumoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRealtime, setIsRealtime] = useState(true);

  // Check if already authenticated via sessionStorage
  useEffect(() => {
    const storedAuth = sessionStorage.getItem(`affiliate_auth_${affiliateId}`);
    if (storedAuth === "true") {
      setIsAuthenticated(true);
      loadResumo();
    }
  }, [affiliateId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const { data, error } = await supabase.functions.invoke("affiliate-resumo-storage", {
        body: { 
          action: "verify-password",
          affiliateId,
          password
        }
      });

      if (error) throw error;

      if (data.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem(`affiliate_auth_${affiliateId}`, "true");
        loadResumo();
      } else {
        setLoginError("Senha incorreta");
      }
    } catch (err) {
      console.error("Login error:", err);
      setLoginError("Erro ao verificar senha");
    } finally {
      setLoginLoading(false);
    }
  };

  const loadResumo = async () => {
    setLoading(true);
    setError("");

    try {
      // Try to get realtime data first
      const { data, error } = await supabase.functions.invoke("affiliate-resumo-storage", {
        body: { 
          action: "get-realtime",
          affiliateId
        }
      });

      if (error) throw error;

      if (data.success && data.resumo) {
        setResumoData(data.resumo);
        setLastUpdate(new Date());
        setIsRealtime(true);
      } else {
        // Fallback to stored resumo
        const { data: storedData, error: storedError } = await supabase.functions.invoke("affiliate-resumo-storage", {
          body: { 
            action: "get",
            affiliateId
          }
        });
        
        if (storedData?.success && storedData?.resumo) {
          setResumoData(storedData.resumo);
          setLastUpdate(new Date(storedData.resumo.updatedAt));
          setIsRealtime(false);
        } else {
          setError("Nenhum resumo encontrado ainda");
        }
      }
    } catch (err) {
      console.error("Load error:", err);
      setError("Erro ao carregar resumo");
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      loadResumo();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, affiliateId]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-800/80 border-zinc-700">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-amber-400" />
            </div>
            <CardTitle className="text-xl text-white">Resumo de Afiliado</CardTitle>
            <p className="text-zinc-400 text-sm mt-2">Digite sua senha para acessar</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-700/50 border-zinc-600 text-white text-center text-lg"
                  required
                />
              </div>
              {loginError && (
                <p className="text-red-400 text-sm text-center">{loginError}</p>
              )}
              <Button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold"
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Acessar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading && !resumoData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error && !resumoData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-800/80 border-zinc-700 text-center p-8">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-white text-lg">{error}</p>
          <p className="text-zinc-400 text-sm mt-2">Aguarde as primeiras tentativas de compra</p>
          <Button
            onClick={loadResumo}
            className="mt-4 bg-amber-500 hover:bg-amber-600 text-black"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar Novamente
          </Button>
        </Card>
      </div>
    );
  }

  const notPaidAttempts = (resumoData?.attemptsList?.length || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-block bg-black border-2 border-amber-500 rounded-xl px-6 py-3 mb-4">
            <span className="text-amber-400 text-2xl font-bold tracking-wider">MRO</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            📊 Resumo de Vendas
          </h1>
          <p className="text-zinc-400 mt-2">
            Olá, <span className="text-amber-400 font-semibold">{resumoData?.affiliateName}</span>!
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge className={`${resumoData?.promoStatus === 'vitalício' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : resumoData?.promoStatus === 'em andamento' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
              {resumoData?.promoStatus === 'vitalício' ? '⭐ Afiliado Vitalício' : resumoData?.promoStatus === 'em andamento' ? '📍 Promoção em andamento' : '✅ Promoção finalizada'}
            </Badge>
            {isRealtime && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                Tempo Real
              </Badge>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-2xl md:text-3xl font-bold text-green-400">{resumoData?.totalSales || 0}</p>
              <p className="text-xs text-zinc-400">Vendas</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
            <CardContent className="p-4 text-center">
              <DollarSign className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-2xl md:text-3xl font-bold text-amber-400">R${resumoData?.paidCommissionsTotal || 0}</p>
              <p className="text-xs text-zinc-400">Recebido</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-yellow-500/30">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
              <p className="text-2xl md:text-3xl font-bold text-yellow-400">R${resumoData?.pendingCommissionsTotal || 0}</p>
              <p className="text-xs text-zinc-400">A Receber</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl md:text-3xl font-bold text-blue-400">{notPaidAttempts}</p>
              <p className="text-xs text-zinc-400">Tentativas</p>
            </CardContent>
          </Card>
        </div>

        {/* Vendas Confirmadas */}
        {resumoData?.salesList && resumoData.salesList.length > 0 && (
          <Card className="bg-zinc-800/50 border-green-500/30 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-green-400 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Vendas Confirmadas ({resumoData.salesList.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left p-2 text-zinc-400">#</th>
                    <th className="text-left p-2 text-zinc-400">Email</th>
                    <th className="text-left p-2 text-zinc-400">Cliente</th>
                    <th className="text-left p-2 text-zinc-400">📱</th>
                    <th className="text-left p-2 text-zinc-400">Valor</th>
                    <th className="text-left p-2 text-zinc-400">Status</th>
                    <th className="text-left p-2 text-zinc-400">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoData.salesList.map((sale, index) => (
                    <tr key={index} className={`border-b border-zinc-700/50 ${sale.commissionPaid ? 'bg-green-500/5' : ''}`}>
                      <td className="p-2 text-white">{index + 1}</td>
                      <td className="p-2 text-white text-xs">{sale.customerEmail}</td>
                      <td className="p-2 text-white">{sale.customerName || '-'}</td>
                      <td className="p-2 text-green-400 text-xs">{sale.phone || '-'}</td>
                      <td className="p-2 text-green-400 font-medium">
                        R$ {Number(sale.amount).toFixed(2)}
                        <span className="block text-[10px] text-amber-400">
                          {(sale.plan ?? (Number(sale.amount) >= 1000 ? 'vitalicio' : 'anual')) === 'vitalicio' ? 'Vitalício' : 'Anual'} · comissão R$ {sale.commission ?? (Number(sale.amount) >= 1000 ? 197 : 97)}
                        </span>
                      </td>
                      <td className="p-2">
                        {sale.commissionPaid ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                            ✅ Recebido
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                            ⏳ Pendente
                          </Badge>
                        )}
                      </td>
                      <td className="p-2 text-zinc-400 text-xs">{sale.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Tentativas (não pagaram) */}
        {resumoData?.attemptsList && resumoData.attemptsList.length > 0 && (
          <Card className="bg-zinc-800/50 border-yellow-500/30 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-yellow-400 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Tentativas - Não Pagaram ({resumoData.attemptsList.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left p-2 text-zinc-400">#</th>
                    <th className="text-left p-2 text-zinc-400">Email</th>
                    <th className="text-left p-2 text-zinc-400">Usuário</th>
                    <th className="text-left p-2 text-zinc-400">📱</th>
                    <th className="text-left p-2 text-zinc-400">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoData.attemptsList.map((attempt, index) => (
                    <tr key={index} className="border-b border-zinc-700/50">
                      <td className="p-2 text-white">{index + 1}</td>
                      <td className="p-2 text-white text-xs">{attempt.email}</td>
                      <td className="p-2 text-white">{attempt.username || '-'}</td>
                      <td className="p-2 text-yellow-400 text-xs">{attempt.phone || '-'}</td>
                      <td className="p-2 text-zinc-400 text-xs">{attempt.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Múltiplas Tentativas */}
        {resumoData?.multipleAttemptsList && resumoData.multipleAttemptsList.length > 0 && (
          <Card className="bg-zinc-800/50 border-orange-500/30 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-orange-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Múltiplas Tentativas ({resumoData.multipleAttemptsList.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left p-2 text-zinc-400">#</th>
                    <th className="text-left p-2 text-zinc-400">Email</th>
                    <th className="text-left p-2 text-zinc-400">Usuário</th>
                    <th className="text-left p-2 text-zinc-400">📱</th>
                    <th className="text-left p-2 text-zinc-400">Tentativas</th>
                    <th className="text-left p-2 text-zinc-400">Última</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoData.multipleAttemptsList.map((attempt, index) => (
                    <tr key={index} className="border-b border-zinc-700/50">
                      <td className="p-2 text-white">{index + 1}</td>
                      <td className="p-2 text-white text-xs">{attempt.email}</td>
                      <td className="p-2 text-white">{attempt.username || '-'}</td>
                      <td className="p-2 text-orange-400 text-xs">{attempt.phone || '-'}</td>
                      <td className="p-2 text-orange-400 font-bold">{attempt.totalAttempts}x</td>
                      <td className="p-2 text-zinc-400 text-xs">{attempt.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Nenhum dado ainda */}
        {!resumoData?.salesList?.length && !resumoData?.attemptsList?.length && (
          <Card className="bg-zinc-800/50 border-zinc-700 mb-4">
            <CardContent className="p-8 text-center">
              <Clock className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
              <p className="text-white text-lg">Aguardando dados...</p>
              <p className="text-zinc-400 text-sm mt-2">As vendas e tentativas aparecerão aqui automaticamente</p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-6 border-t border-zinc-700 mt-6">
          <p className="text-amber-400 font-semibold mb-1">MRO - Programa de Afiliados 💛</p>
          <p className="text-zinc-500 text-xs">
            Última atualização: {lastUpdate ? format(lastUpdate, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR }) : '-'}
          </p>
          <p className="text-zinc-600 text-xs mt-1">
            Atualiza automaticamente a cada 30 segundos
          </p>
          <Button
            onClick={loadResumo}
            variant="ghost"
            size="sm"
            className="mt-2 text-zinc-400 hover:text-white"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Atualizar Agora
          </Button>
        </div>
      </div>
    </div>
  );
}