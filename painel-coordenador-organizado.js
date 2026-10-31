/* FJU Connect JAPAN — home do coordenador, ícones de aplicativos e ações por área.
   Apenas apresentação e navegação; os controles de segurança permanecem no backend. */
(()=>{
 const $=id=>document.getElementById(id);
 const copy={
  pt:{
   home:'Painel de controle', intro:'Meu FJU · Todas as funções em um só lugar', back:'Voltar', returnHome:'← Painel de controle', choose:'Escolha o que deseja fazer',
   fichas:'Fichas',cadastros:'Cadastros',relatorios:'Relatórios',materias:'Matérias e eventos',mypage:'My Page',
   openFichas:'Consultar fichas',addYouth:'Cadastrar ficha de jovem',registers:'Analisar cadastros recebidos',reportFill:'Preencher relatório semanal',reportHistory:'Consultar histórico de relatórios',
   createPost:'Criar matéria',pastEvent:'Publicar evento realizado',drafts:'Meus rascunhos',myPublications:'Minhas publicações',
   journey:'Minha Jornada',checkin:'Check-in',projects:'Meus Projetos',personalNotifications:'Notificações',personalHeading:'Minha área',personalHint:'Acesse suas funções pessoais no FJU Connect',openPersonal:'Abrir no FJU Connect',profile:'Meu perfil',display:'Idioma de exibição',password:'Alterar senha',notifications:'Notificações do aparelho',
   emailSent:'Enviamos as instruções de alteração de senha ao seu e-mail.',emailFail:'Não foi possível enviar o e-mail de alteração de senha.',
   reportDue:'Relatório semanal pendente',reportDone:'Relatório enviado',otherTasks:'Pendências que exigem sua ação'
  },
  ja:{
   home:'管理パネル',intro:'マイページ · すべての機能をここから',back:'戻る',returnHome:'← 管理パネル',choose:'操作を選択してください',
   fichas:'青年の記録',cadastros:'登録申請',relatorios:'週間報告',materias:'記事・イベント',mypage:'マイページ',
   openFichas:'青年の記録を確認',addYouth:'青年の記録を追加',registers:'新規登録を確認',reportFill:'週間報告を提出',reportHistory:'過去の報告を見る',
   createPost:'記事を作成',pastEvent:'終了したイベントを投稿',drafts:'下書き',myPublications:'自分の投稿',
   journey:'私の歩み',checkin:'チェックイン',projects:'参加プロジェクト',personalNotifications:'お知らせ',personalHeading:'マイエリア',personalHint:'FJU Connectで個人機能を開きます',openPersonal:'FJU Connectを開く',profile:'プロフィール',display:'表示言語',password:'パスワード変更',notifications:'端末の通知',
   emailSent:'パスワード変更の案内をメールで送信しました。',emailFail:'パスワード変更メールを送信できませんでした。',
   reportDue:'週間報告が未提出です',reportDone:'週間報告済み',otherTasks:'対応が必要な項目'
  },
  en:{
   home:'Dashboard',intro:'My FJU · All your tools in one place',back:'Back',returnHome:'← Dashboard',choose:'Choose an action',
   fichas:'Youth records',cadastros:'Registrations',relatorios:'Weekly reports',materias:'Articles & events',mypage:'My Page',
   openFichas:'View youth records',addYouth:'Create youth record',registers:'Review registrations',reportFill:'Submit weekly report',reportHistory:'View report history',
   createPost:'Create article',pastEvent:'Post completed event',drafts:'My drafts',myPublications:'My publications',
   journey:'My Journey',checkin:'Check-in',projects:'My Projects',personalNotifications:'Notifications',personalHeading:'My area',personalHint:'Open personal features in FJU Connect',openPersonal:'Open FJU Connect',profile:'My profile',display:'Display language',password:'Change password',notifications:'Device notifications',
   emailSent:'Password change instructions have been sent to your email.',emailFail:'Could not send the password change email.',
   reportDue:'Weekly report due',reportDone:'Report submitted',otherTasks:'Items requiring your action'
  }
 };
 const appDef=[
  ['fichas','👥','blue'],['cadastros','📥','green'],['relatorios','📊','orange'],
  ['materias','📰','purple']
 ];
 let activeGroup=null,built=false,isCoordinator=false,reportDue=false,jpLastStamp=null,jpLastOpen=false;
 const lang=()=>copy[$('fju-admin-language-select')?.value]?$('fju-admin-language-select').value:'pt';
 const t=()=>copy[lang()];
 const nav=tab=>{const btn=document.querySelector('#main-nav [data-tab="'+tab+'"]');if(btn){btn.click();activeGroup=null;render();}};
 function getJp(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',weekday:'short',hour:'2-digit',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  return Object.fromEntries(parts.map(part=>[part.type,part.value]));
 }
 function refreshBadges(){
  if(!isCoordinator)return;
  const count=Number(($('fju-priority-signups')?.textContent||'').trim());
  const registration=$('fju-coord-app-cadastros')?.querySelector('.fju-coord-app-badge');
  if(registration){const show=Number.isFinite(count)&&count>0;registration.hidden=!show;registration.textContent=show?(count>99?'99+':String(count)):'';}
  const jp=getJp(), nowSunday=jp.weekday==='Sun'&&Number(jp.hour)>=12;
  const stamp=jp.year+'-'+jp.month+'-'+jp.day;
  if(jpLastStamp!==null&&nowSunday&&(stamp!==jpLastStamp||!jpLastOpen))window.fjuAdminRefreshReportStatus?.();
  jpLastStamp=stamp;jpLastOpen=nowSunday;
  const reportStatus=($('pending-count')?.textContent||'').trim();
  // A badge de domingo só aparece se o estado real do relatório foi confirmado.
  reportDue=nowSunday&&/^●\s*Pendente/i.test(reportStatus);
  const reportBadge=$('fju-coord-app-relatorios')?.querySelector('.fju-coord-app-badge');
  if(reportBadge){reportBadge.hidden=!reportDue;reportBadge.textContent='1';}
  const hint=$('fju-coord-status');if(hint)hint.textContent=reportDue?t().reportDue:'';
 }
 function btn(label,action,emoji){
  const button=document.createElement('button');button.type='button';button.className='fju-coord-option';
  const symbol=document.createElement('span');symbol.className='fju-coord-option-icon';symbol.textContent=emoji;symbol.setAttribute('aria-hidden','true');
  const word=document.createElement('span');word.textContent=label;
  const arrow=document.createElement('span');arrow.className='fju-coord-chevron';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');
  button.append(symbol,word,arrow);button.addEventListener('click',action);return button;
 }
 const articleUrl=params=>'./materias.html'+(params?'?'+params:'');
 function showDetail(which){
  const slot=$('fju-coord-subdetail');if(!slot)return;
  const langOriginal=$('fju-admin-language-settings');
  if(langOriginal?.parentElement===slot){$('app').prepend(langOriginal);langOriginal.hidden=true;langOriginal.style.display='none';}
  const notifyOriginal=$('notification-settings');if(notifyOriginal?.parentElement===slot){$('fju-settings-notify-anchor')?.after(notifyOriginal);}
  slot.replaceChildren();slot.hidden=false;
  const title=document.createElement('h4');title.textContent=which==='display'?t().display:t().notifications;slot.append(title);
  if(which==='display'){
   const original=$('fju-admin-language-settings');
   if(original){original.hidden=false;original.style.display='flex';slot.append(original);$('fju-admin-language-label').textContent=t().display;}
  }else if(which==='notifications'){
   const original=$('notification-settings');if(original){slot.append(original);original.hidden=false;}
  }
 }
 function options(group){
  const slot=$('fju-coord-options');if(!slot)return;
  slot.replaceChildren();
  const records={
   fichas:[
    [t().openFichas,()=>nav('jovens'),'📁'],
    [t().addYouth,()=>{const rapid=document.querySelector('.fju-daily-button[data-action-kind="add-youth"]');if(rapid)rapid.click();else nav('jovens')},'➕']
   ],
   cadastros:[[t().registers,()=>nav('inscricoes'),'📥']],
   relatorios:[
    [t().reportFill,()=>{nav('relatorios');window.fjuAdminHideCoordinatorReportHistory?.();},'📝'],
    [t().reportHistory,()=>{nav('relatorios');window.fjuAdminLoadCoordinatorReportHistory?.();},'📊']
   ],
   materias:[
    [t().createPost,()=>location.assign(articleUrl('acao=novo&secao=eventos_realizados')),'✍️'],
    [t().pastEvent,()=>location.assign(articleUrl('acao=novo&secao=eventos_realizados')),'📅'],
    [t().drafts,()=>location.assign(articleUrl('filtro=rascunho')),'🗂️'],
    [t().myPublications,()=>location.assign(articleUrl('')),'📑']
   ],
   mypage:[
    [t().profile,()=>nav('lideranca'),'👤'],
    [t().display,()=>showDetail('display'),'🌐'],
    [t().password,async()=>{
      const detail=$('fju-coord-subdetail');detail.hidden=false;
      const langNode=$('fju-admin-language-settings');
      if(langNode?.parentElement===detail){$('app').prepend(langNode);langNode.hidden=true;langNode.style.display='none';}
      const notifyNode=$('notification-settings');
      if(notifyNode?.parentElement===detail)$('fju-settings-notify-anchor')?.after(notifyNode);
      detail.replaceChildren();
      const feedback=document.createElement('p');feedback.setAttribute('role','status');feedback.textContent='…';detail.append(feedback);
      try{if(typeof window.fjuAdminRequestPasswordReset!=='function')throw Error('Ação indisponível');
       await window.fjuAdminRequestPasswordReset();feedback.textContent=t().emailSent;
      }catch(error){feedback.textContent=t().emailFail+' '+(error?.message||'');}
     },'🔐'],
    [t().notifications,()=>showDetail('notifications'),'🔔']
   ]
  };
  (records[group]||[]).forEach(([label,action,emoji])=>slot.append(btn(label,action,emoji)));
 }
 function showPersonalDetail(key){
  const panel=$('fju-coord-personal-detail');if(!panel)return;
  panel.replaceChildren();panel.hidden=false;
  $('fju-coord-app-grid').hidden=true;
  $('fju-coord-intro').hidden=true;
  const account=$('fju-my-page');if(account)account.hidden=true;
  const personalGrid=document.querySelector('.fju-coord-personal-grid');if(personalGrid)personalGrid.hidden=true;
  const personalTitle=$('fju-coord-personal-title');if(personalTitle)personalTitle.hidden=true;
  const personalHint=$('fju-coord-personal-hint');if(personalHint)personalHint.hidden=true;
  const back=document.createElement('button');back.type='button';back.className='fju-coord-personal-back';back.textContent=lang()==='ja'?'← 戻る':lang()==='en'?'← Back':'← Voltar';back.addEventListener('click',()=>{panel.hidden=true;panel.replaceChildren();$('fju-coord-app-grid').hidden=false;$('fju-coord-intro').hidden=false;if(personalGrid)personalGrid.hidden=false;if(personalTitle)personalTitle.hidden=false;if(personalHint)personalHint.hidden=false;if(account)account.hidden=false;$('fju-coord-personal-area')?.scrollIntoView({block:'start',behavior:'smooth'});});panel.append(back);
  const heading=document.createElement('h4');heading.textContent=t()[key];panel.append(heading);
  const note=document.createElement('p');
  if(key==='journey'){
   note.textContent=lang()==='ja'?'個人の歩みと昇格履歴は、プロフィールに記録がある場合に表示されます。':lang()==='en'?'Your journey and rank history will appear here when linked to your profile.':'Sua jornada e o histórico de patentes aparecerão aqui quando estiverem vinculados ao seu perfil.';
  }else{
   note.textContent=lang()==='ja'?'参加プロジェクトは、プロフィールに登録されるとここに表示されます。':lang()==='en'?'Your approved projects will appear here once linked to your profile.':'Seus projetos aprovados aparecerão aqui quando estiverem vinculados ao seu perfil.';
  }
  panel.append(note);
  if(key==='journey'&&typeof window.fjuAdminOwnRankHistory==='function'){
    note.textContent=lang()==='ja'?'履歴を読み込み中…':lang()==='en'?'Loading your history…':'Carregando seu histórico…';
    window.fjuAdminOwnRankHistory().then(history=>{
      if(!panel.isConnected||panel.hidden)return;
      if(history===null){note.textContent=lang()==='ja'?'このアカウントに青年の記録が関連付けられていません。':lang()==='en'?'No youth record is linked to this account.':'Nenhuma ficha de jovem está vinculada a esta conta.';return;}
      note.textContent=history.length?'':(lang()==='ja'?'昇格履歴はまだありません。':lang()==='en'?'No rank changes recorded yet.':'Ainda não há alterações de patente registradas.');
      const list=document.createElement('ul');list.className='fju-coord-rank-history';
      history.forEach(row=>{const item=document.createElement('li');const date=row.alterado_em?new Date(row.alterado_em).toLocaleDateString(lang()==='ja'?'ja-JP':lang()==='en'?'en-US':'pt-BR'):'—';item.textContent=date+' · '+(row.patente_anterior||'—')+' → '+(row.patente_nova||'—');list.append(item);});
      panel.insertBefore(list,panel.lastElementChild);
    }).catch(()=>{if(panel.isConnected)note.textContent=lang()==='ja'?'履歴を読み込めませんでした。':lang()==='en'?'Could not load rank history.':'Não foi possível carregar o histórico de patentes.';});
  }
  if(key==='projects'&&typeof window.fjuAdminOwnProjects==='function'){
    note.textContent=lang()==='ja'?'プロジェクトを読み込み中…':lang()==='en'?'Loading approved projects…':'Carregando projetos aprovados…';
    window.fjuAdminOwnProjects().then(projects=>{
      if(!panel.isConnected||panel.hidden)return;
      if(projects===null){note.textContent=lang()==='ja'?'青年の記録がリンクされていません。':lang()==='en'?'No youth record linked.':'Nenhuma ficha vinculada à sua conta.';return;}
      note.textContent=projects.length?'':(lang()==='ja'?'承認済みのプロジェクトはありません。':lang()==='en'?'No approved projects yet.':'Nenhum projeto aprovado até o momento.');
      const list=document.createElement('ul');projects.forEach(name=>{const item=document.createElement('li');item.textContent=name;list.append(item);});panel.append(list);
    }).catch(()=>{if(panel.isConnected)note.textContent=lang()==='ja'?'承認済みのプロジェクトを確認できません。':lang()==='en'?'Unable to verify approved projects.':'Não foi possível verificar os projetos aprovados.';});
  }
  panel.scrollIntoView({block:'start',behavior:'smooth'});
 }
 function buildPersonalArea(section){
  if($('fju-coord-personal-area'))return;
  const personal=document.createElement('section');personal.id='fju-coord-personal-area';
  const title=document.createElement('h3');title.id='fju-coord-personal-title';personal.append(title);
  const grid=document.createElement('div');grid.className='fju-coord-personal-grid';personal.append(grid);
  const items=[['checkin','📍'],['personalNotifications','🔔']];
  items.forEach(([key,emoji])=>{
    const a=document.createElement('a');a.className='fju-coord-personal-link';
    if(key==='checkin')a.href='https://fjujapan.github.io/fju-connect/check-in/';
    else if(key==='personalNotifications'){
      a.href='#fju-coord-choices';
      a.addEventListener('click',event=>{event.preventDefault();resetHome();activeGroup='mypage';render();showDetail('notifications');$('fju-coord-choices')?.scrollIntoView({block:'nearest',behavior:'smooth'});});
    }else{
      a.href='#fju-coord-personal-detail';
      a.addEventListener('click',event=>{event.preventDefault();showPersonalDetail(key);});
    }
    a.setAttribute('aria-label',key);
    const icon=document.createElement('span');icon.textContent=emoji;icon.className='fju-coord-personal-icon';
    const label=document.createElement('span');label.className='fju-coord-personal-label';label.dataset.personalKey=key;
    a.append(icon,label);grid.append(a);
  });
  const hint=document.createElement('p');hint.id='fju-coord-personal-hint';personal.append(hint);
  const detail=document.createElement('div');detail.id='fju-coord-personal-detail';detail.hidden=true;personal.append(detail);
  section.insertBefore(personal,$('fju-coord-choices'));
 }
 function render(){
  if(!built)return;
  const tt=t();
  const personalTitle=$('fju-coord-personal-title');if(personalTitle)personalTitle.textContent=tt.personalHeading;
  const personalHint=$('fju-coord-personal-hint');if(personalHint)personalHint.textContent=tt.personalHint;
  document.querySelectorAll('[data-personal-key]').forEach(el=>{el.textContent=tt[el.dataset.personalKey];el.parentElement.setAttribute('aria-label',tt[el.dataset.personalKey]+' — '+tt.openPersonal);});
  const settings=$('fju-coord-account-settings');if(settings)settings.textContent=lang()==='ja'?'⚙️ アカウント設定':lang()==='en'?'⚙️ Account settings':'⚙️ Ajustes da conta';$('fju-coord-intro').textContent=tt.intro;$('fju-coord-options-hint').textContent=tt.choose;
  $('fju-coord-back').textContent=tt.back;$('fju-coord-home-return').textContent=tt.returnHome;
  appDef.forEach(([key])=>{
    const el=$('fju-coord-app-'+key);
    if(!el)return;
    el.querySelector('.fju-coord-app-label').textContent=tt[key];el.classList.toggle('is-active',activeGroup===key);
    el.setAttribute('aria-expanded',String(activeGroup===key));
  });
  const panel=$('fju-coord-choices');panel.hidden=!activeGroup;
  if(activeGroup){$('fju-coord-choices-title').textContent=tt[activeGroup];options(activeGroup);}
  const onHome=!activeGroup&&!document.querySelector('#inicio')?.classList.contains('hidden');
  $('fju-coord-home-return').hidden=onHome;refreshBadges();
 }
 function resetHome(){
  activeGroup=null;
  const originalLang=$('fju-admin-language-settings');if(originalLang&&originalLang.parentElement?.id==='fju-coord-subdetail'){
    $('app').prepend(originalLang);originalLang.hidden=true;originalLang.style.display='none';
  }
  const notify=$('notification-settings');if(notify&&notify.parentElement?.id==='fju-coord-subdetail'){$('fju-settings-notify-anchor')?.after(notify);}
  const sub=$('fju-coord-subdetail');if(sub){sub.replaceChildren();sub.hidden=true;}
 }
 function build(){
  const root=$('inicio');if(!root||built)return;
  const section=document.createElement('section');section.id='fju-coord-app-shell';section.setAttribute('aria-label','Aplicativos do painel');
  const intro=document.createElement('p');intro.id='fju-coord-intro';section.append(intro);
  const apps=document.createElement('div');apps.id='fju-coord-app-grid';section.append(apps);
  for(const [key,emoji,color] of appDef){
   const b=document.createElement('button');b.type='button';b.id='fju-coord-app-'+key;
   b.className='fju-coord-app';b.setAttribute('aria-expanded','false');
   const icon=document.createElement('span');icon.className='fju-coord-app-icon fju-coord-'+color;icon.textContent=emoji;icon.setAttribute('aria-hidden','true');
   const badge=document.createElement('span');badge.className='fju-coord-app-badge';badge.hidden=true;icon.append(badge);
   const label=document.createElement('span');label.className='fju-coord-app-label';
   b.append(icon,label);b.addEventListener('click',()=>{if(key==='fichas'){resetHome();nav('jovens');return;}
    if(key==='cadastros'||key==='relatorios'){
      const url=new URL(location.href);url.searchParams.set('module',key==='cadastros'?'inscricoes':'relatorios');
      location.assign(url.toString());return;
    }
    if(key==='materias'){location.assign('./materias.html');return;}const next=activeGroup===key?null:key;resetHome();activeGroup=next;render();if(activeGroup)$('fju-coord-choices').scrollIntoView({block:'nearest',behavior:'smooth'});});
   apps.append(b);
  }
  const choices=document.createElement('section');choices.id='fju-coord-choices';choices.hidden=true;
  const bar=document.createElement('div');bar.className='fju-coord-choices-heading';
  const back=document.createElement('button');back.id='fju-coord-back';back.type='button';back.addEventListener('click',()=>{resetHome();activeGroup=null;render();});
  const heading=document.createElement('h3');heading.id='fju-coord-choices-title';bar.append(back,heading);choices.append(bar);
  const hint=document.createElement('p');hint.id='fju-coord-options-hint';choices.append(hint);
  const menu=document.createElement('div');menu.id='fju-coord-options';choices.append(menu);
  const detail=document.createElement('div');detail.id='fju-coord-subdetail';detail.hidden=true;choices.append(detail);
  section.append(choices);
  buildPersonalArea(section);
  const status=document.createElement('p');status.id='fju-coord-status';status.setAttribute('role','status');section.append(status);
  const headingAnchor=root.querySelector('.fju-today-section');root.insertBefore(section,headingAnchor||root.firstChild);
  // A conta faz parte do painel principal; nao e um quinto aplicativo.
  const accountCard=$('fju-my-page');if(accountCard){section.prepend(accountCard);accountCard.hidden=false;accountCard.style.display='block';
   if(!$('fju-coord-account-settings')){const settings=document.createElement('button');settings.type='button';settings.id='fju-coord-account-settings';settings.textContent='⚙️ Ajustes da conta';settings.addEventListener('click',()=>{resetHome();activeGroup='mypage';render();$('fju-coord-choices')?.scrollIntoView({block:'nearest',behavior:'smooth'});});accountCard.append(settings);}
  }
  const toolbar=$('fju-admin-menu-toggle');if(toolbar){
   const home=document.createElement('button');home.type='button';home.id='fju-coord-home-return';home.hidden=true;
   home.addEventListener('click',()=>{resetHome();activeGroup=null;nav('inicio');render();});toolbar.after(home);
  }
  const notification=$('notification-settings');
  if(notification){const anchor=document.createElement('span');anchor.id='fju-settings-notify-anchor';notification.before(anchor);}
  const role=$('fju-session-role'),signups=$('fju-priority-signups'),reports=$('pending-count');
  for(const target of [role,signups,reports])if(target)new MutationObserver(()=>{if(target===role)refresh();else refreshBadges();}).observe(target,{subtree:true,childList:true,characterData:true});
  $('fju-admin-language-select')?.addEventListener('change',()=>queueMicrotask(render));
  document.querySelectorAll('#main-nav [data-tab]').forEach(node=>node.addEventListener('click',()=>queueMicrotask(()=>{
    const main=$('inicio');if(main?.classList.contains('hidden')){$('fju-coord-home-return').hidden=!isCoordinator;}
    else if(isCoordinator){resetHome();activeGroup=null;render();}
  })));
  built=true;
 }
 function refresh(){
  const coordinator=/coordenador local/i.test($('fju-session-role')?.textContent||'');
  if(coordinator&&!built)build();
  if(coordinator!==isCoordinator){
    isCoordinator=coordinator;
    document.body.classList.toggle('fju-coordinator-dashboard',coordinator);
    if(!coordinator&&built){resetHome();activeGroup=null;$('fju-coord-home-return').hidden=true;}
    const langTop=$('fju-admin-language-settings');if(langTop&&!coordinator){langTop.hidden=false;langTop.style.display='flex';}
    if(langTop&&coordinator&&langTop.parentElement?.id!=='fju-coord-subdetail'){langTop.hidden=true;langTop.style.display='none';}
  }
  if(isCoordinator){const card=$('fju-my-page');if(card){card.hidden=false;card.style.display='block';}render();}
 }
 $('fju-session-role')&&new MutationObserver(refresh).observe($('fju-session-role'),{subtree:true,childList:true,characterData:true});
 build();refresh();setInterval(refreshBadges,30000);
})();
