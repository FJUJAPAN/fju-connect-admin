-- Permitir fotos JPEG e WebP, ambas com limite de 100 KB.
UPDATE storage.buckets
SET file_size_limit = 102400,
    allowed_mime_types = ARRAY['image/webp','image/jpeg']
WHERE id = 'fju-materias';
