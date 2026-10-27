import React from 'react';
import { Card } from '@/components/ui/card';

/** Backend próprio na VPS (Express + PostgreSQL do servidor). */
const ENDPOINT = 'https://api.maisresultadosonline.com.br/functions/v1/ig-online-api';

const Block: React.FC<{ title: string; code: string }> = ({ title, code }) => (
  <Card className="p-4 space-y-2">
    <h4 className="font-semibold text-sm">{title}</h4>
    <pre className="text-[11px] bg-muted p-3 rounded-md overflow-x-auto whitespace-pre">{code}</pre>
  </Card>
);

/** Documentação da API IG Onlines para implementar na extensão (modo desenvolvedor). */
const IgOnlinesDocs: React.FC = () => (
  <div className="space-y-4">
    <Card className="p-4 space-y-2">
      <h3 className="font-bold">Como funciona</h3>
      <p className="text-sm text-muted-foreground">
        A extensão detecta o perfil logado na página do Instagram e envia para esta API. Guardamos dia, hora,
        navegador e IP de cada acesso, comparamos o perfil com os cadastros da MRO Ferramenta e do teste grátis e,
        quando o perfil não está no banco, ele aparece marcado como <strong>Fora do banco</strong>. A resposta do
        mesmo endpoint já traz os avisos pendentes para mostrar na tela do usuário.
      </p>
      <p className="text-sm text-muted-foreground">
        Endpoint único no servidor MRO (POST JSON, gravado no PostgreSQL da VPS, CORS liberado para extensões): <code className="break-all">{ENDPOINT}</code>
      </p>
    </Card>

    <Block
      title="1) Detectar o perfil logado (content script em instagram.com)"
      code={`// manifest.json
{
  "manifest_version": 3,
  "host_permissions": ["https://www.instagram.com/*", "${new URL(ENDPOINT).origin}/*"],
  "content_scripts": [{ "matches": ["https://www.instagram.com/*"], "js": ["ig-online.js"], "run_at": "document_idle" }]
}

// ig-online.js — lê o perfil logado sem depender do login da ferramenta
function perfilLogado() {
  try {
    const shared = window._sharedData?.config?.viewer?.username;
    if (shared) return shared;
  } catch (e) {}
  const ds = document.cookie.match(/ds_user_id=(\\d+)/);
  const link = document.querySelector('a[href^="/"][role="link"] img[alt*="foto do perfil"]');
  const alt = link?.getAttribute('alt') || '';
  const m = alt.match(/de ([A-Za-z0-9._]+)/);
  if (m) return m[1];
  const nav = document.querySelector('a[href*="/accounts/edit"]');
  if (nav) return document.querySelector('header a[href^="/"]')?.getAttribute('href')?.replace(/\\//g, '') || null;
  return ds ? null : null;
}`}
    />

    <Block
      title="2) Enviar o sinal (ping) e receber os avisos"
      code={`async function pingIgOnline() {
  const instagram = perfilLogado();
  if (!instagram) return;
  const res = await fetch('${ENDPOINT}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-extension-version': chrome.runtime.getManifest().version },
    body: JSON.stringify({
      action: 'ping',
      instagram,
      url: location.href,
      user_agent: navigator.userAgent
    })
  });
  const data = await res.json();
  // data.status: 'client' | 'trial' | 'unknown'
  // data.registered: false quando o perfil não está no nosso banco
  // data.messages: avisos pendentes para exibir agora
  (data.messages || []).forEach(mostrarAviso);
}

// a cada 2 minutos e sempre que a página do Instagram abrir
pingIgOnline();
setInterval(pingIgOnline, 120000);`}
    />

    <Block
      title="3) Mostrar o aviso em tela cheia (popup no centro, fundo escuro)"
      code={`function mostrarAviso(m) {
  const back = document.createElement('div');
  back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2147483647;display:flex;align-items:center;justify-content:center';
  const box = document.createElement('div');
  box.style.cssText = 'max-width:520px;width:90%;background:#111;color:#fff;border:1px solid #eab308;border-radius:14px;padding:24px;font-family:Arial';
  box.innerHTML = '<h2 style="color:#eab308;margin:0 0 10px">' + (m.title || '') + '</h2>' +
    (m.image_url ? '<img src="' + m.image_url + '" style="width:100%;border-radius:10px;margin-bottom:10px">' : '') +
    '<p style="white-space:pre-wrap;line-height:1.5">' + (m.body || '') + '</p>';
  (m.buttons || []).forEach(function (b) {
    const a = document.createElement('a');
    a.href = b.url; a.target = '_blank'; a.textContent = b.label;
    a.style.cssText = 'display:inline-block;margin:10px 8px 0 0;background:#eab308;color:#111;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold';
    a.onclick = function () { evento(m.id, 'clicked', b.label); };
    box.appendChild(a);
  });

  if (!m.blocking) {
    const close = document.createElement('button');
    close.textContent = 'Fechar';
    close.disabled = m.lock_seconds > 0;
    close.style.cssText = 'display:block;margin-top:16px;background:#333;color:#fff;border:0;padding:10px 16px;border-radius:8px;cursor:pointer';
    if (m.lock_seconds > 0) setTimeout(function () { close.disabled = false; }, m.lock_seconds * 1000);
    close.onclick = function () { evento(m.id, 'closed'); back.remove(); };
    box.appendChild(close);
  }

  back.appendChild(box);
  document.documentElement.appendChild(back);
  evento(m.id, 'shown');
}

function evento(message_id, event, detail) {
  fetch('${ENDPOINT}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'message_event', instagram: perfilLogado(), message_id, event, detail })
  });
}`}
    />


    <Block
      title="3) Métricas: seguidores, boas-vindas e sessão (action: metrics)"
      code={`// Envie ao abrir a ferramenta (session:"start"), periodicamente (ex.: a cada 10 min)
// e ao desligar (session:"end"). Todos os campos além de "instagram" são opcionais.
// - followers: total ATUAL de seguidores do perfil (número inteiro)
// - welcome_sent: quantas boas-vindas foram enviadas DESDE o último envio (incremento)
// - session: "start" | "end" (omitir nos envios intermediários)
fetch('${ENDPOINT}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'metrics',
    instagram: perfilLogado(),
    followers: 1520,
    welcome_sent: 3,
    session: 'start',
    request_id: crypto.randomUUID() // evita somar duas vezes se o envio for repetido
  })
});
// Resposta: { "success": true, "day": "2026-10-19" }`}
    />

    <Card className="p-4 space-y-2">
      <h4 className="font-semibold text-sm">Como as métricas são guardadas</h4>
      <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
        <li>O primeiro valor de <code>followers</code> recebido vira o <strong>inicial</strong> do perfil; os seguintes atualizam o <strong>atual</strong>.</li>
        <li>Um registro por perfil por dia (horário de Brasília): seguidores no começo e no fim do dia e total de boas-vindas do dia. O crescimento diário é fim − começo.</li>
        <li><code>welcome_sent</code> é somado; envie apenas o que foi enviado desde o último envio. Mande um <code>request_id</code> único por envio: se a mesma requisição chegar de novo, ela é ignorada (<code>duplicate: true</code>).</li>
        <li>Limite: 120 requisições por minuto por perfil/IP (acima disso, resposta 429).</li>
        <li>Sessão: <code>start</code> marca o início e limpa o fim; <code>end</code> marca o término. Sem <code>end</code>, o painel mostra "Em andamento"; o perfil é considerado online se houver envio nos últimos 5 minutos (ping ou metrics).</li>
        <li>Requisitos: POST JSON, sem token, CORS liberado (<code>*</code>). Na extensão, inclua o domínio da API em <code>host_permissions</code> e faça o fetch pelo service worker/background para não ser bloqueado pela política do Instagram (connect-src).</li>
        <li>Validação: <code>followers</code> inteiro ≥ 0; <code>welcome_sent</code> 0–10000 por envio. Dados ausentes aparecem como "Aguardando dados" no painel.</li>
      </ul>
    </Card>

    <Card className="p-4 space-y-2">
      <h3 className="font-bold">Monitoramento e Controle Administrativo de Perfis</h3>
      <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
        <li><strong>Métricas e origem:</strong> seguidores e boas-vindas vêm só da ação <code>metrics</code> enviada pela extensão; atividade vem de <code>ping</code> e <code>metrics</code>. Nada é estimado — campos sem envio mostram "Aguardando dados".</li>
        <li><strong>Sessões e horários:</strong> <code>session:"start"</code> grava o início, <code>session:"end"</code> o término. Tempo conectado = agora − início (sessão aberta e online), fim − início (encerrada) ou última atividade − início (desconectado sem <code>end</code>).</li>
        <li><strong>Novos seguidores:</strong> soma, por dia (Brasília), de seguidores no fim do dia − seguidores no começo do dia, dentro do período escolhido no painel.</li>
        <li><strong>Mensagens:</strong> <code>welcome_sent</code> é um incremento somado ao total do perfil e ao dia corrente.</li>
        <li><strong>Bloqueio:</strong> em IG Onlines → Métricas → Detalhes, o admin bloqueia/desbloqueia apenas aquele @perfil, com mensagem própria (em branco = mensagem padrão). Data do bloqueio e da liberação ficam gravadas; histórico e métricas não são apagados.</li>
        <li><strong>Validação no servidor:</strong> o estado vem sempre do banco. As respostas de <code>ping</code>, <code>metrics</code> e <code>check_access</code> trazem <code>blocked</code>, <code>block_message</code> e <code>blocked_at</code>. Enquanto bloqueado, <code>ping</code> não entrega outros avisos.</li>
        <li><strong>Na ferramenta:</strong> chame <code>check_access</code> ao abrir e antes de cada função protegida (seguir, curtir, boas-vindas, disparos). Se <code>allowed:false</code>, não execute a função e mostre o popup centralizado fixo (sem botão fechar) com <code>block_message</code>. Ao receber <code>allowed:true</code>, remova o popup e libere normalmente.</li>
        <li><strong>Sincronização:</strong> o painel grava no banco na hora; a ferramenta reflete no próximo <code>ping</code>/<code>check_access</code> (recomendado a cada 60s). Recarregar a página não remove o bloqueio.</li>
      </ul>
    </Card>

    <Block
      title="4) Verificar bloqueio (action: check_access)"
      code={`async function podeUsar() {
  const r = await fetch('${ENDPOINT}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'check_access', instagram: perfilLogado() })
  }).then(x => x.json());
  // { success:true, allowed:false, blocked:true, block_message:"...", blocked_at:"2026-10-20T00:10:00Z" }
  if (!r.allowed) { mostrarPopupBloqueio(r.block_message); return false; }
  document.getElementById('mro-bloqueio')?.remove();
  return true;
}

function mostrarPopupBloqueio(texto) {
  if (document.getElementById('mro-bloqueio')) return;
  const back = document.createElement('div');
  back.id = 'mro-bloqueio';
  back.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';
  const box = document.createElement('div');
  box.style.cssText = 'max-width:440px;background:#111;color:#fff;border:2px solid #facc15;border-radius:16px;padding:24px;text-align:center;font-family:sans-serif';
  box.innerHTML = '<h2 style="color:#facc15;margin:0 0 12px">Acesso bloqueado</h2>';
  const p = document.createElement('p'); p.textContent = texto; box.appendChild(p);
  back.appendChild(box); document.documentElement.appendChild(back);
}

// Antes de cada ação protegida:
// if (!(await podeUsar())) return;
setInterval(podeUsar, 60000);`}
    />


    <Card className="p-4 space-y-2 border-primary">
      <h3 className="font-bold">Seguidores: por que ainda não aparecem e como conectar</h3>
      <p className="text-sm text-muted-foreground">
        As boas-vindas já chegam porque a extensão manda <code>welcome_sent</code>. Os seguidores só aparecem se a extensão mandar um destes
        campos na mesma ação <code>metrics</code> — hoje ela não manda nenhum, por isso o painel fica em "Aguardando dados" mesmo com
        "7 seguidores" na extensão. Use um (ou os dois):
      </p>
      <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
        <li><code>followers_gained</code> (recomendado, é o número que a extensão já mostra): quantos seguidores foram <strong>ganhos desde o último envio</strong>. É somado, igual às boas-vindas. Ex.: ganhou 7 → envie 7 uma vez; depois envie só os novos. Também aceitamos <code>new_followers</code> ou <code>seguidores_ganhos</code>.</li>
        <li><code>followers</code>: o <strong>total atual</strong> do perfil (ex.: 1520 ou "1,5 mil"). O primeiro valor vira o inicial; o crescimento é atual − inicial.</li>
        <li>Se mandar os dois, o total tem prioridade quando muda; senão vale o contador de ganhos.</li>
        <li>Para conferir: no terminal da VPS rode <code>pm2 logs mro-api | grep "ig-online] metrics"</code>. Cada envio mostra <code>campos=...</code> com exatamente o que chegou. Se não aparecer <code>followers_gained</code> ou <code>followers</code>, o problema está na extensão.</li>
      </ul>
    </Card>

    <Block
      title="5) Enviar seguidores ganhos junto com as boas-vindas"
      code={`// guarde quanto já foi enviado para mandar só a diferença
let jaEnviados = Number(localStorage.getItem('mro_followers_sent') || 0);

async function enviarMetricas(totalGanhosNaExtensao, boasVindasNovas) {
  const novos = Math.max(0, totalGanhosNaExtensao - jaEnviados);
  const r = await fetch('${ENDPOINT}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'metrics',
      instagram: perfilLogado(),
      followers_gained: novos,          // ex.: 7 na primeira vez
      welcome_sent: boasVindasNovas,    // como já funciona hoje
      // followers: 1520,               // opcional: total atual do perfil
      request_id: crypto.randomUUID()
    })
  }).then(x => x.json());
  if (r.success) { jaEnviados += novos; localStorage.setItem('mro_followers_sent', String(jaEnviados)); }
}`}
    />

    <Card className="p-4 space-y-2">
      <h3 className="font-bold">Imagens geradas e aprovadas (galeria)</h3>
      <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
        <li>Quando o cliente <strong>aprova e processa</strong> uma publicação, a extensão envia cada imagem para o servidor com a legenda da publicação (ação <code>gallery_upload</code>).</li>
        <li>O arquivo fica no disco da VPS e o registro no PostgreSQL. Depois de <strong>30 dias</strong> imagem e registro são apagados automaticamente (limpeza a cada hora).</li>
        <li>Formatos: JPG, PNG ou WEBP, até 8 MB por imagem (o servidor confere o tipo real do arquivo).</li>
        <li><code>publication_id</code> + <code>image_index</code> evitam duplicar: se a mesma imagem for reenviada, a resposta traz <code>duplicate: true</code> e nada é gravado de novo.</li>
        <li>No admin, aba <strong>Dashboard e imagens</strong>: resumo das métricas, todas as imagens com o cliente que enviou, filtro por cliente, baixar todas (ZIP com imagem + legenda em .txt), ver maior e excluir.</li>
        <li>Galeria pública: <code>/galeria-ig</code> — tela cheia, rolagem infinita, funciona em celular e qualquer navegador. Mostra <strong>só as imagens</strong>; a legenda aparece ao clicar para ver maior. Nenhum @perfil ou dado de cliente é exibido.</li>
        <li>Envie apenas imagens que o cliente aprovou e que ele concorda em ter exibidas na vitrine pública.</li>
      </ul>
    </Card>

    <Block
      title="6) Enviar imagem aprovada + legenda (action: gallery_upload)"
      code={`// Rode no service worker/background (não no content script) para não ser bloqueado.
async function blobParaBase64(blob) {
  return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
}

// chamar uma vez por imagem, depois que o cliente aprovar e processar
async function enviarImagemAprovada({ instagram, publicacaoId, indice, imagemBlob, legenda }) {
  const r = await fetch('${ENDPOINT}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'gallery_upload',
      instagram,                         // @ do cliente
      publication_id: publicacaoId,      // id da publicação na extensão
      image_index: indice,               // 0, 1, 2... para carrossel
      image_base64: await blobParaBase64(imagemBlob), // "data:image/jpeg;base64,..."
      caption: legenda                   // legenda da publicação (até 2200 caracteres)
    })
  }).then(x => x.json());
  // { success:true, id:"...", expires_at:"...", duplicate:false }
  return r;
}`}
    />

    <Card className="p-4 space-y-2">
      <h4 className="font-semibold text-sm">Leitura pública (sem login)</h4>
      <pre className="text-[11px] bg-muted p-3 rounded-md overflow-x-auto whitespace-pre">{`GET ${ENDPOINT}?public_gallery=1&limit=60
→ { "images": [{ "id", "url", "caption", "created_at" }], "next_before": "..." }
   próxima página: &before=<next_before>

GET ${ENDPOINT}?file=<id>   → a imagem (some depois de 30 dias)`}</pre>
    </Card>

    <Card className="p-4 space-y-2">
      <h4 className="font-semibold text-sm">Resposta do ping</h4>
      <pre className="text-[11px] bg-muted p-3 rounded-md overflow-x-auto whitespace-pre">{`{
  "success": true,
  "status": "client" | "trial" | "unknown",
  "registered": true,
  "mro_username": "cliente01",
  "blocked": false, "block_message": null, "blocked_at": null,
  "messages": [
    { "id": "...", "title": "...", "body": "...", "image_url": null,
      "buttons": [{ "label": "Comprar", "url": "https://..." }],
      "blocking": false, "lock_seconds": 5 }
  ]
}`}</pre>
      <p className="text-xs text-muted-foreground">
        Dica: este controle é independente do login de usuário e senha. Mesmo que alguém remova a verificação de
        acesso da extensão, o perfil logado continua chegando aqui e aparece em IG Onlines.
      </p>
    </Card>
  </div>
);

export default IgOnlinesDocs;
