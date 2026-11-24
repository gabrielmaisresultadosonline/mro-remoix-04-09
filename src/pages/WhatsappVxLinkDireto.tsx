import { useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { openWhatsAppChat } from "@/lib/whatsapp";

const DISCOUNT_MSG = "Recebi um email sobre um desconto da ferramenta MRO.";

export default function WhatsappVxLinkDireto() {
  const [number, setNumber] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("whatsapp_page_settings")
        .select("whatsapp_number")
        .limit(1)
        .single();
      const num = (data as any)?.whatsapp_number || "";
      if (!num) { setError(true); return; }
      setNumber(num);
      // auto-redirect imediato
      setTimeout(() => openWhatsAppChat(num, DISCOUNT_MSG), 200);
    })();
  }, []);

  const go = () => number && openWhatsAppChat(number, DISCOUNT_MSG);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 gap-6 text-white">
      {!error ? (
        <>
          <Loader2 className="w-10 h-10 animate-spin text-green-500" />
          <p className="text-zinc-300 text-center">Abrindo o WhatsApp com seu desconto…</p>
          <button
            onClick={go}
            disabled={!number}
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-full"
          >
            <MessageCircle className="w-5 h-5" /> Abrir WhatsApp agora
          </button>
        </>
      ) : (
        <p className="text-red-400">WhatsApp não configurado.</p>
      )}
    </div>
  );
}
