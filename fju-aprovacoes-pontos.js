import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const db=createClient('https://hmacroktklgwkofxsygv.supabase.co','sb_publishable_mdkfafhpqtthwzU8Hf7u9A_rErx3MFJ');
const locale=()=>{const v=(localStorage.getItem('fju_lang')||localStorage.getItem('fju_language')||document.documentElement.lang||'pt').toLowerCase();return v.startsWith('ja')?'ja':v.startsWith('en')?'en':'pt'};
const copy={
pt:{title:'🏅 Pontos para aprovar',intro:'Apenas jovens do seu polo. Os pontos entram na My Page e no ranking quando você aprova.',pending:'Solicitações pendentes',history:'Últimas decisões',empty:'Nenhuma solicitação pendente.',none:'Sem decisões recentes.',yes:'Aprovar pontos',no:'Rejeitar',note:'Observação (opcional)',confirmYes:'Confirma a aprovação desta pontuação?',confirmNo:'Confirma a rejeição deste pedido?',success:'Solicitação analisada.',error:'Não foi possível concluir esta decisão.',failed:'Não foi possível carregar os pedidos.',approved:'Aprovada',rejected:'Rejeitada',points:'pontos',labels:['Limpeza da igreja','Evangelização','Pessoa nova ou afastada','Mesma pessoa, 2ª visita dentro de um mês da primeira','Mesma pessoa, 3ª visita dentro de um mês da primeira']},
ja:{title:'🏅 ポイント承認',intro:'所属教会の若者の申請のみ表示します。承認するとランキングに反映されます。',pending:'承認待ち',history:'最近の審査',empty:'承認待ちの申請はありません。',none:'審査履歴はありません。',yes:'承認する',no:'却下する',note:'コメント（任意）',confirmYes:'この申請を承認しますか？',confirmNo:'この申請を却下しますか？',success:'審査が完了しました。',error:'操作を完了できませんでした。',failed:'申請を読み込めませんでした。',approved:'承認済み',rejected:'却下',points:'点',labels:['教会の清掃','伝道活動','新しい方・久しぶりの方の来会','初回来会から1か月以内の2回目の来会','初回来会から1か月以内の3回目の来会']},
en:{title:'🏅 Points approvals',intro:'Only requests from your church. Points appear in My Page and rankings after approval.',pending:'Pending requests',history:'Recent decisions',empty:'No pending requests.',none:'No recent decisions.',yes:'Approve points',no:'Reject',note:'Note (optional)',confirmYes:'Approve these points?',confirmNo:'Reject this request?',success:'Request reviewed.',error:'Could not complete the decision.',failed:'Could not load requests.',approved:'Approved',rejected:'Rejected',points:'points',labels:['Church cleaning','Evangelization','New or returning visitor','Same visitor, second visit within a month of the first','Same visitor, third visit within a month of the first']}
};
const types=['limpeza_igreja','evangelizacao','alma_primeira','alma_segunda_mes','alma_terceira_mes'];
const tr=k=>copy[locale()][k];
const style=document.createElement('style');style.textContent=`
#fju-approve-points[hidden]{display:none!important}
#fju-approve-points{padding:18px 16px;margin:14px 0 22px;border-radius:17px;background:#fff;border:1px solid #d7e0ee;box-shadow:0 4px 20px #14213d14;color:#1e3252}
#fju-approve-points h3{font-size:19px;color:#1a3059;margin:0 0 9px}
#fju-approve-points h4{font-size:16px;margin:20px 0 12px;color:#19365f}
#fju-approve-points p{font-size:13px;color:#5b6c86}
#fju-approve-points .fju-approval-grid{display:grid;gap:11px}
#fju-approve-points .fju-approval-item{background:#f3f6fb;padding:13px;border-radius:12px}
#fju-approve-points .fju-approval-header{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-weight:850}
#fju-approve-points .fju-approval-detail{font-size:13px;overflow-wrap:anywhere;margin:8px 0}
#fju-approve-points .fju-approval-meta{font-size:12px;color:#64728a}
#fju-approve-points input{display:block;min-width:0;width:100%;box-sizing:border-box;margin:10px 0;padding:10px;border:1px solid #c3cede;border-radius:8px}
#fju-approve-points button{border:0;border-radius:9px;padding:10px 14px;background:#206b4b;color:#fff;font-weight:800;margin:4px 7px 0 0;cursor:pointer}
#fju-approve-points button.fju-reject{background:#913d48}
#fju-approve-points button:disabled{opacity:.5}
`;document.head.appendChild(style);
function mount(){
 const home=document.getElementById('inicio');if(!home||document.getElementById('fju-approve-points'))return;
 const section=document.createElement('section');section.id='fju-approve-points';section.hidden=true;
 section.innerHTML='<h3></h3><p class="fju-approval-intro"></p><h4 class="fju-pending-title"></h4><div class="fju-pending-list fju-approval-grid"></div><h4 class="fju-history-title"></h4><div class="fju-history-list fju-approval-grid"></div><p class="fju-message" role="status" aria-live="polite"></p>';
 home.appendChild(section);
 let rallyOpened=false;
 const rallyButton=document.getElementById('fju-rally-coordinator-open');
 const rallyContainer=document.getElementById('fju-rally-coordinator-content');
 const moveRallyCards=()=>{
   if(!rallyContainer)return;
   for(const id of ['fju-admin-my-points','fju-local-rank','fju-approve-points']){
     const card=document.getElementById(id);
     if(card&&card.parentElement!==rallyContainer)rallyContainer.appendChild(card);
   }
 };
 const rallyObserver=new MutationObserver(moveRallyCards);
 if(rallyContainer)rallyObserver.observe(home,{childList:true,subtree:true});
 moveRallyCards();
 rallyButton?.addEventListener('click',()=>{
   rallyOpened=!rallyOpened;
   document.body.classList.toggle('fju-rally-expanded',rallyOpened);
   moveRallyCards();
   if(rallyContainer){rallyContainer.hidden=!rallyOpened;rallyContainer.style.setProperty('display',rallyOpened?'block':'none','important');}
   rallyButton.setAttribute('aria-expanded',String(rallyOpened));
   section.hidden=!rallyOpened;
   const points=document.getElementById('fju-admin-my-points');
   if(points)points.style.display=rallyOpened?'flex':'none';
   if(rallyOpened){void refresh();rallyContainer?.scrollIntoView({behavior:'smooth',block:'start'});}
 });

 const headline=section.querySelector('h3'),intro=section.querySelector('.fju-approval-intro'),pendingTitle=section.querySelector('.fju-pending-title'),historyTitle=section.querySelector('.fju-history-title'),pendingList=section.querySelector('.fju-pending-list'),historyList=section.querySelector('.fju-history-list'),message=section.querySelector('.fju-message');
 function label(){headline.textContent=tr('title');intro.textContent=tr('intro');pendingTitle.textContent=tr('pending');historyTitle.textContent=tr('history')}
 label();
 function typeText(t){return copy[locale()].labels[Math.max(0,types.indexOf(t))]||t}
 const plain=(t)=>{const e=document.createElement('div');e.className='fju-approval-item';e.textContent=t;return e};
 function row(s,pending){
  const card=document.createElement('article'),header=document.createElement('div'),name=document.createElement('span'),score=document.createElement('b'),meta=document.createElement('div'),detail=document.createElement('div');
  card.className='fju-approval-item';header.className='fju-approval-header';name.textContent=s.nome_jovem||'Jovem FJU';score.textContent='+'+s.pontos+' '+tr('points');header.append(name,score);
  meta.className='fju-approval-meta';meta.textContent=typeText(s.atividade)+' · '+(s.data_atividade||'');
  detail.className='fju-approval-detail';detail.textContent=s.detalhe;
  card.append(header,meta,detail);
  if(pending){
   const note=document.createElement('input');note.maxLength=220;note.placeholder=tr('note');note.setAttribute('aria-label',tr('note'));
   const yes=document.createElement('button'),no=document.createElement('button');yes.type=no.type='button';yes.textContent=tr('yes');no.textContent=tr('no');no.className='fju-reject';
   const decide=async approve=>{
     if(!window.confirm(approve?tr('confirmYes'):tr('confirmNo')))return;
     yes.disabled=no.disabled=true;message.textContent='';
     try{const {error}=await db.rpc('fju_pontos_decidir',{p_solicitacao_id:s.id,p_aprovar:approve,p_observacao:note.value.trim()||null});if(error)throw error;message.textContent=tr('success');await refresh()}
     catch(e){message.textContent=tr('error')+(e.message?': '+e.message:'');yes.disabled=no.disabled=false}
   };
   yes.addEventListener('click',()=>void decide(true));no.addEventListener('click',()=>void decide(false));card.append(note,yes,no);
  }else{
   const status=document.createElement('small');status.className='fju-approval-meta';status.textContent=tr(s.status==='aprovada'?'approved':'rejected');card.append(status);
  }
  return card;
 }
 let busy=false;
 async function refresh(){
  if(busy)return;busy=true;
  try{
   const {data:{user}}=await db.auth.getUser();if(!user){section.hidden=true;return}
   const {data,error}=await db.rpc('fju_pontos_solicitacoes_polo');
   if(error){if(error.code==='42501'||/acesso_exclusivo_coordenador/.test(error.message||'')){section.hidden=true;return}throw error}
   section.hidden=!rallyOpened;label();pendingList.replaceChildren();historyList.replaceChildren();
   const pending=(data||[]).filter(s=>s.status==='pendente'),done=(data||[]).filter(s=>s.status!=='pendente').slice(0,20);
   if(!pending.length)pendingList.append(plain(tr('empty')));else pending.forEach(s=>pendingList.append(row(s,true)));
   if(!done.length)historyList.append(plain(tr('none')));else done.forEach(s=>historyList.append(row(s,false)));
  }catch(e){if(!section.hidden)message.textContent=tr('failed');}finally{busy=false}
 }
 db.auth.onAuthStateChange(()=>setTimeout(()=>void refresh(),250));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});
 window.addEventListener('focus',()=>void refresh());
 setInterval(()=>{if(!document.hidden)void refresh()},18000);
 void refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
