-- Executar no Supabase SQL Editor antes do merge do PR.
-- Somente o Administrador Nacional pode consultar nomes dos solicitantes.
create or replace function public.fju_nomes_solicitantes()
returns table(usuario_id uuid, nome text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.fju_perfis p
    where p.usuario_id = auth.uid() and p.papel = 'nacional' and p.ativo = true
  ) then
    raise exception 'Acesso restrito ao Administrador Nacional';
  end if;
  return query
  select distinct s.solicitante_id,
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'nome_completo'),''),
      nullif(trim(u.raw_user_meta_data ->> 'full_name'),''),
      nullif(trim(u.raw_user_meta_data ->> 'name'),''),
      nullif(trim(u.email),''),
      'Não identificado'
    )::text
  from public.fju_solicitacoes s
  left join auth.users u on u.id = s.solicitante_id
  where s.solicitante_id is not null;
end;
$$;
revoke all on function public.fju_nomes_solicitantes() from public, anon;
grant execute on function public.fju_nomes_solicitantes() to authenticated;
