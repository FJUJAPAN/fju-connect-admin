-- FJU Connect JAPAN | © 2026 FJU JAPAN
-- Execute no Supabase SQL Editor antes de ativar o seletor de seções.
alter table public.fju_materias
  add column if not exists secao_publicacao text not null default 'noticias';

alter table public.fju_materias
  drop constraint if exists fju_materias_secao_publicacao_check;
alter table public.fju_materias
  add constraint fju_materias_secao_publicacao_check
  check (secao_publicacao in ('proximos_eventos','eventos_realizados','noticias','esporte','cultura'));

create or replace function public.fju_definir_secao_materia(p_id uuid, p_secao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_materia public.fju_materias%rowtype;
  v_nacional boolean;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória';
  end if;
  if p_secao is null or p_secao not in
    ('proximos_eventos','eventos_realizados','noticias','esporte','cultura') then
    raise exception 'Seção inválida';
  end if;
  select exists (
    select 1 from public.fju_perfis p
    where p.usuario_id = auth.uid() and p.ativo is true and p.papel = 'nacional'
  ) into v_nacional;
  select * into v_materia from public.fju_materias where id = p_id for update;
  if not found then raise exception 'Matéria não encontrada'; end if;
  if not v_nacional and not exists (
    select 1 from public.fju_perfis p
    where p.usuario_id = auth.uid()
      and p.ativo is true and p.papel = 'coordenador'
      and p.polo_id = v_materia.polo_id
      and v_materia.autor_id = auth.uid()
  ) then
    raise exception 'Sem permissão para alterar esta matéria';
  end if;
  if v_materia.status not in ('rascunho','pendente') then
    raise exception 'Seção de matéria já decidida não pode ser alterada';
  end if;
  update public.fju_materias set secao_publicacao = p_secao where id = p_id;
end;
$$;
revoke all on function public.fju_definir_secao_materia(uuid,text) from public, anon;
grant execute on function public.fju_definir_secao_materia(uuid,text) to authenticated;
