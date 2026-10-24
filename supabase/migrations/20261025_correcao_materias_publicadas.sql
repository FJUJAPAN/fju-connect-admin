BEGIN;
CREATE TABLE IF NOT EXISTS public.fju_materias_revisoes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),materia_id uuid NOT NULL REFERENCES public.fju_materias(id) ON DELETE CASCADE,solicitante_id uuid NOT NULL REFERENCES auth.users(id),dados jsonb NOT NULL,status text NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','aprovada','rejeitada')),motivo text,criado_em timestamptz NOT NULL DEFAULT now(),analisado_em timestamptz,analisado_por uuid REFERENCES auth.users(id));
CREATE UNIQUE INDEX IF NOT EXISTS fju_revisao_unica_pendente ON public.fju_materias_revisoes(materia_id) WHERE status='pendente';
ALTER TABLE public.fju_materias_revisoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fju_materias_revisoes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.fju_materias_revisoes TO authenticated;
DROP POLICY IF EXISTS fju_revisoes_ver ON public.fju_materias_revisoes;
CREATE POLICY fju_revisoes_ver ON public.fju_materias_revisoes FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.fju_perfis p JOIN public.fju_materias m ON m.id=materia_id WHERE p.usuario_id=auth.uid() AND p.ativo AND (p.papel='nacional' OR (p.papel='coordenador' AND p.polo_id=m.polo_id AND m.autor_id=auth.uid()))));
CREATE OR REPLACE FUNCTION public.fju_solicitar_correcao_materia(p_materia uuid,p_dados jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.fju_materias%ROWTYPE;p public.fju_perfis%ROWTYPE;k text;v_id uuid;
BEGIN
SELECT * INTO p FROM public.fju_perfis WHERE usuario_id=auth.uid() AND ativo;
SELECT * INTO m FROM public.fju_materias WHERE id=p_materia AND status='publicada';
IF NOT FOUND THEN RAISE EXCEPTION 'Matéria publicada não encontrada';END IF;
IF p.papel NOT IN ('nacional','coordenador') OR (p.papel='coordenador' AND (m.polo_id IS DISTINCT FROM p.polo_id OR m.autor_id IS DISTINCT FROM auth.uid())) THEN RAISE EXCEPTION 'Sem permissão';END IF;
IF jsonb_typeof(p_dados)<>'object' THEN RAISE EXCEPTION 'Dados inválidos';END IF;
FOR k IN SELECT jsonb_object_keys(p_dados) LOOP
IF k NOT IN ('categoria','data_materia','secao_publicacao','titulo_pt','titulo_ja','titulo_en','texto1_pt','texto1_ja','texto1_en','texto2_pt','texto2_ja','texto2_en','final_pt','final_ja','final_en','foto1','foto2','foto3','foto4','foto5','foto6') THEN RAISE EXCEPTION 'Campo não permitido';END IF;
END LOOP;
IF nullif(p_dados->>'foto1','') IS NULL OR NOT ((btrim(coalesce(p_dados->>'titulo_pt',''))<>'' AND btrim(coalesce(p_dados->>'texto1_pt',''))<>'') OR (btrim(coalesce(p_dados->>'titulo_ja',''))<>'' AND btrim(coalesce(p_dados->>'texto1_ja',''))<>'') OR (btrim(coalesce(p_dados->>'titulo_en',''))<>'' AND btrim(coalesce(p_dados->>'texto1_en',''))<>'')) THEN RAISE EXCEPTION 'Título, texto e capa obrigatórios';END IF;
IF EXISTS(SELECT 1 FROM public.fju_materias_revisoes WHERE materia_id=p_materia AND status='pendente') THEN RAISE EXCEPTION 'Já existe correção pendente';END IF;
INSERT INTO public.fju_materias_revisoes(materia_id,solicitante_id,dados) VALUES(p_materia,auth.uid(),p_dados) RETURNING id INTO v_id;RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.fju_decidir_correcao_materia(p_revisao uuid,p_aprovar boolean,p_motivo text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.fju_materias_revisoes%ROWTYPE;m public.fju_materias%ROWTYPE;k text;v text;
BEGIN
IF NOT EXISTS(SELECT 1 FROM public.fju_perfis WHERE usuario_id=auth.uid() AND ativo AND papel='nacional') THEN RAISE EXCEPTION 'Somente Nacional';END IF;
SELECT * INTO r FROM public.fju_materias_revisoes WHERE id=p_revisao FOR UPDATE;
IF NOT FOUND OR r.status<>'pendente' THEN RAISE EXCEPTION 'Revisão não pendente';END IF;
SELECT * INTO m FROM public.fju_materias WHERE id=r.materia_id FOR UPDATE;
IF m.status<>'publicada' THEN RAISE EXCEPTION 'Original não publicado';END IF;
IF p_aprovar THEN
FOR k,v IN SELECT key,value FROM jsonb_each_text(r.dados) LOOP
IF k LIKE 'foto%' AND nullif(v,'') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='fju-materias' AND o.name=v AND (split_part(o.name,'/',1)=r.solicitante_id::text OR v=ANY(ARRAY[m.foto1,m.foto2,m.foto3,m.foto4,m.foto5,m.foto6]))) THEN RAISE EXCEPTION 'Foto não autorizada';END IF;
END LOOP;
UPDATE public.fju_materias SET categoria=r.dados->>'categoria',data_materia=(r.dados->>'data_materia')::date,secao_publicacao=r.dados->>'secao_publicacao',titulo_pt=r.dados->>'titulo_pt',titulo_ja=r.dados->>'titulo_ja',titulo_en=r.dados->>'titulo_en',texto1_pt=r.dados->>'texto1_pt',texto1_ja=r.dados->>'texto1_ja',texto1_en=r.dados->>'texto1_en',texto2_pt=r.dados->>'texto2_pt',texto2_ja=r.dados->>'texto2_ja',texto2_en=r.dados->>'texto2_en',final_pt=r.dados->>'final_pt',final_ja=r.dados->>'final_ja',final_en=r.dados->>'final_en',foto1=nullif(r.dados->>'foto1',''),foto2=nullif(r.dados->>'foto2',''),foto3=nullif(r.dados->>'foto3',''),foto4=nullif(r.dados->>'foto4',''),foto5=nullif(r.dados->>'foto5',''),foto6=nullif(r.dados->>'foto6',''),atualizado_em=now() WHERE id=r.materia_id;
END IF;
UPDATE public.fju_materias_revisoes SET status=CASE WHEN p_aprovar THEN 'aprovada' ELSE 'rejeitada' END,motivo=CASE WHEN p_aprovar THEN NULL ELSE left(coalesce(p_motivo,''),1000) END,analisado_por=auth.uid(),analisado_em=now() WHERE id=p_revisao;
END $$;
REVOKE ALL ON FUNCTION public.fju_solicitar_correcao_materia(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_decidir_correcao_materia(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fju_solicitar_correcao_materia(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_decidir_correcao_materia(uuid,boolean,text) TO authenticated;
COMMIT;