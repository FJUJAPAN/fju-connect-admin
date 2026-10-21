-- FJU JAPAN | Acesso administrativo solicitado pelo polo e decidido pelo Nacional.
-- Executar uma vez no SQL Editor. Não concede acesso ao instalar.
BEGIN;

CREATE TABLE IF NOT EXISTS public.fju_pedidos_acesso_admin (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 jovem_id uuid NOT NULL REFERENCES public.fju_jovens(id),
 usuario_id uuid NOT NULL REFERENCES auth.users(id),
 polo_id uuid NOT NULL REFERENCES public.fju_polos(id),
 email text NOT NULL,
 solicitado_por uuid NOT NULL REFERENCES auth.users(id),
 solicitado_em timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','aprovado','rejeitado')),
 analisado_por uuid REFERENCES auth.users(id),
 analisado_em timestamptz,
 perfil_anterior jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS fju_admin_pendente_jovem
 ON public.fju_pedidos_acesso_admin(jovem_id) WHERE status='pendente';
CREATE UNIQUE INDEX IF NOT EXISTS fju_admin_pendente_usuario
 ON public.fju_pedidos_acesso_admin(usuario_id) WHERE status='pendente';
ALTER TABLE public.fju_pedidos_acesso_admin ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fju_pedidos_acesso_admin FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.fju_solicitar_acesso_admin(p_jovem_id uuid,p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_perfil public.fju_perfis%ROWTYPE;
 v_jovem public.fju_jovens%ROWTYPE;
 v_usuario uuid;
 v_email text;
 v_id uuid;
BEGIN
 SELECT * INTO v_perfil FROM public.fju_perfis WHERE usuario_id=auth.uid() FOR SHARE;
 IF NOT FOUND OR v_perfil.ativo IS DISTINCT FROM true OR v_perfil.papel IS NULL
 OR v_perfil.papel NOT IN ('nacional','coordenador') THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 SELECT * INTO v_jovem FROM public.fju_jovens WHERE id=p_jovem_id AND excluido_em IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ficha não encontrada'; END IF;
 IF v_perfil.papel='coordenador' AND (v_perfil.polo_id IS NULL OR v_perfil.polo_id IS DISTINCT FROM v_jovem.polo_id)
 THEN RAISE EXCEPTION 'Só é possível solicitar acesso para uma ficha do seu polo'; END IF;
 IF lower(coalesce(v_jovem.patente,''))<>'coordenador' THEN RAISE EXCEPTION 'A patente Coordenador precisa estar aprovada na ficha'; END IF;
 SELECT u.id,lower(btrim(u.email)) INTO v_usuario,v_email
 FROM public.fju_vinculos_conta_jovem v JOIN auth.users u ON u.id=v.usuario_id
 WHERE v.jovem_id=p_jovem_id AND v.ativo AND lower(btrim(u.email))=lower(btrim(p_email))
 AND u.email_confirmed_at IS NOT NULL FOR SHARE OF v,u;
 IF v_usuario IS NULL THEN RAISE EXCEPTION 'O e-mail deve ser de uma conta confirmada e vinculada ativamente a esta ficha'; END IF;
 IF EXISTS(SELECT 1 FROM public.fju_perfis WHERE usuario_id=v_usuario AND
 (papel='nacional' OR (papel='coordenador' AND (ativo OR polo_id IS DISTINCT FROM v_jovem.polo_id))))
 THEN RAISE EXCEPTION 'Esta conta já possui acesso administrativo ou pertence a outro polo. O Nacional deve revisar o perfil'; END IF;
 INSERT INTO public.fju_pedidos_acesso_admin(jovem_id,usuario_id,polo_id,email,solicitado_por)
 VALUES(v_jovem.id,v_usuario,v_jovem.polo_id,v_email,auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Já existe uma solicitação pendente para esta ficha ou conta';
END;
$$;

CREATE OR REPLACE FUNCTION public.fju_listar_pedidos_acesso_admin()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_perfil public.fju_perfis%ROWTYPE; v_result jsonb;
BEGIN
 SELECT * INTO v_perfil FROM public.fju_perfis WHERE usuario_id=auth.uid();
 IF NOT FOUND OR v_perfil.ativo IS DISTINCT FROM true OR v_perfil.papel IS NULL
 OR v_perfil.papel NOT IN ('nacional','coordenador') THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.solicitado_em DESC),'[]'::jsonb) INTO v_result FROM (
  SELECT a.id,a.jovem_id,a.email,a.polo_id,a.status,a.solicitado_em,a.analisado_em,
  j.nome_completo,pol.nome AS polo_nome,
  coalesce(c.nome_exibicao,s.email,'Conta indisponível') AS solicitante_nome
  FROM public.fju_pedidos_acesso_admin a
  JOIN public.fju_jovens j ON j.id=a.jovem_id
  JOIN public.fju_polos pol ON pol.id=a.polo_id
  LEFT JOIN public.fju_coordenador_cards c ON c.usuario_id=a.solicitado_por
  LEFT JOIN auth.users s ON s.id=a.solicitado_por
  WHERE v_perfil.papel='nacional' OR (a.polo_id=v_perfil.polo_id AND j.polo_id=v_perfil.polo_id)
 ) r;
 RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.fju_decidir_acesso_admin(p_pedido_id uuid,p_aprovar boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_pedido public.fju_pedidos_acesso_admin%ROWTYPE;
 v_jovem public.fju_jovens%ROWTYPE;
 v_alvo public.fju_perfis%ROWTYPE;
 v_nacional public.fju_perfis%ROWTYPE;
BEGIN
 SELECT * INTO v_nacional FROM public.fju_perfis WHERE usuario_id=auth.uid() FOR SHARE;
 IF NOT FOUND OR v_nacional.ativo IS DISTINCT FROM true OR v_nacional.papel IS DISTINCT FROM 'nacional'
 THEN RAISE EXCEPTION 'Somente o Nacional pode decidir o acesso administrativo'; END IF;
 IF p_aprovar IS NULL THEN RAISE EXCEPTION 'Informe aprovar ou rejeitar'; END IF;
 SELECT * INTO v_pedido FROM public.fju_pedidos_acesso_admin WHERE id=p_pedido_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
 IF v_pedido.status<>'pendente' THEN RAISE EXCEPTION 'Este pedido já foi analisado'; END IF;
 IF p_aprovar THEN
  SELECT * INTO v_jovem FROM public.fju_jovens WHERE id=v_pedido.jovem_id FOR UPDATE;
  IF NOT FOUND OR v_jovem.excluido_em IS NOT NULL OR v_jovem.polo_id IS DISTINCT FROM v_pedido.polo_id
  OR lower(coalesce(v_jovem.patente,''))<>'coordenador'
  THEN RAISE EXCEPTION 'A ficha, o polo ou a patente mudou. Rejeite e solicite novamente'; END IF;
  PERFORM 1 FROM public.fju_vinculos_conta_jovem v JOIN auth.users u ON u.id=v.usuario_id
  WHERE v.jovem_id=v_pedido.jovem_id AND v.usuario_id=v_pedido.usuario_id AND v.ativo
  AND lower(btrim(u.email))=v_pedido.email AND u.email_confirmed_at IS NOT NULL FOR UPDATE OF v,u;
  IF NOT FOUND THEN RAISE EXCEPTION 'O vínculo da conta mudou. Rejeite e solicite novamente'; END IF;
  PERFORM 1 FROM public.fju_perfis WHERE usuario_id=v_pedido.solicitado_por AND ativo
  AND (papel='nacional' OR (papel='coordenador' AND polo_id=v_pedido.polo_id)) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'O solicitante não está mais autorizado para este polo'; END IF;
  SELECT * INTO v_alvo FROM public.fju_perfis WHERE usuario_id=v_pedido.usuario_id FOR UPDATE;
  IF FOUND AND (v_alvo.papel='nacional' OR (v_alvo.papel='coordenador' AND v_alvo.polo_id IS DISTINCT FROM v_pedido.polo_id))
  THEN RAISE EXCEPTION 'A conta já possui outro acesso administrativo. Revise o perfil'; END IF;
  UPDATE public.fju_pedidos_acesso_admin SET perfil_anterior=to_jsonb(v_alvo) WHERE id=v_pedido.id;
  -- O conflito é tratado sem sobrescrever uma mudança concorrente de papel ou polo.
  INSERT INTO public.fju_perfis(usuario_id,papel,polo_id,ativo)
  VALUES(v_pedido.usuario_id,'coordenador',v_pedido.polo_id,true)
  ON CONFLICT(usuario_id) DO UPDATE SET papel='coordenador',polo_id=EXCLUDED.polo_id,ativo=true
  WHERE public.fju_perfis.papel IS DISTINCT FROM 'nacional'
  AND (public.fju_perfis.papel IS DISTINCT FROM 'coordenador' OR public.fju_perfis.polo_id=EXCLUDED.polo_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'O perfil mudou durante a aprovação. Atualize e confira'; END IF;
 END IF;
 UPDATE public.fju_pedidos_acesso_admin SET status=CASE WHEN p_aprovar THEN 'aprovado' ELSE 'rejeitado' END,
 analisado_por=auth.uid(),analisado_em=now() WHERE id=v_pedido.id;
END;
$$;
REVOKE ALL ON FUNCTION public.fju_solicitar_acesso_admin(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_listar_pedidos_acesso_admin() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_decidir_acesso_admin(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fju_solicitar_acesso_admin(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_listar_pedidos_acesso_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_decidir_acesso_admin(uuid,boolean) TO authenticated;
COMMIT;
