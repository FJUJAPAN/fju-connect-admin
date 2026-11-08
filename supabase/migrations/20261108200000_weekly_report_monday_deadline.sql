-- Restrict coordinator correction requests to Monday following the report Sunday (Japan time).
create or replace function public.fju_validar_prazo_correcao_relatorio_semanal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_perfil record;
  v_semana date;
begin
  select p.papel, p.polo_id, p.ativo
    into v_perfil
  from public.fju_perfis p
  where p.usuario_id = auth.uid()
  limit 1;

  if not found
     or not coalesce(v_perfil.ativo, false)
     or v_perfil.papel <> 'coordenador'
     or v_perfil.polo_id is distinct from new.polo_id then
    raise exception 'Somente o coordenador ativo do polo pode solicitar a correção.';
  end if;

  select r.semana_domingo
    into v_semana
  from public.fju_relatorios_semanais r
  where r.id = new.relatorio_id
    and r.polo_id = new.polo_id;

  if not found then
    raise exception 'Relatório semanal não encontrado para este polo.';
  end if;

  if (now() at time zone 'Asia/Tokyo')::date > (v_semana + 1) then
    raise exception 'O prazo para corrigir este relatório terminou na segunda-feira (horário do Japão).';
  end if;

  return new;
end;
$function$;

revoke all on function public.fju_validar_prazo_correcao_relatorio_semanal() from public;
revoke all on function public.fju_validar_prazo_correcao_relatorio_semanal() from anon;
revoke all on function public.fju_validar_prazo_correcao_relatorio_semanal() from authenticated;

drop trigger if exists fju_validar_prazo_correcao_relatorio_semanal
  on public.fju_relatorio_semanal_edicao_solicitacoes;

create trigger fju_validar_prazo_correcao_relatorio_semanal
before insert on public.fju_relatorio_semanal_edicao_solicitacoes
for each row
execute function public.fju_validar_prazo_correcao_relatorio_semanal();
