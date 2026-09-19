import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn, User, Lock, Clock } from 'lucide-react';
import { loginToSquare, verifyRegisteredIGs } from '@/lib/squareApi';
import { loginUser, getUserSession, saveUserToCloud } from '@/lib/userStorage';
import { formatDaysRemaining, isLifetimeAccess } from '@/types/user';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';
import { setCloudSyncCallback, initializeFromCloud, cleanExpiredCreatives, cleanExpiredStrategies, reconcileProfilesWithRegisteredAccounts } from '@/lib/storage';
import AnnouncementPopup from '@/components/AnnouncementPopup';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [pendingLoginSuccess, setPendingLoginSuccess] = useState(false);
  const { toast } = useToast();

  // Set up cloud sync callback on mount
  useEffect(() => {
    setCloudSyncCallback(saveUserToCloud);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast({
        title: 'Preencha todos os campos',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await loginToSquare(username.trim(), password.trim());

      if (result.success) {
        // Login now loads profiles from database AND cloud
        let session;
        try {
          // Pass password to loginUser for welcome email functionality
          session = await loginUser(username.trim(), result.daysRemaining || 365, undefined, password.trim());
        } catch (loginError) {
          console.error('[LoginPage] Error in loginUser:', loginError);
          // Continue with minimal session
          session = { cloudData: null };
        }
        
        // Initialize local storage from cloud data if available
        try {
          if (session?.cloudData?.profileSessions && session.cloudData.profileSessions.length > 0) {
            initializeFromCloud(
              session.cloudData.profileSessions,
              session.cloudData.archivedProfiles || []
            );
          }
        } catch (initError) {
          console.error('[LoginPage] Error initializing from cloud:', initError);
        }

        // CRITICAL: Reconcile profiles with SquareCloud — remove any that no longer exist there
        try {
          const squareResult = await verifyRegisteredIGs(username.trim());
          if (squareResult.success && squareResult.instagrams) {
            const squareIGs = new Set(squareResult.instagrams.map(ig => ig.toLowerCase()));
            const reconciledSession = reconcileProfilesWithRegisteredAccounts(Array.from(squareIGs));
            const historicalCount = reconciledSession.profiles.filter(profile => profile.isHistorical).length;
            console.log(`🔄 [LoginPage] Histórico preservado: ${historicalCount} perfil(is)`);

            // Reconcile registeredIGs (the "Suas Contas" list) + database
            const { reconcileRegisteredIGsWithSquare } = await import('@/lib/userStorage');
            await reconcileRegisteredIGsWithSquare(squareResult.instagrams);
          }
        } catch (reconcileError) {
          console.error('[LoginPage] Error reconciling with SquareCloud:', reconcileError);
        }
        
        // Clean expired creatives and strategies (30 days)
        try {
          await cleanExpiredCreatives();
          cleanExpiredStrategies();
        } catch (cleanError) {
          console.error('[LoginPage] Error cleaning expired data:', cleanError);
        }
        
        // Use days from cloud session (synced by admin) if available, otherwise from API
        const actualDays = session?.cloudData?.daysRemaining ?? result.daysRemaining ?? 365;
        const daysText = formatDaysRemaining(actualDays);
        const isLifetime = isLifetimeAccess(actualDays);
        
        // Import getSession to get DEDUPLICATED profile count after initializeFromCloud
        const { getSession } = await import('@/lib/storage');
        const profileCount = getSession().profiles.length;
        
        toast({
          title: 'Login realizado com sucesso!',
          description: isLifetime 
            ? `Acesso vitalício ativado${profileCount > 0 ? ` • ${profileCount} perfil(is) carregado(s)` : ''}` 
            : `Você tem ${daysText} de acesso${profileCount > 0 ? ` • ${profileCount} perfil(is) carregado(s)` : ''}`,
        });

        // Show announcements after successful login
        setShowAnnouncements(true);
        setPendingLoginSuccess(true);
      } else {
        toast({
          title: 'Erro no login',
          description: result.error || 'Usuário ou senha incorretos',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('[LoginPage] Login error:', error);
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível conectar ao servidor',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnnouncementsComplete = () => {
    if (pendingLoginSuccess) {
      setPendingLoginSuccess(false);
      setShowAnnouncements(false);
      onLoginSuccess();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center p-4">
      {/* Announcement Popup after successful login */}
      {showAnnouncements && (
        <AnnouncementPopup targetArea="instagram" onComplete={handleAnnouncementsComplete} />
      )}
      
      <Card className="w-full max-w-md glass-card border-primary/20">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-gray-900 rounded-xl p-4">
              <Logo />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Acesso MRO Inteligente</CardTitle>
          <CardDescription>
            Digite suas credenciais para acessar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Usuário
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Seu nome de usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className="bg-background/50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="bg-background/50"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Após login, você verá seus dias de acesso</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
