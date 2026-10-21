-- FJU JAPAN: decisão de inscrição com controle por polo e auditoria.
-- Não cria ficha oficial nem modifica patente.
BEGIN;
CREATE OR REPLACE FUNCTION public.fju_decidir_inscricao_jovem(p_inscricao_id uuid,p_decisao text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_papel text;v_polo uuid;v_inscricao public.fju_inscricoes_jovens%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 IF p_decisao NOT IN ('aprovar','rejeitar') OR p_decisao IS NULL THEN RAISE EXCEPTION 'Decisão inválida'; END IF;
 SELECT papel,polo_id INTO v_papel,v_polo FROM public.fju_perfis
 WHERE usuario_id=auth.uid() AND ativo=true;
 IF v_papel IS NULL OR v_papel NOT IN ('nacional','coordenador') THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 SELECT * INTO v_inscricao FROM public.fju_inscricoes_jovens WHERE id=p_inscricao_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inscrição não encontrada'; END IF;
 IF v_papel='coordenador' AND (v_polo IS NULL OR v_polo IS DISTINCT FROM v_inscricao.polo_id)
 THEN RAISE EXCEPTION 'Inscrição fora do seu polo'; END IF;
 IF v_inscricao.status<>'pendente' THEN RAISE EXCEPTION 'Inscrição já analisada'; END IF;
 UPDATE public.fju_inscricoes_jovens SET status=CASE WHEN p_decisao='aprovar' THEN 'aprovado' ELSE 'rejeitado' END,
 analisado_por=auth.uid(),analisado_em=now() WHERE id=p_inscricao_id;
END $$;
REVOKE ALL ON FUNCTION public.fju_decidir_inscricao_jovem(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fju_decidir_inscricao_jovem(uuid,text) TO authenticated;
COMMIT;
