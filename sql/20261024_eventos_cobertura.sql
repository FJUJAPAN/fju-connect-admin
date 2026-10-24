-- FJU JAPAN | Eventos futuros e cobertura com aprovação nacional.
-- Aplicar antes de mesclar o editor. Transação única; preserva publicações existentes.
BEGIN;
ALTER TABLE public.fju_materias ADD COLUMN IF NOT EXISTS foto4 text,
 ADD COLUMN IF NOT EXISTS foto5 text, ADD COLUMN IF NOT EXISTS foto6 text,
 ADD COLUMN IF NOT EXISTS cobertura_de uuid REFERENCES public.fju_materias(id);
CREATE UNIQUE INDEX IF NOT EXISTS fju_uma_cobertura ON public.fju_materias(cobertura_de) WHERE cobertura_de IS NOT NULL;
ALTER TABLE public.fju_materias DROP CONSTRAINT IF EXISTS fju_materias_categoria_check;
ALTER TABLE public.fju_materias ADD CONSTRAINT fju_materias_categoria_check CHECK
 (categoria IN ('evangelizacao','esporte','cultura','eventos','testemunhos','acoes_sociais','fju_meeting','help','danca','especial'));

CREATE OR REPLACE FUNCTION public.fju_salvar_evento_materia(p_id uuid,p_dados jsonb,p_enviar boolean DEFAULT false,p_origem uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.fju_perfis%ROWTYPE; v public.fju_materias%ROWTYPE; antigo public.fju_materias%ROWTYPE;
 origem public.fju_materias%ROWTYPE; hoje date := (now() AT TIME ZONE 'Asia/Tokyo')::date; foto text; idioma text; completo boolean:=false;
BEGIN
 SELECT * INTO p FROM public.fju_perfis WHERE usuario_id=auth.uid() AND ativo FOR SHARE;
 IF NOT FOUND OR p.papel NOT IN ('nacional','coordenador') THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 IF p_enviar IS NULL OR jsonb_typeof(p_dados) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Dados inválidos'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO antigo FROM public.fju_materias WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matéria não encontrada'; END IF;
  IF p.papel<>'nacional' AND (antigo.autor_id IS DISTINCT FROM auth.uid() OR antigo.polo_id IS DISTINCT FROM p.polo_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF antigo.status='publicada' THEN RAISE EXCEPTION 'Abra uma cobertura para este evento publicado'; END IF;
  v:=antigo;
 ELSE
  v.id:=gen_random_uuid(); v.polo_id:=p.polo_id; v.autor_id:=auth.uid(); v.criado_em:=now(); v.visualizacoes:=0;
 END IF;
 IF p_origem IS NOT NULL OR antigo.cobertura_de IS NOT NULL THEN
  SELECT * INTO origem FROM public.fju_materias WHERE id=coalesce(antigo.cobertura_de,p_origem) FOR UPDATE;
  IF NOT FOUND OR origem.status<>'publicada' OR origem.secao_publicacao<>'proximos_eventos' OR origem.data_materia>=hoje THEN RAISE EXCEPTION 'O evento ainda não está disponível para cobertura'; END IF;
  IF p.papel<>'nacional' AND (origem.autor_id IS DISTINCT FROM auth.uid() OR origem.polo_id IS DISTINCT FROM p.polo_id) THEN RAISE EXCEPTION 'Sem permissão para este evento'; END IF;
  v.cobertura_de:=origem.id; v.polo_id:=origem.polo_id;
 END IF;
 -- Somente os campos editoriais são aceitos; identidade e status nunca vêm do cliente.
 v.categoria:=p_dados->>'categoria'; v.data_materia:=(p_dados->>'data_materia')::date;
 v.secao_publicacao:=p_dados->>'secao_publicacao';
 IF v.cobertura_de IS NOT NULL THEN v.secao_publicacao:='eventos_realizados'; v.data_materia:=origem.data_materia; END IF;
 IF v.polo_id IS NULL OR v.data_materia IS NULL OR v.secao_publicacao IS NULL OR v.secao_publicacao NOT IN ('proximos_eventos','eventos_realizados') THEN RAISE EXCEPTION 'Escolha tipo, data e polo'; END IF;
 IF v.secao_publicacao='proximos_eventos' AND v.data_materia<hoje THEN RAISE EXCEPTION 'Escolha uma data de hoje em diante'; END IF;
 IF v.secao_publicacao='eventos_realizados' AND v.data_materia>hoje THEN RAISE EXCEPTION 'Evento realizado não pode ter data futura'; END IF;
 v.titulo_pt:=coalesce(p_dados->>'titulo_pt','');
 v.texto1_pt:=coalesce(p_dados->>'texto1_pt','');
 v.texto2_pt:=coalesce(p_dados->>'texto2_pt','');
 v.final_pt:=coalesce(p_dados->>'final_pt','');
 v.titulo_ja:=coalesce(p_dados->>'titulo_ja','');
 v.texto1_ja:=coalesce(p_dados->>'texto1_ja','');
 v.texto2_ja:=coalesce(p_dados->>'texto2_ja','');
 v.final_ja:=coalesce(p_dados->>'final_ja','');
 v.titulo_en:=coalesce(p_dados->>'titulo_en','');
 v.texto1_en:=coalesce(p_dados->>'texto1_en','');
 v.texto2_en:=coalesce(p_dados->>'texto2_en','');
 v.final_en:=coalesce(p_dados->>'final_en','');
 v.foto1:=nullif(p_dados->>'foto1','');
 v.foto2:=nullif(p_dados->>'foto2','');
 v.foto3:=nullif(p_dados->>'foto3','');
 v.foto4:=nullif(p_dados->>'foto4','');
 v.foto5:=nullif(p_dados->>'foto5','');
 v.foto6:=nullif(p_dados->>'foto6','');
 IF v.secao_publicacao='proximos_eventos' AND coalesce(v.foto2,v.foto3,v.foto4,v.foto5,v.foto6) IS NOT NULL THEN RAISE EXCEPTION 'Evento futuro aceita somente uma foto'; END IF;
 FOREACH foto IN ARRAY ARRAY[v.foto1,v.foto2,v.foto3,v.foto4,v.foto5,v.foto6] LOOP
  IF foto IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='fju-materias' AND o.name=foto
   AND (split_part(o.name,'/',1)=auth.uid()::text OR p.papel='nacional' OR foto=ANY(ARRAY[antigo.foto1,antigo.foto2,antigo.foto3,antigo.foto4,antigo.foto5,antigo.foto6,origem.foto1]))) THEN RAISE EXCEPTION 'Foto não disponível para esta matéria'; END IF;
 END LOOP;
 FOREACH idioma IN ARRAY ARRAY['pt','ja','en'] LOOP
  IF btrim(coalesce(p_dados->>('titulo_'||idioma),''))<>'' AND btrim(coalesce(p_dados->>('texto1_'||idioma),''))<>'' THEN completo:=true; END IF;
 END LOOP;
 IF p_enviar AND (NOT completo OR v.foto1 IS NULL) THEN RAISE EXCEPTION 'Preencha título, texto e foto de capa em pelo menos um idioma'; END IF;
 v.status:=CASE WHEN p_enviar THEN 'pendente' ELSE 'rascunho' END;
 v.atualizado_em:=now(); v.publicado_em:=NULL; v.analisado_por:=NULL; v.analisado_em:=NULL; v.motivo_rejeicao:=NULL;
 IF p_id IS NULL THEN
  INSERT INTO public.fju_materias SELECT v.*;
 ELSE
  UPDATE public.fju_materias SET
categoria=v.categoria,
 data_materia=v.data_materia,
 secao_publicacao=v.secao_publicacao,
 titulo_pt=v.titulo_pt,
 texto1_pt=v.texto1_pt,
 texto2_pt=v.texto2_pt,
 final_pt=v.final_pt,
 titulo_ja=v.titulo_ja,
 texto1_ja=v.texto1_ja,
 texto2_ja=v.texto2_ja,
 final_ja=v.final_ja,
 titulo_en=v.titulo_en,
 texto1_en=v.texto1_en,
 texto2_en=v.texto2_en,
 final_en=v.final_en,
 foto1=v.foto1,
 foto2=v.foto2,
 foto3=v.foto3,
 foto4=v.foto4,
 foto5=v.foto5,
 foto6=v.foto6, cobertura_de=v.cobertura_de,status=v.status,atualizado_em=v.atualizado_em,analisado_por=NULL,analisado_em=NULL,motivo_rejeicao=NULL WHERE id=v.id;
 END IF;
 RETURN v.id;
END $$;

CREATE OR REPLACE FUNCTION public.fju_decidir_evento_materia(p_id uuid,p_aprovar boolean,p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.fju_materias%ROWTYPE; origem public.fju_materias%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.fju_perfis WHERE usuario_id=auth.uid() AND ativo AND papel='nacional') THEN RAISE EXCEPTION 'Somente o Nacional pode aprovar'; END IF;
 IF p_aprovar IS NULL THEN RAISE EXCEPTION 'Informe a decisão'; END IF;
 SELECT * INTO v FROM public.fju_materias WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v.status<>'pendente' THEN RAISE EXCEPTION 'Solicitação não está pendente'; END IF;
 IF p_aprovar AND (v.foto1 IS NULL OR NOT (
(btrim(v.titulo_pt)<>'' AND btrim(v.texto1_pt)<>'') OR (btrim(v.titulo_ja)<>'' AND btrim(v.texto1_ja)<>'') OR (btrim(v.titulo_en)<>'' AND btrim(v.texto1_en)<>''))) THEN RAISE EXCEPTION 'Título, texto e capa obrigatórios'; END IF;
 IF p_aprovar AND v.cobertura_de IS NOT NULL THEN
  SELECT * INTO origem FROM public.fju_materias WHERE id=v.cobertura_de FOR UPDATE;
  IF NOT FOUND OR origem.status<>'publicada' OR origem.secao_publicacao<>'proximos_eventos' OR origem.data_materia >= (now() AT TIME ZONE 'Asia/Tokyo')::date THEN RAISE EXCEPTION 'Evento de origem não está disponível'; END IF;
  UPDATE public.fju_materias SET
categoria=v.categoria,
 data_materia=v.data_materia,
 secao_publicacao=v.secao_publicacao,
 titulo_pt=v.titulo_pt,
 texto1_pt=v.texto1_pt,
 texto2_pt=v.texto2_pt,
 final_pt=v.final_pt,
 titulo_ja=v.titulo_ja,
 texto1_ja=v.texto1_ja,
 texto2_ja=v.texto2_ja,
 final_ja=v.final_ja,
 titulo_en=v.titulo_en,
 texto1_en=v.texto1_en,
 texto2_en=v.texto2_en,
 final_en=v.final_en,
 foto1=v.foto1,
 foto2=v.foto2,
 foto3=v.foto3,
 foto4=v.foto4,
 foto5=v.foto5,
 foto6=v.foto6,analisado_por=auth.uid(),analisado_em=now(),atualizado_em=now(),publicado_em=now(),motivo_rejeicao=NULL WHERE id=origem.id;
  DELETE FROM public.fju_materias WHERE id=v.id;
 ELSE
  UPDATE public.fju_materias SET status=CASE WHEN p_aprovar THEN 'publicada' ELSE 'rejeitada' END,
   analisado_por=auth.uid(),analisado_em=now(),atualizado_em=now(),publicado_em=CASE WHEN p_aprovar THEN now() ELSE NULL END,
   motivo_rejeicao=CASE WHEN p_aprovar THEN NULL ELSE left(coalesce(p_motivo,''),1000) END WHERE id=v.id;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.fju_salvar_evento_materia(uuid,jsonb,boolean,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_decidir_evento_materia(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fju_salvar_evento_materia(uuid,jsonb,boolean,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_decidir_evento_materia(uuid,boolean,text) TO authenticated;
DROP POLICY IF EXISTS fju_materias_fotos_publicadas_leitura ON storage.objects;
CREATE POLICY fju_materias_fotos_publicadas_leitura ON storage.objects FOR SELECT TO anon,authenticated
 USING(bucket_id='fju-materias' AND EXISTS(SELECT 1 FROM public.fju_materias m WHERE m.status='publicada' AND name=ANY(ARRAY[m.foto1,m.foto2,m.foto3,m.foto4,m.foto5,m.foto6])));
-- O painel principal antigo usa este nome; encaminha para a mesma aprovação segura.
CREATE OR REPLACE FUNCTION public.fju_decidir_materia(p_id uuid,p_aprovar boolean,p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.fju_decidir_evento_materia(p_id,p_aprovar,p_motivo);
END $$;
REVOKE ALL ON FUNCTION public.fju_decidir_materia(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fju_decidir_materia(uuid,boolean,text) TO authenticated;
COMMIT;
