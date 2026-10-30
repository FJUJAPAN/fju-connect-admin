# Testes de aceitação — vincular inscrição à ficha existente

Pré-requisito: aplicar no Supabase a migração do PR FJUJAPAN/fju-connect#232, em ambiente de testes, antes de validar o painel. Não executar em produção sem conferir os resultados.

## Cenários obrigatórios
1. Coordenador do polo A seleciona inscrição pendente do polo A e uma ficha ativa sem vínculo do polo A. Confirmar: inscrição aprovada, vínculo criado, mesma ficha e mesma patente, sem duplicação.
2. Coordenador do polo A tenta ficha do polo B usando RPC diretamente. Esperado: erro, nenhuma alteração.
3. Coordenador tenta aprovar inscrição do polo B. Esperado: erro.
4. Conta já vinculada tenta novo vínculo. Esperado: erro.
5. Ficha já vinculada tenta novo vínculo. Esperado: erro.
6. Ficha excluída tenta vínculo. Esperado: erro.
7. Inscrição rejeitada ou aprovada tenta vínculo. Esperado: erro.
8. Sem login ou perfil inativo tenta vínculo. Esperado: erro.
9. Coordenador com solicitação de patente inicial pendente: painel deve bloquear vinculação.
10. Inscrição sem ficha: fluxo existente «Aceitar e criar ficha» deve continuar funcionando.
11. Dois vínculos simultâneos para mesma ficha ou conta: somente um pode ter sucesso.
12. Verificar que foto, projetos, histórico e patente da ficha existente não são alterados.

## Limitações conhecidas
- A busca no painel mostra no máximo 1000 fichas; verificar se a igreja excede esse volume.
- A migração SQL não é aplicada automaticamente por merge.
- Estes são roteiros de teste, não evidência de execução ou aprovação.
