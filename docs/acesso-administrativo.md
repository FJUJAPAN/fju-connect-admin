# FJU JAPAN — patente e acesso administrativo

## Instalação

Para instalações novas, execute nesta ordem no SQL Editor do Supabase:

1. `supabase/migrations/20261022_acesso_administrativo.sql`
2. `supabase/migrations/20261022_patente_coordenador_acesso.sql`

Se a primeira já foi instalada, execute somente a segunda. Ambas são transacionais e podem ser repetidas. A instalação não promove contas nem aprova pedidos antigos. O merge não executa SQL no Supabase.

Depende das tabelas existentes `fju_perfis`, `fju_jovens`, `fju_polos`, `fju_solicitacoes`, `fju_vinculos_conta_jovem` e `fju_coordenador_cards`.

## Solicitação pelo coordenador

1. Abra a ficha do seu polo e toque em **Solicitar edição**.
2. Selecione a patente **Coordenador** e envie.
3. O servidor identifica o e-mail pela conta confirmada e vinculada à ficha e inclui o acesso administrativo no mesmo pedido.
4. O Nacional vê a conta e o polo em **Pedidos** e toca em **Aprovar patente e acesso** ou **Recusar**.
5. A aprovação atualiza a patente e o perfil administrativo na mesma transação. A pessoa sai e entra novamente para atualizar sua área administrativa.

Não há campo para digitar e-mail. Sem conta confirmada vinculada, o pedido não é criado; confira o cadastro primeiro. O acesso fica limitado ao polo da ficha.

Se a patente já é Coordenador, use o botão **Solicitar acesso administrativo** da ficha: a conta é identificada automaticamente, e o pedido avulso continua dependendo do Nacional. Isso também atende quem recebeu a patente antes desta atualização. Uma alteração direta de patente pelo Nacional não concede acesso automaticamente por este fluxo; nesse caso, use o botão da ficha.

## Aprovação e histórico

Pedidos de patente novos incluem um pedido de acesso identificado por `solicitacao_patente_id`. A seção de acessos mostra o vínculo, mas não oferece uma segunda aprovação. O servidor exige que a decisão seja feita no pedido de patente.

Um gatilho diferido aplica a decisão do acesso ao fim da mesma transação da função existente `fju_decidir_solicitacao`. Funciona tanto se ela atualiza primeiro a patente quanto se atualiza primeiro o status. Qualquer falha reverte a transação. Rejeitar mantém patente e acesso sem alterações.

As verificações anteriores de polo, vínculo, e-mail, perfil e autorização do solicitante são mantidas. Pedidos vinculados não podem ser reescritos. Pedidos anteriores à migração não ganham acesso retroativamente.

## Verificação

`npm install` e `npm test`: 30 cenários SQL em PostgreSQL embarcado (PGlite), com dados fictícios, mais testes da interface em DOM local e sintaxe dos scripts. Incluem as duas ordens possíveis de atualização da função de decisão, rejeição, autorização por polo, e-mail automático e bloqueio de decisões separadas.

Os testes usam uma função de decisão de teste para simular o contrato do fluxo existente; não executam a função real nem acessam o Supabase de produção. Após instalar o SQL, conferir um pedido real com sessões de coordenador e Nacional.
