-- FJU JAPAN | Identificação automática da conta e aprovação conjunta de patente/acesso.
-- Executar depois de 20261022_acesso_administrativo.sql. Não promove contas ao instalar.
BEGIN;
ALTER TABLE public.fju_pedidos_acesso_admin ADD COLUMN IF NOT EXISTS solicitacao_patente_id uuid
 REFERENCES public.fju_solicitacoes(id);
CREATE UNIQUE INDEX IF NOT EXISTS fju_admin_solicitacao_patente_unica
 ON public.fju_pedidos_acesso_admin(solicitacao_patente_id) WHERE solicitacao_patente_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fju_conta_coordenacao(p_jovem_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_perfil public.fju_perfis%ROWTYPE; v_jovem public.fju_jovens%ROWTYPE; v_conta record;
BEGIN
 SELECT * INTO v_perfil FROM public.fju_perfis WHERE usuario_id=auth.uid() FOR SHARE;
 IF NOT FOUND OR v_perfil.ativo IS DISTINCT FROM true OR v_perfil.papel IS NULL
 OR v_perfil.papel NOT IN ('nacional','coordenador') THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 SELECT * INTO v_jovem FROM public.fju_jovens WHERE id=p_jovem_id AND excluido_em IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ficha não encontrada'; END IF;
 IF v_perfil.papel='coordenador' AND (v_perfil.polo_id IS NULL OR v_perfil.polo_id IS DISTINCT FROM v_jovem.polo_id)
 THEN RAISE EXCEPTION 'Ficha fora do seu polo'; END IF;
 SELECT u.id,lower(btrim(u.email)) AS email INTO v_conta
 FROM public.fju_vinculos_conta_jovem v JOIN auth.users u ON u.id=v.usuario_id
 WHERE v.jovem_id=p_jovem_id AND v.ativo AND u.email_confirmed_at IS NOT NULL AND nullif(btrim(u.email),'') IS NOT NULL
 FOR SHARE OF v,u;
 IF NOT FOUND THEN RAISE EXCEPTION 'Esta ficha ainda não possui uma conta confirmada e vinculada. Confira o cadastro antes de solicitar a coordenação'; END IF;
 RETURN jsonb_build_object('usuario_id',v_conta.id,'email',v_conta.email,'polo_id',v_jovem.polo_id,
 'nome',v_jovem.nome_completo,'polo_nome',(SELECT nome FROM public.fju_polos WHERE id=v_jovem.polo_id));
END;
$$;

-- Sobrecarga sem e-mail: a conta é sempre resolvida a partir do vínculo da ficha.
CREATE OR REPLACE FUNCTION public.fju_solicitar_acesso_admin(p_jovem_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_conta jsonb;
BEGIN
 v_conta:=public.fju_conta_coordenacao(p_jovem_id);
 RETURN public.fju_solicitar_acesso_admin(p_jovem_id,v_conta->>'email');
END;
$$;

CREATE OR REPLACE FUNCTION public.fju_vincular_pedido_coordenacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_conta jsonb; v_pedido public.fju_pedidos_acesso_admin%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF EXISTS(SELECT 1 FROM public.fju_pedidos_acesso_admin WHERE solicitacao_patente_id=OLD.id)
  AND (NEW.jovem_id IS DISTINCT FROM OLD.jovem_id OR NEW.polo_id IS DISTINCT FROM OLD.polo_id
   OR NEW.solicitante_id IS DISTINCT FROM OLD.solicitante_id OR NEW.dados_propostos IS DISTINCT FROM OLD.dados_propostos
   OR NEW.tipo IS DISTINCT FROM OLD.tipo) THEN RAISE EXCEPTION 'O pedido de coordenação não pode ser reescrito. Rejeite e solicite novamente'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.tipo NOT IN ('patente','edicao') OR lower(coalesce(NEW.dados_propostos->>'patente',''))<>'coordenador' THEN RETURN NEW; END IF;
 IF NEW.status IS DISTINCT FROM 'pendente' OR NEW.solicitante_id IS DISTINCT FROM auth.uid()
 THEN RAISE EXCEPTION 'Solicitação de coordenação inválida'; END IF;
 v_conta:=public.fju_conta_coordenacao(NEW.jovem_id);
 IF NEW.polo_id IS DISTINCT FROM (v_conta->>'polo_id')::uuid THEN RAISE EXCEPTION 'O polo deve ser o da ficha'; END IF;
 IF EXISTS(SELECT 1 FROM public.fju_perfis WHERE usuario_id=(v_conta->>'usuario_id')::uuid AND
  (papel='nacional' OR (papel='coordenador' AND polo_id IS DISTINCT FROM NEW.polo_id)))
 THEN RAISE EXCEPTION 'A conta já possui outro acesso administrativo. O Nacional deve revisar o perfil'; END IF;
 SELECT * INTO v_pedido FROM public.fju_pedidos_acesso_admin
 WHERE jovem_id=NEW.jovem_id AND status='pendente' FOR UPDATE;
 IF FOUND THEN
  IF v_pedido.solicitacao_patente_id IS NOT NULL OR v_pedido.usuario_id IS DISTINCT FROM (v_conta->>'usuario_id')::uuid
  OR v_pedido.polo_id IS DISTINCT FROM NEW.polo_id OR v_pedido.email IS DISTINCT FROM v_conta->>'email'
  THEN RAISE EXCEPTION 'Existe um pedido pendente para esta ficha. Confira na aba Pedidos'; END IF;
  UPDATE public.fju_pedidos_acesso_admin SET solicitacao_patente_id=NEW.id,solicitado_por=NEW.solicitante_id
  WHERE id=v_pedido.id;
 ELSE
  INSERT INTO public.fju_pedidos_acesso_admin(jovem_id,usuario_id,polo_id,email,solicitado_por,solicitacao_patente_id)
  VALUES(NEW.jovem_id,(v_conta->>'usuario_id')::uuid,NEW.polo_id,v_conta->>'email',NEW.solicitante_id,NEW.id);
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS fju_coordenacao_solicitada ON public.fju_solicitacoes;
CREATE TRIGGER fju_coordenacao_solicitada AFTER INSERT ON public.fju_solicitacoes
 FOR EACH ROW EXECUTE FUNCTION public.fju_vincular_pedido_coordenacao();
DROP TRIGGER IF EXISTS fju_coordenacao_preservar_pedido ON public.fju_solicitacoes;
CREATE TRIGGER fju_coordenacao_preservar_pedido BEFORE UPDATE ON public.fju_solicitacoes
 FOR EACH ROW EXECUTE FUNCTION public.fju_vincular_pedido_coordenacao();

CREATE OR REPLACE FUNCTION public.fju_decidir_coordenacao_vinculada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_pedido uuid; v_status text;
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 SELECT id INTO v_pedido FROM public.fju_pedidos_acesso_admin WHERE solicitacao_patente_id=NEW.id AND status='pendente';
 IF v_pedido IS NULL THEN RETURN NEW; END IF;
 SELECT status INTO v_status FROM public.fju_solicitacoes WHERE id=NEW.id;
 IF v_status IN ('aprovada','rejeitada') THEN
  PERFORM public.fju_decidir_acesso_admin(v_pedido,v_status='aprovada');
 END IF;
 RETURN NEW;
END;
$$;
-- A decisão ocorre no fim da mesma transação, independentemente da ordem
-- em que a função existente atualiza a patente e o status do pedido.
DROP TRIGGER IF EXISTS fju_coordenacao_decidida ON public.fju_solicitacoes;
CREATE CONSTRAINT TRIGGER fju_coordenacao_decidida AFTER UPDATE ON public.fju_solicitacoes
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.fju_decidir_coordenacao_vinculada();

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
 IF v_pedido.solicitacao_patente_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.fju_solicitacoes WHERE id=v_pedido.solicitacao_patente_id
  AND status=CASE WHEN p_aprovar THEN 'aprovada' ELSE 'rejeitada' END
 ) THEN RAISE EXCEPTION 'Decida este acesso junto com o pedido de mudança de patente'; END IF;
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

CREATE OR REPLACE FUNCTION public.fju_listar_pedidos_acesso_admin()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_perfil public.fju_perfis%ROWTYPE; v_result jsonb;
BEGIN
 SELECT * INTO v_perfil FROM public.fju_perfis WHERE usuario_id=auth.uid();
 IF NOT FOUND OR v_perfil.ativo IS DISTINCT FROM true OR v_perfil.papel IS NULL
 OR v_perfil.papel NOT IN ('nacional','coordenador') THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.solicitado_em DESC),'[]'::jsonb) INTO v_result FROM (
  SELECT a.id,a.solicitacao_patente_id,a.jovem_id,a.email,a.polo_id,a.status,a.solicitado_em,a.analisado_em,
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


REVOKE ALL ON FUNCTION public.fju_conta_coordenacao(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_solicitar_acesso_admin(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_vincular_pedido_coordenacao() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fju_decidir_coordenacao_vinculada() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fju_conta_coordenacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_solicitar_acesso_admin(uuid) TO authenticated;
COMMIT;
