import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Upload, CheckSquare, Square, Palette, Package, ChevronUp, ChevronDown, Eye, X, Hash, Sparkles, User, Tag, MapPin, Move, Sliders, ImagePlus, RotateCcw, ZoomIn, ArrowLeft, Image, Video, FileText, Instagram, Play, Loader2, TestTube, PenTool, ExternalLink, BarChart3, MessageCircle, ArrowRight, Settings, Rocket, Lightbulb, ShieldCheck, UserPlus, Wrench, Briefcase, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWhatsAppConfig } from '@/hooks/useWhatsAppConfig';
import { MateriaisRendaExtra } from '@/components/MateriaisRendaExtra';
import { ContratoGenerator } from '@/components/ContratoGenerator';
import { PropostaEmpresa } from '@/components/PropostaEmpresa';
import { EstruturaTutoriais } from '@/components/EstruturaTutoriais';
import { EstruturaTrialDashboard } from '@/components/EstruturaTrialDashboard';
import { ReportGenerator } from '@/components/ReportGenerator';
import { LoginPage } from '@/components/LoginPage';
import { VideoTutorialButton } from '@/components/VideoTutorialButton';
import { getUserSession } from '@/lib/userStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import JSZip from 'jszip';
import personPhoneImg from '@/assets/person-phone.png';
import personLaptopImg from '@/assets/person-laptop.png';

type TextLayout = 'left' | 'center' | 'right' | 'impact-center' | 'minimal-center' | 'bold-stack';

interface CreativeData {
  id: number;
  headline: string;
  highlightWord?: string;
  highlightColor?: string;
  text: string;
  cta: string;
  category: 'dor' | 'promessa' | 'educativo' | 'beneficio' | 'autoridade';
  icon: string;
  layout: TextLayout;
}

interface LogoOverride {
  x: number; // 0-1 percentage
  y: number; // 0-1 percentage
  scale?: number; // multiplier, default 1
}

interface BgImageOverride {
  url: string;
  x: number; // offset in pixels (canvas coords)
  y: number;
  opacity: number; // 0-1
  scale: number; // 1 = original
}

interface PersonPositionConfig {
  scale: number; // multiplier, default 1
  offsetX: number; // px offset from default position
  offsetY: number; // px offset from default position
}

const CREATIVES: CreativeData[] = [
  { id: 1, headline: "VOCÊ POSTA TODO DIA…\nE NÃO VENDE?", highlightWord: "NÃO VENDE", highlightColor: "#ef4444", text: "O problema não é o conteúdo.\nÉ que você está falando com as pessoas erradas.", cta: "👉 Descubra como atrair clientes reais", category: 'dor', icon: '🚫', layout: 'left' },
  { id: 2, headline: "SEU CONCORRENTE ESTÁ\nPEGANDO SEUS CLIENTES", text: "E o pior… você está ajudando ele sem perceber.", cta: "👉 Aprenda a virar esse jogo", category: 'dor', icon: '⚔️', layout: 'center' },
  { id: 3, headline: "CURTIDAS NÃO\nPAGAM BOLETOS", text: "Você precisa de clientes.\nNão de números vazios.", cta: "👉 Transforme engajamento em vendas", category: 'dor', icon: '👎', layout: 'impact-center' },
  { id: 4, headline: "SEU PERFIL\nESTÁ INVISÍVEL", text: "Quem realmente compra…\nnão está vendo você.", cta: "👉 Mude isso hoje", category: 'dor', icon: '👻', layout: 'bold-stack' },
  { id: 5, headline: "VOCÊ NÃO PRECISA\nDE MAIS POSTS", text: "Você precisa da estratégia certa.", cta: "👉 Descubra qual é", category: 'dor', icon: '📱', layout: 'minimal-center' },
  { id: 6, headline: "VOCÊ ESTÁ PERDENDO\nDINHEIRO", text: "Todos os dias…\npara seus concorrentes.", cta: "👉 Recupere seus clientes", category: 'dor', icon: '💸', layout: 'right' },
  { id: 7, headline: "+1000 VISITAS\nNO SEU PERFIL", text: "Sem gastar 1 real com anúncios.", cta: "👉 Quero isso agora", category: 'promessa', icon: '🚀', layout: 'impact-center' },
  { id: 8, headline: "CLIENTES\nTODOS OS DIAS", text: "Sem depender de tráfego pago.", cta: "👉 Descubra como", category: 'promessa', icon: '📅', layout: 'left' },
  { id: 9, headline: "ROUBAMOS A ATENÇÃO\nDO SEU CONCORRENTE", text: "E transformamos em vendas pra você.", cta: "👉 Veja como funciona", category: 'promessa', icon: '🎯', layout: 'bold-stack' },
  { id: 10, headline: "PARE DE PAGAR\nPARA VENDER", text: "Existe um jeito mais inteligente.", cta: "👉 Conheça", category: 'promessa', icon: '🔌', layout: 'center' },
  { id: 11, headline: "MAIS VENDAS.\nZERO ANÚNCIOS.", text: "Sim, é possível.", cta: "👉 Começar agora", category: 'promessa', icon: '✨', layout: 'minimal-center' },
  { id: 12, headline: "CRESÇA SEM INVESTIR\nEM TRÁFEGO", text: "Estratégia > dinheiro", cta: "👉 Aplicar no meu negócio", category: 'promessa', icon: '🧠', layout: 'right' },
  { id: 13, headline: "ANÚNCIOS NÃO SÃO\nO PROBLEMA", text: "Depender deles é.", cta: "👉 Entenda isso", category: 'educativo', icon: '💡', layout: 'center' },
  { id: 14, headline: "O SEGREDO ESTÁ NO\nSEU CONCORRENTE", text: "O público já existe…\nvocê só precisa acessá-lo.", cta: "👉 Veja como fazemos", category: 'educativo', icon: '🔑', layout: 'impact-center' },
  { id: 15, headline: "VOCÊ NÃO PRECISA\nDE MAIS ALCANCE", text: "Precisa de público certo.", cta: "👉 Aprenda isso", category: 'educativo', icon: '🎯', layout: 'left' },
  { id: 16, headline: "ENGAJAMENTO\nNÃO É SORTE", text: "É estratégia.", cta: "👉 Descubra a nossa", category: 'educativo', icon: '🎲', layout: 'bold-stack' },
  { id: 17, headline: "SEGUIDORES NÃO\nPAGAM CONTAS", text: "Clientes sim.", cta: "👉 Foque no que importa", category: 'educativo', icon: '📊', layout: 'right' },
  { id: 18, headline: "O ERRO QUE TRAVA\nSEU NEGÓCIO", text: "Falar com quem não compra.", cta: "👉 Corrigir isso", category: 'educativo', icon: '⚠️', layout: 'minimal-center' },
  { id: 19, headline: "MAIS CLIENTES\nQUALIFICADOS", text: "Todos os dias no seu perfil.", cta: "👉 Quero isso", category: 'beneficio', icon: '👥', layout: 'bold-stack' },
  { id: 20, headline: "VENDA MAIS\nGASTANDO MENOS", text: "Ou melhor… nada.", cta: "👉 Saiba como", category: 'beneficio', icon: '💰', layout: 'impact-center' },
  { id: 21, headline: "CRESCIMENTO\nPREVISÍVEL", text: "Sem depender de anúncios.", cta: "👉 Começar", category: 'beneficio', icon: '📈', layout: 'center' },
  { id: 22, headline: "TRANSFORME VISITAS\nEM VENDAS", text: "Com público certo.", cta: "👉 Aplicar agora", category: 'beneficio', icon: '🔄', layout: 'left' },
  { id: 23, headline: "MAIS ENGAJAMENTO\nREAL", text: "De quem realmente compra.", cta: "👉 Descubra", category: 'beneficio', icon: '❤️', layout: 'minimal-center' },
  { id: 24, headline: "RESULTADOS\nSEM RISCO", text: "Sem investimento em ads.", cta: "👉 Quero testar", category: 'beneficio', icon: '🛡️', layout: 'right' },
  { id: 25, headline: "EMPRESAS JÁ ESTÃO\nUSANDO ISSO", text: "E crescendo todos os dias.", cta: "👉 Veja como", category: 'autoridade', icon: '🏢', layout: 'left' },
  { id: 26, headline: "+1.000 VISITAS\nEM POUCOS DIAS", text: "Sem anúncios.", cta: "👉 Entenda", category: 'autoridade', icon: '📊', layout: 'impact-center' },
  { id: 27, headline: "O MÉTODO QUE ESTÁ\nFUNCIONANDO EM 2026", text: "E poucos conhecem.", cta: "👉 Acessar", category: 'autoridade', icon: '🔥', layout: 'center' },
  { id: 28, headline: "ENQUANTO VOCÊ\nPAGA ANÚNCIOS…", text: "Outros crescem de graça.", cta: "👉 Mude isso", category: 'autoridade', icon: '💡', layout: 'bold-stack' },
  { id: 29, headline: "RESULTADOS\nREAIS", text: "Sem depender de tráfego pago.", cta: "👉 Aplicar", category: 'autoridade', icon: '✅', layout: 'minimal-center' },
  { id: 30, headline: "VOCÊ ESTÁ\nATRASADO", text: "Se ainda depende de anúncios.", cta: "👉 Atualize sua estratégia", category: 'autoridade', icon: '⏰', layout: 'right' },
];

const CATEGORY_LABELS: Record<string, string> = {
  dor: '🔥 Criativos de Dor (1-6)',
  promessa: '🚀 Criativos de Promessa (7-12)',
  educativo: '🧠 Educativos (13-18)',
  beneficio: '💰 Benefícios (19-24)',
  autoridade: '🔥 Prova / Autoridade (25-30)',
};

type LogoPosition = 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'custom';
type PersonImage = 'none' | 'phone' | 'laptop';
type PatternType = 'auto' | 'diamond' | 'hex' | 'circuit' | 'dots' | 'rings' | 'none';

interface PatternConfig {
  type: PatternType;
  opacity: number; // multiplier 0-2
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const cacheHolder = window as unknown as { __mroImageCache?: Map<string, Promise<HTMLImageElement>> };
  if (!cacheHolder.__mroImageCache) {
    cacheHolder.__mroImageCache = new Map();
  }

  const cached = cacheHolder.__mroImageCache.get(src);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  cacheHolder.__mroImageCache.set(src, promise);
  return promise;
}

// ─── Background effects ───
function drawDiamondGrid(ctx: CanvasRenderingContext2D, W: number, H: number, color: string) {
  ctx.save();
  ctx.strokeStyle = hexToRgba(color, 0.06);
  ctx.lineWidth = 1;
  const spacing = 60;
  for (let i = -H; i < W + H; i += spacing) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i + H, 0); ctx.lineTo(i, H); ctx.stroke();
  }
  ctx.restore();
}

function drawHexPattern(ctx: CanvasRenderingContext2D, W: number, H: number, color: string) {
  ctx.save();
  const size = 40;
  const h = size * Math.sqrt(3);
  ctx.strokeStyle = hexToRgba(color, 0.05);
  ctx.lineWidth = 1;
  for (let row = 0; row < H / h + 1; row++) {
    for (let col = 0; col < W / (size * 1.5) + 1; col++) {
      const cx = col * size * 1.5;
      const cy = row * h + (col % 2 === 1 ? h / 2 : 0);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + size * 0.6 * Math.cos(angle);
        const y = cy + size * 0.6 * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCircuitLines(ctx: CanvasRenderingContext2D, W: number, H: number, color: string) {
  ctx.save();
  ctx.strokeStyle = hexToRgba(color, 0.07);
  ctx.lineWidth = 1.5;
  const lines = [
    [[80, 200], [300, 200], [300, 400], [500, 400]],
    [[W - 80, 300], [W - 250, 300], [W - 250, 550], [W - 400, 550]],
    [[100, H - 400], [350, H - 400], [350, H - 300]],
    [[W - 100, H - 500], [W - 300, H - 500], [W - 300, H - 350], [W - 500, H - 350]],
  ];
  for (const line of lines) {
    ctx.beginPath();
    for (let i = 0; i < line.length; i++) {
      if (i === 0) ctx.moveTo(line[i][0], line[i][1]);
      else ctx.lineTo(line[i][0], line[i][1]);
    }
    ctx.stroke();
    for (const pt of line) {
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 3, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, 0.12);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawGlowOrb(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string, opacityMult: number = 1) {
  ctx.save();
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, hexToRgba(color, 0.15 * opacityMult));
  grad.addColorStop(0.5, hexToRgba(color, 0.05 * opacityMult));
  grad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDotMatrix(ctx: CanvasRenderingContext2D, x: number, y: number, cols: number, rows: number, spacing: number, color: string) {
  ctx.save();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.beginPath();
      ctx.arc(x + c * spacing, y + r * spacing, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, 0.08);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawConcentricRings(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, maxR: number) {
  ctx.save();
  for (let r = 40; r < maxR; r += 30) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(color, 0.04);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawFloatingShapes(ctx: CanvasRenderingContext2D, W: number, H: number, color: string, seed: number) {
  ctx.save();
  const shapes = [
    { x: W * 0.1, y: H * 0.12, size: 45, type: 'tri' },
    { x: W * 0.88, y: H * 0.08, size: 35, type: 'circle' },
    { x: W * 0.05, y: H * 0.55, size: 25, type: 'diamond' },
    { x: W * 0.92, y: H * 0.45, size: 30, type: 'tri' },
    { x: W * 0.15, y: H * 0.82, size: 20, type: 'circle' },
    { x: W * 0.85, y: H * 0.78, size: 40, type: 'diamond' },
  ];
  for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i];
    const alpha = 0.06 + ((seed + i) % 5) * 0.015;
    ctx.fillStyle = hexToRgba(color, alpha);
    ctx.strokeStyle = hexToRgba(color, alpha * 1.5);
    ctx.lineWidth = 1;
    if (s.type === 'circle') {
      ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      if (i % 2 === 0) ctx.fill(); else ctx.stroke();
    } else if (s.type === 'tri') {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.size);
      ctx.lineTo(s.x - s.size * 0.866, s.y + s.size * 0.5);
      ctx.lineTo(s.x + s.size * 0.866, s.y + s.size * 0.5);
      ctx.closePath();
      if (i % 2 === 0) ctx.stroke(); else ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.size);
      ctx.lineTo(s.x + s.size, s.y);
      ctx.lineTo(s.x, s.y + s.size);
      ctx.lineTo(s.x - s.size, s.y);
      ctx.closePath();
      if (i % 2 === 0) ctx.fill(); else ctx.stroke();
    }
  }
  ctx.restore();
}

// ─── Component ───

type ViewMode = 'menu' | 'posts-creator' | 'materiais' | 'contrato' | 'proposta-empresa' | 'tutoriais' | 'testes' | 'relatorios' | 'gerenciador-windows' | 'estrutura-links' | 'fechar-contratos-links' | 'explore-options';

const EstruturaRendaExtra = () => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<ViewMode>('menu');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mroUsername, setMroUsername] = useState('');
  const [mroPassword, setMroPassword] = useState('');
  const [showLogoPopup, setShowLogoPopup] = useState(false);
  const [showGerenciadorPopup, setShowGerenciadorPopup] = useState(false);
  const [showRendaExtraVideo, setShowRendaExtraVideo] = useState(false);
  const [showRegisterChoice, setShowRegisterChoice] = useState(false);
  const { whatsappNumber } = useWhatsAppConfig();
  
  const [bgColor1, setBgColor1] = useState('#0f0f1a');
  const [bgColor2, setBgColor2] = useState('#1a1a3e');
  const [useGradient, setUseGradient] = useState(true);
  const [gradientAngle, setGradientAngle] = useState(160);
  const [textColor, setTextColor] = useState('#ffffff');
  const [accentColor, setAccentColor] = useState('#00d4aa');
  const [highlight2Color, setHighlight2Color] = useState('#ef4444');
  const [ctaColor, setCtaColor] = useState('#facc15');
  const [ctaBgColor, setCtaBgColor] = useState('#00d4aa');
  const [ctaTextColor, setCtaTextColor] = useState('#000000');
  const [ctaBgOpacity, setCtaBgOpacity] = useState(0.15);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(true);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [showNumbers, setShowNumbers] = useState(false);
  const [showDecorations, setShowDecorations] = useState(true);
  const [showBadge, setShowBadge] = useState(false);
  const [personImage, setPersonImage] = useState<PersonImage>('none');
  const [effectsColor, setEffectsColor] = useState('#4a90ff');
  const [effectsOpacity, setEffectsOpacity] = useState(0.15);
  const [personOpacity, setPersonOpacity] = useState(0.15);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>('bottom-right');
  const [logoOverrides, setLogoOverrides] = useState<Record<number, LogoOverride>>({});
  const [bgImageOverrides, setBgImageOverrides] = useState<Record<number, BgImageOverride>>({});
  const [personOverrides, setPersonOverrides] = useState<Record<number, PersonImage>>({});
  const [patternConfig, setPatternConfig] = useState<PatternConfig>({ type: 'auto', opacity: 1 });
  const [patternOverrides, setPatternOverrides] = useState<Record<number, PatternConfig>>({});
  const [personPositionOverrides, setPersonPositionOverrides] = useState<Record<number, PersonPositionConfig>>({});
  const [contentScaleOverrides, setContentScaleOverrides] = useState<Record<number, number>>({});
  const [contentOffsetYOverrides, setContentOffsetYOverrides] = useState<Record<number, number>>({});
  const [contentScale, setContentScale] = useState(1);
  const [contentOffsetY, setContentOffsetY] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [personPhoneLoaded, setPersonPhoneLoaded] = useState<HTMLImageElement | null>(null);
  const [personLaptopLoaded, setPersonLaptopLoaded] = useState<HTMLImageElement | null>(null);
  const [fontsReady, setFontsReady] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const session = getUserSession();
    if (session.isAuthenticated && session.user) {
      setIsAuthenticated(true);
      setMroUsername(session.user.username);
      const pwd = sessionStorage.getItem('mro_temp_pwd') || '';
      setMroPassword(pwd);
    }
    setCheckingAuth(false);
  }, []);

  // Load person images and fonts
  useEffect(() => {
    loadImage(personPhoneImg).then(setPersonPhoneLoaded).catch(() => {});
    loadImage(personLaptopImg).then(setPersonLaptopLoaded).catch(() => {});

    const fontDefs = [
      { family: 'Bebas Neue', url: 'https://fonts.gstatic.com/s/bebasneue/v14/JTUSjIg69CK48gW7PXooxW5rygbi49c.woff2', weight: '400' },
      { family: 'Anton', url: 'https://fonts.gstatic.com/s/anton/v25/1Ptgg87GROyAm3K8-C8CSKlv.woff2', weight: '400' },
      { family: 'Oswald', url: 'https://fonts.gstatic.com/s/oswald/v53/TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUZiZQ.woff2', weight: '700' },
      { family: 'Playfair Display', url: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQZNLo_U2r.woff2', weight: '900' },
      { family: 'Dancing Script', url: 'https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7B1i0HTeB9ptDqpw.woff2', weight: '700' },
      { family: 'Caveat', url: 'https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9SIKjYBxPigs.woff2', weight: '700' },
      { family: 'Montserrat', url: 'https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM73w5aXo.woff2', weight: '900' },
      { family: 'Raleway', url: 'https://fonts.gstatic.com/s/raleway/v34/1Ptxg8zYS_SKggPN4iEgvnHyvveLxVvaorCIPrQ.woff2', weight: '800' },
    ];

    Promise.all(fontDefs.map(async (fd) => {
      const face = new FontFace(fd.family, `url(${fd.url})`, { weight: fd.weight });
      const loaded = await face.load();
      document.fonts.add(loaded);
    })).then(() => setFontsReady(true)).catch(() => setFontsReady(true));
  }, []);

  const handleLoginSuccess = () => {
    const session = getUserSession();
    if (session.user) {
      setMroUsername(session.user.username);
      const pwd = sessionStorage.getItem('mro_temp_pwd') || '';
      setMroPassword(pwd);
    }
    setIsAuthenticated(true);
  };

  // Auth checks moved to render section below (after all hooks)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoUrl(ev.target?.result as string);
      toast.success('Logo carregada!');
    };
    reader.readAsDataURL(file);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === 30) setSelectedIds(new Set());
    else setSelectedIds(new Set(CREATIVES.map(c => c.id)));
  };

  const getLogoCoords = (creativeId: number, W: number, H: number, lW: number, lH: number) => {
    const override = logoOverrides[creativeId];
    if (override) {
      return { x: override.x * W, y: override.y * H };
    }
    switch (logoPosition) {
      case 'bottom-right': return { x: W - lW - 70, y: H - lH - 70 };
      case 'bottom-left': return { x: 70, y: H - lH - 70 };
      case 'top-center': return { x: (W - lW) / 2, y: 50 };
      case 'top-right': return { x: W - lW - 70, y: 50 };
      default: return { x: W - lW - 70, y: H - lH - 70 };
    }
  };

  const makeGrad = (ctx: CanvasRenderingContext2D, w: number, h: number, c1: string, c2: string) => {
    const rad = (gradientAngle - 90) * Math.PI / 180;
    const cx = w / 2, cy = h / 2;
    const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
    const x1 = cx - Math.cos(rad) * len / 2;
    const y1 = cy - Math.sin(rad) * len / 2;
    const x2 = cx + Math.cos(rad) * len / 2;
    const y2 = cy + Math.sin(rad) * len / 2;
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    return g;
  };

  const drawCreative = useCallback(async (creative: CreativeData, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')!;
    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;

    // ── Background ──
    if (useGradient) {
      ctx.fillStyle = makeGrad(ctx, W, H, bgColor1, bgColor2);
    } else {
      ctx.fillStyle = bgColor1;
    }
    ctx.fillRect(0, 0, W, H);

    // ── Custom background image per creative ──
    const bgOvr = bgImageOverrides[creative.id];
    if (bgOvr) {
      try {
        const bgImg = await loadImage(bgOvr.url);
        const bgW = bgImg.width * bgOvr.scale;
        const bgH = bgImg.height * bgOvr.scale;
        ctx.globalAlpha = bgOvr.opacity;
        ctx.drawImage(bgImg, bgOvr.x, bgOvr.y, bgW, bgH);
        ctx.globalAlpha = 1;
        // Semi-transparent overlay to keep text readable
        if (useGradient) {
          const overlay = makeGrad(ctx, W, H, hexToRgba(bgColor1, 0.6), hexToRgba(bgColor2, 0.6));
          ctx.fillStyle = overlay;
        } else {
          ctx.fillStyle = hexToRgba(bgColor1, 0.6);
        }
        ctx.fillRect(0, 0, W, H);
      } catch { /* skip */ }
    }

    // ── Category-specific effects ──
    const pCfg = patternOverrides[creative.id] || patternConfig;
    if (showDecorations && pCfg.type !== 'none') {
      ctx.globalAlpha = pCfg.opacity;
      const pType = pCfg.type;
      const catIndex = ['dor', 'promessa', 'educativo', 'beneficio', 'autoridade'].indexOf(creative.category);

      if (pType === 'auto') {
        // Original category-based patterns
        if (catIndex === 0) {
          drawDiamondGrid(ctx, W, H, accentColor);
          drawGlowOrb(ctx, W * 0.8, H * 0.15, 250, effectsColor, effectsOpacity / 0.15);
          drawGlowOrb(ctx, W * 0.15, H * 0.85, 200, effectsColor, effectsOpacity / 0.15);
          drawCircuitLines(ctx, W, H, accentColor);
        } else if (catIndex === 1) {
          drawHexPattern(ctx, W, H, accentColor);
          drawGlowOrb(ctx, W * 0.85, H * 0.1, 300, effectsColor, effectsOpacity / 0.15);
          drawConcentricRings(ctx, W * 0.5, H * 0.35, accentColor, 250);
        } else if (catIndex === 2) {
          drawDotMatrix(ctx, 60, 60, 20, 25, 50, accentColor);
          drawGlowOrb(ctx, W * 0.75, H * 0.2, 220, effectsColor, effectsOpacity / 0.15);
        } else if (catIndex === 3) {
          drawCircuitLines(ctx, W, H, ctaColor);
          drawGlowOrb(ctx, W * 0.5, H * 0.15, 280, effectsColor, effectsOpacity / 0.15);
          drawHexPattern(ctx, W, H, ctaColor);
        } else {
          drawDiamondGrid(ctx, W, H, accentColor);
          drawConcentricRings(ctx, W * 0.85, H * 0.12, accentColor, 200);
          drawGlowOrb(ctx, W * 0.5, H * 0.5, 350, effectsColor, effectsOpacity / 0.15);
        }
      } else {
        // Specific pattern chosen
        const pColor = catIndex === 3 ? ctaColor : accentColor;
        if (pType === 'diamond') {
          drawDiamondGrid(ctx, W, H, pColor);
        } else if (pType === 'hex') {
          drawHexPattern(ctx, W, H, pColor);
        } else if (pType === 'circuit') {
          drawCircuitLines(ctx, W, H, pColor);
        } else if (pType === 'dots') {
          drawDotMatrix(ctx, 60, 60, 20, 25, 50, pColor);
        } else if (pType === 'rings') {
          drawConcentricRings(ctx, W * 0.5, H * 0.4, pColor, 350);
        }
        drawGlowOrb(ctx, W * 0.8, H * 0.15, 250, effectsColor, effectsOpacity / 0.15);
        drawGlowOrb(ctx, W * 0.2, H * 0.8, 200, effectsColor, effectsOpacity / 0.15);
      }
      drawFloatingShapes(ctx, W, H, accentColor, creative.id);
      ctx.globalAlpha = 1;
    }

    // ── Person image (real photo overlay) ──
    const effectivePersonImage = personOverrides[creative.id] !== undefined ? personOverrides[creative.id] : personImage;
    const selectedPerson = effectivePersonImage === 'phone' ? personPhoneLoaded : effectivePersonImage === 'laptop' ? personLaptopLoaded : null;
    if (selectedPerson && effectivePersonImage !== 'none') {
      const posConfig = personPositionOverrides[creative.id] || { scale: 1, offsetX: 0, offsetY: 0 };
      const personH = H * 0.7 * posConfig.scale;
      const personW = (selectedPerson.width / selectedPerson.height) * personH;
      const px = W - personW + 60 + posConfig.offsetX;
      const py = H - personH + posConfig.offsetY;
      ctx.globalAlpha = personOpacity;
      ctx.drawImage(selectedPerson, px, py, personW, personH);
      ctx.globalAlpha = 1;
      // Gradient fade from left to blend
      const fadeGrad = ctx.createLinearGradient(px, py, px + personW * 0.5, py);
      fadeGrad.addColorStop(0, useGradient ? bgColor2 : bgColor1);
      fadeGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = fadeGrad;
      ctx.fillRect(px, py, personW, personH);
    }

    // ── Top accent bar ──
    const topGrad = ctx.createLinearGradient(0, 0, W, 0);
    topGrad.addColorStop(0, accentColor);
    topGrad.addColorStop(0.6, hexToRgba(accentColor, 0.3));
    topGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, W, 6);

    // ── Side accent stripe ──
    const sideGrad = ctx.createLinearGradient(0, 0, 0, H);
    sideGrad.addColorStop(0, accentColor);
    sideGrad.addColorStop(0.5, hexToRgba(accentColor, 0.2));
    sideGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = sideGrad;
    ctx.fillRect(0, 0, 4, H);

    // ── Category badge ──
    let badgeEndY = 60;
    if (showBadge) {
      const catLabel = creative.category.toUpperCase();
      ctx.font = 'bold 22px Arial, sans-serif';
      const badgeTextW = ctx.measureText(catLabel).width;
      const badgeW = badgeTextW + 50;
      ctx.fillStyle = hexToRgba(accentColor, 0.12);
      roundRect(ctx, 70, 60, badgeW, 42, 21);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(accentColor, 0.3);
      ctx.lineWidth = 1;
      roundRect(ctx, 70, 60, badgeW, 42, 21);
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(catLabel, 95, 87);
      badgeEndY = 120;
    }

    // ── Large watermark number ──
    if (showNumbers) {
      ctx.font = 'bold 220px Arial, sans-serif';
      ctx.globalAlpha = 0.03;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'right';
      ctx.fillText(String(creative.id).padStart(2, '0'), W - 40, 300);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    // ── Text rendering based on layout ──
    const layout = creative.layout;
    const isCenter = layout === 'center' || layout === 'impact-center' || layout === 'minimal-center' || layout === 'bold-stack';
    const isRight = layout === 'right';

    // Generous margins to prevent text from hugging edges
    const marginX = 100;
    const maxTextW = W - marginX * 2;

    // Font sizes per layout (scaled by contentScale, with per-creative override)
    const sc = contentScaleOverrides[creative.id] ?? contentScale;
    const headlineFontSize = Math.round((layout === 'impact-center' ? 88 : layout === 'bold-stack' ? 80 : layout === 'minimal-center' ? 68 : layout === 'right' ? 72 : layout === 'center' ? 74 : 72) * sc);
    const bodyFontSize = Math.round((layout === 'impact-center' ? 36 : layout === 'minimal-center' ? 40 : layout === 'bold-stack' ? 38 : 38) * sc);
    const ctaFontSize = Math.round((layout === 'impact-center' ? 34 : layout === 'bold-stack' ? 32 : 34) * sc);
    const headlineSpacing = Math.round((layout === 'impact-center' ? 108 : layout === 'bold-stack' ? 98 : layout === 'minimal-center' ? 86 : 92) * sc);

    // Font families - using loaded Google Fonts
    const headlineFont = layout === 'impact-center' ? `400 ${headlineFontSize}px 'Bebas Neue', Impact, sans-serif`
      : layout === 'bold-stack' ? `900 ${headlineFontSize}px 'Montserrat', sans-serif`
      : layout === 'minimal-center' ? `900 ${headlineFontSize}px 'Playfair Display', serif`
      : layout === 'right' ? `800 ${headlineFontSize}px 'Raleway', sans-serif`
      : layout === 'center' ? `400 ${headlineFontSize}px 'Anton', sans-serif`
      : `700 ${headlineFontSize}px 'Oswald', sans-serif`;

    // Script/handwritten font for body text on some layouts
    const bodyFont = layout === 'minimal-center' ? `700 ${bodyFontSize}px 'Dancing Script', cursive`
      : layout === 'bold-stack' ? `700 ${bodyFontSize + 4}px 'Caveat', cursive`
      : layout === 'center' ? `${bodyFontSize}px 'Raleway', sans-serif`
      : layout === 'right' ? `${bodyFontSize}px 'Montserrat', sans-serif`
      : layout === 'impact-center' ? `${bodyFontSize}px 'Oswald', sans-serif`
      : `${bodyFontSize}px 'Raleway', sans-serif`;

    const ctaFont = layout === 'bold-stack' ? `900 ${ctaFontSize}px 'Montserrat', sans-serif`
      : layout === 'minimal-center' ? `900 ${ctaFontSize}px 'Playfair Display', serif`
      : layout === 'impact-center' ? `400 ${ctaFontSize}px 'Bebas Neue', sans-serif`
      : layout === 'center' ? `400 ${ctaFontSize}px 'Anton', sans-serif`
      : `700 ${ctaFontSize}px 'Oswald', sans-serif`;

    // Alignment
    const textAlign: CanvasTextAlign = isCenter ? 'center' : isRight ? 'right' : 'left';
    const textX = isCenter ? W / 2 : isRight ? W - marginX : marginX;

    // Start Y position - vertically centered + offset
    const baseStartY = layout === 'impact-center' ? 400 : layout === 'bold-stack' ? 360 : layout === 'minimal-center' ? 420 : Math.max(badgeEndY + 240, 360);
    const startY = baseStartY + (contentOffsetYOverrides[creative.id] ?? contentOffsetY);

    // Helper: auto-shrink font if headline is too wide
    const fitFont = (baseFontStr: string, baseSize: number, text: string): string => {
      ctx.font = baseFontStr;
      const w = ctx.measureText(text).width;
      if (w <= maxTextW) return baseFontStr;
      const ratio = maxTextW / w;
      const newSize = Math.floor(baseSize * ratio);
      return baseFontStr.replace(`${baseSize}px`, `${newSize}px`);
    };

    // ── Headline ──
    const headlineLines = creative.headline.split('\n');
    ctx.textAlign = textAlign;
    let y = startY;

    if (layout === 'bold-stack') {
      // Each line gets its own colored background strip
      for (const line of headlineLines) {
        ctx.font = fitFont(headlineFont, headlineFontSize, line);
        const metrics = ctx.measureText(line);
        const lineW = metrics.width + 50;
        const lineH = headlineFontSize + 24;
        const stripX = isCenter ? (W - lineW) / 2 : isRight ? W - marginX - lineW : marginX - 25;
        ctx.fillStyle = hexToRgba(accentColor, 0.15);
        roundRect(ctx, stripX, y - headlineFontSize + 5, lineW, lineH, 10);
        ctx.fill();
        ctx.fillStyle = textColor;
        ctx.fillText(line, textX, y);
        y += headlineSpacing;
      }
    } else {
      for (const line of headlineLines) {
        ctx.font = fitFont(headlineFont, headlineFontSize, line);

        if (creative.highlightWord && line.includes(creative.highlightWord)) {
          // Highlight word handling
          const before = line.substring(0, line.indexOf(creative.highlightWord));
          const highlight = creative.highlightWord;
          const after = line.substring(line.indexOf(creative.highlightWord) + creative.highlightWord.length);
          const hlColor = highlight2Color;

          if (isCenter || isRight) {
            const fullW = ctx.measureText(line).width;
            let x = isCenter ? (W - fullW) / 2 : W - marginX - fullW;
            ctx.textAlign = 'left';
            if (before) { ctx.fillStyle = textColor; ctx.fillText(before, x, y); x += ctx.measureText(before).width; }
            ctx.shadowColor = hlColor; ctx.shadowBlur = 20;
            ctx.fillStyle = hlColor; ctx.fillText(highlight, x, y);
            ctx.shadowBlur = 0; x += ctx.measureText(highlight).width;
            if (after) { ctx.fillStyle = textColor; ctx.fillText(after, x, y); }
            ctx.textAlign = textAlign;
          } else {
            let x = marginX;
            if (before) { ctx.fillStyle = textColor; ctx.fillText(before, x, y); x += ctx.measureText(before).width; }
            ctx.shadowColor = hlColor; ctx.shadowBlur = 20;
            ctx.fillStyle = hlColor;
            ctx.textAlign = 'left';
            ctx.fillText(highlight, x, y);
            ctx.shadowBlur = 0; x += ctx.measureText(highlight).width;
            if (after) { ctx.fillStyle = textColor; ctx.fillText(after, x, y); }
            ctx.textAlign = textAlign;
          }
        } else {
          // Make first word of each headline line bold/accent for visual hierarchy
          const words = line.split(' ');
          if (words.length > 1 && layout !== 'impact-center') {
            const firstWord = words[0];
            const rest = ' ' + words.slice(1).join(' ');
            if (isCenter || isRight) {
              const fullW = ctx.measureText(line).width;
              let x = isCenter ? (W - fullW) / 2 : W - marginX - fullW;
              ctx.textAlign = 'left';
              ctx.fillStyle = accentColor;
              ctx.fillText(firstWord, x, y);
              x += ctx.measureText(firstWord).width;
              ctx.fillStyle = textColor;
              ctx.fillText(rest, x, y);
              ctx.textAlign = textAlign;
            } else {
              let x = marginX;
              ctx.textAlign = 'left';
              ctx.fillStyle = accentColor;
              ctx.fillText(firstWord, x, y);
              x += ctx.measureText(firstWord).width;
              ctx.fillStyle = textColor;
              ctx.fillText(rest, x, y);
              ctx.textAlign = textAlign;
            }
          } else {
            ctx.fillStyle = textColor;
            if (layout === 'impact-center') {
              ctx.shadowColor = hexToRgba(accentColor, 0.4);
              ctx.shadowBlur = 25;
            }
            ctx.fillText(line, textX, y);
            ctx.shadowBlur = 0;
          }
        }
        y += headlineSpacing;
      }
    }

    // ── Divider ──
    y += 20;
    if (layout === 'minimal-center') {
      // Centered thin line
      const divW = 200;
      ctx.fillStyle = hexToRgba(accentColor, 0.5);
      ctx.fillRect((W - divW) / 2, y, divW, 2);
      y += 40;
    } else if (layout === 'impact-center') {
      // No divider, just spacing
      y += 10;
    } else if (layout === 'bold-stack') {
      // Small dot divider
      for (let d = 0; d < 3; d++) {
        ctx.beginPath();
        ctx.arc(isCenter ? W / 2 - 20 + d * 20 : isRight ? W - 100 + d * 20 : 100 + d * 20, y + 2, 4, 0, Math.PI * 2);
        ctx.fillStyle = accentColor;
        ctx.fill();
      }
      y += 35;
    } else if (isRight) {
      const divGrad = ctx.createLinearGradient(W - 520, y, W - marginX, y);
      divGrad.addColorStop(0, hexToRgba(accentColor, 0));
      divGrad.addColorStop(1, accentColor);
      ctx.fillStyle = divGrad;
      ctx.fillRect(W - 520, y, 420, 3);
      ctx.beginPath();
      ctx.arc(W - marginX, y + 1.5, 5, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();
      y += 45;
    } else if (isCenter) {
      const divW = 380;
      const divGrad = ctx.createLinearGradient((W - divW) / 2, y, (W + divW) / 2, y);
      divGrad.addColorStop(0, hexToRgba(accentColor, 0));
      divGrad.addColorStop(0.5, accentColor);
      divGrad.addColorStop(1, hexToRgba(accentColor, 0));
      ctx.fillStyle = divGrad;
      ctx.fillRect((W - divW) / 2, y, divW, 3);
      y += 45;
    } else {
      const divGrad = ctx.createLinearGradient(marginX, y, marginX + 420, y);
      divGrad.addColorStop(0, accentColor);
      divGrad.addColorStop(1, hexToRgba(accentColor, 0));
      ctx.fillStyle = divGrad;
      ctx.fillRect(marginX, y, 420, 3);
      ctx.beginPath();
      ctx.arc(marginX, y + 1.5, 5, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();
      y += 45;
    }

    // ── Body text ──
    ctx.font = bodyFont;
    ctx.fillStyle = textColor;
    ctx.globalAlpha = layout === 'minimal-center' ? 0.7 : 0.8;
    ctx.textAlign = textAlign;
    const bodyLines = creative.text.split('\n');
    const bodySpacing = Math.round((layout === 'minimal-center' ? 62 : layout === 'bold-stack' ? 54 : 58) * sc);
    for (const line of bodyLines) {
      ctx.fillText(line, textX, y);
      y += bodySpacing;
    }
    ctx.globalAlpha = 1;

    // ── CTA ──
    y += 25;
    const ctaY = Math.min(y, H - 200);
    ctx.font = ctaFont;
    const ctaTextWidth = ctx.measureText(creative.cta).width;

    if (layout === 'impact-center') {
      // Pill-style CTA button
      const pillW = ctaTextWidth + 80;
      const pillH = 80;
      const pillX = (W - pillW) / 2;
      ctx.fillStyle = hexToRgba(ctaBgColor, ctaBgOpacity);
      roundRect(ctx, pillX, ctaY, pillW, pillH, 40);
      ctx.fill();
      ctx.fillStyle = ctaTextColor;
      ctx.textAlign = 'center';
      ctx.fillText(creative.cta, W / 2, ctaY + 54);
    } else if (layout === 'minimal-center') {
      // Underline-style CTA
      ctx.fillStyle = ctaTextColor;
      ctx.textAlign = 'center';
      ctx.fillText(creative.cta, W / 2, ctaY + 58);
      ctx.fillStyle = hexToRgba(ctaBgColor, 0.4);
      ctx.fillRect((W - ctaTextWidth) / 2, ctaY + 65, ctaTextWidth, 2);
    } else if (layout === 'bold-stack') {
      // Full-width CTA bar
      ctx.fillStyle = hexToRgba(ctaBgColor, ctaBgOpacity);
      ctx.fillRect(marginX - 20, ctaY, W - (marginX - 20) * 2, 80);
      ctx.fillStyle = ctaTextColor;
      ctx.textAlign = 'center';
      ctx.shadowColor = hexToRgba(ctaTextColor, 0.3);
      ctx.shadowBlur = 15;
      ctx.fillText(creative.cta, W / 2, ctaY + 54);
      ctx.shadowBlur = 0;
    } else {
      // Standard rounded CTA box
      const ctaBoxW = W - marginX * 2 + 40;
      const ctaBoxX = (W - ctaBoxW) / 2;
      ctx.fillStyle = hexToRgba(ctaBgColor, ctaBgOpacity);
      roundRect(ctx, ctaBoxX, ctaY, ctaBoxW, 90, 18);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(ctaBgColor, 0.3);
      ctx.lineWidth = 1;
      roundRect(ctx, ctaBoxX, ctaY, ctaBoxW, 90, 18);
      ctx.stroke();
      ctx.fillStyle = ctaTextColor;
      ctx.shadowColor = hexToRgba(ctaTextColor, 0.3);
      ctx.shadowBlur = 15;
      ctx.textAlign = textAlign;
      ctx.fillText(creative.cta, isCenter ? W / 2 : isRight ? W - marginX - 10 : marginX + 10, ctaY + 58);
      ctx.shadowBlur = 0;
    }

    // Reset text align
    ctx.textAlign = 'left';

    // ── Bottom accent bar ──
    const botGrad = ctx.createLinearGradient(0, H - 6, W, H - 6);
    botGrad.addColorStop(0, 'transparent');
    botGrad.addColorStop(0.4, hexToRgba(accentColor, 0.3));
    botGrad.addColorStop(1, accentColor);
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, H - 6, W, 6);

    // ── Logo ──
    if (logoUrl) {
      try {
        const img = await loadImage(logoUrl);
        const override = logoOverrides[creative.id];
        const logoScale = override?.scale ?? 1;
        const lH = 80 * logoScale;
        const lW = (img.width / img.height) * lH;
        const coords = getLogoCoords(creative.id, W, H, lW, lH);
        ctx.shadowColor = hexToRgba(accentColor, 0.3);
        ctx.shadowBlur = 15;
        ctx.drawImage(img, coords.x, coords.y, lW, lH);
        ctx.shadowBlur = 0;
      } catch { /* skip */ }
    }

    // ── Small number bottom-left ──
    if (showNumbers) {
      ctx.font = 'bold 24px Arial, sans-serif';
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.2;
      ctx.fillText(`#${String(creative.id).padStart(2, '0')}`, 80, H - 30);
      ctx.globalAlpha = 1;
    }
  }, [bgColor1, bgColor2, useGradient, gradientAngle, textColor, accentColor, ctaColor, ctaBgColor, ctaTextColor, ctaBgOpacity, effectsColor, effectsOpacity, contentScale, contentOffsetY, contentScaleOverrides, contentOffsetYOverrides, logoUrl, showNumbers, showDecorations, showBadge, personImage, personOpacity, logoPosition, logoOverrides, bgImageOverrides, personOverrides, personPositionOverrides, patternConfig, patternOverrides, personPhoneLoaded, personLaptopLoaded, fontsReady, getLogoCoords]);

  const downloadSingle = async (creative: CreativeData) => {
    const canvas = document.createElement('canvas');
    await drawCreative(creative, canvas);
    const link = document.createElement('a');
    link.download = `criativo-${String(creative.id).padStart(2, '0')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success(`Criativo ${creative.id} baixado!`);
  };

  const downloadSelected = async () => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : CREATIVES.map(c => c.id);
    if (ids.length === 0) { toast.error('Selecione ao menos 1 criativo'); return; }
    setDownloading(true);
    try {
      const zip = new JSZip();
      const canvas = document.createElement('canvas');
      for (const id of ids) {
        const creative = CREATIVES.find(c => c.id === id)!;
        await drawCreative(creative, canvas);
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        zip.file(`criativo-${String(id).padStart(2, '0')}.png`, base64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.download = `criativos-rendaextra-${ids.length}un.zip`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`${ids.length} criativos baixados em ZIP!`);
    } catch { toast.error('Erro ao gerar ZIP'); }
    setDownloading(false);
  };

  const getPreviewBg = () => {
    if (useGradient) return `linear-gradient(${gradientAngle}deg, ${bgColor1}, ${bgColor2})`;
    return bgColor1;
  };

  // Auth checks (after all hooks)
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (currentView === 'testes') {
    return <EstruturaTrialDashboard onBack={() => setCurrentView('menu')} mroUsername={mroUsername} mroPassword={mroPassword} />;
  }

  if (currentView === 'relatorios') {
    return <ReportGenerator onBack={() => setCurrentView('menu')} mroUsername={mroUsername} />;
  }

  if (currentView === 'explore-options') {
    return (
      <div className="min-h-screen bg-[#0a0a14] text-white flex flex-col overflow-hidden">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-500/[0.04] rounded-full blur-[70px] md:blur-[150px] animate-pulse" />
          <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-fuchsia-500/[0.03] rounded-full blur-[80px] md:blur-[180px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto w-full px-4 py-12 md:py-20 flex flex-col items-center justify-center min-h-screen space-y-12">
          <div className="text-center space-y-4">
             <button
              onClick={() => setCurrentView('menu')}
              className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para o Menu
            </button>
            <h2 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-fuchsia-400 to-purple-600 bg-clip-text text-transparent">
              Explore a Ferramenta MRO
            </h2>
            <p className="text-white/40 text-lg font-medium">Siga os passos abaixo para começar a utilizar o sistema profissionalmente.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            {/* Passo 1 - Cadastrar Conta */}
            <div className="relative group p-1 rounded-[2.5rem] bg-gradient-to-br from-fuchsia-500/20 via-transparent to-transparent">
              <div className="relative h-full p-8 rounded-[2.4rem] bg-[#0d0d16] border border-white/5 flex flex-col gap-6 overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="w-16 h-16 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400">
                    <UserPlus className="w-8 h-8" />
                  </div>
                  <span className="text-4xl font-black text-white/5 italic">01</span>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-white font-black text-2xl tracking-tight">Passo 1: Cadastrar Conta</h3>
                  <p className="text-white/40 text-sm leading-relaxed font-medium">
                    Cadastre sua conta no banco de dados e entenda como nossa IA analisa e potencializa seu perfil automaticamente.
                  </p>
                </div>

                <div className="mt-auto flex flex-col gap-3">
                  <button 
                    onClick={() => setShowRegisterChoice(true)} 
                    className="w-full group relative h-14 rounded-2xl bg-white text-black font-black text-sm flex items-center justify-center transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] overflow-hidden active:scale-95"
                  >
                    <span className="relative z-10 flex items-center gap-2 uppercase tracking-wider">
                      Cadastre uma nova conta para usar <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => navigate('/instagram')} 
                      className="flex-1 group relative h-12 rounded-xl bg-white/5 border border-white/10 text-white/70 font-bold text-[10px] flex items-center justify-center transition-all duration-300 hover:bg-white/10 uppercase tracking-widest"
                    >
                      Cadastro Rápido
                    </button>
                    
                    <a
                      href="https://www.youtube.com/watch?v=CPI6xSH4TjU"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300"
                      title="Ver Tutorial"
                    >
                      <Play className="w-5 h-5 fill-current" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Passo 2 - Instalar e Utilizar */}
            <div className="relative group p-1 rounded-[2.5rem] bg-gradient-to-br from-purple-500/20 via-transparent to-transparent">
              <div className="relative h-full p-8 rounded-[2.4rem] bg-[#0d0d16] border border-white/5 flex flex-col gap-6 overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                    <Rocket className="w-8 h-8" />
                  </div>
                  <span className="text-4xl font-black text-white/5 italic">02</span>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-white font-black text-2xl tracking-tight">Passo 2: Instale e Utilize</h3>
                  <p className="text-white/40 text-sm leading-relaxed font-medium">
                    Após cadastrar seu perfil, instale a ferramenta e comece a utilizar todas as funcionalidades sem limites.
                  </p>
                </div>

                <button 
                  onClick={() => navigate('/mro-ferramenta')} 
                  className="mt-auto group w-full relative h-14 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-base flex items-center justify-center transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] overflow-hidden active:scale-95"
                >
                  <span className="relative z-10 flex items-center gap-2 uppercase tracking-wider">
                    Instalar e Utilizar <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'menu') {
    return (
      <div className="min-h-screen bg-[#0a0a14] text-white flex flex-col overflow-hidden">

        {/* Menu Principal */}
        <div className="relative z-40 flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#0a0a14]/80 backdrop-blur-sm">
          <Button
            onClick={() => {
              localStorage.removeItem('mro_force_dashboard');
              localStorage.removeItem('mro_force_registration');
              window.location.href = '/instagram';
            }}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-xs sm:text-sm px-3 sm:px-5 py-2 h-9 sm:h-10 rounded-full gap-2"
          >
            <Rocket className="w-4 h-4 shrink-0" />
            INÍCIO
          </Button>
        </div>

        {/* Logged-in user indicator */}
        <div className="absolute top-3 right-4 z-20 flex items-center gap-2 bg-white/5 backdrop-blur-sm rounded-full px-4 py-1.5 border border-white/10">
          <User size={14} className="text-yellow-400" />
          <span className="text-yellow-400 font-bold text-xs">{mroUsername}</span>
          <button
            onClick={async () => {
              const { logoutUser } = await import('@/lib/userStorage');
              await logoutUser();
              sessionStorage.removeItem('mro_temp_pwd');
              setIsAuthenticated(false);
              setMroUsername('');
              setMroPassword('');
              setCurrentView('menu');
            }}
            className="ml-1 p-1 rounded-full hover:bg-white/10 transition-colors"
            title="Sair"
          >
            <X size={12} className="text-red-400" />
          </button>
        </div>
        {/* Animated background elements */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-yellow-500/[0.04] rounded-full blur-[70px] md:blur-[150px] animate-pulse" />
          <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-orange-500/[0.03] rounded-full blur-[80px] md:blur-[180px] animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] bg-purple-500/[0.03] rounded-full blur-[60px] md:blur-[120px] animate-pulse" style={{ animationDelay: '4s' }} />
          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />
        </div>

        {/* Hero Section */}
        <div className="relative z-10 pt-8 pb-4 md:pt-14 md:pb-8 px-4">
          <div className="w-full text-center">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 mb-5 backdrop-blur-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-400"></span>
              </span>
              <span className="text-yellow-300 text-xs font-bold tracking-[0.2em] uppercase">Oportunidade Exclusiva</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] w-full">
              <span className="bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-400 bg-clip-text text-transparent drop-shadow-lg">
                Faturando mais de 5K mensal
              </span>
              <br />
              <span className="text-white/90 text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mt-2 block">
                prestando serviço com a MRO para empresas!
              </span>
            </h1>
            <div className="mt-5 flex items-center justify-center gap-4 sm:gap-6 flex-wrap text-white/40 text-xs font-medium">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> Acesso Imediato</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Suporte Incluído</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span> 100% Online</span>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="relative z-10 flex-1 px-4 pb-10 md:pb-16">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Steps Navigation - Top Cards: 01, 02, 03 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { 
                  id: '01', 
                  title: 'Entenda a Estratégia', 
                  subtitle: 'Assista ao vídeo e entenda como faturar 5 mil/mês.', 
                  icon: <Lightbulb className="w-10 h-10" />, 
                  color: 'from-amber-400 to-orange-600',
                  glow: 'shadow-orange-500/20',
                  action: () => {
                    localStorage.removeItem('mro_from_estrutura');
                    setShowRendaExtraVideo(true);
                  }
                },
                { 
                  id: '02', 
                  title: 'Aprenda o método', 
                  subtitle: 'Entenda tudo como aplicar e se posicionar (Vídeo Aula)', 
                  icon: <Rocket className="w-10 h-10" />, 
                  color: 'from-blue-400 to-indigo-600',
                  glow: 'shadow-blue-500/20',
                  action: () => {
                    localStorage.removeItem('mro_from_estrutura');
                    setCurrentView('tutoriais');
                  }
                },
                { 
                  id: '03', 
                  title: 'Explore a ferramenta', 
                  subtitle: 'Instale e utilize o sistema', 
                  icon: <Settings className="w-10 h-10" />, 
                  color: 'from-fuchsia-400 to-purple-600',
                  glow: 'shadow-purple-500/20',
                  action: () => {
                    localStorage.setItem('mro_from_estrutura', 'true');
                    setCurrentView('explore-options');
                  }
                }

              ].map((card) => (
                <button 
                  key={card.id} 
                  onClick={card.action} 
                  className={`group relative p-8 rounded-[2rem] bg-[#12121f] border border-white/5 transition-all duration-500 hover:-translate-y-2 hover:border-white/20 shadow-2xl ${card.glow} flex flex-col items-start text-left overflow-hidden`}
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.color} opacity-5 blur-3xl group-hover:opacity-20 transition-opacity`} />
                  
                  <div className="flex items-center justify-between w-full mb-6">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.color} p-0.5 shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                      <div className="w-full h-full bg-[#12121f] rounded-[calc(1rem-2px)] flex items-center justify-center text-white">
                        {card.icon}
                      </div>
                    </div>
                    <span className="text-4xl font-black text-white/5 italic tracking-tighter group-hover:text-white/10 transition-colors">{card.id}</span>
                  </div>

                  <h3 className="text-white font-black text-xl mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-white/50 transition-all">{card.title}</h3>
                  <p className="text-white/40 text-sm mb-8 leading-relaxed font-medium">{card.subtitle}</p>
                  
                  <div className="mt-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/5 text-white/80 font-bold text-xs group-hover:bg-white group-hover:text-black transition-all duration-500">
                    COMEÇAR AGORA <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>

            {/* Main Sections: 04 and 05 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 04 - ESTRUTURA */}
              <div className="relative group p-1 rounded-[2.5rem] bg-gradient-to-br from-emerald-500/20 via-transparent to-transparent">
                <div className="relative h-full p-8 md:p-10 rounded-[2.4rem] bg-[#0d0d16] border border-white/5 flex flex-col gap-8 overflow-hidden shadow-2xl">
                  {/* Background decoration */}
                  <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
                  
                  <div className="flex items-center justify-between relative z-10">
                     <div className="space-y-1">
                       <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black tracking-widest uppercase mb-2">Estrutura Profissional</span>
                       <h3 className="text-white font-black text-3xl tracking-tight">Crie sua Presença</h3>
                     </div>
                     <span className="text-5xl font-black text-white/5 italic">04</span>
                  </div>
                  
                  <p className="text-white/40 text-sm max-w-md relative z-10 leading-relaxed font-medium">Tudo que você precisa para criar sua marca e atrair empresas de forma automática e lucrativa.</p>
                  
                  <div className="grid grid-cols-2 gap-4 relative z-10">
                    {[
                      { label: 'Logomarca', icon: <PenTool className="w-5 h-5" /> },
                      { label: 'Post Creator', icon: <Image className="w-5 h-5" /> },
                      { label: 'Foto Pro', icon: <Instagram className="w-5 h-5" /> },
                      { label: 'Materiais', icon: <Video className="w-5 h-5" /> },
                    ].map((item, i) => (
                      <div key={i} className="group/item bg-white/[0.03] border border-white/5 p-5 rounded-2xl flex flex-col items-center gap-3 transition-all duration-300 hover:bg-white/[0.06] hover:border-emerald-500/30">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/5 flex items-center justify-center text-emerald-400 group-hover/item:scale-110 transition-transform">
                          {item.icon}
                        </div>
                        <span className="text-white/70 text-[11px] font-bold text-center uppercase tracking-widest">{item.label}</span>
                      </div>
                    ))}
                  </div>
                  
                  <button 
                    onClick={() => setCurrentView('estrutura-links')} 
                    className="group w-full relative h-16 rounded-2xl bg-emerald-500 text-black font-black text-lg flex items-center justify-center transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] overflow-hidden active:scale-95"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    <span className="relative z-10 flex items-center gap-3">
                      ACESSAR ESTRUTURA <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                    </span>
                  </button>
                </div>
              </div>

              {/* 05 - FECHAMENTO */}
              <div className="relative group p-1 rounded-[2.5rem] bg-gradient-to-br from-red-500/20 via-transparent to-transparent">
                <div className="relative h-full p-8 md:p-10 rounded-[2.4rem] bg-[#0d0d16] border border-white/5 flex flex-col gap-8 overflow-hidden shadow-2xl">
                  {/* Background decoration */}
                  <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-red-500/10 rounded-full blur-[80px] pointer-events-none" />
                  
                  <div className="flex items-center justify-between relative z-10">
                     <div className="space-y-1">
                       <span className="inline-block px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black tracking-widest uppercase mb-2">Gestão e Conversão</span>
                       <h3 className="text-white font-black text-3xl tracking-tight">Escalando Vendas</h3>
                     </div>
                     <span className="text-5xl font-black text-white/5 italic">05</span>
                  </div>
                  
                  <p className="text-white/40 text-sm max-w-md relative z-10 leading-relaxed font-medium">Gerencie clientes, envie propostas irresistíveis e acompanhe resultados em tempo real.</p>
                  
                  <div className="space-y-3 relative z-10">
                    {[
                      { label: 'Contrato Profissional', icon: <FileText className="w-5 h-5" /> },
                      { label: 'Proposta Estratégica', icon: <Sparkles className="w-5 h-5" /> },
                      { label: 'Geração de Testes', icon: <TestTube className="w-5 h-5" /> },
                      { label: 'Relatórios de Gestão', icon: <BarChart3 className="w-5 h-5" /> },
                    ].map((item, i) => (
                       <div key={i} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/5 opacity-80 hover:opacity-100 hover:bg-white/[0.06] hover:border-red-500/30 transition-all duration-300">
                         <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-lg bg-red-500/5 flex items-center justify-center text-red-400">
                             {item.icon}
                           </div>
                           <span className="text-white/70 font-bold text-xs uppercase tracking-widest">{item.label}</span>
                         </div>
                         <ArrowRight className="w-4 h-4 text-white/10" />
                       </div>
                    ))}
                  </div>
                  
                  <button 
                    onClick={() => setCurrentView('fechar-contratos-links')} 
                    className="group w-full relative h-16 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 text-white font-black text-lg flex items-center justify-center transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(239,68,68,0.3)] overflow-hidden active:scale-95 border-t border-white/20"
                  >
                    <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    <span className="relative z-10 flex items-center gap-3">
                      ACESSAR ÁREA DE VENDAS <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Premium Accounts Manager Section */}
            <div className="relative group overflow-hidden rounded-[3rem] p-0.5 bg-gradient-to-r from-emerald-500/30 via-transparent to-green-500/30">
              <div className="relative bg-[#0d0d16]/80 backdrop-blur-xl p-10 flex flex-col lg:flex-row items-center justify-between gap-8">
                <div className="flex flex-col lg:flex-row items-center gap-8 text-center lg:text-left">
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500/40 rounded-3xl blur-2xl group-hover:scale-125 transition-transform duration-500" />
                    <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-3xl flex items-center justify-center text-[#0d0d16] shadow-2xl">
                      <ShieldCheck className="w-12 h-12" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-white tracking-tight uppercase">Gerenciar Contas Premium</h3>
                    <p className="text-white/50 text-sm max-w-xl leading-relaxed font-medium">Possui mais de 8 contas ativas? Utilize nosso gerenciador avançado de perfis para centralizar sua operação.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowGerenciadorPopup(true)} 
                  className="px-10 py-5 bg-white text-black font-black rounded-2xl transition-all duration-300 hover:scale-[1.05] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] active:scale-95 flex items-center gap-3"
                >
                  ABRIR GERENCIADOR <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>


          </div>

        </div>

        {/* Renda Extra Video Popup */}
        {showRendaExtraVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowRendaExtraVideo(false)}>
            <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <Play className="h-5 w-5 text-yellow-400" />
                  Entenda sobre a Renda Extra
                </h3>
                <button onClick={() => setShowRendaExtraVideo(false)} className="text-white/60 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4">
                <YouTubePopupPlayer videoId="WQwnAHNvSMU" title="Entenda sobre a Renda Extra" />
              </div>
            </div>
          </div>
        )}

        {/* Logo Popup */}
        {showLogoPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowLogoPopup(false)}>
            <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <PenTool className="h-5 w-5 text-fuchsia-400" />
                  Crie sua Logomarca
                </h3>
                <button onClick={() => setShowLogoPopup(false)} className="text-white/60 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4">
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                  <iframe
                    src="https://www.youtube.com/embed/IizMcchcxuA"
                    title="Tutorial Logomarca"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
                <a
                  href="https://chatgpt.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Acessar ChatGPT
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Gerenciador Windows Popup */}
        {showGerenciadorPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowGerenciadorPopup(false)}>
            <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  ⚠️ Atenção
                </h3>
                <button onClick={() => setShowGerenciadorPopup(false)} className="text-white/60 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-white/80 text-sm leading-relaxed">
                  Lembre-se que você só vai usar esse gerenciador se já tem <strong className="text-orange-400">mais de 8 contas</strong> para utilizar na sua máquina. Assim você pode usar o Gerenciador de Contas para Windows para organizar o seu ambiente de trabalho.
                </p>
                <button
                  onClick={() => { setShowGerenciadorPopup(false); setCurrentView('gerenciador-windows'); }}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Prosseguir →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Register Choice Popup */}
        {showRegisterChoice && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setShowRegisterChoice(false)}>
            <div className="bg-[#0d0d16] border border-white/10 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
              <div className="p-8 md:p-10 space-y-8 text-center">
                <div className="space-y-3">
                  <h3 className="text-white font-black text-2xl md:text-3xl tracking-tight">Tipo de Cadastro</h3>
                  <p className="text-white/40 text-sm md:text-base leading-relaxed font-medium">
                    Gostaria de cadastrar na parte dos testes antes de cadastrar de forma fixa?
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => {
                      setShowRegisterChoice(false);
                      setCurrentView('testes');
                    }}
                    className="group relative h-20 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 text-emerald-400 font-black text-lg flex flex-col items-center justify-center transition-all duration-300 hover:scale-[1.02] hover:bg-emerald-500/20 active:scale-95"
                  >
                    <span className="text-xs uppercase tracking-[0.2em] font-bold opacity-60 mb-1">Passo Inicial</span>
                    SIM, CADASTRAR TESTE
                  </button>

                  <button
                    onClick={() => {
                      setShowRegisterChoice(false);
                      navigate('/instagram');
                    }}
                    className="group relative h-20 rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/30 text-blue-400 font-black text-lg flex flex-col items-center justify-center transition-all duration-300 hover:scale-[1.02] hover:bg-blue-500/20 active:scale-95"
                  >
                    <span className="text-xs uppercase tracking-[0.2em] font-bold opacity-60 mb-1">Uso Profissional</span>
                    NÃO, CADASTRO FIXO
                  </button>
                </div>

                <button 
                  onClick={() => setShowRegisterChoice(false)}
                  className="text-white/20 hover:text-white/40 text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  Cancelar e Voltar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating WhatsApp Help Button */}
        {whatsappNumber && (
          <a
            href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent('Tô na área de renda extra, preciso de ajuda')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold text-sm shadow-lg shadow-green-500/30 hover:scale-105 transition-all duration-300 animate-bounce"
            style={{ animationDuration: '2s', animationIterationCount: '3' }}
          >
            <MessageCircle className="h-5 w-5" />
            <span className="hidden sm:inline">Ajuda</span>
          </a>
        )}

      </div>
    );
  }
  if (currentView === 'gerenciador-windows') {
    const GerenciadorVideoCard = ({ title, videoId }: { title: string; videoId: string }) => {
      const [isPlaying, setIsPlaying] = useState(false);
      const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      return (
        <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-3 border-b border-white/10">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Play className="h-4 w-4 text-red-500" />
              {title}
            </h3>
          </div>
          {isPlaying ? (
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          ) : (
            <button onClick={() => setIsPlaying(true)} className="relative w-full cursor-pointer group">
              <img src={thumbUrl} alt={title} className="w-full h-auto object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="h-6 w-6 text-white fill-white ml-1" />
                </div>
              </div>
            </button>
          )}
        </div>
      );
    };

    return (
      <div className="min-h-screen bg-[#0a0a14] text-white flex flex-col">
        <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
          <button
            onClick={() => setCurrentView('menu')}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para área
          </button>

          <h1 className="text-2xl md:text-3xl font-bold text-center">
            🖥️ Gerenciador de Contas Windows
          </h1>

          <p className="text-white/60 text-sm text-center">
            Use o gerenciador para organizar mais de 10 contas no seu ambiente de trabalho.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GerenciadorVideoCard title="Instalador Windows App MRO" videoId="uqqlR_UXCoQ" />
            <GerenciadorVideoCard title="Utilizando o App Windows MRO" videoId="9R4I4_iEiSI" />
          </div>

          {/* Download Button */}
          <a
            href="https://drive.usercontent.google.com/download?id=1bWsHc53FTNY8qBixveEH-fq5ctSx4MmK&export=download&authuser=0&confirm=t&uuid=67dc7292-b18c-4eed-aba6-81c40ccfe21b&at=AN8xHopWjY-AYiFw6h3p53NX-6jf%3A1758635877417"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-green-500/20"
          >
            <Download className="h-5 w-5" />
            Baixar Gerenciador de Contas para Windows
          </a>
        </div>
      </div>
    );
  }

  if (currentView === 'materiais') {
    return <MateriaisRendaExtra onBack={() => setCurrentView('menu')} />;
  }

  if (currentView === 'contrato') {
    return <ContratoGenerator onBack={() => setCurrentView('menu')} />;
  }

  if (currentView === 'proposta-empresa') {
    return <PropostaEmpresa onBack={() => setCurrentView('menu')} />;
  }

  if (currentView === 'tutoriais') {
    return <EstruturaTutoriais onBack={() => setCurrentView('menu')} />;
  }

  if (currentView === 'estrutura-links') {
    return (
      <div className="min-h-screen bg-[#0a0a14] text-white flex flex-col p-6">
        <div className="max-w-4xl mx-auto w-full space-y-8">
          <button onClick={() => setCurrentView('menu')} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
            <ArrowLeft size={20} /> Voltar para o Dashboard
          </button>
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-widest uppercase mb-2">
              Sua Estrutura Profissional
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white">CONTEÚDO DA SUA ESTRUTURA</h1>
            <p className="text-white/60 text-sm max-w-xl mx-auto">Tudo que você precisa para criar sua presença profissional e atrair empresas de forma automática.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Crie sua Logomarca', subtitle: 'Identidade visual profissional', icon: <PenTool className="w-6 h-6" />, action: () => setShowLogoPopup(true), color: 'emerald' },
              { label: 'Post Creator', subtitle: 'Crie posts de alta conversão', icon: <Image className="w-6 h-6" />, action: () => setCurrentView('posts-creator'), color: 'emerald' },
              { label: 'Gerando sua Foto', subtitle: 'IA para fotos profissionais', icon: <Instagram className="w-6 h-6" />, action: () => {
                const guestUser = { id: 'estrutura-guest', name: 'Membro EUGência', email: 'eugencia@membro.com', copies_count: 0, copies_limit: 99999, is_paid: true, days_remaining: 99999 };
                sessionStorage.setItem('prompts_mro_user', JSON.stringify(guestUser));
                navigate('/prompts/dashboard');
              }, color: 'emerald' },
              { label: 'Materiais Disponíveis', subtitle: 'Scripts e arquivos prontos', icon: <Video className="w-6 h-6" />, action: () => setCurrentView('materiais'), color: 'emerald' },
            ].map((tool, i) => (
              <button
                key={i}
                onClick={tool.action}
                className="group relative flex items-center justify-between p-6 bg-[#12121f] border border-white/5 rounded-2xl hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all duration-300"
              >
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400 group-hover:scale-110 transition-transform duration-500">
                    {tool.icon}
                  </div>
                  <div className="text-left">
                    <span className="block font-black text-lg text-white group-hover:text-emerald-400 transition-colors">{tool.label}</span>
                    <span className="block text-xs text-white/40 group-hover:text-white/60 transition-colors">{tool.subtitle}</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-black transition-all duration-500">
                  <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'fechar-contratos-links') {
    return (
      <div className="min-h-screen bg-[#0a0a14] text-white flex flex-col p-6">
        <div className="max-w-4xl mx-auto w-full space-y-8">
          <button onClick={() => setCurrentView('menu')} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
            <ArrowLeft size={20} /> Voltar para o Dashboard
          </button>
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold tracking-widest uppercase mb-2">
              Gestão e Fechamento
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white">FECHAR CONTRATOS E RELATÓRIOS</h1>
            <p className="text-white/60 text-sm max-w-xl mx-auto">Gerencie, envie e acompanhe tudo de forma prática e profissional para escalar seu negócio.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Gere um contrato', subtitle: 'Contratos profissionais em segundos', icon: <FileText className="w-6 h-6" />, action: () => setCurrentView('contrato'), color: 'red' },
              { label: 'Envie para a empresa', subtitle: 'Propostas estratégicas de alto valor', icon: <Sparkles className="w-6 h-6" />, action: () => setCurrentView('proposta-empresa'), color: 'red' },
              { label: 'Gerar teste grátis', subtitle: 'Atraia clientes com provas reais', icon: <TestTube className="w-6 h-6" />, action: () => setCurrentView('testes'), color: 'red' },
              { label: 'Relatórios de empresas', subtitle: 'Analise métricas e resultados', icon: <BarChart3 className="w-6 h-6" />, action: () => setCurrentView('relatorios'), color: 'red' },
            ].map((tool, i) => (
              <button
                key={i}
                onClick={tool.action}
                className="group relative flex items-center justify-between p-6 bg-[#12121f] border border-white/5 rounded-2xl hover:border-red-500/50 hover:bg-red-500/5 transition-all duration-300"
              >
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-red-500/10 rounded-2xl text-red-400 group-hover:scale-110 transition-transform duration-500">
                    {tool.icon}
                  </div>
                  <div className="text-left">
                    <span className="block font-black text-lg text-white group-hover:text-red-400 transition-colors">{tool.label}</span>
                    <span className="block text-xs text-white/40 group-hover:text-white/60 transition-colors">{tool.subtitle}</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-red-500 group-hover:text-black transition-all duration-500">
                  <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setCurrentView('menu')} className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold">
              <ArrowLeft size={16} />
              <span className="ml-1">Voltar ao Início</span>
            </Button>
            <h1 className="text-lg md:text-xl font-bold">🎨 Gerador de Criativos Pro</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={selectAll}>
              {selectedIds.size === 30 ? <CheckSquare size={16} /> : <Square size={16} />}
              <span className="hidden sm:inline ml-1">{selectedIds.size === 30 ? 'Desmarcar' : 'Todos'}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditorOpen(!editorOpen)}>
              <Palette size={16} />
              <span className="hidden sm:inline ml-1">Editor</span>
              {editorOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
            <Button size="sm" onClick={downloadSelected} disabled={downloading} className="bg-primary text-primary-foreground">
              <Package size={16} />
              <span className="ml-1">{downloading ? 'Gerando...' : `Baixar ${selectedIds.size > 0 ? selectedIds.size : 'Todos'}`}</span>
            </Button>
          </div>
        </div>

        {/* Tutorial Button */}
        <div className="max-w-7xl mx-auto px-4 py-2">
          <VideoTutorialButton
            youtubeUrl="https://youtu.be/N3yHdsqGLwA"
            title="🎬 TUTORIAL - Aprenda como gerar seus posts"
            variant="pulse"
            size="lg"
            className="w-full text-xs sm:text-base md:text-lg bg-red-600 hover:bg-red-700 whitespace-normal text-center leading-tight py-3"
          />
        </div>

        {/* Editor */}
        {editorOpen && (
          <div className="border-t border-border bg-card/80 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 py-2">
              <Accordion type="multiple" defaultValue={[]} className="w-full">
                {/* Cores */}
                <AccordionItem value="cores" className="border-border/50">
                  <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
                    <div className="flex items-center gap-2"><Palette size={16} className="text-primary" /> Cores e Fundo</div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pb-2">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                        <ColorPicker label="Fundo 1" value={bgColor1} onChange={setBgColor1} />
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            Fundo 2
                            <button onClick={() => setUseGradient(!useGradient)} className="text-[10px] px-1.5 py-0.5 rounded bg-muted cursor-pointer">
                              {useGradient ? 'Degradê' : 'Sólido'}
                            </button>
                          </label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={bgColor2} onChange={e => setBgColor2(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" disabled={!useGradient} />
                            <Input value={bgColor2} onChange={e => setBgColor2(e.target.value)} className="h-8 text-xs" disabled={!useGradient} />
                          </div>
                          {useGradient && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">Ângulo:</span>
                              <input type="range" min={0} max={360} value={gradientAngle} onChange={e => setGradientAngle(Number(e.target.value))} className="flex-1 h-1.5 accent-primary" />
                              <span className="text-[10px] text-muted-foreground w-8 text-right">{gradientAngle}°</span>
                            </div>
                          )}
                        </div>
                        <ColorPicker label="Texto" value={textColor} onChange={setTextColor} />
                        <ColorPicker label="Destaque 1" value={accentColor} onChange={setAccentColor} />
                        <ColorPicker label="Destaque 2" value={highlight2Color} onChange={setHighlight2Color} />
                        <ColorPicker label="Texto CTA" value={ctaTextColor} onChange={setCtaTextColor} />
                        <ColorPicker label="Fundo CTA" value={ctaBgColor} onChange={setCtaBgColor} />
                        <ColorPicker label="Efeitos de Luz" value={effectsColor} onChange={setEffectsColor} />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Ajustes */}
                <AccordionItem value="ajustes" className="border-border/50">
                  <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
                    <div className="flex items-center gap-2"><Sliders size={16} className="text-primary" /> Ajustes e Posição</div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pb-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Sliders size={14} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground text-xs whitespace-nowrap">Opacidade CTA:</span>
                          <input type="range" min="0.05" max="1" step="0.05" value={ctaBgOpacity} onChange={e => setCtaBgOpacity(parseFloat(e.target.value))} className="flex-1 min-w-0 h-1.5 accent-primary" />
                          <span className="text-xs text-muted-foreground w-8">{Math.round(ctaBgOpacity * 100)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ZoomIn size={14} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground text-xs whitespace-nowrap">Tamanho:</span>
                          <input type="range" min="0.5" max="1.5" step="0.05" value={contentScale} onChange={e => setContentScale(parseFloat(e.target.value))} className="flex-1 min-w-0 h-1.5 accent-primary" />
                          <span className="text-xs text-muted-foreground w-8">{Math.round(contentScale * 100)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Move size={14} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground text-xs whitespace-nowrap">Posição V:</span>
                          <input type="range" min="-400" max="400" step="10" value={contentOffsetY} onChange={e => setContentOffsetY(parseInt(e.target.value))} className="flex-1 min-w-0 h-1.5 accent-primary" />
                          <span className="text-xs text-muted-foreground w-10">{contentOffsetY > 0 ? '+' : ''}{contentOffsetY}px</span>
                          {(contentScale !== 1 || contentOffsetY !== 0) && (
                            <button onClick={() => { setContentScale(1); setContentOffsetY(0); }} className="text-[10px] text-destructive hover:underline flex items-center gap-0.5 flex-shrink-0">
                              <RotateCcw size={10} /> Reset
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-sm">
                        <ToggleOption icon={<Hash size={14} />} label="Números" checked={showNumbers} onChange={setShowNumbers} />
                        <ToggleOption icon={<Sparkles size={14} />} label="Efeitos" checked={showDecorations} onChange={setShowDecorations} />
                        <ToggleOption icon={<Tag size={14} />} label="Categoria" checked={showBadge} onChange={setShowBadge} />
                        {showDecorations && (
                          <div className="flex items-center gap-2">
                            <Sliders size={14} className="text-muted-foreground" />
                            <span className="text-muted-foreground text-xs">Luz:</span>
                            <input type="range" min="0" max="1" step="0.05" value={effectsOpacity} onChange={e => setEffectsOpacity(parseFloat(e.target.value))} className="w-20 h-1.5 accent-primary" />
                            <span className="text-xs text-muted-foreground w-8">{Math.round(effectsOpacity * 100)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Pessoa */}
                <AccordionItem value="pessoa" className="border-border/50">
                  <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
                    <div className="flex items-center gap-2"><User size={16} className="text-primary" /> Pessoa</div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pb-2">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground text-xs">Pessoa:</span>
                        <select
                          value={personImage}
                          onChange={e => setPersonImage(e.target.value as PersonImage)}
                          className="h-7 text-xs rounded border border-border bg-background px-2 flex-1 min-w-0"
                        >
                          <option value="none">Nenhuma</option>
                          <option value="phone">Celular (Foto Real)</option>
                          <option value="laptop">Notebook (Foto Real)</option>
                        </select>
                      </div>
                      {personImage !== 'none' && (
                        <div className="flex items-center gap-2">
                          <Sliders size={14} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground text-xs">Opacidade:</span>
                          <input type="range" min="0.05" max="0.8" step="0.05" value={personOpacity} onChange={e => setPersonOpacity(parseFloat(e.target.value))} className="flex-1 min-w-0 h-1.5 accent-primary" />
                          <span className="text-xs text-muted-foreground w-8">{Math.round(personOpacity * 100)}%</span>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Logo */}
                <AccordionItem value="logo" className="border-b-0">
                  <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
                    <div className="flex items-center gap-2"><MapPin size={16} className="text-primary" /> Logo</div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 text-sm pb-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground text-xs">Posição:</span>
                          <select
                            value={logoPosition}
                            onChange={e => setLogoPosition(e.target.value as LogoPosition)}
                            className="h-7 text-xs rounded border border-border bg-background px-2 flex-1 min-w-0"
                          >
                            <option value="bottom-right">Inferior direito</option>
                            <option value="bottom-left">Inferior esquerdo</option>
                            <option value="top-center">Topo centro</option>
                            <option value="top-right">Topo direito</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                          {logoUrl ? (
                            <div className="flex items-center gap-2">
                              <img src={logoUrl} className="h-8 w-8 object-contain rounded" alt="logo" />
                              <button onClick={() => setLogoUrl(null)} className="text-destructive"><X size={14} /></button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
                              <Upload size={14} /> Upload Logo
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {Object.keys(logoOverrides).length > 0 && (
                          <button
                            onClick={() => { setLogoOverrides({}); toast.success('Posições personalizadas resetadas!'); }}
                            className="text-xs text-destructive hover:underline flex items-center gap-1"
                          >
                            <X size={12} /> Resetar posições ({Object.keys(logoOverrides).length})
                          </button>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Move size={12} />
                          <span>Arraste a logo no preview para posicionar</span>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {(['dor', 'promessa', 'educativo', 'beneficio', 'autoridade'] as const).map(cat => (
          <div key={cat} className="mb-8">
            <h2 className="text-lg font-bold mb-4">{CATEGORY_LABELS[cat]}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {CREATIVES.filter(c => c.category === cat).map(creative => (
                <CreativeCard
                  key={creative.id}
                  creative={creative}
                  selected={selectedIds.has(creative.id)}
                  onToggle={() => toggleSelect(creative.id)}
                  onDownload={() => downloadSingle(creative)}
                  onPreview={() => setPreviewId(creative.id)}
                  drawCreative={drawCreative}
                  hasLogoOverride={!!logoOverrides[creative.id]}
                  suspendRender={!!previewId}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal with drag */}
      {previewId && (
        <PreviewModal
          creative={CREATIVES.find(c => c.id === previewId)!}
          onClose={() => setPreviewId(null)}
          drawCreative={drawCreative}
          onDownload={() => downloadSingle(CREATIVES.find(c => c.id === previewId)!)}
          logoUrl={logoUrl}
          onLogoMove={(x, y) => {
            const existing = logoOverrides[previewId];
            setLogoOverrides(prev => ({ ...prev, [previewId]: { x, y, scale: existing?.scale ?? 1 } }));
          }}
          logoOverride={logoOverrides[previewId]}
          onResetLogo={() => {
            setLogoOverrides(prev => {
              const next = { ...prev };
              delete next[previewId];
              return next;
            });
            toast.success('Logo restaurada ao padrão');
          }}
          onLogoScaleChange={(scale) => {
            const existing = logoOverrides[previewId];
            setLogoOverrides(prev => ({ ...prev, [previewId]: { x: existing?.x ?? 0.5, y: existing?.y ?? 0.5, scale } }));
          }}
          bgImageOverride={bgImageOverrides[previewId]}
          onBgImageChange={(ovr) => {
            if (ovr) {
              setBgImageOverrides(prev => ({ ...prev, [previewId]: ovr }));
            } else {
              setBgImageOverrides(prev => {
                const next = { ...prev };
                delete next[previewId];
                return next;
              });
            }
          }}
          personImageValue={personOverrides[previewId] !== undefined ? personOverrides[previewId] : personImage}
          onPersonImageChange={(val) => {
            if (val === personImage) {
              setPersonOverrides(prev => { const n = { ...prev }; delete n[previewId]; return n; });
            } else {
              setPersonOverrides(prev => ({ ...prev, [previewId]: val }));
            }
          }}
          patternValue={patternOverrides[previewId] || patternConfig}
          onPatternChange={(cfg) => {
            setPatternOverrides(prev => ({ ...prev, [previewId]: cfg }));
          }}
          onPatternReset={() => {
            setPatternOverrides(prev => { const n = { ...prev }; delete n[previewId]; return n; });
          }}
          personPositionConfig={personPositionOverrides[previewId] || { scale: 1, offsetX: 0, offsetY: 0 }}
          onPersonPositionChange={(cfg) => {
            setPersonPositionOverrides(prev => ({ ...prev, [previewId]: cfg }));
          }}
          onPersonPositionReset={() => {
            setPersonPositionOverrides(prev => { const n = { ...prev }; delete n[previewId]; return n; });
          }}
          bgColor1={bgColor1} onBgColor1Change={setBgColor1}
          bgColor2={bgColor2} onBgColor2Change={setBgColor2}
          useGradient={useGradient} onUseGradientChange={setUseGradient}
          textColor={textColor} onTextColorChange={setTextColor}
          accentColor={accentColor} onAccentColorChange={setAccentColor}
          highlight2Color={highlight2Color} onHighlight2ColorChange={setHighlight2Color}
          effectsColor={effectsColor} onEffectsColorChange={setEffectsColor}
          effectsOpacity={effectsOpacity} onEffectsOpacityChange={setEffectsOpacity}
          ctaTextColor={ctaTextColor} onCtaTextColorChange={setCtaTextColor}
          ctaBgColor={ctaBgColor} onCtaBgColorChange={setCtaBgColor}
          ctaBgOpacity={ctaBgOpacity} onCtaBgOpacityChange={setCtaBgOpacity}
          onLogoUpload={(url) => setLogoUrl(url)}
          contentScaleValue={contentScaleOverrides[previewId] ?? contentScale}
          onContentScaleChange={(v) => setContentScaleOverrides(prev => ({ ...prev, [previewId]: v }))}
          contentOffsetYValue={contentOffsetYOverrides[previewId] ?? contentOffsetY}
          onContentOffsetYChange={(v) => setContentOffsetYOverrides(prev => ({ ...prev, [previewId]: v }))}
          onContentPositionReset={() => {
            setContentScaleOverrides(prev => { const n = { ...prev }; delete n[previewId]; return n; });
            setContentOffsetYOverrides(prev => { const n = { ...prev }; delete n[previewId]; return n; });
          }}
        />
      )}
    </div>
  );
};

// ─── Sub-components ───

const ColorPicker: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div>
    <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
      <Input value={value} onChange={e => onChange(e.target.value)} className="h-8 text-xs" />
    </div>
  </div>
);

const ToggleOption: React.FC<{ icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ icon, label, checked, onChange }) => (
  <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded" />
    {icon}
    <span className="text-xs">{label}</span>
  </label>
);

interface CreativeCardProps {
  creative: CreativeData;
  selected: boolean;
  onToggle: () => void;
  onDownload: () => void;
  onPreview: () => void;
  drawCreative: (c: CreativeData, canvas: HTMLCanvasElement) => Promise<void>;
  hasLogoOverride: boolean;
  suspendRender: boolean;
}

const CreativeCard: React.FC<CreativeCardProps> = ({ creative, selected, onToggle, onDownload, onPreview, drawCreative, hasLogoOverride, suspendRender }) => {
  const [thumbUrl, setThumbUrl] = useState<string>('');

  React.useEffect(() => {
    if (suspendRender) return;

    let mounted = true;
    const offscreen = document.createElement('canvas');

    drawCreative(creative, offscreen)
      .then(() => {
        if (mounted) {
          setThumbUrl(offscreen.toDataURL('image/png'));
        }
      })
      .catch(() => {
        if (mounted) {
          setThumbUrl('');
        }
      });

    return () => {
      mounted = false;
    };
  }, [creative, drawCreative, suspendRender]);

  return (
    <div className={`relative group rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${selected ? 'border-primary shadow-lg shadow-primary/20' : 'border-border hover:border-muted-foreground/30'}`}>
      <div className="aspect-[1080/1350] relative" onClick={onPreview}>
        {thumbUrl ? (
          <img src={thumbUrl} alt={`Preview criativo ${creative.id}`} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-muted/30 animate-pulse" />
        )}
        {hasLogoOverride && (
          <div className="absolute top-1 left-6 text-[8px]" title="Logo personalizada">
            <Move size={10} className="text-primary" />
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-card/90 backdrop-blur-sm flex items-center justify-between p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="p-1 rounded hover:bg-muted">
          {selected ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} className="text-muted-foreground" />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onPreview(); }} className="p-1 rounded hover:bg-muted">
          <Eye size={14} className="text-muted-foreground" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDownload(); }} className="p-1 rounded hover:bg-muted">
          <Download size={14} className="text-muted-foreground" />
        </button>
      </div>
      {selected && (
        <div className="absolute top-1 left-1">
          <CheckSquare size={16} className="text-primary drop-shadow" />
        </div>
      )}
    </div>
  );
};

const AccordionSection: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-muted/50 transition-colors"
      >
        <span>{title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
};

const PreviewModal: React.FC<{
  creative: CreativeData;
  onClose: () => void;
  drawCreative: (c: CreativeData, canvas: HTMLCanvasElement) => Promise<void>;
  onDownload: () => void;
  logoUrl: string | null;
  onLogoMove: (x: number, y: number) => void;
  logoOverride?: LogoOverride;
  onResetLogo: () => void;
  onLogoScaleChange: (scale: number) => void;
  bgImageOverride?: BgImageOverride;
  onBgImageChange: (ovr: BgImageOverride | null) => void;
  personImageValue: PersonImage;
  onPersonImageChange: (val: PersonImage) => void;
  personPositionConfig: PersonPositionConfig;
  onPersonPositionChange: (cfg: PersonPositionConfig) => void;
  onPersonPositionReset: () => void;
  patternValue: PatternConfig;
  onPatternChange: (cfg: PatternConfig) => void;
  onPatternReset: () => void;
  bgColor1: string; onBgColor1Change: (v: string) => void;
  bgColor2: string; onBgColor2Change: (v: string) => void;
  useGradient: boolean; onUseGradientChange: (v: boolean) => void;
  textColor: string; onTextColorChange: (v: string) => void;
  accentColor: string; onAccentColorChange: (v: string) => void;
  highlight2Color: string; onHighlight2ColorChange: (v: string) => void;
  effectsColor: string; onEffectsColorChange: (v: string) => void;
  effectsOpacity: number; onEffectsOpacityChange: (v: number) => void;
  ctaTextColor: string; onCtaTextColorChange: (v: string) => void;
  ctaBgColor: string; onCtaBgColorChange: (v: string) => void;
  ctaBgOpacity: number; onCtaBgOpacityChange: (v: number) => void;
  onLogoUpload: (url: string) => void;
  contentScaleValue: number; onContentScaleChange: (v: number) => void;
  contentOffsetYValue: number; onContentOffsetYChange: (v: number) => void;
  onContentPositionReset: () => void;
}> = ({ creative, onClose, drawCreative, onDownload, logoUrl, onLogoMove, logoOverride, onResetLogo, onLogoScaleChange, bgImageOverride, onBgImageChange, personImageValue, onPersonImageChange, personPositionConfig, onPersonPositionChange, onPersonPositionReset, patternValue, onPatternChange, onPatternReset, bgColor1, onBgColor1Change, bgColor2, onBgColor2Change, useGradient, onUseGradientChange, textColor, onTextColorChange, accentColor, onAccentColorChange, highlight2Color, onHighlight2ColorChange, effectsColor, onEffectsColorChange, effectsOpacity, onEffectsOpacityChange, ctaTextColor, onCtaTextColorChange, ctaBgColor, onCtaBgColorChange, ctaBgOpacity, onCtaBgOpacityChange, onLogoUpload, contentScaleValue, onContentScaleChange, contentOffsetYValue, onContentOffsetYChange, onContentPositionReset }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);
  const rafRef = useRef<number>(0);
  const pendingPointRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const [showBgControls, setShowBgControls] = useState(!!bgImageOverride);

  React.useEffect(() => {
    if (canvasRef.current) {
      drawCreative(creative, canvasRef.current);
    }
  }, [creative, drawCreative]);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      onBgImageChange({ url, x: 0, y: 0, opacity: 0.3, scale: 1 });
      setShowBgControls(true);
      toast.success('Imagem de fundo adicionada!');
    };
    reader.readAsDataURL(file);
  };

  const updateBg = (partial: Partial<BgImageOverride>) => {
    if (!bgImageOverride) return;
    onBgImageChange({ ...bgImageOverride, ...partial });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!logoUrl || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 1080 / rect.width;
    const scaleY = 1350 / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    onLogoMove(clickX / 1080, clickY / 1350);
  };

  const computeLogoPosFromClient = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (clientX - rect.left) * (1080 / rect.width);
    const my = (clientY - rect.top) * (1350 / rect.height);
    onLogoMove(mx / 1080, my / 1350);
  };

  const flushDragMove = () => {
    const point = pendingPointRef.current;
    if (point) {
      computeLogoPosFromClient(point.clientX, point.clientY);
      pendingPointRef.current = null;
    }
    rafRef.current = 0;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!logoUrl) return;
    isDraggingRef.current = true;
    canvasRef.current?.setPointerCapture(e.pointerId);
    computeLogoPosFromClient(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || !logoUrl) return;
    pendingPointRef.current = { clientX: e.clientX, clientY: e.clientY };
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(flushDragMove);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    flushDragMove();
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative flex gap-4 max-w-4xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()} ref={containerRef}>
        {/* Canvas */}
        <div className="relative flex-shrink-0" style={{ maxWidth: '400px' }}>
          <canvas
            ref={canvasRef}
            className={`w-full rounded-xl shadow-2xl ${logoUrl ? 'cursor-crosshair' : ''} touch-none`}
            onClick={handleCanvasClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          <div className="absolute top-3 right-3 flex gap-2">
            <Button size="sm" onClick={onDownload} className="bg-primary text-primary-foreground">
              <Download size={14} /> Baixar
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Side editor panel */}
        <div className="bg-card/95 backdrop-blur-md rounded-xl border border-border p-4 w-72 overflow-y-auto space-y-2 flex-shrink-0 hidden md:block max-h-[85vh]">
          <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
            <Palette size={16} /> Editor do Criativo #{creative.id}
          </h3>

          {/* Content Position - per creative */}
          <AccordionSection title="📐 Posição do Conteúdo" defaultOpen>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <ZoomIn size={10} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground w-14">Tamanho</span>
                <input type="range" min="0.5" max="1.5" step="0.05" value={contentScaleValue} onChange={e => onContentScaleChange(parseFloat(e.target.value))} className="flex-1 h-1 accent-primary" />
                <span className="text-[10px] w-7 text-right">{Math.round(contentScaleValue * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Move size={10} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground w-14">Vertical</span>
                <input type="range" min="-400" max="400" step="10" value={contentOffsetYValue} onChange={e => onContentOffsetYChange(parseInt(e.target.value))} className="flex-1 h-1 accent-primary" />
                <span className="text-[10px] w-10 text-right">{contentOffsetYValue > 0 ? '+' : ''}{contentOffsetYValue}px</span>
              </div>
              {(contentScaleValue !== 1 || contentOffsetYValue !== 0) && (
                <Button size="sm" variant="outline" className="w-full h-6 text-[10px]" onClick={onContentPositionReset}>
                  <RotateCcw size={10} /> Resetar posição
                </Button>
              )}
            </div>
          </AccordionSection>

          {/* Imagem de Fundo */}
          <AccordionSection title="🖼️ Imagem de Fundo">
            <div className="space-y-3">
              <div className="flex justify-end">
                <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => bgInputRef.current?.click()}>
                  <Upload size={10} /> Upload
                </Button>
              </div>
              {bgImageOverride && (
                <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Imagem ativa</span>
                    <button onClick={() => { onBgImageChange(null); setShowBgControls(false); }} className="text-destructive"><X size={12} /></button>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Sliders size={10} className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground w-14">Opacidade</span>
                      <input type="range" min="0.05" max="1" step="0.05" value={bgImageOverride.opacity} onChange={e => updateBg({ opacity: parseFloat(e.target.value) })} className="flex-1 h-1 accent-primary" />
                      <span className="text-[10px] w-7 text-right">{Math.round(bgImageOverride.opacity * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ZoomIn size={10} className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground w-14">Escala</span>
                      <input type="range" min="0.2" max="4" step="0.1" value={bgImageOverride.scale} onChange={e => updateBg({ scale: parseFloat(e.target.value) })} className="flex-1 h-1 accent-primary" />
                      <span className="text-[10px] w-7 text-right">{bgImageOverride.scale.toFixed(1)}x</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Move size={10} className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground w-14">Pos. X</span>
                      <input type="range" min={Math.round(-1080 * bgImageOverride.scale)} max={Math.round(1080 * bgImageOverride.scale)} step="10" value={bgImageOverride.x} onChange={e => updateBg({ x: parseInt(e.target.value) })} className="flex-1 h-1 accent-primary" />
                      <span className="text-[10px] w-7 text-right">{bgImageOverride.x}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Move size={10} className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground w-14">Pos. Y</span>
                      <input type="range" min={Math.round(-1350 * bgImageOverride.scale)} max={Math.round(1350 * bgImageOverride.scale)} step="10" value={bgImageOverride.y} onChange={e => updateBg({ y: parseInt(e.target.value) })} className="flex-1 h-1 accent-primary" />
                      <span className="text-[10px] w-7 text-right">{bgImageOverride.y}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full h-6 text-[10px]" onClick={() => updateBg({ x: 0, y: 0, scale: 1 })}>
                    <RotateCcw size={10} /> Centralizar
                  </Button>
                </div>
              )}
            </div>
          </AccordionSection>

          {/* Pessoa no Fundo */}
          <AccordionSection title="👤 Pessoa no Fundo">
            <div className="space-y-2">
              <select
                value={personImageValue}
                onChange={e => onPersonImageChange(e.target.value as PersonImage)}
                className="w-full h-7 text-xs rounded border border-border bg-background px-2"
              >
                <option value="none">Sem pessoa</option>
                <option value="phone">Celular (Foto Real)</option>
                <option value="laptop">Notebook (Foto Real)</option>
              </select>
              {personImageValue !== 'none' && (
                <div className="space-y-1.5 bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <ZoomIn size={10} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground w-14">Tamanho</span>
                    <input type="range" min="0.3" max="2.5" step="0.05" value={personPositionConfig.scale} onChange={e => onPersonPositionChange({ ...personPositionConfig, scale: parseFloat(e.target.value) })} className="flex-1 h-1 accent-primary" />
                    <span className="text-[10px] w-7 text-right">{Math.round(personPositionConfig.scale * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Move size={10} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground w-14">Pos. X</span>
                    <input type="range" min="-500" max="500" step="10" value={personPositionConfig.offsetX} onChange={e => onPersonPositionChange({ ...personPositionConfig, offsetX: parseInt(e.target.value) })} className="flex-1 h-1 accent-primary" />
                    <span className="text-[10px] w-7 text-right">{personPositionConfig.offsetX}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Move size={10} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground w-14">Pos. Y</span>
                    <input type="range" min="-500" max="500" step="10" value={personPositionConfig.offsetY} onChange={e => onPersonPositionChange({ ...personPositionConfig, offsetY: parseInt(e.target.value) })} className="flex-1 h-1 accent-primary" />
                    <span className="text-[10px] w-7 text-right">{personPositionConfig.offsetY}</span>
                  </div>
                  <Button size="sm" variant="outline" className="w-full h-6 text-[10px]" onClick={onPersonPositionReset}>
                    <RotateCcw size={10} /> Resetar posição
                  </Button>
                </div>
              )}
            </div>
          </AccordionSection>

          {/* Padrão de Fundo */}
          <AccordionSection title="✨ Padrão de Fundo">
            <div className="space-y-2">
              <select
                value={patternValue.type}
                onChange={e => onPatternChange({ ...patternValue, type: e.target.value as PatternType })}
                className="w-full h-7 text-xs rounded border border-border bg-background px-2"
              >
                <option value="auto">Automático (por categoria)</option>
                <option value="diamond">Diamante / Grade</option>
                <option value="hex">Hexagonal</option>
                <option value="circuit">Circuitos</option>
                <option value="dots">Pontos</option>
                <option value="rings">Anéis</option>
                <option value="none">Sem padrão</option>
              </select>
              {patternValue.type !== 'none' && (
                <div className="flex items-center gap-2">
                  <Sliders size={10} className="text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground w-14">Opacidade</span>
                  <input type="range" min="0.1" max="3" step="0.1" value={patternValue.opacity} onChange={e => onPatternChange({ ...patternValue, opacity: parseFloat(e.target.value) })} className="flex-1 h-1 accent-primary" />
                  <span className="text-[10px] w-7 text-right">{Math.round(patternValue.opacity * 100)}%</span>
                </div>
              )}
              <Button size="sm" variant="outline" className="w-full h-6 text-[10px]" onClick={onPatternReset}>
                <RotateCcw size={10} /> Padrão original
              </Button>
            </div>
          </AccordionSection>

          {/* Logo */}
          <AccordionSection title="◎ Logo">
            {logoUrl ? (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">Clique no criativo para posicionar a logo</p>
                <div className="flex items-center gap-2">
                  <ZoomIn size={10} className="text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground w-14">Tamanho</span>
                  <input type="range" min="0.3" max="4" step="0.1" value={logoOverride?.scale ?? 1} onChange={e => onLogoScaleChange(parseFloat(e.target.value))} className="flex-1 h-1 accent-primary" />
                  <span className="text-[10px] w-7 text-right">{Math.round((logoOverride?.scale ?? 1) * 100)}%</span>
                </div>
                {logoOverride && (
                  <Button size="sm" variant="outline" className="w-full h-6 text-[10px]" onClick={onResetLogo}>
                    <RotateCcw size={10} /> Resetar posição e tamanho
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Nenhuma logo carregada</span>
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    onLogoUpload(ev.target?.result as string);
                    toast.success('Logo adicionada!');
                  };
                  reader.readAsDataURL(file);
                }} className="w-full text-[10px]" />
              </div>
            )}
          </AccordionSection>

          {/* Cores & Efeitos */}
          <AccordionSection title="🎨 Cores & Efeitos">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Fundo 1</label>
                  <div className="flex items-center gap-1">
                    <input type="color" value={bgColor1} onChange={e => onBgColor1Change(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
                    <span className="text-[9px] text-muted-foreground">{bgColor1}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">
                    Fundo 2
                    <button onClick={() => onUseGradientChange(!useGradient)} className="ml-1 text-[9px] px-1 rounded bg-muted cursor-pointer">
                      {useGradient ? 'Degradê' : 'Sólido'}
                    </button>
                  </label>
                  <div className="flex items-center gap-1">
                    <input type="color" value={bgColor2} onChange={e => onBgColor2Change(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" disabled={!useGradient} />
                    <span className="text-[9px] text-muted-foreground">{bgColor2}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Texto</label>
                  <div className="flex items-center gap-1">
                    <input type="color" value={textColor} onChange={e => onTextColorChange(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
                    <span className="text-[9px] text-muted-foreground">{textColor}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Destaque 1</label>
                  <div className="flex items-center gap-1">
                    <input type="color" value={accentColor} onChange={e => onAccentColorChange(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
                    <span className="text-[9px] text-muted-foreground">{accentColor}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Destaque 2</label>
                  <div className="flex items-center gap-1">
                    <input type="color" value={highlight2Color} onChange={e => onHighlight2ColorChange(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
                    <span className="text-[9px] text-muted-foreground">{highlight2Color}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-medium">CTA (Botão)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Texto CTA</label>
                    <input type="color" value={ctaTextColor} onChange={e => onCtaTextColorChange(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Fundo CTA</label>
                    <input type="color" value={ctaBgColor} onChange={e => onCtaBgColorChange(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Sliders size={10} className="text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground w-16">Opac. CTA</span>
                  <input type="range" min="0.05" max="1" step="0.05" value={ctaBgOpacity} onChange={e => onCtaBgOpacityChange(parseFloat(e.target.value))} className="flex-1 h-1 accent-primary" />
                  <span className="text-[10px] w-7 text-right">{Math.round(ctaBgOpacity * 100)}%</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-medium">Efeito de Luz</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-10">Cor</span>
                  <input type="color" value={effectsColor} onChange={e => onEffectsColorChange(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
                  <span className="text-[9px] text-muted-foreground">{effectsColor}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sliders size={10} className="text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground w-10">Luz</span>
                  <input type="range" min="0" max="0.5" step="0.01" value={effectsOpacity} onChange={e => onEffectsOpacityChange(parseFloat(e.target.value))} className="flex-1 h-1 accent-primary" />
                  <span className="text-[10px] w-7 text-right">{Math.round(effectsOpacity * 100)}%</span>
                </div>
              </div>
            </div>
          </AccordionSection>
        </div>

        {/* Mobile bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 md:hidden">
          {bgImageOverride ? (
            <div className="bg-card/95 backdrop-blur-md rounded-t-xl border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Imagem de Fundo</span>
                <button onClick={() => { onBgImageChange(null); }} className="text-destructive"><X size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Opac:</span>
                  <input type="range" min="0.05" max="1" step="0.05" value={bgImageOverride.opacity} onChange={e => updateBg({ opacity: parseFloat(e.target.value) })} className="flex-1 h-1 accent-primary" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Zoom:</span>
                  <input type="range" min="0.2" max="4" step="0.1" value={bgImageOverride.scale} onChange={e => updateBg({ scale: parseFloat(e.target.value) })} className="flex-1 h-1 accent-primary" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">X:</span>
                  <input type="range" min={Math.round(-1080 * bgImageOverride.scale)} max={Math.round(1080 * bgImageOverride.scale)} step="10" value={bgImageOverride.x} onChange={e => updateBg({ x: parseInt(e.target.value) })} className="flex-1 h-1 accent-primary" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Y:</span>
                  <input type="range" min={Math.round(-1350 * bgImageOverride.scale)} max={Math.round(1350 * bgImageOverride.scale)} step="10" value={bgImageOverride.y} onChange={e => updateBg({ y: parseInt(e.target.value) })} className="flex-1 h-1 accent-primary" />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card/90 rounded-lg mx-3 mb-3 px-3 py-2 text-xs text-muted-foreground text-center backdrop-blur-sm flex items-center justify-center gap-2">
              <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => bgInputRef.current?.click()}>
                <ImagePlus size={10} /> Imagem de fundo
              </Button>
              {logoUrl && <span><Move size={12} className="inline mr-1" />Clique para posicionar logo</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EstruturaRendaExtra;
