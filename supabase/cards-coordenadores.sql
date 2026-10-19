-- FJU Connect JAPAN | Cards dos coordenadores
-- Migração planejada: executar no Supabase SQL Editor antes de publicar o PR.
-- Não altera fju_perfis, fju_jovens, fotos dos jovens ou patentes.
-- Usa public.fju_usuario_e_nacional() já existente.

BEGIN;

CREATE TABLE IF NOT EXISTS public.fju_coordenador_cards (
  usuario_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_exibicao text NOT NULL
    CHECK (char_length(btrim(nome_exibicao)) BETWEEN 2 AND 100),
  foto_path text
    CHECK (foto_path IS NULL OR foto_path = usuario_id::text || '/perfil.jpg'),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fju_coordenador_cards ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.fju_coordenador_cards TO authenticated;
REVOKE DELETE ON public.fju_coordenador_cards FROM authenticated, anon;

DROP POLICY IF EXISTS fju_cards_leitura ON public.fju_coordenador_cards;
CREATE POLICY fju_cards_leitura
ON public.fju_coordenador_cards
FOR SELECT TO authenticated
USING (
  public.fju_usuario_e_nacional()
  OR (
    usuario_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.fju_perfis p
      WHERE p.usuario_id = (SELECT auth.uid())
        AND p.ativo AND p.papel = 'coordenador'
    )
  )
);

DROP POLICY IF EXISTS fju_cards_criacao_propria ON public.fju_coordenador_cards;
CREATE POLICY fju_cards_criacao_propria
ON public.fju_coordenador_cards
FOR INSERT TO authenticated
WITH CHECK (
  usuario_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.fju_perfis p
    WHERE p.usuario_id = (SELECT auth.uid())
      AND p.ativo AND p.papel = 'coordenador'
  )
);

DROP POLICY IF EXISTS fju_cards_edicao_propria ON public.fju_coordenador_cards;
CREATE POLICY fju_cards_edicao_propria
ON public.fju_coordenador_cards
FOR UPDATE TO authenticated
USING (
  usuario_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.fju_perfis p
    WHERE p.usuario_id = (SELECT auth.uid())
      AND p.ativo AND p.papel = 'coordenador'
  )
)
WITH CHECK (
  usuario_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.fju_perfis p
    WHERE p.usuario_id = (SELECT auth.uid())
      AND p.ativo AND p.papel = 'coordenador'
  )
);

CREATE OR REPLACE FUNCTION public.fju_cards_atualizar_data()
RETURNS trigger LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fju_cards_data ON public.fju_coordenador_cards;
CREATE TRIGGER fju_cards_data
BEFORE UPDATE ON public.fju_coordenador_cards
FOR EACH ROW EXECUTE FUNCTION public.fju_cards_atualizar_data();

-- Diretório acessível somente ao Nacional. Inclui coordenadores
-- ainda sem perfil preenchido, usando o polo real de fju_perfis.
CREATE OR REPLACE FUNCTION public.fju_listar_cards_coordenadores()
RETURNS TABLE(
  usuario_id uuid,
  nome_exibicao text,
  foto_path text,
  polo_nome text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.usuario_id,c.nome_exibicao,c.foto_path,pol.nome
  FROM public.fju_perfis p
  LEFT JOIN public.fju_coordenador_cards c ON c.usuario_id=p.usuario_id
  LEFT JOIN public.fju_polos pol ON pol.id=p.polo_id
  WHERE p.ativo AND p.papel='coordenador'
    AND public.fju_usuario_e_nacional()
  ORDER BY pol.nome NULLS LAST,c.nome_exibicao NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.fju_listar_cards_coordenadores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fju_listar_cards_coordenadores() TO authenticated;

-- Fotos em bucket PRIVADO; cada coordenador escreve só a própria
-- imagem; o Nacional pode ler as fotos dos cards autorizados.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('fju-coordenadores','fju-coordenadores',false,200000,ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS fju_coord_foto_ler ON storage.objects;
CREATE POLICY fju_coord_foto_ler
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='fju-coordenadores'
  AND (
    public.fju_usuario_e_nacional()
    OR (
      name = (SELECT auth.uid())::text || '/perfil.jpg'
      AND EXISTS(
        SELECT 1 FROM public.fju_perfis p
        WHERE p.usuario_id=(SELECT auth.uid()) AND p.ativo AND p.papel='coordenador'
      )
    )
  )
);

DROP POLICY IF EXISTS fju_coord_foto_criar ON storage.objects;
CREATE POLICY fju_coord_foto_criar
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='fju-coordenadores'
  AND name = (SELECT auth.uid())::text || '/perfil.jpg'
  AND EXISTS (
    SELECT 1 FROM public.fju_perfis p
    WHERE p.usuario_id=(SELECT auth.uid()) AND p.ativo AND p.papel='coordenador'
  )
);

DROP POLICY IF EXISTS fju_coord_foto_editar ON storage.objects;
CREATE POLICY fju_coord_foto_editar
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id='fju-coordenadores'
  AND name = (SELECT auth.uid())::text || '/perfil.jpg'
  AND EXISTS (
    SELECT 1 FROM public.fju_perfis p
    WHERE p.usuario_id=(SELECT auth.uid()) AND p.ativo AND p.papel='coordenador'
  )
)
WITH CHECK (
  bucket_id='fju-coordenadores'
  AND name = (SELECT auth.uid())::text || '/perfil.jpg'
  AND EXISTS (
    SELECT 1 FROM public.fju_perfis p
    WHERE p.usuario_id=(SELECT auth.uid()) AND p.ativo AND p.papel='coordenador'
  )
);

COMMIT;
