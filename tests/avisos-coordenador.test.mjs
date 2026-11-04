import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const src=readFileSync(new URL('../avisos-coordenador.js',import.meta.url),'utf8');
const {setupCoordinatorPendingNotices}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(src));
const item={id:'aviso1',polo_id:'toyohashi',jovem_id:'kimily',titulo:'Conferir patente de Kimily',descricao:'Confirmar Colaborador(a) ou Obreiro(a)',status:'pendente'};
function fixture(){
  const dom=new JSDOM('<body><section id="inicio"><div class="fju-today-section"></div></section><select id="fju-admin-language-select"><option value="pt" selected>Português</option></select></body>',{url:'https://fjujapan.github.io/fju-connect-admin/'});
  globalThis.document=dom.window.document;
  globalThis.window=dom.window;
  let profile={papel:'coordenador',polo_id:'toyohashi'},items=[item],error=null;
  const calls=[],opened=[];
  const db={from(table){
    assert.equal(table,'fju_pendencias_coordenadores');
    const filters=[];
    const query={
      select(){return query;},
      eq(key,value){filters.push([key,value]);return query;},
      order(){return query;},
      limit(){calls.push(filters);return Promise.resolve({data:items,error});}
    };
    return query;
  }};
  const manager=setupCoordinatorPendingNotices({supabase:db,getProfile:()=>profile,openYouthEdit:async row=>opened.push(row)});
  return {dom,manager,calls,opened,setProfile:p=>{profile=p},setItems:next=>{items=next},setError:e=>{error=e}};
}
test('Only coordinator notices in the authorized church appear',async()=>{
  const f=fixture();
  try{
    await f.manager.refresh({papel:'nacional',polo_id:null},true);
    assert.equal(f.calls.length,0);
    await f.manager.refresh({papel:'coordenador',polo_id:'toyohashi'},true);
    // Only results for the exact current profile reference may display.
    assert.equal(f.dom.window.document.getElementById('fju-coord-pendencias-patente').hidden,true);
    await f.manager.refresh(undefined,true);
    const notice=f.dom.window.document.getElementById('fju-coord-pendencias-patente');
    assert.equal(notice.hidden,false);
    assert.match(notice.textContent,/Kimily/);
    assert.deepEqual(f.calls.at(-1),[['polo_id','toyohashi'],['status','pendente']]);
    notice.querySelector('button').click();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(f.opened.length,1);
    assert.equal(f.opened[0].jovem_id,'kimily');
    f.setProfile({papel:'nacional',polo_id:null});
    f.manager.clear();
    assert.equal(notice.hidden,true);
  }finally{f.dom.window.close();}
});
test('Approved rank change removes the resolved task from the dashboard',async()=>{
  const f=fixture();
  try{
    await f.manager.refresh(undefined,true);
    f.setItems([]);
    await f.manager.refresh(undefined,true);
    assert.equal(f.dom.window.document.getElementById('fju-coord-pendencias-patente').hidden,true);
  }finally{f.dom.window.close();}
});
test('Coordinator sees data access failures rather than a false empty state',async()=>{
  const f=fixture();
  try{
    f.setError({message:'RLS denied'});
    await f.manager.refresh(undefined,true);
    assert.match(f.dom.window.document.getElementById('fju-coord-pendencias-patente').textContent,/RLS denied/);
  }finally{f.dom.window.close();}
});
test('Page routes alerts to the existing ficha editor with the youth id',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/setupCoordinatorPendingNotices/);
  assert.match(html,/await youthInitialization/);
  assert.match(html,/editYouth\(row\.id\)/);
});
