-- FJU JAPAN: exclusão segura somente de rascunhos.
CREATE OR REPLACE FUNCTION public.fju_excluir_rascunho(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_perfil public.fju_perfis%ROWTYPE;
BEGIN
 SELECT * INTO v_perfil FROM public.fju_perfis
 WHERE usuario_id=auth.uid() AND ativo=true AND papel IN ('nacional','coordenador');
 IF NOT FOUND THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 DELETE FROM public.fju_materias m
 WHERE m.id=p_id AND m.status='rascunho'
 AND (v_perfil.papel='nacional' OR
      (m.autor_id=auth.uid() AND m.polo_id=v_perfil.polo_id));
 IF NOT FOUND THEN RAISE EXCEPTION 'Rascunho não encontrado ou sem permissão para excluir'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.fju_excluir_rascunho(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fju_excluir_rascunho(uuid) TO authenticated;
