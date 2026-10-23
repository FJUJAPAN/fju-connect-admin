// FJU JAPAN | Testes de gravação e sessões, somente dados fictícios.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const formStart=html.indexOf('let youthSubmitInProgress=false;');
const formEnd=html.indexOf("el('youth-photo').addEventListener",formStart);
const initStart=html.indexOf('async function initializeYouth(){');
const initEnd=html.indexOf('async function loadYouthPhoto(',initStart);
assert.ok(formStart>0&&formEnd>formStart);
assert.ok(initStart>0&&initEnd>initStart);
const formCode=html.slice(formStart,formEnd), initCode=html.slice(initStart,initEnd);
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
function formFixture(){
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://fjujapan.github.io/fju-connect-admin/'});
 const w=dom.window,doc=w.document,profile={papel:'nacional',polo_id:null};
 const pending=deferred(),calls=[];
 const option=doc.createElement('option');option.value='polo-A';option.textContent='Hamamatsu';
 doc.querySelector('#youth-polo').append(option);
 doc.querySelector('#youth-polo').value='polo-A';
 doc.querySelector('#youth-name').value='Pessoa Teste';
 doc.querySelector('#youth-rank').value='Firme';
 assert.equal(doc.querySelector('#youth-rank').value,'Firme');
 w.__profile=profile;
 w.__supabase={from:table=>{
   assert.equal(table,'fju_jovens');
   return {insert:payload=>{calls.push(payload);return {select:()=>({single:()=>pending.promise})};}};
 }};
 w.__messages=[];w.__success=[];
 w.eval('var currentProfile=window.__profile;var profileRequest=3;'+
  'var supabase=window.__supabase;const el=id=>document.getElementById(id);'+
  'const syncYouthBirth=()=>true;const selectedYouthLanguages=()=>[];'+
  'const youthMessage=(msg)=>window.__messages.push(msg);'+
  'const resetYouth=()=>window.__success.push("reset");'+
  'const setYouthFormOpen=()=>window.__success.push("close");'+
  'const loadYouth=async()=>window.__success.push("reload");'+
  'const loadDashboard=()=>window.__success.push("dashboard");'+formCode);
 return {w,dom,doc,calls,pending,cleanup:()=>dom.window.close()};
}
test('duplo submit de jovem envia uma única gravação',async()=>{
 const f=formFixture();
 try{
   const form=f.doc.querySelector('#youth-form');
   form.dispatchEvent(new f.w.Event('submit',{cancelable:true,bubbles:true}));
   form.dispatchEvent(new f.w.Event('submit',{cancelable:true,bubbles:true}));
   assert.equal(f.calls.length,1);
   for(const id of ['youth-submit','youth-clear','youth-form-close','youth-add-toggle'])assert.equal(f.doc.getElementById(id).disabled,true);
   assert.equal(form.getAttribute('aria-busy'),'true');
   f.pending.resolve({data:{id:'jovem-1'},error:null});
   await settle();
   assert.equal(f.doc.getElementById('youth-submit').disabled,false);
   assert.equal(form.getAttribute('aria-busy'),'false');
   assert.ok(f.w.__success.includes('reload'));
 }finally{f.cleanup();}
});
test('logout com gravação pendente não muda a tela da nova sessão',async()=>{
 const f=formFixture();
 try{
   f.doc.querySelector('#youth-form').dispatchEvent(new f.w.Event('submit',{cancelable:true,bubbles:true}));
   assert.equal(f.calls.length,1);
   f.w.eval('currentProfile=null;++youthSubmitVersion;youthSubmitInProgress=false;');
   f.pending.resolve({data:{id:'jovem-1'},error:null});
   await settle();
   assert.deepEqual(f.w.__success,[]);
 }finally{f.cleanup();}
});
test('consulta de polos antiga é descartada após logout',async()=>{
 const dom=new JSDOM(html,{runScripts:'outside-only'});
 const w=dom.window,doc=w.document,pending=deferred();
 w.__profile={papel:'coordenador',polo_id:'polo-A'};
 w.__supabase={from:()=>({select:()=>({order:()=>pending.promise})})};
 w.eval('var currentProfile=window.__profile;var youthLoadVersion=0;'+
   'const el=id=>document.getElementById(id);const youthMessage=()=>{};'+
   'const resetYouth=()=>{};const setYouthFormOpen=()=>{};'+
   'const loadYouth=async()=>{};const resetYouthSession=()=>{++youthLoadVersion};'+
   'var supabase=window.__supabase;'+initCode+'window.__start=initializeYouth;');
 try{
   const oldOptions=doc.querySelector('#youth-polo').innerHTML;
   const request=w.__start();
   w.eval('currentProfile=null;++youthLoadVersion;');
   pending.resolve({data:[{id:'polo-A',nome:'Hamamatsu'}],error:null});
   await request;
   assert.equal(doc.querySelector('#youth-polo').innerHTML,oldOptions);
 }finally{dom.window.close();}
});
