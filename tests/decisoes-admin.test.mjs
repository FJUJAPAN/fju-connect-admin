// FJU JAPAN — aprovações sem duplo envio; somente mocks, nenhum dado real.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {setupAdministrativeAccess} from '../acesso-administrativo.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const decisionHtml=html.slice(html.indexOf("if(profile.papel==='nacional'&&r.status==='pendente'&&identificado)"));
assert.match(decisionHtml,/let submitting=false;/);
assert.match(decisionHtml,/approve\.disabled=true;deny\.disabled=true;/);
assert.match(decisionHtml,/if\(submitting\|\|currentProfile!==profile\|\|!card\.isConnected\)return;/);

function deferred(){
 let resolve;
 const promise=new Promise(r=>resolve=r);
 return {promise,resolve};
}
async function flush(){await new Promise(resolve=>setImmediate(resolve));}
function createFixture({rejectFirst=false}={}){
 const dom=new JSDOM(html,{url:'https://fjujapan.github.io/fju-connect-admin/',runScripts:'outside-only'});
 const previousDocument=globalThis.document,previousConfirm=globalThis.confirm;
 globalThis.document=dom.window.document;
 globalThis.confirm=()=>true;
 const profile={papel:'nacional',polo_id:null};
 const actionCalls=[],pending=deferred();
 let attempt=0,listCalls=0,changed=0;
 const supabase={
   auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
   rpc:async(name,args)=>{
     if(name==='fju_listar_pedidos_acesso_admin'){
       listCalls++;
       return {data:[{
         id:'pedido-1',nome_completo:'Jovem Teste',email:'teste@example.com',
         polo_nome:'Hamamatsu',solicitante_nome:'Coord Teste',
         status:'pendente',solicitacao_patente_id:null
       }],error:null};
     }
     if(name==='fju_decidir_acesso_admin'){
       actionCalls.push(args);attempt++;
       return attempt===1?pending.promise:{data:null,error:null};
     }
     throw Error('RPC inesperada: '+name);
   }
 };
 const access=setupAdministrativeAccess({supabase,getProfile:()=>profile,onDecision:()=>{changed++;}});
 return {dom,access,profile,pending,actionCalls,read:()=>({attempt,listCalls,changed}),
   cleanup:()=>{access.clear();dom.window.close();globalThis.document=previousDocument;globalThis.confirm=previousConfirm;}};
}
test('duplo toque no mesmo pedido de acesso executa uma única decisão',async()=>{
 const f=createFixture();
 try{
   await f.access.refresh();
   const approve=f.dom.window.document.querySelector('#admin-access-list .actions button:first-child');
   assert.ok(approve);
   approve.dispatchEvent(new f.dom.window.Event('click',{bubbles:true}));
   approve.dispatchEvent(new f.dom.window.Event('click',{bubbles:true}));
   assert.equal(f.actionCalls.length,1);
   assert.equal(approve.disabled,true);
   f.pending.resolve({data:null,error:null});
   await flush();await flush();
   assert.equal(f.read().changed,1);
 }finally{f.cleanup();}
});
test('erro desbloqueia o pedido para tentar novamente',async()=>{
 const f=createFixture();
 try{
   await f.access.refresh();
   const buttons=[...f.dom.window.document.querySelectorAll('#admin-access-list .actions button')];
   buttons[0].dispatchEvent(new f.dom.window.Event('click',{bubbles:true}));
   f.pending.resolve({data:null,error:{message:'Falha simulada'}});
   await flush();await flush();
   assert.equal(buttons[0].disabled,false);
   assert.equal(buttons[1].disabled,false);
   assert.match(f.dom.window.document.querySelector('#admin-access-list .message').textContent,/Falha simulada/);
   buttons[0].dispatchEvent(new f.dom.window.Event('click',{bubbles:true}));
   await flush();await flush();
   assert.equal(f.actionCalls.length,2);
   assert.equal(f.read().changed,1);
 }finally{f.cleanup();}
});
test('resposta que chega após limpar a sessão não dispara atualizações',async()=>{
 const f=createFixture();
 try{
   await f.access.refresh();
   const approve=f.dom.window.document.querySelector('#admin-access-list .actions button:first-child');
   approve.dispatchEvent(new f.dom.window.Event('click',{bubbles:true}));
   f.access.clear();
   f.pending.resolve({data:null,error:null});
   await flush();await flush();
   assert.equal(f.read().changed,0);
   assert.equal(f.dom.window.document.querySelector('#admin-access-list').children.length,0);
 }finally{f.cleanup();}
});
