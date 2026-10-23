// FJU JAPAN — testes da consulta paginada, sem usuários ou banco reais.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf("let currentRequestFilter='pendente';");
const end=html.indexOf('function editYouth(',start);
assert.ok(start>0&&end>start,'Função de solicitações não encontrada');
const snippet=html.slice(start,end);
const totals={pendente:143,aprovada:50,rejeitada:19};
function fixture(){
  const dom=new JSDOM(html,{url:'https://fjujapan.github.io/fju-connect-admin/',runScripts:'outside-only'});
  const w=dom.window,doc=w.document,trace=[];
  const profile={papel:'coordenador',polo_id:'polo-A'};
  const query=table=>{
    const state={table,filters:[],fields:null,head:false};
    const api={
      select(fields,opts={}){state.fields=fields;state.head=!!opts.head;return api;},
      eq(key,value){state.filters.push([key,value]);return api;},
      order(){return api;},
      in(){return Promise.resolve({data:[],error:null});},
      range(start,end){
        trace.push({table,filters:[...state.filters],start,end});
        const status=state.filters.find(([field])=>field==='status')?.[1];
        const count=status?totals[status]:Object.values(totals).reduce((a,b)=>a+b,0);
        const data=Array.from({length:Math.min(end-start+1,Math.max(0,count-start))},(_,i)=>({
          id:'pedido-'+(start+i),jovem_id:'jovem-sem-ficha',polo_id:'polo-A',
          status:status==='aprovada'?'aprovada':status==='rejeitada'?'rejeitada':'pendente',
          tipo:'patente',justificativa:'Teste',criado_em:'2026-10-23T00:00:00Z'
        }));
        return Promise.resolve({data,error:null,count});
      },
      then(resolve,reject){
        trace.push({table,filters:[...state.filters],head:state.head});
        const status=state.filters.find(([field])=>field==='status')?.[1];
        return Promise.resolve({data:[],error:null,count:table==='fju_solicitacoes'?totals[status]??0:null}).then(resolve,reject);
      }
    };
    return api;
  };
  w.__profile=profile;w.__supabase={from:query};
  w.__access={requestsByRank:async()=>new Map()};
  w.eval('var currentProfile=window.__profile; var supabase=window.__supabase; const administrativeAccess=window.__access; const el=id=>document.getElementById(id); const message=(id,text)=>{el(id).textContent=text};\n'+snippet+'\nwindow.__loadRequests=loadYouthRequests;');
  return {dom,w,doc,trace,cleanup:()=>dom.window.close()};
}
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
test('Pendentes usam filtro Supabase antes da página e contadores completos',async()=>{
  const f=fixture();
  try{
    await f.w.__loadRequests();
    const main=f.trace.find(x=>x.table==='fju_solicitacoes'&&Number.isInteger(x.start));
    assert.deepEqual(main.filters,[['polo_id','polo-A'],['status','pendente']]);
    assert.equal(main.start,0);assert.equal(main.end,24);
    assert.equal(f.doc.querySelectorAll('#requests-list .report-card').length,25);
    assert.equal(f.doc.querySelector('#requests-load-more').hidden,false);
    assert.match(f.doc.querySelector('#requests-message').textContent,/25 de 143/);
    assert.match(f.doc.querySelector('[data-request-filter="aprovada"]').textContent,/\(50\)/);
    assert.match(f.doc.querySelector('[data-request-filter="rejeitada"]').textContent,/\(19\)/);
  }finally{f.cleanup();}
});
test('Carregar mais amplia de 25 para 50 pedidos',async()=>{
  const f=fixture();
  try{
    await f.w.__loadRequests();
    f.doc.querySelector('#requests-load-more').click();
    await flush();
    const pageCalls=f.trace.filter(x=>Number.isInteger(x.start));
    assert.equal(pageCalls.length,2);
    assert.equal(pageCalls[1].end,49);
    assert.equal(f.doc.querySelectorAll('#requests-list .report-card').length,50);
  }finally{f.cleanup();}
});
test('Aprovadas reinicia paginação; Todas remove somente filtro de status',async()=>{
  const f=fixture();
  try{
    await f.w.__loadRequests();
    f.doc.querySelector('#requests-load-more').click();
    await flush();
    f.doc.querySelector('[data-request-filter="aprovada"]').click();
    await flush();
    let last=f.trace.filter(x=>Number.isInteger(x.start)).at(-1);
    assert.equal(last.end,24);
    assert.ok(last.filters.some(([key,val])=>key==='status'&&val==='aprovada'));
    f.doc.querySelector('[data-request-filter="todas"]').click();
    await flush();
    last=f.trace.filter(x=>Number.isInteger(x.start)).at(-1);
    assert.equal(last.end,24);
    assert.ok(!last.filters.some(([key])=>key==='status'));
    assert.ok(last.filters.some(([key,val])=>key==='polo_id'&&val==='polo-A'));
  }finally{f.cleanup();}
});
