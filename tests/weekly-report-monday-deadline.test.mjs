import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const moduleSource = readFileSync(new URL('../relatorios-edicao-autorizacao.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261108200000_weekly_report_monday_deadline.sql', import.meta.url), 'utf8');

test('coordinator edit button is only rendered through Monday in Japan time', () => {
  assert.match(moduleSource, /function japanTodayISO\(\)/);
  assert.match(moduleSource, /timeZone:\s*'Asia\/Tokyo'/);
  assert.match(moduleSource, /function correctionWindowOpen\(report\)/);
  assert.match(moduleSource, /japanTodayISO\(\)\s*<=\s*deadline\.toISOString\(\)\.slice\(0,\s*10\)/);
  assert.match(moduleSource, /if\s*\(correctionWindowOpen\(report\)\)\s*\{/);
  assert.match(moduleSource, /deadlineClosed:/);
});

test('database rejects correction requests after Monday even if a client bypasses the UI', () => {
  assert.match(migration, /before insert on public\.fju_relatorio_semanal_edicao_solicitacoes/i);
  assert.match(migration, /now\(\) at time zone 'Asia\/Tokyo'/);
  assert.match(migration, /v_semana \+ 1/);
  assert.match(migration, /O prazo para corrigir este relatório terminou na segunda-feira/);
});
