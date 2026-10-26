/* FJU JAPAN — organização visual exclusivamente para coordenadores.
   Usa a identificação da sessão; permissões e fluxos de dados não mudam. */
(()=>{
 const get=id=>document.getElementById(id);
 const translations={
  pt:{priority:'Pendências da minha igreja',quick:'Ações rápidas',actions:'Ferramentas da igreja',tools:'Mais ferramentas',profile:'Meu perfil de liderança',settings:'Configurações e notificações',site:'Site oficial FJU JAPAN',info:'Minha conta e indicadores',hideInfo:'Ocultar conta e indicadores'},
  ja:{priority:'教会の未対応項目',quick:'クイック操作',actions:'教会の管理ツール',tools:'その他の機能',profile:'リーダープロフィール',settings:'設定と通知',site:'FJU JAPAN公式サイト',info:'アカウントと集計',hideInfo:'アカウントと集計を閉じる'},
  en:{priority:'Church pending items',quick:'Quick actions',actions:'Church tools',tools:'More tools',profile:'My leadership profile',settings:'Settings and notifications',site:'FJU JAPAN website',info:'My account and figures',hideInfo:'Hide account and figures'}
 };
 let built=false;
 function language(){const value=get('fju-admin-language-select')?.value;return translations[value]?value:'pt'}
 function createButton(parent,kind){
  const button=document.createElement('button');button.type='button';button.dataset.coordTool=kind;
  button.addEventListener('click',()=>{
   const target=get('main-nav')?.querySelector('[data-tab="'+kind+'"]');
   if(target&&!target.hidden){target.click();get('fju-coord-more-tools')?.removeAttribute('open');}
  });
  parent.append(button);
  return button;
 }
 function build(){
  const root=get('inicio');if(!root||built)return;
  const details=document.createElement('details');details.id='fju-coord-more-tools';details.hidden=true;
  const summary=document.createElement('summary');summary.id='fju-coord-tools-label';details.append(summary);
  const links=document.createElement('div');links.className='fju-coord-more-links';details.append(links);
  createButton(links,'lideranca');createButton(links,'config');
  const site=document.createElement('a');site.href='https://fjujapan.github.io/fju-connect/';site.target='_blank';site.rel='noopener noreferrer';site.id='fju-coord-site';links.append(site);
  root.insertBefore(details,get('fju-my-page'));
  const more=document.createElement('button');more.id='fju-coord-more-info-button';more.type='button';more.hidden=true;more.setAttribute('aria-expanded','false');
  more.addEventListener('click',()=>{
    const expanded=root.classList.toggle('fju-coord-data-open');
    more.setAttribute('aria-expanded',String(expanded));
    updateCopy();
  });
  root.insertBefore(more,get('fju-my-page'));
  built=true;updateCopy();
 }
 function updateCopy(){
  if(!built)return;
  const t=translations[language()],root=get('inicio');
  const set=(selector,value)=>{const node=root?.querySelector(selector);if(node)node.textContent=value};
  set('.fju-priority-heading h3',t.priority);
  set('.fju-today-heading h3',t.quick);
  set('.fju-actions-title',t.actions);
  set('#fju-coord-tools-label',t.tools);
  set('[data-coord-tool="lideranca"]',t.profile+' →');
  set('[data-coord-tool="config"]',t.settings+' →');
  set('#fju-coord-site',t.site+' ↗');
  set('#fju-coord-more-info-button',(root?.classList.contains('fju-coord-data-open')?t.hideInfo:t.info)+' ⌄');
 }
 function refresh(){
  const role=get('fju-session-role')?.textContent||'';
  const isCoordinator=/coordenador local/i.test(role);
  if(isCoordinator&&!built)build();
  document.body.classList.toggle('fju-coordinator-dashboard',isCoordinator);
  const details=get('fju-coord-more-tools'),more=get('fju-coord-more-info-button'),root=get('inicio');
  if(details)details.hidden=!isCoordinator;
  if(more)more.hidden=!isCoordinator;
  if(!isCoordinator){root?.classList.remove('fju-coord-data-open');if(details)details.open=false;if(more)more.setAttribute('aria-expanded','false');}
  if(isCoordinator)updateCopy();
 }
 const role=get('fju-session-role');
 if(role)new MutationObserver(refresh).observe(role,{subtree:true,childList:true,characterData:true});
 get('fju-admin-language-select')?.addEventListener('change',()=>queueMicrotask(updateCopy));
 refresh();
})();
