// FJU JAPAN — Cadastro e edição de eventos com dados de teste.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('let specialEventSubmitVersion=0;');
const end=html.indexOf('const PUSH_PUBLIC_KEY=',begin);
assert.ok(begin>=0&&end>begin,'Formulário de eventos não encontrado');
const code=html.slice(begin,end);
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function flush(){for(let i=0;i<14;i++)await new Promise(resolve=>setImmediate(resolve));}
function fixture(role='coordenador',editId=''){
 const dom=new JSDOM(html,{url:'https://fjujapan.github.io/fju-connect-admin/',runScripts:'outside-only'});
 const w=dom.window,d=w.document,calls=[],messages=[],reloads=[],updates=[];
 const auth=deferred(),save=deferred(),profile={papel:role,polo_id:'polo-A'};
 d.getElementById('special-event-name').value='Evento teste';
 d.getElementById('special-event-total').value='12';
 d.getElementById('special-event-date').value='2026-10-23';
 d.getElementById('special-event-edit-id').value=editId;
 if(role==='nacional'){
   const option=d.createElement('option');option.value='polo-B';option.textContent='Toyohashi';
   d.getElementById('special-event-polo').append(option);
   d.getElementById('special-event-polo').value='polo-B';
 }
 w.__profile=profile;w.__calls=calls;w.__messages=messages;w.__reloads=reloads;w.__updates=updates;
 w.__auth=auth;w.__save=save;
 w.__db={
   auth:{getUser:()=>auth.promise},
   from:table=>({
     insert:payload=>{calls.push({table,method:'insert',payload});return table==='fju_eventos_especiais'?{select:()=>save.promise}:save.promise;},
     update:payload=>{calls.push({table,method:'update',payload});return {eq:(name,id)=>{calls.at(-1).id=id;return {select:()=>save.promise};}};}
   })
 };
 w.eval('var currentProfile=window.__profile;var profileRequest=7;'+
   'var supabase=window.__db;const el=id=>document.getElementById(id);'+
   'const message=(id,text,error)=>window.__messages.push({id,text,error});'+
   'const specialEventFeedback=index=>["Selecione uma data válida (dia, mês e ano).","Preencha nome, data e total de jovens válido.","Selecione a igreja responsável pelo evento.","A edição de eventos existentes é exclusiva do Administrador Nacional.","Enviando solicitação...","Salvando evento...","Solicitação enviada. O evento aparecerá após a aprovação nacional.","Evento atualizado com sucesso.","Evento especial salvo com sucesso.","Evento gravado ou solicitação enviada, mas não foi possível atualizar a lista. Use Atualizar para consultar novamente.","Não foi possível concluir: "][index];'+
   'const syncSpecialEventDate=()=>true;'+
   'const resetSpecialEventEdit=()=>{window.__updates.push("reset");el("special-event-edit-id").value="";};'+
   'const loadSpecialEvents=async()=>window.__reloads.push("events");'+
   'const refreshAdminPriorities=()=>window.__updates.push("priorities");'+code+
   '\nwindow.__logout=()=>{currentProfile=null;++specialEventSubmitVersion;specialEventSubmitting=false;setSpecialEventSubmitting(false)};');
 return {dom,w,d,profile,auth,save,calls,messages,reloads,updates,
   submit:()=>d.getElementById('special-event-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})),
   close:()=>dom.window.close()};
}
test('Coordenador: duplo clique envia uma só solicitação de inclusão',async()=>{
 const f=fixture();
 try{
   f.submit();f.submit();
   assert.equal(f.d.getElementById('special-event-submit').disabled,true);
   assert.equal(f.d.getElementById('special-event-cancel').disabled,true);
   assert.equal(f.d.getElementById('special-event-form').getAttribute('aria-busy'),'true');
   f.auth.resolve({data:{user:{id:'coordenador-1'}},error:null});
   await flush();
   assert.equal(f.calls.length,1);
   assert.equal(f.calls[0].method,'insert');
   assert.equal(f.calls[0].table,'fju_solicitacoes_eventos');
   assert.equal(f.calls[0].payload.tipo,'inclusao');
   assert.equal(f.calls[0].payload.polo_id,'polo-A');
   f.save.resolve({error:null});await flush();
   assert.equal(f.d.getElementById('special-event-submit').disabled,false);
   assert.deepEqual(f.reloads,['events']);
   assert.ok(f.updates.includes('priorities'));
   assert.match(f.messages.at(-1).text,/Solicitação enviada/);
 }finally{f.close();}
});
test('Nacional: cria evento sem solicitação e usa polo selecionado',async()=>{
 const f=fixture('nacional');
 try{
   f.submit();f.auth.resolve({data:{user:{id:'nacional-1'}},error:null});await flush();
   assert.equal(f.calls.length,1);
   assert.equal(f.calls[0].table,'fju_eventos_especiais');
   assert.equal(f.calls[0].method,'insert');
   assert.equal(f.calls[0].payload.polo_id,'polo-B');
   assert.equal(f.calls[0].payload.criado_por,'nacional-1');
   f.save.resolve({data:[{id:'evento-1'}],error:null});await flush();
   assert.match(f.messages.at(-1).text,/Evento especial salvo com sucesso/);
 }finally{f.close();}
});
test('Nacional: edição só altera evento existente',async()=>{
 const f=fixture('nacional','evento-77');
 try{
   f.submit();f.auth.resolve({data:{user:{id:'nacional-1'}},error:null});await flush();
   assert.equal(f.calls.length,1);
   assert.equal(f.calls[0].table,'fju_eventos_especiais');
   assert.equal(f.calls[0].method,'update');
   assert.equal(f.calls[0].id,'evento-77');
   f.save.resolve({data:[{id:'evento-77'}],error:null});await flush();
   assert.match(f.messages.at(-1).text,/Evento atualizado com sucesso/);
 }finally{f.close();}
});
test('Coordenador não edita evento diretamente',async()=>{
 const f=fixture('coordenador','evento-77');
 try{
   f.submit();await flush();
   assert.equal(f.calls.length,0);
   assert.equal(f.d.getElementById('special-event-submit').disabled,false);
   assert.match(f.messages.at(-1).text,/exclusiva do Administrador Nacional/);
 }finally{f.close();}
});
test('Total vazio não vira zero',async()=>{
 const f=fixture('nacional');
 try{
   f.d.getElementById('special-event-total').value='';
   f.submit();await flush();
   assert.equal(f.calls.length,0);
   assert.match(f.messages.at(-1).text,/total de jovens válido/);
 }finally{f.close();}
});
test('Logout enquanto procura usuário impede enviar evento',async()=>{
 const f=fixture();
 try{
   f.submit();f.w.__logout();
   f.auth.resolve({data:{user:{id:'conta-antiga'}},error:null});await flush();
   assert.equal(f.calls.length,0);
   assert.equal(f.reloads.length,0);
 }finally{f.close();}
});
test('Falha no banco reabilita botões e preserva formulário',async()=>{
 const f=fixture();
 try{
   f.submit();f.auth.resolve({data:{user:{id:'coordenador-1'}},error:null});await flush();
   f.save.resolve({error:{message:'Conexão indisponível'}});await flush();
   assert.equal(f.d.getElementById('special-event-submit').disabled,false);
   assert.equal(f.d.getElementById('special-event-cancel').disabled,false);
   assert.equal(f.d.getElementById('special-event-name').value,'Evento teste');
   assert.match(f.messages.at(-1).text,/Conexão indisponível/);
   assert.equal(f.reloads.length,0);
 }finally{f.close();}
});
test('Logout invalida gravações e limpa formulário de eventos',()=>{
 assert.match(html,/function clearAdminPrivateSession\(\)\{[\s\S]*?\+\+specialEventSubmitVersion;/);
 assert.match(html,/function clearAdminPrivateSession\(\)\{[\s\S]*?resetSpecialEventEdit\(\);/);
 assert.match(html,/if\(specialEventSubmitting\)return;/);
});
