/* Organização exclusiva da home do Administrador Nacional. */
(()=>{
 const order=[["Aprovações e pendências",["autorizacoes","inscricoes"]],["Gestão da FJU",["jovens","lideranca","relatorios"]],["Conteúdo e ajustes",["materias","config"]]];
 const init=()=>{
  const root=document.querySelector('#inicio .fju-dashboard-actions');
  if(!root)return;
  const cards=[...root.children].filter(el=>el.matches('button,a'));
  const byKey=k=>cards.find(el=>k==='materias'?el.matches('a[href*="materias"]'):el.dataset.openTab===k);
  const organize=()=>{
   if(!document.body.classList.contains('fju-national-clean'))return;
   root.querySelectorAll('.fju-national-group-title').forEach(el=>el.remove());
   for(const [heading,keys] of order){
    const h=document.createElement('h4');h.className='fju-national-group-title';h.textContent=heading;root.append(h);
    keys.forEach(key=>{const card=byKey(key);if(card)root.append(card)});
   }
  };
  const sync=()=>{
   if(!document.body.classList.contains('fju-national-clean'))return;
   for(const [key,id] of [['autorizacoes','fju-priority-requests'],['inscricoes','fju-priority-signups']]){
    const card=byKey(key),source=document.getElementById(id);if(!card||!source)continue;
    const value=(source.textContent||'').trim(),num=/^\\d+$/.test(value)?Number(value):0;
    let badge=card.querySelector('.fju-national-badge');
    if(num>0){if(!badge){badge=document.createElement('span');badge.className='fju-national-badge';card.append(badge)}badge.textContent=num>99?'99+':String(num);badge.setAttribute('aria-label',num+' pendências')}
    else if(badge)badge.remove();
   }
  };
  const observer=new MutationObserver(()=>{organize();sync()});
  const priority=document.querySelector('#inicio .fju-priority-grid');
  if(priority)observer.observe(priority,{subtree:true,childList:true,characterData:true});
  const classObserver=new MutationObserver(()=>{organize();sync()});
  classObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  organize();sync();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();