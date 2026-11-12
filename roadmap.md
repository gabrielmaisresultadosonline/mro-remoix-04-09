# Roadmap

## IG Online: atividade, envios e criativos
- [x] Criar migração PostgreSQL aditiva para contadores diários, destinatários e histórico de criativos
- [x] Criar endpoints da extensão para métricas ampliadas, envios com deduplicação, consulta paginada de histórico e criativos
- [x] Ampliar dashboard admin com cartões, linhas diárias e históricos por perfil
- [x] Mostrar atividade e criativos das próprias contas no /instagram, sem misturar clientes
- [x] Documentar payloads, respostas e integração da extensão no admin
- [x] Testar regras locais, isolamento e telas admin/cliente (70 testes e navegador com respostas simuladas)
- [ ] Aplicar migração 032 na VPS e validar PostgreSQL real e envios da extensão atualizada (depende do deploy e da extensão, que está em outro projeto)

## E-mail boas-vindas afiliados
- [x] Usar SMTP Hostinger configurado na VPS e reportar resultado real do envio
- [x] Permitir reenvio ao e-mail salvo do próprio afiliado, com comissões e acesso ao resumo
- [x] Testar aceitação/recusa SMTP e fluxo de cadastro/reenvio (8 testes e navegador com respostas simuladas)
- [ ] Confirmar recebimento real na VPS (depende de atualização e envio SMTP real)

## Imagens por Instagram e permanência
- [x] Vincular imagens da galeria às contas privadas e mostrar carrosséis no /instagram
- [x] Desativar expiração de arquivos novos e existentes e atualizar documentação
- [x] Testar isolamento por conta, ordem de carrosséis e permanência (20 testes e navegador com respostas simuladas)
- [ ] Confirmar arquivos reais na VPS após atualização (depende do deploy)

## Pesquisa e Crescimentos Instagram
- [x] Pesquisar contas por nome ou usuário
- [x] Mostrar comparação inicial/atual, totais de boas-vindas e imagens salvas por conta ou todas
- [x] Conferir filtros, totais e apresentação no computador/celular com respostas simuladas
- [ ] Confirmar atualização e imagens reais na VPS (depende do deploy e de sessão MRO real disponível)

## Retorno ao dashboard
- [x] Redirecionar /instagram/painel antigo para /dashboard e corrigir os botões e o retorno sem sessão
- [x] Verificar destinos antigos e retorno sem sessão no navegador, sem alterar contas ou PostgreSQL

## Instagram: cadastro e acompanhamento
- [x] Reorganizar /instagram em cadastro e tutoriais, com contas em cascata
- [x] Mostrar métricas privadas da API preservando referência inicial e prints antigos
- [x] Gerar estratégias a partir da descrição escrita e preservar recursos existentes
- [x] Testar cadastro de duas contas, navegação, descrição salva e telas mobile/desktop com respostas simuladas
- [ ] Confirmar métricas e geração reais na VPS (depende da atualização e de sessão MRO real disponível)

## Posição ZAPMRO
- [x] ZAPMRO liberado no final da grade; sem acesso, abaixo da propaganda
- [x] Validar as duas situações em desktop/mobile e preservar abertura da compra com respostas simuladas

## Dashboard e acesso afiliados
- [x] Reutilizar sessão MRO ao voltar dos afiliados ao dashboard
- [x] Adicionar botão Seja um afiliado MRO
- [x] Separar propaganda API Oficial abaixo dos produtos e aplicar fundo preto do login
- [x] Conferir navegação e apresentação desktop/mobile com respostas simuladas; validação real na VPS depende da atualização

## AfiliadosX: sessão, Pix e resumo
- [x] Reutilizar o acesso conectado sem pedir confirmação de senha
- [x] Implementar salvamento privado da chave Pix no PostgreSQL e lista no /admin → Afiliados
- [x] Abrir resumo atualizado dentro do /afiliadosx com acesso validado no servidor
- [x] Validar regras e telas desktop/mobile com respostas simuladas
- [ ] Confirmar salvamento e leitura reais na VPS (depende da atualização do servidor)

## Pixel Cadastro Rend
- [x] Implementar configuração própria de Pixel no admin e atualização aditiva do PostgreSQL
- [x] Retirar explicações do quiz e manter política/preferências em tela separada
- [x] Validar configuração e Lead com respostas simuladas, sem alterar os outros produtos
- [ ] Confirmar persistência e recebimento real após atualização da VPS (depende do deploy e teste no servidor)

## Temas /mro-ferramenta
- [x] Preservar tema antigo e adicionar tema Netflix com escolha salva no navegador
- [x] Editar título, descrição e fundo das boas-vindas no admin existente
- [x] Validar visual isolado em celular e tablet, com capas completas e sem overflow
- [ ] Confirmar fluxo integrado de escolha, troca e publicação após a prévia liberar a versão atual (prévia serve versão anterior da página)

## Página inicial
- [x] Re-incluir o card da API Oficial WhatsApp em "Ferramentas & Serviços" (somente ele)
- [x] Trocar "Acessar meu painel" por "Já sou cliente" e levar direto ao /dashboard
- [x] Validar os 3 cards e o redirecionamento no navegador

## Página de ativação Whitelabel
- [x] Substituir a imagem enviada e incluir recursos Instagram, proposta comercial e suporte MRO em /whitelabel/vendas
- [x] Criar /whitelabel/vendas com oferta R$2.997 e dez acessos iniciais sem taxas por usuário
- [x] Direcionar todos os botões ao WhatsApp e validar página em telas grandes e pequenas

## Páginas de venda Whitelabel
- [ ] Aplicar a atualização na VPS e conferir o envio real da logo (depende da atualização no servidor)
- [x] Reutilizar as páginas completas MRO e Renda Extra sem alterar links originais
- [x] Permitir enviar a logo no admin e no painel do revendedor, com dupla marca animada
- [x] Preservar vendas, taxas e atribuição Whitelabel e validar os dois links (checkout simulado, sem compra real)

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
- [x] Persistir prints na nuvem mesmo antes da linha auxiliar do perfil existir
- [x] Impedir colisões de identificadores e preservar o perfil selecionado na sincronização
- [x] Restaurar no painel os prints já exibidos no administrativo
- [x] Aplicar automaticamente as migrations aditivas na VPS, inclusive em atualização rápida

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
- [x] Whitelabel MRO (revendedores, /whitelabel, /wl/:code, menu no /admin)

## Atualização MRO Inteligente
- [x] Igualar /instagram-nova-promoo2 à página oficial, preservando a tarja e a oferta promocional, e verificar o cadastro.
- [x] Aplicar direção preta com amarelo nas páginas oficiais e de afiliados
- [x] Detalhar as oito funções mantendo vídeos, preços e compras
- [x] Validar apresentação e abertura do cadastro (sem compra real)
- [x] Enxugar o topo às linhas pedidas, com fonte menor na segunda e na terceira
- [x] Deixar verdes os botões de chamada e de compra, mantendo o resto em amarelo
- [x] Remover o bloco "SUA RENDA EXTRA / COMO VOCÊ VAI FATURAR" de /descontoalunosrendaextra e /promorendaextra/:afiliado

## Preços /mktcompleto
- [x] Trocar o plano único de R$ 2000 por três opções: mensal R$ 1500, 3 meses R$ 3.000 e 6 meses R$ 5.000, com verificação visual

## Página Euro (/instagram-nova-euro)
- [x] Deixar todos os textos dessa página em espanhol, sem alterar as demais
- [x] Remover o botão flutuante de WhatsApp somente nessa página
- [x] Painel `/instagram-nova-euro/admin` com tentativas de compra, IPs/região conectados e envio do vídeo mp4 com transcodificação, além da tarja "euro" no `/instagram-nova-admin` (aguardando confirmação do escopo)
