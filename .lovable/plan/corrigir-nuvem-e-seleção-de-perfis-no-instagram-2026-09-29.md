# Corrigir nuvem e seleção de perfis no Instagram

## Objetivo
Garantir que cada conta cadastrada e seu print sejam recuperados em qualquer dispositivo, e que clicar em um perfil sempre abra exatamente aquele perfil.

## Implementação
- Trocar os identificadores temporais dos perfis por identificadores estáveis e sem colisão, mantendo compatibilidade com perfis já salvos.
- Normalizar sessões antigas que tenham identificadores ausentes ou duplicados, sem apagar análises, estratégias, históricos ou prints.
- Preservar o perfil selecionado pelo nome da conta durante sincronizações com a nuvem, evitando voltar automaticamente ao primeiro perfil.
- Fortalecer o seletor para identificar cada item também pelo nome único da conta.
- Garantir que o upload do print registre a URL na nuvem mesmo quando ainda não existir uma linha auxiliar para o perfil, mantendo também a cópia no histórico persistente do usuário.

## Validação
- Testar múltiplos perfis criados/restaurados em sequência e confirmar identificadores únicos.
- Confirmar que trocar de perfil abre a análise correspondente antes e depois de uma sincronização.
- Confirmar que a URL do print é restaurada pela nuvem em uma nova sessão/dispositivo.
- Validar compilação, erros de execução e a tela no navegador sem alterar outros módulos.

## Detalhes técnicos
- Alterações restritas ao armazenamento/sincronização de perfis, ao seletor e à função de upload do print.
- PostgreSQL, usuários, liberações, credenciais, análises existentes e demais produtos permanecem intactos.
