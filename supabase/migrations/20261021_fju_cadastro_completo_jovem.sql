-- FJU JAPAN | Ficha completa de autocadastro e foto privada.
-- Execute no SQL Editor ANTES de liberar os novos formulários.
BEGIN;
ALTER TABLE public.fju_inscricoes_jovens
  ADD COLUMN IF NOT EXISTS nascimento date,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS nacionalidade_iso2 text;

-- Apenas um usuário autenticado pode registrar sua própria inscrição.
-- A foto não é armazenada no Auth nem publicada como URL aberta.
CREATE OR REPLACE FUNCTION public.fju_enviar_inscricao_jovem_detalhada(
 p_polo_id uuid, p_nome text, p_projetos text[],
 p_nascimento date, p_telefone text, p_nacionalidade_iso2 text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid; v_projetos text[]; v_telefone text; v_nacionalidade text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 IF p_polo_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.fju_polos WHERE id=p_polo_id)
 THEN RAISE EXCEPTION 'Polo inválido'; END IF;
 IF char_length(btrim(coalesce(p_nome,''))) NOT BETWEEN 2 AND 120
 THEN RAISE EXCEPTION 'Nome completo inválido'; END IF;
 IF p_nascimento IS NULL OR p_nascimento < DATE '1900-01-01' OR p_nascimento > current_date
 THEN RAISE EXCEPTION 'Data de nascimento inválida'; END IF;
 v_telefone:=btrim(coalesce(p_telefone,''));
 IF char_length(v_telefone) NOT BETWEEN 5 AND 30 THEN RAISE EXCEPTION 'Telefone inválido'; END IF;
 v_nacionalidade:=upper(btrim(coalesce(p_nacionalidade_iso2,'')));
 IF v_nacionalidade !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'Nacionalidade inválida'; END IF;
 v_projetos:=coalesce(p_projetos,'{}'::text[]);
 IF cardinality(v_projetos)>4 OR array_position(v_projetos,NULL) IS NOT NULL
   OR EXISTS(SELECT 1 FROM unnest(v_projetos) AS x WHERE x NOT IN ('Esporte','Cultura','Mídia','Banda'))
   OR (SELECT count(DISTINCT x) FROM unnest(v_projetos) AS x)<>cardinality(v_projetos)
 THEN RAISE EXCEPTION 'Escolha somente Esporte, Cultura, Mídia e Banda'; END IF;
 IF EXISTS(SELECT 1 FROM public.fju_inscricoes_jovens WHERE usuario_id=auth.uid())
 THEN RAISE EXCEPTION 'Inscrição já enviada'; END IF;
 IF EXISTS(SELECT 1 FROM public.fju_vinculos_conta_jovem WHERE usuario_id=auth.uid())
 THEN RAISE EXCEPTION 'Conta já vinculada à ficha'; END IF;
 INSERT INTO public.fju_inscricoes_jovens
 (usuario_id,polo_id,nome,projetos_solicitados,nascimento,telefone,nacionalidade_iso2)
 VALUES(auth.uid(),p_polo_id,btrim(p_nome),v_projetos,p_nascimento,v_telefone,v_nacionalidade)
 RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fju_enviar_inscricao_jovem_detalhada(uuid,text,text[],date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fju_enviar_inscricao_jovem_detalhada(uuid,text,text[],date,text,text) TO authenticated;

-- Consulta de dados pessoais exclusiva da liderança do polo/nacional.
CREATE OR REPLACE FUNCTION public.fju_listar_inscricoes_polo_detalhadas()
RETURNS TABLE (
 id uuid,usuario_id uuid,polo_id uuid,nome text,
 projetos_solicitados text[],criado_em timestamptz,
 nascimento date,telefone text,nacionalidade_iso2 text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_papel text; v_polo uuid;
BEGIN
 SELECT p.papel,p.polo_id INTO v_papel,v_polo
 FROM public.fju_perfis p WHERE p.usuario_id=auth.uid() AND p.ativo;
 IF v_papel IS NULL OR v_papel NOT IN ('nacional','coordenador')
 THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 RETURN QUERY
 SELECT i.id,i.usuario_id,i.polo_id,i.nome,i.projetos_solicitados,i.criado_em,
        i.nascimento,i.telefone,i.nacionalidade_iso2
 FROM public.fju_inscricoes_jovens i
 WHERE i.status='pendente' AND
       (v_papel='nacional' OR (v_polo IS NOT NULL AND i.polo_id=v_polo))
 ORDER BY i.criado_em;
END;
$$;
REVOKE ALL ON FUNCTION public.fju_listar_inscricoes_polo_detalhadas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fju_listar_inscricoes_polo_detalhadas() TO authenticated;

-- Patente só é definida pelo coordenador/nacional, nunca pelo jovem.
CREATE OR REPLACE FUNCTION public.fju_decidir_inscricao_jovem(
 p_inscricao_id uuid, p_acao text, p_patente text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
 v_papel text; v_polo uuid; v_inscricao public.fju_inscricoes_jovens%ROWTYPE;
 v_jovem uuid; v_patente text; v_categoria text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 SELECT papel,polo_id INTO v_papel,v_polo FROM public.fju_perfis
 WHERE usuario_id=auth.uid() AND ativo=true;
 IF v_papel IS NULL OR v_papel NOT IN ('nacional','coordenador')
 THEN RAISE EXCEPTION 'Sem autorização para analisar inscrições'; END IF;
 IF p_acao IS NULL OR p_acao NOT IN ('aprovar','rejeitar')
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
 IF EXISTS(SELECT 1 FROM public.fju_vinculos_conta_jovem
           WHERE usuario_id=v_inscricao.usuario_id)
 THEN RAISE EXCEPTION 'Conta já vinculada a uma ficha'; END IF;
 IF EXISTS(
  SELECT 1 FROM public.fju_jovens
  WHERE polo_id=v_inscricao.polo_id
  AND lower(btrim(nome_completo))=lower(btrim(v_inscricao.nome))
 ) THEN RAISE EXCEPTION 'Já existe ficha com esse nome no polo. Confira antes de aprovar'; END IF;
 v_categoria:=CASE WHEN p_patente='Inconstante' THEN 'inconstante' ELSE 'firme' END;
 v_patente:=CASE WHEN p_patente IN ('Inconstante','Firme') THEN NULL ELSE lower(p_patente) END;
 INSERT INTO public.fju_jovens
  (polo_id,nome_completo,nascimento,telefone,nacionalidade_iso2,patente,categoria)
 VALUES
  (v_inscricao.polo_id,v_inscricao.nome,v_inscricao.nascimento,
   v_inscricao.telefone,v_inscricao.nacionalidade_iso2,v_patente,v_categoria)
 RETURNING id INTO v_jovem;
 INSERT INTO public.fju_vinculos_conta_jovem(jovem_id,usuario_id,liberado_por,ativo)
 VALUES(v_jovem,v_inscricao.usuario_id,auth.uid(),true);
 UPDATE public.fju_inscricoes_jovens
 SET status='aprovado',analisado_por=auth.uid(),analisado_em=now()
 WHERE id=v_inscricao.id;
 RETURN v_jovem;
END;
$$;
REVOKE ALL ON FUNCTION public.fju_decidir_inscricao_jovem(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fju_decidir_inscricao_jovem(uuid,text,text) TO authenticated;

-- A leitura da foto pela liderança passa por função com verificação de polo.
CREATE OR REPLACE FUNCTION public.fju_pode_ler_foto_inscricao(p_usuario_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT p_usuario_id=auth.uid() OR EXISTS(
  SELECT 1 FROM public.fju_inscricoes_jovens i
  JOIN public.fju_perfis p ON p.usuario_id=auth.uid() AND p.ativo
  WHERE i.usuario_id=p_usuario_id
    AND (p.papel='nacional' OR (p.papel='coordenador' AND p.polo_id=i.polo_id))
 );
$$;
REVOKE ALL ON FUNCTION public.fju_pode_ler_foto_inscricao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fju_pode_ler_foto_inscricao(uuid) TO authenticated;

-- Bucket privado de foto inicial (até 300 KB e somente JPEG).
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('fju-inscricoes-fotos','fju-inscricoes-fotos',false,307200,ARRAY['image/jpeg'])
ON CONFLICT(id) DO UPDATE SET
  public=false,file_size_limit=307200,allowed_mime_types=ARRAY['image/jpeg'];

DROP POLICY IF EXISTS fju_inscricoes_fotos_upload ON storage.objects;
CREATE POLICY fju_inscricoes_fotos_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
 bucket_id='fju-inscricoes-fotos'
 AND name=(SELECT auth.uid())::text||'/perfil.jpg'
);
DROP POLICY IF EXISTS fju_inscricoes_fotos_update ON storage.objects;
CREATE POLICY fju_inscricoes_fotos_update ON storage.objects
FOR UPDATE TO authenticated
USING (
 bucket_id='fju-inscricoes-fotos'
 AND name=(SELECT auth.uid())::text||'/perfil.jpg'
)
WITH CHECK (
 bucket_id='fju-inscricoes-fotos'
 AND name=(SELECT auth.uid())::text||'/perfil.jpg'
);
DROP POLICY IF EXISTS fju_inscricoes_fotos_read ON storage.objects;
CREATE POLICY fju_inscricoes_fotos_read ON storage.objects
FOR SELECT TO authenticated
USING (
 bucket_id='fju-inscricoes-fotos'
 AND CASE
  WHEN name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/perfil[.]jpg
  THEN public.fju_pode_ler_foto_inscricao(split_part(name,'/',1)::uuid)
  ELSE false
 END
);
COMMIT;

  THEN public.fju_pode_ler_foto_inscricao(split_part(name,'/',1)::uuid)
  ELSE false
 END
);
COMMIT;
