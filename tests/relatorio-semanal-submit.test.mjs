// FJU JAPAN | Testes do envio semanal com dados fictícios e Supabase simulado.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('let weeklyReportSubmitVersion=0;');
const end=html.indexOf("document.querySelectorAll('[data-report-tab]')",start);
assert.ok(start>0&&end>start,'Controlador do relatório semanal não encontrado');
const code=html.slice(start,end);
const fields=['weekly-firmes','weekly-novos','weekly-afastados','weekly-domingo','weekly-encontro','weekly-espirito','weekly-aguas','weekly-total'];
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function flush(){for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));}
function fixture(role='coordenador'){
 const dom=new JSDOM(html,{url:'https://fjujapan.github.io/fju-connect-admin/',runScripts:'outside-only'});
 const w=dom.window,d=w.document,auth=deferred(),save=deferred(),calls=[],messages=[],refreshes=[];
 const profile={papel:role,polo_id:'polo-A'};
 d.querySelector('#weekly-report-date').value='2026-10-18';
 if(role==='nacional'){
   const option=d.createElement('option');option.value='polo-B';option.textContent='Toyohashi';
   d.querySelector('#weekly-polo').append(option);
   d.querySelector('#weekly-polo').value='polo-B';
 }
 for(const [idx,id] of fields.entries()){
   const select=d.getElementById(id),option=d.createElement('option');
   option.value=String(idx+1);option.textContent=String(idx+1);
   select.append(option);select.value=option.value;
 }
 w.__profile=profile;w.__auth=auth;w.__save=save;
 w.__calls=calls;w.__messages=messages;w.__refreshes=refreshes;
 w.__supabase={
   auth:{getUser:()=>auth.promise},
   from:table=>{
     assert.equal(table,'fju_relatorios_semanais');
     return {upsert:(payload,config)=>{calls.push({payload,config});return save.promise;}};
   }
 };
 w.eval('var currentProfile=window.__profile;var profileRequest=4;'+
   'var supabase=window.__supabase;const el=id=>document.getElementById(id);'+
   'const message=(id,text,error)=>window.__messages.push({id,text,error});'+
   'const weeklySubmitText=index=>["Selecione a igreja antes de salvar.","Selecione uma data de domingo para este relatório.","O relatório desta semana será liberado no domingo (horário do Japão).","Preencha todos os campos numéricos do relatório.","Preencha todos os campos com números inteiros iguais ou maiores que zero.","Salvando relatório...","Relatório semanal salvo com sucesso.","Não foi possível salvar: ","Falha de conexão."][index];'+
   'const previousSundayISO=()=>"2026-10-18";'+
   'const loadDashboard=async()=>window.__refreshes.push("local");'+
   'const loadNationalReportOverview=async()=>window.__refreshes.push("nacional");'+code+
   '\nwindow.__logout=()=>{currentProfile=null;++weeklyReportSubmitVersion;weeklyReportSubmitting=false;setWeeklyReportSubmitting(false)};');
 return {dom,w,d,profile,auth,save,calls,messages,refreshes,
   submit:()=>d.querySelector('#weekly-report-form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true})),
   cleanup:()=>dom.window.close()};
}
test('Duplo envio do relatório só chama uma gravação, preservando o polo local',async()=>{
 const f=fixture();
 try{
   f.submit();f.submit();
   assert.equal(f.d.getElementById('weekly-report-submit').disabled,true);
   assert.equal(f.d.getElementById('weekly-report-form').getAttribute('aria-busy'),'true');
   f.auth.resolve({data:{user:{id:'coord-A'}},error:null});
   await flush();
   assert.equal(f.calls.length,1);
   assert.equal(f.calls[0].payload.polo_id,'polo-A');
   assert.equal(f.calls[0].payload.criado_por,'coord-A');
   assert.equal(f.calls[0].config.onConflict,'polo_id,semana_domingo');
   f.save.resolve({error:null});await flush();
   assert.equal(f.d.getElementById('weekly-report-submit').disabled,false);
   assert.equal(f.refreshes.at(-1),'local');
   assert.match(f.messages.at(-1).text,/salvo com sucesso/);
 }finally{f.cleanup();}
});
test('Nacional grava no polo explicitamente escolhido e atualiza visão nacional',async()=>{
 const f=fixture('nacional');
 try{
   f.submit();
   f.auth.resolve({data:{user:{id:'nacional-A'}},error:null});
   await flush();
   assert.equal(f.calls.length,1);
   assert.equal(f.calls[0].payload.polo_id,'polo-B');
   f.save.resolve({error:null});await flush();
   assert.equal(f.refreshes.at(-1),'nacional');
 }finally{f.cleanup();}
});
test('Logout antes da autorização impede enviar para o banco',async()=>{
 const f=fixture();
 try{
   f.submit();f.w.__logout();
   f.auth.resolve({data:{user:{id:'old-user'}},error:null});
   await flush();
   assert.equal(f.calls.length,0);
   assert.equal(f.refreshes.length,0);
 }finally{f.cleanup();}
});
test('Falha no banco avisa usuário e permite nova tentativa',async()=>{
 const f=fixture();
 try{
   f.submit();f.auth.resolve({data:{user:{id:'coord-A'}},error:null});await flush();
   f.save.resolve({error:{message:'Conexão temporariamente indisponível'}});
   await flush();
   assert.equal(f.d.getElementById('weekly-report-submit').disabled,false);
   assert.match(f.messages.at(-1).text,/Conexão temporariamente indisponível/);
   assert.equal(f.refreshes.length,0);
 }finally{f.cleanup();}
});
test('Campos vazios não viram automaticamente zeros',async()=>{
 const f=fixture();
 try{
   f.d.getElementById('weekly-firmes').value='';
   f.submit();await flush();
   assert.equal(f.calls.length,0);
   assert.equal(f.d.getElementById('weekly-report-submit').disabled,false);
   assert.match(f.messages.at(-1).text,/Preencha todos os campos/);
 }finally{f.cleanup();}
});
test('Limpeza no logout invalida gravações e o status do relatório',()=>{
 assert.match(html,/function clearAdminPrivateSession\(\)\{[\s\S]*?\+\+weeklyReportSubmitVersion;/);
 assert.match(html,/el\('weekly-report-message'\)\.textContent='';/);
});
