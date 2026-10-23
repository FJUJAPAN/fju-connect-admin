// FJU JAPAN | Contadores do painel: somente fichas ativas e último domingo.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const countStart=html.indexOf('async function countRows(');
const countEnd=html.indexOf('function localISODate(',countStart);
const dashboardStart=html.indexOf('let dashboardLoadVersion=0;');
const dashboardEnd=html.indexOf('async function loadProfile(',dashboardStart);
assert.ok(countStart>0&&countEnd>countStart&&dashboardStart>0&&dashboardEnd>dashboardStart);
const source=html.slice(countStart,countEnd)+'\n'+html.slice(dashboardStart,dashboardEnd);

function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function settle(){for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));}
function fixture(role='coordenador',options={}){
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://fjujapan.github.io/fju-connect-admin/'});
 const w=dom.window,d=w.document;
 const profile={papel:role,polo_id:role==='coordenador'?'polo-A':null};
 const calls=[],pendingYouth=deferred();
 const supplies={
   fju_jovens:Object.prototype.hasOwnProperty.call(options,'youthCount')?options.youthCount:12,
   fju_polos:23
 };
 w.__profile=profile;
 w.__db={from:table=>{
   const details={table,filters:[],select:null};
   calls.push(details);
   const q={
     select:(fields,config)=>{details.select={fields,config};return q;},
     is:(column,value)=>{details.filters.push(['is',column,value]);return q;},
     eq:(column,value)=>{details.filters.push(['eq',column,value]);return q;},
     limit:value=>{details.limit=value;return q;},
     then:(resolve,reject)=>{
       if(table==='fju_relatorios_semanais')
         return Promise.resolve(options.reportError
           ?{data:null,error:{message:'DB error'}}
           :{data:options.reportSent?[{polo_id:'polo-A'}]:[],error:null}).then(resolve,reject);
       const response=options.deferYouth&&table==='fju_jovens'
         ?pendingYouth.promise
         :Promise.resolve({count:supplies[table],error:null});
       return response.then(resolve,reject);
     }
   };
   return q;
 }};
 w.eval('var currentProfile=window.__profile;var profileRequest=4;var currentPoloNome="Hamamatsu";'+
   'var supabase=window.__db;const el=id=>document.getElementById(id);'+
   'const previousSundayISO=()=>"2026-10-18";'+source+
   '\nwindow.__dashboard=loadDashboard;'+
   'window.__logout=()=>{currentProfile=null;++profileRequest;++dashboardLoadVersion};');
 return {dom,w,d,profile,calls,pendingYouth,close:()=>dom.window.close()};
}
test('Coordenador conta apenas fichas ativas do seu polo',async()=>{
 const f=fixture('coordenador',{youthCount:7});
 try{
   await f.w.__dashboard(f.profile,4);
   const q=f.calls.find(x=>x.table==='fju_jovens');
   assert.ok(q);
   assert.deepEqual(q.filters,[['is','excluido_em',null],['eq','polo_id','polo-A']]);
   assert.equal(q.select.config.head,true);
   assert.equal(q.select.config.count,'exact');
   assert.equal(f.d.getElementById('youth-count').textContent,'7');
   assert.equal(f.d.getElementById('scope-count').textContent,'FJU Hamamatsu');
 }finally{f.close();}
});
test('Nacional conta somente fichas ativas e total de polos sem limitar por igreja',async()=>{
 const f=fixture('nacional',{youthCount:275});
 try{
   await f.w.__dashboard(f.profile,4);
   const youth=f.calls.find(x=>x.table==='fju_jovens');
   const polos=f.calls.find(x=>x.table==='fju_polos');
   assert.deepEqual(youth.filters,[['is','excluido_em',null]]);
   assert.deepEqual(polos.filters,[]);
   assert.equal(f.d.getElementById('scope-count').textContent,'23');
   assert.equal(f.d.getElementById('youth-count').textContent,'275');
 }finally{f.close();}
});
test('Status local consulta último domingo liberado, não o próximo domingo',async()=>{
 const f=fixture('coordenador',{reportSent:false});
 try{
   await f.w.__dashboard(f.profile,4);
   const report=f.calls.find(x=>x.table==='fju_relatorios_semanais');
   assert.deepEqual(report.filters,[
     ['eq','polo_id','polo-A'],
     ['eq','semana_domingo','2026-10-18']
   ]);
   assert.equal(f.d.getElementById('pending-count').textContent,'● Pendente');
 }finally{f.close();}
});
test('Relatório enviado do último domingo mostra sucesso',async()=>{
 const f=fixture('coordenador',{reportSent:true});
 try{
   await f.w.__dashboard(f.profile,4);
   assert.equal(f.d.getElementById('pending-count').textContent,'✓ Enviado');
 }finally{f.close();}
});
test('Logout descarta respostas atrasadas da contagem de jovens',async()=>{
 const f=fixture('coordenador',{deferYouth:true});
 try{
   const loading=f.w.__dashboard(f.profile,4);
   await settle();
   assert.equal(f.d.getElementById('youth-count').textContent,'…');
   f.w.__logout();
   f.pendingYouth.resolve({count:99,error:null});
   await loading;
   assert.equal(f.d.getElementById('youth-count').textContent,'…');
   assert.equal(f.calls.some(x=>x.table==='fju_relatorios_semanais'),false);
 }finally{f.close();}
});
test('Contagem sem valor não deve ser mostrada como zero silenciosamente',async()=>{
 const f=fixture('coordenador',{youthCount:null});
 try{
   await f.w.__dashboard(f.profile,4);
   // Null não é número válido quando Supabase não retorna a contagem exata.
   assert.equal(f.d.getElementById('youth-count').textContent,'Indisponível');
 }finally{f.close();}
});
test('O painel limpa contagens antigas no logout',()=>{
 assert.match(html,/function clearAdminPrivateSession\(\)\{[\s\S]*?\+\+dashboardLoadVersion;/);
 assert.match(html,/el\('youth-count'\)\.textContent='—';/);
 assert.match(html,/Último relatório semanal/);
});
