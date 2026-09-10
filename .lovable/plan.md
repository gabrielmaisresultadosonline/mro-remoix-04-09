# Corrigir a inicialização e o CORS da extensão

## Objetivo
Manter a `mro-tool-api` pública para requisições externas e impedir que a atualização falhe apenas porque a API ainda está reiniciando.

## Implementação
1. Aguardar a API na porta 8787 ficar saudável após o recarregamento do PM2, com tentativas por tempo limitado.
2. Em falha real, exibir status e logs recentes do `mro-api`, sem expor credenciais.
3. Separar os testes: validar o preflight público diretamente no Nginx mesmo durante reinícios e validar a rota local somente depois que a API estiver pronta.
4. Aplicar a mesma ordem segura em todos os scripts de atualização/deploy usados na VPS.
5. Preservar banco PostgreSQL, arquivos, tokens, `.env` e demais serviços.

## Validação
- Verificar sintaxe de todos os scripts alterados.
- Confirmar que o Nginx entrega `OPTIONS 204` com um único `Access-Control-Allow-Origin: *`.
- Confirmar que o backend responde em `/health` antes do teste local e do POST real.
- Confirmar que falhas reais imprimem diagnóstico útil e continuam bloqueando uma atualização incompleta.

## Detalhes técnicos
O erro `curl: (7) Connection refused` significa que não havia processo escutando na porta 8787 naquele instante; não é uma rejeição CORS. O Nginx continuará respondendo ao preflight da extensão sem depender do processo da API, enquanto as chamadas POST receberão CORS também em erros do proxy.
