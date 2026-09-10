import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileCode } from 'lucide-react';

const ENDPOINT = 'https://adljdeekwifwcdcgbpit.supabase.co/functions/v1/mro-tool-api';

const Block: React.FC<{ title: string; description?: string; code: string }> = ({ title, description, code }) => (
  <Card className="p-4 space-y-2">
    <h4 className="font-semibold text-sm">{title}</h4>
    {description && <p className="text-xs text-muted-foreground">{description}</p>}
    <pre className="bg-muted rounded-md p-3 text-[11px] overflow-x-auto whitespace-pre">{code}</pre>
  </Card>
);

/** Documentação da API de controle de acesso da Ferramenta MRO (para a extensão). */
const MroApiDocumentation: React.FC = () => (
  <div className="space-y-4">
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <FileCode className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">API de controle de acessos — Ferramenta MRO</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Endpoint único (POST, JSON). O campo <code>action</code> define a operação.
      </p>
      <pre className="bg-muted rounded-md p-3 text-[11px] overflow-x-auto">{ENDPOINT}</pre>
      <div className="flex flex-wrap gap-2 pt-1">
        <Badge variant="outline">Vitalício = 999999 dias</Badge>
        <Badge variant="outline">Anual = mostra os dias restantes</Badge>
        <Badge variant="outline">Mensal = dias restantes</Badge>
        <Badge variant="secondary">5 testes por mês · 1 dia ou 6 horas</Badge>
        <Badge className="bg-amber-500 text-black hover:bg-amber-500">Verificação de @instagram no login</Badge>
        <Badge variant="destructive">Conta fixa não pode ser removida</Badge>
      </div>
    </Card>

    <Card className="p-4 space-y-2 border-amber-500/40 bg-amber-500/5">
      <h4 className="font-semibold text-sm text-amber-500">🔒 Regra obrigatória: só entra com Instagram cadastrado</h4>
      <p className="text-xs text-muted-foreground">
        A extensão deve enviar o <code>@instagram</code> que está logado no navegador junto do login. A API verifica se
        aquele perfil está cadastrado <strong>nesse usuário</strong>. Se não estiver, o login é recusado
        (<code>instagram_not_registered: true</code>) e a ferramenta NÃO deve abrir.
      </p>
      <p className="text-xs text-muted-foreground">Fontes verificadas automaticamente:</p>
      <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
        <li><code>plan_account</code> — contas fixas do plano (vitalício / anual / mensal)</li>
        <li><code>trial_account</code> — contas de teste da ferramenta (5 por mês, 1 dia cada)</li>
        <li><code>free_trial</code> — perfis cadastrados no <strong>teste grátis</strong> (válidos e não removidos)</li>
        <li><code>instagram_area</code> — perfis já cadastrados pelo cliente na área <code>/instagram</code></li>
      </ul>
    </Card>

    <Block
      title="1) Login com verificação do Instagram (recomendado)"
      description="Envie o @instagram logado na extensão. Só retorna success:true se o perfil estiver cadastrado."
      code={`POST ${ENDPOINT}
{
  "action": "login",
  "username": "usuariovip",       // ou "email": "cliente@email.com"
  "password": "senha",
  "instagram": "minhaconta"        // @ do perfil logado na extensão
}

// ✅ Instagram cadastrado -> pode abrir a ferramenta
{
  "success": true,
  "instagram_verified": true,
  "instagram": {
    "username": "minhaconta",
    "registered": true,
    "source": "plan_account",      // plan_account | trial_account | free_trial | instagram_area
    "is_trial": false,
    "trial_expires_at": null
  },
  "user": { "plan_type": "vitalicio", "lifetime": true, "days_remaining": 999999, "plan_accounts": 4, "access_allowed": true },
  "accounts": [{ "instagram_username": "minhaconta" }],
  "trials": { "limit": 5, "used": 0, "remaining": 5, "duration_days": 1 },
  "slots": { "total": 4, "used": 1, "available": 3 }
}

// ❌ Instagram NÃO cadastrado -> BLOQUEAR o login
{
  "success": false,
  "instagram_not_registered": true,
  "instagram": "outraconta",
  "error": "O Instagram @outraconta não está cadastrado na sua conta. Cadastre o perfil na área /instagram antes de usar a ferramenta."
}

// ❌ Acesso expirado
{ "success": false, "needs_renewal": true, "error": "Acesso expirado ou desativado" }`}
    />

    <Block
      title="2) Login simples (sem verificar Instagram)"
      description="Se o campo instagram não for enviado, a API só valida o plano e retorna as contas cadastradas."
      code={`{ "action": "login", "username": "usuariovip", "password": "senha" }`}
    />

    <Block
      title="3) Verificar Instagram isoladamente"
      description="Use quando o cliente trocar de perfil dentro da extensão, sem refazer o login."
      code={`{ "action": "verify_instagram", "username": "usuariovip", "instagram": "minhaconta" }

// Cadastrado
{
  "success": true,
  "allowed": true,
  "registered": true,
  "instagram": "minhaconta",
  "source": "free_trial",          // veio do teste grátis
  "is_trial": true,
  "trial_expires_at": "2026-07-30T12:00:00.000Z",
  "plan": { "plan_type": "mensal", "lifetime": false, "days_remaining": 22, "access_allowed": true }
}

// Não cadastrado -> não liberar a ferramenta
{ "success": true, "allowed": false, "registered": false, "instagram": "outraconta",
  "error": "O Instagram @outraconta não está cadastrado nessa conta." }`}
    />

    <Block
      title="4) Verificar usuário (sem senha)"
      code={`{ "action": "verify_user", "username": "usuariovip" }`}
    />

    <Block
      title="5) Verificar se a conta do Instagram está liberada (check_account)"
      description="Mesma verificação do verify_instagram — inclui plano, testes de 1 dia, teste grátis e perfis da área /instagram."
      code={`{ "action": "check_account", "username": "usuariovip", "instagram": "minhaconta" }

// Resposta
{ "success": true, "allowed": true, "registered": true, "source": "instagram_area", "is_trial": false }`}
    />

    <Block
      title="6) Cadastrar conta do plano"
      description="Bloqueia automaticamente quando o cliente tenta cadastrar mais contas do que o plano permite."
      code={`{ "action": "add_account", "username": "usuariovip", "instagram": "novaconta" }

// Limite atingido
{
  "success": false,
  "limit_reached": true,
  "error": "Você não pode cadastrar mais contas do que o seu plano permite (4 contas)..."
}`}
    />

    <Block
      title="7) Cadastrar conta de TESTE (5 por mês, 1 dia cada)"
      description="Não consome slot do plano. Expira sozinha em 24h."
      code={`{ "action": "add_account", "username": "usuariovip", "instagram": "contateste", "trial": true }

// Resposta
{ "success": true, "trial": true, "trial_expires_at": "2026-07-30T12:00:00.000Z" }

// Testes esgotados
{ "success": false, "trials_exhausted": true, "error": "Você já usou seus 5 testes deste mês" }`}
    />

    <Block
      title="8) Cadastrar conta de TESTE de 6 HORAS (extensão)"
      description="Mesma action, informando trial_hours. Aceita de 1 a 24 horas. Não consome slot fixo do plano e expira sozinha."
      code={`{
  "action": "add_account",
  "username": "usuariovip",
  "instagram": "contateste",
  "trial": true,
  "trial_hours": 6
}

// Resposta
{
  "success": true,
  "trial": true,
  "trial_hours": 6,
  "trial_expires_at": "2026-07-29T18:00:00.000Z",
  "accounts": [ ... ],
  "trials": { "limit": 5, "used": 1, "remaining": 4 }
}

// Testes esgotados
{ "success": false, "trials_exhausted": true, "error": "Você já usou seus 5 testes deste mês" }`}
    />

    <Card className="p-4 space-y-2 border-red-500/40 bg-red-500/5">
      <h4 className="font-semibold text-sm text-red-500">🚫 Contas FIXAS não podem ser removidas nem alteradas</h4>
      <p className="text-xs text-muted-foreground">
        Não existe action de remoção de conta fixa para a extensão. Se o cliente tentar excluir/alterar uma conta fixa
        dentro da extensão, exiba a mensagem padrão abaixo e não chame a API.
      </p>
      <pre className="bg-muted rounded-md p-3 text-[11px] overflow-x-auto whitespace-pre">{`"Contas fixas não podem ser removidas. Entre em contato com o administrador para remover suas contas."`}</pre>
      <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
        <li>Contas de <strong>teste (6h / 1 dia)</strong> somem sozinhas ao expirar — não precisa remover.</li>
        <li>Única exceção permitida: <strong>mesmo perfil que apenas trocou de @</strong> (renomeou). Nesse caso o cliente deve pedir a alteração ao administrador, que ajusta em <em>/admin → MRO Ferramenta → Usuários</em>.</li>
        <li>A remoção/edição de conta fixa é exclusiva do painel admin (<code>remove_account</code> / <code>admin_add_account</code> — nunca expor essas actions na extensão).</li>
      </ul>
    </Card>

    <Card className="p-4 space-y-2 border-primary/40 bg-primary/5">
      <h4 className="font-semibold text-sm text-primary">🖥️ Área de membros dentro da extensão (iframe)</h4>
      <p className="text-xs text-muted-foreground">
        Depois do login validado, a extensão pode abrir a área de membros <strong>MRO-FERRAMENTA</strong> embutida em um
        iframe, sem sair do navegador. O usuário vê os tutoriais, as contas cadastradas e o tempo de acesso restante.
      </p>
      <pre className="bg-muted rounded-md p-3 text-[11px] overflow-x-auto whitespace-pre">{`https://maisresultadosonline.com.br/dashboard/produto/mro-ferramenta?embed=1`}</pre>
      <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
        <li>Abra o iframe somente após <code>login</code> retornar <code>success: true</code>.</li>
        <li>No <code>manifest.json</code> (MV3) inclua o domínio em <code>host_permissions</code>.</li>
        <li>O painel de contas/tempo pode ser montado com os dados do próprio <code>login</code> (não precisa de iframe).</li>
      </ul>
    </Card>

    <Block
      title="9) Painel do usuário na extensão (contas + tempo restante)"
      description="Use o retorno do login (ou verify_user) para montar a tela dentro da extensão."
      code={`{
  "success": true,
  "user": {
    "username": "usuariovip",
    "email": "cliente@email.com",
    "plan_type": "anual",        // vitalicio | anual | mensal
    "lifetime": false,
    "days_remaining": 214,        // 999999 = vitalício (mostrar "Vitalício")
    "plan_accounts": 4,
    "access_allowed": true
  },
  "accounts": [
    { "instagram_username": "contafixa1", "is_trial": false, "trial_expires_at": null },
    { "instagram_username": "contateste", "is_trial": true,  "trial_expires_at": "2026-07-29T18:00:00.000Z" }
  ],
  "slots":  { "total": 4, "used": 2, "available": 2 },
  "trials": { "limit": 5, "used": 1, "remaining": 4 }
}

// Render sugerido na extensão
// Plano:  anual · 214 dias restantes   (ou "Vitalício")
// Fixas:  @contafixa1  [cadeado - não removível]
// Testes: @contateste  expira em 5h42m`}
    />

    <Block
      title="10) Fluxo completo na extensão (login → cadastro fixo ou teste 6h → área de membros)"
      code={`const API = "${ENDPOINT}";
const post = (b) => fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());

// 1) login com o @ logado no navegador
const instagram = getLoggedInstagramUsername();
let data = await post({ action: "login", username, password, instagram });

// 2) conta não existe no banco -> oferecer cadastro (FIXA ou TESTE 6H)
if (data.instagram_not_registered) {
  const escolha = await askUser(\`O perfil @\${instagram} não está cadastrado. Como deseja cadastrar?\`, ["Conta fixa", "Teste 6 horas"]);

  const reg = escolha === "Conta fixa"
    ? await post({ action: "add_account", username, instagram })
    : await post({ action: "add_account", username, instagram, trial: true, trial_hours: 6 });

  if (!reg.success) return alert(reg.error);          // limite do plano ou testes esgotados

  // 3) revalidar antes de liberar
  const check = await post({ action: "verify_instagram", username, instagram });
  if (!check.allowed) return alert(check.error);
  data = await post({ action: "login", username, password, instagram });
}

if (!data.success) return alert(data.error);

// 4) montar painel + abrir área de membros no iframe
renderPainel(data.user, data.accounts, data.slots, data.trials);
openIframe("https://maisresultadosonline.com.br/dashboard/produto/mro-ferramenta?embed=1");

// 5) tentativa de remover conta fixa -> bloquear na própria extensão
function onRemoveClick(conta) {
  if (!conta.is_trial) {
    return alert("Contas fixas não podem ser removidas. Entre em contato com o administrador para remover suas contas.");
  }
  alert("Contas de teste expiram automaticamente.");
}`}
    />

  </div>
);

export default MroApiDocumentation;
