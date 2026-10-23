// FJU JAPAN — Regressão da tela de inscrições (sem banco ou usuários reais).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const snippetStart=html.indexOf('let signupLoadVersion=0;');
const snippetEnd=html.indexOf("el('inscricoes-refresh').addEventListener",snippetStart);
assert.ok(snippetStart>0&&snippetEnd>snippetStart,'Código de inscrições não encontrado');
const snippet=html.slice(snippetStart,snippetEnd);

function deferred(){
 let resolve;
 const promise=new Promise(r=>resolve=r);
 return {promise,resolve};
}
function setup(){
 const dom=new JSDOM(html,{url:'https://fjujapan.github.io/fju-connect-admin/',runScripts:'outside-only'});
 const w=dom.window,document=w.document;
 const profile={papel:'coordenador',polo_id:'polo-de-teste'};
 const requests=[],actions=[],refreshes=[];
 w.__profile=profile;
 w.__mockSupabase={
   rpc: (functionName,args)=>{
     if(functionName==='fju_listar_inscricoes_polo_detalhadas'){
       const next=deferred();requests.push(next);return next.promise;
     }
     if(functionName==='fju_decidir_inscricao_jovem'){
       actions.push(args);return Promise.resolve({data:'jovem-aprovado',error:null});
     }
     throw new Error('RPC inesperada: '+functionName);
   },
   storage:{from:()=>({
     createSignedUrl:async()=>({data:null,error:{message:'Foto não disponível no teste'}}),
     download:async()=>({data:null,error:{message:'Foto não disponível no teste'}})
   })}
 };
 w.__refreshes=refreshes;
 w.confirm=()=>true;
 w.eval(`var currentProfile=window.__profile;
     var supabase=window.__mockSupabase;
     var profileRequest=7;
     const el=id=>document.getElementById(id);
     const refreshAdminPriorities=(profile,requestId)=>window.__refreshes.push({profile,requestId});
     ${snippet}`);
 return {w,dom,profile,requests,actions,refreshes,document,
   cleanup:()=>dom.window.close()};
}
const row={
  id:'inscricao-01',usuario_id:'conta-01',nome:'Pessoa Exemplo',
  nascimento:'2005-04-02',nacionalidade_iso2:'BR',telefone:'09000000000',
  projetos_solicitados:['Esporte'],criado_em:'2026-10-23T01:00:00Z'
};
test('resposta atrasada de uma conta desconectada não exibe inscrições',async()=>{
 const ctx=setup();
 try{
   const pending=ctx.w.loadYouthSignups();
   assert.equal(ctx.requests.length,1);
   ctx.w.currentProfile=null;
   ctx.requests[0].resolve({data:[row],error:null});
   await pending;
   assert.equal(ctx.document.querySelector('#inscricoes-list').children.length,0);
   assert.equal(ctx.document.querySelector('#inscricoes-count').textContent,'');
 }finally{ctx.cleanup();}
});
test('somente a atualização mais recente altera a lista',async()=>{
 const ctx=setup();
 try{
   const older=ctx.w.loadYouthSignups();
   const latest=ctx.w.loadYouthSignups();
   ctx.requests[1].resolve({data:[row],error:null});
   await latest;
   assert.equal(ctx.document.querySelectorAll('.fju-signup-card').length,1);
   ctx.requests[0].resolve({data:[],error:null});
   await older;
   assert.equal(ctx.document.querySelectorAll('.fju-signup-card').length,1);
   assert.equal(ctx.document.querySelector('#inscricoes-count').textContent,'1 pendente(s)');
 }finally{ctx.cleanup();}
});
test('aprovando uma inscrição, recarrega a lista e atualiza as pendências',async()=>{
 const ctx=setup();
 try{
   const first=ctx.w.loadYouthSignups();
   ctx.requests[0].resolve({data:[row],error:null});
   await first;
   const approve=ctx.document.querySelector('.fju-signup-action-row button:first-child');
   assert.ok(approve);
   approve.click();
   for(let step=0;step<15&&ctx.requests.length<2;step++)await new Promise(setImmediate);
   assert.equal(ctx.actions.length,1);
   assert.equal(ctx.actions[0].p_acao,'aprovar');
   assert.equal(ctx.requests.length,2);
   ctx.requests[1].resolve({data:[],error:null});
   for(let step=0;step<15&&ctx.refreshes.length<1;step++)await new Promise(setImmediate);
   assert.equal(ctx.document.querySelectorAll('.fju-signup-card').length,0);
   assert.equal(ctx.refreshes.length,1);
   assert.equal(ctx.refreshes[0].profile,ctx.profile);
 }finally{ctx.cleanup();}
});
test('logout ou troca de conta bloqueia decisão em card antigo',async()=>{
 const ctx=setup();
 try{
   const initial=ctx.w.loadYouthSignups();
   ctx.requests[0].resolve({data:[row],error:null});
   await initial;
   const approve=ctx.document.querySelector('.fju-signup-action-row button:first-child');
   ctx.w.currentProfile=null;
   approve.click();
   assert.equal(ctx.actions.length,0);
 }finally{ctx.cleanup();}
});
test('solicitações de fichas também cancelam respostas atrasadas',()=>{
 assert.match(html,/let requestsLoadVersion=0;/);
 assert.match(html,/version!==requestsLoadVersion\|\|currentProfile!==profile/);
 assert.match(html,/function clearAdminPrivateSession\(\)/);
 assert.match(html,/\+\+signupLoadVersion;\s*\+\+requestsLoadVersion;/);
 assert.match(html,/void refreshAdminPriorities\(profile,profileRequest\)/);
});
