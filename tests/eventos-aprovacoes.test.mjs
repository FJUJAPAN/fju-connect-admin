// FJU JAPAN | Decisões de eventos especiais (dados fictícios, sem Supabase real).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('async function loadEventRequests(');
const end=html.indexOf('/* Data do evento:',begin);
assert.ok(begin>0&&end>begin,'Controlador de aprovações não encontrado');
const src=html.slice(begin,end);
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function flush(){for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));}
function fixture(role='nacional'){
 const dom=new JSDOM(html,{url:'https://fjujapan.github.io/fju-connect-admin/',runScripts:'outside-only'});
 const w=dom.window,doc=w.document,decision=deferred(),calls=[],refreshes=[],messages=[];
 const profile={papel:role,polo_id:role==='nacional'?null:'polo-A'};
 const req={id:'pedido-01',tipo:'inclusao',evento_id:null,polo_id:'polo-A',
   dados_propostos:{nome_evento:'Evento Teste',data_evento:'2026-10-23',total_jovens:10},status:'pendente',criado_em:'2026-10-23'};
 w.__profile=profile;w.__calls=calls;w.__refreshes=refreshes;w.__messages=messages;
 w.__db={
  from:table=>{
    assert.equal(table,'fju_solicitacoes_eventos');
    const query={eq:()=>query,order:()=>query,range:()=>Promise.resolve({data:[req],error:null})};
    return {select:()=>query};
  },
  rpc:(name,args)=>{calls.push({name,args});return decision.promise;}
 };
 w.confirm=()=>true;
 w.eval('var currentProfile=window.__profile;var specialEventsLoadVersion=1;'+
 'var profileRequest=4;var supabase=window.__db;'+
 'const el=id=>document.getElementById(id);'+
 'const message=(id,msg,error)=>window.__messages.push({id,msg,error});'+
 'const refreshAdminPriorities=(profile,version)=>window.__refreshes.push("priorities");'+
 'const specialEventRequestsStatus=index=>["Não foi possível carregar solicitações: ","Erro"," pendente"," pendentes","Incluir","Excluir","Evento indisponível","Igreja não identificada"," jovens","Aprovar","Rejeitar","Registrando decisão…","Solicitação aprovada.","Solicitação rejeitada.","Não foi possível decidir: ","Falha de conexão."," a solicitação de ","inclusão","exclusão"," de ","evento","?","pendente"][index];'+
 'const loadSpecialEvents=async()=>window.__refreshes.push("events");'+src+
 '\nwindow.__loadRequests=loadEventRequests;window.__logout=()=>{currentProfile=null;++specialEventsLoadVersion};');
 return {dom,w,doc,profile,req,decision,calls,refreshes,messages,cleanup:()=>dom.window.close()};
}
async function render(f){await f.w.__loadRequests([] ,new Map([['polo-A','Hamamatsu']]));}
test('Aprovação de evento bloqueia os dois botões e faz somente uma RPC',async()=>{
 const f=fixture();
 try{
   await render(f);
   const buttons=[...f.doc.querySelectorAll('#event-requests-list .actions button')];
   assert.equal(buttons.length,2);
   buttons[0].click();buttons[1].click();buttons[0].click();
   assert.equal(f.calls.length,1);
   assert.equal(f.calls[0].name,'fju_decidir_solicitacao_evento');
   assert.equal(f.calls[0].args.p_id,'pedido-01');
   assert.equal(f.calls[0].args.p_aprovar,true);
   assert.equal(buttons[0].disabled,true);
   assert.equal(buttons[1].disabled,true);
   f.decision.resolve({error:null});
   await flush();
   assert.deepEqual(f.refreshes,['events','priorities']);
 }finally{f.cleanup();}
});
test('Erro no Supabase libera aprovação e rejeição para tentar novamente',async()=>{
 const f=fixture();
 try{
   await render(f);
   const buttons=[...f.doc.querySelectorAll('#event-requests-list .actions button')];
   buttons[1].click();
   f.decision.resolve({error:{message:'Falha temporária'}});
   await flush();
   assert.equal(buttons[0].disabled,false);
   assert.equal(buttons[1].disabled,false);
   assert.match(f.doc.querySelector('#event-requests-list [role="status"]').textContent,/Falha temporária/);
   assert.equal(f.refreshes.length,0);
 }finally{f.cleanup();}
});
test('Mudança de perfil durante a decisão não atualiza painel antigo',async()=>{
 const f=fixture();
 try{
   await render(f);
   f.doc.querySelector('#event-requests-list .actions button').click();
   f.w.__logout();
   f.decision.resolve({error:null});
   await flush();
   assert.equal(f.refreshes.length,0);
   assert.equal(f.messages.length,0);
 }finally{f.cleanup();}
});
test('Coordenador não recebe botões de aprovação nacional',async()=>{
 const f=fixture('coordenador');
 try{
   await render(f);
   assert.equal(f.doc.querySelectorAll('#event-requests-list .actions button').length,0);
 }finally{f.cleanup();}
});
test('Carregamento de eventos verifica erros reais de polo e estado da sessão',()=>{
 const begin=html.indexOf('let specialEventsLoadVersion=0;');
 const end=html.indexOf('async function loadEventRequests(',begin);
 assert.ok(begin>=0&&end>begin);
 const loader=html.slice(begin,end);
 assert.match(loader,/\{data:polos,error:poloError\}/);
 assert.match(loader,/currentProfile!==profile/);
 assert.match(html,/function clearAdminPrivateSession\(\)\{[\s\S]*?\+\+specialEventsLoadVersion;/);
});
