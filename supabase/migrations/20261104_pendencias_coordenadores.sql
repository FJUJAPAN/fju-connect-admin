-- Pendências internas de conferência de patente por polo.
-- Os coordenadores só leem pendências do seu polo; o Nacional pode cadastrar tarefas.
create schema if not exists fju_internal;
revoke all on schema fju_internal from public;

create table if not exists public.fju_pendencias_coordenadores (
  id uuid primary key default gen_random_uuid(),
  polo_id uuid not null references public.fju_polos(id),
  jovem_id uuid not null references public.fju_jovens(id),
  tipo text not null default 'patente' check (tipo in ('patente')),
  titulo text not null,
  descricao text not null,
  patentes_resolucao text[] not null default array[]::text[],
  status text not null default 'pendente' check (status in ('pendente','concluida')),
  criado_em timestamptz not null default now(),
  concluido_em timestamptz,
  constraint fju_pendencia_patente_alvos check (array_length(patentes_resolucao, 1) > 0),
  constraint fju_pendencia_status_coerente check (
    (status = 'pendente' and concluido_em is null)
    or (status = 'concluida' and concluido_em is not null)
  )
);
create unique index if not exists fju_pendencias_patente_uma_ativa
  on public.fju_pendencias_coordenadores (jovem_id, tipo) where status='pendente';
create index if not exists fju_pendencias_polo_estado
  on public.fju_pendencias_coordenadores (polo_id, status, criado_em desc);

alter table public.fju_pendencias_coordenadores enable row level security;
drop policy if exists fju_pendencias_read on public.fju_pendencias_coordenadores;
create policy fju_pendencias_read on public.fju_pendencias_coordenadores
  for select to authenticated using (
    exists (select 1 from public.fju_perfis p
      where p.usuario_id = (select auth.uid()) and p.ativo
      and (p.papel='nacional' or (p.papel='coordenador' and p.polo_id=fju_pendencias_coordenadores.polo_id)))
  );
drop policy if exists fju_pendencias_insert on public.fju_pendencias_coordenadores;
create policy fju_pendencias_insert on public.fju_pendencias_coordenadores
  for insert to authenticated with check (
    exists (select 1 from public.fju_perfis p
      where p.usuario_id=(select auth.uid()) and p.ativo and p.papel='nacional')
    and exists (select 1 from public.fju_jovens j
      where j.id=jovem_id and j.polo_id=polo_id and j.excluido_em is null)
  );
drop policy if exists fju_pendencias_update on public.fju_pendencias_coordenadores;
create policy fju_pendencias_update on public.fju_pendencias_coordenadores
  for update to authenticated
  using (exists (select 1 from public.fju_perfis p
      where p.usuario_id=(select auth.uid()) and p.ativo and p.papel='nacional'))
  with check (exists (select 1 from public.fju_perfis p
      where p.usuario_id=(select auth.uid()) and p.ativo and p.papel='nacional'));
revoke all on public.fju_pendencias_coordenadores from anon;
grant select, insert, update on public.fju_pendencias_coordenadores to authenticated;

-- Uma alteração efetivada na ficha conclui a pendência somente se a patente
-- estiver entre as opções que exigiam conferência. Pedido pendente NÃO conclui.
create or replace function fju_internal.concluir_pendencias_patente()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.excluido_em is null and new.patente is distinct from old.patente then
    update public.fju_pendencias_coordenadores
       set status='concluida', concluido_em=now()
     where jovem_id=new.id and polo_id=new.polo_id and status='pendente'
       and tipo='patente'
       and lower(btrim(coalesce(new.patente,'')))=any(patentes_resolucao);
  end if;
  return new;
end;
$$;
revoke all on function fju_internal.concluir_pendencias_patente() from public, anon, authenticated;
drop trigger if exists fju_pendencias_patente_concluida on public.fju_jovens;
create trigger fju_pendencias_patente_concluida
  after update of patente on public.fju_jovens
  for each row execute function fju_internal.concluir_pendencias_patente();
