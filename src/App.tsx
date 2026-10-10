import { useEffect } from "react";
import HubEntryGate from "@/components/HubEntryGate";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import HubReturnButton from "@/components/HubReturnButton";
import { getAdminData } from "./lib/adminConfig";
import { trackPageView } from "./lib/facebookTracking";

import Index from "./pages/Index";
import MeuNegocioPage from "./pages/MeuNegocio";
import RendaExtraPage from "./pages/RendaExtra";
import RendaExtraAasPage from "./pages/RendaExtraAas";
import RendaExtra2Page from "./pages/RendaExtra2Page";
import RendaExtrassPage from "./pages/RendaExtrassPage";
import RendaExtrassAdmin from "./pages/RendaExtrassAdmin";
import ZapMRO from "./pages/ZapMRO";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import MROFerramenta from "./pages/MROFerramenta";
import MROPagamento from "./pages/MROPagamento";
import MROObrigado from "./pages/MROObrigado";
import Vendas from "./pages/Vendas";
import VendasCompleta from "./pages/VendasCompleta";
import InstagramNovaAdmin from "./pages/InstagramNovaAdmin";
import InstagramNovaAdminEmail from "./pages/InstagramNovaAdminEmail";
import InstagramNovaEuro from "./pages/InstagramNovaEuro";
import InstagramNovaEuroAdmin from "./pages/InstagramNovaEuroAdmin";
import InstagramNovaPromo from "./pages/InstagramNovaPromo";
import InstagramNovaPromoo2 from "./pages/InstagramNovaPromoo2";
import Ferramentammmr from "./pages/Ferramentammmr";
import AfiliadosX from "./pages/AfiliadosX";
import AfiliadosXResumo from "./pages/AfiliadosXResumo";
import DescontoAlunosRendaExtra from "./pages/DescontoAlunosRendaExtra";
import DescontoAlunosRendaExtraMes from "./pages/DescontoAlunosRendaExtraMes";
import DescontoAlunosRendaExtraAdmin from "./pages/DescontoAlunosRendaExtraAdmin";
import DescontoAlunosRendaExtras from "./pages/DescontoAlunosRendaExtras";
import DescontoAlunosRendaExtrasss from "./pages/DescontoAlunosRendaExtrasss";
import RendaExtraDesconto from "./pages/RendaExtraDesconto";
import DescontoAlunosRendaExtrass from "./pages/DescontoAlunosRendaExtrass";
import InstagramPromoMila from "./pages/InstagramPromoMila";
import AffiliatePromoPage from "./pages/AffiliatePromoPage";
import AffiliateRendaExtraPromo from "./pages/AffiliateRendaExtraPromo";
import AffiliateResumo from "./pages/AffiliateResumo";
import PromoSwitcher from "./pages/PromoSwitcher";
import Membro from "./pages/Membro";
import Ligacao from "./pages/Ligacao";
import Obrigado from "./pages/Obrigado";
import ObrigadoZapmro from "./pages/ObrigadoZapmro";
import ZapMROVendas from "./pages/ZapMROVendas";
import ZapMROVendasProm from "./pages/ZapMROVendasProm";
import ZapmroVendasAdmin from "./pages/ZapmroVendasAdmin";
import Promo33 from "./pages/Promo33";
import Promo33Dashboard from "./pages/Promo33Dashboard";
import Promo33Obrigado from "./pages/Promo33Obrigado";
import Promo33Admin from "./pages/Promo33Admin";
import GestaoMensal from "./pages/GestaoMensal";
import AdminUsuario from "./pages/AdminUsuario";
import MelhorarPublico from "./pages/MelhorarPublico";
import Pagamento from "./pages/Pagamento";
import PagamentoObrigado from "./pages/PagamentoObrigado";
import PagamentoAdmin from "./pages/PagamentoAdmin";
import ComprouSeguidores from "./pages/ComprouSeguidores";
import MetodoSeguidorMembro from "./pages/MetodoSeguidorMembro";
import MetodoSeguidorAdmin from "./pages/MetodoSeguidorAdmin";
import ToolSelector from "./pages/ToolSelector";
import AreaDeMembros from "./pages/AreaDeMembros";
import AdsNews from "./pages/AdsNews";
import AdsNewsDash from "./pages/AdsNewsDash";
import AdsNewsAdmin from "./pages/AdsNewsAdmin";
import AdsNewsObrigado from "./pages/AdsNewsObrigado";
import AdsNewsObrigadoSaldo from "./pages/AdsNewsObrigadoSaldo";
import PoliticaCancelamento from "./pages/PoliticaCancelamento";
import WhatsAppLanding from "./pages/WhatsAppLanding";
import WhatsAppAdmin from "./pages/WhatsAppAdmin";
import BemVindoMembroVip from "./pages/BemVindoMembroVip";
import VendasCompletaPro from "./pages/VendasCompletaPro";
import TesteGratis from "./pages/TesteGratis";
import TesteGratisAdmin from "./pages/TesteGratisAdmin";
import TesteGratisUsuario from "./pages/TesteGratisUsuario";
import RendaExtra from "./pages/RendaExtra";
import RendaExtra2 from "./pages/RendaExtra2";
import RendaExtraAdmin from "./pages/RendaExtraAdmin";
import GrupoRendaExtra from "./pages/GrupoRendaExtra";
import RendaExtraLead from "./pages/RendaExtraLead";
import RendaExtraLeadWaRedirect from "./pages/RendaExtraLeadWaRedirect";
import RendaExtraLeadAdmin from "./pages/RendaExtraLeadAdmin";
import RendaExtraDescontoPage from "./pages/RendaExtraDescontoPage";
import RendaExtraDescontoPromoPage from "./pages/RendaExtraDescontoPromoPage";
import RendaExtraDescontoDuplicate from "./pages/RendaExtraDescontoDuplicate";
import Empresas from "./pages/Empresas";
import EmpresasAdmin from "./pages/EmpresasAdmin";
import PostsPrompts from "./pages/PostsPrompts";
import PostsPromptsAdmin from "./pages/PostsPromptsAdmin";
import PostsPromptsVend from "./pages/PostsPromptsVend";
import PostsComIA from "./pages/PostsComIA";
import PostsComIAAdmin from "./pages/PostsComIAAdmin";
import PostsComIALogin from "./pages/PostsComIALogin";
import AudiobooksObrigado from './pages/AudiobooksObrigado';
import PostsComIAMembros from "./pages/PostsComIAMembros";
import PostsComIAObrigado from "./pages/PostsComIAObrigado";
import RendaSaoVivo from "./pages/RendaSaoVivo";
import RendaSaoVivoObrigado from "./pages/RendaSaoVivoObrigado";
import RendaSaoVivoAdmin from "./pages/RendaSaoVivoAdmin";
import SalaoBel from "./pages/SalaoBel";
import SalaoBelObrigado from "./pages/SalaoBelObrigado";
import SalaoBelAdmin from "./pages/SalaoBelAdmin";
import Delivery from "./pages/Delivery";
import DeliveryObrigado from "./pages/DeliveryObrigado";
import DeliveryAdmin from "./pages/DeliveryAdmin";
import LocalVpp from "./pages/LocalVpp";
import LocalVppObrigado from "./pages/LocalVppObrigado";
import LocalVppAdmin from "./pages/LocalVppAdmin";

import ZapMROVendasObrigado from "./pages/ZapMROVendasObrigado";
import ZapMROPreCheckout from "./pages/ZapMROPreCheckout";
import AudiobooksPreCheckout from "./pages/AudiobooksPreCheckout";
import Eleitoral from "./pages/Eleitoral";
import EleitoralAdmin from "./pages/EleitoralAdmin";
import Renddx from "./pages/Renddx";
import RenddxAdmin from "./pages/RenddxAdmin";
import RendaExxxtra from "./pages/RendaExxxtra";
import RendaExxxtraAdmin from "./pages/RendaExxxtraAdmin";
import Lovablack from "./pages/Lovablack";
import LotarGrupos from "./pages/LotarGrupos";
import Tesvc from "./pages/Tesvc";
import PagamentoTesvc from "./pages/PagamentoTesvc";
import PagamentoTesvcObrigado from "./pages/PagamentoTesvcObrigado";


import LotarGruposLogin from "./pages/LotarGruposLogin";
import LotarGruposDashboard from "./pages/LotarGruposDashboard";
import LotarGruposLessonView from "./pages/LotarGruposLessonView";
import LotarGruposObrigado from "./pages/LotarGruposObrigado";
import LotarGruposPreCheckout from "./pages/LotarGruposPreCheckout";
import RecuperarSenha from "./pages/RecuperarSenha";

import RendaExt from "./pages/RendaExt";

import RendaExtAdmin from "./pages/RendaExtAdmin";
import RendaExtraOf from "./pages/RendaExtraOf";
import CorretorMRO from "./pages/CorretorMRO";
import CorretorMROAdmin from "./pages/CorretorMROAdmin";
import CorretorMROObrigado from "./pages/CorretorMROObrigado";
import RateLimitHard from "./pages/RateLimitHard";
import InteligenciaFotos from "./pages/InteligenciaFotos";
import InteligenciaFotosDashboard from "./pages/InteligenciaFotosDashboard";
import InteligenciaFotosAdmin from "./pages/InteligenciaFotosAdmin";
import InstagramNovaP from "./pages/InstagramNovaP";
import Live from "./pages/Live";
import LiveAdmin from "./pages/LiveAdmin";
import Livve from "./pages/Livve";
import LivveAdmin from "./pages/LivveAdmin";
import LicencaAdmin from "./pages/LicencaAdmin";
import PromptsMRO from "./pages/PromptsMRO";
import PromptsMROAdmin from "./pages/PromptsMROAdmin";
import PromptsMRODashboard from "./pages/PromptsMRODashboard";
import PromptsIN from "./pages/PromptsIN";
import PromptsINAdmin from "./pages/PromptsINAdmin";
import PromptsINDashboard from "./pages/PromptsINDashboard";
import PoliticaDePrivacidadeIG from "./pages/PoliticaDePrivacidadeIG";
import MRODirectMais from "./pages/MRODirectMais";
import IAVendeMais from "./pages/IAVendeMais";
import IAVendeMaisAdmin from "./pages/IAVendeMaisAdmin";
import RendaExtraLigacao from "./pages/RendaExtraLigacao";
import RendaExtraLigacaoAdmin from "./pages/RendaExtraLigacaoAdmin";
import Relatorios from "./pages/Relatorios";
import EstruturaRendaExtra from "./pages/EstruturaRendaExtra";
import EstruturaRendaExtra4 from "./pages/EstruturaRendaExtra4";
import EstruturaRendaExtra4Admin from "./pages/EstruturaRendaExtra4Admin";
import WhatsAppDireto from "./pages/WhatsAppDireto";
import WhatsappVxLinkDireto from "./pages/WhatsappVxLinkDireto";
import ApiWhatsAppAccess from "./pages/ApiWhatsAppAccess";
import RendaExtraAula from "./pages/RendaExtraAula";
import RendaExtraAulaAdmin from "./pages/RendaExtraAulaAdmin";
import Addmin from "./pages/Addmin";
import TokenIA from "./pages/TokenIA";
import RendaExtObrigado from "./pages/RendaExtObrigado";
import CRM from "./pages/CRM";
import CRMLogin from "./pages/CRMLogin";
import MROCriativo from "./pages/MROCriativo";
import MROCriativoAdmin from "./pages/MROCriativoAdmin";
import MROCriativoTerms from "./pages/MROCriativoTerms";
import MROCriativoPrivacy from "./pages/MROCriativoPrivacy";
import MROCriativoCallback from "./pages/MROCriativoCallback";
import MROCriativoWebhook from "./pages/MROCriativoWebhook";
import MROCriativoOAuth from "./pages/MROCriativoOAuth";
import GoogleContactsCallback from "./pages/GoogleContactsCallback";
import WhiteLabel from "./pages/WhiteLabel";
import PartnerDashboard from "./pages/PartnerDashboard";
import Dashboard from "./pages/Dashboard";
import DashboardProduto from "./pages/DashboardProduto";

import InstagramNovaPlan from "./pages/InstagramNovaPlan";
import InstagrammNew from "./pages/InstagrammNew";
import InstagramNovaWS from "./pages/InstagramNovaWS";
import InstagramPromo30Dias from "./pages/InstagramPromo30Dias";
import ThorCreativeDashboard from "./pages/ThorCreative/Dashboard";
import Atualizar from "./pages/Atualizar";
import Licenciado from "./pages/Licenciado";
import VenderNaInternet from "./pages/VenderNaInternet";
import VenderLogin from "./pages/VenderLogin";
import VenderAdmin from "./pages/VenderAdmin";
import VenderObrigado from "./pages/VenderObrigado";
import CreatorDev from "./pages/CreatorDev";
import CreatorDevProject from "./pages/CreatorDevProject";
import CreatorDevAdmin from "./pages/CreatorDevAdmin";
import ZapZap from "./pages/ZapZap";
import ZapZapAdmin from "./pages/ZapZapAdmin";
import GrupoWhatsapp from "./pages/GrupoWhatsapp";
import GrupoWhatsappAdmin from "./pages/GrupoWhatsappAdmin";
import Teste002 from "./pages/Teste002";
import Teste002Dashboard from "./pages/Teste002Dashboard";
import Teste002Admin from "./pages/Teste002Admin";
import Whitelabel from "./pages/WhitelabelPainel";
import WhitelabelCheckout from "./pages/WhitelabelCheckout";
import WhitelabelSales from "./pages/WhitelabelSales";
import ComercialAAF from "./pages/ComercialAAF";
import ComercialAAFAdmin from "./pages/ComercialAAFAdmin";
import MktCompleto from "./pages/MktCompleto";
import MktCC from "./pages/MktCC";
import MktCCAdmin from "./pages/MktCCAdmin";
import FerramentaMROPromo from "./pages/FerramentaMROPromo";
import FerramentaMROPromoAdmin from "./pages/FerramentaMROPromoAdmin";
import Dloar from "./pages/Dloar";
import PagamentoMRO from "./pages/PagamentoMRO";
import PagamentoMROObrigado from "./pages/PagamentoMROObrigado";
import AgenteMRO from "./pages/AgenteMRO";
import AgenteMROPainel from "./pages/AgenteMROPainel";
import IgRoutes from "./pages/ig/IgRoutes";

import TrafegoPagoVisitas from "./pages/TrafegoPagoVisitas";
import TrafegoPagoObrigado from "./pages/TrafegoPagoObrigado";
import AudiobooksSales from "./pages/AudiobooksSales";
import AudiobooksAdmin from "./pages/AudiobooksAdmin";






const queryClient = new QueryClient();

// Facebook Pixel Route Tracking component
const FacebookPixelHandler = () => {
  const location = useLocation();

  useEffect(() => {
    const adminData = getAdminData();
    const pixelId = adminData?.settings?.pixelSettings?.pixelId || '569414052132145';
    const isEnabled = adminData?.settings?.pixelSettings?.enabled !== false;

    if (!isEnabled) return;

    if (typeof window !== 'undefined' && (window as any).fbq) {
      // Re-initialize if needed or just track
      // (Meta says calling init twice is fine and helps ensure the ID is correct)
      (window as any).fbq('init', pixelId);
      
      // Track PageView on route change
      // Only track if it's not the first load (to avoid double tracking with index.html)
      // or just rely on this one and remove it from index.html if possible.
      // But actually, trackPageView is already called in many page components' useEffect.
      // So this global handler might cause double tracking if pages also have it.
    }
  }, [location.pathname]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <HubReturnButton />
        <Routes>
          <Route path="/" element={<ToolSelector />} />
          <Route path="/instagram" element={<HubEntryGate><MeuNegocioPage /></HubEntryGate>} />
          <Route path="/instagram/painel" element={<Index />} />
          <Route path="/meu-negocio" element={<MeuNegocioPage />} />
          <Route path="/renda-extra" element={<RendaExtraPage />} />
          <Route path="/renda-extra2" element={<Navigate to="/ferramentamropromo2" replace />} />
          <Route path="/renda-extrass" element={<RendaExtrassPage />} />
          <Route path="/renda-extrass/admin" element={<RendaExtrassAdmin />} />
          <Route path="/zapmro" element={<HubEntryGate><ZapMRO /></HubEntryGate>} />
          <Route path="/zapmro/vendas" element={<ZapMROVendas />} />
          <Route path="/zapmro/vendas/prom" element={<ZapMROVendasProm />} />
          <Route path="/zapmro/vendas/admin" element={<ZapmroVendasAdmin />} />
          <Route path="/zapmro/vendas/checkout" element={<ZapMROPreCheckout />} />
          <Route path="/zapmro/vendas/obrigado" element={<ZapMROVendasObrigado />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/mro-ferramenta" element={<HubEntryGate allowEmbed><MROFerramenta /></HubEntryGate>} />
          <Route path="/mropagamento" element={<MROPagamento />} />
          <Route path="/mroobrigado" element={<MROObrigado />} />
          <Route path="/mro-obrigado" element={<MROObrigado />} />
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/instagram-nova" element={<Navigate to="/ferramentamropromo2" replace />} />
          <Route path="/pagamentomro" element={<PagamentoMRO />} />
          <Route path="/pagamentomro/obrigado" element={<PagamentoMROObrigado />} />
          <Route path="/instagram-nova-ws" element={<InstagramNovaWS />} />
          <Route path="/instagrampromo" element={<InstagramPromo30Dias />} />
          <Route path="/instagram-nova-admin" element={<InstagramNovaAdmin />} />
          <Route path="/instagram-nova-admin/email" element={<InstagramNovaAdminEmail />} />
          <Route path="/instagram-nova-euro" element={<InstagramNovaEuro />} />
          <Route path="/instagram-nova-euro-admin" element={<InstagramNovaEuroAdmin />} />
          <Route path="/instagram-nova-promo" element={<InstagramNovaPromo />} />
          <Route path="/afiliadosx" element={<AfiliadosX />} />
          <Route path="/afiliadosx/resumo" element={<AfiliadosXResumo />} />
          <Route path="/instagram-nova-promoo2" element={<InstagramNovaPromoo2 />} />
          <Route path="/ferramentamropromo" element={<Ferramentammmr />} />
          <Route path="/dloar" element={<Dloar />} />
          <Route path="/instagram-nova-p" element={<InstagramNovaP />} />
          <Route path="/instagramm-nova" element={<InstagramNovaPlan />} />
          <Route path="/instagrammnew" element={<InstagrammNew />} />
          <Route path="/instagram-promo-mila" element={<InstagramPromoMila />} />
          <Route path="/promo/:affiliateId" element={<InstagramNovaPlan />} />
          <Route path="/resumo/:affiliateId" element={<AffiliateResumo />} />
          <Route path="/promorendaextra/:affiliateId" element={<AffiliateRendaExtraPromo />} />
          <Route path="/promorendaextra" element={<AffiliateRendaExtraPromo />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/produto/:slug" element={<DashboardProduto />} />
          <Route path="/parceiro/:slug" element={<PartnerDashboard />} />

          <Route path="/dash/:slug" element={<PartnerDashboard />} />
          <Route path="/resumo-parceiro/:slug" element={<PartnerDashboard />} />
          <Route path="/mrointeligente" element={<VendasCompleta />} />
          <Route path="/membro" element={<Membro />} />
          <Route path="/ligacao" element={<Ligacao />} />
          <Route path="/obrigado" element={<Obrigado />} />
          <Route path="/obrigadozapmro" element={<ObrigadoZapmro />} />
          <Route path="/promo33" element={<Promo33 />} />
          <Route path="/promo33/dashboard" element={<Promo33Dashboard />} />
          <Route path="/promo33/obrigado" element={<Promo33Obrigado />} />
          <Route path="/promo33/admin" element={<Promo33Admin />} />
          <Route path="/gestaomensal" element={<GestaoMensal />} />
          <Route path="/adminusuario" element={<AdminUsuario />} />
          <Route path="/melhorarpublico" element={<MelhorarPublico />} />
          <Route path="/pagamento" element={<Pagamento />} />
          <Route path="/pagamentoobrigado" element={<PagamentoObrigado />} />
          <Route path="/pagamentoadmin" element={<PagamentoAdmin />} />
          <Route path="/comprouseguidores" element={<ComprouSeguidores />} />
          <Route path="/metodoseguidormembro" element={<MetodoSeguidorMembro />} />
          <Route path="/metodoseguidoradmin" element={<MetodoSeguidorAdmin />} />
          <Route path="/areademembros" element={<AreaDeMembros />} />
          <Route path="/anuncios" element={<AdsNews />} />
          <Route path="/anuncios/dash" element={<AdsNewsDash />} />
          <Route path="/anuncios/admin" element={<AdsNewsAdmin />} />
          <Route path="/anuncios/obrigado" element={<AdsNewsObrigado />} />
          <Route path="/anuncios/obrigado-saldo" element={<AdsNewsObrigadoSaldo />} />
          <Route path="/politica-de-cancelamento" element={<PoliticaCancelamento />} />
          
          <Route path="/whatsapp" element={<WhatsAppLanding />} />
          <Route path="/whatsapp/admin" element={<WhatsAppAdmin />} />
          <Route path="/seja-bem-vindo-membro-vip" element={<BemVindoMembroVip />} />
          <Route path="/instagram-nova-pro" element={<VendasCompletaPro />} />
          <Route path="/testegratis" element={<TesteGratis />} />
          <Route path="/testegratis/admin" element={<TesteGratisAdmin />} />
          <Route path="/testegratis/usuario" element={<TesteGratisUsuario />} />
          <Route path="/rendaextra" element={<RendaExtraLead />} />
          <Route path="/rendaextrasoc" element={<RendaExtraLead source="social_midia" />} />
          <Route path="/rendaextraaas" element={<RendaExtraAasPage />} />
          <Route path="/rendaextra/admin" element={<RendaExtraLeadAdmin />} />
          <Route path="/rendaextra/desconto" element={<RendaExtraDescontoPage />} />
          <Route path="/rendaextra-desconto" element={<RendaExtraDescontoPage />} />
          <Route path="/rendaextra/desconto/promo" element={<RendaExtraDescontoPromoPage />} />
          <Route path="/renddx" element={<Renddx />} />
          <Route path="/renddx/admin" element={<RenddxAdmin />} />
          <Route path="/rendaexxxtra" element={<RendaExxxtra />} />
          <Route path="/rendaexxxtra/admin" element={<RendaExxxtraAdmin />} />
          <Route path="/renddx/access" element={<RendaExtraDescontoDuplicate />} />
          <Route path="/rendaextralead" element={<RendaExtraLead />} />
          <Route path="/rendaextralead/admin" element={<RendaExtraLeadAdmin />} />
          <Route path="/r/rxl-wa" element={<RendaExtraLeadWaRedirect />} />
          <Route path="/grupo-rendaextra" element={<GrupoRendaExtra />} />
          <Route path="/grupo/rendaextra" element={<GrupoRendaExtra />} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/empresas/admin" element={<EmpresasAdmin />} />
          <Route path="/rendaextra2" element={<RendaExtra2 />} />
          <Route path="/rendaextra2/admin" element={<RendaExtraAdmin />} />
          <Route path="/rendaext" element={<RendaExt />} />
          <Route path="/rendaext/admin" element={<RendaExtAdmin />} />
          <Route path="/rendaext/obrigado" element={<RendaExtObrigado />} />
          <Route path="/rendaextraof" element={<RendaExtraOf />} />

          <Route path="/corretormro" element={<CorretorMRO />} />
          <Route path="/corretormro/admin" element={<CorretorMROAdmin />} />
          <Route path="/corretormro/obrigado" element={<CorretorMROObrigado />} />
          <Route path="/RateLimitHard" element={<RateLimitHard />} />
          <Route path="/inteligenciafotos" element={<InteligenciaFotos />} />
          <Route path="/inteligenciafotos/dashboard" element={<InteligenciaFotosDashboard />} />
          <Route path="/inteligenciafotos/admin" element={<InteligenciaFotosAdmin />} />
          <Route path="/live" element={<Live />} />
          <Route path="/live/admin" element={<LiveAdmin />} />
          <Route path="/livve" element={<Livve />} />
          <Route path="/livve/admin" element={<LivveAdmin />} />
          <Route path="/licencaadmin" element={<LicencaAdmin />} />
          <Route path="/prompts" element={<PromptsMRO />} />
          <Route path="/prompts/admin" element={<PromptsMROAdmin />} />
          <Route path="/prompts/dashboard" element={<PromptsMRODashboard />} />
          <Route path="/promptsin" element={<PromptsIN />} />
          <Route path="/promptsin/admin" element={<PromptsINAdmin />} />
          <Route path="/promptsin/dashboard" element={<PromptsINDashboard />} />
          <Route path="/politicasdeprivacidadeig" element={<PoliticaDePrivacidadeIG />} />
          <Route path="/mrodirectmais" element={<MRODirectMais />} />
          <Route path="/Iavendemais" element={<IAVendeMais />} />
          <Route path="/Iavendemais/admin" element={<IAVendeMaisAdmin />} />
          <Route path="/rendaextraligacao" element={<RendaExtraLigacao />} />
          <Route path="/rendaextraligacao/admin" element={<RendaExtraLigacaoAdmin />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/descontoalunosrendaextra" element={<DescontoAlunosRendaExtra />} />
          <Route path="/descontoalunosrendaextra/admin" element={<DescontoAlunosRendaExtraAdmin />} />
          <Route path="/descontoalunosrendaextrames" element={<DescontoAlunosRendaExtraMes />} />
          <Route path="/descontoalunosrendaextras" element={<DescontoAlunosRendaExtras />} />
          <Route path="/descontoalunosrendaextrasss" element={<DescontoAlunosRendaExtrasss />} />
          <Route path="/rendaextradesconto" element={<RendaExtraDesconto />} />
          <Route path="/descontoalunosrendaextrass" element={<DescontoAlunosRendaExtrass />} />
          <Route path="/estruturarendaextra" element={<HubEntryGate><EstruturaRendaExtra /></HubEntryGate>} />
          <Route path="/estruturarendaextra4" element={<Navigate to="/ferramentamropromo2" replace />} />
          <Route path="/estruturarendaextra4/admin" element={<EstruturaRendaExtra4Admin />} />
          <Route path="/whatsappdireto" element={<WhatsAppDireto />} />
          <Route path="/whatsappvxlinkdireto" element={<WhatsappVxLinkDireto />} />
          <Route path="/apiwhatsappacess" element={<ApiWhatsAppAccess />} />
          
          <Route path="/rendaextraaula" element={<RendaExtraAula />} />
          <Route path="/rendaextraaula/admin" element={<RendaExtraAulaAdmin />} />
          <Route path="/addmin" element={<Addmin />} />
          <Route path="/tokenia" element={<TokenIA />} />
          <Route path="/crm" element={<CRM />} />
          <Route path="/crm/login" element={<CRMLogin />} />
          <Route path="/mrocriativo" element={<MROCriativo />} />
          <Route path="/mrocriativo/admin" element={<MROCriativoAdmin />} />
          <Route path="/mrocriativo/terms.php" element={<MROCriativoTerms />} />
          <Route path="/mrocriativo/privacy.php" element={<MROCriativoPrivacy />} />
          <Route path="/mrocriativo/callback.php" element={<MROCriativoCallback />} />
          <Route path="/mrocriativo/webhook.php" element={<MROCriativoWebhook />} />
          <Route path="/mrocriativo/oauth.php" element={<MROCriativoOAuth />} />
          <Route path="/google-callback" element={<GoogleContactsCallback />} />
          <Route path="/google-callback2" element={<GoogleContactsCallback />} />
          <Route path="/seja-parceiro" element={<WhiteLabel />} />
          <Route path="/parceiro-oficial" element={<WhiteLabel />} />
          <Route path="/parceirooficial" element={<WhiteLabel />} />
          <Route path="/creatordev" element={<CreatorDev />} />
          <Route path="/creatordev/projeto" element={<CreatorDevProject />} />

          <Route path="/creatordev/admin" element={<CreatorDevAdmin />} />
          <Route path="/postsprompts" element={<PostsPrompts />} />
          <Route path="/postsprompts/admin" element={<PostsPromptsAdmin />} />
          <Route path="/postspromptsvend" element={<PostsPromptsVend />} />
          <Route path="/postscomia" element={<PostsComIA />} />
          <Route path="/postscomia/admin" element={<PostsComIAAdmin />} />
          <Route path="/postscomia/login" element={<PostsComIALogin />} />
          <Route path="/postscomia/membros" element={<PostsComIAMembros />} />
          <Route path="/postscomia/obrigado" element={<PostsComIAObrigado />} />
          <Route path="/rendasaovivo" element={<RendaSaoVivo />} />
          <Route path="/rendasaovivo/obrigado" element={<RendaSaoVivoObrigado />} />
          <Route path="/rendasaovivo/admin" element={<RendaSaoVivoAdmin />} />
          <Route path="/salaobel" element={<SalaoBel />} />
          <Route path="/salaobel/obrigado" element={<SalaoBelObrigado />} />
          <Route path="/salaobel/admin" element={<SalaoBelAdmin />} />
          <Route path="/delivery" element={<Delivery />} />
          <Route path="/delivery/obrigado" element={<DeliveryObrigado />} />
          <Route path="/delivery/admin" element={<DeliveryAdmin />} />
          <Route path="/localvpp" element={<LocalVpp />} />
          <Route path="/localvpp/obrigado" element={<LocalVppObrigado />} />
          <Route path="/localvpp/admin" element={<LocalVppAdmin />} />



          <Route path="/thorcriative" element={<ThorCreativeDashboard />} />
          <Route path="/atualizar" element={<Atualizar />} />
          <Route path="/atualizarver" element={<Atualizar />} />
          <Route path="/licenciado" element={<Licenciado />} />
          <Route path="/vendernainternet" element={<VenderNaInternet />} />
          <Route path="/vendernainternet/login" element={<VenderLogin />} />
          <Route path="/vendernainternet/admin" element={<VenderAdmin />} />
          <Route path="/vendernainternet/obrigado" element={<VenderObrigado />} />



          
          <Route path="/zapzap" element={<ZapZap />} />
          <Route path="/zapzap/admin" element={<ZapZapAdmin />} />
          <Route path="/grupowhatsapp" element={<GrupoWhatsapp />} />
          <Route path="/whitelabel" element={<Whitelabel />} />
          <Route path="/whitelabel/vendas" element={<WhitelabelSales />} />
          <Route path="/wl/:code" element={<WhitelabelCheckout />} />
          <Route path="/grupowhatsapp/admin" element={<GrupoWhatsappAdmin />} />
          <Route path="/teste002" element={<Teste002 />} />
          <Route path="/teste002/dashboard" element={<Teste002Dashboard />} />
          <Route path="/teste002/admin" element={<Teste002Admin />} />
          <Route path="/comercialaaf" element={<ComercialAAF />} />
          <Route path="/comercialaaf/admin" element={<ComercialAAFAdmin />} />
          <Route path="/mktcompleto" element={<MktCompleto />} />
          <Route path="/mktcc" element={<MktCC />} />
          <Route path="/mktcc/admin" element={<MktCCAdmin />} />
          <Route path="/ferramentamropromo2" element={<FerramentaMROPromo />} />
          <Route path="/ferramentamropromo/admin" element={<FerramentaMROPromoAdmin />} />
          <Route path="/ferramentamropromo/video" element={<FerramentaMROPromoAdmin />} />
          <Route path="/eleitoral" element={<Eleitoral />} />
          <Route path="/eleitoral/admin" element={<EleitoralAdmin />} />
          <Route path="/trafegopagovisitas" element={<TrafegoPagoVisitas />} />
          <Route path="/lovablack" element={<Lovablack />} />
          <Route path="/lotargrupos" element={<LotarGrupos />} />
          <Route path="/tesvc" element={<Tesvc />} />
          <Route path="/pagamentotesvc" element={<PagamentoTesvc />} />
          <Route path="/pagamentotesvc/obrigado" element={<PagamentoTesvcObrigado />} />
          <Route path="/lotargrupos/checkout" element={<LotarGruposPreCheckout />} />
          <Route path="/lotargrupos/obrigado" element={<LotarGruposObrigado />} />
          <Route path="/lotargrupos/aula/:id" element={<LotarGruposLessonView />} />
          <Route path="/lotargrupos/checkout" element={<LotarGruposPreCheckout />} />
          <Route path="/lotargrupos/pre-checkout" element={<LotarGruposPreCheckout />} />
          <Route path="/login" element={<LotarGruposLogin />} />
          <Route path="/lotargrupos/login" element={<LotarGruposLogin />} />
          <Route path="/recuperar-senha" element={<RecuperarSenha />} />
          <Route path="/lotargrupos/dashboard" element={<LotarGruposDashboard />} />

          <Route path="/trafegopagovisitas/obrigado" element={<TrafegoPagoObrigado />} />
          <Route path="/audiobooks" element={<AudiobooksSales />} />
          <Route path="/audiobooks/checkout" element={<AudiobooksPreCheckout />} />
          <Route path="/audiobooks/admin" element={<AudiobooksAdmin />} />
          <Route path="/audiobooks/obrigado" element={<AudiobooksObrigado />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="/agentemro" element={<AgenteMRO />} />
          <Route path="/agentemro/painel" element={<AgenteMROPainel />} />
          {/* MRO INSTAGRAM — módulo isolado (rotas internas em IgRoutes) */}
          <Route path="/IG/*" element={<IgRoutes />} />
          <Route path="/ig/*" element={<IgRoutes />} />
          <Route path="*" element={<NotFound />} />

        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
