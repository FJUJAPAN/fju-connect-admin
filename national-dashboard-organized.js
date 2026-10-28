/* Painel Nacional: ordem estável mesmo após outros scripts alterarem os cartões. */
(()=>{
 const groups=[['Aprovações e pendências',['autorizacoes','inscricoes']],['Gestão da FJU',['jovens','lideranca','relatorios']],['Conteúdo e ajustes',['materias','config']]];
 const init=()=>{
  const root=document.querySelector('#inicio .fju-dashboard-actions');if(!root)return;
  const key=el=>el.matches('a[href*="materias"]')?'materias':el.dataset.openTab;
  let busy=false;
  const update=()=>{
   if(busy||!document.body.classList.contains('fju-national-clean'))return;
   busy=true;
   try{
    const cards=[...root.querySelectorAll(':scope > button,:scope > a')];
    const map=new Map(cards.map(el=>[key(el),el]));
    const expected=groups.flatMap(([heading,keys])=>[heading,...keys.map(k=>map.get(k)).filter(Boolean)]);
    const current=[...root.children].map(el=>el.classList.contains('fju-national-group-title')?el.textContent:key(el));
    const desired=expected.map(el=>typeof el==='string'?el:key(el));
    if(current.length!==desired.length||current.some((v,i)=>v!==desired[i])){
     root.querySelectorAll('.fju-national-group-title').forEach(el=>el.remove());
     for(const [heading,keys] of groups){
      const h=document.createElement('h4');h.className='fju-national-group-title';h.textContent=heading;root.append(h);
      for(const k of keys){const card=map.get(k);if(card)root.append(card)}
     }
    }
    for(const [k,id] of [['autorizacoes','fju-priority-requests'],['inscricoes','fju-priority-signups']]){
     const card=map.get(k),source=document.getElementById(id);if(!card||!source)continue;
     const value=(source.textContent||'').trim(),num=/^\d+$/.test(value)?Number(value):0;
     let badge=card.querySelector('.fju-national-badge');
     if(num>0){if(!badge){badge=document.createElement('span');badge.className='fju-national-badge';card.append(badge)}const label=num>99?'99+':String(num);if(badge.textContent!==label)badge.textContent=label;badge.setAttribute('aria-label',num+' pendências')}
     else if(badge)badge.remove();
    }
   }finally{busy=false}
  };
  new MutationObserver(update).observe(root,{childList:true});
  const priority=document.querySelector('#inicio .fju-priority-grid');
  if(priority)new MutationObserver(update).observe(priority,{subtree:true,childList:true,characterData:true});
  new MutationObserver(update).observe(document.body,{attributes:true,attributeFilter:['class']});
  update();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();