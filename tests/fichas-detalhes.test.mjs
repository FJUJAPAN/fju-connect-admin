// FJU JAPAN — Detalhes das fichas: foto, histórico e sessão com dados fictícios.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('let detailPhotoUrl=null;');
const end=html.indexOf('async function requestYouthChange(',start);
assert.ok(start>0&&end>start,'Funções da ficha individual não encontradas');
const source=html.slice(start,end);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function flush(){for(let i=0;i<16;i++)await new Promise(r=>setImmediate(r));}
function fixture(role='coordenador'){
 const dom=new JSDOM(html,{url:'https://fjujapan.github.io/fju-connect-admin/',runScripts:'outside-only'});
 const w=dom.window,d=w.document,calls=[],created=[],revoked=[];
 const profile={papel:role,polo_id:'polo-A'};
 const rows=[
  {id:'jovem-A',polo_id:'polo-A',nome_completo:'Ana Exemplo',nascimento:'2006-01-01',telefone:'090-0000-0000',nacionalidade_iso2:'BR',idiomas:['pt'],patente:'firme'},
  {id:'jovem-B',polo_id:'polo-A',nome_completo:'Bruno Exemplo',nascimento:'2005-02-02',telefone:'080-0000-0000',nacionalidade_iso2:'JP',idiomas:['ja'],patente:'cpo'},
  {id:'jovem-C',polo_id:'polo-B',nome_completo:'Clara Exemplo',nascimento:'2004-03-03',telefone:'070-0000-0000',nacionalidade_iso2:'BR',idiomas:[],patente:'firme'}
 ];
 const history=new Map(),files=new Map(),downloads=new Map();
 for(const r of rows){history.set(r.id,deferred());files.set(r.id,deferred());downloads.set(r.id,deferred());}
 const select=d.getElementById('youth-list-polo');
 for(const polo of ['polo-A','polo-B']){const opt=d.createElement('option');opt.value=polo;opt.textContent=polo;select.append(opt);}
 select.value='polo-A';
 w.Element.prototype.scrollIntoView=()=>{};
 w.URL.createObjectURL=blob=>{const url='blob:mock-'+(created.length+1);created.push({url,blob});return url;};
 w.URL.revokeObjectURL=url=>revoked.push(url);
 w.__profile=profile;w.__rows=rows;w.__calls=calls;
 w.__db={
  from:table=>{
   assert.equal(table,'fju_historico_patentes');
   let id;
   const q={
    select:()=>q,
    eq:(key,val)=>{assert.equal(key,'jovem_id');id=val;calls.push('history:'+id);return q;},
    order:()=>q,
    limit:()=>history.get(id).promise
   };return q;
  },
  storage:{from:bucket=>{
   assert.equal(bucket,'fju-fotos');
   return {
    list:(id)=>{calls.push('list:'+id);return files.get(id).promise;},
    download:path=>{const id=path.split('/')[0];calls.push('download:'+id);return downloads.get(id).promise;}
   };
  }}
 };
 w.eval('var currentProfile=window.__profile;var youthRows=window.__rows;'+
   'var supabase=window.__db;const el=id=>document.getElementById(id);'+
   'const youthCardInitials=name=>name.slice(0,1);const youthCardRank=row=>row.patente;'+
   'const administrativeAccess={appendRequest:()=>{},clear:()=>{}};'+
   'let youthSubmitVersion=0,youthSubmitInProgress=false,youthLoadVersion=0;'+
   'const setYouthSubmitting=()=>{};const clearYouthCardPhotos=()=>{};'+
   'const resetYouth=()=>{};const setYouthFormOpen=()=>{};'+
   'const editYouth=()=>{};'+source+
   '\nwindow.__view=viewYouth;window.__hide=hideYouthDetail;'+
   'window.__reset=resetYouthSession;'+
   'window.__logout=()=>{currentProfile=null;hideYouthDetail();};');
 return {dom,w,d,calls,created,revoked,history,files,downloads,profile,
   close:()=>dom.window.close()};
}
const oneHistory={data:[{patente_anterior:'Firme',patente_nova:'CPO',alterado_em:'2026-09-18T05:00:00Z'}],error:null};
const oneFile={data:[{name:'perfil.jpg'}],error:null};
const oneDownload={data:{size:5000},error:null};
test('Ficha individual carrega histórico e foto ativa, e libera URL ao fechar',async()=>{
 const f=fixture();
 try{
   const open=f.w.__view('jovem-A');
   assert.match(f.d.getElementById('youth-detail').textContent,/Ana Exemplo/);
   f.history.get('jovem-A').resolve(oneHistory);
   await flush();
   assert.deepEqual(f.calls,['history:jovem-A','list:jovem-A']);
   f.files.get('jovem-A').resolve(oneFile);
   await flush();
   assert.deepEqual(f.calls,['history:jovem-A','list:jovem-A','download:jovem-A']);
   f.downloads.get('jovem-A').resolve(oneDownload);
   await open;
   assert.match(f.d.getElementById('youth-detail').textContent,/Firme → CPO/);
   assert.equal(f.d.querySelector('#youth-detail .youth-detail-avatar img').src,'blob:mock-1');
   assert.equal(f.created.length,1);
   f.d.querySelector('#youth-detail .youth-detail-close').click();
   assert.equal(f.d.getElementById('youth-detail').classList.contains('hidden'),true);
   assert.equal(f.d.getElementById('youth-detail').textContent,'');
   assert.deepEqual(f.revoked,['blob:mock-1']);
 }finally{f.close();}
});
test('Fechar ficha enquanto histórico carrega evita ler foto privada',async()=>{
 const f=fixture();
 try{
   const loading=f.w.__view('jovem-A');
   f.d.querySelector('#youth-detail .youth-detail-close').click();
   f.history.get('jovem-A').resolve(oneHistory);
   await loading;
   assert.deepEqual(f.calls,['history:jovem-A']);
   assert.equal(f.d.getElementById('youth-detail').textContent,'');
   assert.equal(f.created.length,0);
 }finally{f.close();}
});
test('Trocar de jovem ignora resultado atrasado do histórico anterior',async()=>{
 const f=fixture();
 try{
   const old=f.w.__view('jovem-A');
   const next=f.w.__view('jovem-B');
   f.history.get('jovem-A').resolve(oneHistory);
   await old;
   assert.deepEqual(f.calls,['history:jovem-A','history:jovem-B']);
   f.history.get('jovem-B').resolve({data:[],error:null});await flush();
   assert.ok(f.calls.includes('list:jovem-B'));
   f.files.get('jovem-B').resolve({data:[],error:null});
   await next;
   assert.match(f.d.getElementById('youth-detail').textContent,/Bruno Exemplo/);
   assert.doesNotMatch(f.d.getElementById('youth-detail').textContent,/Firme → CPO/);
   assert.equal(f.calls.includes('list:jovem-A'),false);
 }finally{f.close();}
});
test('Logout com histórico em andamento não acessa a foto nem exibe dados antigos',async()=>{
 const f=fixture();
 try{
   const loading=f.w.__view('jovem-A');
   f.w.__logout();
   f.history.get('jovem-A').resolve(oneHistory);
   await loading;
   assert.deepEqual(f.calls,['history:jovem-A']);
   assert.equal(f.d.getElementById('youth-detail').textContent,'');
   assert.equal(f.created.length,0);
 }finally{f.close();}
});
test('Fechar após listar fotos, durante download, impede URL ou imagem antiga',async()=>{
 const f=fixture();
 try{
   const loading=f.w.__view('jovem-A');
   f.history.get('jovem-A').resolve({data:[],error:null});
   await flush();
   f.files.get('jovem-A').resolve(oneFile);await flush();
   assert.ok(f.calls.includes('download:jovem-A'));
   f.w.__hide();
   f.downloads.get('jovem-A').resolve(oneDownload);
   await loading;
   assert.equal(f.created.length,0);
   assert.equal(f.d.getElementById('youth-detail').textContent,'');
 }finally{f.close();}
});
test('Troca de polo enquanto lista fotos impede baixar foto da igreja anterior',async()=>{
 const f=fixture('nacional');
 try{
   const loading=f.w.__view('jovem-A');
   f.history.get('jovem-A').resolve({data:[],error:null});await flush();
   f.d.getElementById('youth-list-polo').value='polo-B';
   f.files.get('jovem-A').resolve(oneFile);
   await loading;
   assert.equal(f.calls.includes('download:jovem-A'),false);
   assert.equal(f.created.length,0);
 }finally{f.close();}
});
test('Coordenador não abre fichas de outro polo, mesmo com ID conhecido',async()=>{
 const f=fixture();
 try{
   await f.w.__view('jovem-C');
   assert.equal(f.calls.length,0);
   assert.equal(f.d.getElementById('youth-detail').textContent,'');
 }finally{f.close();}
});
test('Reset da sessão fecha detalhe e descarta respostas futuras',async()=>{
 const f=fixture();
 try{
   const loading=f.w.__view('jovem-A');
   f.w.__reset();
   f.history.get('jovem-A').resolve(oneHistory);
   await loading;
   assert.equal(f.d.getElementById('youth-detail').textContent,'');
   assert.equal(f.calls.includes('list:jovem-A'),false);
 }finally{f.close();}
});
test('Recarregar fichas invalida a ficha anterior no código de produção',()=>{
 assert.match(html,/async function loadYouth\(\)\{[\s\S]*?hideYouthDetail\(\);[\s\S]*?const loadVersion=/);
 assert.match(html,/el\('youth-list-polo'\)\.addEventListener\('change',\(\)=>\{hideYouthDetail\(\);void loadYouth\(\);\}\)/);
 assert.match(html,/function hideYouthDetail\(\)\{[\s\S]*?URL\.revokeObjectURL\(detailPhotoUrl\)/);
});
