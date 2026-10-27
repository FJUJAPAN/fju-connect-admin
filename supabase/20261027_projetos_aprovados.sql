-- Migration required before the My Projects view can read approved records.
create table if not exists public.fju_projetos_jovens (
 id uuid primary key default gen_random_uuid(),
 jovem_id uuid not null references public.fju_jovens(id) on delete cascade,
 projeto text not null check(length(btrim(projeto)) between 2 and 80),
 aprovado boolean not null default false,
 aprovado_em timestamptz,
 criado_em timestamptz not null default now(),
 unique(jovem_id,projeto)
);
alter table public.fju_projetos_jovens enable row level security;
revoke all on public.fju_projetos_jovens from anon;
grant select on public.fju_projetos_jovens to authenticated;
create policy fju_projetos_jovens_proprio_select on public.fju_projetos_jovens
for select to authenticated using (
 exists(select 1 from public.fju_vinculos_conta_jovem v
 where v.jovem_id=fju_projetos_jovens.jovem_id and v.usuario_id=auth.uid() and v.ativo=true)
);
-- No client writes: future coordinator approval must be implemented through a secure administrative workflow.
