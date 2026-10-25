// FJU JAPAN | Paginação de solicitações de eventos — dados fictícios.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('async function loadEventRequests(');
const end=html.indexOf('/* Data do evento:',start);
assert.ok(start>0&&end>start,'Consulta de solicitações não encontrada');
const source=html.slice(start,end);
const makeRow=(i,polo='polo-A',tipo='inclusao')=>({
 id:'pedido-'+String(i).padStart(4,'0'),polo_id:polo,tipo,
 evento_id:tipo==='exclusao'?'evento-'+i:null,
 dados_propostos:{nome_evento:'Evento '+i,data_evento:'2026-10-23',total_jovens:i},
 status:'pendente',criado_em:'2026-10-23T08:00:00Z'
});
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function flush(){for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));}
function fixture(rows,opts={}){
 const dom=new JSDOM(html,{url:'https://fjujapan.github.io/fju-connect-admin/',runScripts:'outside-only'});
 const w=dom.window,d=w.document,role=opts.role||'nacional';
 const profile={papel:role,polo_id:role==='coordenador'?'polo-A':null};
 const queries=[],loading=opts.delayedPage??-1,pending=deferred(),pageError=opts.pageError??-1;
 w.__profile=profile;w.__queries=queries;
 w.__db={
  from:table=>{
   assert.equal(table,'fju_solicitacoes_eventos');
   const clauses=[];
   const q={
    eq:(column,value)=>{clauses.push([column,String(value)]);return q;},
    order:()=>q,
    range:(from,to)=>{
     queries.push({from,to,clauses:clauses.map(p=>p.slice())});
     if(from===pageError)return Promise.resolve({data:null,error:{message:'Falha na página 2'}});
     if(from===loading)return pending.promise;
     let matched=rows;
     for(const [column,value] of clauses)matched=matched.filter(r=>String(r[column])===value);
     return Promise.resolve({data:matched.slice(from,to+1),error:null});
    }
   };
   return {select:()=>q};
  }
 };
 w.eval('var currentProfile=window.__profile;var specialEventsLoadVersion=1;'+
   'var profileRequest=5;var supabase=window.__db;'+
   'const el=id=>document.getElementById(id);'+
   'const message=()=>{};'+
   'const refreshAdminPriorities=()=>{};'+
   'const specialEventRequestsStatus=index=>["Não foi possível carregar solicitações: ","Erro"," pendente"," pendentes","Incluir","Excluir","Evento indisponível","Igreja não identificada"," jovens","Aprovar","Rejeitar","Registrando decisão…","Solicitação aprovada.","Solicitação rejeitada.","Não foi possível decidir: ","Falha de conexão."," a solicitação de ","inclusão","exclusão"," de ","evento","?","pendente","Data não informada","pt-BR","Aprovar a solicitação de {type} de {event}?","Rejeitar a solicitação de {type} de {event}?"][index];'+
 'const loadSpecialEvents=async()=>{};'+
   source+'\nwindow.__load=loadEventRequests;window.__logout=()=>{currentProfile=null;++specialEventsLoadVersion};');
 return {dom,w,d,pending,queries,profile,close:()=>dom.window.close()};
}
test('201 solicitações são exibidas; nenhuma fica escondida após as 200 primeiras',async()=>{
 const rows=Array.from({length:201},(_,i)=>makeRow(i+1));
 rows[200]=makeRow(201,'polo-A','exclusao');
 const f=fixture(rows);
 try{
   const removals=await f.w.__load([],new Map([['polo-A','Hamamatsu']]));
   assert.deepEqual(f.queries.map(q=>[q.from,q.to]),[[0,199],[200,399]]);
   assert.equal(f.d.getElementById('event-requests-count').textContent,'201 pendentes');
   assert.equal(f.d.querySelectorAll('#event-requests-list .event-request-card').length,201);
   assert.equal(f.d.querySelectorAll('#event-requests-list .actions').length,201);
   assert.equal(removals.has('evento-201'),true);
 }finally{f.close();}
});
test('Coordenador consulta exclusivamente os pedidos do próprio polo',async()=>{
 const rows=[makeRow(1,'polo-A'),makeRow(2,'polo-B'),makeRow(3,'polo-A','exclusao')];
 const f=fixture(rows,{role:'coordenador'});
 try{
   const removals=await f.w.__load([],new Map([['polo-A','Hamamatsu']]));
   assert.equal(f.d.querySelectorAll('#event-requests-list .event-request-card').length,2);
   assert.equal(f.queries.length,1);
   assert.deepEqual(f.queries[0].clauses,[['status','pendente'],['polo_id','polo-A']]);
   assert.equal(removals.has('evento-3'),true);
   assert.equal(f.d.querySelectorAll('#event-requests-list .actions button').length,0);
 }finally{f.close();}
});
test('Falha na segunda página não exibe lista parcial nem autoriza exclusão repetida',async()=>{
 const rows=Array.from({length:201},(_,i)=>makeRow(i+1));
 const f=fixture(rows,{pageError:200});
 try{
   const removals=await f.w.__load([],new Map());
   assert.equal(removals,null);
   assert.equal(f.d.querySelectorAll('#event-requests-list .event-request-card').length,0);
   assert.match(f.d.getElementById('event-requests-list').textContent,/Falha na página 2/);
   assert.equal(f.d.getElementById('event-requests-count').textContent,'Erro');
 }finally{f.close();}
});
test('Logout durante página atrasada descarta os resultados antigos',async()=>{
 const rows=Array.from({length:201},(_,i)=>makeRow(i+1));
 const f=fixture(rows,{delayedPage:200});
 try{
   const loading=f.w.__load([],new Map());
   await flush();
   assert.equal(f.queries.length,2);
   f.w.__logout();
   f.pending.resolve({data:[rows[200]],error:null});
   assert.equal(await loading,null);
   assert.equal(f.d.querySelectorAll('#event-requests-list .event-request-card').length,0);
 }finally{f.close();}
});
