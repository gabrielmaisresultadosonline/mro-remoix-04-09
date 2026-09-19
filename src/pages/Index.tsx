import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginPage } from '@/components/LoginPage';
import { ProfileRegistration } from '@/components/ProfileRegistration';
import { Dashboard } from '@/components/Dashboard';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { AgeRestrictionDialog } from '@/components/AgeRestrictionDialog';
import { PrivateProfileDialog } from '@/components/PrivateProfileDialog';
import AnnouncementPopup from '@/components/AnnouncementPopup';
import { CadastrarContaButton } from '@/components/CadastrarContaButton';
import { Logo } from '@/components/Logo';
import { Rocket, Briefcase, Play, ArrowRight, X, User, Instagram, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MROSession, ProfileSession, InstagramProfile, ProfileAnalysis } from '@/types/instagram';
import {
  getSession, 
  saveSession, 
  hasExistingSession, 
  createEmptySession,
  addProfile,
  setActiveProfile,
  removeProfile,
  getActiveProfile,
  cleanExpiredCreatives,
  cleanExpiredStrategies,
  setCloudSyncCallback,
  reconcileProfilesWithRegisteredAccounts
} from '@/lib/storage';
import { 
  isAuthenticated, 
  getRegisteredIGs,
  isIGRegistered,
  addRegisteredIG,
  getCurrentUser,
  logoutUser,
  saveUserToCloud,
  reconcileRegisteredIGsWithSquare
} from '@/lib/userStorage';
import { verifyRegisteredIGs } from '@/lib/squareApi';
// API imports removed - profile data now comes from screenshot analysis
import { useToast } from '@/hooks/use-toast';
import { 
  loadPersistedDataOnLogin, 
  syncSessionToPersistent,
  hasPersistedProfileData,
  getPersistedProfile,
  persistProfileData,
  syncPersistentToSession
} from '@/lib/persistentStorage';
import { supabase } from '@/integrations/supabase/client';


const Index = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<MROSession>(createEmptySession());
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingSubMessage, setLoadingSubMessage] = useState('');
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | undefined>(undefined);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showInitialChoice, setShowDashboardChoice] = useState(false);
  const [showIAPopup, setShowIAPopup] = useState(false);
  const [showMeuNegocioOptions, setShowMeuNegocioOptions] = useState(false); // Legacy but kept for structure if needed
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasRegisteredProfiles, setHasRegisteredProfiles] = useState(false);
  const [ageRestrictionProfile, setAgeRestrictionProfile] = useState<string | null>(null);
  const [privateProfile, setPrivateProfile] = useState<string | null>(null);
  const [pendingSyncInstagrams, setPendingSyncInstagrams] = useState<string[]>([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showRendaExtraBonus, setShowRendaExtraBonus] = useState(false);
  const [showRendaExtraPopup, setShowRendaExtraPopup] = useState(false);
  const { toast } = useToast();

  // Get current logged in username
  const getLoggedInUsername = (): string => {
    const user = getCurrentUser();
    return user?.username || 'anonymous';
  };

  // Set up cloud sync callback on mount (critical for strategies/creatives persistence)
  useEffect(() => {
    setCloudSyncCallback(saveUserToCloud);
  }, []);

  // Check auth status on mount and load persisted data
  useEffect(() => {
    const initializeFromCloudData = async () => {
      try {
        const authenticated = isAuthenticated();
        setIsLoggedIn(authenticated);
        
        if (authenticated) {
          const registeredIGs = getRegisteredIGs();
          setHasRegisteredProfiles(registeredIGs.length > 0);
          
          // Just check the existing session - data should already be loaded
          const existingSession = getSession();
          
          console.log(`🔐 Auth check: ${registeredIGs.length} IGs registrados, ${existingSession.profiles.length} perfis na sessão`);
          
          // Clean expired data
          cleanExpiredCreatives();
          cleanExpiredStrategies();
          
          setSession(existingSession);
          
          // Logic for welcome screen vs dashboard
          const forceRegistration = localStorage.getItem('mro_force_registration') === 'true';
          const forceDashboard = localStorage.getItem('mro_force_dashboard') === 'true';
          
          if (forceRegistration) {
            console.log('🚀 Force Registration active');
            setShowDashboardChoice(false);
            setShowDashboard(false);
            // DO NOT cleanup here, consume it only when showing the registration screen
            setShowDashboardChoice(false);
            setShowDashboard(false);
            return; // STOP execution here for registration to prevent cloud sync from jumping


          } else if (forceDashboard) {
            console.log('📊 Force Dashboard active');
            setShowDashboardChoice(false);
            setShowDashboard(true);
            setShowAnnouncements(true);
          } else {
            // ALWAYS show welcome choice on refresh/load if not forced to a specific area
            console.log('🏠 Resetting to welcome choice on load');
            setShowDashboardChoice(true);
            setShowDashboard(false);
            // Cleanup dashboard flag if we're showing the choice
            localStorage.removeItem('mro_force_dashboard');
          }

          // Cleanup force flags after check
          if (forceDashboard) {
            localStorage.removeItem('mro_force_dashboard');
          }
          // Note: mro_force_registration is handled differently to keep the user on registration screen


          // FORCED UPDATE: Every time the user enters, sync with SquareCloud
          console.log("🔄 Entrou logado, forçando sincronização com SquareCloud...");
          const user = getCurrentUser();
          const squareResult = await verifyRegisteredIGs(user?.username || '');
          if (squareResult.success && squareResult.instagrams) {
            // Perfis ausentes da API permanecem disponíveis como histórico.
            const currentSession = reconcileProfilesWithRegisteredAccounts(squareResult.instagrams);
            setSession(currentSession);
            try {
              await syncSessionToPersistent(user?.username || '');
            } catch (e) {
              console.error('[Index] Error syncing reconciled session:', e);
            }

            // Also reconcile the active-account list without deleting history.
            const removedCount = await reconcileRegisteredIGsWithSquare(squareResult.instagrams);
            if (removedCount > 0) setHasRegisteredProfiles(currentSession.profiles.length > 0);

            if (squareResult.instagrams.length > 0) {
              handleSyncComplete(squareResult.instagrams);
            }
          }
        }

      } catch (error) {
        console.error('[Index] Error in auth check:', error);
        setIsLoggedIn(false);
      }
    };
    
    initializeFromCloudData();
  }, []);

  const handleLoginSuccess = async () => {
    setIsLoggedIn(true);
    
    try {
      // CRITICAL: Get authoritative list of IGs from SquareCloud
      const user = getCurrentUser();
      const squareResult = await verifyRegisteredIGs(user?.username || '');
      const squareIGs = squareResult.success && squareResult.instagrams ? squareResult.instagrams : [];
      const squareIGsSet = new Set(squareIGs.map(ig => ig.toLowerCase()));

      const registeredIGs = getRegisteredIGs();
      const existingSession = getSession();
      setHasRegisteredProfiles(
        squareIGs.length > 0
        || registeredIGs.length > 0
        || existingSession.profiles.length > 0
      );
      
      // IMPORTANT: LoginPage already called initializeFromCloud + reconciliation
      console.log(`🔐 Login completo: ${existingSession.profiles.length} perfis na sessão, ${squareIGs.length} IGs no SquareCloud`);
      
      if (existingSession.profiles.length > 0 || squareIGs.length > 0) {
        setSession(existingSession);
        setShowDashboardChoice(true);
        sessionStorage.setItem('mro_initial_choice_made', 'true');
        console.log(`☁️ Login completo - preparando escolha inicial`);
      } else if (squareIGs.length > 0) {
        // No cloud data but has registered profiles in SquareCloud - AUTO SYNC
        console.log(`🔄 Nenhum dado na nuvem, sincronizando ${squareIGs.length} perfis do SquareCloud...`);
        setIsLoading(true);
        setLoadingMessage('Sincronizando perfis...');
        setLoadingSubMessage(`Carregando ${squareIGs.length} perfis. Isso pode levar alguns minutos.`);
        
        await handleSyncComplete(squareIGs);
      } else {
        // No profiles at all - show registration screen
        setSession(existingSession);
      }
    } catch (error) {
      console.error('[Index] Error in handleLoginSuccess:', error);
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setIsLoggedIn(false);
    setShowDashboard(false);
    setHasRegisteredProfiles(false);
    setSession(createEmptySession());
  };

  const handleProfileRegistered = async (profile: InstagramProfile, analysis: ProfileAnalysis) => {
    const loggedInUsername = getLoggedInUsername();
    
    // Add profile to session
    addProfile(profile, analysis);
    
    // PERSIST DATA PERMANENTLY TO SERVER
    await persistProfileData(loggedInUsername, profile.username, profile, analysis);
    
    // Get updated session
    const updatedSession = getSession();
    setSession(updatedSession);
    setShowDashboard(true);
    setHasRegisteredProfiles(true);

    // Sync to server
    await syncSessionToPersistent(loggedInUsername);

    toast({
      title: "Perfil cadastrado! ✨",
      description: `@${profile.username} cadastrado. Agora envie o print para gerar a análise real.`,
    });
  };

  const handleSyncComplete = async (instagrams: string[]) => {
    setIsLoading(true);
    setLoadingMessage('Vinculando perfis...');
    setLoadingSubMessage(`Total: ${instagrams.length} conta${instagrams.length !== 1 ? 's' : ''}`);
    setSyncProgress({ current: 0, total: instagrams.length });
    
    const user = getCurrentUser();
    const loggedInUsername = getLoggedInUsername();
    let processedCount = 0;
    let restoredPrintCount = 0;
    
    for (const ig of instagrams) {
      processedCount++;
      setSyncProgress({ current: processedCount, total: instagrams.length });
      setLoadingMessage(`Vinculando @${ig}...`);
      setLoadingSubMessage(`${processedCount} de ${instagrams.length} conta${instagrams.length !== 1 ? 's' : ''}`);
      
      const normalizedIg = ig.toLowerCase();
      
      // Check if already in session
      const currentSession = getSession();
      const existingProfile = currentSession.profiles.find(
        p => p.profile.username.toLowerCase() === normalizedIg
      );
      
      if (existingProfile) {
        if (existingProfile.isHistorical) {
          existingProfile.isHistorical = false;
          existingProfile.historicalSince = undefined;
          saveSession(currentSession);
        }
        console.log(`⏭️ @${ig} já está na sessão`);
        continue;
      }
      
      // Reuse only profiles that were already extracted from a real screenshot
      const persistedData = getPersistedProfile(normalizedIg);
      const hasScreenshotDerivedData = persistedData && persistedData.profile.dataSource === 'screenshot';
      
      if (hasScreenshotDerivedData) {
        console.log(`📦 Usando dados reais do print salvos para @${ig}`);
        addProfile(persistedData.profile, persistedData.analysis);
        restoredPrintCount++;
        continue;
      }
      
      // Create placeholder profile - user will upload screenshot for real data
      const placeholderProfile: InstagramProfile = {
        username: normalizedIg,
        fullName: '',
        bio: '',
        profilePicUrl: '',
        followers: 0,
        following: 0,
        posts: 0,
        externalUrl: '',
        isBusinessAccount: false,
        category: '',
        engagement: 0,
        avgLikes: 0,
        avgComments: 0,
        recentPosts: [],
        needsScreenshotAnalysis: true,
        dataSource: 'placeholder',
      };
      
      const placeholderAnalysis: ProfileAnalysis = {
        strengths: ['📸 Perfil cadastrado - envie um print para análise completa'],
        weaknesses: ['⏳ Aguardando print do perfil para análise'],
        opportunities: ['🎯 Envie um print do perfil para desbloquear análise, estratégias e crescimento'],
        niche: 'Aguardando análise',
        audienceType: 'Aguardando análise',
        contentScore: 0,
        engagementScore: 0,
        profileScore: 0,
        recommendations: ['Envie um print do perfil na aba "Perfil" para análise completa com I.A.']
      };
      
      addProfile(placeholderProfile, placeholderAnalysis);
      await persistProfileData(loggedInUsername, normalizedIg, placeholderProfile, placeholderAnalysis);
      
      if (user?.email && !isIGRegistered(normalizedIg)) {
        addRegisteredIG(normalizedIg, user.email, true);
      }
    }

    const updatedSession = getSession();
    setSession(updatedSession);
    
    // Sync all to server
    await syncSessionToPersistent(loggedInUsername);
    
    if (updatedSession.profiles.length > 0 && localStorage.getItem('mro_force_registration') !== 'true') {
      setShowDashboard(true);
      setHasRegisteredProfiles(true);
    }
    
    setIsLoading(false);
    setSyncProgress(undefined);
    
    toast({
      title: 'Perfis vinculados!',
      description: `${processedCount} perfil(is) vinculado(s). Envie prints para análise.`
    });
  };

  const handleManualSync = async () => {
    setIsLoading(true);
    setLoadingMessage('Buscando contas no servidor...');
    try {
      const user = getCurrentUser();
      const squareResult = await verifyRegisteredIGs(user?.username || '');
      
      if (squareResult.success && squareResult.instagrams && squareResult.instagrams.length > 0) {
        await handleSyncComplete(squareResult.instagrams);
        toast({
          title: "Sincronização concluída",
          description: `${squareResult.instagrams.length} contas encontradas.`,
        });
      } else {
        setIsLoading(false);
        toast({
          title: "Nenhuma conta nova",
          description: "Não foram encontradas novas contas vinculadas ao seu usuário.",
        });
      }
    } catch (error) {
      console.error('[Index] Error in handleManualSync:', error);
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Erro na sincronização",
        description: "Não foi possível conectar ao servidor SquareCloud.",
      });
    }
  };

  const handleAddNewProfile = async (username: string) => {
    // Just navigate to registration - profiles are analyzed via screenshot now
    toast({
      title: 'Cadastre o perfil',
      description: 'Use a tela de cadastro para adicionar novos perfis',
    });
  };

  const handleSelectProfile = (profileId: string) => {
    setActiveProfile(profileId);
    const updatedSession = getSession();
    setSession(updatedSession);
  };

  const handleRemoveProfile = (profileId: string) => {
    removeProfile(profileId);
    const updatedSession = getSession();
    setSession(updatedSession);
    
    if (updatedSession.profiles.length === 0) {
      setShowDashboard(false);
    }
  };

  const handleSessionUpdate = async (updatedSession: MROSession) => {
    setSession(updatedSession);
    saveSession(updatedSession);
    
    // Sync to server on every update
    const loggedInUsername = getLoggedInUsername();
    await syncSessionToPersistent(loggedInUsername);
  };

  const handleReset = () => {
    setSession(createEmptySession());
    setShowDashboard(false);
    toast({
      title: "Sessão resetada",
      description: "Todas as informações foram apagadas.",
    });
  };

  const handleNavigateToRegister = () => {
    setShowDashboard(false);
  };

  // Navega para área de membros SEM sincronizar automaticamente
  const handleEnterMemberArea = () => {
    const updatedSession = getSession();
    setSession(updatedSession);
    
    if (updatedSession.profiles.length > 0) {
      setShowDashboard(true);
      setHasRegisteredProfiles(true);
    } else {
      // Se não tem perfis na sessão, apenas mostra o dashboard vazio
      setShowDashboard(true);
      setHasRegisteredProfiles(true);
    }
  };

  const handleRetrySync = () => {
    setAgeRestrictionProfile(null);
    setPrivateProfile(null);
    if (pendingSyncInstagrams.length > 0) {
      handleSyncComplete(pendingSyncInstagrams);
    }
  };

  // Handler para ir direto para área de membros com perfil placeholder (restrição de idade)
  const handleGoToMemberAreaWithPlaceholder = () => {
    if (!ageRestrictionProfile) return;
    
    const loggedInUsername = getLoggedInUsername();
    const username = ageRestrictionProfile.toLowerCase().replace('@', '');
    
    // Criar perfil placeholder para upload de screenshot
    const placeholderProfile: InstagramProfile = {
      username: username,
      fullName: '',
      bio: '',
      profilePicUrl: '',
      followers: 0,
      following: 0,
      posts: 0,
      externalUrl: '',
      isBusinessAccount: false,
      category: '',
      engagement: 0,
      avgLikes: 0,
      avgComments: 0,
      recentPosts: [],
      needsScreenshotAnalysis: true,
      dataSource: 'placeholder'
    };
    
    const placeholderAnalysis: ProfileAnalysis = {
      strengths: ['📸 Envie um print do perfil para análise completa'],
      weaknesses: ['⚠️ Dados não disponíveis via API (restrição de idade)'],
      opportunities: ['🎯 Após enviar o print, nossa IA vai analisar seu perfil'],
      niche: 'A ser identificado',
      audienceType: 'A ser identificado',
      contentScore: 0,
      engagementScore: 0,
      profileScore: 0,
      recommendations: ['Envie um print do seu perfil do Instagram para análise completa']
    };
    
    // Adiciona o perfil placeholder
    addProfile(placeholderProfile, placeholderAnalysis);
    
    // Registra o IG se tiver email
    const user = getCurrentUser();
    if (user?.email && !isIGRegistered(username)) {
      addRegisteredIG(username, user.email, true);
    }
    
    const updatedSession = getSession();
    setSession(updatedSession);
    setShowDashboard(true);
    setHasRegisteredProfiles(true);
    setAgeRestrictionProfile(null);
    
    toast({
      title: "Perfil adicionado! 📸",
      description: `@${username} foi adicionado. Envie um print do perfil para análise completa.`,
    });
  };

  const ageRestrictionDialogElement = (
    <AgeRestrictionDialog
      isOpen={!!ageRestrictionProfile}
      onClose={() => setAgeRestrictionProfile(null)}
      username={ageRestrictionProfile || ''}
      onRetrySync={handleRetrySync}
      onGoToMemberArea={handleGoToMemberAreaWithPlaceholder}
    />
  );

  const privateProfileDialogElement = (
    <PrivateProfileDialog
      isOpen={!!privateProfile}
      onClose={() => setPrivateProfile(null)}
      username={privateProfile || ''}
      onRetrySync={handleRetrySync}
    />
  );

  // Not logged in - show login page
  if (!isLoggedIn) {
    return (
      <>
        <LoadingOverlay isVisible={isLoading} message={loadingMessage} subMessage={loadingSubMessage} />
        <LoginPage onLoginSuccess={handleLoginSuccess} />
        {ageRestrictionDialogElement}
        {privateProfileDialogElement}
      </>
    );
  }

  // Initial Choice Screen
  if (showInitialChoice) {
    return (
      <div className="min-h-screen bg-[#0a0a14] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full z-50">
          <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black py-1.5 text-center text-[10px] md:text-xs font-black uppercase tracking-[0.3em] shadow-lg animate-in slide-in-from-top duration-700">
            ✨ VOCÊ ESTÁ NA ÁREA VIP MRO ✨
          </div>
        </div>

        {/* Logged-in user indicator - Hidden when modals are open to avoid overlap */}
        {!showMeuNegocioOptions && !showRendaExtraBonus && !showIAPopup && (
          <div className="absolute top-4 right-4 z-[60] flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md rounded-full px-4 py-2 border border-white/10 shadow-2xl">
              <User size={14} className="text-amber-500" />
              <span className="text-white font-black text-xs tracking-wider uppercase">{getLoggedInUsername()}</span>
              <div className="w-[1px] h-3 bg-white/10 mx-1" />
              <button
                onClick={handleLogout}
                className="p-1 rounded-full hover:bg-red-500/20 transition-all group"
                title="Sair"
              >
                <X size={14} className="text-white/40 group-hover:text-red-500 transition-colors" />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic backgrounds */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/[0.07] rounded-full blur-[60px] md:blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-15%] right-[-10%] w-[700px] h-[700px] bg-amber-500/[0.07] rounded-full blur-[70px] md:blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:40px_40px]" />
        </div>

        <div className="relative z-10 max-w-5xl w-full flex flex-col items-center gap-8 md:gap-12 py-12">
          <div className="animate-in fade-in zoom-in duration-1000 flex flex-col items-center gap-6">
            <Logo size="lg" className="scale-150 mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]" />
            
            <div className="text-center space-y-3">
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none italic animate-in fade-in duration-1000">
                <span className="bg-gradient-to-r from-white via-amber-200 to-white/40 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(251,191,36,0.3)] animate-pulse" style={{ animationDuration: '3s' }}>
                  SEJA BEM-VINDO(A) À MRO INTELIGENTE
                </span>
              </h1>
              <p className="text-amber-500 font-black text-[10px] md:text-xs uppercase tracking-[0.2em] drop-shadow-sm">
                Ferramenta Inteligente para Instagram
              </p>
              <p className="text-sm md:text-base text-white/30 max-w-xl mx-auto leading-relaxed font-medium">
                Esta é uma plataforma desenvolvida para otimizar processos, aumentar a produtividade e gerar resultados para empresas de diversos segmentos. Com ela, você pode aplicar soluções em seu próprio negócio ou estruturar uma operação de prestação de serviços, criando uma nova fonte de receita recorrente.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 w-full max-w-4xl">
            {/* Utilizar para meu negócio */}
            <button
              onClick={() => {
                navigate('/meu-negocio');
              }}
              className="group relative p-8 md:p-12 rounded-[3.5rem] bg-[#0d0d16] border border-white/5 transition-all duration-500 hover:-translate-y-2 hover:border-emerald-500/30 hover:shadow-[0_20px_50px_rgba(16,185,129,0.1)] flex flex-col items-center text-center gap-6 overflow-hidden shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-24 h-24 rounded-[2rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all duration-500 shadow-inner">
                <Briefcase className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl md:text-3xl font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight">Meu Negócio</h3>
                <p className="text-white/40 text-sm font-medium leading-relaxed">Potencialize seu perfil com nossa IA Inteligente.</p>
              </div>
              <div className="mt-4 flex items-center gap-2 px-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs group-hover:bg-emerald-500 group-hover:text-black group-hover:border-emerald-500 transition-all duration-500 uppercase tracking-[0.2em] shadow-lg">
                ACESSAR AGORA <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Renda Extra com MRO */}
            <button
              onClick={() => navigate('/renda-extra')}
              className="group relative p-8 md:p-12 rounded-[3.5rem] bg-[#0d0d16] border border-white/5 transition-all duration-500 hover:-translate-y-3 hover:border-amber-500/30 hover:shadow-[0_20px_50px_rgba(245,158,11,0.1)] flex flex-col items-center text-center gap-6 overflow-hidden shadow-2xl"
            >
              <div className="absolute top-6 right-6 z-20 bg-amber-500 text-black text-[9px] font-black px-3 py-1 rounded-full shadow-lg animate-bounce">BÔNUS</div>
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-amber-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-24 h-24 rounded-[2rem] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] transition-all duration-500 shadow-inner">
                <Rocket className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl md:text-3xl font-black text-white group-hover:text-amber-500 transition-colors uppercase tracking-tight">Renda Extra</h3>
                <p className="text-white/40 text-sm font-medium leading-relaxed">Fature prestando serviço para empresas.</p>
                <p className="text-[10px] text-amber-500 font-black uppercase tracking-[0.15em] opacity-0 group-hover:opacity-100 transition-all duration-500">Você já tem a ferramenta, é só aplicar o método!</p>
              </div>
              <div className="mt-4 flex items-center gap-2 px-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs group-hover:bg-amber-500 group-hover:text-black group-hover:border-amber-500 transition-all duration-500 uppercase tracking-[0.2em] shadow-lg">
                PRESTAR SERVIÇO <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>


        {showIAPopup && (
          <div className="fixed inset-0 z-[70] flex items-start md:items-center justify-center bg-black/95 backdrop-blur-md p-4 overflow-y-auto" onClick={() => {
            setShowIAPopup(false);
            setShowDashboardChoice(true);
          }}>
            <div className="bg-[#0d0d16] border border-white/10 rounded-[2.5rem] w-full max-w-2xl my-8 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
              <div className="p-6 md:p-12 space-y-8 text-center relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                <button 
                  onClick={() => {
                    setShowIAPopup(false);
                    setShowDashboardChoice(true);
                  }}
                  className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-colors text-white/40"
                >
                  <X className="w-6 h-6" />
                </button>
                
                <div className="space-y-4">
                  <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-[0.2em] mb-2 font-display">IA Inteligente MRO</div>
                  <h3 className="text-2xl md:text-4xl font-black text-white tracking-tight leading-tight italic">Já conhece a área de análise?</h3>
                  <p className="text-white/40 text-sm md:text-base leading-relaxed font-medium max-w-lg mx-auto">
                    Nessa área, nossa IA identifica pontos positivos e negativos do seu perfil automaticamente, entregando estratégias validadas para aplicar com a ferramenta.
                  </p>
                </div>

                <div className="max-w-xl mx-auto w-full aspect-video rounded-[2rem] overflow-hidden bg-black shadow-2xl border border-white/5">
                  <iframe
                    src="https://www.youtube.com/embed/CPI6xSH4TjU"
                    title="Tutorial IA MRO"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>

                <div className="flex flex-col items-center gap-4">
                  <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.2em]">Já aprendeu como funciona?</p>
                  <button
                    onClick={() => {
                      setShowIAPopup(false);
                      setShowDashboardChoice(false);
                      if (hasRegisteredProfiles) {
                        setShowDashboard(true);
                        setShowAnnouncements(true);
                      } else {
                        setShowDashboardChoice(true);
                      }
                    }}
                    className="w-full max-w-md flex items-center justify-center gap-3 px-8 py-5 rounded-2xl bg-emerald-500 text-black font-black text-lg transition-all hover:scale-[1.05] active:scale-95 uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.3)] group"
                  >
                    ACESSAR ÁREA AGORA <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Logged in but no registered profiles OR forced registration - show registration
  if (!hasRegisteredProfiles || localStorage.getItem('mro_force_registration') === 'true') {

    localStorage.removeItem('mro_force_registration'); // Consume it

    return (
      <>
        <LoadingOverlay isVisible={isLoading} message={loadingMessage} subMessage={loadingSubMessage} progress={syncProgress} />
        <ProfileRegistration 
          onProfileRegistered={handleProfileRegistered}
          onSyncComplete={handleSyncComplete}
          onEnterMemberArea={() => {
            localStorage.removeItem('mro_force_registration');
            handleEnterMemberArea();
          }}
          onLogout={() => {
            localStorage.removeItem('mro_force_registration');
            handleLogout();
          }}
        />

        {ageRestrictionDialogElement}
        {privateProfileDialogElement}
      </>
    );
  }

  // Show dashboard
  // Get active profile to check if screenshot exists
  const activeProfile = session.profiles.find(p => p.id === session.activeProfileId);
  const hasScreenshot = !!activeProfile?.screenshotUrl;

  if (showDashboard && session.profiles.length > 0) {
    return (
      <>
        <LoadingOverlay isVisible={isLoading} message={loadingMessage} subMessage={loadingSubMessage} progress={syncProgress} />
        {/* Avisos só aparecem APÓS o upload do print do perfil */}
        {showAnnouncements && hasScreenshot && (
          <AnnouncementPopup targetArea="instagram" onComplete={() => setShowAnnouncements(false)} />
        )}
        {showRendaExtraPopup && (
          <AnnouncementPopup targetArea="instagram" onComplete={() => setShowRendaExtraPopup(false)} />
        )}
        <Dashboard
          session={session} 
          onSessionUpdate={handleSessionUpdate}
          onReset={handleReset}
          onAddProfile={handleAddNewProfile}
          onSelectProfile={handleSelectProfile}
          onRemoveProfile={handleRemoveProfile}
          onNavigateToRegister={handleNavigateToRegister}
          onSync={handleManualSync}
          isLoading={isLoading}
          onLogout={handleLogout}
          onShowRendaExtra={() => {
            console.log('💰 Triggering Renda Extra popup');
            setShowRendaExtraPopup(true);
          }}
        />
        {ageRestrictionDialogElement}
        {privateProfileDialogElement}
        <CadastrarContaButton onClick={handleNavigateToRegister} />
      </>
    );
  }

  // Fallback to registration
  return (
    <>
      <LoadingOverlay isVisible={isLoading} message={loadingMessage} subMessage={loadingSubMessage} progress={syncProgress} />
      <ProfileRegistration 
        onProfileRegistered={handleProfileRegistered}
        onSyncComplete={handleSyncComplete}
        onEnterMemberArea={handleEnterMemberArea}
        onLogout={handleLogout}
      />
      {ageRestrictionDialogElement}
      {privateProfileDialogElement}
    </>
  );
};

export default Index;
