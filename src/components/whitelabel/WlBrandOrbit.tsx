import logoMro from '@/assets/logo-mro.png';

export interface WlBrandOrbitProps { logoUrl?: string | null; name: string }

export function WlBrandOrbit({ logoUrl, name }: WlBrandOrbitProps) {
  if (!logoUrl) return <img src={logoMro} alt="MRO" className="h-16 w-32 object-contain mx-auto mb-6" />;
  return (
    <div className="wl-brand-orbit" aria-label={`MRO e ${name}`}>
      <div className="wl-brand-orbit-track">
        <img src={logoMro} alt="MRO" className="wl-brand-orbit-logo" />
        <img src={logoUrl} alt={name} className="wl-brand-orbit-logo wl-brand-orbit-partner" />
      </div>
    </div>
  );
}