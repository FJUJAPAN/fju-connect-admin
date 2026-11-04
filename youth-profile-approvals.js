import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const client=createClient('https://hmacroktklgwkofxsygv.supabase.co','sb_publishable_mdkfafhpqtthwzU8Hf7u9A_rErx3MFJ');
const labels={testemunho:'Testemunho',nascimento:'Nascimento',batismo_aguas:'Batismo nas águas',batismo_espirito_santo:'Batismo com Espírito Santo',projetos:'Projetos'};
const root=document.createElement('section');root.className='panel';root.id='fju-youth-edits-approvals';
root.innerHTML='<h2>Alterações de perfil dos jovens</h2><p>Solicitações do seu polo. A ficha só muda depois da aprovação.</p><button type="button" id="fju-edits-reload">Atualizar solicitações</button><p id="fju-edits-message" role="status"></p><div id="fju-edits-list"></div>';
const host=document.getElementById('solicitacoes')||document.getElementById('requests')||document.querySelector('main.wrap');
host?.append(root);
const message=root.querySelector('#fju-edits-message'),list=root.querySelector('#fju-edits-list');
const safe=(value)=>{const span=document.createElement('span');span.textContent=String(value??'—');return span;};
async function refresh(){
 const {data:{user}}=await client.auth.getUser();
 if(!user){root.hidden=true;return;}
 const {data:profile}=await client.from('fju_perfis').select('papel,polo_id,ativo').eq('usuario_id',user.id).maybeSingle();
 if(!profile?.ativo||!['coordenador','nacional'].includes(profile.papel)){root.hidden=true;return;}
 root.hidden=false;list.replaceChildren();message.textContent='Carregando solicitações...';
 let query=client.from('fju_edicoes_perfil_jovem').select('id,jovem_id,polo_id,dados_propostos,criado_em').eq('status','pendente').order('criado_em',{ascending:false}).limit(100);
 if(profile.papel==='coordenador')query=query.eq('polo_id',profile.polo_id);
 const {data,error}=await query;
 if(error){message.textContent='Erro: '+error.message;return;}
 message.textContent=data.length?data.length+' solicitação(ões) pendente(s)':'Nenhuma solicitação pendente.';
 for(const item of data){
  const card=document.createElement('article');card.style.cssText='padding:15px;margin:12px 0;border:1px solid #dce3ef;border-radius:12px;background:#fff';
  const {data:youth}=await client.from('fju_jovens').select('nome_completo,nascimento,batismo_aguas,batismo_espirito_santo,testemunho,projetos').eq('id',item.jovem_id).maybeSingle();
  const title=document.createElement('h3');title.textContent=youth?.nome_completo||'Jovem '+item.jovem_id;card.append(title);
  for(const [key,newValue] of Object.entries(item.dados_propostos||{})){
   if(!(key in labels))continue;
   const line=document.createElement('p');line.style.whiteSpace='pre-wrap';
   line.append(safe(labels[key]+': '),safe(Array.isArray(youth?.[key])?youth[key].join(', '):youth?.[key]),safe(' → '),safe(Array.isArray(newValue)?newValue.join(', '):newValue));card.append(line);
  }
  const feedback=document.createElement('p');feedback.setAttribute('role','status');
  for(const [approved,label] of [[true,'Aprovar'],[false,'Rejeitar']]){
   const button=document.createElement('button');button.textContent=label;button.type='button';button.style.marginRight='8px';
   button.addEventListener('click',async()=>{
    if(!confirm(label+' alterações desta ficha?'))return;
    for(const b of card.querySelectorAll('button'))b.disabled=true;
    feedback.textContent='Processando...';
    const {error}=await client.rpc('fju_decidir_edicao_perfil',{p_id:item.id,p_aprovar:approved});
    if(error){feedback.textContent=error.message;for(const b of card.querySelectorAll('button'))b.disabled=false;}
    else await refresh();
   });card.append(button);
  }
  card.append(feedback);list.append(card);
 }
}
root.querySelector('#fju-edits-reload').addEventListener('click',refresh);
document.addEventListener('click',event=>{if(event.target.closest('[data-tab="solicitacoes"],[data-tab="requests"]'))void refresh();});
void refresh();
