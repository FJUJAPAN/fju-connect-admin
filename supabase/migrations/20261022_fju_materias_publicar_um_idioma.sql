-- FJU JAPAN | Publicação permitida com pelo menos um idioma completo.
BEGIN;
CREATE OR REPLACE FUNCTION public.fju_salvar_materia(
 p_id uuid,p_categoria text,p_data date,
 p_titulo_pt text,p_titulo_ja text,p_titulo_en text,
 p_texto1_pt text,p_texto1_ja text,p_texto1_en text,
 p_texto2_pt text,p_texto2_ja text,p_texto2_en text,
 p_final_pt text,p_final_ja text,p_final_en text,
 p_foto1 text,p_foto2 text,p_foto3 text,
 p_enviar boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_perfil public.fju_perfis%ROWTYPE;v_atual public.fju_materias%ROWTYPE;v_id uuid;v_status text;
BEGIN
 SELECT * INTO v_perfil FROM public.fju_perfis WHERE usuario_id=auth.uid() AND ativo FOR SHARE;
 IF NOT FOUND OR v_perfil.papel NOT IN ('nacional','coordenador') THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 IF p_categoria IS NULL OR p_categoria NOT IN ('evangelizacao','esporte','cultura','eventos','testemunhos','acoes_sociais','fju_meeting')
 OR p_data IS NULL THEN RAISE EXCEPTION 'Categoria ou data inválida'; END IF;
 IF p_id IS NOT NULL THEN
   SELECT * INTO v_atual FROM public.fju_materias WHERE id=p_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Matéria não encontrada'; END IF;
   IF v_perfil.papel<>'nacional' AND (v_atual.polo_id IS DISTINCT FROM v_perfil.polo_id OR v_atual.autor_id IS DISTINCT FROM auth.uid())
   THEN RAISE EXCEPTION 'Esta matéria não pertence à sua conta e polo'; END IF;
   IF v_atual.status='publicada' AND v_perfil.papel<>'nacional' THEN RAISE EXCEPTION 'Matéria publicada: solicite revisão ao Nacional'; END IF;
 ELSE
   IF v_perfil.polo_id IS NULL THEN RAISE EXCEPTION 'Seu perfil não possui polo vinculado'; END IF;
 END IF;
 IF p_enviar THEN
   IF coalesce(btrim(p_foto1),'')='' OR coalesce(btrim(p_foto2),'')='' OR coalesce(btrim(p_foto3),'')=''
   THEN RAISE EXCEPTION 'Adicione as três fotos antes de enviar'; END IF;
   IF NOT (
     (coalesce(btrim(p_titulo_pt),'')<>'' AND coalesce(btrim(p_texto1_pt),'')<>'' AND coalesce(btrim(p_texto2_pt),'')<>'' AND coalesce(btrim(p_final_pt),'')<>'')
     OR (coalesce(btrim(p_titulo_ja),'')<>'' AND coalesce(btrim(p_texto1_ja),'')<>'' AND coalesce(btrim(p_texto2_ja),'')<>'' AND coalesce(btrim(p_final_ja),'')<>'')
     OR (coalesce(btrim(p_titulo_en),'')<>'' AND coalesce(btrim(p_texto1_en),'')<>'' AND coalesce(btrim(p_texto2_en),'')<>'' AND coalesce(btrim(p_final_en),'')<>'')
   ) THEN RAISE EXCEPTION 'Preencha pelo menos um idioma completo'; END IF;

 END IF;
 v_status:=CASE WHEN NOT p_enviar THEN 'rascunho' WHEN v_perfil.papel='nacional' THEN 'publicada' ELSE 'pendente' END;
 IF p_id IS NULL THEN
   INSERT INTO public.fju_materias(polo_id,autor_id,categoria,data_materia,
    titulo_pt,titulo_ja,titulo_en,texto1_pt,texto1_ja,texto1_en,texto2_pt,texto2_ja,texto2_en,
    final_pt,final_ja,final_en,foto1,foto2,foto3,status,publicado_em)
   VALUES(v_perfil.polo_id,auth.uid(),p_categoria,p_data,
    coalesce(p_titulo_pt,''),coalesce(p_titulo_ja,''),coalesce(p_titulo_en,''),
    coalesce(p_texto1_pt,''),coalesce(p_texto1_ja,''),coalesce(p_texto1_en,''),
    coalesce(p_texto2_pt,''),coalesce(p_texto2_ja,''),coalesce(p_texto2_en,''),
    coalesce(p_final_pt,''),coalesce(p_final_ja,''),coalesce(p_final_en,''),
    p_foto1,p_foto2,p_foto3,v_status,CASE WHEN v_status='publicada' THEN now() END)
   RETURNING id INTO v_id;
 ELSE
   UPDATE public.fju_materias SET categoria=p_categoria,data_materia=p_data,
    titulo_pt=coalesce(p_titulo_pt,''),titulo_ja=coalesce(p_titulo_ja,''),titulo_en=coalesce(p_titulo_en,''),
    texto1_pt=coalesce(p_texto1_pt,''),texto1_ja=coalesce(p_texto1_ja,''),texto1_en=coalesce(p_texto1_en,''),
    texto2_pt=coalesce(p_texto2_pt,''),texto2_ja=coalesce(p_texto2_ja,''),texto2_en=coalesce(p_texto2_en,''),
    final_pt=coalesce(p_final_pt,''),final_ja=coalesce(p_final_ja,''),final_en=coalesce(p_final_en,''),
    foto1=p_foto1,foto2=p_foto2,foto3=p_foto3,status=v_status,
    atualizado_em=now(),publicado_em=CASE WHEN v_status='publicada' THEN coalesce(publicado_em,now()) ELSE NULL END,
    analisado_por=NULL,analisado_em=NULL,motivo_rejeicao=NULL WHERE id=p_id;
   v_id:=p_id;
 END IF;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.fju_decidir_materia(p_id uuid,p_aprovar boolean,p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_m public.fju_materias%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.fju_perfis WHERE usuario_id=auth.uid() AND ativo AND papel='nacional')
 THEN RAISE EXCEPTION 'Somente o Nacional pode aprovar'; END IF;
 IF p_aprovar IS NULL THEN RAISE EXCEPTION 'Informe a decisão'; END IF;
 SELECT * INTO v_m FROM public.fju_materias WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_m.status<>'pendente' THEN RAISE EXCEPTION 'Matéria não está pendente'; END IF;
 IF p_aprovar AND NOT (
  (coalesce(btrim(v_m.titulo_pt),'')<>'' AND coalesce(btrim(v_m.texto1_pt),'')<>'' AND coalesce(btrim(v_m.texto2_pt),'')<>'' AND coalesce(btrim(v_m.final_pt),'')<>'')
  OR (coalesce(btrim(v_m.titulo_ja),'')<>'' AND coalesce(btrim(v_m.texto1_ja),'')<>'' AND coalesce(btrim(v_m.texto2_ja),'')<>'' AND coalesce(btrim(v_m.final_ja),'')<>'')
  OR (coalesce(btrim(v_m.titulo_en),'')<>'' AND coalesce(btrim(v_m.texto1_en),'')<>'' AND coalesce(btrim(v_m.texto2_en),'')<>'' AND coalesce(btrim(v_m.final_en),'')<>'')
 ) THEN RAISE EXCEPTION 'Preencha pelo menos um idioma completo antes de aprovar'; END IF;
 UPDATE public.fju_materias SET status=CASE WHEN p_aprovar THEN 'publicada' ELSE 'rejeitada' END,
 analisado_por=auth.uid(),analisado_em=now(),atualizado_em=now(),
 publicado_em=CASE WHEN p_aprovar THEN now() ELSE NULL END,
 motivo_rejeicao=CASE WHEN p_aprovar THEN NULL ELSE left(coalesce(p_motivo,''),1000) END WHERE id=p_id;
END $$;

COMMIT;
