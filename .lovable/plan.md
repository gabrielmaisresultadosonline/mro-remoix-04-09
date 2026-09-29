# Restaurar prints existentes no painel Instagram

## Objetivo
Fazer os prints já exibidos no administrativo aparecerem também em `/instagram/painel`, preservando perfis, análises, histórico e demais dados.

## Alterações
- Ao entrar, carregar junto aos perfis os URLs de print já registrados na nuvem administrativa.
- Relacionar cada print pelo usuário da Ferramenta MRO e pelo nome exato da conta do Instagram.
- Aplicar o URL ao perfil ativo e ao histórico correspondente antes de montar o painel.
- Preservar qualquer print já presente na sessão principal e nunca substituir um URL válido por vazio.
- Registrar a regra de hidratação e validar tipos, compilação e o fluxo visível do painel.

## Escopo preservado
Nenhuma mudança em login, limites de contas, análises, estratégias, PostgreSQL, tokens, credenciais, uploads existentes ou demais produtos.

## Detalhes técnicos
A correção será feita na hidratação de login: os registros de `squarecloud_user_profiles.profile_screenshot_url`, já usados pelo admin, serão sobrepostos nas `profileSessions` e `archivedProfiles` pelo `instagram_username` normalizado antes de `initializeFromCloud` e antes da sincronização de retorno.
