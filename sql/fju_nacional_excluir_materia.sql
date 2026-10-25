-- Executar no SQL Editor do Supabase antes de usar o botão.
-- Exclusão exclusiva do perfil nacional autenticado.
create or replace function public.fju_nacional_excluir_materia(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.fju_perfis
    where usuario_id = auth.uid() and papel = 'nacional' and ativo = true
  ) then
    raise exception 'Apenas o Nacional pode excluir matérias';
  end if;

  -- Revisões ligadas à matéria são removidas na mesma transação.
  delete from public.fju_materias_revisoes where materia_id = p_id;
  delete from public.fju_materias where id = p_id;
  if not found then
    raise exception 'Matéria não encontrada';
  end if;
end;
$$;
revoke all on function public.fju_nacional_excluir_materia(uuid) from public, anon;
grant execute on function public.fju_nacional_excluir_materia(uuid) to authenticated;
