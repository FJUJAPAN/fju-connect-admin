-- Cadastro exclusivo de coordenadores. Executar no SQL Editor do Supabase antes de publicar o frontend.
BEGIN;
CREATE TABLE IF NOT EXISTS public.fju_cadastros_coordenadores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 usuario_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 polo_id uuid NOT NULL REFERENCES public.fju_polos(id),
 nome text NOT NULL,
 status text NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','aprovado','rejeitado')),
 criado_em timestamptz NOT NULL DEFAULT now(),
 analisado_por uuid REFERENCES auth.users(id),
 analisado_em timestamptz
);
ALTER TABLE public.fju_cadastros_coordenadores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fju_cadastros_coordenadores FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.fju_solicitar_cadastro_coordenador(p_polo_id uuid,p_nome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fju_polos WHERE id=p_polo_id) THEN RAISE EXCEPTION 'Polo inválido'; END IF;
 IF length(btrim(coalesce(p_nome,''))) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
 IF coalesce((SELECT raw_user_meta_data->>'requested_role' FROM auth.users WHERE id=auth.uid()),'')<>'coordenador'
 THEN RAISE EXCEPTION 'Use o cadastro exclusivo de coordenador'; END IF;
 IF EXISTS(SELECT 1 FROM public.fju_perfis WHERE usuario_id=auth.uid() AND ativo)
 OR EXISTS(SELECT 1 FROM public.fju_vinculos_conta_jovem WHERE usuario_id=auth.uid() AND ativo)
 THEN RAISE EXCEPTION 'Conta já vinculada'; END IF;
 INSERT INTO public.fju_cadastros_coordenadores(usuario_id,polo_id,nome)
 VALUES(auth.uid(),p_polo_id,btrim(p_nome)) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.fju_listar_cadastros_coordenadores()
RETURNS TABLE(id uuid,usuario_id uuid,polo_id uuid,polo_nome text,nome text,email text,criado_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.fju_perfis WHERE usuario_id=auth.uid() AND ativo AND papel='nacional')
 THEN RAISE EXCEPTION 'Somente Nacional'; END IF;
 RETURN QUERY SELECT c.id,c.usuario_id,c.polo_id,p.nome,c.nome,u.email::text,c.criado_em
 FROM public.fju_cadastros_coordenadores c
 JOIN public.fju_polos p ON p.id=c.polo_id
 JOIN auth.users u ON u.id=c.usuario_id
 WHERE c.status='pendente' ORDER BY c.criado_em;
END $$;
CREATE OR REPLACE FUNCTION public.fju_decidir_cadastro_coordenador(p_id uuid,p_aprovar boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.fju_cadastros_coordenadores%ROWTYPE; v_jovem uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.fju_perfis WHERE usuario_id=auth.uid() AND ativo AND papel='nacional')
 THEN RAISE EXCEPTION 'Somente Nacional'; END IF;
 SELECT * INTO c FROM public.fju_cadastros_coordenadores WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.status<>'pendente' THEN RAISE EXCEPTION 'Pedido não está pendente'; END IF;
 IF p_aprovar THEN
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=c.usuario_id AND email_confirmed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'E-mail ainda não confirmado'; END IF;
  IF EXISTS(SELECT 1 FROM public.fju_perfis WHERE usuario_id=c.usuario_id AND ativo)
  OR EXISTS(SELECT 1 FROM public.fju_vinculos_conta_jovem WHERE usuario_id=c.usuario_id AND ativo)
  THEN RAISE EXCEPTION 'Conta já possui vínculo ou perfil ativo'; END IF;
  IF EXISTS(SELECT 1 FROM public.fju_jovens WHERE polo_id=c.polo_id AND lower(btrim(nome_completo))=lower(btrim(c.nome)) AND excluido_em IS NULL)
  THEN RAISE EXCEPTION 'Já existe ficha com esse nome no polo; confira antes de aprovar'; END IF;
  INSERT INTO public.fju_jovens(polo_id,nome_completo,patente,categoria)
  VALUES(c.polo_id,c.nome,'coordenador','firme') RETURNING id INTO v_jovem;
  INSERT INTO public.fju_vinculos_conta_jovem(jovem_id,usuario_id,liberado_por,ativo)
  VALUES(v_jovem,c.usuario_id,auth.uid(),true);
  INSERT INTO public.fju_perfis(usuario_id,papel,polo_id,ativo)
  VALUES(c.usuario_id,'coordenador',c.polo_id,true)
  ON CONFLICT(usuario_id) DO UPDATE SET papel='coordenador',polo_id=EXCLUDED.polo_id,ativo=true
  WHERE public.fju_perfis.papel IS DISTINCT FROM 'nacional'
  AND public.fju_perfis.ativo IS DISTINCT FROM true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil administrativo mudou'; END IF;
 END IF;
 UPDATE public.fju_cadastros_coordenadores SET status=CASE WHEN p_aprovar THEN 'aprovado' ELSE 'rejeitado' END,
 analisado_por=auth.uid(),analisado_em=now() WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.fju_solicitar_cadastro_coordenador(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_listar_cadastros_coordenadores() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_decidir_cadastro_coordenador(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fju_solicitar_cadastro_coordenador(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_listar_cadastros_coordenadores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_decidir_cadastro_coordenador(uuid,boolean) TO authenticated;
COMMIT;