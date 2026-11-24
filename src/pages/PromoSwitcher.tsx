import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AffiliatePromoPage from "./AffiliatePromoPage";
import OfficialPartnerPromo from "./OfficialPartnerPromo";
import { Loader2 } from "lucide-react";

const PromoSwitcher = () => {
  const { affiliateId } = useParams<{ affiliateId: string }>();
  const [isPartner, setIsPartner] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkIsPartner = async () => {
      if (!affiliateId) {
        setIsPartner(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('partners')
          .select('id')
          .eq('slug', affiliateId)
          .eq('status', 'active')
          .maybeSingle();

        if (data) {
          setIsPartner(true);
        } else {
          setIsPartner(false);
        }
      } catch (err) {
        console.error("Error checking partner:", err);
        setIsPartner(false);
      } finally {
        setLoading(false);
      }
    };

    checkIsPartner();
  }, [affiliateId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-green-400 animate-spin" />
      </div>
    );
  }

  if (isPartner) {
    return <OfficialPartnerPromo />;
  }

  return <AffiliatePromoPage />;
};

export default PromoSwitcher;
