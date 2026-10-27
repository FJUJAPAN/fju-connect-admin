// FJU JAPAN | Smoke tests da interface administrativa (sem conexão com Supabase).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {test} from 'node:test';

const read = file => readFileSync(new URL('../'+file, import.meta.url), 'utf8');
const html=read('index.html');
const drawerCss=read('admin-mobile-navigation.css');
const dashboardCss=read('admin-dashboard.css');
const dom=new JSDOM(html,{url:'https://fjujapan.github.io/fju-connect-admin/',runScripts:'outside-only'});
const win=dom.window;
const document=win.document;

function uniqueId(id){
  const found=document.querySelectorAll('[id="'+id+'"]');
  assert.equal(found.length,1,'O ID '+id+' deve existir uma única vez');
  return found[0];
}

test('Login, relatórios e aprovações preservam os IDs necessários',()=>{
  for(const id of [
    'auth','login-form','email','password','forgot','recovery','recovery-form',
    'app','main-nav','fju-admin-workspace','fju-admin-sidebar','fju-admin-menu-toggle',
    'fju-admin-menu-close','fju-admin-menu-overlay','identity','pending-bell','logout',
    'inscricoes-list','requests-list','admin-access-list','weekly-report-form',
    'national-report-panel','special-event-form','leader-directory','notification-settings'
  ])uniqueId(id);
});

test('Menu principal possui sete abas, todas com páginas correspondentes',()=>{
  const buttons=[...document.querySelectorAll('#main-nav button[data-tab]')];
  const tabs=buttons.map(button=>button.dataset.tab);
  assert.deepEqual(tabs,['inicio','jovens','relatorios','inscricoes','autorizacoes','lideranca','config']);
  for(const button of buttons){
    assert.equal(button.getAttribute('aria-controls'),button.dataset.tab);
    assert.equal(uniqueId(button.dataset.tab).tagName,'SECTION');
  }
  assert.equal(uniqueId('main-nav').closest('#fju-admin-sidebar')?.id,'fju-admin-sidebar');
});

test('Atalhos Nacional/Coordenador e CSS mobile permanecem disponíveis',()=>{
  for(const profile of ['nacional','coordenador']){
    const group=document.querySelector('[data-role-target="'+profile+'"]');
    assert.ok(group,profile+' sem atalhos');
    assert.equal(group.querySelectorAll('[data-action-tab]').length,3);
  }
  for(const cssFile of [
    'admin-brand.css','admin-dashboard.css','admin-reports.css','admin-settings.css',
    'admin-login.css','admin-shell-finish.css','admin-mobile-navigation.css'
  ])assert.ok(document.querySelector('link[href^="./'+cssFile+'"]'),cssFile+' não incluído');
  assert.match(drawerCss,/position:fixed!important;top:0!important;bottom:0!important/);
  assert.match(drawerCss,/\.fju-content-toolbar\s*\{\s*position:sticky/);
  assert.match(dashboardCss,/#main-nav\.tabs\s*\{[\s\S]*?position:static!important/);
  assert.equal(document.querySelector('footer #main-nav'),null);
});

test('Funções abre no celular e fecha por X, toque fora, Esc e resize',()=>{
  const marker='/* Menu administrativo lateral no celular; navegação desktop permanece estática. */';
  const start=html.indexOf(marker);
  const end=html.indexOf("document.querySelectorAll('.fju-dashboard-actions",start);
  assert.ok(start>=0 && end>start,'Não encontrou o controlador de navegação móvel');
  const snippet=html.slice(start,end);
  let mobile=true;
  let resizeListener=()=>{};
  const media={get matches(){return mobile;},addEventListener(type,cb){if(type==='change')resizeListener=cb;}};
  win.matchMedia=()=>media;
  win.eval('const el=id=>document.getElementById(id);\n'+snippet);
  // Simula o estado autenticado: no HTML inicial #app começa oculto.
  // Um controle invisível não pode receber foco em jsdom nem no navegador.
  uniqueId('app').classList.remove('hidden');
  const shell=uniqueId('fju-admin-workspace');
  const sidebar=uniqueId('fju-admin-sidebar');
  const toggle=uniqueId('fju-admin-menu-toggle');
  // O botão é oculto na interface nova; reabilita apenas neste teste para validar o controlador legado.
  toggle.hidden=false;
  const overlay=uniqueId('fju-admin-menu-overlay');
  const close=uniqueId('fju-admin-menu-close');
  const assertClosed=()=>{
    assert.ok(!shell.classList.contains('fju-menu-open'));
    assert.equal(toggle.getAttribute('aria-expanded'),'false');
    assert.equal(overlay.hidden,true);
    assert.ok(!document.body.classList.contains('fju-admin-drawer-open'));
  };
  const assertOpen=()=>{
    assert.ok(shell.classList.contains('fju-menu-open'));
    assert.equal(toggle.getAttribute('aria-expanded'),'true');
    assert.equal(overlay.hidden,false);
    assert.equal(sidebar.getAttribute('role'),'dialog');
    assert.equal(sidebar.getAttribute('aria-modal'),'true');
    assert.ok(document.body.classList.contains('fju-admin-drawer-open'));
  };
  toggle.click();assertOpen();
  close.click();assertClosed();assert.ok(document.activeElement===toggle||document.activeElement===document.body,'Foco deve retornar ao controle visível ou ao documento quando o menu foi ocultado');
  toggle.click();assertOpen();
  overlay.click();assertClosed();
  toggle.click();assertOpen();
  document.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assertClosed();
  toggle.click();assertOpen();
  mobile=false;resizeListener();assertClosed();
  assert.equal(sidebar.hasAttribute('role'),false);
  toggle.click();assertClosed();
  dom.window.close();
});
