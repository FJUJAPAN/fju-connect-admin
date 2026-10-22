// FJU JAPAN | Solicitação e aprovação nacional de acesso ao painel.
export function setupAdministrativeAccess({supabase,getProfile}){
  const list=document.getElementById('admin-access-list');
  const status=document.getElementById('admin-access-message');
  let version=0;
  const missing=error=>['PGRST202','42883','42P01'].includes(error?.code);
  const errorText=error=>missing(error)
    ?'A solicitação de acesso administrativo aguarda a instalação da atualização no banco de dados pelo Nacional.'
    :(error?.message||'Não foi possível concluir. Tente novamente.');
  function element(tag,text,className){
    const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;
  }
  function clear(){version++;list.replaceChildren();status.textContent='';}
  async function refresh(){
    const current=++version,profile=getProfile();
    list.replaceChildren();status.textContent='Consultando pedidos de acesso administrativo…';
    if(!profile){status.textContent='';return;}
    try{
      const {data,error}=await supabase.rpc('fju_listar_pedidos_acesso_admin');
      if(current!==version||getProfile()!==profile)return;
      if(error)throw error;
      const rows=Array.isArray(data)?data:[];
      const pending=rows.filter(row=>row.status==='pendente');
      status.textContent=pending.length?pending.length+' pedido(s) aguardando decisão nacional.':'Nenhum pedido de acesso administrativo pendente.';
      const ordered=[...pending,...rows.filter(row=>row.status!=='pendente')];
      for(const row of ordered){
        const card=element('article',null,'report-card');
        card.append(element('strong',row.nome_completo||'Ficha sem nome','report-card-title'));
        card.append(element('p','Polo da ficha no pedido: '+row.polo_nome));
        card.append(element('p','Conta: '+row.email));
        card.append(element('p','Solicitado por: '+row.solicitante_nome,'muted'));
        const state={pendente:'Aguardando aprovação nacional',aprovado:'Aprovado',rejeitado:'Rejeitado'};
        card.append(element('p',state[row.status]||row.status,'muted'));
        if(row.solicitado_em)card.append(element('p',new Date(row.solicitado_em).toLocaleString('pt-BR',{timeZone:'Asia/Tokyo'}),'muted'));
        if(row.solicitacao_patente_id){card.append(element('p','Vinculado à mudança de patente. A decisão é feita no pedido da ficha, acima.','muted'));}
        if(row.status==='pendente'&&profile.papel==='nacional'){
          const actions=element('div',null,'actions'),feedback=element('p',null,'message');feedback.setAttribute('role','status');
          const linked=Boolean(row.solicitacao_patente_id);
          const approve=element('button',linked?'Aprovar patente e acesso':'Aprovar acesso'),reject=element('button',linked?'Rejeitar patente e acesso':'Rejeitar','secondary');
          for(const [button,approved] of [[approve,true],[reject,false]]){
            button.type='button';
            button.addEventListener('click',async()=>{
              if(!confirm((approved?'Liberar o painel administrativo para ':'Rejeitar o acesso de ')+row.nome_completo+' ('+row.email+'), polo '+row.polo_nome+'?'))return;
              approve.disabled=true;reject.disabled=true;feedback.textContent='Registrando decisão…';
              try{
                const {error}=linked
                  ?await supabase.rpc('fju_decidir_solicitacao',{p_solicitacao_id:row.solicitacao_patente_id,p_aprovar:approved})
                  :await supabase.rpc('fju_decidir_acesso_admin',{p_pedido_id:row.id,p_aprovar:approved});
                if(error)throw error;
                if(current!==version||getProfile()!==profile)return;
                await refresh();
              }catch(error){if(current===version){feedback.textContent=errorText(error);approve.disabled=false;reject.disabled=false;}}
            });
          }
          actions.append(approve,reject);card.append(actions,feedback);
        }
        list.append(card);
      }
    }catch(error){if(current===version&&getProfile()===profile)status.textContent=errorText(error);}
  }
  function appendRequest(panel,youth){
    const profile=getProfile();
    if(!profile||!['coordenador','nacional'].includes(profile.papel))return;
    const box=element('div',null,'stat');box.style.marginTop='12px';
    box.append(element('strong','Conta vinculada e acesso administrativo'));
    box.append(element('p','O coordenador solicita; somente o Nacional aprova. O acesso será limitado ao mesmo polo desta ficha. A patente, sozinha, não libera o painel.','muted'));
    const isCoordinator=String(youth.patente||'').toLowerCase()==='coordenador';
    if(!isCoordinator){
      box.append(element('p','Ao solicitar a mudança de patente para Coordenador, o acesso será incluído automaticamente no mesmo pedido ao Nacional.','muted'));
    }
    const account=element('p','Identificando conta vinculada…','muted');
    const button=element('button','Solicitar acesso administrativo');button.type='button';button.disabled=true;button.hidden=!isCoordinator;
    const feedback=element('p',null,'message');feedback.setAttribute('role','status');
    box.append(account,button,feedback);panel.append(box);
    void (async()=>{
      try{
        const {data,error}=await supabase.rpc('fju_conta_coordenacao',{p_jovem_id:youth.id});
        if(getProfile()!==profile||!box.isConnected)return;
        if(error)throw error;
        if(!data?.email)throw new Error('Conta vinculada não encontrada. Confira o cadastro.');
        account.textContent='Conta identificada: '+data.email+' · Polo: '+data.polo_nome;
        button.disabled=false;
      }catch(error){if(getProfile()===profile&&box.isConnected){account.textContent='';feedback.textContent=errorText(error);}}
    })();
    button.addEventListener('click',async()=>{
      if(getProfile()!==profile||button.disabled||!isCoordinator)return;
      button.disabled=true;feedback.textContent='Enviando pedido ao Nacional…';
      try{
        const {error}=await supabase.rpc('fju_solicitar_acesso_admin',{p_jovem_id:youth.id});
        if(getProfile()!==profile||!box.isConnected)return;
        if(error)throw error;
        feedback.textContent='Pedido enviado. Acompanhe na aba Pedidos. O acesso só será liberado após a aprovação do Nacional.';
      }catch(error){if(getProfile()===profile&&box.isConnected){feedback.textContent=errorText(error);button.disabled=false;}}
    });
  }
  async function requestsByRank(){
    try{
      const {data,error}=await supabase.rpc('fju_listar_pedidos_acesso_admin');
      const result=new Map((!error&&Array.isArray(data)?data:[]).filter(row=>row.solicitacao_patente_id).map(row=>[row.solicitacao_patente_id,row]));
      result.unavailable=!!error;return result;
    }catch{const result=new Map();result.unavailable=true;return result;}
  }
  document.getElementById('admin-access-refresh').addEventListener('click',()=>void refresh());
  supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')clear();});
  return {refresh,appendRequest,clear,requestsByRank};
}
