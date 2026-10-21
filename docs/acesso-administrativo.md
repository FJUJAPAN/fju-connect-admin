# FJU JAPAN — acesso administrativo com aprovação nacional

## Instalação

Execute o conteúdo de `supabase/migrations/20261022_acesso_administrativo.sql` no SQL Editor do projeto Supabase. A migração é transacional, pode ser repetida e não concede acesso a nenhuma conta durante a instalação.

Depende das tabelas existentes `fju_perfis`, `fju_jovens`, `fju_polos`, `fju_vinculos_conta_jovem` e `fju_coordenador_cards`. A permissão do painel continua sendo verificada em `fju_perfis`.

O código do painel mostra uma mensagem de atualização pendente caso as funções ainda não tenham sido instaladas. Fazer merge não executa SQL no Supabase.

## Uso

1. O coordenador abre a ficha do seu polo, com patente Coordenador já aprovada.
2. Em **Acesso ao painel administrativo**, informa o e-mail da conta confirmada e já vinculada à ficha e envia o pedido.
3. O pedido aparece na aba **Pedidos**, na seção **Acesso ao painel administrativo**, com nome, e-mail, polo e solicitante.
4. O Nacional aprova ou rejeita. Ao aprovar, a função grava o perfil de coordenador ativo no polo da ficha e registra a decisão na mesma transação.
5. A pessoa sai da conta e entra novamente para atualizar sua área administrativa.

O formulário não cria contas, não envia e-mails, não troca o vínculo da ficha e não altera patentes. Nenhum e-mail individual está fixado no código. Se a conta não estiver vinculada à ficha, o vínculo deve ser revisado antes de solicitar acesso.

Se o polo, a patente, o vínculo, o e-mail ou a autorização do solicitante mudar enquanto o pedido estiver pendente, a aprovação será bloqueada. Rejeite o pedido antigo e faça um novo após conferir os dados. Contas nacionais não são rebaixadas; coordenadores de outro polo não são transferidos por esse fluxo.

## Verificação

`npm install` e `npm test` executam testes com PostgreSQL embarcado (PGlite), dados fictícios e DOM local. Incluem autorização por polo, aprovação exclusiva nacional, rejeição, duplicidade, pedidos desatualizados, bloqueio de escrita direta e interface.

Esses testes não acessam o Supabase de produção. Após instalar o SQL, conferir um pedido real com uma sessão de coordenador e outra de Nacional.
