# FJU JAPAN — eventos e cobertura

O editor separa o momento do evento (futuro ou realizado) da categoria (Esporte, Cultura, Help, Dança, Evento especial e categorias anteriores).

Eventos futuros exigem data, título, texto em pelo menos um idioma e uma foto. Na virada do dia seguinte em Asia/Tokyo, deixam o destaque público e aparecem como realizados no painel. A classificação é calculada ao carregar a página; não depende de cron.

O autor abre a cobertura, mantém a capa, preenche o relato e acrescenta até cinco fotos. Uma revisão separada fica pendente. O convite original continua acessível pelo link, mas não aparece como matéria normal antes da aprovação. O Nacional aprova a revisão em transação, atualizando o registro original e removendo o rascunho da revisão; URL e comentários são preservados. Rejeição mantém a revisão editável. Um índice único impede coberturas duplicadas.

## Instalação

1. Executar `sql/20261024_eventos_cobertura.sql` no Supabase SQL Editor. Requer as migrações anteriores de matérias e seções já instaladas.
2. Mesclar o PR público de `FJUJAPAN/fju-connect` (leitor com seis fotos e separação entre convites e notícias).
3. Mesclar este PR administrativo.
4. Testar com uma conta coordenadora: enviar convite e verificar que só aparece após aprovação Nacional. Usar um evento publicado de data passada para abrir a cobertura, enviar e aprovar; conferir que mantém o link.

SQL não foi executado no Supabase de produção. Não há credenciais administrativas disponíveis nesta sessão.

## Validação realizada

- `node --test tests/materias-fluxo.test.cjs`: 7 testes de comportamento, incluindo data do Japão, fotos 1/6, payload de cobertura e bloqueio de envio repetido.
- Sintaxe dos scripts JavaScript verificada com `node --check`.
- Migração executada em PostgreSQL local via PGlite, com tabelas de teste representando o esquema existente: autorização, bloqueio entre autores, datas, isolamento da revisão, duplicidade, manutenção do ID, fotos e acesso anônimo.
- Não foi possível executar inspeção visual em navegador: executável Chromium ausente no ambiente.
