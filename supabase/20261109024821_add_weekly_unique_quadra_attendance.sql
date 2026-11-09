alter table public.fju_relatorios_semanais
  add column if not exists presenca_quadra_unica integer not null default 0
  check (presenca_quadra_unica >= 0);

create or replace function private.fju_decidir_correcao_relatorio_semanal(
  p_solicitacao_id uuid,
  p_aprovar boolean,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
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
       or (select count(*) from jsonb_object_keys(v_dados)) <> 9
       or not (v_dados ?& array[
         'jovens_firmes','jovens_novos','jovens_afastados',
         'presenca_domingo_930','presenca_encontro_fju',
         'batizados_espirito_santo','batizados_aguas','total_jovens_unicos',
         'presenca_quadra_unica'
       ]) then
      raise exception 'Os dados da correção estão incompletos.';
    end if;

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
        total_jovens_unicos=(v_dados->>'total_jovens_unicos')::integer,
        presenca_quadra_unica=(v_dados->>'presenca_quadra_unica')::integer
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
