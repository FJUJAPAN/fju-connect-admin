-- FJU Connect JAPAN — autorização nacional para eventos especiais
-- Esta migração é compatível com a tabela UUID já criada no Supabase.
-- Executar somente após conferir a estrutura do banco. Transação atômica.

BEGIN;

CREATE TABLE IF NOT EXISTS public.fju_solicitacoes_eventos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('inclusao','exclusao')),
  evento_id uuid,
  polo_id uuid NOT NULL REFERENCES public.fju_polos(id),
  dados_propostos jsonb NOT NULL DEFAULT '{}'::jsonb,
  justificativa text,
  solicitante_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','rejeitada')),
  decidido_por uuid REFERENCES auth.users(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  decidido_em timestamptz
);

CREATE INDEX IF NOT EXISTS fju_solicitacoes_eventos_polo_status_idx
  ON public.fju_solicitacoes_eventos(polo_id,status);

ALTER TABLE public.fju_solicitacoes_eventos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.fju_solicitacoes_eventos TO authenticated;
REVOKE UPDATE, DELETE ON public.fju_solicitacoes_eventos FROM authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE public.fju_solicitacoes_eventos_id_seq TO authenticated;

DROP POLICY IF EXISTS solicitacoes_eventos_visualizar ON public.fju_solicitacoes_eventos;
CREATE POLICY solicitacoes_eventos_visualizar
ON public.fju_solicitacoes_eventos FOR SELECT TO authenticated
USING (public.fju_acessa_polo(polo_id));

DROP POLICY IF EXISTS solicitacoes_eventos_criar ON public.fju_solicitacoes_eventos;
CREATE POLICY solicitacoes_eventos_criar
ON public.fju_solicitacoes_eventos FOR INSERT TO authenticated
WITH CHECK (
  solicitante_id = (SELECT auth.uid())
  AND status = 'pendente'
  AND decidido_por IS NULL AND decidido_em IS NULL
  AND (
    (tipo = 'inclusao' AND evento_id IS NULL)
    OR (tipo = 'exclusao' AND evento_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.fju_eventos_especiais e
          WHERE e.id = evento_id AND e.polo_id = fju_solicitacoes_eventos.polo_id
        ))
  )
  AND EXISTS (
    SELECT 1 FROM public.fju_perfis p
    WHERE p.usuario_id = (SELECT auth.uid())
      AND p.ativo AND p.papel = 'coordenador'
      AND p.polo_id = fju_solicitacoes_eventos.polo_id
  )
);

-- Função de identificação do Administrador Nacional para uso nas políticas.
-- SECURITY DEFINER evita recursão das políticas de fju_perfis.
CREATE OR REPLACE FUNCTION public.fju_usuario_e_nacional()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fju_perfis p
    WHERE p.usuario_id = (SELECT auth.uid())
      AND p.ativo
      AND p.papel = 'nacional'
  );
$$;

REVOKE ALL ON FUNCTION public.fju_usuario_e_nacional() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fju_usuario_e_nacional() TO authenticated;

-- Mantém a política SELECT original de eventos intacta.
-- Somente o Nacional recebe INSERT, UPDATE e DELETE diretos.
ALTER TABLE public.fju_eventos_especiais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS eventos_especiais_criar_polo ON public.fju_eventos_especiais;
DROP POLICY IF EXISTS eventos_especiais_criar_nacional ON public.fju_eventos_especiais;
DROP POLICY IF EXISTS eventos_especiais_editar_nacional ON public.fju_eventos_especiais;
DROP POLICY IF EXISTS eventos_especiais_excluir_nacional ON public.fju_eventos_especiais;

CREATE POLICY eventos_especiais_criar_nacional
ON public.fju_eventos_especiais FOR INSERT TO authenticated
WITH CHECK (public.fju_usuario_e_nacional());

CREATE POLICY eventos_especiais_editar_nacional
ON public.fju_eventos_especiais FOR UPDATE TO authenticated
USING (public.fju_usuario_e_nacional())
WITH CHECK (public.fju_usuario_e_nacional());

CREATE POLICY eventos_especiais_excluir_nacional
ON public.fju_eventos_especiais FOR DELETE TO authenticated
USING (public.fju_usuario_e_nacional());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fju_eventos_especiais TO authenticated;

-- Executada atomicamente: aprova => aplica alteração e registra decisão;
-- rejeita => só registra a decisão, sem alterar o evento.
CREATE OR REPLACE FUNCTION public.fju_decidir_solicitacao_evento(
  p_id bigint, p_aprovar boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  req public.fju_solicitacoes_eventos%ROWTYPE;
  linhas_alteradas integer;
  dados jsonb;
BEGIN
  IF NOT public.fju_usuario_e_nacional() THEN
    RAISE EXCEPTION 'Apenas o Administrador Nacional pode aprovar ou rejeitar';
  END IF;
  IF p_aprovar IS NULL THEN
    RAISE EXCEPTION 'Decisão inválida';
  END IF;

  SELECT * INTO req
  FROM public.fju_solicitacoes_eventos
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND OR req.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou já decidida';
  END IF;

  IF p_aprovar THEN
    IF req.tipo = 'inclusao' THEN
      dados := req.dados_propostos;
      IF NULLIF(trim(dados->>'nome_evento'), '') IS NULL
        OR NULLIF(dados->>'data_evento', '') IS NULL
        OR NULLIF(dados->>'total_jovens', '') IS NULL
        OR (dados->>'polo_id') IS DISTINCT FROM req.polo_id::text
        OR (dados->>'total_jovens')::integer < 0 THEN
        RAISE EXCEPTION 'Dados inválidos no pedido de inclusão';
      END IF;
      INSERT INTO public.fju_eventos_especiais
        (polo_id, nome_evento, data_evento, total_jovens, criado_por)
      VALUES (
        req.polo_id,
        trim(dados->>'nome_evento'),
        (dados->>'data_evento')::date,
        (dados->>'total_jovens')::integer,
        req.solicitante_id
      );
    ELSIF req.tipo = 'exclusao' THEN
      DELETE FROM public.fju_eventos_especiais
      WHERE id = req.evento_id AND polo_id = req.polo_id;
      GET DIAGNOSTICS linhas_alteradas = ROW_COUNT;
      IF linhas_alteradas <> 1 THEN
        RAISE EXCEPTION 'Evento não encontrado no polo informado';
      END IF;
    ELSE
      RAISE EXCEPTION 'Tipo de solicitação inválido';
    END IF;
  END IF;

  UPDATE public.fju_solicitacoes_eventos
  SET status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'rejeitada' END,
      decidido_por = (SELECT auth.uid()),
      decidido_em = now()
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fju_decidir_solicitacao_evento(bigint,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fju_decidir_solicitacao_evento(bigint,boolean) TO authenticated;

COMMIT;
