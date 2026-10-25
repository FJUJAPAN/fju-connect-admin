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
 'const specialEventRequestsStatus=index=>["Não foi possível carregar solicitações: ","Erro"," pendente"," pendentes","Incluir","Excluir","Evento indisponível","Igreja não identificada"," jovens","Aprovar","Rejeitar","Registrando decisão…","Solicitação aprovada.","Solicitação rejeitada.","Não foi possível decidir: ","Falha de conexão."," a solicitação de ","inclusão","exclusão"," de ","evento","?","pendente","Data não informada","pt-BR","Aprovar a solicitação de {type} de {event}?","Rejeitar a solicitação de {type} de {event}?"][index];'+
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
test('Confirmação de aprovação usa o nome do evento e cancelar não envia RPC',async()=>{
 const f=fixture();
 try{
   await render(f);
   const questions=[];
   f.w.confirm=question=>{questions.push(question);return false;};
   const buttons=[...f.doc.querySelectorAll('#event-requests-list .actions button')];
   buttons[0].click();
   assert.deepEqual(questions,['Aprovar a solicitação de inclusão de Evento Teste?']);
   assert.equal(f.calls.length,0);
   assert.equal(buttons[0].disabled,false);
   assert.equal(buttons[1].disabled,false);
   buttons[1].click();
   assert.deepEqual(questions,['Aprovar a solicitação de inclusão de Evento Teste?','Rejeitar a solicitação de inclusão de Evento Teste?']);
   assert.equal(f.calls.length,0);
 }finally{f.cleanup();}
});
test('Confirmações têm frases naturais em português, japonês e inglês',()=>{
 const dictionary={
  pt:{approve:'Aprovar a solicitação de {type} de {event}?',reject:'Rejeitar a solicitação de {type} de {event}?',add:'inclusão',remove:'exclusão'},
  ja:{approve:'{event}の{type}申請を承認しますか？',reject:'{event}の{type}申請を却下しますか？',add:'追加',remove:'削除'},
  en:{approve:'Approve the {type} request for {event}?',reject:'Reject the {type} request for {event}?',add:'addition',remove:'deletion'}
 };
 const expected={
  pt:['Aprovar a solicitação de inclusão de Evento Teste?','Rejeitar a solicitação de exclusão de Evento Teste?'],
  ja:['Evento Testeの追加申請を承認しますか？','Evento Testeの削除申請を却下しますか？'],
  en:['Approve the addition request for Evento Teste?','Reject the deletion request for Evento Teste?']
 };
 const start=html.indexOf('const specialEventRequestsStatusI18n=');
 const end=html.indexOf('function specialEventRequestsStatus(',start);
 assert.ok(start>=0&&end>start,'Dicionário de solicitações não encontrado');
 const source=html.slice(start,end);
 const json=source.slice(source.indexOf('=')+1).trim().replace(/;$/,'');
 const actual=JSON.parse(json);
 for(const lang of ['pt','ja','en']){
  const messages=[actual[lang][25].replace('{type}',actual[lang][17]).replace('{event}','Evento Teste'),actual[lang][26].replace('{type}',actual[lang][18]).replace('{event}','Evento Teste')];
  assert.deepEqual(messages,expected[lang]);
  assert.equal(actual[lang][25],dictionary[lang].approve);
  assert.equal(actual[lang][26],dictionary[lang].reject);
 }
});
test('Solicitações respeitam idioma selecionado e usam português como alternativa',()=>{
 const start=html.indexOf('const specialEventRequestsStatusI18n=');
 const end=html.indexOf('const adminReportHeadings=',start);
 assert.ok(start>=0&&end>start,'Traduções das solicitações não encontradas');
 const dom=new JSDOM('',{runScripts:'outside-only'});
 try{
  const w=dom.window;
  w.eval('var adminLanguageSelect={value:"ja"};'+html.slice(start,end)+'window.__status=specialEventRequestsStatus;');
  assert.equal(w.__status(9),'承認');
  assert.equal(w.__status(10),'却下');
  assert.equal(w.__status(22),'承認待ち');
  assert.equal(w.__status(24),'ja-JP');
  w.adminLanguageSelect.value='en';
  assert.equal(w.__status(9),'Approve');
  assert.equal(w.__status(22),'pending');
  assert.equal(w.__status(24),'en-US');
  w.adminLanguageSelect.value='xx';
  assert.equal(w.__status(9),'Aprovar');
  assert.equal(w.__status(24),'pt-BR');
 }finally{dom.window.close();}
});
test('Troca de idioma atualiza eventos somente após salvar preferência',()=>{
 const start=html.indexOf("adminLanguageSelect.addEventListener('change'");
 const end=html.indexOf('const administrativeAccess=',start);
 assert.ok(start>=0&&end>start,'Controle de idioma não encontrado');
 const handler=html.slice(start,end);
 assert.match(handler,/supabase\.auth\.updateUser\(\{data:\{preferred_language:value\}\}\)/);
 assert.match(handler,/if\(error\)throw error;setAdminLanguage\(value\);/);
 assert.match(handler,/if\(currentProfile\)void loadSpecialEvents\(\)/);
 const success=handler.indexOf('if(currentProfile)void loadSpecialEvents()');
 const failure=handler.indexOf('catch(e)');
 assert.ok(success>0&&failure>success,'Atualização de eventos deve ocorrer apenas no caminho de sucesso');
});
test('Falha ao salvar idioma restaura preferência anterior sem nova requisição',()=>{
 const start=html.indexOf("adminLanguageSelect.addEventListener('change'");
 const end=html.indexOf('const administrativeAccess=',start);
 assert.ok(start>=0&&end>start);
 const handler=html.slice(start,end);
 assert.match(handler,/const previousLanguage=\['pt','ja','en'\]\.find/);
 assert.match(handler,/document\.documentElement\.lang/);
 assert.doesNotMatch(handler,/localStorage\.getItem/);
 assert.match(handler,/catch\(e\)\{setAdminLanguage\(previousLanguage\)/);
 assert.doesNotMatch(handler,/supabase\.auth\.getUser\(/);
 assert.match(handler,/finally\{adminLanguageSelect\.disabled=false;\}/);
});
test('Idioma inicial tolera armazenamento local bloqueado',()=>{
 const start=html.indexOf("let initialAdminLanguage='pt';");
 const end=html.indexOf("adminLanguageSelect.addEventListener('change'",start);
 assert.ok(start>=0&&end>start,'Inicialização segura do idioma não encontrada');
 const source=html.slice(start,end);
 const dom=new JSDOM('',{runScripts:'outside-only'});
 try{
  const w=dom.window;
  w.eval('const localStorage={getItem(){throw new Error("Storage blocked")}};var chosen="";function setAdminLanguage(value){chosen=value;}'+source+'window.__chosen=chosen;');
  assert.equal(w.__chosen,'pt');
 }finally{dom.window.close();}
});
test('Carregamento do perfil prioriza idioma salvo e tolera armazenamento bloqueado',()=>{
 const start=html.indexOf('async function loadProfile(user){');
 const end=html.indexOf("const initialRequest=profileRequest;",start);
 assert.ok(start>=0&&end>start);
 const source=html.slice(start,end);
 assert.match(source,/user\.user_metadata\?\.preferred_language/);
 assert.match(source,/try\{profileLanguage=localStorage\.getItem/);
 assert.match(source,/catch\(_\)\{\}/);
 assert.match(source,/setAdminLanguage\(profileLanguage\)/);
});
test('Idioma anterior é detectado corretamente em português, japonês e inglês',()=>{
 const start=html.indexOf("adminLanguageSelect.addEventListener('change'");
 const end=html.indexOf('const administrativeAccess=',start);
 assert.ok(start>=0&&end>start);
 const handler=html.slice(start,end);
 const match=handler.match(/const previousLanguage=([^;]+);/);
 assert.ok(match,'Expressão para detectar idioma anterior não encontrada');
 const dom=new JSDOM('',{runScripts:'outside-only'});
 try{
  const w=dom.window;
  for(const [htmlLang,expected] of [['pt-BR','pt'],['ja','ja'],['en','en'],['fr','pt']]){
   w.document.documentElement.lang=htmlLang;
   w.eval('window.__previous='+match[1]+';');
   assert.equal(w.__previous,expected);
  }
 }finally{dom.window.close();}
});
test('Pacote 1/5: todas as traduções de solicitações têm índices completos',()=>{
 const start=html.indexOf('const specialEventRequestsStatusI18n=');
 const end=html.indexOf('function specialEventRequestsStatus(',start);
 const dict=JSON.parse(html.slice(start,end).split('=',2)[1].trim().replace(/;$/,''));
 for(const lang of ['pt','ja','en']){
  assert.equal(dict[lang].length,27,lang);
  for(const [i,label] of dict[lang].entries())assert.ok(typeof label==='string'&&label.length>0,lang+' '+i);
 }
});
test('Pacote 2/5: datas seguem formato regional e mostram ausência traduzida',()=>{
 const start=html.indexOf('const specialEventRequestsStatusI18n=');
 const end=html.indexOf('function specialEventRequestsStatus(',start);
 const dict=JSON.parse(html.slice(start,end).split('=',2)[1].trim().replace(/;$/,''));
 for(const [lang,locale,missing] of [['pt','pt-BR','Data não informada'],['ja','ja-JP','日付未入力'],['en','en-US','Date not provided']]){
  assert.equal(dict[lang][24],locale);
  assert.equal(dict[lang][23],missing);
  assert.ok(new Date('2026-10-25T12:00:00Z').toLocaleDateString(locale,{timeZone:'UTC'}).includes('2026')||locale==='en-US');
 }
});
test('Pacote 3/5: ações e estados de eventos estão traduzidos',()=>{
 const start=html.indexOf('const specialEventRequestsStatusI18n=');
 const end=html.indexOf('function specialEventRequestsStatus(',start);
 const dict=JSON.parse(html.slice(start,end).split('=',2)[1].trim().replace(/;$/,''));
 assert.deepEqual([dict.pt[9],dict.pt[10],dict.pt[22]],['Aprovar','Rejeitar','pendente']);
 assert.deepEqual([dict.ja[9],dict.ja[10],dict.ja[22]],['承認','却下','承認待ち']);
 assert.deepEqual([dict.en[9],dict.en[10],dict.en[22]],['Approve','Reject','pending']);
});
test('Pacote 4/5: confirmação de inclusão e exclusão preserva o nome do evento',()=>{
 const start=html.indexOf('const specialEventRequestsStatusI18n=');
 const end=html.indexOf('function specialEventRequestsStatus(',start);
 const dict=JSON.parse(html.slice(start,end).split('=',2)[1].trim().replace(/;$/,''));
 for(const lang of ['pt','ja','en'])for(const action of [25,26])for(const kind of [17,18]){
  const phrase=dict[lang][action].replace('{type}',dict[lang][kind]).replace('{event}','Festival FJU');
  assert.ok(phrase.includes('Festival FJU'));
  assert.ok(!phrase.includes('{type}')&&!phrase.includes('{event}'));
 }
});
test('Pacote 5/5: erros e respostas de aprovação têm traduções independentes',()=>{
 const start=html.indexOf('const specialEventRequestsStatusI18n=');
 const end=html.indexOf('function specialEventRequestsStatus(',start);
 const dict=JSON.parse(html.slice(start,end).split('=',2)[1].trim().replace(/;$/,''));
 for(const lang of ['pt','ja','en']){
  assert.notEqual(dict[lang][12],dict[lang][13]);
  assert.notEqual(dict[lang][14],dict[lang][15]);
  assert.ok(dict[lang][11].length>3);
 }
});
function evaluateProfileLanguage(metadata,stored={},blocked=false){
 const start=html.indexOf('async function loadProfile(user){');
 const end=html.indexOf('const initialRequest=profileRequest;',start);
 assert.ok(start>=0&&end>start,'Carregamento do perfil não encontrado');
 const source=html.slice(start,end);
 const dom=new JSDOM('',{runScripts:'outside-only'});
 try{
  const w=dom.window;
  w.__metadata=metadata;
  w.__storage=stored;
  w.__blocked=blocked;
  Object.defineProperty(w,'localStorage',{configurable:true,value:{getItem(key){if(blocked)throw Error('Storage blocked');return stored[key]||null;}}});
  w.eval('var chosen="";function setAdminLanguage(lang){chosen=lang;}'+source+'}\nwindow.__loadLanguage=loadProfile;');
  return w.__loadLanguage({user_metadata:metadata}).then(()=>w.eval('chosen')).finally(()=>dom.window.close());
 }catch(e){dom.window.close();throw e;}
}
test('Pacote perfil 1/5: preferência do usuário prevalece sobre armazenamento',async()=>{
 assert.equal(await evaluateProfileLanguage({preferred_language:'ja'},{fju_lang:'en'}),'ja');
});
test('Pacote perfil 2/5: idioma inglês do perfil funciona sem armazenamento',async()=>{
 assert.equal(await evaluateProfileLanguage({preferred_language:'en'},{},true),'en');
});
test('Pacote perfil 3/5: idioma local é recuperado quando perfil não tem preferência',async()=>{
 assert.equal(await evaluateProfileLanguage({}, {fju_lang:'ja'}),'ja');
});
test('Pacote perfil 4/5: armazenamento secundário é usado quando principal está vazio',async()=>{
 assert.equal(await evaluateProfileLanguage({}, {'fju-connect-lang':'en'}),'en');
});
test('Pacote perfil 5/5: armazenamento bloqueado mantém fallback português',async()=>{
 assert.equal(await evaluateProfileLanguage({}, {},true),'pt');
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
