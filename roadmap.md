# Roadmap

## Concluído
- [x] Login administrativo unificado em `/admin`, `/adminusuario` e `/instagram-nova-admin` validado no backend
- [x] `manage-user-access` protegido por sessão administrativa (era acessível sem login)
- [x] Credenciais administrativas removidas do hub `/admin` e de `adminConfig`
- [x] `deploy.sh` apontando para o repositório atual + verificações de login no deploy

## Pendente
- [ ] Remover senha administrativa hardcoded dos painéis secundários (IAVendeMais, Empresas, ZapMRO Vendas, Instagram Nova Email/Euro, TokensPanel, EstruturaTutoriais, UserHeader, DescontoAlunos, documentação Ads News)

## Limites da Ferramenta MRO
- [x] Manter o total de contas liberadas estável ao cadastrar ou remover perfis
- [x] Registrar alterações administrativas no limite de extras

## Histórico do painel Instagram
- [x] Preservar perfis removidos como histórico após atualizar a página
- [x] Identificar contas históricas no seletor sem consumir vagas ativas
- [x] Reativar os dados anteriores sem duplicação quando a conta voltar

## Login de clientes /IG
- [x] Aceitar hashes bcrypt importados e convertê-los para PBKDF2 no primeiro login válido
- [x] Registrar diagnósticos de login sem expor e-mail completo ou senha
- [x] Permitir redefinição auditada da senha de clientes pelo `/IG/admin`
- [x] Implementar `/auth/v1/recover` com e-mail SMTP e link restrito de recuperação

## Acesso Lotar Grupos pelo Dashboard
- [x] Preservar a liberação manual exibida no `/admin`
- [x] Implementar na VPS a criação administrativa de identidade, link temporário e verificação do acesso automático
- [x] Impedir que o atualizador compile o site apontando para uma instância antiga do backend
- [x] Usar no acesso automático o mesmo ID liberado no card e aceitar os slugs `lotargrupos` e `lotar-grupos`
- [x] Unificar a identidade liberada com a sessão automática e aceitar cadastros históricos duplicados
- [x] Bloquear atualizações que publiquem o painel ou a função antiga do Lotar Grupos
- [x] Corrigir o formato GoTrue de `generate_link` para o SDK receber o token da sessão
- [ ] Atualizar a VPS e confirmar o acesso real de um cliente liberado

## Login CORS incident
- [x] Corrigir falha de typecheck que impedia `lovablack-api` de iniciar no Deno
- [x] Validar no deploy que o POST do login retorna 401 e CORS pela URL pública
- [x] Preservar sem alterações as credenciais do ambiente e banco existentes
- [x] Retirar `admin_login` do cold start Deno e atendê-lo nativamente no backend da VPS
- [x] Separar no deploy o diagnóstico local do diagnóstico público CDN/Nginx
- [x] Eliminar referências a runners Deno mortos e exigir PM2 no corte da VPS
- [x] Bloquear deploy vindo de `mro-projeto-02` e exigir o handler nativo antes do build
- [x] Automatizar correção e validação ponta a ponta do CORS da `mro-tool-api` na VPS
- [x] Atender preflight da `mro-tool-api` diretamente no Express e registrar diagnóstico persistente por origem
- [x] Tornar o CORS da `mro-tool-api` permanente no Nginx, inclusive em 4xx/5xx, e bloquear atualizações sem validação pública
- [x] Aguardar a saúde da porta 8787 antes do teste local e refletir qualquer header solicitado pelas extensões
- [x] Preservar o contrato original da extensão e atender o login diretamente no PostgreSQL, sem depender do processo Deno
- [x] Adicionar rastreamento seguro por requisição e monitor ao vivo do login da extensão na VPS
- [x] Rastrear URL da extensão no acesso geral do Nginx e aceitar variações com barra/caminho adicional
- [x] Substituir wildcard pela origem refletida com credenciais, compatível com XMLHttpRequest direto da extensão
- [x] Restaurar paridade estrita do JSON de login antigo e normalizar campos numéricos do PostgreSQL
- [x] Eliminar headers CORS/PNA duplicados no POST direto sem service worker e validar o modo Chromium
- [x] Impedir backups `.pre-mro-cors` nos includes ativos e recuperar o Nginx antes do reload
- [ ] Executar a atualização na VPS e confirmar um login real da extensão (bloqueado até o código chegar ao servidor)
