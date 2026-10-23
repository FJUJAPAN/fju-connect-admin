/* FJU JAPAN — retorno confiável ao Painel de Controle */
(()=>{
 const sections=['jovens','inscricoes','autorizacoes','relatorios','lideranca','config'];
 const css=document.createElement('style');
 css.textContent='.fju-back-dashboard{display:inline-flex;align-items:center;gap:7px;margin:0 0 16px;padding:11px 15px;border:1px solid #c9d7e8;border-radius:11px;background:#fff;color:#16385d;font-weight:800;font-size:14px;cursor:pointer}.fju-back-dashboard:focus-visible{outline:3px solid #e51f3d;outline-offset:2px}';
 document.head.appendChild(css);
 for(const id of sections){
  const panel=document.getElementById(id);
  if(!panel||panel.querySelector('.fju-back-dashboard'))continue;
  const btn=document.createElement('button');
  btn.type='button';btn.className='fju-back-dashboard';btn.textContent='← Painel de Controle';
  btn.addEventListener('click',()=>{
   const home=document.querySelector('#main-nav [data-tab="inicio"]');
   if(!home){location.href='./index.html';return}
   home.click();
   // A ativação da aba já reposiciona a tela no celular. Evita disputa entre animações de rolagem.
   if(!window.matchMedia('(max-width:900px)').matches)window.scrollTo({top:0,behavior:'auto'});
   const heading=document.getElementById('fju-dashboard-heading');
   if(heading)heading.focus?.({preventScroll:true});
  });
  panel.prepend(btn);
 }
})();
