// FJU JAPAN — testando campos privados de complementos, sem dados reais.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261026_completar_fichas_autocadastro.sql',import.meta.url),'utf8');
const open=html.indexOf('const fjuComplementFields=[');
const end=html.indexOf('async function viewYouth(id){',open);
assert.ok(open>0&&end>open,'código da ficha complementar integrado ao painel');
const complementCode=html.slice(open,end);
function setup(){
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://fjujapan.github.io/fju-connect-admin/'});
 const w=dom.window;
 w.eval('const el=id=>document.getElementById(id);'+complementCode+'\nwindow.__fjuForm=fjuComplementForm;');
 return {w,doc:w.document,cleanup:()=>dom.window.close()};
}
test('campos complementares são opcionais e vazios inicialmente',()=>{
 const f=setup();
 try{
  const form=f.w.__fjuForm();
  const values=form.read();
  assert.deepEqual(Object.keys(values),['endereco','testemunho','observacoes','batismo_aguas','batismo_espirito']);
  assert.ok(Object.values(values).every(v=>v===''));
  assert.equal(form.element.querySelectorAll('textarea').length,3);
  assert.equal(form.element.querySelectorAll('input[type=date]').length,2);
 }finally{f.cleanup()}
});
test('testemunho salvo é exibido como texto e não HTML',()=>{
 const f=setup();
 try{
  const source='<img src=x onerror=alert(1)>';
  const form=f.w.__fjuForm({testemunho:source,endereco:'Rua Exemplo'});
  const box=form.element.querySelector('textarea');
  assert.equal(box.value,'Rua Exemplo');
  assert.equal(form.element.querySelectorAll('img').length,0);
  assert.equal(form.read().testemunho,source);
 }finally{f.cleanup()}
});
test('formulário de complemento respeita o idioma de exibição',()=>{
 const f=setup();
 try{
  f.doc.querySelector('#fju-admin-language-select').value='ja';
  const form=f.w.__fjuForm();
  assert.match(form.element.textContent,/青年の証し/);
  f.doc.querySelector('#fju-admin-language-select').value='en';
  assert.match(f.w.__fjuForm().element.textContent,/Youth testimony/);
 }finally{f.cleanup()}
});
test('aprovação inicial com complementos é atômica e exige perfil autorizado',()=>{
 assert.match(sql,/public\.fju_decidir_inscricao_jovem\(p_inscricao_id,'aprovar',p_patente\)/);
 assert.match(sql,/public\.fju_fichas_complementos/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public\.fju_fichas_complementos,/);
 assert.match(sql,/v_papel IS DISTINCT FROM 'coordenador'/);
 assert.match(sql,/papel='nacional'/);
 assert.match(html,/fju_aprovar_inscricao_ficha_completa/);
 assert.match(html,/fju_solicitar_ficha_complementar/);
 assert.match(html,/fju_decidir_ficha_complementar/);
});
