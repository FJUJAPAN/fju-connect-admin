-- FJU JAPAN | Coordenadores só podem consultar seus próprios rascunhos e matérias não publicadas.
-- Matérias publicadas permanecem públicas para leitura no site.
DROP POLICY IF EXISTS fju_materias_leitura ON public.fju_materias;
CREATE POLICY fju_materias_leitura ON public.fju_materias
FOR SELECT TO anon, authenticated
USING (
 status = 'publicada'
 OR EXISTS (
  SELECT 1 FROM public.fju_perfis p
  WHERE p.usuario_id = (SELECT auth.uid()) AND p.ativo
  AND (p.papel = 'nacional' OR (
   p.papel = 'coordenador'
   AND fju_materias.autor_id = (SELECT auth.uid())
   AND fju_materias.polo_id = p.polo_id
  ))
 )
);
