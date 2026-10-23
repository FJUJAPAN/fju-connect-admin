// FJU JAPAN | Testes de foto e igreja no cadastro, sem banco real.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('let youthSubmitInProgress=false;');
const end=html.indexOf("el('youth-photo').addEventListener",start);
assert.ok(start>0&&end>start,'Formulário não encontrado');
const snippet=html.slice(start,end);
const settle=async()=>{for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture(photoType='image/jpeg',photoSize=1234,compressFails=false,uploadFails=false){
 const dom=new JSDOM(html,{url:'https://fjujapan.github.io/fju-connect-admin/',runScripts:'outside-only'});
 const w=dom.window,d=w.document,events=[],messages=[],profile={papel:'nacional',polo_id:null};
 const addPolo=(id,label,selector)=>{
   const option=d.createElement('option');option.value=id;option.textContent=label;
   d.querySelector(selector).append(option);
 };
 addPolo('polo-A','Hamamatsu','#youth-list-polo');
 addPolo('polo-B','Toyohashi','#youth-list-polo');
 addPolo('polo-A','Hamamatsu','#youth-polo');
 addPolo('polo-B','Toyohashi','#youth-polo');
 d.querySelector('#youth-list-polo').value='polo-A';
 d.querySelector('#youth-polo').value='polo-B';
 d.querySelector('#youth-name').value='Pessoa Teste';
 d.querySelector('#youth-rank').value='Firme';
 assert.equal(d.querySelector('#youth-rank').value,'Firme');
 const fakeFile={type:photoType,size:photoSize};
 Object.defineProperty(d.querySelector('#youth-photo'),'files',{configurable:true,value:[fakeFile]});
 w.__events=events;w.__messages=messages;w.__profile=profile;
 w.__mockCompress=async()=>{events.push('compactar');if(compressFails)throw Error('Compressão indisponível');return {size:9100,type:'image/jpeg'};};
 w.__supabase={
  from:table=>{
   assert.equal(table,'fju_jovens');
   return {insert:payload=>{
     events.push('gravar');
     assert.equal(payload.polo_id,'polo-B');
     return {select:()=>({single:async()=>({data:{id:'jovem-123'},error:null})})};
   }};
  },
  storage:{from:bucket=>{
    assert.equal(bucket,'fju-fotos');
    return {upload:async(path,blob)=>{
      events.push('foto');
      assert.equal(path,'jovem-123/perfil.jpg');
      assert.equal(blob.size,9100);
      return uploadFails?{error:{message:'Sem conexão'}}:{error:null};
    }};
  }}
 };
 w.eval('var currentProfile=window.__profile;var profileRequest=9;'+
 'var supabase=window.__supabase;const el=id=>document.getElementById(id);'+
 'const syncYouthBirth=()=>true;const selectedYouthLanguages=()=>[];'+
 'const compactarFoto100KB=window.__mockCompress;'+
 'const youthMessage=(msg,error)=>window.__messages.push({msg,error});'+
 'const resetYouth=()=>window.__events.push("reset");'+
 'const setYouthFormOpen=()=>window.__events.push("fechar");'+
 'const loadYouth=async()=>window.__events.push("atualizar-lista");'+
 'const loadDashboard=()=>window.__events.push("atualizar-dashboard");'+snippet);
 return {w,d,events,messages,dom,submit:()=>d.querySelector('#youth-form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true})),cleanup:()=>dom.window.close()};
}
test('Foto inválida não grava ficha',async()=>{
 const f=fixture('image/heic');
 try{
   f.submit();await settle();
   assert.ok(!f.events.includes('gravar'));
   assert.match(f.messages.at(-1).msg,/Foto inválida/);
   assert.equal(f.d.querySelector('#youth-submit').disabled,false);
 }finally{f.cleanup();}
});
test('Erro de compressão interrompe a gravação antes de criar a ficha',async()=>{
 const f=fixture('image/jpeg',1000,true);
 try{
   f.submit();await settle();
   assert.ok(f.events.includes('compactar'));
   assert.ok(!f.events.includes('gravar'));
   assert.match(f.messages.at(-1).msg,/Compressão indisponível/);
 }finally{f.cleanup();}
});
test('Foto preparada antes da gravação e igreja correta selecionada após salvar',async()=>{
 const f=fixture();
 try{
   f.submit();await settle();
   assert.deepEqual(f.events.slice(0,3),['compactar','gravar','foto']);
   assert.equal(f.d.querySelector('#youth-list-polo').value,'polo-B');
   assert.equal(f.d.querySelector('#youth-search').value,'');
   assert.ok(f.events.includes('atualizar-lista'));
   assert.match(f.messages.at(-1).msg,/Ficha e foto salvas com sucesso/);
 }finally{f.cleanup();}
});
test('Falha no upload informa a ficha salva e ainda atualiza a igreja',async()=>{
 const f=fixture('image/jpeg',1000,false,true);
 try{
   f.submit();await settle();
   assert.ok(f.events.includes('gravar'));
   assert.ok(f.events.includes('atualizar-lista'));
   assert.equal(f.d.querySelector('#youth-list-polo').value,'polo-B');
   assert.match(f.messages.at(-1).msg,/foto não foi enviada: Sem conexão/);
   assert.equal(Boolean(f.messages.at(-1).error),true);
 }finally{f.cleanup();}
});
test('Carregamento de foto é invalidado ao mudar a ficha',()=>{
 assert.match(html,/let youthPhotoLoadVersion=0;/);
 assert.match(html,/photoLoad===youthPhotoLoadVersion&&currentProfile===profile/);
 assert.match(html,/function resetYouth\(\)\{\+\+youthPhotoLoadVersion;/);
});
