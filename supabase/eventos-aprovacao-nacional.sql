-- FJU JAPAN: solicitações de eventos especiais
-- Executar no SQL Editor do Supabase antes de habilitar a interface.
begin;
create table if not exists public.fju_solicitacoes_eventos (
 id bigint generated always as identity primary key,
 tipo text not null check (tipo in ('inclusao','exclusao')),
 evento_id text,
 polo_id text not null,
 dados_propostos jsonb not null default '{}'::jsonb,
 justificativa text,
 solicitante_id uuid not null default auth.uid(),
 status text not null default 'pendente' check (status in ('pendente','aprovada','rejeitada')),
 decidido_por uuid,
 criado_em timestamptz not null default now(),
 decidido_em timestamptz,
 constraint fju_solicitacoes_eventos_tipo_check check ((tipo='inclusao' and evento_id is null) or (tipo='exclusao' and evento_id is not null))
);
create index if not exists fju_solicitacoes_eventos_polo_status_idx on public.fju_solicitacoes_eventos(polo_id,status);
alter table public.fju_solicitacoes_eventos enable row level security;
drop policy if exists "fju_event_requests_read" on public.fju_solicitacoes_eventos;
drop policy if exists "fju_event_requests_insert" on public.fju_solicitacoes_eventos;
create policy "fju_event_requests_read" on public.fju_solicitacoes_eventos for select to authenticated using (
 exists(select 1 from public.fju_perfis p where p.usuario_id=auth.uid() and p.ativo and
 (p.papel='nacional' or (p.papel='coordenador' and p.polo_id::text=fju_solicitacoes_eventos.polo_id)))
);
create policy "fju_event_requests_insert" on public.fju_solicitacoes_eventos for insert to authenticated with check (
 status='pendente' and decidido_por is null and decidido_em is null and solicitante_id=auth.uid()
 and exists(select 1 from public.fju_perfis p where p.usuario_id=auth.uid() and p.ativo and p.papel='coordenador' and p.polo_id::text=fju_solicitacoes_eventos.polo_id)
);
-- Remover TODAS as policies antigas de eventos para não deixar caminhos de escrita sem aprovação.
do $$
declare p record;
begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='fju_eventos_especiais' loop
  execute format('drop policy if exists %I on public.fju_eventos_especiais',p.policyname);
 end loop;
end $$;
alter table public.fju_eventos_especiais enable row level security;
create policy "fju_events_read" on public.fju_eventos_especiais for select to authenticated using (
 exists(select 1 from public.fju_perfis p where p.usuario_id=auth.uid() and p.ativo and
 (p.papel='nacional' or (p.papel='coordenador' and p.polo_id=fju_eventos_especiais.polo_id)))
);
create policy "fju_events_national_insert" on public.fju_eventos_especiais for insert to authenticated with check (
 exists(select 1 from public.fju_perfis p where p.usuario_id=auth.uid() and p.ativo and p.papel='nacional')
);
create policy "fju_events_national_update" on public.fju_eventos_especiais for update to authenticated using (
 exists(select 1 from public.fju_perfis p where p.usuario_id=auth.uid() and p.ativo and p.papel='nacional')
) with check (
 exists(select 1 from public.fju_perfis p where p.usuario_id=auth.uid() and p.ativo and p.papel='nacional')
);
create policy "fju_events_national_delete" on public.fju_eventos_especiais for delete to authenticated using (
 exists(select 1 from public.fju_perfis p where p.usuario_id=auth.uid() and p.ativo and p.papel='nacional')
);
create or replace function public.fju_decidir_solicitacao_evento(p_id bigint,p_aprovar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare req public.fju_solicitacoes_eventos%rowtype;
declare changed_count integer;
begin
 if not exists(select 1 from public.fju_perfis where usuario_id=auth.uid() and ativo and papel='nacional') then
  raise exception 'Apenas o Administrador Nacional pode decidir solicitações';
 end if;
 select * into req from public.fju_solicitacoes_eventos where id=p_id for update;
 if not found or req.status<>'pendente' then raise exception 'Solicitação não encontrada ou já decidida'; end if;
 if p_aprovar then
  if req.tipo='inclusao' then
   insert into public.fju_eventos_especiais(polo_id,nome_evento,data_evento,total_jovens,criado_por)
   select e.polo_id,e.nome_evento,e.data_evento,e.total_jovens,req.solicitante_id
   from jsonb_populate_record(null::public.fju_eventos_especiais,req.dados_propostos) e;
  else
   execute 'delete from public.fju_eventos_especiais where id::text=$1 and polo_id::text=$2'
   using req.evento_id,req.polo_id;
   get diagnostics changed_count=row_count;
   if changed_count<>1 then raise exception 'Evento não encontrado ou já excluído'; end if;
  end if;
 end if;
 update public.fju_solicitacoes_eventos set status=case when p_aprovar then 'aprovada' else 'rejeitada' end,
 decidido_por=auth.uid(),decidido_em=now() where id=p_id;
end $$;
revoke all on function public.fju_decidir_solicitacao_evento(bigint,boolean) from public;
grant execute on function public.fju_decidir_solicitacao_evento(bigint,boolean) to authenticated;
grant select,insert on public.fju_solicitacoes_eventos to authenticated;
grant usage,select on sequence public.fju_solicitacoes_eventos_id_seq to authenticated;
commit;
