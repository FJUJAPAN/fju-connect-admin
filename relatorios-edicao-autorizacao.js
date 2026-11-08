const METRICS = [
  ['jovens_firmes', 'Jovens firmes'],
  ['jovens_novos', 'Jovens novos'],
  ['jovens_afastados', 'Jovens afastados'],
  ['presenca_domingo_930', 'Presença domingo 9h30'],
  ['presenca_encontro_fju', 'Presença no Encontro FJU'],
  ['batizados_espirito_santo', 'Batizados com o Espírito Santo'],
  ['batizados_aguas', 'Batizados nas águas'],
  ['total_jovens_unicos', 'Total único de jovens']
];

const TEXT = {
  pt: {
    mine: 'Meus relatórios enviados', loading: 'Carregando relatórios…', empty: 'Você ainda não enviou relatórios semanais.',
    week: 'Semana encerrada em', version: 'Versão', request: 'Solicitar edição', pending: 'Aguardando autorização do Nacional',
    authorized: 'Edição autorizada', denied: 'Solicitação recusada', done: 'Edição concluída',
    edit: 'Editar relatório autorizado', save: 'Salvar e reenviar relatório', cancel: 'Cancelar',
    reason: 'Explique por que precisa editar este relatório:', sent: 'Solicitação enviada ao Nacional.',
    saved: 'Relatório atualizado e reenviado. O histórico anterior foi preservado.',
    pendingTitle: 'Solicitações de edição pendentes', noPending: 'Não há solicitações de edição pendentes.',
    approve: 'Autorizar edição', deny: 'Recusar', note: 'Observação para o coordenador (opcional):',
    reasonLabel: 'Motivo da solicitação', church: 'Igreja', coordinator: 'Coordenador',
    error: 'Não foi possível concluir: ', reportError: 'Não foi possível carregar os relatórios: ',
    askReason: 'Informe um motivo com pelo menos 5 caracteres.', requestExists: 'Já existe uma solicitação ativa para este relatório.',
    deniedNote: 'Motivo da recusa', status: 'Situação'
  },
  ja: {
    mine: '提出済みレポート', loading: 'レポートを読み込み中…', empty: '週間レポートはまだ提出されていません。',
    week: '対象週（日曜日）', version: 'バージョン', request: '編集を申請', pending: '全国管理者の承認待ち',
    authorized: '編集が許可されました', denied: '申請は却下されました', done: '編集完了',
    edit: '許可されたレポートを編集', save: '保存して再提出', cancel: 'キャンセル',
    reason: '編集が必要な理由を入力してください:', sent: '全国管理者に申請しました。',
    saved: 'レポートを更新して再提出しました。以前の内容も履歴に保存されています。',
    pendingTitle: '編集申請（承認待ち）', noPending: '承認待ちの編集申請はありません。',
    approve: '編集を許可', deny: '却下', note: 'コーディネーターへのメモ（任意）:',
    reasonLabel: '申請理由', church: '教会', coordinator: '申請者',
    error: '処理できませんでした: ', reportError: 'レポートを読み込めません: ',
    askReason: '5文字以上の理由を入力してください。', requestExists: 'このレポートには既に有効な申請があります。',
    deniedNote: '却下理由', status: '状態'
  },
  en: {
    mine: 'My submitted reports', loading: 'Loading reports…', empty: 'You have not submitted weekly reports yet.',
    week: 'Week ending', version: 'Version', request: 'Request editing', pending: 'Awaiting National approval',
    authorized: 'Editing authorized', denied: 'Request declined', done: 'Editing completed',
    edit: 'Edit authorized report', save: 'Save and resubmit report', cancel: 'Cancel',
    reason: 'Explain why this report needs to be edited:', sent: 'Your request was sent to National.',
    saved: 'Report updated and resubmitted. The previous version was preserved.',
    pendingTitle: 'Pending edit requests', noPending: 'There are no pending edit requests.',
    approve: 'Authorize editing', deny: 'Decline', note: 'Note for the coordinator (optional):',
    reasonLabel: 'Request reason', church: 'Church', coordinator: 'Coordinator',
    error: 'Could not complete: ', reportError: 'Could not load reports: ',
    askReason: 'Please enter a reason of at least 5 characters.', requestExists: 'An active request already exists for this report.',
    deniedNote: 'Decline reason', status: 'Status'
  }
};

function language() {
  const value = document.getElementById('fju-admin-language-select')?.value || 'pt';
  return TEXT[value] ? value : 'pt';
}

function make(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = String(content);
  return node;
}

function dateLabel(value) {
  const locale = language() === 'ja' ? 'ja-JP' : language() === 'en' ? 'en-US' : 'pt-BR';
  return new Date(value + 'T12:00:00').toLocaleDateString(locale);
}

function statusBadge(status, t) {
  const labels = { pendente: t.pending, autorizada: t.authorized, recusada: t.denied, concluida: t.done };
  const badge = make('span', 'report-badge', labels[status] || status);
  if (status === 'pendente') badge.style.background = '#fff2d9', badge.style.color = '#825600';
  if (status === 'autorizada') badge.style.background = '#e8f5ed', badge.style.color = '#176b44';
  if (status === 'recusada') badge.style.background = '#fde8e8', badge.style.color = '#9c2929';
  return badge;
}

function reportMetrics(report) {
  const wrap = make('div', 'report-metrics');
  for (const [key, label] of METRICS) {
    const item = make('div', 'report-metric');
    item.append(make('span', '', label), make('b', '', Number(report[key] || 0).toLocaleString('ja-JP')));
    wrap.append(item);
  }
  return wrap;
}

export function setupWeeklyReportEditing(supabase, getProfile) {
  let coordinatorSection;
  let nationalSection;
  let loading = false;

  function getSections() {
    const weekly = document.getElementById('report-weekly');
    const national = document.getElementById('national-report-panel');
    if (!weekly || !national) return false;

    if (!coordinatorSection) {
      coordinatorSection = make('section');
      coordinatorSection.id = 'fju-weekly-reports-own';
      coordinatorSection.style.cssText = 'margin:22px 0 0;padding:16px;border:1px solid #dbe4ef;border-radius:16px;background:#fff;color:#263e5f';
      weekly.append(coordinatorSection);
    }
    if (!nationalSection) {
      nationalSection = make('section');
      nationalSection.id = 'fju-weekly-edit-requests';
      nationalSection.style.cssText = 'margin:0 0 18px;padding:16px;border:1px solid #dbe4ef;border-radius:16px;background:#fff;color:#263e5f';
      national.prepend(nationalSection);
    }
    return true;
  }

  async function loadCoordinator(profile) {
    const t = TEXT[language()];
    coordinatorSection.replaceChildren(make('h3', '', t.mine), make('p', 'muted', t.loading));
    const [{ data: reports, error }, { data: requests, error: requestError }] = await Promise.all([
      supabase.from('fju_relatorios_semanais').select('*').eq('polo_id', profile.polo_id).order('semana_domingo', { ascending: false }).limit(30),
      supabase.from('fju_relatorio_semanal_edicao_solicitacoes').select('*').eq('polo_id', profile.polo_id).order('solicitado_em', { ascending: false }).limit(100)
    ]);
    if (getProfile() !== profile) return;
    if (error || requestError) {
      coordinatorSection.replaceChildren(make('h3', '', t.mine), make('p', 'error', t.reportError + (error?.message || requestError?.message)));
      return;
    }
    coordinatorSection.replaceChildren(make('h3', '', t.mine));
    if (!reports?.length) {
      coordinatorSection.append(make('p', 'muted', t.empty));
      return;
    }
    const requestByReport = new Map();
    for (const request of requests || []) {
      const current = requestByReport.get(request.relatorio_id);
      if (!current || request.solicitado_em > current.solicitado_em) requestByReport.set(request.relatorio_id, request);
    }
    for (const report of reports) {
      const card = make('article', 'report-card');
      const head = make('div', 'report-card-head');
      const title = make('div', 'report-card-title', t.week + ': ' + dateLabel(report.semana_domingo));
      const meta = make('div', 'report-card-subtitle', t.version + ' ' + (report.versao || 1));
      const currentRequest = requestByReport.get(report.id);
      head.append(make('div').appendChild(title));
      head.firstChild.append(meta);
      if (currentRequest) head.append(statusBadge(currentRequest.status, t));
      card.append(head, reportMetrics(report));

      if (currentRequest?.status === 'pendente') {
        card.append(make('p', 'authorization-note', t.pending));
      } else if (currentRequest?.status === 'autorizada') {
        card.append(make('p', 'authorization-note', t.authorized));
        const editButton = make('button', '', t.edit);
        editButton.addEventListener('click', () => showEditForm(card, report, t));
        card.append(editButton);
      } else {
        if (currentRequest?.status === 'recusada' && currentRequest.observacao_nacional) {
          card.append(make('p', 'authorization-note', t.deniedNote + ': ' + currentRequest.observacao_nacional));
        }
        const requestButton = make('button', '', t.request);
        requestButton.addEventListener('click', async () => {
          const reason = window.prompt(t.reason);
          if (reason === null) return;
          if (reason.trim().length < 5) { window.alert(t.askReason); return; }
          requestButton.disabled = true;
          const { data: authData, error: authError } = await supabase.auth.getUser();
          if (authError || !authData?.user?.id) { window.alert(t.error + (authError?.message || 'Sessão expirada.')); requestButton.disabled = false; return; }
          const { error: insertError } = await supabase.from('fju_relatorio_semanal_edicao_solicitacoes').insert({
            relatorio_id: report.id, polo_id: profile.polo_id, solicitado_por: authData.user.id, motivo: reason.trim()
          });
          if (insertError) {
            window.alert(insertError.code === '23505' ? t.requestExists : t.error + insertError.message);
            requestButton.disabled = false;
            return;
          }
          await refresh();
          window.alert(t.sent);
        });
        card.append(requestButton);
      }
      coordinatorSection.append(card);
    }
  }

  function showEditForm(card, report, t) {
    if (card.querySelector('form[data-weekly-edit]')) return;
    const form = make('form');
    form.dataset.weeklyEdit = 'true';
    form.style.cssText = 'margin-top:14px;padding-top:14px;border-top:1px solid #e2e8f0';
    const grid = make('div', 'grid');
    const controls = {};
    for (const [key, label] of METRICS) {
      const wrap = make('div');
      const fieldLabel = make('label', '', label);
      const input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.step = '1'; input.required = true; input.value = String(report[key] ?? 0);
      input.style.width = '100%';
      wrap.append(fieldLabel, input); grid.append(wrap); controls[key] = input;
    }
    const actions = make('div', 'actions');
    const save = make('button', '', t.save); save.type = 'submit';
    const cancel = make('button', 'secondary', t.cancel); cancel.type = 'button'; cancel.addEventListener('click', () => form.remove());
    actions.append(save, cancel);
    const message = make('p', 'message');
    form.append(grid, actions, message);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      save.disabled = true;
      const patch = {};
      for (const [key] of METRICS) patch[key] = Number(controls[key].value);
      const { error } = await supabase.from('fju_relatorios_semanais').update(patch).eq('id', report.id);
      if (error) {
        message.textContent = t.error + error.message;
        message.className = 'message error';
        save.disabled = false;
        return;
      }
      await refresh();
      window.alert(t.saved);
    });
    card.append(form);
  }

  async function loadNational(profile) {
    const t = TEXT[language()];
    nationalSection.replaceChildren(make('h3', '', t.pendingTitle), make('p', 'muted', t.loading));
    const { data: requests, error } = await supabase.from('fju_relatorio_semanal_edicao_solicitacoes')
      .select('*').eq('status', 'pendente').order('solicitado_em', { ascending: false }).limit(100);
    if (getProfile() !== profile) return;
    if (error) {
      nationalSection.replaceChildren(make('h3', '', t.pendingTitle), make('p', 'error', t.error + error.message));
      return;
    }
    nationalSection.replaceChildren(make('h3', '', t.pendingTitle));
    if (!requests?.length) {
      nationalSection.append(make('p', 'muted', t.noPending));
      return;
    }
    const reportIds = [...new Set(requests.map(r => r.relatorio_id))];
    const poloIds = [...new Set(requests.map(r => r.polo_id))];
    const [{ data: reports, error: reportError }, { data: polos, error: poloError }, { data: coordinators }] = await Promise.all([
      supabase.from('fju_relatorios_semanais').select('*').in('id', reportIds),
      supabase.from('fju_polos').select('id,nome').in('id', poloIds),
      supabase.from('fju_cadastros_coordenadores').select('usuario_id,nome').in('usuario_id', [...new Set(requests.map(r => r.solicitado_por))])
    ]);
    if (getProfile() !== profile) return;
    if (reportError || poloError) {
      nationalSection.append(make('p', 'error', t.error + (reportError?.message || poloError?.message)));
      return;
    }
    const reportMap = new Map((reports || []).map(r => [r.id, r]));
    const poloMap = new Map((polos || []).map(p => [p.id, p.nome]));
    const coordinatorMap = new Map((coordinators || []).map(item => [item.usuario_id, item.nome]));
    for (const request of requests) {
      const report = reportMap.get(request.relatorio_id);
      const card = make('article', 'report-card');
      const title = make('div', 'report-card-title', (poloMap.get(request.polo_id) || '—') + ' · ' + dateLabel(report?.semana_domingo || request.solicitado_em.slice(0, 10)));
      const reason = make('p', 'authorization-note', t.reasonLabel + ': ' + request.motivo);
      const meta = make('p', 'report-card-subtitle', t.coordinator + ': ' + (coordinatorMap.get(request.solicitado_por) || request.solicitado_por));
      card.append(title, meta, reason);
      if (report) card.append(reportMetrics(report));
      const actions = make('div', 'authorization-actions');
      const approve = make('button', '', t.approve);
      approve.addEventListener('click', () => decide(request, 'autorizada', t));
      const deny = make('button', 'secondary', t.deny);
      deny.addEventListener('click', () => decide(request, 'recusada', t));
      actions.append(approve, deny); card.append(actions);
      nationalSection.append(card);
    }
  }

  async function decide(request, status, t) {
    const note = window.prompt(t.note) || '';
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user?.id) { window.alert(t.error + (authError?.message || 'Session expired.')); return; }
    const { error } = await supabase.from('fju_relatorio_semanal_edicao_solicitacoes').update({
      status, decidido_por: authData.user.id, decidido_em: new Date().toISOString(), observacao_nacional: note.trim() || null
    }).eq('id', request.id).eq('status', 'pendente');
    if (error) { window.alert(t.error + error.message); return; }
    await refresh();
  }

  async function refresh() {
    if (loading || !getSections()) return;
    const profile = getProfile();
    if (!profile?.ativo) return;
    loading = true;
    try {
      if (profile.papel === 'coordenador') await loadCoordinator(profile);
      if (profile.papel === 'nacional') await loadNational(profile);
    } finally { loading = false; }
  }

  const openReports = () => window.setTimeout(() => { void refresh(); }, 80);
  document.querySelector('[data-tab="relatorios"]')?.addEventListener('click', openReports);
  document.querySelectorAll('[data-report-tab]').forEach(button => button.addEventListener('click', openReports));
  document.getElementById('national-report-refresh')?.addEventListener('click', openReports);
  document.getElementById('fju-admin-language-select')?.addEventListener('change', openReports);
  window.addEventListener('focus', openReports);
  return { refresh };
}
