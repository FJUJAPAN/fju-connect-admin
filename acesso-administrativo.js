// FJU JAPAN | Solicitação e aprovação nacional de acesso ao painel.

const accessCopy={
 pt:{loading:'Consultando pedidos de acesso administrativo…',pending:n=>n+' pedido(s) aguardando decisão nacional.',empty:'Nenhum pedido de acesso administrativo pendente.',church:'Polo da ficha no pedido: ',account:'Conta: ',by:'Solicitado por: ',states:{pendente:'Aguardando aprovação nacional',aprovado:'Aprovado',rejeitado:'Rejeitado'},linked:t().linked,approve:'Aprovar acesso',approveLinked:'Aprovar patente e acesso',reject:'Rejeitar',rejectLinked:'Rejeitar patente e acesso',confirmApprove:'Liberar o painel administrativo para ',confirmReject:'Rejeitar o acesso de ',churchSuffix:', polo ',saving:'Registrando decisão…'},
 ja:{loading:'管理者アクセス申請を確認中…',pending:n=>n+'件の申請が全国管理者の判断待ちです。',empty:'保留中の管理者アクセス申請はありません。',church:'申請対象の教会: ',account:'アカウント: ',by:'申請者: ',states:{pendente:'全国管理者の承認待ち',aprovado:'承認済み',rejeitado:'却下'},linked:'階級変更申請に紐づいています。上記の青年名簿申請から判断してください。',approve:'アクセスを承認',approveLinked:'階級とアクセスを承認',reject:'却下',rejectLinked:'階級とアクセスを却下',confirmApprove:'管理パネルへのアクセスを許可しますか: ',confirmReject:'アクセスを却下しますか: ',churchSuffix:', 教会 ',saving:'処理中…'},
 en:{loading:'Loading administrative access requests…',pending:n=>n+' request(s) awaiting national approval.',empty:'No pending administrative access requests.',church:'Church on requested record: ',account:'Account: ',by:'Requested by: ',states:{pendente:'Awaiting national approval',aprovado:'Approved',rejeitado:'Rejected'},linked:'Linked to a rank change. Decide using the youth record request above.',approve:'Approve access',approveLinked:'Approve rank and access',reject:'Reject',rejectLinked:'Reject rank and access',confirmApprove:'Grant dashboard access to ',confirmReject:'Reject access for ',churchSuffix:', church ',saving:'Saving decision…'}
};
export function setupAdministrativeAccess({supabase,getProfile,getLanguage=()=> 'pt',onDecision=()=>{}}){
  const list=document.getElementById('admin-access-list');
  const status=document.getElementById('admin-access-message');
  let version=0;
  const t=()=>accessCopy[getLanguage()]||accessCopy.pt;
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
    list.replaceChildren();status.textContent=t().loading;
    if(!profile){status.textContent='';return;}
    try{
      const {data,error}=await supabase.rpc('fju_listar_pedidos_acesso_admin');
      if(current!==version||getProfile()!==profile)return;
      if(error)throw error;
      const rows=Array.isArray(data)?data:[];
      const pending=rows.filter(row=>row.status==='pendente');
      status.textContent=pending.length?t().pending(pending.length):t().empty;
      const ordered=[...pending,...rows.filter(row=>row.status!=='pendente')];
      for(const row of ordered){
        const card=element('article',null,'report-card');
        card.append(element('strong',row.nome_completo||'Ficha sem nome','report-card-title'));
        card.append(element('p',t().church+row.polo_nome));
        card.append(element('p',t().account+row.email));
        card.append(element('p',t().by+row.solicitante_nome,'muted'));
        const state=t().states;
        card.append(element('p',state[row.status]||row.status,'muted'));
        if(row.solicitado_em)card.append(element('p',new Date(row.solicitado_em).toLocaleString('pt-BR',{timeZone:'Asia/Tokyo'}),'muted'));
        if(row.solicitacao_patente_id){card.append(element('p','Vinculado à mudança de patente. A decisão é feita no pedido da ficha, acima.','muted'));}
        if(row.status==='pendente'&&profile.papel==='nacional'){
          const actions=element('div',null,'actions'),feedback=element('p',null,'message');feedback.setAttribute('role','status');
          const linked=Boolean(row.solicitacao_patente_id);
          const approve=element('button',linked?t().approveLinked:t().approve),reject=element('button',linked?t().rejectLinked:t().reject,'secondary');
          for(const [button,approved] of [[approve,true],[reject,false]]){
            button.type='button';
            button.addEventListener('click',async()=>{
              if(approve.disabled||reject.disabled||current!==version||getProfile()!==profile||!card.isConnected)return;
              if(!confirm((approved?t().confirmApprove:t().confirmReject)+row.nome_completo+' ('+row.email+')+t().churchSuffix+row.polo_nome+'?'))return;
              approve.disabled=true;reject.disabled=true;feedback.textContent=t().saving;
              try{
                const {error}=linked
                  ?await supabase.rpc('fju_decidir_solicitacao',{p_solicitacao_id:row.solicitacao_patente_id,p_aprovar:approved})
                  :await supabase.rpc('fju_decidir_acesso_admin',{p_pedido_id:row.id,p_aprovar:approved});
                if(error)throw error;
                if(current!==version||getProfile()!==profile)return;
                await refresh();
                if(getProfile()===profile)onDecision();
              }catch(error){if(current===version&&getProfile()===profile&&card.isConnected){feedback.textContent=errorText(error);approve.disabled=false;reject.disabled=false;}}
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
