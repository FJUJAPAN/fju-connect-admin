// FJU JAPAN | Exclusão de eventos: pendências, permissões e sessão.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('let specialEventsLoadVersion=0;');
const end=html.indexOf('async function loadEventRequests(',begin);
assert.ok(begin>0&&end>begin,'Código de eventos especiais não encontrado');
const snippet=html.slice(begin,end);
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function flush(){for(let i=0;i<14;i++)await new Promise(r=>setImmediate(r));}
function fixture(role='coordenador',pending=[],eventPolo='polo-A'){
 const dom=new JSDOM(html,{url:'https://fjujapan.github.io/fju-connect-admin/',runScripts:'outside-only'});
 const w=dom.window,d=w.document;
 const profile={papel:role,polo_id:role==='coordenador'?'polo-A':null};
 const ev={id:'evento-123',polo_id:eventPolo,nome_evento:'Movimento teste',data_evento:'2026-10-23',total_jovens:12};
 const auth=deferred(),save=deferred(),calls=[],messages=[],reloads=[],priority=[];
 const serverCheck=deferred();
 w.__profile=profile;w.__db={
   auth:{getUser:()=>auth.promise},
   from:table=>{
     if(table==='fju_polos')return {select:async()=>({data:[{id:'polo-A',nome:'Hamamatsu'},{id:'polo-B',nome:'Toyohashi'}],error:null})};
     if(table==='fju_eventos_especiais'){
       return {
         select:()=>({order:()=>({limit:async()=>({data:[ev],error:null})})}),
         delete:()=>({eq:(col,id)=>{
           calls.push({method:'delete',table,id,col});return {select:()=>save.promise};
         }})
       };
     }
     if(table==='fju_solicitacoes_eventos'){
       return {
         select:()=>({
           eq:()=>({
             eq:()=>({
               eq:()=>({limit:()=>{
                 calls.push({method:'check'});return serverCheck.promise;
               }})
             })
           })
         }),
         insert:payload=>{calls.push({method:'insert',payload});return save.promise;}
       };
     }
     throw Error('Tabela inesperada: '+table);
   }
 };
 let confirmations=0;
 w.confirm=()=>{confirmations++;return true;};
 w.__pending=new Set(pending);w.__priority=priority;w.__calls=calls;w.__messages=messages;w.__reloads=reloads;
 w.eval('var currentProfile=window.__profile;var profileRequest=7;'+
   'var supabase=window.__db;const el=id=>document.getElementById(id);'+
   'var specialEventSubmitting=false;const setSpecialEventDate=()=>{};'+
   'const setupSpecialEventPolo=async()=>{};'+
   'const message=(id,text,error)=>window.__messages.push({id,text,error});'+
   'const refreshAdminPriorities=()=>window.__priority.push("update");'+
   'const loadEventRequests=async()=>new Set(window.__pending);'+
   snippet+
   '\nwindow.__load=loadSpecialEvents;'+
   'window.__logout=()=>{currentProfile=null;++specialEventsLoadVersion;specialEventRemovalsInFlight.clear()};');
 const button=()=>d.querySelector('#special-event-list .actions button:last-child');
 return {dom,w,d,profile,auth,save,serverCheck,calls,messages,reloads,priority,button,
   confirmations:()=>confirmations,close:()=>dom.window.close()};
}
test('Pedido de exclusão já pendente bloqueia botão e não envia outro',async()=>{
 const f=fixture('coordenador',['evento-123']);
 try{
   await f.w.__load();
   assert.equal(f.button().disabled,true);
   assert.match(f.button().textContent,/aguardando Nacional/);
   f.button().dispatchEvent(new f.w.Event('click'));
   await flush();
   assert.equal(f.confirmations(),0);
   assert.equal(f.calls.length,0);
 }finally{f.close();}
});
test('Coordenador duplo clique envia apenas uma solicitação',async()=>{
 const f=fixture();
 try{
   await f.w.__load();
   const button=f.button();
   button.dispatchEvent(new f.w.Event('click'));
   button.dispatchEvent(new f.w.Event('click'));
   assert.equal(f.confirmations(),1);
   assert.equal(button.disabled,true);
   f.auth.resolve({data:{user:{id:'coord-1'}},error:null});
   await flush();
   assert.equal(f.calls.filter(x=>x.method==='check').length,1);
   f.serverCheck.resolve({data:[],error:null});
   await flush();
   assert.equal(f.calls.filter(x=>x.method==='insert').length,1);
   assert.equal(f.calls.find(x=>x.method==='insert').payload.tipo,'exclusao');
   f.save.resolve({error:null});
   await flush();
   assert.equal(f.priority.length,1);
   assert.match(f.messages.at(-1).text,/enviada para aprovação nacional/);
 }finally{f.close();}
});
test('Pendência encontrada no banco impede pedido mesmo após reabrir a página',async()=>{
 const f=fixture();
 try{
   await f.w.__load();
   f.button().click();
   f.auth.resolve({data:{user:{id:'coord-1'}},error:null});
   await flush();
   f.serverCheck.resolve({data:[{id:'outro-pedido'}],error:null});
   await flush();
   assert.equal(f.calls.filter(x=>x.method==='insert').length,0);
   assert.equal(f.button().disabled,true);
   assert.match(f.messages.at(-1).text,/Já existe um pedido de exclusão/);
 }finally{f.close();}
});
test('Nacional exclui diretamente uma vez, sem enviar solicitação',async()=>{
 const f=fixture('nacional');
 try{
   await f.w.__load();
   const btn=f.button();
   btn.dispatchEvent(new f.w.Event('click'));
   btn.dispatchEvent(new f.w.Event('click'));
   assert.equal(f.calls.length,1);
   assert.equal(f.calls[0].method,'delete');
   assert.equal(f.calls[0].id,'evento-123');
   f.save.resolve({data:[{id:'evento-123'}],error:null});
   await flush();
   assert.match(f.messages.at(-1).text,/Evento excluído/);
   assert.equal(f.priority.length,1);
 }finally{f.close();}
});
test('Logout durante identificação de usuário impede envio posterior',async()=>{
 const f=fixture();
 try{
   await f.w.__load();
   f.button().click();
   f.w.__logout();
   f.auth.resolve({data:{user:{id:'conta-anterior'}},error:null});
   await flush();
   assert.equal(f.calls.length,0);
   assert.equal(f.messages.length,0);
 }finally{f.close();}
});
test('Coordenador não envia exclusão de evento de outro polo',async()=>{
 const f=fixture('coordenador',[],'polo-B');
 try{
   await f.w.__load();
   f.button().click();
   await flush();
   assert.equal(f.calls.length,0);
   assert.equal(f.confirmations(),0);
 }finally{f.close();}
});
test('Falha na consulta de pendências reabilita o botão sem gravar',async()=>{
 const f=fixture();
 try{
   await f.w.__load();
   const btn=f.button();btn.click();
   f.auth.resolve({data:{user:{id:'coord-1'}},error:null});
   await flush();
   f.serverCheck.resolve({data:null,error:{message:'Consulta indisponível'}});
   await flush();
   assert.equal(btn.disabled,false);
   assert.equal(btn.textContent,'Solicitar exclusão');
   assert.equal(f.calls.filter(x=>x.method==='insert').length,0);
   assert.match(f.messages.at(-1).text,/Consulta indisponível/);
 }finally{f.close();}
});
test('Código limpa processos de remoção ao sair da conta',()=>{
 assert.match(html,/function clearAdminPrivateSession\(\)\{[\s\S]*?specialEventRemovalsInFlight\.clear\(\);/);
 assert.match(html,/if\(profile\.papel==='coordenador'\)q=q\.eq\('polo_id',profile\.polo_id\)/);
});
