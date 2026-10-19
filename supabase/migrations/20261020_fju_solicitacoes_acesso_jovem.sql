-- FJU JAPAN — pedidos de convite para jovens (NÃO cria usuários nem senhas).
-- Executar no SQL Editor após revisar. Seguro para repetir.
begin;
create table if not exists public.fju_solicitacoes_acesso_jovem (
 id uuid primary key default gen_random_uuid(),
 jovem_id uuid not null references public.fju_jovens(id) on delete cascade,
 email text not null,
 solicitado_por uuid not null references auth.users(id),
 solicitado_em timestamptz not null default now(),
 status text not null default 'pendente' check (status in ('pendente','concluido','cancelado')),
 constraint email_formato check (length(email) between 5 and 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
);
create unique index if not exists fju_acesso_pendente_unico on public.fju_solicitacoes_acesso_jovem(jovem_id) where status='pendente';
alter table public.fju_solicitacoes_acesso_jovem enable row level security;
revoke all on public.fju_solicitacoes_acesso_jovem from anon,authenticated;
create or replace function public.fju_solicitar_acesso_jovem(p_jovem_id uuid,p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_perfil record;v_polo uuid;v_id uuid;
begin
 if auth.uid() is null then raise exception 'Faça login'; end if;
 select papel,polo_id,ativo into v_perfil from public.fju_perfis where usuario_id=auth.uid();
 if not found or v_perfil.ativo is distinct from true or v_perfil.papel not in ('nacional','coordenador') then raise exception 'Acesso não autorizado'; end if;
 select polo_id into v_polo from public.fju_jovens where id=p_jovem_id;
 if not found then raise exception 'Jovem não encontrado'; end if;
 if v_perfil.papel='coordenador' and (v_perfil.polo_id is null or v_perfil.polo_id is distinct from v_polo) then raise exception 'Jovem fora do seu polo'; end if;
 if exists(select 1 from public.fju_vinculos_conta_jovem where jovem_id=p_jovem_id and ativo=true) then raise exception 'Jovem já possui acesso ativo'; end if;
 insert into public.fju_solicitacoes_acesso_jovem(jovem_id,email,solicitado_por)
 values(p_jovem_id,lower(trim(p_email)),auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.fju_solicitar_acesso_jovem(uuid,text) from public,anon;
grant execute on function public.fju_solicitar_acesso_jovem(uuid,text) to authenticated;
commit;
