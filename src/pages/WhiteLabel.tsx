import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Instagram, 
  MessageSquare, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  ArrowRight, 
  Zap, 
  ShieldCheck, 
  BarChart3,
  Rocket,
  Calculator,
  DollarSign,
  MousePointer2,
  UserPlus,
  Target,
  Send,
  ExternalLink,
  Sparkles,
  Search,
  Bot,
  MessageCircle,
  Phone
} from 'lucide-react';
import { motion } from 'framer-motion';

const ProfitCalculator = () => {
  const [sales, setSales] = useState(67);
  const pricePerSale = 397;
  const profitPerSale = 297; // Logic: R$ 397 - 30% (approx) = R$ 297 as requested
  
  const totalFaturamento = sales * pricePerSale;
  const totalProfit = sales * profitPerSale;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <div className="space-y-8">
        <div>
          <label className="text-sm font-bold text-gray-400 uppercase tracking-widest block mb-6">
            Número de Vendas Mensais: <span className="text-yellow-500 text-2xl ml-2">{sales}</span>
          </label>
          <Slider
            defaultValue={[67]}
            max={200}
            step={1}
            onValueChange={(value) => setSales(value[0])}
            className="py-4"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-2 font-mono">
            <span>0</span>
            <span>100</span>
            <span>200+</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-gray-400">Preço de Venda (Anual)</span>
            <span className="font-bold text-white">R$ {pricePerSale}</span>
          </div>
          <div className="flex justify-between items-center p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex flex-col">
              <span className="text-yellow-500 font-bold">Seu Lucro Líquido (por venda)</span>
              <span className="text-[10px] text-yellow-500/70 font-bold uppercase tracking-widest">R$ 397 - 30% taxa plataforma</span>
            </div>
            <span className="font-bold text-yellow-500 text-2xl">R$ {profitPerSale}</span>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/50 rounded-[32px] p-8 border border-white/5 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-yellow-500/10 blur-[40px] rounded-full pointer-events-none" />
        <span className="text-gray-500 text-sm font-bold uppercase tracking-widest relative z-10">Seu Resultado Mensal</span>
        <div className="mt-4 mb-2">
          <span className="text-gray-400 text-lg mr-2 italic">Faturamento:</span>
          <span className="text-2xl font-bold text-white">R$ {totalFaturamento.toLocaleString('pt-BR')}</span>
        </div>
        <div className="text-6xl font-black text-yellow-500 mb-4 tracking-tighter">
          R$ {totalProfit.toLocaleString('pt-BR')}
        </div>
        <p className="text-gray-500 text-sm">
          Faturamento líquido mensal baseado na simulação de {sales} vendas.
        </p>
        
        <div className="mt-8 pt-8 border-t border-white/5">
          <span className="text-gray-400 text-xs uppercase font-bold block mb-2">Estimativa Anual Líquida</span>
          <div className="text-3xl font-black text-white">
            R$ {(totalProfit * 12).toLocaleString('pt-BR')}
          </div>
        </div>
      </div>
    </div>
  );
};

const WhiteLabel = () => {
  const [searchParams] = useSearchParams();
  const partnerSlug = searchParams.get('p');
  const [partner, setPartner] = useState<{name: string, whatsapp: string} | null>(null);

  useEffect(() => {
    const fetchPartner = async () => {
      if (!partnerSlug) return;
      const { data } = await supabase
        .from('partners')
        .select('name, whatsapp')
        .eq('slug', partnerSlug)
        .single();
      if (data) setPartner(data);
    };
    fetchPartner();
  }, [partnerSlug]);

  const handlePartnerContact = () => {
    // Lead redirecionado para o WhatsApp oficial
    window.open('https://wa.me/555192036540?text=Tenho interesse em ser um Parceiro Oficial MRO', '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-yellow-400 selection:text-black">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-yellow-500/10 blur-[60px] md:blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 blur-[60px] md:blur-[120px] rounded-full" />
      </div>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-6 bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-1.5 rounded-full border-none">
              SEJA UM PARCEIRO OFICIAL
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter">
              NOSSA MARCA, <br />
              <span className="text-yellow-500">SUA TECNOLOGIA.</span>
            </h1>
            
            <div className="bg-zinc-900/80 border border-yellow-500/20 rounded-[32px] p-8 max-w-4xl mx-auto mb-12 backdrop-blur-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center shrink-0">
                      <DollarSign className="text-yellow-500 w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-none">R$ 6 MIL</h3>
                      <p className="text-zinc-500 text-sm mt-1">Investimento Anual</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center shrink-0">
                      <Zap className="text-yellow-500 w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-none">VENDAS ILIMITADAS</h3>
                      <p className="text-zinc-500 text-sm mt-1">Sem limite de clientes no seu sistema</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center shrink-0">
                      <CheckCircle2 className="text-yellow-500 w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-none">TESTE GRÁTIS</h3>
                      <p className="text-zinc-500 text-sm mt-1">Liberação de testes para seus leads</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center shrink-0">
                      <TrendingUp className="text-yellow-500 w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-none">R$ 238 MIL LÍQUIDO</h3>
                      <p className="text-zinc-500 text-sm mt-1">Potencial de Faturamento Anual</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-left">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Incluso no Pacote</p>
                  <p className="text-sm text-zinc-300">Treinamento Passo a Passo de Vendas incluso</p>
                </div>
                <Button 
                  size="lg" 
                  onClick={handlePartnerContact}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-14 px-8 rounded-2xl text-lg w-full md:w-auto transition-all hover:scale-105 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                >
                  QUERO SER PARCEIRO <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>

            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              Tenha uma franquia da MRO já com produto pronto. Estrutura completa de agência de marketing para você oferecer aos seus clientes.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats/Highlight Section */}
      <section className="py-20 bg-zinc-950 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { label: "Economia em Anúncios", value: "100%", icon: Zap },
              { label: "Taxa de Entrega", value: "98%", icon: ShieldCheck },
              { label: "Escalabilidade", value: "ILIMITADA", icon: TrendingUp },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="p-8 rounded-3xl bg-black border border-white/5 flex flex-col items-center text-center group hover:border-yellow-500/30 transition-colors"
              >
                <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <stat.icon className="text-yellow-500 w-6 h-6" />
                </div>
                <div className="text-4xl font-black text-white mb-2">{stat.value}</div>
                <div className="text-gray-500 font-medium uppercase tracking-widest text-xs">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 px-4 bg-zinc-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black mb-6">COMO FUNCIONA <span className="text-yellow-500 text-balance">NA PRÁTICA</span></h2>
            <p className="text-gray-400 text-xl max-w-2xl mx-auto">Isso é o que você vai oferecer para o seu cliente final.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            {/* Connecting lines for desktop */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-yellow-500/10 -translate-y-1/2 z-0" />
            
            {[
              {
                step: "01",
                title: "Ative o seguir + curtir em massa",
                desc: "O sistema começa a interagir com perfis estratégicos automaticamente",
                icon: UserPlus
              },
              {
                step: "02",
                title: "Pessoas interessadas te seguem de volta",
                desc: "Quem se identifica com seu conteúdo e nicho passa a te seguir",
                icon: MousePointer2
              },
              {
                step: "03",
                title: "O sistema identifica o público quente",
                desc: "Filtros inteligentes separam quem realmente tem interesse",
                icon: Target
              },
              {
                step: "04",
                title: "Envie Direct em massa automaticamente",
                desc: "Mensagens otimizadas são enviadas para leads qualificados",
                icon: Send
              },
              {
                step: "05",
                title: "Direcione para seu produto ou serviço",
                desc: "Converta seguidores em clientes reais com estratégia",
                icon: ExternalLink
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative z-10"
              >
                <div className="bg-black border border-white/5 p-6 rounded-[32px] h-full flex flex-col items-center text-center group hover:border-yellow-500/40 transition-all">
                  <span className="text-5xl font-black text-white/5 absolute top-4 left-6 group-hover:text-yellow-500/10 transition-colors">{item.step}</span>
                  <div className="w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <item.icon className="text-yellow-500 w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-lg mb-3 leading-tight">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-20 p-8 rounded-[40px] bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/20 text-center">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              <div className="text-2xl font-black">💥 RESULTADO</div>
              <div className="flex items-center gap-4 text-xl md:text-2xl font-bold">
                <span className="text-white">Mais seguidores</span>
                <ArrowRight className="text-yellow-500" />
                <span className="text-white">Mais conversas</span>
                <ArrowRight className="text-yellow-500" />
                <span className="text-yellow-500">Mais vendas</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* V7+ Plus Features Section */}
      <section className="py-32 px-4 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-20">
            <div>
              <Badge className="bg-yellow-500 text-black mb-4">O QUE HÁ DE NOVO</Badge>
              <h2 className="text-4xl md:text-6xl font-black leading-none">NOVIDADES DA <span className="text-yellow-500">V7+ PLUS</span></h2>
            </div>
            <p className="text-gray-400 text-lg max-w-md">Totalmente otimizada com mais automação, mais inteligência e mais resultados.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="bg-zinc-950 border-white/10 rounded-[40px] p-8 hover:border-yellow-500/30 transition-all">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-yellow-500/10 rounded-2xl flex items-center justify-center">
                  <MessageSquare className="text-yellow-500 w-7 h-7" />
                </div>
                <Badge className="bg-yellow-500 text-black">NOVO</Badge>
              </div>
              <h3 className="text-2xl font-bold mb-4">Automação de Direct (DM)</h3>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Envio automático para novos seguidores</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Envio para seus seguidores atuais</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Envio para seguidores de qualquer página</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Copy otimizada com Corretor de IA exclusivo</li>
              </ul>
            </Card>

            <Card className="bg-zinc-950 border-white/10 rounded-[40px] p-8 hover:border-yellow-500/30 transition-all">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-yellow-500/10 rounded-2xl flex items-center justify-center">
                  <Target className="text-yellow-500 w-7 h-7" />
                </div>
                <Badge className="bg-yellow-500 text-black">NOVO</Badge>
              </div>
              <h3 className="text-2xl font-bold mb-4">Filtros Inteligentes</h3>
              <p className="text-yellow-500 font-bold text-sm mb-4 uppercase tracking-widest">Público Quente</p>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Segmentação avançada por interesse</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Mais precisão = mais respostas</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Conversões otimizadas por IA</li>
              </ul>
            </Card>

            <Card className="bg-zinc-950 border-white/10 rounded-[40px] p-8 hover:border-yellow-500/30 transition-all">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-yellow-500/10 rounded-2xl flex items-center justify-center">
                  <TrendingUp className="text-yellow-500 w-7 h-7" />
                </div>
                <Badge className="bg-yellow-500 text-black">PRINCIPAL</Badge>
              </div>
              <h3 className="text-2xl font-bold mb-4">Crescimento Completo</h3>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Seguir em massa estratégico</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Curtir fotos automaticamente</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Interação com Stories</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Deixar de seguir (Unfollow) inteligente</li>
              </ul>
            </Card>

            <Card className="bg-zinc-950 border-white/10 rounded-[40px] p-8 md:col-span-2 lg:col-span-1 hover:border-yellow-500/30 transition-all">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-yellow-500/10 rounded-2xl flex items-center justify-center">
                  <Search className="text-yellow-500 w-7 h-7" />
                </div>
                <Badge className="bg-yellow-500 text-black">AVANÇADO</Badge>
              </div>
              <h3 className="text-2xl font-bold mb-4">Captura de Público</h3>
              <p className="text-gray-400 mb-6 italic text-sm">Extraia leads altamente qualificados que já demonstram interesse:</p>
              <ul className="grid grid-cols-2 gap-3 text-gray-400">
                <li className="flex items-center gap-2 text-xs md:text-sm"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Quem curte posts</li>
                <li className="flex items-center gap-2 text-xs md:text-sm"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Quem comenta</li>
                <li className="flex items-center gap-2 text-xs md:text-sm"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Seguidores de rivais</li>
                <li className="flex items-center gap-2 text-xs md:text-sm"><CheckCircle2 className="w-4 h-4 text-yellow-500" /> Seguidores de nicho</li>
              </ul>
            </Card>

            <Card className="bg-gradient-to-br from-zinc-900 to-black border-yellow-500/40 rounded-[40px] p-8 md:col-span-2 hover:border-yellow-500 transition-all shadow-[0_0_30px_rgba(234,179,8,0.1)]">
              <div className="flex flex-col lg:flex-row gap-8 items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-yellow-500 rounded-2xl flex items-center justify-center">
                      <Bot className="text-black w-7 h-7" />
                    </div>
                    <Badge className="bg-yellow-500 text-black font-bold">IA EXCLUSIVA</Badge>
                  </div>
                  <h3 className="text-3xl font-black mb-4">Inteligência Artificial Exclusiva</h3>
                  <p className="text-gray-400 mb-6 leading-relaxed text-balance">
                    A V7+ Plus vai além da automação simples. Nossa IA analisa seu perfil e traça as melhores estratégias de conteúdo, engajamento e vendas.
                  </p>
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    "Estratégias de Vendas",
                    "Otimização da BIO",
                    "Análise de Conteúdo",
                    "Relatórios e Métricas"
                  ].map((item, i) => (
                    <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                      <Sparkles className="text-yellow-500 w-4 h-4" />
                      <span className="font-bold text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Summary Section */}
      <section className="py-24 px-4 bg-zinc-950 border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-black mb-8 leading-tight">MAIS RESULTADOS, <span className="text-yellow-500 uppercase">ZERO ANÚNCIOS</span></h2>
              <p className="text-xl text-gray-400 mb-10 leading-relaxed">
                Com a tecnologia V7+ Plus você ganha seguidores qualificados e converte clientes reais sem precisar gastar um único real com tráfego pago.
              </p>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-white tracking-tighter">Automática</div>
                  <div className="text-gray-500 text-sm">Funciona 24h por dia, 7 dias por semana</div>
                </div>
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-white tracking-tighter">Inteligente</div>
                  <div className="text-gray-500 text-sm">IA exclusiva para cada perfil</div>
                </div>
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-white tracking-tighter">Escalável</div>
                  <div className="text-gray-500 text-sm">Sem limites para o seu crescimento</div>
                </div>
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-white tracking-tighter">Ilimitada</div>
                  <div className="text-gray-500 text-sm">Uso ilimitado em sua marca própria</div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-yellow-500/20 blur-[50px] md:blur-[100px] rounded-full" />
              <Card className="bg-black border-yellow-500/20 rounded-[40px] p-12 relative z-10 text-center">
                <h3 className="text-3xl font-black mb-6">OPORTUNIDADE ÚNICA</h3>
                <p className="text-gray-400 mb-10 text-lg leading-relaxed">
                  Ofereça essa solução para empresas que precisam de resultados imediatos investindo pouco. Essa é sua maior chance de lucro recorrente.
                </p>
                <div className="flex flex-col gap-4">
                  <div className="p-6 rounded-3xl bg-yellow-500 text-black">
                    <div className="text-sm font-bold uppercase tracking-widest mb-1 opacity-80">Ideal para agências</div>
                    <div className="text-2xl font-black italic text-balance">Revenda como seu e lucre 100%</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content / Features */}
      <section className="py-32 px-4 relative">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="flex-1">
              <h2 className="text-4xl md:text-5xl font-black mb-8 leading-tight">
                IMAGINA OFERECER ESSA SOLUÇÃO PARA <span className="text-yellow-500 underline decoration-yellow-500/30">QUALQUER EMPRESA?</span>
              </h2>
              <p className="text-lg text-gray-400 mb-10 leading-relaxed">
                Empresas gastam milhares com anúncios que nem sempre convertem. Com sua solução de Direct em massa, elas garantem atenção direta do público-alvo com custo quase zero de aquisição.
              </p>
              
              <ul className="space-y-6">
                {[
                  "Nossa logo e nossa identidade oficial",
                  "Link de divulgação exclusivo",
                  "Painel de parceiro completo",
                  "Gestão total de usuários e planos",
                  "Tecnologia anti-bloqueio avançada",
                  "Suporte técnico especializado"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-4 text-gray-200 font-medium">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-yellow-500" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex-1 relative">
              <div className="absolute inset-0 bg-yellow-500/20 blur-[50px] md:blur-[100px] rounded-full animate-pulse" />
              <Card className="bg-black border-white/10 rounded-[40px] overflow-hidden relative z-10 shadow-2xl">
                <CardContent className="p-12">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-tr from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <Instagram className="text-black w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-xl">Direct Pro Master</h4>
                      <p className="text-gray-500 text-sm">Powered by MRO Inteligente</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="h-4 w-3/4 bg-zinc-800 rounded-full" />
                    <div className="h-4 w-full bg-zinc-900 rounded-full" />
                    <div className="h-4 w-5/6 bg-zinc-800 rounded-full" />
                    <div className="grid grid-cols-2 gap-4 mt-12">
                      <div className="p-4 rounded-2xl bg-zinc-950 border border-white/5">
                        <BarChart3 className="text-yellow-500 mb-2 w-5 h-5" />
                        <span className="block text-xs text-gray-500 uppercase">Cliques</span>
                        <span className="text-xl font-bold">12.4k</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-zinc-950 border border-white/5">
                        <Users className="text-yellow-500 mb-2 w-5 h-5" />
                        <span className="block text-xs text-gray-500 uppercase">Leads</span>
                        <span className="text-xl font-bold">3.1k</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 relative bg-zinc-950/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">INVESTIMENTO <span className="text-yellow-500">PARCEIRO</span></h2>
            <p className="text-gray-400 text-lg">Escolha o melhor plano para começar sua própria agência de automação</p>
          </div>
          
          <div className="max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-[40px] blur opacity-25" />
              <Card className="bg-zinc-950 border-white/10 rounded-[40px] overflow-hidden relative z-10">
                <CardContent className="p-10 text-center">
                  <Badge className="bg-yellow-500 text-black font-bold mb-6">ATIVAÇÃO POR 1 ANO</Badge>
                  <div className="mb-8">
                    <span className="text-gray-400 text-lg text-balance">Investimento Único</span>
                    <div className="text-6xl font-black text-white my-2">R$ 6.000</div>
                    <span className="text-yellow-500 font-bold uppercase tracking-widest text-sm">Acesso por 12 meses</span>
                  </div>
                  
                  <div className="py-6 border-y border-white/5 mb-8">
                    <p className="text-gray-400 mb-2">Ou parcele no cartão:</p>
                    <div className="text-3xl font-bold text-white">12x de R$ 615</div>
                    <p className="text-gray-500 text-sm mt-2">Total parcelado: R$ 7.388,26</p>
                  </div>

                  <ul className="text-left space-y-4 mb-10">
                    {[
                      "Vendas ILIMITADAS de clientes",
                      "Liberação de Teste Grátis para prospectos",
                      "Passo a passo completo de vendas",
                      "Faturamento Anual Est. R$ 238 mil líquido",
                      "Nossa Marca e Identidade Visual",
                      "Painel de Parceiro para Gestão Total"
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-gray-300">
                        <CheckCircle2 className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                        <span className="text-sm md:text-base font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>

                  <Button 
                    onClick={handlePartnerContact}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-black h-14 rounded-2xl text-lg shadow-lg shadow-yellow-500/20 transition-all hover:scale-[1.02]"
                  >
                    QUERO MINHA FRANQUIA AGORA
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Profit Calculator Section */}
      <section className="py-24 px-4 relative overflow-hidden bg-black">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">SIMULADOR DE <span className="text-yellow-500">LUCRO</span></h2>
            <p className="text-gray-400 text-lg">Veja quanto você pode faturar sendo um parceiro oficial</p>
          </div>

          <Card className="bg-zinc-950 border-white/10 rounded-[40px] overflow-hidden p-8 md:p-12 relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Calculator className="w-32 h-32 text-yellow-500" />
            </div>
            
            <CardContent className="space-y-12">
              <ProfitCalculator />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-4 relative overflow-hidden">
        <div className="max-w-5xl mx-auto rounded-[50px] bg-gradient-to-b from-yellow-500 to-yellow-600 p-1 lg:p-[1px]">
          <div className="bg-black rounded-[49px] p-12 lg:p-24 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500/10 blur-[50px] md:blur-[100px] -mr-48 -mt-48 rounded-full" />
            
            <Rocket className="w-16 h-16 text-yellow-500 mx-auto mb-8 animate-bounce" />
            <h2 className="text-4xl md:text-6xl font-black mb-8">
              MAIS VENDAS. <br />
              <span className="text-yellow-500">MAIS RESULTADOS.</span>
            </h2>
            <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
              Tenha sua própria franquia MRO. O mercado de automação para Instagram é o que mais cresce hoje. Não perca tempo.
            </p>
            <Button 
              size="lg" 
              onClick={handlePartnerContact}
              className="bg-white hover:bg-gray-100 text-black font-black h-16 px-12 rounded-2xl text-xl transition-all hover:scale-105"
            >
              QUERO MINHA FRANQUIA
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <Instagram className="w-6 h-6 text-yellow-500" />
            <span className="font-bold text-xl">PARCEIRO <span className="text-yellow-500">OFICIAL</span></span>
          </div>
          <p className="text-gray-500 text-sm">© 2026 Todos os direitos reservados. MRO Inteligente.</p>
          <div className="flex gap-6">
            <a href="#" className="text-gray-400 hover:text-yellow-500 transition-colors">Termos</a>
            <a href="#" className="text-gray-400 hover:text-yellow-500 transition-colors">Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WhiteLabel;