-- FJU JAPAN | Preparação do vínculo seguro login ↔ ficha do jovem.
-- REVISAR tipos de public.fju_jovens.id e permissões antes de executar no Supabase.
-- NÃO executar automaticamente. Não concede cadastro nem acesso ao painel administrativo.
begin;
create table if not exists public.fju_vinculos_conta_jovem (
  id uuid primary key default gen_random_uuid(),
  jovem_id uuid not null unique references public.fju_jovens(id) on delete cascade,
  usuario_id uuid not null unique references auth.users(id) on delete cascade,
  liberado_em timestamptz not null default now(),
  liberado_por uuid references auth.users(id),
  ativo boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table public.fju_vinculos_conta_jovem enable row level security;
revoke all on public.fju_vinculos_conta_jovem from anon;
revoke all on public.fju_vinculos_conta_jovem from authenticated;
grant select on public.fju_vinculos_conta_jovem to authenticated;
-- O jovem enxerga somente seu próprio vínculo ATIVO, nunca vínculos de terceiros.
drop policy if exists fju_vinculo_ler_proprio on public.fju_vinculos_conta_jovem;
create policy fju_vinculo_ler_proprio on public.fju_vinculos_conta_jovem
  for select to authenticated using (ativo = true and usuario_id = (select auth.uid()));
-- Escrita deliberadamente fechada até existir fluxo de aprovação auditável e validado no servidor.
commit;
