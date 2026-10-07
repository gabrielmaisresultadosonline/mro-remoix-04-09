import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { wlCall, type WlSalesContext } from '@/lib/whitelabel';
import InstagramNovaPlan from './InstagramNovaPlan';
import AffiliateRendaExtraPromo from './AffiliateRendaExtraPromo';

/** Reuse the original pages, changing only branding and checkout attribution. */
export default function WhitelabelCheckout() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const [info, setInfo] = useState<WlSalesContext | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const linkType = params.get('tipo') === 'renda_extra' ? 'renda_extra' : 'cliente_final';
  useEffect(() => {
    let active = true;
    setInfo(null); setUnavailable(false);
    document.title = 'Ferramenta MRO — Whitelabel';
    wlCall<{ name: string; logo_url: string | null; prices: Record<string, number> }>('public_link_info', { code })
      .then((data) => { if (active) setInfo({ code, name: data.name, logoUrl: data.logo_url, prices: data.prices, linkType }); })
      .catch(() => { if (active) setUnavailable(true); });
    return () => { active = false; };
  }, [code, linkType]);
  if (unavailable) return <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">Link indisponível.</main>;
  if (!info) return <main className="min-h-screen bg-background flex items-center justify-center"><Loader2 aria-label="Carregando" className="w-6 h-6 animate-spin" /></main>;
  if (params.get('pago')) return <main className="min-h-screen bg-background text-foreground flex flex-col gap-3 items-center justify-center p-4 text-center"><h1 className="text-2xl font-bold">Aguardando confirmação do pagamento</h1><p>Após a aprovação, seu acesso à Ferramenta MRO será enviado por e-mail.</p></main>;
  return linkType === 'renda_extra' ? <AffiliateRendaExtraPromo whitelabel={info} /> : <InstagramNovaPlan whitelabel={info} />;
}
