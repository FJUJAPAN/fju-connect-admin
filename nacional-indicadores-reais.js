/* Indicadores reais nos atalhos do Nacional. Nunca simular tendências. */
(()=>{const metrics=[
['autorizacoes','fju-priority-requests'],
['relatorios','fju-priority-reports'],
['inscricoes','fju-priority-signups'],
['jovens','youth-count']
];
const number=text=>{const s=String(text||'').trim();if(!/^\d[\d.,]*$/.test(s))return null;const n=Number(s.replace(/\./g,'').replace(',','.'));return Number.isFinite(n)?n:null};
function render(){if(!document.body.classList.contains('fju-national-clean'))return;
for(const [tab,id] of metrics){const card=document.querySelector('#inicio .fju-dashboard-actions .fju-action-card[data-open-tab="'+tab+'"]');const src=document.getElementById(id);if(!card||!src)continue;let box=card.querySelector('.fju-real-metric');if(!box){box=document.createElement('span');box.className='fju-real-metric';box.setAttribute('aria-live','polite');card.append(box)}const n=number(src.textContent);box.textContent=n===null?'—':n.toLocaleString('pt-BR');box.title=n===null?'Aguardando dados reais':'Quantidade atual, obtida do painel';}
}
let scheduled=false;function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render()})}
function init(){render();new MutationObserver(queue).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();