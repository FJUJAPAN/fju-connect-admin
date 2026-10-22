-- FJU JAPAN — impedir consulta à tabela privada de perfis em acesso público.
-- Políticas separadas: anon lê apenas publicadas; autenticados podem ler
-- publicadas ou matérias autorizadas segundo a função existente de perfil.
DROP POLICY IF EXISTS fju_materias_leitura ON public.fju_materias;
DROP POLICY IF EXISTS fju_materias_leitura_publica ON public.fju_materias;
DROP POLICY IF EXISTS fju_materias_leitura_autenticada ON public.fju_materias;

CREATE POLICY fju_materias_leitura_publica
ON public.fju_materias
FOR SELECT TO anon
USING (status = 'publicada');

CREATE POLICY fju_materias_leitura_autenticada
ON public.fju_materias
FOR SELECT TO authenticated
USING (
  status = 'publicada'
  OR EXISTS (
    SELECT 1 FROM public.fju_perfis p
    WHERE p.usuario_id = (SELECT auth.uid())
      AND p.ativo
      AND (
        p.papel = 'nacional'
        OR (
          p.papel = 'coordenador'
          AND fju_materias.autor_id = (SELECT auth.uid())
          AND fju_materias.polo_id = p.polo_id
        )
      )
  )
);
