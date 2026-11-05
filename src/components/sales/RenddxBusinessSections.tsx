import { useState } from "react";
import {
  Sparkles, LayoutDashboard, Search, Zap, FileSignature, Utensils, Scissors, Dumbbell,
  Stethoscope, Shirt, Home, Briefcase, Wrench, Building2, ArrowRight, ChevronDown, UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const portfolio = [
  { n: 5, p: 600 }, { n: 5, p: 1000 }, { n: 10, p: 600 }, { n: 10, p: 1000 },
];

const services = [
  { icon: Sparkles, title: "Criação de conteúdo com IA", items: ["Estratégias de conteúdo", "Posts únicos", "Carrosséis automáticos", "Imagens para Instagram", "Planejamento do mês", "Programação de publicações"], benefit: "Atenda empresas que não têm tempo nem equipe para produzir conteúdo." },
  { icon: LayoutDashboard, title: "Gerenciamento de Instagram", items: ["Planejamento de publicações", "Organização de contas", "Estratégia de presença digital", "Acompanhamento de atividades", "Programação de Stories"], benefit: "Ajude empresas a manter uma presença profissional e constante." },
  { icon: Search, title: "Prospecção ativa", items: ["Identificação de públicos", "Prospecção de interessados", "Estratégias de interação", "Ações comerciais"], benefit: "Gere novas oportunidades de relacionamento e negócios." },
  { icon: Zap, title: "Automação e engajamento", items: ["Curtidas automatizadas", "Seguir e deixar de seguir", "Reagir a Stories", "Remover seguidores falsos"], benefit: "Otimize tarefas repetitivas, respeitando os limites do Instagram." },
  { icon: FileSignature, title: "Contratos mensais", items: ["Conteúdo + gerenciamento", "Planejamento mensal", "Engajamento e prospecção", "Acompanhamento de resultados"], benefit: "Monte pacotes recorrentes e construa sua carteira." },
];

const segments = [
  { icon: Utensils, label: "Restaurantes e pizzarias" }, { icon: Scissors, label: "Salões de beleza" },
  { icon: Scissors, label: "Barbearias" }, { icon: Dumbbell, label: "Academias" },
  { icon: Stethoscope, label: "Clínicas e consultórios" }, { icon: Shirt, label: "Lojas de roupas" },
  { icon: Home, label: "Imobiliárias" }, { icon: UserCheck, label: "Corretores" },
  { icon: Wrench, label: "Prestadores de serviços" }, { icon: Building2, label: "Pequenas e médias empresas" },
];

const steps = [
  ["Adquira sua MRO", "Tenha acesso à plataforma e configure suas contas."],
  ["Encontre empresas", "Apresente seus serviços a comércios e profissionais da sua região ou de qualquer lugar."],
  ["Monte sua proposta", "Defina serviços, valores e entregas mensais."],
  ["Execute com a MRO", "Use IA, automação e gerenciamento para facilitar a operação."],
  ["Desenvolva sua carteira", "Atenda, acompanhe as entregas e busque novos clientes."],
];

const faqs = [
  ["Preciso ter experiência com marketing?", "Não é obrigatório. Você recebe o passo a passo de uso e o treinamento de gestão para empresas."],
  ["Quantas contas eu recebo?", "3 contas fixas durante os 12 meses, mais 5 contas de teste. Cada teste dura até 6 horas e os testes renovam a cada 30 dias."],
  ["É mensalidade?", "Não. É pagamento único e você tem acesso por 12 meses."],
  ["Os ganhos são garantidos?", "Não. As simulações são ilustrativas; o resultado depende dos clientes que você conquistar, dos serviços e dos seus custos."],
  ["Preciso de computador?", "Sim, a ferramenta funciona pelo computador/notebook com o navegador Chrome."],
  ["Quando recebo o acesso?", "Logo após a confirmação do pagamento, por e-mail."],
];

export function RenddxBusinessSections({ onCta }: { onCta: () => void }) {
  const [companies, setCompanies] = useState(5);
  const [price, setPrice] = useState(800);
  const [open, setOpen] = useState<number | null>(0);
  const monthly = companies * price;

  const H = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-2xl sm:text-4xl font-black text-center mb-4 leading-tight">{children}</h2>
  );

  return (
    <>
      {/* Carteira de clientes */}
      <section className="py-16 sm:py-20 px-3 sm:px-4 bg-black">
        <div className="max-w-5xl mx-auto">
          <H>QUANTO PODERIA REPRESENTAR UMA <span className="text-yellow-400">CARTEIRA DE CLIENTES?</span></H>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-10">Monte seus pacotes, defina seus preços e cobre mensalmente. Você pode começar com poucas empresas e crescer aos poucos.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {portfolio.map((c, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center">
                <div className="text-white font-black text-lg">{c.n} EMPRESAS</div>
                <div className="text-gray-400 text-xs sm:text-sm mb-3">{brl(c.p)} por empresa/mês</div>
                <div className="text-green-400 font-black text-2xl sm:text-3xl">{brl(c.n * c.p)}</div>
                <div className="text-gray-500 text-xs font-bold">MENSAIS</div>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-xs text-center mt-6 max-w-2xl mx-auto">Simulações ilustrativas de faturamento bruto. Não representam ganhos garantidos. Os resultados dependem da conquista e retenção de clientes, dos serviços oferecidos e dos custos da operação.</p>
        </div>
      </section>

      {/* O que vender */}
      <section className="py-16 sm:py-20 px-3 sm:px-4 bg-zinc-950">
        <div className="max-w-6xl mx-auto">
          <H>VOCÊ NÃO PRECISA VENDER UMA FERRAMENTA. <span className="text-yellow-400">VOCÊ PODE VENDER SOLUÇÕES!</span></H>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-10">A MRO é a sua estrutura tecnológica para executar diferentes serviços de marketing digital.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map(({ icon: Icon, title, items, benefit }) => (
              <div key={title} className="bg-zinc-900 border border-zinc-800 hover:border-yellow-400/50 transition-colors rounded-2xl p-6">
                <div className="w-11 h-11 rounded-xl bg-yellow-400/10 flex items-center justify-center mb-4"><Icon className="w-6 h-6 text-yellow-400" /></div>
                <h3 className="font-black text-lg mb-3">{title}</h3>
                <ul className="text-gray-300 text-sm space-y-1 mb-4">{items.map((t) => <li key={t}>• {t}</li>)}</ul>
                <p className="text-yellow-400/90 text-sm font-semibold">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Segmentos */}
      <section className="py-16 sm:py-20 px-3 sm:px-4 bg-black">
        <div className="max-w-5xl mx-auto">
          <H>EMPRESAS DE TODOS OS SEGMENTOS <span className="text-yellow-400">PRECISAM DE MARKETING DIGITAL!</span></H>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-8">
            {segments.map(({ icon: Icon, label }) => (
              <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                <Icon className="w-7 h-7 text-yellow-400 mx-auto mb-2" />
                <div className="text-sm font-semibold">{label}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-300 mt-8 font-semibold">Toda empresa que quer conquistar clientes e fortalecer a presença digital pode precisar dos seus serviços.</p>
        </div>
      </section>

      {/* Como funciona */}
      <section className="py-16 sm:py-20 px-3 sm:px-4 bg-zinc-950">
        <div className="max-w-5xl mx-auto">
          <H>COMO FUNCIONA <span className="text-yellow-400">NA PRÁTICA?</span></H>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-10">Você não precisa montar uma agência nem desenvolver uma ferramenta própria.</p>
          <div className="grid sm:grid-cols-5 gap-4 relative">
            {steps.map(([t, d], i) => (
              <div key={t} className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <div className="w-9 h-9 rounded-full bg-yellow-400 text-black font-black flex items-center justify-center mb-3">{i + 1}</div>
                <h3 className="font-black mb-2">{t}</h3>
                <p className="text-gray-400 text-sm">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8">
            <h3 className="text-xl sm:text-2xl font-black mb-3">NÃO PRECISA TER UMA GRANDE AGÊNCIA PARA COMEÇAR.</h3>
            <p className="text-gray-400 max-w-2xl mx-auto mb-4">Comece sozinho, sem equipe, sem sistema próprio e sem estrutura física. Conheça as necessidades dos seus clientes e use ferramentas que facilitam o trabalho.</p>
            <p className="text-yellow-400 font-black">COMECE PEQUENO. DESENVOLVA SUA CARTEIRA. EVOLUA SUA OPERAÇÃO.</p>
          </div>
        </div>
      </section>

      {/* Calculadora */}
      <section className="py-16 sm:py-20 px-3 sm:px-4 bg-black">
        <div className="max-w-3xl mx-auto bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-10">
          <H>SIMULE O POTENCIAL DA <span className="text-yellow-400">SUA CARTEIRA</span></H>
          <label className="block font-bold mt-6 mb-2">Quantas empresas você deseja atender? <span className="text-yellow-400">{companies}</span></label>
          <input type="range" min={1} max={30} value={companies} onChange={(e) => setCompanies(Number(e.target.value))} className="w-full accent-yellow-400" aria-label="Quantidade de empresas" />
          <div className="font-bold mt-6 mb-2">Quanto pretende cobrar de cada empresa?</div>
          <div className="grid grid-cols-3 gap-2">
            {[600, 800, 1000].map((v) => (
              <button key={v} onClick={() => setPrice(v)} className={`rounded-xl py-3 font-bold border text-sm ${price === v ? "bg-yellow-400 text-black border-yellow-400" : "bg-black border-zinc-700 text-gray-300"}`}>{brl(v)}/mês</button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-8">
            <div className="bg-black rounded-2xl p-5 text-center border border-zinc-800">
              <div className="text-gray-400 text-xs font-bold">FATURAMENTO BRUTO MENSAL SIMULADO</div>
              <div className="text-green-400 font-black text-3xl mt-1">{brl(monthly)}</div>
            </div>
            <div className="bg-black rounded-2xl p-5 text-center border border-zinc-800">
              <div className="text-gray-400 text-xs font-bold">FATURAMENTO BRUTO EM 12 MESES</div>
              <div className="text-green-400 font-black text-3xl mt-1">{brl(monthly * 12)}</div>
            </div>
          </div>
          <p className="text-gray-500 text-xs text-center mt-4">Simulação ilustrativa. Não é promessa de ganhos.</p>
          <div className="mt-8 grid sm:grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl border border-yellow-400/40 p-4"><div className="text-xs text-gray-400 font-bold">MRO INTELIGENTE</div><div className="font-black text-xl text-yellow-400">R$300 / 12 meses</div></div>
            <div className="rounded-2xl border border-zinc-700 p-4"><div className="text-xs text-gray-400 font-bold">1 CONTRATO SIMULADO</div><div className="font-black text-xl text-green-400">R$600 / mês</div></div>
          </div>
          <p className="text-gray-400 text-sm text-center mt-4">A MRO é uma ferramenta de trabalho. Você decide quais serviços oferecer, quanto cobrar e como estruturar sua operação.</p>
          <div className="text-center mt-6">
            <Button onClick={onCta} className="btn-pulse-yellow px-8 py-6 rounded-2xl text-base sm:text-lg">QUERO MEU ACESSO ANUAL <ArrowRight className="ml-2 w-5 h-5" /></Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 px-3 sm:px-4 bg-zinc-950">
        <div className="max-w-3xl mx-auto">
          <H>PERGUNTAS <span className="text-yellow-400">FREQUENTES</span></H>
          <div className="space-y-2 mt-8">
            {faqs.map(([q, a], i) => (
              <div key={q} className="bg-zinc-900 border border-zinc-800 rounded-xl">
                <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex justify-between items-center p-4 text-left font-bold">
                  {q}<ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} />
                </button>
                {open === i && <p className="px-4 pb-4 text-gray-400 text-sm">{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
