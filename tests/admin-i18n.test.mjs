// FJU JAPAN — smoke test das opções de idioma, sem Supabase.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {test} from 'node:test';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('Idioma de interface é independente dos dados e funciona nos três idiomas',()=>{
  const dom=new JSDOM(read('index.html'),{url:'https://fjujapan.github.io/fju-connect-admin/',runScripts:'outside-only'});
  const {window}=dom,document=window.document;
  assert.ok(document.getElementById('fju-ui-lang'));
  window.eval(read('admin-i18n.js'));
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const select=document.getElementById('fju-ui-lang');
  const title=document.querySelector('#inicio .fju-actions-title');
  assert.equal(title.textContent.trim(),'Painel de Controle');
  select.value='ja';select.dispatchEvent(new window.Event('change'));
  assert.equal(title.textContent.trim(),'管理ダッシュボード');
  assert.equal(document.querySelector('#main-nav [data-tab="jovens"] .fju-nav-label-desktop').textContent,'登録情報');
  assert.equal(document.documentElement.lang,'ja');
  select.value='en';select.dispatchEvent(new window.Event('change'));
  assert.equal(title.textContent.trim(),'Control Panel');
  assert.equal(document.documentElement.lang,'en');
  assert.equal(window.localStorage.getItem('fju_admin_interface_language'),'en');
  select.value='pt';select.dispatchEvent(new window.Event('change'));
  assert.equal(title.textContent.trim(),'Painel de Controle');
  assert.equal(document.documentElement.lang,'pt-BR');
  dom.window.close();
});
