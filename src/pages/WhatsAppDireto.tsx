import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackPageView, trackLead } from "@/lib/facebookTracking";
import { openWhatsAppChat } from "@/lib/whatsapp";
import logoMroWhite from "@/assets/logo-mro-white.png";
import bannerImg from "@/assets/whatsapp-direto-banner.png";

const WhatsAppDireto = () => {
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackPageView("WhatsApp Direto");
    const load = async () => {
      const { data } = await supabase
        .from("whatsapp_page_settings")
        .select("whatsapp_number")
        .limit(1)
        .single();
      if (data) {
        setWhatsappNumber(data.whatsapp_number);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleClick = () => {
    if (!whatsappNumber) return;
    trackLead("WhatsApp Direto - Contato");
    const message =
      "Olá, vim pelo site, gostaria de saber sobre o sistema inovador!"
    openWhatsAppChat(whatsappNumber, message);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-8 gap-8">
      {/* Logo */}
      <img
        src={logoMroWhite}
        alt="MRO Logo"
        className="h-14 w-auto object-contain"
      />

      {/* Banner Image */}
      <img
        src={bannerImg}
        alt="Zero anúncios, resultados reais"
        className="w-full max-w-[95vw] sm:max-w-lg rounded-xl object-contain"
      />

      {/* WhatsApp Button */}
      <button
        onClick={handleClick}
        className="flex items-center gap-3 bg-green-500 hover:bg-green-600 text-white font-bold text-lg px-8 py-4 rounded-full transition-all hover:scale-105 shadow-lg shadow-green-500/30"
      >
        <MessageCircle className="w-6 h-6" />
        Falar no WhatsApp
      </button>
    </div>
  );
};

export default WhatsAppDireto;
