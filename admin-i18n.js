/* FJU JAPAN — idioma da interface administrativa.
   Altera apenas textos conhecidos da interface. Nunca traduz dados de usuários. */
(()=>{
  'use strict';
  const STORAGE_KEY='fju_admin_interface_language';
  const LANGUAGES=['pt','ja','en'];
  const words={
    'ÁREA ADMINISTRATIVA':['管理エリア','ADMIN AREA'],
    'ADMINISTRAÇÃO NACIONAL':['全国管理','NATIONAL ADMINISTRATION'],
    'COORDENAÇÃO LOCAL':['地域コーディネーター','LOCAL COORDINATION'],
    '↗ Site FJU':['↗ FJUサイト','↗ FJU Website'],
    'Um só lugar para cuidar da FJU.':['FJUの管理をひとつに。','Everything you need to manage FJU.'],
    'Painel exclusivo da liderança FJU JAPAN: gestão de jovens, relatórios, inscrições e acompanhamento dos polos.':['FJU JAPANリーダー専用：青年の管理、報告、登録、各教会の確認。','A dedicated FJU JAPAN leadership area for youth records, reports, signups and local groups.'],
    'Ferramentas do painel':['管理ツール','Dashboard tools'],
    'Jovens':['青年','Youth'],
    'Relatórios':['報告','Reports'],
    'Solicitações':['申請','Requests'],
    'Nacional e coordenadores locais · Acesso individual autorizado':['全国管理者・地域コーディネーター · 認証されたアカウントのみ','National and local coordinators · Authorized individual access'],
    'ÁREA RESTRITA':['関係者専用','RESTRICTED AREA'],
    'Entrar no painel':['管理画面にログイン','Sign in to dashboard'],
    'Utilize a conta autorizada para o seu perfil de liderança.':['承認されたリーダーアカウントでログインしてください。','Use the account authorized for your leadership role.'],
    'E-mail':['メールアドレス','Email'],
    'Senha':['パスワード','Password'],
    'Mostrar':['表示','Show'],
    'Entrar no painel ':['ログイン ','Sign in '],
    'Esqueci minha senha':['パスワードを忘れた','Forgot password'],
    'Entrar com telefone e código SMS':['電話番号とSMSでログイン','Sign in with phone and SMS'],
    'Número do celular no Japão':['日本の携帯電話番号','Japanese mobile number'],
    'Enviar código SMS':['SMSコードを送信','Send SMS code'],
    'Código recebido por SMS':['SMSで受信したコード','SMS verification code'],
    'Confirmar código':['コードを確認','Verify code'],
    'Sair ':['ログアウト ','Sign out '],
    'Painel de controle':['管理ダッシュボード','Control panel'],
    'Área administrativa':['管理エリア','Admin area'],
    'GERENCIAMENTO':['管理','MANAGEMENT'],
    'CONTEÚDO':['コンテンツ','CONTENT'],
    'Visão geral':['概要','Overview'],
    'Início':['ホーム','Home'],
    'Fichas':['登録情報','Records'],
    'Relatório semanal':['週間報告','Weekly report'],
    'Novos cadastros':['新規登録','New registrations'],
    'Inscrições':['登録申請','Signups'],
    'Autorizações':['承認','Approvals'],
    'Pedidos':['申請','Requests'],
    'Meu perfil':['マイプロフィール','My profile'],
    'Perfil':['プロフィール','Profile'],
    'Configuração':['設定','Settings'],
    'Ajustes':['設定','Settings'],
    'Matérias FJU':['FJU記事','FJU Articles'],
    'Site oficial':['公式サイト','Official website'],
    'Funções':['メニュー','Menu'],
    '☰ Funções':['☰ メニュー','☰ Menu'],
    'Painel de Controle':['管理ダッシュボード','Control Panel'],
    'Fichas dos jovens':['青年の登録情報','Youth records'],
    'Cadastros e acompanhamento':['登録・フォローアップ','Records and follow-up'],
    'Indicadores semanais':['週間指標','Weekly metrics'],
    'Solicitações de cadastro':['登録リクエスト','Registration requests'],
    'Solicitações e decisões':['申請・審査','Requests and decisions'],
    'Liderança':['リーダーシップ','Leadership'],
    'Perfis da equipe':['チームプロフィール','Team profiles'],
    'Configurações':['設定','Settings'],
    'Ajustes e notificações':['設定・通知','Settings and notifications'],
    'Escrever e acompanhar publicações.':['記事の作成・管理','Write and manage articles.'],
    'Visitar o site FJU JAPAN':['FJU JAPANサイトを見る','Visit FJU JAPAN website'],
    'Fichas dos 23 polos':['23教会の登録情報','Records from 23 churches'],
    'Fichas do meu polo':['所属教会の登録情報','My church records'],
    'Consultar, cadastrar e organizar jovens.':['青年の検索・登録・管理','View, register and organize youth.'],
    'Consultar, cadastrar e solicitar alterações.':['閲覧・登録・変更申請','View, register and request changes.'],
    'Relatórios nacionais':['全国の報告','National reports'],
    'Acompanhar envios e indicadores por polo.':['各教会の報告・指標を確認','Track reports and metrics by church.'],
    'Preencher e acompanhar os relatórios da igreja.':['教会の報告を記入・確認','Complete and track church reports.'],
    'Inscrições do meu polo':['所属教会の登録申請','My church signups'],
    'Acompanhar pedidos de inscrição.':['登録申請を確認','Review registration requests.'],
    'Analisar os jovens que se cadastraram.':['新規登録者を審査','Review new youth registrations.'],
    'Pedidos para aprovação':['承認待ちの申請','Pending approvals'],
    'Minhas solicitações':['自分の申請','My requests'],
    'Decidir alterações, patentes e acessos.':['変更・ランク・アクセスを承認','Approve changes, ranks and access.'],
    'Acompanhar solicitações enviadas ao Nacional.':['全国管理者への申請を確認','Track requests sent to national administration.'],
    'Liderança nacional':['全国リーダーシップ','National leadership'],
    'Meu perfil de liderança':['リーダープロフィール','My leadership profile'],
    'Consultar a equipe de coordenadores.':['コーディネーター一覧を見る','View coordinator team.'],
    'Atualizar nome e foto do meu perfil.':['氏名と写真を更新','Update my name and photo.'],
    'Notificações e ajustes':['通知と設定','Notifications and settings'],
    'Ajustes e dispositivos autorizados.':['設定と認証済み端末','Settings and authorized devices.'],
    'Gerenciar notificações deste aparelho.':['この端末の通知を管理','Manage notifications on this device.'],
    'Autorizações nacionais':['全国の承認','National approvals'],
    'Seu painel administrativo':['管理ダッシュボード','Your admin dashboard'],
    'Acesse rapidamente as ferramentas de gestão da FJU.':['FJUの管理ツールにすぐアクセス','Quick access to FJU management tools.'],
    'Painel Nacional FJU JAPAN':['FJU JAPAN 全国管理','FJU JAPAN National Panel']
  };
  const reverse=new Map();
  for(const [pt,[ja,en]] of Object.entries(words)){
    for(const variant of [pt,ja,en])if(!reverse.has(variant))reverse.set(variant,pt);
  }
  const roots=[
    '.fju-admin-header','#auth','#fju-admin-sidebar','#fju-content-toolbar',
    '#inicio .fju-dashboard-actions','#inicio .fju-actions-title',
    '#fju-overview-title','#fju-overview-description'
  ];
  let language='pt',scheduled=false;
  function translateText(node){
    const input=node.nodeValue;
    const match=/^(\s*)([\s\S]*?)(\s*)$/.exec(input);
    if(!match)return;
    const canonical=reverse.get(match[2]);
    if(!canonical)return;
    const translated=language==='pt'?canonical:words[canonical][language==='ja'?0:1];
    const next=match[1]+translated+match[3];
    if(next!==input)node.nodeValue=next;
  }
  function apply(){
    document.documentElement.lang=language==='ja'?'ja':language==='en'?'en':'pt-BR';
    for(const selector of roots){
      const root=document.querySelector(selector);
      if(!root)continue;
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      let node;
      while((node=walker.nextNode()))translateText(node);
      if(root.nodeType===Node.TEXT_NODE)translateText(root);
    }
    const select=document.getElementById('fju-ui-lang');
    if(select&&select.value!==language)select.value=language;
  }
  function queueApply(){
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(()=>{scheduled=false;apply()});
  }
  function init(){
    try{const stored=localStorage.getItem(STORAGE_KEY);if(LANGUAGES.includes(stored))language=stored}catch(_){}
    const select=document.getElementById('fju-ui-lang');
    if(!select)return;
    select.value=language;
    select.addEventListener('change',()=>{
      if(!LANGUAGES.includes(select.value))return;
      language=select.value;
      try{localStorage.setItem(STORAGE_KEY,language)}catch(_){}
      apply();
    });
    for(const selector of roots){
      const root=document.querySelector(selector);
      if(root)new MutationObserver(queueApply).observe(root,{subtree:true,characterData:true,childList:true});
    }
    apply();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
