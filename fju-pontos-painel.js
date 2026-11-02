import{createClient}from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const db=createClient('https://hmacroktklgwkofxsygv.supabase.co','sb_publishable_mdkfafhpqtthwzU8Hf7u9A_rErx3MFJ');
const selectedLanguage=()=>{const raw=(localStorage.getItem('fju_lang')||localStorage.getItem('fju_language')||document.documentElement.lang||'pt').toLowerCase();return raw.startsWith('ja')?'ja':raw.startsWith('en')?'en':'pt'};
const copy={
 pt:{header:'⭐ MEUS PONTOS • FJU CONNECT',total:'Total acumulado',week:'Semana: ',month:'Mês: '},
 ja:{header:'⭐ マイポイント • FJU CONNECT',total:'累計ポイント',week:'今週: ',month:'今月: '},
 en:{header:'⭐ MY POINTS • FJU CONNECT',total:'Lifetime points',week:'Week: ',month:'Month: '}
};
const t=k=>copy[selectedLanguage()][k];
const css=document.createElement('style');css.textContent='#fju-admin-my-points[hidden]{display:none!important}';document.head.append(css);
function mount(){
 const home=document.getElementById('inicio');if(!home||document.getElementById('fju-admin-my-points'))return;
 const box=document.createElement('aside');box.id='fju-admin-my-points';box.hidden=true;
 box.style.cssText='display:none;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;padding:16px 20px;margin:0 0 24px;border-radius:18px;background:linear-gradient(110deg,#18335e,#b9234b);color:white;border:1px solid #ffffff33';
 box.innerHTML='<div><small style="font-weight:800;letter-spacing:.08em">⭐ MEUS PONTOS • FJU CONNECT</small><strong id="fju-points-all" style="display:block;font-size:34px">—</strong><small>Total acumulado</small></div><div style="text-align:right">Semana: <b id="fju-points-week">—</b><br>Mês: <b id="fju-points-month">—</b></div>';
 home.prepend(box);
 const updateWords=()=>{const items=box.querySelectorAll('small');if(items.length>1){items[0].textContent=t('header');items[1].textContent=t('total');}
  const week=document.getElementById('fju-points-week'),month=document.getElementById('fju-points-month');
  if(week?.previousSibling)week.previousSibling.textContent=t('week');
  if(month?.previousSibling)month.previousSibling.textContent=t('month');
 };
 updateWords();
 const fmt=v=>Number(v||0).toLocaleString(selectedLanguage()==='ja'?'ja-JP':selectedLanguage()==='en'?'en-US':'pt-BR');
 let busy=false;
 async function refresh(){
  if(busy)return;busy=true;
  try{const {data:{user}}=await db.auth.getUser();if(!user){box.hidden=true;return;}
   const {data,error}=await db.rpc('fju_meus_pontos');if(error)throw error;
   const result=Array.isArray(data)?data[0]:data;if(!result)return;
   document.getElementById('fju-points-all').textContent=fmt(result.total);
   document.getElementById('fju-points-week').textContent=fmt(result.semanal);
   document.getElementById('fju-points-month').textContent=fmt(result.mensal);
   box.hidden=false;box.style.display='flex';
  }catch(e){box.hidden=true;}finally{busy=false;}
 }
 void refresh();db.auth.onAuthStateChange(()=>setTimeout(refresh,250));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});
 window.addEventListener('focus',()=>{if(!document.hidden)void refresh()});
 db.channel('fju-pontos-painel-live').on('postgres_changes',{event:'*',schema:'public',table:'fju_ranking_ciclos'},()=>{if(!document.hidden)void refresh()}).subscribe();
 setInterval(()=>{if(!document.hidden)void refresh()},12000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
