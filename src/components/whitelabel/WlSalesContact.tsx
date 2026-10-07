import type { ComponentProps } from 'react';
import { ArrowUpRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const WL_SALES_WHATSAPP = `https://wa.me/555192835863?text=${encodeURIComponent('Olá vim pelo site do Whitelabel, gostaria de saber mais.')}`;

export interface WlSalesContactProps extends ComponentProps<typeof Button> {
  label?: string;
}

export function WlSalesContact({ label = 'Quero minha própria marca', className, ...props }: WlSalesContactProps) {
  return <Button asChild size="lg" className={cn('h-auto min-h-12 whitespace-normal rounded-md px-6 py-3 text-base font-bold', className)} {...props}>
    <a href={WL_SALES_WHATSAPP} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />{label}<ArrowUpRight aria-hidden="true" /></a>
  </Button>;
}