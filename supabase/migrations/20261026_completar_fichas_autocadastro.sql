-- FJU JAPAN | Complementos privados de fichas de jovens, inclusive autocadastros aprovados.
-- REQUER EXECUÇÃO MANUAL NO SUPABASE SQL EDITOR. Merge no GitHub NÃO executa SQL.
-- Cadastro inicial: coordenador ou nacional pode acrescentar dados no ato da aprovação.
-- Edições posteriores: coordenador solicita; somente Nacional decide. Nacional edita diretamente.
BEGIN;

CREATE TABLE IF NOT EXISTS public.fju_fichas_complementos (
  jovem_id uuid PRIMARY KEY REFERENCES public.fju_jovens(id) ON DELETE CASCADE,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES auth.users(id)
);
CREATE TABLE IF NOT EXISTS public.fju_fichas_complementos_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jovem_id uuid NOT NULL REFERENCES public.fju_jovens(id) ON DELETE CASCADE,
  polo_id uuid NOT NULL REFERENCES public.fju_polos(id),
  solicitante_id uuid NOT NULL REFERENCES auth.users(id),
  dados_propostos jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','rejeitada')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  decidido_em timestamptz,
  decidido_por uuid REFERENCES auth.users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS fju_ficha_complementar_um_pedido_pendente
 ON public.fju_fichas_complementos_pedidos(jovem_id) WHERE status='pendente';
CREATE INDEX IF NOT EXISTS fju_ficha_complementar_pedidos_status
 ON public.fju_fichas_complementos_pedidos(status,criado_em);

ALTER TABLE public.fju_fichas_complementos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fju_fichas_complementos_pedidos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fju_fichas_complementos, public.fju_fichas_complementos_pedidos FROM PUBLIC,anon,authenticated;

-- Não aceitar chaves arbitrárias, HTML ou datas inválidas. Campos opcionais.
CREATE OR REPLACE FUNCTION public.fju_validar_dados_ficha_complementar(p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_key text; v_value text; v_date text;
BEGIN
 IF p_dados IS NULL OR jsonb_typeof(p_dados)<>'object' THEN
   RAISE EXCEPTION 'Dados complementares inválidos';
 END IF;
 FOR v_key IN SELECT jsonb_object_keys(p_dados) LOOP
   IF v_key NOT IN ('endereco','testemunho','observacoes','batismo_aguas','batismo_espirito') THEN
     RAISE EXCEPTION 'Campo complementar não permitido: %',v_key;
   END IF;
 END LOOP;
 IF char_length(coalesce(p_dados->>'endereco',''))>350 OR
    char_length(coalesce(p_dados->>'testemunho',''))>4500 OR
    char_length(coalesce(p_dados->>'observacoes',''))>3000 THEN
   RAISE EXCEPTION 'O texto excede o limite da ficha';
 END IF;
 FOREACH v_key IN ARRAY ARRAY['batismo_aguas','batismo_espirito'] LOOP
   v_date:=nullif(btrim(coalesce(p_dados->>v_key,'')),'');
   IF v_date IS NOT NULL THEN
     IF v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       OR to_char(v_date::date,'YYYY-MM-DD')<>v_date
       OR v_date::date>current_date OR v_date::date<DATE '1900-01-01'
     THEN RAISE EXCEPTION 'Data de batismo inválida'; END IF;
   END IF;
 END LOOP;
 RETURN jsonb_build_object(
   'endereco',btrim(coalesce(p_dados->>'endereco','')),
   'testemunho',btrim(coalesce(p_dados->>'testemunho','')),
   'observacoes',btrim(coalesce(p_dados->>'observacoes','')),
   'batismo_aguas',coalesce(p_dados->>'batismo_aguas',''),
   'batismo_espirito',coalesce(p_dados->>'batismo_espirito','')
 );
END;$$;

-- Utilizado durante a aprovação do cadastro do site: criação e complemento na MESMA transação.
CREATE OR REPLACE FUNCTION public.fju_aprovar_inscricao_ficha_completa(
 p_inscricao_id uuid,p_patente text,p_dados jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_jovem uuid; v_dados jsonb;
BEGIN
 v_dados:=public.fju_validar_dados_ficha_complementar(coalesce(p_dados,'{}'::jsonb));
 v_jovem:=public.fju_decidir_inscricao_jovem(p_inscricao_id,'aprovar',p_patente);
 IF v_jovem IS NULL THEN RAISE EXCEPTION 'Não foi possível criar ficha'; END IF;
 INSERT INTO public.fju_fichas_complementos(jovem_id,dados,atualizado_por)
 VALUES(v_jovem,v_dados,auth.uid())
 ON CONFLICT (jovem_id) DO UPDATE SET dados=excluded.dados,atualizado_por=excluded.atualizado_por,atualizado_em=now();
 RETURN v_jovem;
END;$$;

CREATE OR REPLACE FUNCTION public.fju_ler_ficha_complementar(p_jovem_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_papel text; v_polo uuid; v_jovem public.fju_jovens%ROWTYPE; v_dados jsonb;
BEGIN
 SELECT papel,polo_id INTO v_papel,v_polo FROM public.fju_perfis
 WHERE usuario_id=auth.uid() AND ativo=true;
 IF v_papel NOT IN ('coordenador','nacional') OR v_papel IS NULL THEN
   RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 SELECT * INTO v_jovem FROM public.fju_jovens WHERE id=p_jovem_id AND excluido_em IS NULL;
 IF NOT FOUND OR (v_papel='coordenador' AND v_jovem.polo_id IS DISTINCT FROM v_polo) THEN
   RAISE EXCEPTION 'Ficha fora do escopo autorizado'; END IF;
 SELECT dados INTO v_dados FROM public.fju_fichas_complementos WHERE jovem_id=p_jovem_id;
 RETURN jsonb_build_object(
  'dados',coalesce(v_dados,'{}'::jsonb),
  'pedido_pendente',EXISTS(SELECT 1 FROM public.fju_fichas_complementos_pedidos
                         WHERE jovem_id=p_jovem_id AND status='pendente')
 );
END;$$;

CREATE OR REPLACE FUNCTION public.fju_solicitar_ficha_complementar(p_jovem_id uuid,p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_papel text;v_polo uuid;v_jovem public.fju_jovens%ROWTYPE;v_id uuid;v_dados jsonb;v_atual jsonb;
BEGIN
 SELECT papel,polo_id INTO v_papel,v_polo FROM public.fju_perfis
 WHERE usuario_id=auth.uid() AND ativo=true;
 IF v_papel IS DISTINCT FROM 'coordenador' OR v_polo IS NULL THEN
   RAISE EXCEPTION 'Somente o coordenador local pode solicitar a alteração'; END IF;
 SELECT * INTO v_jovem FROM public.fju_jovens WHERE id=p_jovem_id AND excluido_em IS NULL FOR SHARE;
 IF NOT FOUND OR v_jovem.polo_id IS DISTINCT FROM v_polo THEN
   RAISE EXCEPTION 'Ficha de outro polo'; END IF;
 v_dados:=public.fju_validar_dados_ficha_complementar(p_dados);
 SELECT dados INTO v_atual FROM public.fju_fichas_complementos WHERE jovem_id=p_jovem_id;
 IF v_dados=public.fju_validar_dados_ficha_complementar(coalesce(v_atual,'{}'::jsonb)) THEN
   RAISE EXCEPTION 'Nenhuma mudança na ficha'; END IF;
 INSERT INTO public.fju_fichas_complementos_pedidos(jovem_id,polo_id,solicitante_id,dados_propostos)
 VALUES (p_jovem_id,v_polo,auth.uid(),v_dados) RETURNING id INTO v_id;
 RETURN v_id;
END;$$;

CREATE OR REPLACE FUNCTION public.fju_salvar_ficha_complementar_nacional(p_jovem_id uuid,p_dados jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_dados jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.fju_perfis
   WHERE usuario_id=auth.uid() AND ativo AND papel='nacional') THEN
   RAISE EXCEPTION 'Somente o Nacional pode salvar diretamente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fju_jovens WHERE id=p_jovem_id AND excluido_em IS NULL) THEN
   RAISE EXCEPTION 'Ficha não encontrada'; END IF;
 IF EXISTS(SELECT 1 FROM public.fju_fichas_complementos_pedidos
           WHERE jovem_id=p_jovem_id AND status='pendente') THEN
   RAISE EXCEPTION 'Decida o pedido pendente antes de editar'; END IF;
 v_dados:=public.fju_validar_dados_ficha_complementar(p_dados);
 INSERT INTO public.fju_fichas_complementos(jovem_id,dados,atualizado_por)
 VALUES(p_jovem_id,v_dados,auth.uid())
 ON CONFLICT (jovem_id) DO UPDATE SET dados=excluded.dados,atualizado_por=excluded.atualizado_por,atualizado_em=now();
END;$$;

CREATE OR REPLACE FUNCTION public.fju_listar_pedidos_ficha_complementar()
RETURNS TABLE(id uuid,jovem_id uuid,polo_id uuid,nome text,dados_propostos jsonb,criado_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.fju_perfis
   WHERE usuario_id=auth.uid() AND ativo AND papel='nacional') THEN
   RAISE EXCEPTION 'Somente o Nacional pode consultar pedidos'; END IF;
 RETURN QUERY SELECT p.id,p.jovem_id,p.polo_id,j.nome_completo::text,p.dados_propostos,p.criado_em
 FROM public.fju_fichas_complementos_pedidos p
 JOIN public.fju_jovens j ON j.id=p.jovem_id
 WHERE p.status='pendente' AND j.excluido_em IS NULL
 ORDER BY p.criado_em ASC;
END;$$;

CREATE OR REPLACE FUNCTION public.fju_decidir_ficha_complementar(p_pedido_id uuid,p_aprovar boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_pedido public.fju_fichas_complementos_pedidos%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.fju_perfis
   WHERE usuario_id=auth.uid() AND ativo AND papel='nacional') THEN
   RAISE EXCEPTION 'Somente o Nacional pode decidir pedidos'; END IF;
 IF p_aprovar IS NULL THEN RAISE EXCEPTION 'Informe a decisão'; END IF;
 SELECT * INTO v_pedido FROM public.fju_fichas_complementos_pedidos
 WHERE id=p_pedido_id FOR UPDATE;
 IF NOT FOUND OR v_pedido.status<>'pendente' THEN RAISE EXCEPTION 'Pedido não está pendente'; END IF;
 IF p_aprovar THEN
   IF NOT EXISTS(SELECT 1 FROM public.fju_jovens
     WHERE id=v_pedido.jovem_id AND polo_id=v_pedido.polo_id AND excluido_em IS NULL) THEN
     RAISE EXCEPTION 'Ficha já não pertence a este polo'; END IF;
   INSERT INTO public.fju_fichas_complementos(jovem_id,dados,atualizado_por)
   VALUES(v_pedido.jovem_id,public.fju_validar_dados_ficha_complementar(v_pedido.dados_propostos),auth.uid())
   ON CONFLICT (jovem_id) DO UPDATE SET dados=excluded.dados,atualizado_por=excluded.atualizado_por,atualizado_em=now();
 END IF;
 UPDATE public.fju_fichas_complementos_pedidos
 SET status=CASE WHEN p_aprovar THEN 'aprovada' ELSE 'rejeitada' END,
     decidido_em=now(),decidido_por=auth.uid() WHERE id=v_pedido.id;
END;$$;

-- Nunca permitir execução indiscriminada de SECURITY DEFINER.
REVOKE ALL ON FUNCTION public.fju_validar_dados_ficha_complementar(jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_aprovar_inscricao_ficha_completa(uuid,text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_ler_ficha_complementar(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_solicitar_ficha_complementar(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_salvar_ficha_complementar_nacional(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_listar_pedidos_ficha_complementar() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fju_decidir_ficha_complementar(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fju_validar_dados_ficha_complementar(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_aprovar_inscricao_ficha_completa(uuid,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_ler_ficha_complementar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_solicitar_ficha_complementar(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_salvar_ficha_complementar_nacional(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_listar_pedidos_ficha_complementar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fju_decidir_ficha_complementar(uuid,boolean) TO authenticated;
COMMIT;
