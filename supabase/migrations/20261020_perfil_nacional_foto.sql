-- FJU JAPAN | Permite ao Administrador Nacional manter o próprio nome/foto de perfil.
-- Mantém o diretório de coordenadores separado e o bucket privado.
begin;

drop policy if exists fju_cards_criacao_propria on public.fju_coordenador_cards;
create policy fju_cards_criacao_propria
on public.fju_coordenador_cards
for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and (
    public.fju_usuario_e_nacional()
    or exists (
      select 1 from public.fju_perfis p
      where p.usuario_id=(select auth.uid())
        and p.ativo and p.papel='coordenador'
    )
  )
);

drop policy if exists fju_cards_edicao_propria on public.fju_coordenador_cards;
create policy fju_cards_edicao_propria
on public.fju_coordenador_cards
for update to authenticated
using (
  usuario_id = (select auth.uid())
  and (
    public.fju_usuario_e_nacional()
    or exists (
      select 1 from public.fju_perfis p
      where p.usuario_id=(select auth.uid())
        and p.ativo and p.papel='coordenador'
    )
  )
)
with check (
  usuario_id = (select auth.uid())
  and (
    public.fju_usuario_e_nacional()
    or exists (
      select 1 from public.fju_perfis p
      where p.usuario_id=(select auth.uid())
        and p.ativo and p.papel='coordenador'
    )
  )
);

drop policy if exists fju_coord_foto_criar on storage.objects;
create policy fju_coord_foto_criar
on storage.objects for insert to authenticated
with check (
  bucket_id='fju-coordenadores'
  and name=(select auth.uid())::text || '/perfil.jpg'
  and (
    public.fju_usuario_e_nacional()
    or exists (
      select 1 from public.fju_perfis p
      where p.usuario_id=(select auth.uid())
        and p.ativo and p.papel='coordenador'
    )
  )
);

drop policy if exists fju_coord_foto_editar on storage.objects;
create policy fju_coord_foto_editar
on storage.objects for update to authenticated
using (
  bucket_id='fju-coordenadores'
  and name=(select auth.uid())::text || '/perfil.jpg'
  and (
    public.fju_usuario_e_nacional()
    or exists (
      select 1 from public.fju_perfis p
      where p.usuario_id=(select auth.uid())
        and p.ativo and p.papel='coordenador'
    )
  )
)
with check (
  bucket_id='fju-coordenadores'
  and name=(select auth.uid())::text || '/perfil.jpg'
  and (
    public.fju_usuario_e_nacional()
    or exists (
      select 1 from public.fju_perfis p
      where p.usuario_id=(select auth.uid())
        and p.ativo and p.papel='coordenador'
    )
  )
);

commit;
