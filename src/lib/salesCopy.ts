/**
 * Textos da página de vendas da MRO em português e espanhol.
 * O padrão é sempre "pt": nenhuma página muda de idioma sem receber lang="es".
 */
export type SalesLang = "pt" | "es";

export const introCopy = {
  pt: {
    eyebrow: "Prospecção · Atendimento · Estratégia",
    title1: "NÃO GASTE MAIS COM ANÚNCIOS",
    title2: "UTILIZE A MRO INTELIGENTE!",
    sub: "Transforme seu Instagram em uma oportunidade de vender mais.",
  },
  es: {
    eyebrow: "Prospección · Atención · Estrategia",
    title1: "NO GASTES MÁS EN ANUNCIOS",
    title2: "¡UTILIZA MRO INTELIGENTE!",
    sub: "Convierte tu Instagram en una oportunidad para vender más.",
  },
} as const;

export const featuresCopy = {
  pt: {
    eyebrow: "O que você vai receber",
    title1: "Tudo para crescer",
    title2: "no Instagram",
    sub: "Oito funções para conectar sua empresa ao público certo e cuidar das oportunidades do primeiro contato à venda.",
    note: "Você controla as configurações e as abordagens. Respeite os limites do Instagram e as preferências dos contatos; automação não elimina o risco de restrições nem garante vendas.",
    col1Title: "Mais oportunidades",
    col1Heading: "Uma virada de chave para seu negócio online.",
    col1Text: "Menos tarefas repetitivas, mais tempo para atender clientes e desenvolver suas vendas.",
    col2Heading: "Aprenda a colocar em prática",
    col2Text: "Vídeos estratégicos e passo a passo para configurar a ferramenta, melhorar seu perfil e trabalhar sua prospecção.",
    col3Heading: "Suporte e grupo VIP",
    col3Text: "Tire dúvidas, compartilhe experiências e acompanhe as novidades com o suporte da MRO e o grupo no WhatsApp.",
    items: [
      {
        title: "Rastreia públicos de concorrentes e páginas",
        description: "Indique páginas, concorrentes ou perfis do seu nicho. A MRO reúne seguidores, curtidores e pessoas que comentam em listas organizadas, para uma prospecção mais direcionada.",
        detail: "Encontre pessoas alinhadas ao que sua empresa oferece.",
      },
      {
        title: "Envia mensagens em massa",
        description: "Entre em contato com públicos de páginas e concorrentes, seus seguidores, pessoas que já conversaram com você, curtidores e comentaristas. Use também públicos rastreados ou uma lista personalizada de @nomes.",
        detail: "Diferentes fontes de público, uma abordagem definida por você.",
      },
      {
        title: "Atendente com Agente I.A",
        description: "Configure seu próprio prompt. Integrado ao ChatGPT, o agente responde mensagens, esclarece dúvidas e conduz conversas e abordagens comerciais conforme suas instruções.",
        detail: "Automatize o atendimento e acompanhe as conversas.",
      },
      {
        title: "CRM Kanban",
        description: "Organize as conversas do Instagram pelo estágio de cada lead. Separe quem está no primeiro contato, quem precisa de acompanhamento e os interessados mais quentes.",
        detail: "Saiba qual oportunidade merece o próximo contato.",
      },
      {
        title: "Publica Stories diários",
        description: "Programe seus Stories para publicação automática todos os dias, nos horários que você definir e com conteúdos distribuídos ao longo do dia. As publicações acontecem conforme sua configuração.",
        detail: "Mantenha seu perfil presente com conteúdo autorizado por você.",
      },
      {
        title: "Boas-vindas para novos seguidores",
        description: "Receba novos seguidores com uma mensagem automática. Personalize a abordagem para apresentar sua empresa, produto ou serviço e começar uma conversa com potencial comercial.",
        detail: "Transforme um novo seguidor no início de um relacionamento.",
      },
      {
        title: "Segue, curte e deixa de seguir",
        description: "Interaja com públicos de concorrentes, páginas e perfis estratégicos por meio de ações de seguir, curtir e deixar de seguir. Trabalhe conexões com pessoas do seu nicho.",
        detail: "Crie oportunidades de visitas e novos contatos.",
      },
      {
        title: "Inteligência I.A para estratégias",
        description: "A inteligência MRO analisa seu perfil e seu nicho para sugerir conteúdo, posts, Stories e estratégias de crescimento. Crie scripts de vendas e abordagem, ideias de prospecção e melhorias no posicionamento.",
        detail: "Uma estratégia personalizada para prospectar e vender melhor.",
      },
    ],
  },
  es: {
    eyebrow: "Lo que vas a recibir",
    title1: "Todo para crecer",
    title2: "en Instagram",
    sub: "Ocho funciones para conectar tu empresa con el público adecuado y cuidar las oportunidades desde el primer contacto hasta la venta.",
    note: "Tú controlas las configuraciones y los acercamientos. Respeta los límites de Instagram y las preferencias de los contactos; la automatización no elimina el riesgo de restricciones ni garantiza ventas.",
    col1Title: "Más oportunidades",
    col1Heading: "Un cambio de marcha para tu negocio online.",
    col1Text: "Menos tareas repetitivas, más tiempo para atender clientes y desarrollar tus ventas.",
    col2Heading: "Aprende a ponerlo en práctica",
    col2Text: "Videos estratégicos y paso a paso para configurar la herramienta, mejorar tu perfil y trabajar tu prospección.",
    col3Heading: "Soporte y grupo VIP",
    col3Text: "Resuelve dudas, comparte experiencias y sigue las novedades con el soporte de MRO y el grupo de WhatsApp.",
    items: [
      {
        title: "Rastrea públicos de competidores y páginas",
        description: "Indica páginas, competidores o perfiles de tu nicho. MRO reúne seguidores, personas que dan me gusta y personas que comentan en listas organizadas, para una prospección más dirigida.",
        detail: "Encuentra personas alineadas con lo que tu empresa ofrece.",
      },
      {
        title: "Envía mensajes masivos",
        description: "Comunícate con públicos de páginas y competidores, tus seguidores, personas que ya hablaron contigo, personas que dan me gusta y comentaristas. Usa también públicos rastreados o una lista personalizada de @nombres.",
        detail: "Diferentes fuentes de público, un enfoque definido por ti.",
      },
      {
        title: "Atención con Agente I.A",
        description: "Configura tu propio prompt. Integrado con ChatGPT, el agente responde mensajes, resuelve dudas y guía conversaciones y acercamientos comerciales según tus instrucciones.",
        detail: "Automatiza la atención y sigue las conversaciones.",
      },
      {
        title: "CRM Kanban",
        description: "Organiza las conversaciones de Instagram por la etapa de cada lead. Separa quién está en el primer contacto, quién necesita seguimiento y los interesados más calientes.",
        detail: "Sabrás qué oportunidad merece el próximo contacto.",
      },
      {
        title: "Publica Stories diarios",
        description: "Programa tus Stories para publicación automática todos los días, en los horarios que definas y con contenidos distribuidos a lo largo del día. Las publicaciones se realizan según tu configuración.",
        detail: "Mantén tu perfil presente con contenido autorizado por ti.",
      },
      {
        title: "Bienvenida para nuevos seguidores",
        description: "Recibe a nuevos seguidores con un mensaje automático. Personaliza el acercamiento para presentar tu empresa, producto o servicio y comenzar una conversación con potencial comercial.",
        detail: "Convierte a un nuevo seguidor en el inicio de una relación.",
      },
      {
        title: "Sigue, da me gusta y deja de seguir",
        description: "Interactúa con públicos de competidores, páginas y perfiles estratégicos mediante acciones de seguir, dar me gusta y dejar de seguir. Trabaja conexiones con personas de tu nicho.",
        detail: "Crea oportunidades de visitas y nuevos contactos.",
      },
      {
        title: "Inteligencia I.A para estrategias",
        description: "La inteligencia MRO analiza tu perfil y tu nicho para sugerir contenido, publicaciones, Stories y estrategias de crecimiento. Crea guiones de ventas y acercamiento, ideas de prospección y mejoras en el posicionamiento.",
        detail: "Una estrategia personalizada para prospectar y vender mejor.",
      },
    ],
  },
} as const;

/**
 * Geração e agendamento de conteúdos: entra junto das demais funções da página.
 * Em espanhol a lista fica vazia, então a página Euro não exibe nada novo.
 */
export type SalesFeatureItem = { title: string; description: string; detail: string };

export const contentGenerationCopy: Record<SalesLang, readonly SalesFeatureItem[]> = {
  pt: [
    {
      title: "Gera o conteúdo do mês inteiro",
      description: "Monte a estratégia de conteúdo do mês a partir do seu nicho e dos seus objetivos. A MRO organiza os temas e as publicações do seu calendário de uma vez só.",
      detail: "Todo o conteúdo do seu mês gerado automaticamente.",
    },
    {
      title: "Cria carrosséis profissionais",
      description: "Gere carrosséis prontos para publicar, com sequência de slides, textos e artes alinhados ao seu posicionamento.",
      detail: "Carrosséis completos em poucos cliques.",
    },
    {
      title: "Cria posts e criativos",
      description: "Crie posts individuais e criativos para as suas redes sociais a partir de um tema escolhido por você, com variações prontas para usar.",
      detail: "Posts e criativos prontos para as suas redes.",
    },
    {
      title: "Com a sua foto ou sem ela",
      description: "Use a sua própria foto nas artes ou gere conteúdos sem utilizar a sua imagem. Você decide como quer aparecer.",
      detail: "Artes com ou sem a sua imagem.",
    },
    {
      title: "Conteúdo personalizado para o seu perfil",
      description: "A MRO considera o seu perfil, o seu nicho e o seu público para criar conteúdos estratégicos e personalizados.",
      detail: "Conteúdo pensado para o seu perfil.",
    },
    {
      title: "Agenda e programa as publicações",
      description: "Programe as suas publicações para saírem automaticamente nos horários que você definir, ao longo dos dias do mês.",
      detail: "Publicações programadas sem ação manual.",
    },
  ],
  es: [],
};

/**
 * Seção "Criação de conteúdo automática com I.A", exclusiva da página em
 * português. Em espanhol é `null`, então a página Euro não exibe a seção.
 */
export type ContentAutomationCopy = {
  eyebrow: string;
  title1: string;
  title2: string;
  description: string;
  steps: readonly { title: string; description: string }[];
  videoTitle: string;
  videoCta: string;
  videoFallback: string;
  videoFallbackPlaying: string;
  galleryTitle: string;
  galleryDescription: string;
  galleryCta: string;
};

export const contentAutomationCopy: Record<SalesLang, ContentAutomationCopy | null> = {
  pt: {
    eyebrow: "Criação de conteúdo automática",
    title1: "Criação de conteúdo",
    title2: "automática com I.A",
    description:
      "Post único, carrossel automático, cria a estratégia, cria a imagem, vê os melhores horários e posta para você.",
    steps: [
      {
        title: "Cria a estratégia",
        description: "A MRO monta o seu plano de conteúdo com temas, formatos e a sequência certa para o seu perfil.",
      },
      {
        title: "Cria a imagem",
        description: "As artes e os carrosséis são gerados prontos para publicar, com ou sem a sua foto.",
      },
      {
        title: "Vê os melhores horários",
        description: "A ferramenta identifica os horários de maior alcance e programa cada publicação.",
      },
      {
        title: "Posta para você",
        description: "As publicações saem sozinhas nos horários definidos. Você só acompanha os resultados.",
      },
    ],
    videoTitle: "Criando conteúdo automático no Instagram com a MRO",
    videoCta: "Assistir o vídeo",
    videoFallback: "Prefiro assistir no YouTube",
    videoFallbackPlaying: "Não abriu? Assistir direto no YouTube",
    galleryTitle: "Veja alguns modelos produzidos pela MRO!",
    galleryDescription:
      "Criou a estratégia, criou o conteúdo/criativo e criou a legenda, e ainda publicou em um horário estratégico para você.",
    galleryCta: "Ver galeria completa",
  },
  es: null,
};

export const pageCopy = {
  pt: {
    heroCta: "GARANTIR MEU ACESSO AGORA",
    heroCtaPromo: "GARANTIR MEU DESCONTO AGORA",
    guaranteeEyebrow: "GARANTIA TOTAL",
    guaranteeTitle1: "30 Dias de Resultados",
    guaranteeTitle2: "Garantidos",
    guaranteeA: "Se em ",
    guaranteeStrong1: "30 dias",
    guaranteeB: " não tiver os resultados prometidos, ",
    guaranteeStrong2: "devolvemos o seu dinheiro.",
    guaranteeAssurance: "Nós garantimos resultados. Sem risco para você.",
    guaranteeBadges: ["Compra 100% Segura", "Reembolso Garantido", "Satisfação ou Dinheiro de Volta"],
    guaranteeFine: "Garantia válida por 30 dias após a data da compra.",
    finalTitle1: "Não perca essa",
    finalTitle2: "oportunidade única!",
    finalCta: "VER OS PLANOS",
    waMessage: "Vim pela página da ferramenta MRO, gostaria de tirar uma dúvida.",
    waAria: "Falar no WhatsApp com a MRO",
    waHover: "Tirar uma dúvida",
    footer: "© 2025 MRO - Mais Resultados Online. Todos os direitos reservados.",
  },
  es: {
    heroCta: "GARANTIZAR MI ACCESO AHORA",
    heroCtaPromo: "GARANTIZAR MI DESCUENTO AHORA",
    guaranteeEyebrow: "GARANTÍA TOTAL",
    guaranteeTitle1: "30 Días de Resultados",
    guaranteeTitle2: "Garantizados",
    guaranteeA: "Si en ",
    guaranteeStrong1: "30 días",
    guaranteeB: " no obtienes los resultados prometidos, ",
    guaranteeStrong2: "te devolvemos tu dinero.",
    guaranteeAssurance: "Garantizamos resultados. Sin riesgo para ti.",
    guaranteeBadges: ["Compra 100% Segura", "Reembolso Garantizado", "Satisfacción o Dinero de Vuelta"],
    guaranteeFine: "Garantía válida por 30 días después de la fecha de compra.",
    finalTitle1: "¡No te pierdas esta",
    finalTitle2: "oportunidad única!",
    finalCta: "VER LOS PLANOS",
    waMessage: "Vine por la página de la herramienta MRO, me gustaría resolver una duda.",
    waAria: "Hablar por WhatsApp con MRO",
    waHover: "Resolver una duda",
    footer: "© 2025 MRO - Mais Resultados Online. Todos los derechos reservados.",
  },
} as const;

export type SalesCopy = typeof pageCopy.pt;
