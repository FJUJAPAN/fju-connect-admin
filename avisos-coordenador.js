/* FJU Connect Japan — pendências internas de patente por igreja.
   A autorização para consultar pendências é garantida por RLS no Supabase. */
export function setupCoordinatorPendingNotices({supabase,getProfile,openYouthEdit}){
  const element=document.createElement('section');
  element.id='fju-coord-pendencias-patente';
  element.className='fju-coord-pendencias-patente';
  element.hidden=true;
  element.setAttribute('aria-live','polite');
  let loadSerial=0;
  let lastUpdated=0;
  let opened=false;

  const lang=()=>{
    const value=document.getElementById('fju-admin-language-select')?.value||'pt';
    return ['pt','ja','en'].includes(value)?value:'pt';
  };
  const labels={
    pt:{heading:'Pendências para conferir',action:'Corrigir ficha',hint:'Confirme a patente e envie a alteração. Se exigir autorização nacional, este aviso só desaparecerá depois da aprovação.',error:'Não foi possível consultar pendências:',openError:'Não foi possível abrir a ficha:'},
    ja:{heading:'確認が必要な項目',action:'記録を修正',hint:'階級を確認して変更申請を送信してください。承認が必要な場合は、承認後にお知らせが消えます。',error:'確認事項を取得できません:',openError:'記録を開けません:'},
    en:{heading:'Records to review',action:'Correct record',hint:'Confirm the rank and submit the change. If national approval is required, the notice disappears only after approval.',error:'Could not load pending items:',openError:'Could not open the record:'}
  };
  function mount(){
    const root=document.getElementById('inicio');
    if(!root)return false;
    if(element.parentElement!==root){
      const anchor=root.querySelector('#fju-coord-app-shell,.fju-today-section');
      root.insertBefore(element,anchor||root.firstChild);
    }
    return true;
  }
  function clear(){
    ++loadSerial;
    element.hidden=true;
    element.replaceChildren();
    opened=false;
    lastUpdated=0;
  }
  function render(items,error){
    if(!mount())return;
    element.replaceChildren();
    if(!items.length&&!error){element.hidden=true;return;}
    element.hidden=false;
    const words=labels[lang()];
    const heading=document.createElement('h3');
    heading.textContent=words.heading+(items.length?' ('+items.length+')':'');
    element.append(heading);
    if(error){
      const warning=document.createElement('p');
      warning.className='fju-coord-pendencias-error';
      warning.textContent=words.error+' '+error.message;
      element.append(warning);
      return;
    }
    const list=document.createElement('div');
    list.className='fju-coord-pendencias-list';
    for(const item of items){
      const card=document.createElement('article');
      card.className='fju-coord-pendencia';
      const title=document.createElement('strong');
      title.textContent=item.titulo;
      const description=document.createElement('p');
      description.textContent=item.descricao;
      const note=document.createElement('small');
      note.textContent=words.hint;
      const action=document.createElement('button');
      action.type='button';
      action.className='fju-coord-pendencia-open';
      action.textContent=words.action+' →';
      const status=document.createElement('p');
      status.className='fju-coord-pendencia-feedback';
      status.setAttribute('role','status');
      action.addEventListener('click',async()=>{
        if(action.disabled)return;
        action.disabled=true;
        status.textContent='';
        try{await openYouthEdit(item);}
        catch(e){status.textContent=words.openError+' '+(e?.message||'Erro desconhecido');}
        finally{action.disabled=false;}
      });
      card.append(title,description,note,action,status);
      list.append(card);
    }
    element.append(list);
  }
  async function refresh(profile=getProfile(),force=false){
    if(profile?.papel!=='coordenador'||!profile.polo_id){clear();return;}
    if(!force&&Date.now()-lastUpdated<10000)return;
    lastUpdated=Date.now();
    const request=++loadSerial;
    try{
      const {data,error}=await supabase.from('fju_pendencias_coordenadores')
        .select('id,polo_id,jovem_id,titulo,descricao,status,criado_em')
        .eq('polo_id',profile.polo_id).eq('status','pendente')
        .order('criado_em',{ascending:false}).limit(25);
      if(request!==loadSerial||getProfile()!==profile)return;
      if(error)throw error;
      render(data||[],null);
    }catch(error){
      if(request!==loadSerial||getProfile()!==profile)return;
      lastUpdated=0;
      render([],error);
    }
  }
  function onReturn(){
    if(document.hidden)return;
    const profile=getProfile();
    if(profile?.papel==='coordenador')void refresh(profile,true);
  }
  mount();
  window.setInterval(()=>{if(!document.hidden)void refresh();},30000);
  document.addEventListener('visibilitychange',onReturn);
  window.addEventListener('focus',onReturn);
  document.getElementById('fju-admin-language-select')?.addEventListener('change',onReturn);
  return {refresh,clear};
}
