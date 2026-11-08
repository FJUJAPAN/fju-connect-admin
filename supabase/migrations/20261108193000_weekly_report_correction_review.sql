-- FJU Connect Japan: coordinator submits a corrected report; National approves or declines it.
alter table public.fju_relatorio_semanal_edicao_solicitacoes
  add column if not exists dados_propostos jsonb;

alter table public.fju_relatorio_semanal_edicao_solicitacoes
  drop constraint if exists fju_relatorio_edicao_dados_propostos_objeto;
alter table public.fju_relatorio_semanal_edicao_solicitacoes
  add constraint fju_relatorio_edicao_dados_propostos_objeto
  check (dados_propostos is null or jsonb_typeof(dados_propostos) = 'object');

drop policy if exists fju_relatorio_edicao_solicitacao_decidir
  on public.fju_relatorio_semanal_edicao_solicitacoes;

create or replace function public.fju_registrar_edicao_relatorio_semanal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare v_perfil record; v_solicitacao_id uuid;
begin
  select p.papel,p.polo_id,p.ativo into v_perfil
  from public.fju_perfis p where p.usuario_id = auth.uid() limit 1;
  if not found or not coalesce(v_perfil.ativo,false)
     or v_perfil.papel not in ('nacional','coordenador') then
    raise exception 'Sem permissão para editar este relatório.';
  end if;
  if new.polo_id is distinct from old.polo_id
     or new.semana_domingo is distinct from old.semana_domingo then
    raise exception 'Não é permitido alterar o polo ou a semana do relatório.';
  end if;
  if v_perfil.papel = 'coordenador' then
    raise exception 'Coordenadores devem enviar a correção para aprovação do Nacional.';
  end if;
  select s.id into v_solicitacao_id
  from public.fju_relatorio_semanal_edicao_solicitacoes s
  where s.relatorio_id = old.id and s.status = 'pendente'
  order by s.solicitado_em desc limit 1;
  insert into public.fju_relatorios_semanais_historico
    (relatorio_id,polo_id,versao,dados_anteriores,alterado_por,solicitacao_id)
  values (old.id,old.polo_id,old.versao,to_jsonb(old),auth.uid(),v_solicitacao_id);
  new.versao := old.versao + 1;
  return new;
end;
$function$;

create or replace function public.fju_decidir_correcao_relatorio_semanal(
  p_solicitacao_id uuid, p_aprovar boolean, p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_perfil record;
  v_solicitacao public.fju_relatorio_semanal_edicao_solicitacoes%rowtype;
  v_dados jsonb;
begin
  select p.papel,p.ativo into v_perfil
  from public.fju_perfis p where p.usuario_id = auth.uid() limit 1;
  if not found or v_perfil.papel <> 'nacional' or not coalesce(v_perfil.ativo,false) then
    raise exception 'Somente o Nacional pode decidir correções de relatórios.';
  end if;
  select * into v_solicitacao
  from public.fju_relatorio_semanal_edicao_solicitacoes
  where id = p_solicitacao_id for update;
  if not found or v_solicitacao.status <> 'pendente' then
    raise exception 'Esta correção já foi analisada ou não existe.';
  end if;

  if p_aprovar then
    v_dados := v_solicitacao.dados_propostos;
    if v_dados is null or jsonb_typeof(v_dados) <> 'object'
       or jsonb_object_length(v_dados) <> 8
       or not (v_dados ?& array[
         'jovens_firmes','jovens_novos','jovens_afastados',
         'presenca_domingo_930','presenca_encontro_fju',
         'batizados_espirito_santo','batizados_aguas','total_jovens_unicos'
       ]) then raise exception 'Os dados da correção estão incompletos.'; end if;
    if exists (select 1 from jsonb_each(v_dados) e
      where jsonb_typeof(e.value) <> 'number'
         or (e.value #>> '{}') !~ '^[0-9]+$'
         or (e.value #>> '{}')::numeric > 2147483647) then
      raise exception 'Todos os indicadores devem ser números inteiros não negativos.';
    end if;
    update public.fju_relatorios_semanais
    set jovens_firmes=(v_dados->>'jovens_firmes')::integer,
        jovens_novos=(v_dados->>'jovens_novos')::integer,
        jovens_afastados=(v_dados->>'jovens_afastados')::integer,
        presenca_domingo_930=(v_dados->>'presenca_domingo_930')::integer,
        presenca_encontro_fju=(v_dados->>'presenca_encontro_fju')::integer,
        batizados_espirito_santo=(v_dados->>'batizados_espirito_santo')::integer,
        batizados_aguas=(v_dados->>'batizados_aguas')::integer,
        total_jovens_unicos=(v_dados->>'total_jovens_unicos')::integer
    where id=v_solicitacao.relatorio_id and polo_id=v_solicitacao.polo_id;
    if not found then raise exception 'Relatório original não encontrado.'; end if;
    update public.fju_relatorio_semanal_edicao_solicitacoes
    set status='concluida',decidido_por=auth.uid(),decidido_em=now(),
        observacao_nacional=nullif(btrim(p_observacao),'')
    where id=p_solicitacao_id;
    return jsonb_build_object('status','concluida','aprovada',true);
  else
    update public.fju_relatorio_semanal_edicao_solicitacoes
    set status='recusada',decidido_por=auth.uid(),decidido_em=now(),
        observacao_nacional=nullif(btrim(p_observacao),'')
    where id=p_solicitacao_id;
    return jsonb_build_object('status','recusada','aprovada',false);
  end if;
end;
$function$;

revoke all on function public.fju_decidir_correcao_relatorio_semanal(uuid,boolean,text) from public;
revoke all on function public.fju_decidir_correcao_relatorio_semanal(uuid,boolean,text) from anon;
grant execute on function public.fju_decidir_correcao_relatorio_semanal(uuid,boolean,text) to authenticated;
