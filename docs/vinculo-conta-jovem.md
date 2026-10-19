# Vínculo de login com ficha — FJU JAPAN

Esta migração é **proposta para revisão**, não foi aplicada no Supabase.

1. Confirmar se `fju_jovens.id` é UUID e validar as políticas atuais da tabela de jovens e do bucket privado `fju-fotos`.
2. Vincular apenas usuários criados por convite após autorização do coordenador do polo; coordenador nunca define nem conhece senha.
3. Implementar função `SECURITY DEFINER` com verificação de papel, polo e auditoria, ou serviço privilegiado validado, para autorizar/reativar/revogar vínculos; **não** conceder escrita direta no cliente.
4. Só então adicionar papel `jovem` à autenticação e tela My Page, com RLS por `auth.uid()` para leitura apenas da ficha correspondente e foto privada via URL assinada.
5. Patente e polo permanecem somente leitura para jovem. Alterações seguem aprovação nacional.
6. Testar contas: jovem A não vê B, coordenador A não libera B, usuário sem vínculo não vê ficha, conta revogada perde acesso, administrador mantém suas funções.

A tabela isolada e política de leitura não concedem acesso à tabela `fju_jovens`; isso precisa de revisão separada.
