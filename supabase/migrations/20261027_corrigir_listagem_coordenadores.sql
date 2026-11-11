-- Corrige a ambiguidade de usuario_id na RPC de listagem.
-- Execute no SQL Editor do projeto fju-connect-tokyo.
CREATE OR REPLACE FUNCTION public.fju_listar_cadastros_coordenadores()
RETURNS TABLE(id uuid,usuario_id uuid,polo_id uuid,polo_nome text,nome text,email text,criado_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(
   SELECT 1 FROM public.fju_perfis AS perfil
   WHERE perfil.usuario_id=auth.uid() AND perfil.ativo AND perfil.papel='nacional'
 )
 THEN RAISE EXCEPTION 'Somente Nacional'; END IF;
 RETURN QUERY
 SELECT c.id,c.usuario_id,c.polo_id,p.nome,c.nome,u.email::text,c.criado_em
 FROM public.fju_cadastros_coordenadores AS c
 JOIN public.fju_polos AS p ON p.id=c.polo_id
 JOIN auth.users AS u ON u.id=c.usuario_id
 WHERE c.status='pendente'
 ORDER BY c.criado_em;
END $$;
