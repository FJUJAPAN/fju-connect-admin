// FJU JAPAN. Execute com PGlite e jsdom instalados no ambiente de testes.
import {PGlite} from '@electric-sql/pglite';
import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const db=new PGlite();
const ids=Array.from({length:9},(_,i)=>`00000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`);
const [national,coord,other,target,outsider,polo,otherPolo,youth,otherYouth]=ids;
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.fju_polos(id uuid PRIMARY KEY,nome text);
CREATE TABLE public.fju_perfis(usuario_id uuid PRIMARY KEY REFERENCES auth.users(id),papel text,polo_id uuid REFERENCES fju_polos(id),ativo boolean);
CREATE TABLE public.fju_jovens(id uuid PRIMARY KEY,polo_id uuid REFERENCES fju_polos(id),patente text,nome_completo text,excluido_em timestamptz);
CREATE TABLE public.fju_vinculos_conta_jovem(jovem_id uuid UNIQUE,usuario_id uuid UNIQUE,ativo boolean);
CREATE TABLE public.fju_coordenador_cards(usuario_id uuid PRIMARY KEY,nome_exibicao text);
INSERT INTO auth.users VALUES ${[national,coord,other,target,outsider].map((id,i)=>`('${id}','test${i}@example.com',now())`).join(',')};
INSERT INTO fju_polos VALUES('${polo}','Polo A'),('${otherPolo}','Polo B');
INSERT INTO fju_perfis VALUES('${national}','nacional',null,true),('${coord}','coordenador','${polo}',true),('${other}','coordenador','${otherPolo}',true);
INSERT INTO fju_jovens VALUES('${youth}','${polo}','coordenador','Pessoa teste',null),('${otherYouth}','${otherPolo}','coordenador','Outra pessoa',null);
INSERT INTO fju_vinculos_conta_jovem VALUES('${youth}','${target}',true);`);
const migration=fs.readFileSync(new URL('../supabase/migrations/20261022_acesso_administrativo.sql',import.meta.url),'utf8');
await db.exec(migration);
await db.exec(migration); // Instalação pode ser repetida.
await db.exec(`CREATE TABLE public.fju_solicitacoes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),jovem_id uuid,polo_id uuid,solicitante_id uuid,tipo text,dados_propostos jsonb,status text DEFAULT 'pendente');
GRANT INSERT,SELECT ON public.fju_solicitacoes TO authenticated;
CREATE FUNCTION public.fixture_decide(p_id uuid,p_approve boolean,p_status_first boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE r record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM fju_perfis WHERE usuario_id=auth.uid() AND ativo AND papel='nacional') THEN RAISE EXCEPTION 'Nacional obrigatório'; END IF;
 SELECT * INTO r FROM fju_solicitacoes WHERE id=p_id FOR UPDATE;
 IF r.status<>'pendente' THEN RAISE EXCEPTION 'Já decidido'; END IF;
 IF p_status_first THEN UPDATE fju_solicitacoes SET status=CASE WHEN p_approve THEN 'aprovada' ELSE 'rejeitada' END WHERE id=p_id; END IF;
 IF p_approve THEN UPDATE fju_jovens SET patente=r.dados_propostos->>'patente' WHERE id=r.jovem_id; END IF;
 IF NOT p_status_first THEN UPDATE fju_solicitacoes SET status=CASE WHEN p_approve THEN 'aprovada' ELSE 'rejeitada' END WHERE id=p_id; END IF;
END; $$;`);
const automatic=fs.readFileSync(new URL('../supabase/migrations/20261022_patente_coordenador_acesso.sql',import.meta.url),'utf8');
await db.exec(automatic);await db.exec(automatic);

const actor=async id=>{await db.exec(`RESET ROLE; SELECT set_config('test.uid','${id}',false); SET ROLE authenticated;`);};
const request=async(email='test3@example.com')=>(await db.query('SELECT fju_solicitar_acesso_admin($1,$2) AS id',[youth,email])).rows[0].id;
const decide=async(id,approve=true)=>db.query('SELECT fju_decidir_acesso_admin($1,$2)',[id,approve]);
let passed=0;
async function test(name,fn){await db.exec('RESET ROLE; BEGIN');try{await fn();passed++;console.log('OK',name);}finally{await db.exec('ROLLBACK; RESET ROLE');}}
await test('coordenador solicita sem conceder acesso; só nacional aprova',async()=>{
 await actor(coord);const id=await request();
 await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM fju_perfis WHERE usuario_id=$1',[target])).rows[0].n,0);
 await actor(national);await decide(id);
 await db.exec('RESET ROLE');const p=(await db.query('SELECT * FROM fju_perfis WHERE usuario_id=$1',[target])).rows[0];
 assert.equal(p.papel,'coordenador');assert.equal(p.polo_id,polo);assert.equal(p.ativo,true);
 const a=(await db.query('SELECT * FROM fju_pedidos_acesso_admin')).rows[0];assert.equal(a.analisado_por,national);assert.equal(a.status,'aprovado');
});
await test('membro comum não solicita',async()=>{await actor(target);await assert.rejects(request(),/Acesso não autorizado/);});
await test('coordenador de outro polo não solicita',async()=>{await actor(other);await assert.rejects(request(),/seu polo/);});
await test('e-mail não vinculado é bloqueado',async()=>{await actor(coord);await assert.rejects(request('test4@example.com'),/vinculada/);});
await test('patente não aprovada é bloqueada',async()=>{await db.exec(`UPDATE fju_jovens SET patente='obreiro' WHERE id='${youth}'`);await actor(coord);await assert.rejects(request(),/patente/);});
await test('pedido duplicado é bloqueado',async()=>{await actor(coord);await request();await assert.rejects(request(),/pendente/);});
await test('coordenador não aprova',async()=>{await actor(coord);const id=await request();await assert.rejects(decide(id),/Somente o Nacional/);});
await test('rejeição não concede acesso',async()=>{await actor(coord);const id=await request();await actor(national);await decide(id,false);await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM fju_perfis WHERE usuario_id=$1',[target])).rows[0].n,0);});
for(const [name,sql] of [
 ['polo mudou',`UPDATE fju_jovens SET polo_id='${otherPolo}' WHERE id='${youth}'`],
 ['patente mudou',`UPDATE fju_jovens SET patente='obreiro' WHERE id='${youth}'`],
 ['ficha excluída',`UPDATE fju_jovens SET excluido_em=now() WHERE id='${youth}'`],
 ['vínculo desativado',`UPDATE fju_vinculos_conta_jovem SET ativo=false`],
 ['email mudou',`UPDATE auth.users SET email='changed@example.com' WHERE id='${target}'`],
 ['solicitante desativado',`UPDATE fju_perfis SET ativo=false WHERE usuario_id='${coord}'`],
 ['alvo tornou-se nacional',`INSERT INTO fju_perfis VALUES('${target}','nacional',null,true)`],
 ['alvo mudou para outro polo',`INSERT INTO fju_perfis VALUES('${target}','coordenador','${otherPolo}',true)`]
])await test('aprovação bloqueada: '+name,async()=>{await actor(coord);const id=await request();await db.exec('RESET ROLE; '+sql);await actor(national);await assert.rejects(decide(id));});
await test('pedido já decidido não é aprovado de novo',async()=>{await actor(coord);const id=await request();await actor(national);await decide(id);await assert.rejects(decide(id),/já foi analisado/);});
await test('listagem restrita ao polo',async()=>{await actor(coord);await request();await actor(other);assert.deepEqual((await db.query('SELECT fju_listar_pedidos_acesso_admin() r')).rows[0].r,[]);await actor(national);assert.equal((await db.query('SELECT fju_listar_pedidos_acesso_admin() r')).rows[0].r.length,1);});
await test('escrita direta nos pedidos negada',async()=>{await actor(coord);await assert.rejects(db.exec("UPDATE fju_pedidos_acesso_admin SET status='aprovado'"),/permission denied/);});
await test('anônimo não chama funções',async()=>{await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT fju_listar_pedidos_acesso_admin()'),/permission denied/);});

const rankRequest=async()=> (await db.query(`INSERT INTO fju_solicitacoes(jovem_id,polo_id,solicitante_id,tipo,dados_propostos) VALUES($1,$2,$3,'patente','{"patente":"coordenador"}') RETURNING id`,[youth,polo,coord])).rows[0].id;
await test('conta automática usa vínculo sem e-mail do cliente',async()=>{await actor(coord);const data=(await db.query('SELECT fju_conta_coordenacao($1) r',[youth])).rows[0].r;assert.equal(data.email,'test3@example.com');const id=(await db.query('SELECT fju_solicitar_acesso_admin($1) id',[youth])).rows[0].id;assert(id);});
await test('conta de outro polo não é exposta',async()=>{await actor(other);await assert.rejects(db.query('SELECT fju_conta_coordenacao($1)',[youth]),/fora do seu polo/);});
for(const statusFirst of [false,true])await test('aprovação conjunta e atômica; status primeiro='+statusFirst,async()=>{
 await db.exec(`UPDATE fju_jovens SET patente='obreiro' WHERE id='${youth}'`);await actor(coord);const id=await rankRequest();
 const list=(await db.query('SELECT fju_listar_pedidos_acesso_admin() r')).rows[0].r;assert.equal(list[0].solicitacao_patente_id,id);assert.equal(list[0].email,'test3@example.com');
 await actor(national);await db.query('SELECT fixture_decide($1,true,$2)',[id,statusFirst]);await db.exec('SET CONSTRAINTS ALL IMMEDIATE; RESET ROLE');
 const p=(await db.query('SELECT * FROM fju_perfis WHERE usuario_id=$1',[target])).rows[0];assert.equal(p.polo_id,polo);assert(p.ativo);
 assert.equal((await db.query('SELECT status FROM fju_pedidos_acesso_admin')).rows[0].status,'aprovado');
});
await test('rejeição conjunta mantém patente e não concede acesso',async()=>{await db.exec(`UPDATE fju_jovens SET patente='obreiro' WHERE id='${youth}'`);await actor(coord);const id=await rankRequest();await actor(national);await db.query('SELECT fixture_decide($1,false)',[id]);await db.exec('SET CONSTRAINTS ALL IMMEDIATE; RESET ROLE');assert.equal((await db.query('SELECT patente FROM fju_jovens WHERE id=$1',[youth])).rows[0].patente,'obreiro');assert.equal((await db.query('SELECT status FROM fju_pedidos_acesso_admin')).rows[0].status,'rejeitado');assert.equal((await db.query('SELECT count(*)::int n FROM fju_perfis WHERE usuario_id=$1',[target])).rows[0].n,0);});
await test('pedido vinculado não pode ser aprovado separadamente',async()=>{await actor(coord);await rankRequest();const id=(await db.query('SELECT fju_listar_pedidos_acesso_admin() r')).rows[0].r[0].id;await actor(national);await assert.rejects(decide(id),/junto com o pedido/);});
await test('sem conta confirmada não cria pedido parcial',async()=>{await db.exec('UPDATE fju_vinculos_conta_jovem SET ativo=false');await actor(coord);await assert.rejects(rankRequest(),/conta confirmada/);});
await test('conta alterada bloqueia aprovação conjunta',async()=>{await actor(coord);const id=await rankRequest();await db.exec(`RESET ROLE; UPDATE auth.users SET email='changed@example.com' WHERE id='${target}'`);await actor(national);await db.query('SELECT fixture_decide($1,true)',[id]);await assert.rejects(db.exec('SET CONSTRAINTS ALL IMMEDIATE'),/vínculo da conta mudou/);});
await test('pedido vinculado não pode ser reescrito',async()=>{await actor(coord);const id=await rankRequest();await db.exec('RESET ROLE');await assert.rejects(db.query(`UPDATE fju_solicitacoes SET dados_propostos='{"patente":"obreiro"}' WHERE id=$1`,[id]),/não pode ser reescrito/);});
await test('pedido antigo não vinculado não promove conta ao aprovar patente',async()=>{await db.exec(`INSERT INTO fju_solicitacoes(jovem_id,polo_id,solicitante_id,tipo,dados_propostos) VALUES('${youth}','${polo}','${coord}','patente','{"patente":"obreiro"}')`);await actor(national);const id=(await db.query('SELECT id FROM fju_solicitacoes')).rows[0].id;await db.query('SELECT fixture_decide($1,true)',[id]);await db.exec('SET CONSTRAINTS ALL IMMEDIATE; RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM fju_perfis WHERE usuario_id=$1',[target])).rows[0].n,0);});
await db.close();
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const [,attr,source] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
 if(/\bsrc=/.test(attr)||!source.trim())continue;
 new vm.Script('(async()=>{'+source.replace(/^import\s+.*?;\s*$/gm,'')+'\n})()');
}
const source=fs.readFileSync(new URL('../acesso-administrativo.js',import.meta.url),'utf8');
const {setupAdministrativeAccess}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const dom=new JSDOM(html);globalThis.document=dom.window.document;globalThis.confirm=()=>true;
let profile={papel:'coordenador'},calls=[];
const rows=[{id:'request',nome_completo:'<b>Pessoa</b>',email:'test3@example.com',polo_nome:'Polo A',solicitante_nome:'Coordenador',status:'pendente'}];
const supabase={auth:{onAuthStateChange(){}},rpc:async(name,args)=>{calls.push({name,args});return {data:name==='fju_listar_pedidos_acesso_admin'?rows:name==='fju_conta_coordenacao'?{email:'test3@example.com',polo_nome:'Polo A'}:null,error:null};}};
const ui=setupAdministrativeAccess({supabase,getProfile:()=>profile});
const panel=document.getElementById('youth-detail');
ui.appendRequest(panel,{id:youth,patente:'coordenador'});
await new Promise(r=>setTimeout(r,0));
assert.equal(panel.querySelectorAll('input').length,0);assert.match(panel.textContent,/test3@example.com/);
panel.querySelector('button').click();await new Promise(r=>setTimeout(r,0));
const requestCall=calls.find(c=>c.name==='fju_solicitar_acesso_admin');assert.deepEqual(requestCall.args,{p_jovem_id:youth});assert.match(panel.textContent,/Pedido enviado/);
await ui.refresh();assert.equal(document.querySelectorAll('#admin-access-list button').length,0);
profile={papel:'nacional'};await ui.refresh();assert.equal(document.querySelectorAll('#admin-access-list button').length,2);assert.equal(document.querySelectorAll('#admin-access-list b').length,0);
document.querySelector('#admin-access-list button').click();await new Promise(r=>setTimeout(r,0));assert(calls.some(c=>c.name==='fju_decidir_acesso_admin'&&c.args.p_aprovar===true));
rows[0].solicitacao_patente_id='rank-request';await ui.refresh();assert.equal(document.querySelectorAll('#admin-access-list button').length,0);assert.match(document.getElementById('admin-access-list').textContent,/mudança de patente/);
supabase.rpc=async()=>({error:{code:'PGRST202'}});await ui.refresh();assert.match(document.getElementById('admin-access-message').textContent,/instalação/);
ui.clear();assert.equal(document.getElementById('admin-access-list').childElementCount,0);
console.log(`${passed} cenários SQL + formulário, permissões visuais, aprovação, escape HTML, atualização ausente e sintaxe: OK`);
