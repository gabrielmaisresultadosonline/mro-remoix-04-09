import { useState } from 'react';
import { Check, Clapperboard, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type MroTrainingTheme = 'classic' | 'netflix';
export const MRO_THEME_KEY = 'mro_training_theme';
export function readMroTheme(): MroTrainingTheme | null {
  try {
    const value = localStorage.getItem(MRO_THEME_KEY);
    return value === 'classic' || value === 'netflix' ? value : null;
  } catch { return null; }
}
export interface MroThemeChooserProps {
  open: boolean;
  current: MroTrainingTheme | null;
  onSelect: (theme: MroTrainingTheme) => void;
  onClose: () => void;
}
export default function MroThemeChooser({ open, current, onSelect, onClose }: MroThemeChooserProps) {
  const [choice, setChoice] = useState<MroTrainingTheme>(current || 'netflix');
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value && current) onClose(); }}>
      <DialogContent className="mro-training-theme max-w-xl w-[calc(100%-2rem)] rounded-lg max-h-[90dvh] overflow-y-auto" onEscapeKeyDown={(e) => { if (!current) e.preventDefault(); }} onPointerDownOutside={(e) => { if (!current) e.preventDefault(); }}>
        <DialogTitle className="text-2xl font-display">Como deseja visualizar?</DialogTitle>
        <DialogDescription>Escolha o visual da sua área de treinamentos.</DialogDescription>
        <div className="grid grid-cols-2 gap-3 py-3">
          {(['classic', 'netflix'] as const).map((theme) => (
            <Button key={theme} variant="outline" aria-pressed={choice === theme} onClick={() => setChoice(theme)} className={cn('h-auto flex-col items-stretch p-3 gap-3 rounded-lg whitespace-normal', choice === theme && 'border-primary ring-1 ring-primary')}>
              <div className="aspect-[4/3] bg-secondary rounded-md p-3 flex flex-col gap-2 overflow-hidden" aria-hidden="true">
                {theme === 'classic' ? <LayoutList className="h-6 w-6 text-primary" /> : <Clapperboard className="h-6 w-6 text-primary" />}
                <div className={cn('bg-muted rounded-sm', theme === 'netflix' ? 'h-10 border-l-2 border-primary' : 'h-5')} />
                <div className="flex gap-1.5 flex-1">{['a', 'b', 'c', 'd'].map((id) => <div key={id} className="flex-1 bg-primary/20 border border-primary/30 rounded-sm" />)}</div>
              </div>
              <span className="flex items-center justify-between gap-1 text-sm">{theme === 'classic' ? 'Tema antigo' : 'Tema novo'}{choice === theme && <Check className="w-4 h-4 shrink-0 text-primary" />}</span>
              <span className="text-xs text-muted-foreground">{theme === 'classic' ? 'Visual original' : 'Estilo Netflix'}</span>
            </Button>
          ))}
        </div>
        <Button onClick={() => onSelect(choice)} className="gap-2"><Check className="h-4 w-4" />Salvar e abrir</Button>
      </DialogContent>
    </Dialog>
  );
}