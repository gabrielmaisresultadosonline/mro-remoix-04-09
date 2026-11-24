import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Rocket, 
  ArrowLeft,
  MessageSquare,
  Code2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CreatorDevProject = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    full_name: '',
    whatsapp: '',
    email: '',
    project_description: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Save to Database
      const { error } = await supabase
        .from('creatordev_requests')
        .insert([formData]);

      if (error) throw error;

      // 2. Notify Admin via Email (Edge Function)
      supabase.functions.invoke('creatordev-notify', {
        body: { type: 'new_request', data: formData }
      }).catch(err => console.error("Error calling notify function:", err));

      // 3. Get Admin WhatsApp Number and Send Message
      const { data: waData } = await supabase
        .from('whatsapp_page_settings')
        .select('whatsapp_number')
        .limit(1)
        .single();

      const adminWhatsApp = waData?.whatsapp_number || '555192036540';
      
      const message = `🚀 *Nova Solicitação de Projeto - CreatorDev*\n\n` +
                      `👤 *Nome:* ${formData.full_name}\n` +
                      `📧 *Email:* ${formData.email}\n` +
                      `📱 *WhatsApp:* ${formData.whatsapp}\n\n` +
                      `💡 *Ideia do Projeto:*\n${formData.project_description}`;

      const whatsappUrl = `https://wa.me/${adminWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      
      toast.success("Projeto salvo! Redirecionando para o WhatsApp...");
      
      setFormData({ full_name: '', whatsapp: '', email: '', project_description: '' });
      
      // Redirect to WhatsApp
      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
        navigate('/creatordev');
      }, 1500);
    } catch (error: any) {

      toast.error("Erro ao enviar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050506] text-white selection:bg-blue-500/30 font-sans flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[100px] -z-10" />

      <div className="max-w-5xl w-full grid md:grid-cols-2 gap-12 md:gap-20 items-center">
        <div className="space-y-8">
          <button 
            onClick={() => navigate('/creatordev')}
            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Voltar para CreatorDev
          </button>
          
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight">
              VAMOS CRIAR<br />
              ALGO<br />
              <span className="text-blue-500 uppercase">Memorável?</span>
            </h1>
            <p className="text-gray-400 text-xl leading-relaxed max-w-md">
              Conte-nos sobre seu projeto. Nossa equipe técnica analisará sua necessidade e retornará com uma solução inovadora.
            </p>
          </div>
          
        </div>

        <Card className="bg-[#0f0f11] border-white/5 text-white rounded-[40px] overflow-hidden shadow-2xl relative">
          <CardContent className="p-8 md:p-12">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 ml-1">Nome Completo</label>
                <Input 
                  required
                  placeholder="Ex: João Silva"
                  className="bg-white/[0.03] border-white/5 h-16 rounded-2xl focus:border-blue-500/50 transition-all text-lg px-6"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 ml-1">WhatsApp</label>
                  <Input 
                    required
                    placeholder="(00) 00000-00"
                    className="bg-white/[0.03] border-white/5 h-16 rounded-2xl focus:border-blue-500/50 transition-all text-lg px-6"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 ml-1">E-mail</label>
                  <Input 
                    required
                    type="email"
                    placeholder="contato@empre"
                    className="bg-white/[0.03] border-white/5 h-16 rounded-2xl focus:border-blue-500/50 transition-all text-lg px-6"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 ml-1">Detalhes do Projeto</label>
                <Textarea 
                  required
                  placeholder="Descreva seu projeto, objetivos e funcionalidades desejadas..."
                  className="bg-white/[0.03] border-white/5 min-h-[180px] rounded-2xl focus:border-blue-500/50 transition-all resize-none text-lg p-6"
                  value={formData.project_description}
                  onChange={(e) => setFormData({...formData, project_description: e.target.value})}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-20 rounded-3xl text-xl font-black shadow-xl group transition-all"
                disabled={loading}
              >
                {loading ? "Processando..." : "Enviar Solicitação"}
                <Rocket className="ml-3 w-6 h-6 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreatorDevProject;
