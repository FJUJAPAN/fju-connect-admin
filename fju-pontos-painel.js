import{createClient}from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const db=createClient('https://hmacroktklgwkofxsygv.supabase.co','sb_publishable_mdkfafhpqtthwzU8Hf7u9A_rErx3MFJ');
const css=document.createElement('style');css.textContent='#fju-admin-my-points[hidden]{display:none!important}';document.head.append(css);
function mount(){
 const home=document.getElementById('inicio');if(!home||document.getElementById('fju-admin-my-points'))return;
 const box=document.createElement('aside');box.id='fju-admin-my-points';box.hidden=true;
 box.style.cssText='display:none;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;padding:16px 20px;margin:0 0 24px;border-radius:18px;background:linear-gradient(110deg,#18335e,#b9234b);color:white;border:1px solid #ffffff33';
 box.innerHTML='<div><small style="font-weight:800;letter-spacing:.08em">⭐ MEUS PONTOS • FJU CONNECT</small><strong id="fju-points-all" style="display:block;font-size:34px">—</strong><small>Total acumulado</small></div><div style="text-align:right">Semana: <b id="fju-points-week">—</b><br>Mês: <b id="fju-points-month">—</b></div>';
 home.prepend(box);const fmt=v=>Number(v||0).toLocaleString('pt-BR');
 async function refresh(){
  try{const {data:{user}}=await db.auth.getUser();if(!user){box.hidden=true;return;}
   const {data,error}=await db.rpc('fju_meus_pontos');if(error)throw error;
   const result=Array.isArray(data)?data[0]:data;if(!result)return;
   document.getElementById('fju-points-all').textContent=fmt(result.total);
   document.getElementById('fju-points-week').textContent=fmt(result.semanal);
   document.getElementById('fju-points-month').textContent=fmt(result.mensal);
   box.hidden=false;box.style.display='flex';
  }catch(e){box.hidden=true;}
 }
 void refresh();db.auth.onAuthStateChange(()=>setTimeout(refresh,250));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
