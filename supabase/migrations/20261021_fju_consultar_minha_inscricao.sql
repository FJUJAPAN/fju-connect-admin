-- FJU JAPAN | Jovem consulta somente o status da própria inscrição.
BEGIN;
CREATE OR REPLACE FUNCTION public.fju_consultar_minha_inscricao()
RETURNS TABLE(status text,polo_id uuid,projetos_solicitados text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT i.status,i.polo_id,i.projetos_solicitados
 FROM public.fju_inscricoes_jovens i WHERE i.usuario_id=(SELECT auth.uid())
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.fju_consultar_minha_inscricao() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fju_consultar_minha_inscricao() TO authenticated;
COMMIT;
