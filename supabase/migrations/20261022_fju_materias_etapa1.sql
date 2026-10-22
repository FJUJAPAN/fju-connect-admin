-- FJU JAPAN | Matérias FJU - Etapa 1: estrutura e permissões
-- Execute no SQL Editor do Supabase APÓS revisar/mesclar este arquivo.
-- Esta migração não publica matérias nem envia notificações.
BEGIN;

CREATE TABLE IF NOT EXISTS public.fju_materias (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 polo_id uuid NOT NULL REFERENCES public.fju_polos(id),
 autor_id uuid NOT NULL REFERENCES auth.users(id),
 categoria text NOT NULL CHECK (categoria IN ('evangelizacao','esporte','cultura','eventos','testemunhos','acoes_sociais','fju_meeting')),
 data_materia date NOT NULL DEFAULT CURRENT_DATE,
 titulo_pt text NOT NULL DEFAULT '',
 titulo_ja text NOT NULL DEFAULT '',
 titulo_en text NOT NULL DEFAULT '',
 texto1_pt text NOT NULL DEFAULT '',
 texto1_ja text NOT NULL DEFAULT '',
 texto1_en text NOT NULL DEFAULT '',
 texto2_pt text NOT NULL DEFAULT '',
 texto2_ja text NOT NULL DEFAULT '',
 texto2_en text NOT NULL DEFAULT '',
 final_pt text NOT NULL DEFAULT '',
 final_ja text NOT NULL DEFAULT '',
 final_en text NOT NULL DEFAULT '',
 foto1 text, foto2 text, foto3 text,
 status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','pendente','publicada','rejeitada')),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 publicado_em timestamptz,
 analisado_por uuid REFERENCES auth.users(id),
 analisado_em timestamptz,
 motivo_rejeicao text,
 visualizacoes bigint NOT NULL DEFAULT 0 CHECK (visualizacoes>=0),
 CONSTRAINT fju_materia_limites CHECK (
   char_length(titulo_pt)<=180 AND char_length(titulo_ja)<=180 AND char_length(titulo_en)<=180
   AND char_length(texto1_pt)<=10000 AND char_length(texto1_ja)<=10000 AND char_length(texto1_en)<=10000
   AND char_length(texto2_pt)<=10000 AND char_length(texto2_ja)<=10000 AND char_length(texto2_en)<=10000
   AND char_length(final_pt)<=5000 AND char_length(final_ja)<=5000 AND char_length(final_en)<=5000
 )
);
CREATE INDEX IF NOT EXISTS fju_materias_publicadas_idx ON public.fju_materias(publicado_em DESC) WHERE status='publicada';
CREATE INDEX IF NOT EXISTS fju_materias_polo_idx ON public.fju_materias(polo_id,status);
ALTER TABLE public.fju_materias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fju_materias FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.fju_materias TO anon,authenticated;
DROP POLICY IF EXISTS fju_materias_leitura ON public.fju_materias;
CREATE POLICY fju_materias_leitura ON public.fju_materias FOR SELECT TO anon,authenticated
 USING (
   status='publicada'
   OR EXISTS (SELECT 1 FROM public.fju_perfis p WHERE p.usuario_id=(SELECT auth.uid()) AND p.ativo
     AND (p.papel='nacional' OR (p.papel='coordenador' AND p.polo_id=fju_materias.polo_id)))
 );

CREATE TABLE IF NOT EXISTS public.fju_materias_comentarios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 materia_id uuid NOT NULL REFERENCES public.fju_materias(id) ON DELETE CASCADE,
 usuario_id uuid NOT NULL REFERENCES auth.users(id),
 texto text NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 1 AND 1500),
 criado_em timestamptz NOT NULL DEFAULT now(),
 oculto boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS fju_materias_comentarios_idx ON public.fju_materias_comentarios(materia_id,criado_em);
ALTER TABLE public.fju_materias_comentarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fju_materias_comentarios FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.fju_materias_comentarios TO anon,authenticated;
DROP POLICY IF EXISTS fju_comentarios_leitura ON public.fju_materias_comentarios;
CREATE POLICY fju_comentarios_leitura ON public.fju_materias_comentarios FOR SELECT TO anon,authenticated
 USING (NOT oculto AND EXISTS(SELECT 1 FROM public.fju_materias m WHERE m.id=materia_id AND m.status='publicada'));

-- Nenhuma escrita direta pelo navegador: todas as alterações passam por funções autorizadas.
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
   IF coalesce(btrim(p_titulo_pt),'')='' OR coalesce(btrim(p_titulo_ja),'')='' OR coalesce(btrim(p_titulo_en),'')=''
   OR coalesce(btrim(p_texto1_pt),'')='' OR coalesce(btrim(p_texto1_ja),'')='' OR coalesce(btrim(p_texto1_en),'')=''
   OR coalesce(btrim(p_texto2_pt),'')='' OR coalesce(btrim(p_texto2_ja),'')='' OR coalesce(btrim(p_texto2_en),'')=''
   OR coalesce(btrim(p_final_pt),'')='' OR coalesce(btrim(p_final_ja),'')='' OR coalesce(btrim(p_final_en),'')=''
   OR coalesce(btrim(p_foto1),'')='' OR coalesce(btrim(p_foto2),'')='' OR coalesce(btrim(p_foto3),'')=''
   THEN RAISE EXCEPTION 'Preencha os três idiomas e as três fotos antes de enviar'; END IF;
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
 UPDATE public.fju_materias SET status=CASE WHEN p_aprovar THEN 'publicada' ELSE 'rejeitada' END,
 analisado_por=auth.uid(),analisado_em=now(),atualizado_em=now(),
 publicado_em=CASE WHEN p_aprovar THEN now() ELSE NULL END,
 motivo_rejeicao=CASE WHEN p_aprovar THEN NULL ELSE left(coalesce(p_motivo,''),1000) END WHERE id=p_id;
END $$;

CREATE OR REPLACE FUNCTION public.fju_comentar_materia(p_materia_id uuid,p_texto text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para comentar'; END IF;
 IF coalesce(char_length(btrim(p_texto)),0) NOT BETWEEN 1 AND 1500 THEN RAISE EXCEPTION 'Comentário inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fju_materias WHERE id=p_materia_id AND status='publicada')
 THEN RAISE EXCEPTION 'Matéria indisponível'; END IF;
 INSERT INTO public.fju_materias_comentarios(materia_id,usuario_id,texto)
 VALUES(p_materia_id,auth.uid(),btrim(p_texto)) RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.fju_ocultar_comentario(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.fju_perfis WHERE usuario_id=auth.uid() AND ativo AND papel='nacional')
 THEN RAISE EXCEPTION 'Somente o Nacional pode moderar comentários'; END IF;
 UPDATE public.fju_materias_comentarios SET oculto=true WHERE id=p_id;
END $$;

REVOKE ALL ON FUNCTION public.fju_salvar_materia(uuid,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_decidir_materia(uuid,boolean,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_comentar_materia(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_ocultar_comentario(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fju_salvar_materia(uuid,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_decidir_materia(uuid,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_comentar_materia(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_ocultar_comentario(uuid) TO authenticated;
COMMIT;
