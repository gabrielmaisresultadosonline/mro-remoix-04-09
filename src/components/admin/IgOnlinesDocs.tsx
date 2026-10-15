import React from 'react';
import { Card } from '@/components/ui/card';

const ENDPOINT = 'https://ubdphcaymnztuduxwden.supabase.co/functions/v1/ig-online-api';

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
        Endpoint único (POST JSON, CORS liberado para extensões): <code className="break-all">{ENDPOINT}</code>
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

    <Card className="p-4 space-y-2">
      <h4 className="font-semibold text-sm">Resposta do ping</h4>
      <pre className="text-[11px] bg-muted p-3 rounded-md overflow-x-auto whitespace-pre">{`{
  "success": true,
  "status": "client" | "trial" | "unknown",
  "registered": true,
  "mro_username": "cliente01",
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
