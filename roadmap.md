# Roadmap

## Concluído
- [x] Login administrativo unificado em `/admin`, `/adminusuario` e `/instagram-nova-admin` validado no backend
- [x] `manage-user-access` protegido por sessão administrativa (era acessível sem login)
- [x] Credenciais administrativas removidas do hub `/admin` e de `adminConfig`
- [x] `deploy.sh` apontando para o repositório atual + verificações de login no deploy

## Pendente
- [ ] Remover senha administrativa hardcoded dos painéis secundários (IAVendeMais, Empresas, ZapMRO Vendas, Instagram Nova Email/Euro, TokensPanel, EstruturaTutoriais, UserHeader, DescontoAlunos, documentação Ads News)

## Login de clientes /IG
- [x] Aceitar hashes bcrypt importados e convertê-los para PBKDF2 no primeiro login válido
- [x] Registrar diagnósticos de login sem expor e-mail completo ou senha
- [x] Permitir redefinição auditada da senha de clientes pelo `/IG/admin`
- [x] Implementar `/auth/v1/recover` com e-mail SMTP e link restrito de recuperação

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
