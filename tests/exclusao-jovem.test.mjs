// FJU JAPAN | Exclusões são apenas solicitações, nunca exclusão direta.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('async function requestYouthChange(r,button){');
const end=html.indexOf("\nlet currentRequestFilter='pendente';",begin);
assert.ok(begin>=0&&end>begin,'Fluxo de exclusão não encontrado');
const handler=html.slice(begin,end);
assert.match(handler,/tipo:'exclusao'/);
assert.doesNotMatch(handler,/supabase\.from\(['\"]fju_jovens['\"]\)/);

function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
function fixture(){
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://fjujapan.github.io/fju-connect-admin/'});
 const w=dom.window,d=w.document;
 const profile={papel:'coordenador',polo_id:'polo-A'};
 const youth={id:'jovem-01',polo_id:'polo-A',nome_completo:'Pessoa Teste'};
 const auth=deferred(),insert=deferred(),calls=[],messages=[],priorities=[];
 let prompts=0;
 const button=d.createElement('button');
 button.textContent='Solicitar exclusão';d.body.append(button);
 w.__profile=profile;w.__youth=youth;w.__button=button;
 w.__auth=auth;w.__insert=insert;
 w.__messages=messages;w.__priorities=priorities;
 w.__prompt=()=>{prompts++;return 'Solicitação justificada';};
 w.__supabase={
   auth:{getUser:()=>auth.promise},
   from:table=>{
     assert.equal(table,'fju_solicitacoes');
     return {insert:payload=>{calls.push(payload);return insert.promise;}};
   }
 };
 w.eval('var currentProfile=window.__profile;var youthRows=[window.__youth];'+
   'var profileRequest=5;var supabase=window.__supabase;'+
   'const pendingYouthRemovalRequests=new Set();const submittedYouthRemovalRequests=new Set();'+
   'const youthMessage=(msg,error)=>window.__messages.push({msg,error});'+
   'const refreshAdminPriorities=(profile,id)=>window.__priorities.push({profile,id});'+
   'const prompt=(msg)=>window.__prompt(msg);'+handler+
   '\nwindow.__request=requestYouthChange;'+
   'window.__switch=()=>{currentProfile=null;pendingYouthRemovalRequests.clear();submittedYouthRemovalRequests.clear();};');
 return {w,dom,d,profile,youth,button,auth,insert,calls,messages,priorities,
   promptCount:()=>prompts,cleanup:()=>dom.window.close()};
}

test('Dois toques enviam uma única solicitação, nunca excluem uma ficha',async()=>{
 const f=fixture();
 try{
   const first=f.w.__request(f.youth,f.button);
   const duplicate=f.w.__request(f.youth,f.button);
   assert.equal(f.promptCount(),1);
   assert.equal(f.button.disabled,true);
   f.auth.resolve({data:{user:{id:'coordenador-id'}},error:null});
   await flush();
   assert.equal(f.calls.length,1);
   assert.equal(f.calls[0].tipo,'exclusao');
   assert.equal(f.calls[0].polo_id,'polo-A');
   f.insert.resolve({error:null});
   await Promise.all([first,duplicate]);
   assert.equal(f.priorities.length,1);
   assert.equal(f.button.textContent,'Solicitação enviada');
   await f.w.__request(f.youth,f.button);
   assert.equal(f.calls.length,1);
 }finally{f.cleanup();}
});

test('Coordenador nunca solicita exclusão de outro polo',async()=>{
 const f=fixture();
 try{
   await f.w.__request({...f.youth,polo_id:'polo-B'},f.button);
   assert.equal(f.promptCount(),0);
   assert.equal(f.calls.length,0);
 }finally{f.cleanup();}
});

test('Mudança de conta antes de obter usuário cancela envio pendente',async()=>{
 const f=fixture();
 try{
   const started=f.w.__request(f.youth,f.button);
   f.w.__switch();
   f.auth.resolve({data:{user:{id:'outra-conta'}},error:null});
   await started;
   assert.equal(f.calls.length,0);
   assert.equal(f.priorities.length,0);
 }finally{f.cleanup();}
});

test('Erro de autorização reabilita botão para tentar novamente',async()=>{
 const f=fixture();
 try{
   const started=f.w.__request(f.youth,f.button);
   f.auth.resolve({data:{user:null},error:{message:'Sessão expirada'}});
   await started;
   assert.equal(f.calls.length,0);
   assert.equal(f.button.disabled,false);
   assert.equal(f.button.textContent,'Solicitar exclusão');
   assert.match(f.messages.at(-1).msg,/não foi possível solicitar exclusão/i);
 }finally{f.cleanup();}
});
