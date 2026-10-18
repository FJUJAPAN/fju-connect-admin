-- FJU JAPAN: preservar os valores anteriores de cada solicitação futura.
-- Executar no SQL Editor do Supabase ANTES de publicar a atualização do painel.
alter table public.fju_solicitacoes
  add column if not exists dados_anteriores jsonb;

create or replace function public.fju_capturar_dados_anteriores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ficha jsonb;
begin
  if new.tipo in ('edicao', 'patente') then
    -- Captura diretamente do banco; não confia em valores enviados pelo navegador.
    select to_jsonb(j) into ficha
      from public.fju_jovens j
      where j.id = new.jovem_id and j.polo_id = new.polo_id;
    if ficha is null then
      raise exception 'Ficha não encontrada no polo informado';
    end if;
    select coalesce(jsonb_object_agg(c.key, ficha -> c.key), '{}'::jsonb)
      into new.dados_anteriores
      from jsonb_each(coalesce(new.dados_propostos, '{}'::jsonb)) as c
      where ficha ? c.key;
  else
    new.dados_anteriores := null;
  end if;
  return new;
end;
$$;

drop trigger if exists fju_capturar_dados_anteriores_insert on public.fju_solicitacoes;
create trigger fju_capturar_dados_anteriores_insert
before insert on public.fju_solicitacoes
for each row execute function public.fju_capturar_dados_anteriores();

-- Não tenta inventar dados históricos de solicitações antigas.
