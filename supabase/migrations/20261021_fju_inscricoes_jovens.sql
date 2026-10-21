-- FJU JAPAN | Etapa 1: solicitações de autocadastro por polo.
-- Revisar e executar no Supabase SQL Editor; merge não executa SQL.
-- Não insere fichas oficiais e não modifica patentes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.fju_inscricoes_jovens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 usuario_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 polo_id uuid NOT NULL REFERENCES public.fju_polos(id),
 nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 2 AND 120),
 projetos_solicitados text[] NOT NULL DEFAULT '{}'::text[],
 status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
 analisado_por uuid REFERENCES auth.users(id),
 analisado_em timestamptz,
 criado_em timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT fju_inscricao_limite_projetos CHECK (
   cardinality(projetos_solicitados) <= 5
   AND array_position(projetos_solicitados,NULL) IS NULL
 )
);
ALTER TABLE public.fju_inscricoes_jovens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fju_inscricoes_jovens FROM anon,authenticated;
-- Somente RPCs autorizadas podem consultar/gravar inscrições.
CREATE OR REPLACE FUNCTION public.fju_enviar_inscricao_jovem(
 p_polo_id uuid,p_nome text,p_projetos text[] DEFAULT '{}'::text[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;v_projetos text[];
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 IF p_polo_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.fju_polos WHERE id=p_polo_id)
 THEN RAISE EXCEPTION 'Polo inválido'; END IF;
 IF char_length(btrim(coalesce(p_nome,''))) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
 v_projetos:=coalesce(p_projetos,'{}'::text[]);
 IF cardinality(v_projetos)>5 OR array_position(v_projetos,NULL) IS NOT NULL
 OR EXISTS(SELECT 1 FROM unnest(v_projetos) x WHERE btrim(x)='' OR char_length(x)>80)
 OR (SELECT count(DISTINCT lower(btrim(x))) FROM unnest(v_projetos) x)<>cardinality(v_projetos)
 THEN RAISE EXCEPTION 'Selecione até cinco projetos diferentes'; END IF;
 IF EXISTS(SELECT 1 FROM public.fju_inscricoes_jovens WHERE usuario_id=auth.uid())
 THEN RAISE EXCEPTION 'Inscrição já enviada'; END IF;
 IF EXISTS(SELECT 1 FROM public.fju_vinculos_conta_jovem WHERE usuario_id=auth.uid() AND ativo)
 THEN RAISE EXCEPTION 'Conta já vinculada a uma ficha'; END IF;
 INSERT INTO public.fju_inscricoes_jovens(usuario_id,polo_id,nome,projetos_solicitados)
 VALUES(auth.uid(),p_polo_id,btrim(p_nome),v_projetos) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.fju_enviar_inscricao_jovem(uuid,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fju_enviar_inscricao_jovem(uuid,text,text[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.fju_listar_inscricoes_polo()
RETURNS TABLE(id uuid,usuario_id uuid,polo_id uuid,nome text,projetos_solicitados text[],criado_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_papel text;v_polo uuid;
BEGIN
 SELECT p.papel,p.polo_id INTO v_papel,v_polo FROM public.fju_perfis p
 WHERE p.usuario_id=auth.uid() AND p.ativo;
 IF v_papel NOT IN ('nacional','coordenador') OR v_papel IS NULL
 THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 RETURN QUERY SELECT i.id,i.usuario_id,i.polo_id,i.nome,i.projetos_solicitados,i.criado_em
 FROM public.fju_inscricoes_jovens i
 WHERE i.status='pendente' AND (v_papel='nacional' OR (v_polo IS NOT NULL AND i.polo_id=v_polo))
 ORDER BY i.criado_em;
END $$;
REVOKE ALL ON FUNCTION public.fju_listar_inscricoes_polo() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fju_listar_inscricoes_polo() TO authenticated;
COMMIT;
