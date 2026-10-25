// FJU JAPAN — Relatórios nacionais: semanas antigas e respostas simultâneas.
// Testes de interface com dados fictícios, sem conexão com Supabase.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('let nationalReportLoadVersion=0;');
const end=html.indexOf('function applyNationalFilters(){',begin);
assert.ok(begin>0&&end>begin,'Visão nacional não encontrada');
const code=html.slice(begin,end);
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function fixture(){
  const dom=new JSDOM(html,{url:'https://fjujapan.github.io/fju-connect-admin/',runScripts:'outside-only'});
  const w=dom.window,d=w.document,requests=[];
  const profile={papel:'nacional',polo_id:null};
  const polos=[{id:'polo-A',nome:'Hamamatsu'},{id:'polo-B',nome:'Toyohashi'}];
  const from=table=>{
    if(table==='fju_polos')return {
      select:()=>({order:()=>Promise.resolve({data:polos,error:null})})
    };
    assert.equal(table,'fju_relatorios_semanais');
    const state={lower:null,upper:null};
    const api={
      gte(key,value){assert.equal(key,'semana_domingo');state.lower=value;return api;},
      lte(key,value){assert.equal(key,'semana_domingo');state.upper=value;return api;},
      order(){const pending=deferred();requests.push({...state,pending});return pending.promise;}
    };
    return {select:fields=>{assert.equal(fields,'*');return api;}};
  };
  w.__profile=profile;w.__db={from};
  w.__filters=0;
  w.eval('var currentProfile=window.__profile; var supabase=window.__db;'+
    'const el=id=>document.getElementById(id);'+
    'const nationalReportStatus=index=>["Consultando polos e relatórios...","Nenhum relatório registrado para "," polo(s) exibido(s)"][index];'+
    'const previousSundayISO=()=>"2026-10-18";'+
    'const normalizeReportSunday=value=>value||"2026-10-18";'+
    'const updateNationalWeekRange=()=>{};'+
    'const reportDeadlineStatus=r=>r?"prazo":"pendente";'+
    'const applyNationalFilters=()=>{window.__filters++};'+
    code+
    '\nwindow.__load=loadNationalReportOverview;'+
    'window.__logout=()=>{currentProfile=null;++nationalReportLoadVersion};');
  return {dom,w,d,requests,cleanup:()=>dom.window.close()};
}
const report=(date,total)=>({
  polo_id:'polo-A',semana_domingo:date,created_at:date+'T12:00:00+09:00',
  total_jovens_unicos:total,jovens_firmes:total,jovens_novos:3
});
function summaryValue(d,label){
  const boxes=[...d.querySelectorAll('#national-report-summary .stat')];
  const box=boxes.find(b=>b.textContent.startsWith(label));
  return box?.querySelector('b')?.textContent;
}
test('Data histórica consulta somente 8 domingos anteriores ao selecionado',async()=>{
  const f=fixture();
  try{
    f.d.getElementById('national-report-date').value='2024-06-02';
    const promise=f.w.__load();
    assert.equal(f.requests.length,1);
    assert.equal(f.requests[0].upper,'2024-06-02');
    assert.equal(f.requests[0].lower,'2024-04-14');
    f.requests[0].pending.resolve({data:[report('2024-06-02',12),report('2024-05-26',6)],error:null});
    await promise;
    assert.equal(summaryValue(f.d,'Polos'),'2');
    assert.equal(summaryValue(f.d,'Relatórios enviados'),'1');
    assert.equal(summaryValue(f.d,'Jovens únicos informados'),'12');
    assert.equal(f.d.querySelectorAll('#national-trend-chart .chart-column').length,8);
    assert.equal(f.d.querySelectorAll('#national-report-list article').length,2);
  }finally{f.cleanup();}
});
test('Resposta antiga não substitui dados da nova semana',async()=>{
  const f=fixture();
  try{
    const date=f.d.getElementById('national-report-date');
    date.value='2024-06-02';
    const older=f.w.__load();
    date.value='2024-06-09';
    const newer=f.w.__load();
    assert.equal(f.requests.length,2);
    f.requests[1].pending.resolve({data:[report('2024-06-09',22)],error:null});
    await newer;
    f.requests[0].pending.resolve({data:[report('2024-06-02',11)],error:null});
    await older;
    assert.equal(summaryValue(f.d,'Jovens únicos informados'),'22');
    assert.equal(date.value,'2024-06-09');
    assert.equal(f.w.__filters,1);
  }finally{f.cleanup();}
});
test('Logout descarta dados nacionais que ainda estavam carregando',async()=>{
  const f=fixture();
  try{
    f.d.getElementById('national-report-date').value='2024-06-02';
    const pending=f.w.__load();
    f.w.__logout();
    f.requests[0].pending.resolve({data:[report('2024-06-02',99)],error:null});
    await pending;
    assert.equal(f.d.querySelector('#national-report-list').textContent,'Consultando polos e relatórios...');
    assert.equal(f.d.querySelector('#national-report-summary').children.length,0);
  }finally{f.cleanup();}
});
test('Código preserva limpeza de dados de relatórios no encerramento da sessão',()=>{
  assert.match(html,/function clearAdminPrivateSession\(\)\{[\s\S]*?\+\+nationalReportLoadVersion;/);
  assert.match(html,/el\('national-report-list'\)\.replaceChildren\(\)/);
  assert.doesNotMatch(code,/\.limit\(1000\)/);
});
