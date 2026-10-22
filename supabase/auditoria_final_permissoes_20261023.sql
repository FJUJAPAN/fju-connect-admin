-- FJU JAPAN | Auditoria FINAL de permissões (somente leitura).
-- Execute no Supabase SQL Editor, sem editar ou excluir registros.
-- Não compartilhe publicamente os e-mails retornados.

-- 1. Contas com poder nacional: a equipe deve confirmar manualmente cada endereço.
SELECT p.usuario_id, u.email, p.papel, p.ativo, p.polo_id
FROM public.fju_perfis p
LEFT JOIN auth.users u ON u.id = p.usuario_id
WHERE p.papel = 'nacional'
ORDER BY p.ativo DESC, u.email;

-- 2. Perfis de coordenação sem polo e perfis nacionais presos a um polo.
SELECT p.usuario_id, p.papel, p.polo_id, p.ativo
FROM public.fju_perfis p
WHERE (p.papel = 'coordenador' AND p.ativo IS TRUE AND p.polo_id IS NULL)
   OR (p.papel = 'nacional' AND p.ativo IS TRUE AND p.polo_id IS NOT NULL);

-- 3. Verificar se as tabelas críticas têm RLS ligado.
SELECT n.nspname AS schema, c.relname AS tabela,
       c.relrowsecurity AS rls_ativo, c.relforcerowsecurity AS rls_forcado
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p')
  AND c.relname IN ('fju_perfis','fju_jovens','fju_solicitacoes',
                    'fju_pedidos_acesso_admin','fju_vinculos_conta_jovem')
ORDER BY c.relname;

-- 4. Conferir políticas efetivas dos dados de acesso.
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('fju_perfis','fju_pedidos_acesso_admin','fju_vinculos_conta_jovem')
ORDER BY tablename, policyname;

-- 5. Detectar acesso direto de anon / authenticated às tabelas sensíveis.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('fju_perfis','fju_pedidos_acesso_admin','fju_vinculos_conta_jovem')
  AND grantee IN ('anon','authenticated','PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- 6. Verificar funções obrigatórias de solicitação / aprovação.
SELECT p.proname AS funcao,
       pg_get_function_identity_arguments(p.oid) AS argumentos,
       p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_pode_executar,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS autenticado_pode_executar
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('fju_conta_coordenacao','fju_solicitar_acesso_admin',
                   'fju_decidir_acesso_admin','fju_listar_pedidos_acesso_admin')
ORDER BY p.proname, argumentos;

-- 7. Confirmação de instalação dos gatilhos de patente/acesso.
SELECT c.relname AS tabela, t.tgname AS gatilho, t.tgenabled AS habilitado
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal
AND t.tgname IN ('fju_coordenacao_solicitada','fju_coordenacao_preservar_pedido',
                'fju_coordenacao_decidida')
ORDER BY t.tgname;
