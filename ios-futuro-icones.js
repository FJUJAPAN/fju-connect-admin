/* Ícones vetoriais iOS unificados, sem alterar ações ou navegação. */
(()=>{const paths={
jovens:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 6a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5"/>',
relatorios:'<path d="M4 20v-8h4v8M10 20V5h4v15M16 20v-11h4v11M2 21h20"/>',
inscricoes:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M7 11h10M7 15h7M12 2v3"/>',
autorizacoes:'<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 3h6M8 13l3 3 5-6"/>',
lideranca:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
config:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
materias:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
fichas:'<rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="9" r="2"/><path d="M8 17c0-4 8-4 8 0"/>',
cadastros:'<circle cx="10" cy="8" r="3"/><path d="M3 20v-2a7 7 0 0 1 14 0v2M19 9v8m-4-4h8"/>',
mypage:'<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>'};
const svg=k=>'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(paths[k]||paths.config)+'</svg>';
function apply(){document.querySelectorAll('body.fju-national-clean #inicio .fju-dashboard-actions>.fju-action-card').forEach(el=>{const key=el.dataset.openTab||(el.classList.contains('fju-action-link')?'materias':'');const node=el.querySelector('.fju-action-icon');if(node&&paths[key]&&!node.dataset.iosFuture){node.innerHTML=svg(key);node.dataset.iosFuture='1'}});
document.querySelectorAll('body.fju-coordinator-dashboard #fju-coord-app-grid>.fju-coord-app').forEach(el=>{const key=el.id.replace('fju-coord-app-','');const node=el.querySelector('.fju-coord-app-icon');if(node&&!node.dataset.iosFuture){const badge=node.querySelector('.fju-coord-app-badge');node.replaceChildren();node.insertAdjacentHTML('afterbegin',svg(key));if(badge)node.append(badge);node.dataset.iosFuture='1'}})}
let pending=false;const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;apply()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply();new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']})},{once:true});else{apply();new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']})}
})();