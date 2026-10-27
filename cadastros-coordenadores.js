export function setupCoordinatorRequests({supabase,getProfile}){
 const host=document.getElementById('admin-access-list');
 if(!host)return;
 const section=document.createElement('section');
 section.style.cssText='margin:16px 0;padding:16px;border:1px solid #d4dce8;border-radius:16px';
 const title=document.createElement('h3');title.textContent='Cadastros exclusivos de coordenadores';
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Atualizar pedidos de coordenadores';
 const status=document.createElement('p');status.setAttribute('role','status');
 const list=document.createElement('div');section.append(title,refresh,status,list);
 host.parentElement.insertBefore(section,host);
 async function load(){
  list.replaceChildren();
  if(getProfile()?.papel!=='nacional'){section.hidden=true;return;}
  section.hidden=false;status.textContent='Consultando pedidos…';
  const {data,error}=await supabase.rpc('fju_listar_cadastros_coordenadores');
  if(error){status.textContent='Não foi possível consultar: '+error.message;return;}
  const rows=Array.isArray(data)?data:[];
  status.textContent=rows.length?rows.length+' pedido(s) pendente(s)':'Nenhum cadastro de coordenador pendente.';
  for(const row of rows){
   const card=document.createElement('article');card.className='report-card';
   const heading=document.createElement('strong');heading.textContent=row.nome;
   const info=document.createElement('p');info.textContent=(row.polo_nome||'Polo')+' · '+(row.email||'');
   const approve=document.createElement('button');approve.type='button';approve.textContent='Aprovar coordenador';
   const reject=document.createElement('button');reject.type='button';reject.textContent='Rejeitar';reject.className='secondary';
   const message=document.createElement('p');message.setAttribute('role','status');
   for(const [button,decision] of [[approve,true],[reject,false]])button.addEventListener('click',async()=>{
    if(getProfile()?.papel!=='nacional')return;
    if(!confirm((decision?'Aprovar':'Rejeitar')+' '+row.nome+' como coordenador de '+row.polo_nome+'?'))return;
    approve.disabled=reject.disabled=true;message.textContent='Salvando decisão…';
    const {error}=await supabase.rpc('fju_decidir_cadastro_coordenador',{p_id:row.id,p_aprovar:decision});
    if(error){message.textContent=error.message;approve.disabled=reject.disabled=false;return;}
    await load();
   });
   card.append(heading,info,approve,reject,message);list.append(card);
  }
 }
 refresh.addEventListener('click',load);
 document.addEventListener('click',e=>{if(e.target.closest?.('[data-tab]'))setTimeout(load,250);});
 setTimeout(load,1000);
 return {refresh:load};
}