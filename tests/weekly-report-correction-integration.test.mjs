import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const moduleSource = readFileSync(new URL('../relatorios-edicao-autorizacao.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261108193000_weekly_report_correction_review.sql', import.meta.url), 'utf8');

test('weekly correction review is wired into the admin panel', () => {
  assert.match(index, /import\s*\{\s*setupWeeklyReportEditing\s*\}\s*from\s*['"]\.\/relatorios-edicao-autorizacao\.js/);
  assert.match(index, /setupWeeklyReportEditing\(supabase,\s*\(\)\s*=>\s*currentProfile\)/);
  assert.match(index, /id="report-weekly"/);
  assert.match(index, /id="national-report-panel"/);
});

test('correction form uses all eight official weekly report metrics', () => {
  for (const key of [
    'jovens_firmes', 'jovens_novos', 'jovens_afastados',
    'presenca_domingo_930', 'presenca_encontro_fju',
    'batizados_espirito_santo', 'batizados_aguas', 'total_jovens_unicos'
  ]) {
    assert.ok(moduleSource.includes(key), `missing report metric: ${key}`);
    assert.ok(migration.includes(key), `missing database validation/update for: ${key}`);
  }
});

test('corrections remain pending until the National decision RPC is called', () => {
  assert.match(moduleSource, /fju_relatorio_semanal_edicao_solicitacoes/);
  assert.match(moduleSource, /fju_decidir_correcao_relatorio_semanal/);
  assert.match(migration, /set status='concluida'/);
  assert.match(migration, /set status='recusada'/);
  assert.match(migration, /fju_relatorios_semanais_historico/);
});
