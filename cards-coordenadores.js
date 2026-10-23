/* FJU Connect JAPAN | Perfis privados de coordenadores */
export function setupCoordinatorCards({supabase,compressPhoto,navigateToTab}){
  const bucket='fju-coordenadores';
  const table='fju_coordenador_cards';
  const byId=id=>document.getElementById(id);
  const home=byId('leader-home');
  const homeCard=byId('leader-home-card');
  const ownArea=byId('leader-own-area');
  const ownCard=byId('leader-own-card');
  const nationalArea=byId('leader-national-area');
  const directory=byId('leader-directory');
  const directoryMessage=byId('leader-directory-message');
  const directorySearch=byId('leader-directory-search');
  const directoryVisibleCount=byId('leader-directory-visible-count');
  const editor=byId('leader-editor');
  const nameInput=byId('leader-name');
  const fileInput=byId('leader-photo');
  const saveButton=byId('leader-save');
  const status=byId('leader-message');
  const navButton=byId('leader-nav');

  let active=null;
  let token=0;
  let ownRecord=null;
  let chosenPhotoUrl=null;
  const downloadedPhotos=new Map();

  function clearUrls(){
    for(const url of downloadedPhotos.values())URL.revokeObjectURL(url);
    downloadedPhotos.clear();
    if(chosenPhotoUrl){URL.revokeObjectURL(chosenPhotoUrl);chosenPhotoUrl=null;}
  }
  function clear(){
    token++;clearUrls();active=null;ownRecord=null;
    home?.classList.add('hidden');
    ownArea?.classList.add('hidden');
    nationalArea?.classList.add('hidden');
    if(directory)directory.replaceChildren();
    if(directorySearch)directorySearch.value='';
    if(directoryVisibleCount)directoryVisibleCount.textContent='';
    if(homeCard)homeCard.replaceChildren();
    if(ownCard)ownCard.replaceChildren();
    if(nameInput)nameInput.value='';
    if(fileInput)fileInput.value='';
    if(status){status.textContent='';status.className='message';}
  }
  function tell(msg,error=false){
    status.textContent=msg;
    status.className='message '+(error?'error':'success');
  }
  function make(tag,className,content){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(content!==undefined)node.textContent=content;
    return node;
  }
  function initials(name){
    const words=(name||'FJU').trim().split(/\s+/).filter(Boolean);
    return ((words[0]?.[0]||'F')+(words.length>1?words[words.length-1][0]:'')).toLocaleUpperCase();
  }
  function createCard({nome,polo,foto,pendente=false,compact=false,papel='coordenador'}){
    const card=make('article','leader-card'+(pendente?' leader-card--pending':'')+(compact?' leader-card--compact':''));
    const eyebrow=make('div','leader-card-eyebrow','FJU JAPAN · LIDERANÇA');
    const accent=make('div','leader-card-accent');
    const photo=make('div','leader-card-photo');
    if(foto){
      const img=document.createElement('img');
      img.src=foto;img.alt='Foto de '+(nome||'perfil');
      img.loading='lazy';
      photo.append(img);
    }else{
      const placeholder=make('span','',initials(nome));
      placeholder.setAttribute('aria-label','Sem foto cadastrada');
      photo.append(placeholder);
    }
    const title=make('h3','',nome||'Perfil ainda não preenchido');
    const roleText=papel==='nacional'?'ADMINISTRADOR NACIONAL':'COORDENADOR';
    const role=make('div','leader-card-role',roleText);
    const place=make('div','leader-card-polo',papel==='nacional'?'FJU JAPAN':'FJU '+(polo||'Polo não informado'));
    const footer=make('div','leader-card-footer');
    footer.append(make('span','','COMPROMISSO • SERVIÇO'),make('span','leader-card-footer-mark','FJU'));
    card.append(eyebrow,accent,photo,title,role,place,footer);
    return card;
  }
  async function downloadPhoto(path,userId,requestToken){
    if(!path)return null;
    const {data,error}=await supabase.storage.from(bucket).download(path);
    if(error||!data||requestToken!==token)return null;
    const url=URL.createObjectURL(data);
    const previous=downloadedPhotos.get(userId);
    if(previous)URL.revokeObjectURL(previous);
    downloadedPhotos.set(userId,url);
    return url;
  }
  function renderOwn(){
    if(!active||!['coordenador','nacional'].includes(active.role))return;
    const nome=nameInput.value.trim()||ownRecord?.nome_exibicao||'Seu perfil de liderança';
    const foto=chosenPhotoUrl||downloadedPhotos.get(active.uid)||null;
    ownCard.replaceChildren(createCard({nome,polo:active.polo,foto,pendente:!ownRecord?.nome_exibicao,papel:active.role}));
    if(active.role==='coordenador')homeCard.replaceChildren(createCard({nome,polo:active.polo,foto,pendente:!ownRecord?.nome_exibicao,compact:true,papel:active.role}));
  }
  async function loadOwn(requestToken){
    const uid=active.uid;
    tell('Carregando perfil...');
    const {data,error}=await supabase.from(table)
      .select('usuario_id,nome_exibicao,foto_path').eq('usuario_id',uid).maybeSingle();
    if(requestToken!==token)return;
    if(error){
      tell('O perfil ainda não está disponível. Verifique se a configuração foi ativada no Supabase: '+error.message,true);
      renderOwn();return;
    }
    ownRecord=data||null;
    nameInput.value=data?.nome_exibicao||'';
    if(data?.foto_path)await downloadPhoto(data.foto_path,uid,requestToken);
    if(requestToken!==token)return;
    renderOwn();
    tell(data?'Você pode atualizar seu nome ou foto.':'Preencha seu nome e foto para criar seu card.');
  }
  function filterDirectory(){
    if(!directorySearch||!directory)return;
    const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const query=normalize(directorySearch.value);
    let visible=0;
    const items=[...directory.querySelectorAll('.leader-directory-item')];
    for(const item of items){
      item.hidden=Boolean(query&&!item.dataset.search.includes(query));
      if(!item.hidden)visible++;
    }
    directoryVisibleCount.textContent=query
      ?visible+' de '+items.length+' encontrado(s)'
      :items.length+' coordenador(es)';
  }
  directorySearch?.addEventListener('input',filterDirectory);
  async function loadDirectory(requestToken){
    directory.replaceChildren();
    directoryVisibleCount.textContent='';
    directoryMessage.textContent='Carregando coordenadores...';
    const {data,error}=await supabase.rpc('fju_listar_cards_coordenadores');
    if(requestToken!==token)return;
    if(error){
      directoryMessage.textContent='O diretório ainda não está disponível: '+error.message;
      return;
    }
    const rows=data||[];
    directoryMessage.textContent=rows.length
      ?rows.length+' coordenador'+(rows.length===1?'':'es')+' ativo'+(rows.length===1?'':'s')+' · perfis visíveis somente no painel administrativo.'
      :'Ainda não há coordenadores ativos para exibir.';
    for(const person of rows){
      const slot=make('div','leader-directory-item');
      slot.dataset.search=String([person.nome_exibicao,person.polo_nome].join(' ')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      slot.append(createCard({nome:person.nome_exibicao,polo:person.polo_nome,pendente:!person.nome_exibicao}));
      directory.append(slot);
      if(person.foto_path){
        void (async()=>{
          const photo=await downloadPhoto(person.foto_path,person.usuario_id,requestToken);
          if(!photo||requestToken!==token)return;
          slot.replaceChildren(createCard({nome:person.nome_exibicao,polo:person.polo_nome,foto:photo}));
        })();
      }
    }
    filterDirectory();
  }
  async function load(user,profile,poloName){
    clear();
    const requestToken=token;
    const isCoordinator=profile.papel==='coordenador';
    const isNational=profile.papel==='nacional';
    const canEditOwn=isCoordinator||isNational;
    active={uid:user.id,role:profile.papel,polo:poloName||''};
    navButton.querySelector('.fju-nav-label-desktop').textContent=isCoordinator?'Meu perfil':'Liderança';
    navButton.querySelector('.fju-nav-label-mobile').textContent='Perfil';
    home.classList.toggle('hidden',!isCoordinator);
    ownArea.classList.toggle('hidden',!canEditOwn);
    nationalArea.classList.toggle('hidden',!isNational);
    if(canEditOwn){
      renderOwn();
      await loadOwn(requestToken);
    }
    if(isNational)await loadDirectory(requestToken);
  }
  async function refresh(){
    if(!active)return;
    const requestToken=++token;
    clearUrls();
    if(['coordenador','nacional'].includes(active.role))await loadOwn(requestToken);
    if(active.role==='nacional')await loadDirectory(requestToken);
  }
  nameInput.addEventListener('input',renderOwn);
  fileInput.addEventListener('change',()=>{
    if(chosenPhotoUrl){URL.revokeObjectURL(chosenPhotoUrl);chosenPhotoUrl=null;}
    const file=fileInput.files?.[0];
    if(!file){renderOwn();return;}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){
      fileInput.value='';renderOwn();tell('Escolha uma foto JPG, PNG ou WebP de até 5 MB.',true);return;
    }
    chosenPhotoUrl=URL.createObjectURL(file);
    renderOwn();
    tell('Prévia da foto pronta. Toque em Salvar meu perfil para confirmar.');
  });
  editor.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!active||!['coordenador','nacional'].includes(active.role))return;
    const uid=active.uid, requestToken=token;
    const nome=nameInput.value.trim();
    if(nome.length<2||nome.length>100){tell('Informe seu nome (de 2 a 100 caracteres).',true);return;}
    const file=fileInput.files?.[0];
    saveButton.disabled=true;
    tell('Salvando seu perfil...');
    try{
      const result=ownRecord
        ?await supabase.from(table).update({nome_exibicao:nome}).eq('usuario_id',uid)
        :await supabase.from(table).insert({usuario_id:uid,nome_exibicao:nome});
      if(result.error)throw new Error(result.error.message);
      let uploaded=false;
      if(file){
        const compact=await compressPhoto(file);
        const path=uid+'/perfil.jpg';
        const {error:photoError}=await supabase.storage.from(bucket).upload(
          path,compact,{contentType:'image/jpeg',upsert:true}
        );
        if(photoError)throw new Error('Nome salvo, mas a foto não foi enviada: '+photoError.message);
        const {error:pathError}=await supabase.from(table)
          .update({foto_path:path}).eq('usuario_id',uid);
        if(pathError)throw new Error('Foto enviada, mas não foi vinculada ao perfil: '+pathError.message);
        uploaded=true;
      }
      if(requestToken!==token)return;
      const recentName=nome;
      fileInput.value='';
      await refresh();
      if(requestToken+1===token)tell(uploaded?'Perfil e foto salvos com sucesso.':'Nome do perfil atualizado com sucesso.');
      nameInput.value=recentName;
    }catch(error){
      if(requestToken===token)tell(error.message||'Não foi possível salvar o perfil.',true);
    }finally{
      saveButton.disabled=false;
    }
  });
  byId('leader-home-edit').addEventListener('click',()=>navigateToTab());
  return {load,refresh,clear};
}
