-- FJU Connect Japan: coordinator editing of submitted weekly reports requires National authorization.
alter table public.fju_relatorios_semanais
  add column if not exists versao integer not null default 1;

create table if not exists public.fju_relatorio_semanal_edicao_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  relatorio_id uuid not null references public.fju_relatorios_semanais(id) on delete restrict,
  polo_id uuid not null references public.fju_polos(id) on delete restrict,
  solicitado_por uuid not null references auth.users(id) on delete restrict,
  motivo text not null check (char_length(btrim(motivo)) between 5 and 1000),
  status text not null default 'pendente'
    check (status in ('pendente','autorizada','recusada','concluida')),
  solicitado_em timestamptz not null default now(),
  decidido_por uuid references auth.users(id) on delete set null,
  decidido_em timestamptz,
  observacao_nacional text,
  constraint fju_relatorio_solicitacao_status_decisao check (
    (status = 'pendente' and decidido_por is null and decidido_em is null)
    or (status in ('autorizada','recusada','concluida') and decidido_por is not null and decidido_em is not null)
  )
);

create unique index if not exists fju_relatorio_edicao_uma_solicitacao_ativa
  on public.fju_relatorio_semanal_edicao_solicitacoes(relatorio_id)
  where status in ('pendente','autorizada');
create index if not exists fju_relatorio_edicao_solicitacoes_status_data
  on public.fju_relatorio_semanal_edicao_solicitacoes(status, solicitado_em desc);

create table if not exists public.fju_relatorios_semanais_historico (
  id uuid primary key default gen_random_uuid(),
  relatorio_id uuid not null references public.fju_relatorios_semanais(id) on delete restrict,
  polo_id uuid not null references public.fju_polos(id) on delete restrict,
  versao integer not null,
  dados_anteriores jsonb not null,
  alterado_por uuid references auth.users(id) on delete set null,
  alterado_em timestamptz not null default now(),
  solicitacao_id uuid references public.fju_relatorio_semanal_edicao_solicitacoes(id) on delete set null
);
create index if not exists fju_relatorios_semanais_historico_relatorio
  on public.fju_relatorios_semanais_historico(relatorio_id, versao desc);

alter table public.fju_relatorio_semanal_edicao_solicitacoes enable row level security;
alter table public.fju_relatorios_semanais_historico enable row level security;
grant select, insert, update on public.fju_relatorio_semanal_edicao_solicitacoes to authenticated;
grant select on public.fju_relatorios_semanais_historico to authenticated;

drop policy if exists fju_relatorio_edicao_solicitacao_ler on public.fju_relatorio_semanal_edicao_solicitacoes;
create policy fju_relatorio_edicao_solicitacao_ler
on public.fju_relatorio_semanal_edicao_solicitacoes for select to authenticated
using (public.fju_acessa_polo(polo_id));

drop policy if exists fju_relatorio_edicao_solicitacao_criar on public.fju_relatorio_semanal_edicao_solicitacoes;
create policy fju_relatorio_edicao_solicitacao_criar
on public.fju_relatorio_semanal_edicao_solicitacoes for insert to authenticated
with check (
  solicitado_por = auth.uid()
  and exists (
    select 1 from public.fju_perfis p
    where p.usuario_id = auth.uid() and p.ativo = true
      and p.papel = 'coordenador' and p.polo_id = fju_relatorio_semanal_edicao_solicitacoes.polo_id
  )
  and exists (
    select 1 from public.fju_relatorios_semanais r
    where r.id = fju_relatorio_semanal_edicao_solicitacoes.relatorio_id
      and r.polo_id = fju_relatorio_semanal_edicao_solicitacoes.polo_id
  )
);

drop policy if exists fju_relatorio_edicao_solicitacao_decidir on public.fju_relatorio_semanal_edicao_solicitacoes;
create policy fju_relatorio_edicao_solicitacao_decidir
on public.fju_relatorio_semanal_edicao_solicitacoes for update to authenticated
using (exists (
  select 1 from public.fju_perfis p
  where p.usuario_id = auth.uid() and p.ativo = true and p.papel = 'nacional'
))
with check (exists (
  select 1 from public.fju_perfis p
  where p.usuario_id = auth.uid() and p.ativo = true and p.papel = 'nacional'
));

drop policy if exists fju_relatorio_edicao_historico_ler on public.fju_relatorios_semanais_historico;
create policy fju_relatorio_edicao_historico_ler
on public.fju_relatorios_semanais_historico for select to authenticated
using (public.fju_acessa_polo(polo_id));

drop policy if exists relatorios_semanais_atualizar_polo on public.fju_relatorios_semanais;
create policy relatorios_semanais_atualizar_polo
on public.fju_relatorios_semanais for update to authenticated
using (
  public.fju_acessa_polo(polo_id)
  and (
    exists (select 1 from public.fju_perfis p
      where p.usuario_id = auth.uid() and p.ativo = true and p.papel = 'nacional')
    or exists (select 1 from public.fju_relatorio_semanal_edicao_solicitacoes s
      where s.relatorio_id = fju_relatorios_semanais.id
        and s.polo_id = fju_relatorios_semanais.polo_id
        and s.solicitado_por = auth.uid() and s.status = 'autorizada')
  )
)
with check (
  public.fju_acessa_polo(polo_id)
  and (
    exists (select 1 from public.fju_perfis p
      where p.usuario_id = auth.uid() and p.ativo = true and p.papel = 'nacional')
    or exists (select 1 from public.fju_relatorio_semanal_edicao_solicitacoes s
      where s.relatorio_id = fju_relatorios_semanais.id
        and s.polo_id = fju_relatorios_semanais.polo_id
        and s.solicitado_por = auth.uid() and s.status = 'autorizada')
  )
);

create or replace function public.fju_registrar_edicao_relatorio_semanal()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare v_perfil record; v_solicitacao_id uuid;
begin
  select p.papel, p.polo_id, p.ativo into v_perfil
  from public.fju_perfis p where p.usuario_id = auth.uid() limit 1;
  if not found or not coalesce(v_perfil.ativo, false)
     or v_perfil.papel not in ('nacional','coordenador') then
    raise exception 'Sem permissão para editar este relatório.';
  end if;
  if new.polo_id is distinct from old.polo_id
     or new.semana_domingo is distinct from old.semana_domingo then
    raise exception 'Não é permitido alterar o polo ou a semana do relatório.';
  end if;
  if v_perfil.papel = 'coordenador' then
    if v_perfil.polo_id is distinct from old.polo_id then
      raise exception 'Você só pode editar relatórios do seu polo.';
    end if;
    select s.id into v_solicitacao_id
    from public.fju_relatorio_semanal_edicao_solicitacoes s
    where s.relatorio_id = old.id and s.polo_id = old.polo_id
      and s.solicitado_por = auth.uid() and s.status = 'autorizada'
    order by s.solicitado_em desc limit 1 for update;
    if v_solicitacao_id is null then
      raise exception 'A edição deste relatório ainda não foi autorizada pelo Nacional.';
    end if;
  end if;
  insert into public.fju_relatorios_semanais_historico
    (relatorio_id,polo_id,versao,dados_anteriores,alterado_por,solicitacao_id)
  values (old.id,old.polo_id,old.versao,to_jsonb(old),auth.uid(),v_solicitacao_id);
  new.versao := old.versao + 1;
  return new;
end;
$function$;

create or replace function public.fju_concluir_solicitacao_edicao_relatorio()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if exists (select 1 from public.fju_perfis p
    where p.usuario_id = auth.uid() and p.ativo = true and p.papel = 'coordenador') then
    update public.fju_relatorio_semanal_edicao_solicitacoes s
       set status = 'concluida'
     where s.relatorio_id = new.id and s.solicitado_por = auth.uid()
       and s.status = 'autorizada';
  end if;
  return new;
end;
$function$;

drop trigger if exists fju_registrar_edicao_relatorio_semanal on public.fju_relatorios_semanais;
create trigger fju_registrar_edicao_relatorio_semanal
before update on public.fju_relatorios_semanais
for each row execute function public.fju_registrar_edicao_relatorio_semanal();
drop trigger if exists fju_concluir_solicitacao_edicao_relatorio on public.fju_relatorios_semanais;
create trigger fju_concluir_solicitacao_edicao_relatorio
after update on public.fju_relatorios_semanais
for each row execute function public.fju_concluir_solicitacao_edicao_relatorio();
