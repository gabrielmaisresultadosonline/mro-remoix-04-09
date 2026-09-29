import { useState, useEffect, useRef } from 'react';
import { ProfileSession, GrowthSnapshot, GrowthInsight } from '@/types/instagram';
import { addGrowthSnapshot, addGrowthInsight, getSession, saveSession, setCloudSyncCallback } from '@/lib/storage';
import { syncSessionToPersistent, markProfileFetched } from '@/lib/persistentStorage';
import { getCurrentUser, saveUserToCloud } from '@/lib/userStorage';
import { TrendingUp, TrendingDown, Users, Heart, MessageCircle, Calendar, RefreshCw, Award, Cloud, CheckCircle2, Upload, Camera, Loader2, Clipboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { GrowthPDFExport } from './GrowthPDFExport';
import { supabase } from '@/integrations/supabase/client';
import { readInstagramScreenshot, restoreStoredScreenshot } from '@/lib/instagramScreenshot';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface GrowthTrackerProps {
  profileSession: ProfileSession;
  onUpdate: () => void;
}

export const GrowthTracker = ({ profileSession, onUpdate }: GrowthTrackerProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setCloudSyncCallback(saveUserToCloud);
  }, []);

  // Paste handler for growth screenshot
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) processFile(file);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const initialSnapshot = profileSession.initialSnapshot;
  const latestSnapshot = profileSession.growthHistory[profileSession.growthHistory.length - 1] || initialSnapshot;
  
  const totalFollowersGain = latestSnapshot.followers - initialSnapshot.followers;
  const totalFollowersPercent = initialSnapshot.followers > 0 
    ? ((totalFollowersGain / initialSnapshot.followers) * 100).toFixed(1)
    : '0';
  
  const engagementChange = (latestSnapshot.engagement - initialSnapshot.engagement).toFixed(2);
  const avgLikesChange = latestSnapshot.avgLikes - initialSnapshot.avgLikes;
  
  const startDate = new Date(profileSession.startedAt);
  const now = new Date();
  const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const weeksSinceStart = Math.floor(daysSinceStart / 7);

  const lastSnapshotDate = new Date(latestSnapshot.date);
  const daysSinceLastSnapshot = Math.floor((now.getTime() - lastSnapshotDate.getTime()) / (1000 * 60 * 60 * 24));
  const needsWeeklyUpdate = daysSinceLastSnapshot >= 7;

  // Build chart data from initial + growthHistory
  const chartData = [
    {
      date: new Date(profileSession.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      seguidores: initialSnapshot.followers,
      engajamento: Number((initialSnapshot.engagement).toFixed(2)),
    },
    ...profileSession.growthHistory.map(s => ({
      date: new Date(s.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      seguidores: s.followers,
      engajamento: Number((s.engagement).toFixed(2)),
    }))
  ];

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast({ title: 'Selecione uma imagem', variant: 'destructive' }); return; }
    if (file.size > 10 * 1024 * 1024) { toast({ title: 'Imagem muito grande. Máx 10MB', variant: 'destructive' }); return; }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => setPreviewUrl(event.target?.result as string);
    reader.readAsDataURL(file);
    toast({ title: 'Print selecionado!', description: 'Clique em "Analisar Crescimento" para comparar.' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleAnalyzeGrowth = async () => {
    if (!selectedFile) return;
    setIsUploading(true);

    try {
      const ocrResult = await readInstagramScreenshot(selectedFile);

      if (ocrResult.detectedUsername && ocrResult.detectedUsername !== profileSession.profile.username.toLowerCase()) {
        toast({
          title: `O print enviado é do perfil @${ocrResult.detectedUsername}`,
          description: `Envie o print real do perfil @${profileSession.profile.username}.`,
          variant: 'destructive'
        });
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsUploading(false);
        return;
      }

      // Upload image first
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        
        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-profile-screenshot', {
          body: {
            username: profileSession.profile.username,
            squarecloud_username: getCurrentUser()?.username || 'growth',
            image_base64: base64,
            content_type: selectedFile.type
          }
        });

        if (uploadError || !uploadData?.url) {
          toast({ title: 'Erro ao enviar print', variant: 'destructive' });
          setIsUploading(false);
          return;
        }

        // Analyze via DeepSeek
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-profile-screenshot', {
          body: { screenshot_url: uploadData.url, username: profileSession.profile.username, ocr_text: ocrResult.text }
        });

        if (analysisError) {
          toast({ title: 'Erro na análise', variant: 'destructive' });
          setIsUploading(false);
          return;
        }

        if (analysisData?.success === false) {
          await restoreStoredScreenshot({
            username: profileSession.profile.username,
            squarecloudUsername: getCurrentUser()?.username || 'growth',
            screenshotUrl: profileSession.screenshotUrl || null,
          });
          toast({ title: analysisData?.message || 'Este print não pode ser usado', variant: 'destructive' });
          setIsUploading(false);
          return;
        }

        if (analysisData?.extracted_data) {
          const extracted = analysisData.extracted_data;
          const newFollowers = Number(extracted.followers) || 0;
          const newFollowing = Number(extracted.following) || 0;
          const newPosts = Number(extracted.posts_count) || 0;

          // Create new snapshot from screenshot data
          const newSnapshot: GrowthSnapshot = {
            date: new Date().toISOString(),
            followers: newFollowers,
            following: newFollowing,
            posts: newPosts,
            avgLikes: latestSnapshot.avgLikes, // maintain previous
            avgComments: latestSnapshot.avgComments,
            engagement: newFollowers > 0 ? (latestSnapshot.avgLikes / newFollowers) * 100 : 0,
          };

          // Add snapshot
          addGrowthSnapshot(profileSession.id, {
            username: profileSession.profile.username,
            followers: newFollowers,
            following: newFollowing,
            posts: newPosts,
            engagement: newSnapshot.engagement,
            avgLikes: newSnapshot.avgLikes,
            avgComments: newSnapshot.avgComments,
          } as any);

          // Generate insight
          const previousSnapshot = profileSession.growthHistory[profileSession.growthHistory.length - 1] || initialSnapshot;
          const followersGain = newFollowers - previousSnapshot.followers;
          const followersGainPercent = previousSnapshot.followers > 0
            ? ((followersGain / previousSnapshot.followers) * 100)
            : 0;

          const newInsight: GrowthInsight = {
            weekNumber: weeksSinceStart + 1,
            startDate: previousSnapshot.date,
            endDate: new Date().toISOString(),
            followersGain,
            followersGainPercent,
            engagementChange: newSnapshot.engagement - previousSnapshot.engagement,
            strategyBonus: generateStrategyBonus(profileSession.strategies.length),
            insights: generateInsightsFromScreenshot(previousSnapshot, newSnapshot, followersGain),
          };

          addGrowthInsight(profileSession.id, newInsight);

          // Keep the same screenshot URL in both cloud sources. The admin reads
          // the auxiliary profile row while the client panel renders the session.
          const sessionWithScreenshot = getSession();
          const profileWithScreenshot = sessionWithScreenshot.profiles.find(
            profile => profile.id === profileSession.id,
          );
          if (profileWithScreenshot) {
            const uploadedAt = new Date().toISOString();
            profileWithScreenshot.screenshotUrl = uploadData.url;
            if (!profileWithScreenshot.screenshotHistory?.some(item => item.url === uploadData.url)) {
              profileWithScreenshot.screenshotHistory = [
                ...(profileWithScreenshot.screenshotHistory || []),
                { url: uploadData.url, uploadedAt },
              ];
            }
            saveSession(sessionWithScreenshot);
          }

          // Sync to cloud
          const loggedInUsername = getCurrentUser()?.username || 'anonymous';
          const userEmail = getCurrentUser()?.email;
          const daysRemaining = getCurrentUser()?.daysRemaining || 365;
          await syncSessionToPersistent(loggedInUsername);
          const updatedSession = getSession();
          await saveUserToCloud(loggedInUsername, userEmail, daysRemaining, updatedSession.profiles, []);

          toast({
            title: `Crescimento analisado! 📊`,
            description: `${followersGain >= 0 ? '+' : ''}${followersGain} seguidores (${followersGainPercent.toFixed(1)}%)`,
          });

          // Reset file selection
          setSelectedFile(null);
          setPreviewUrl(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          
          onUpdate();
        } else {
          toast({ title: 'Não foi possível extrair dados do print', variant: 'destructive' });
        }
        
        setIsUploading(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error('[GrowthTracker] Error analyzing growth screenshot:', error);
      toast({ title: 'Erro ao analisar crescimento', variant: 'destructive' });
      setIsUploading(false);
    }
  };

  const generateStrategyBonus = (strategiesCount: number): string => {
    if (strategiesCount >= 4) return "🏆 Estratégia completa ativa";
    if (strategiesCount >= 2) return "⚡ Bom uso das estratégias";
    if (strategiesCount >= 1) return "🌱 Iniciando com estratégia";
    return "📋 Adicione estratégias para melhorar";
  };

  const generateInsightsFromScreenshot = (previous: GrowthSnapshot, current: GrowthSnapshot, followersGain: number): string[] => {
    const insights: string[] = [];
    if (followersGain > 0) {
      insights.push(`📈 Ganhou ${followersGain} novos seguidores`);
    } else if (followersGain < 0) {
      insights.push(`📉 Perdeu ${Math.abs(followersGain)} seguidores`);
    } else {
      insights.push(`📊 Seguidores estáveis`);
    }
    const engChange = current.engagement - previous.engagement;
    if (engChange > 0.5) {
      insights.push(`🔥 Engajamento subiu ${engChange.toFixed(1)}%`);
    } else if (engChange < -0.5) {
      insights.push(`⚠️ Engajamento caiu ${Math.abs(engChange).toFixed(1)}%`);
    }
    const postsGain = current.posts - previous.posts;
    if (postsGain > 0) {
      insights.push(`📸 +${postsGain} novos posts publicados`);
    }
    if (insights.length === 0) {
      insights.push("📊 Métricas estáveis neste período");
    }
    return insights;
  };

  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  const daysRemaining = Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="glass-card p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-display font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Crescimento de @{profileSession.profile.username}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
            Monitorando desde {startDate.toLocaleDateString('pt-BR')} • Semana {weeksSinceStart + 1}/52
            <span className="flex items-center gap-1 text-mro-green">
              <Cloud className="w-3 h-3" />
              <CheckCircle2 className="w-3 h-3" />
            </span>
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <GrowthPDFExport profileSession={profileSession} />
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Seguidores"
          value={latestSnapshot.followers.toLocaleString()}
          change={totalFollowersGain}
          changePercent={totalFollowersPercent}
          isPositive={totalFollowersGain >= 0}
        />
        <StatCard
          icon={<Heart className="w-5 h-5" />}
          label="Média de Curtidas"
          value={latestSnapshot.avgLikes.toLocaleString()}
          change={avgLikesChange}
          isPositive={avgLikesChange >= 0}
        />
        <StatCard
          icon={<MessageCircle className="w-5 h-5" />}
          label="Engajamento"
          value={`${latestSnapshot.engagement.toFixed(2)}%`}
          change={parseFloat(engagementChange)}
          suffix="%"
          isPositive={parseFloat(engagementChange) >= 0}
        />
        <StatCard
          icon={<Calendar className="w-5 h-5" />}
          label="Dias Restantes"
          value={daysRemaining.toString()}
          subtitle="de monitoramento"
        />
      </div>

      {/* Growth Chart */}
      {chartData.length >= 2 && (
        <div className="p-4 rounded-lg bg-secondary/20 border border-border">
          <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Gráfico de Crescimento
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                labelStyle={{ color: '#aaa' }}
              />
              <Legend />
              <Line type="monotone" dataKey="seguidores" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 4 }} name="Seguidores" />
              <Line type="monotone" dataKey="engajamento" stroke="#00ff88" strokeWidth={2} dot={{ fill: '#00ff88', r: 4 }} name="Engajamento %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Screenshot Growth Update */}
      <div className="p-4 rounded-lg bg-secondary/20 border border-border space-y-3">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          Atualização via Print
        </h4>
        <p className="text-xs text-muted-foreground">
          Envie um novo print do perfil para calcular o crescimento. O print não fica salvo — serve apenas para analisar os dados atuais e comparar com o histórico.
        </p>

        {previewUrl && selectedFile && (
          <div className="relative rounded-lg overflow-hidden border border-border max-h-48">
            <img src={previewUrl} alt="Preview" className="w-full max-h-48 object-contain bg-muted" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            Selecionar Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast({ title: 'Cole o print (Ctrl+V)', description: 'Use Ctrl+V para colar um print da área de transferência' });
            }}
            disabled={isUploading}
          >
            <Clipboard className="w-4 h-4 mr-2" />
            Colar (Ctrl+V)
          </Button>
          {selectedFile && (
            <Button
              size="sm"
              onClick={handleAnalyzeGrowth}
              disabled={isUploading}
              className="bg-primary hover:bg-primary/90"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <TrendingUp className="w-4 h-4 mr-2" />
              )}
              {isUploading ? 'Analisando...' : 'Analisar Crescimento'}
            </Button>
          )}
        </div>
      </div>

      {/* Strategy Bonus */}
      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
        <div className="flex items-center gap-3">
          <Award className="w-6 h-6 text-primary" />
          <div>
            <p className="font-semibold">Bonificação da Estratégia</p>
            <p className="text-sm text-muted-foreground">
              {generateStrategyBonus(profileSession.strategies.length)}
            </p>
          </div>
        </div>
      </div>

      {/* Weekly Insights */}
      {profileSession.growthInsights.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Histórico de Análises</h4>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {[...profileSession.growthInsights].reverse().slice(0, 10).map((insight, i) => (
              <div key={i} className="p-3 rounded-lg bg-secondary/30 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Semana {insight.weekNumber}</span>
                  <span className={`flex items-center gap-1 ${insight.followersGain >= 0 ? 'text-mro-green' : 'text-destructive'}`}>
                    {insight.followersGain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {insight.followersGain >= 0 ? '+' : ''}{insight.followersGain} seguidores
                    {insight.followersGainPercent !== 0 && ` (${insight.followersGainPercent.toFixed(1)}%)`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  {new Date(insight.startDate).toLocaleDateString('pt-BR')} → {new Date(insight.endDate).toLocaleDateString('pt-BR')}
                </p>
                <div className="space-y-1 text-muted-foreground text-xs">
                  {insight.insights.map((text, j) => (
                    <p key={j}>{text}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-muted-foreground text-center p-3 rounded-lg bg-secondary/20 space-y-1">
        <p>💡 Envie um novo print do perfil para registrar o crescimento. O histórico é salvo automaticamente na nuvem.</p>
        <p className="flex items-center justify-center gap-1 text-mro-green">
          <Cloud className="w-3 h-3" />
          Dados salvos na nuvem - acesse de qualquer dispositivo
        </p>
      </div>
    </div>
  );
};

const StatCard = ({ 
  icon, label, value, change, changePercent, suffix = '', isPositive = true, subtitle
}: { 
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: number;
  changePercent?: string;
  suffix?: string;
  isPositive?: boolean;
  subtitle?: string;
}) => (
  <div className="p-3 sm:p-4 rounded-lg bg-secondary/30 border border-border">
    <div className="flex items-center gap-2 text-muted-foreground mb-2">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
    <p className="text-xl sm:text-2xl font-bold">{value}</p>
    {change !== undefined && (
      <p className={`text-xs flex items-center gap-1 ${isPositive ? 'text-mro-green' : 'text-destructive'}`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isPositive && change > 0 ? '+' : ''}{change.toLocaleString()}{suffix}
        {changePercent && ` (${changePercent}%)`}
      </p>
    )}
    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
  </div>
);
