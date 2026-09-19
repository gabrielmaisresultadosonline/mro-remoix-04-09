# Histórico de contas no painel Instagram

## Objetivo
Manter no seletor superior do `/instagram/painel` as contas já analisadas que foram removidas da lista ativa, inclusive depois de atualizar a página, sem recolocá-las como contas cadastradas nem consumir vagas.

## Alterações
- Trocar a reconciliação destrutiva atual por arquivamento: contas ausentes da lista ativa serão marcadas como histórico, preservando análises, estratégias, criativos, prints e crescimento.
- Exibir contas históricas no seletor superior com identificação visual de “Histórico”, mantendo as contas cadastradas como ativas.
- Ao cadastrar novamente uma conta histórica, reativar os dados existentes em vez de criar uma cópia ou apagar o histórico.
- Recuperar também perfis que já estejam no arquivo persistido do usuário, evitando que desapareçam após recarregar ou acessar por outro navegador.
- Parar de excluir definitivamente o registro auxiliar ao reconciliar contas; registrar o estado inativo preservando os dados existentes.
- Manter limites, testes, credenciais, tokens, banco, `.env`, uploads e demais fluxos sem alteração.

## Validação
- Simular uma conta ativa e outra removida, atualizar a página e confirmar ambas no seletor, com a removida marcada como histórico.
- Confirmar que a conta histórica não entra na contagem de contas ativas nem consome vaga.
- Confirmar que recadastrar a mesma conta restaura os dados anteriores sem duplicação.
- Verificar o fluxo em tela grande e celular e validar a atualização segura da VPS.

## Detalhes técnicos
A lista autorizada da `mro-tool-api` continua sendo a fonte para contas ativas. Os dados históricos permanecem no armazenamento persistente por usuário e no campo de sessões já existente; não será criada uma nova tabela nem removido qualquer dado.
