create or replace function public.fju_salvar_patente_complementos(p_jovem_id uuid,p_patente text,p_dados jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare perfil record; jovem record; nova text; antiga text; pendente boolean:=false;
begin
 if auth.uid() is null then raise exception 'Login necessário'; end if;
 select papel,polo_id into perfil from public.fju_perfis where usuario_id=auth.uid() and ativo=true;
 if not found or perfil.papel not in ('nacional','coordenador') then raise exception 'Sem autorização'; end if;
 select * into jovem from public.fju_jovens where id=p_jovem_id and excluido_em is null;
 if not found then raise exception 'Ficha não encontrada'; end if;
 if perfil.papel='coordenador' and jovem.polo_id is distinct from perfil.polo_id then raise exception 'Jovem fora da sua igreja'; end if;
 nova:=lower(trim(translate(coalesce(p_patente,''),'áãâéêíóôõúç','aaaeeiooouc')));
 if nova='inconstante' then nova:='normal'; end if;
 if nova not in ('normal','eventual','firme','voluntario','cpo','colaborador','obreiro','coordenador') then raise exception 'Patente inválida'; end if;
 antiga:=coalesce(nullif(lower(trim(jovem.patente)),''),case when jovem.categoria='inconstante' then 'normal' else 'firme' end);
 if antiga is distinct from nova then
  if perfil.papel='nacional' then
   update public.fju_jovens set patente=nova,categoria=case when nova in ('normal','eventual') then 'inconstante' else 'firme' end where id=p_jovem_id;
  elsif antiga in ('cpo','colaborador','obreiro','coordenador') or nova in ('cpo','colaborador','obreiro','coordenador') then
   raise exception 'Esta mudança exige aprovação nacional. Envie a alteração pelo botão principal da ficha antes de salvar os complementos.';
  else
   perform public.fju_alterar_patente_local(p_jovem_id,nova);
  end if;
 end if;
 if perfil.papel='nacional' then
  perform public.fju_salvar_ficha_complementar_nacional(p_jovem_id,p_dados);
 else
  perform public.fju_solicitar_ficha_complementar(p_jovem_id,p_dados);
 end if;
 return jsonb_build_object('patente',nova,'complementos_pendentes',perfil.papel='coordenador');
end; $$;
revoke all on function public.fju_salvar_patente_complementos(uuid,text,jsonb) from public,anon;
grant execute on function public.fju_salvar_patente_complementos(uuid,text,jsonb) to authenticated;