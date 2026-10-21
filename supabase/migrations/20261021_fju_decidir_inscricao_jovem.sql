-- FJU JAPAN | Aprovação atômica de inscrição com criação da ficha e vínculo.
-- Execute manualmente no SQL Editor APÓS revisar os campos obrigatórios de fju_jovens.
-- Se qualquer operação falhar, toda a aprovação é revertida.
BEGIN;
CREATE OR REPLACE FUNCTION public.fju_decidir_inscricao_jovem(
 p_inscricao_id uuid,
 p_acao text,
 p_patente text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
 v_papel text;
 v_polo uuid;
 v_inscricao public.fju_inscricoes_jovens%ROWTYPE;
 v_jovem uuid;
 v_patente text;
 v_categoria text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 SELECT papel,polo_id INTO v_papel,v_polo
 FROM public.fju_perfis
 WHERE usuario_id=auth.uid() AND ativo=true;
 IF v_papel IS NULL OR v_papel NOT IN ('nacional','coordenador')
 THEN RAISE EXCEPTION 'Sem autorização para analisar inscrições'; END IF;
 IF p_acao NOT IN ('aprovar','rejeitar') OR p_acao IS NULL
 THEN RAISE EXCEPTION 'Ação inválida'; END IF;
 SELECT * INTO v_inscricao FROM public.fju_inscricoes_jovens
 WHERE id=p_inscricao_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inscrição não encontrada'; END IF;
 IF v_inscricao.status<>'pendente' THEN RAISE EXCEPTION 'Inscrição já analisada'; END IF;
 IF v_papel='coordenador' AND (v_polo IS NULL OR v_polo<>v_inscricao.polo_id)
 THEN RAISE EXCEPTION 'Inscrição de outro polo'; END IF;
 IF p_acao='rejeitar' THEN
   UPDATE public.fju_inscricoes_jovens
   SET status='rejeitado',analisado_por=auth.uid(),analisado_em=now()
   WHERE id=v_inscricao.id;
   RETURN NULL;
 END IF;
 IF p_patente IS NULL OR p_patente NOT IN
 ('Inconstante','Firme','CPO','Colaborador','Obreiro','Coordenador')
 THEN RAISE EXCEPTION 'Selecione uma patente inicial válida'; END IF;
 IF EXISTS(SELECT 1 FROM public.fju_vinculos_conta_jovem WHERE usuario_id=v_inscricao.usuario_id)
 THEN RAISE EXCEPTION 'Esta conta já está vinculada a uma ficha'; END IF;
 -- Evita criar ficha duplicada quando já há uma ficha com mesmo nome no mesmo polo.
 -- Nesses casos, a liderança deve conferir e vincular a ficha existente em fluxo próprio.
 IF EXISTS(
   SELECT 1 FROM public.fju_jovens
   WHERE polo_id=v_inscricao.polo_id
   AND lower(btrim(nome_completo))=lower(btrim(v_inscricao.nome))
 ) THEN RAISE EXCEPTION 'Já existe ficha com esse nome no polo. Confira antes de aprovar'; END IF;
 v_categoria:=CASE WHEN p_patente='Inconstante' THEN 'inconstante' ELSE 'firme' END;
 v_patente:=CASE WHEN p_patente IN ('Inconstante','Firme') THEN NULL ELSE lower(p_patente) END;
 INSERT INTO public.fju_jovens(polo_id,nome_completo,patente,categoria)
 VALUES(v_inscricao.polo_id,v_inscricao.nome,v_patente,v_categoria)
 RETURNING id INTO v_jovem;
 INSERT INTO public.fju_vinculos_conta_jovem(jovem_id,usuario_id,liberado_por,ativo)
 VALUES(v_jovem,v_inscricao.usuario_id,auth.uid(),true);
 UPDATE public.fju_inscricoes_jovens
 SET status='aprovado',analisado_por=auth.uid(),analisado_em=now()
 WHERE id=v_inscricao.id;
 RETURN v_jovem;
END;
$$;
REVOKE ALL ON FUNCTION public.fju_decidir_inscricao_jovem(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fju_decidir_inscricao_jovem(uuid,text,text) TO authenticated;
COMMIT;
