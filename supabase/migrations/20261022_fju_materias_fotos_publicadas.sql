-- FJU JAPAN — permitir assinatura de URLs apenas das fotos de matérias publicadas.
-- O bucket permanece privado. Rascunhos e matérias pendentes não são liberados.
DROP POLICY IF EXISTS "fju_materias_fotos_publicadas_leitura" ON storage.objects;
CREATE POLICY "fju_materias_fotos_publicadas_leitura"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'fju-materias'
  AND EXISTS (
    SELECT 1
    FROM public.fju_materias AS m
    WHERE m.status = 'publicada'
      AND (
        m.foto1 = name
        OR m.foto2 = name
        OR m.foto3 = name
      )
  )
);
