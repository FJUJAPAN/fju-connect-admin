import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const db=createClient('https://hmacroktklgwkofxsygv.supabase.co','sb_publishable_mdkfafhpqtthwzU8Hf7u9A_rErx3MFJ');
const lang=()=>{const raw=(document.getElementById('language')?.value||localStorage.getItem('fju_lang')||localStorage.getItem('fju_language')||document.documentElement.lang||'pt').toLowerCase();return raw.startsWith('ja')?'ja':raw.startsWith('en')?'en':'pt'};
const labels={
 pt:{title:'🏆 Ranking do meu polo',subtitle:'Classificação exclusiva da sua igreja • Atualização em tempo real',week:'Semanal',month:'Mensal',choose:'Histórico mensal',current:'Mês atual',loading:'Carregando seu polo…',empty:'Ainda não há participantes com pontos neste período.',failed:'Não foi possível carregar o ranking do seu polo.',points:' pontos',closed:' • encerrado',national:'🌏 Ver ranking de todo o Japão',period:'Período: '},
 ja:{title:'🏆 自分の教会ランキング',subtitle:'所属教会だけのランキング • ポイントはリアルタイム更新',week:'週間',month:'月間',choose:'過去の月間ランキング',current:'今月',loading:'教会のランキングを読み込んでいます…',empty:'この期間はまだポイントを獲得した人がいません。',failed:'教会のランキングを読み込めませんでした。',points:' 点',closed:' • 確定',national:'🌏 日本全国ランキングを見る',period:'対象: '},
 en:{title:'🏆 My church ranking',subtitle:'Your church only • Points update in real time',week:'Weekly',month:'Monthly',choose:'Monthly history',current:'Current month',loading:'Loading your church…',empty:'No participants have earned points for this period.',failed:'Could not load your church ranking.',points:' points',closed:' • closed',national:'🌏 View Japan-wide ranking',period:'Period: '}
};
const txt=k=>labels[lang()][k],locale=()=>lang()==='ja'?'ja-JP':lang()==='en'?'en-US':'pt-BR';
const styles=document.createElement('style');styles.textContent=`
#fju-local-rank[hidden]{display:none!important}
#fju-local-rank{display:block;max-width:100%;min-width:0;margin:16px 0 22px;padding:20px;border-radius:19px;background:#fff;border:1px solid #dce3ee;box-shadow:0 7px 22px #192b4e11;color:#1b2947;font:14px/1.5 system-ui}
#fju-local-rank h3{margin:0;font-size:19px;line-height:1.25;color:#182e57}
#fju-local-rank .fju-local-sub{margin:6px 0 16px;color:#62738e}
#fju-local-rank .fju-local-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
#fju-local-rank .fju-local-tabs button{border:0;border-radius:12px;background:#edf1f8;color:#17305f;padding:10px 15px;font:700 14px system-ui;cursor:pointer}
#fju-local-rank .fju-local-tabs button[aria-pressed=true]{background:#bb2448;color:#fff}
#fju-local-rank .fju-local-history{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:12px 0}
#fju-local-rank select{max-width:100%;padding:9px 12px;border-radius:10px;border:1px solid #c7d2e2;background:white;color:#17305f}
#fju-local-rank ol{list-style:none;margin:12px 0;padding:0;display:grid;gap:7px;max-height:480px;overflow:auto}
#fju-local-rank li{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#f4f6fb;border-radius:11px}
#fju-local-rank .fju-rank-position{font-size:19px;font-weight:900;color:#b32146;min-width:36px}
#fju-local-rank .fju-rank-name{flex:1;min-width:0;overflow-wrap:anywhere;font-weight:700}
#fju-local-rank .fju-rank-score{font-weight:900;white-space:nowrap}
#fju-local-rank .fju-local-meta{font-size:13px;color:#67758b;margin:5px 0 0}
#fju-local-rank .fju-local-national{display:inline-flex;margin-top:13px;color:#254c9c;font-weight:800;text-decoration:underline}
`;document.head.append(styles);
function init(){
 const host=document.getElementById('inicio')||document.getElementById('fju-youth-dashboard');
 if(!host||document.getElementById('fju-local-rank'))return;
 const box=document.createElement('section');box.id='fju-local-rank';box.hidden=true;box.setAttribute('aria-label','Ranking do meu polo');
 const title=document.createElement('h3'),subtitle=document.createElement('p');subtitle.className='fju-local-sub';
 const tabs=document.createElement('div');tabs.className='fju-local-tabs';
 const weekly=document.createElement('button'),monthly=document.createElement('button');
 weekly.type=monthly.type='button';weekly.setAttribute('aria-pressed','true');monthly.setAttribute('aria-pressed','false');tabs.append(weekly,monthly);
 const history=document.createElement('div');history.className='fju-local-history';history.hidden=true;
 const historyLabel=document.createElement('label'),months=document.createElement('select');months.id='fju-local-month-select';historyLabel.htmlFor=months.id;history.append(historyLabel,months);
 const meta=document.createElement('p');meta.className='fju-local-meta';meta.setAttribute('role','status');
 const list=document.createElement('ol');
 const national=document.createElement('a');national.className='fju-local-national';national.href='https://fjujapan.github.io/fju-connect/#fju-ranking';
 box.append(title,subtitle,tabs,history,meta,list,national);host.prepend(box);
 let period='semanal',busy=false,request=0,authorized=false;
 const setLabels=()=>{title.textContent=txt('title');subtitle.textContent=txt('subtitle');weekly.textContent=txt('week');monthly.textContent=txt('month');historyLabel.textContent=txt('choose');national.textContent=txt('national')};
 setLabels();
 async function loadHistory(){
  const {data,error}=await db.from('fju_ranking_ciclos').select('periodo_inicio,fechado').eq('periodo','mensal').order('periodo_inicio',{ascending:false}).limit(36);
  if(error)return;const previous=months.value;months.replaceChildren();
  const current=document.createElement('option');current.value='';current.textContent=txt('current');months.append(current);
  for(const cycle of data||[]){const opt=document.createElement('option');opt.value=cycle.periodo_inicio;opt.textContent=new Date(cycle.periodo_inicio+'T12:00:00+09:00').toLocaleDateString(locale(),{timeZone:'Asia/Tokyo',month:'long',year:'numeric'})+(cycle.fechado?txt('closed'):'');months.append(opt)}
  if([...months.options].some(x=>x.value===previous))months.value=previous;
 }
 async function load(){
  if(busy)return;
  busy=true;const serial=++request;
  try{
   const {data:{user},error:authErr}=await db.auth.getUser();
   if(authErr||!user){authorized=false;box.hidden=true;return;}
   const params={p_periodo:period,p_periodo_inicio:period==='mensal'&&months.value?months.value:null};
   const {data,error}=await db.rpc('fju_ranking_meu_polo',params);
   if(error){if(error.code==='42501'||/ranking_polo_acesso_negado/.test(error.message||'')){authorized=false;box.hidden=true;return}throw error}
   if(serial!==request)return;
   if(!data?.length){authorized=false;box.hidden=true;return}
   authorized=true;box.hidden=false;setLabels();list.replaceChildren();
   const first=data[0];title.textContent=txt('title')+' — '+first.polo_nome;
   meta.textContent=txt('period')+String(first.periodo_inicio||'')+(first.fechado?txt('closed'):'');
   const rows=data.filter(x=>x.nome!==null&&x.colocacao!==null);
   if(!rows.length){const li=document.createElement('li');li.textContent=txt('empty');list.append(li);return;}
   for(const r of rows){
    const li=document.createElement('li'),place=document.createElement('span'),name=document.createElement('span'),score=document.createElement('span');
    place.className='fju-rank-position';place.textContent=Number(r.colocacao)+'º';
    name.className='fju-rank-name';name.textContent=r.nome;
    score.className='fju-rank-score';score.textContent=Number(r.pontos||0).toLocaleString(locale())+txt('points');
    li.append(place,name,score);list.append(li);
   }
  }catch(e){if(authorized){box.hidden=false;meta.textContent=txt('failed')}else box.hidden=true;console.warn('Ranking do polo indisponível',e)}
  finally{busy=false;}
 }
 weekly.addEventListener('click',()=>{period='semanal';weekly.setAttribute('aria-pressed','true');monthly.setAttribute('aria-pressed','false');history.hidden=true;void load()});
 monthly.addEventListener('click',()=>{period='mensal';weekly.setAttribute('aria-pressed','false');monthly.setAttribute('aria-pressed','true');history.hidden=false;void loadHistory().then(load)});
 months.addEventListener('change',()=>void load());
 document.getElementById('language')?.addEventListener('change',()=>{setLabels();if(period==='mensal')void loadHistory().then(load);else void load()});
 db.auth.onAuthStateChange(()=>{authorized=false;box.hidden=true;setTimeout(()=>void load(),250)});
 let timer;
 db.channel('fju-polo-rank-live').on('postgres_changes',{event:'*',schema:'public',table:'fju_ranking_ciclos'},()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!document.hidden)void load()},500)}).subscribe();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load()});
 window.addEventListener('focus',()=>{if(!document.hidden)void load()});
 setInterval(()=>{if(!document.hidden)void load()},15000);
 void load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
