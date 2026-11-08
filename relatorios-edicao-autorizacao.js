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
    week: 'Semana encerrada em', version: 'Versão', edit: 'Editar e enviar correção',
    pending: 'Correção aguardando análise do Nacional', approved: 'Correção aprovada pelo Nacional',
    denied: 'Correção recusada', reason: 'Explique o que precisa ser corrigido:',
    send: 'Enviar correção para análise', cancel: 'Cancelar', sent: 'Correção enviada. O relatório original continua valendo até a decisão do Nacional.',
    pendingTitle: 'Correções aguardando sua autorização', noPending: 'Não há correções aguardando análise.',
    original: 'Relatório atualmente válido', proposed: 'Versão corrigida enviada pelo coordenador',
    approve: 'Aprovar correção', deny: 'Recusar correção', note: 'Observação para o coordenador (opcional):',
    coordinator: 'Coordenador (ID)', polo: 'Polo', error: 'Não foi possível concluir: ',
    reportError: 'Não foi possível carregar os relatórios: ', askReason: 'Explique a correção com pelo menos 5 caracteres.',
    deniedNote: 'Observação do Nacional', status: 'Situação', submitting: 'Enviando…',
    approvedMessage: 'Correção aprovada. O relatório oficial foi atualizado e a versão anterior foi guardada no histórico.',
    deniedMessage: 'Correção recusada. O relatório original continua válido.',
    askDeny: 'Informe o motivo da recusa:'
  },
  ja: {
    mine: '提出済みレポート', loading: 'レポートを読み込み中…', empty: '週間レポートはまだ提出されていません。',
    week: '対象週（日曜日）', version: 'バージョン', edit: '修正して再提出',
    pending: '全国管理者の確認待ち', approved: '修正が承認されました', denied: '修正は却下されました',
    reason: '修正内容を説明してください:', send: '修正を送信', cancel: 'キャンセル',
    sent: '修正を送信しました。全国管理者の判断までは元のレポートが有効です。',
    pendingTitle: '確認待ちのレポート修正', noPending: '確認待ちの修正はありません。',
    original: '現在有効なレポート', proposed: 'コーディネーターが送信した修正版',
    approve: '修正を承認', deny: '修正を却下', note: 'コーディネーターへのメモ（任意）:',
    coordinator: 'コーディネーターID', polo: '教会', error: '処理できませんでした: ',
    reportError: 'レポートを読み込めません: ', askReason: '5文字以上で修正内容を入力してください。',
    deniedNote: '全国管理者からのコメント', status: '状態', submitting: '送信中…',
    approvedMessage: '修正を承認しました。正式なレポートを更新し、以前のバージョンを履歴に保存しました。',
    deniedMessage: '修正を却下しました。元のレポートが引き続き有効です。',
    askDeny: '却下理由を入力してください:'
  },
  en: {
    mine: 'My submitted reports', loading: 'Loading reports…', empty: 'You have not submitted weekly reports yet.',
    week: 'Week ending', version: 'Version', edit: 'Edit and submit correction',
    pending: 'Correction awaiting National review', approved: 'Correction approved by National',
    denied: 'Correction declined', reason: 'Explain what needs to be corrected:',
    send: 'Send correction for review', cancel: 'Cancel',
    sent: 'Correction submitted. The original report remains official until National decides.',
    pendingTitle: 'Corrections awaiting your review', noPending: 'There are no corrections awaiting review.',
    original: 'Currently official report', proposed: 'Corrected version submitted by coordinator',
    approve: 'Approve correction', deny: 'Decline correction', note: 'Note for the coordinator (optional):',
    coordinator: 'Coordinator (ID)', polo: 'Church', error: 'Could not complete: ',
    reportError: 'Could not load reports: ', askReason: 'Please explain the correction in at least 5 characters.',
    deniedNote: 'National note', status: 'Status', submitting: 'Submitting…',
    approvedMessage: 'Correction approved. The official report was updated and the previous version was saved in history.',
    deniedMessage: 'Correction declined. The original report remains official.',
    askDeny: 'Enter the reason for declining:'
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
function reportMetrics(report, heading) {
  const wrap = make('div', 'report-metrics');
  if (heading) {
    const title = make('strong', 'report-comparison-title', heading);
    title.style.gridColumn = '1/-1';
    wrap.append(title);
  }
  for (const [key, label] of METRICS) {
    const item = make('div', 'report-metric');
    item.append(make('span', '', label), make('b', '', Number(report?.[key] || 0).toLocaleString('ja-JP')));
    wrap.append(item);
  }
  return wrap;
}
function statusBadge(label, status) {
  const badge = make('span', 'report-badge', label);
  if (status === 'pendente') badge.style.cssText += ';background:#fff2d9;color:#825600';
  if (status === 'recusada') badge.style.cssText += ';background:#fde8e8;color:#9c2929';
  return badge;
}

export function setupWeeklyReportEditing(supabase, getProfile) {
  let coordinatorSection, nationalSection, loading = false;

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
      supabase.from('fju_relatorios_semanais').select('*').eq('polo_id', profile.polo_id).order('semana_domingo', { ascending: false }).limit(40),
      supabase.from('fju_relatorio_semanal_edicao_solicitacoes').select('*').eq('polo_id', profile.polo_id).order('solicitado_em', { ascending: false }).limit(100)
    ]);
    if (getProfile() !== profile) return;
    if (error || requestError) {
      coordinatorSection.replaceChildren(make('h3', '', t.mine), make('p', 'error', t.reportError + (error?.message || requestError?.message)));
      return;
    }
    coordinatorSection.replaceChildren(make('h3', '', t.mine));
    if (!reports?.length) { coordinatorSection.append(make('p', 'muted', t.empty)); return; }

    const requestByReport = new Map();
    for (const request of requests || []) {
      const current = requestByReport.get(request.relatorio_id);
      if (!current || request.solicitado_em > current.solicitado_em) requestByReport.set(request.relatorio_id, request);
    }
    for (const report of reports) {
      const card = make('article', 'report-card');
      const head = make('div', 'report-card-head');
      const titleWrap = make('div');
      titleWrap.append(make('div', 'report-card-title', t.week + ': ' + dateLabel(report.semana_domingo)));
      titleWrap.append(make('div', 'report-card-subtitle', t.version + ' ' + (report.versao || 1)));
      head.append(titleWrap);
      const req = requestByReport.get(report.id);
      if (req) {
        const label = req.status === 'pendente' ? t.pending : req.status === 'recusada' ? t.denied : req.status === 'concluida' ? t.approved : req.status;
        head.append(statusBadge(label, req.status));
      }
      card.append(head, reportMetrics(report));
      if (req?.status === 'pendente') {
        card.append(make('p', 'authorization-note', t.pending));
        if (req.dados_propostos) card.append(reportMetrics(req.dados_propostos, t.proposed));
      } else {
        if (req?.status === 'recusada' && req.observacao_nacional) {
          card.append(make('p', 'authorization-note', t.deniedNote + ': ' + req.observacao_nacional));
        }
        const editButton = make('button', '', t.edit);
        editButton.addEventListener('click', () => showCorrectionForm(card, report, profile, t));
        card.append(editButton);
      }
      coordinatorSection.append(card);
    }
  }

  function showCorrectionForm(card, report, profile, t) {
    if (card.querySelector('form[data-weekly-correction]')) return;
    const form = make('form');
    form.dataset.weeklyCorrection = 'true';
    form.style.cssText = 'margin-top:14px;padding-top:14px;border-top:1px solid #e2e8f0';
    const grid = make('div', 'grid'), controls = {};
    for (const [key, label] of METRICS) {
      const wrap = make('div'), fieldLabel = make('label', '', label);
      const input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.step = '1'; input.required = true;
      input.value = String(report[key] ?? 0); input.style.width = '100%';
      wrap.append(fieldLabel, input); grid.append(wrap); controls[key] = input;
    }
    const reasonLabel = make('label', '', t.reason);
    const reason = document.createElement('textarea');
    reason.required = true; reason.minLength = 5; reason.maxLength = 1000; reason.rows = 3;
    const actions = make('div', 'actions');
    const send = make('button', '', t.send); send.type = 'submit';
    const cancel = make('button', 'secondary', t.cancel); cancel.type = 'button'; cancel.addEventListener('click', () => form.remove());
    const feedback = make('p', 'message');
    actions.append(send, cancel); form.append(grid, reasonLabel, reason, actions, feedback);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (reason.value.trim().length < 5) { feedback.textContent = t.askReason; return; }
      send.disabled = true; send.textContent = t.submitting;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.id) {
        feedback.textContent = t.error + (authError?.message || 'Sessão expirada.');
        send.disabled = false; send.textContent = t.send; return;
      }
      const proposed = {};
      for (const [key] of METRICS) {
        const value = Number(controls[key].value);
        if (!Number.isSafeInteger(value) || value < 0) {
          feedback.textContent = t.error + 'Use somente números inteiros não negativos.';
          send.disabled = false; send.textContent = t.send; return;
        }
        proposed[key] = value;
      }
      const { error: insertError } = await supabase.from('fju_relatorio_semanal_edicao_solicitacoes').insert({
        relatorio_id: report.id, polo_id: profile.polo_id,
        solicitado_por: authData.user.id, motivo: reason.value.trim(), dados_propostos: proposed
      });
      if (insertError) {
        feedback.textContent = t.error + insertError.message;
        send.disabled = false; send.textContent = t.send; return;
      }
      await refresh();
      window.alert(t.sent);
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
    if (!requests?.length) { nationalSection.append(make('p', 'muted', t.noPending)); return; }

    const reportIds = [...new Set(requests.map(r => r.relatorio_id))];
    const poloIds = [...new Set(requests.map(r => r.polo_id))];
    const [{ data: reports, error: reportError }, { data: polos, error: poloError }] = await Promise.all([
      supabase.from('fju_relatorios_semanais').select('*').in('id', reportIds),
      supabase.from('fju_polos').select('id,nome').in('id', poloIds)
    ]);
    if (getProfile() !== profile) return;
    if (reportError || poloError) {
      nationalSection.append(make('p', 'error', t.error + (reportError?.message || poloError?.message)));
      return;
    }
    const reportMap = new Map((reports || []).map(r => [r.id, r]));
    const poloMap = new Map((polos || []).map(p => [p.id, p.nome]));
    for (const request of requests) {
      const report = reportMap.get(request.relatorio_id);
      const card = make('article', 'report-card');
      card.append(
        make('div', 'report-card-title', (poloMap.get(request.polo_id) || t.polo) + ' · ' + dateLabel(report?.semana_domingo || request.solicitado_em.slice(0, 10))),
        make('p', 'report-card-subtitle', t.coordinator + ': ' + request.solicitado_por),
        make('p', 'authorization-note', request.motivo)
      );
      if (report) card.append(reportMetrics(report, t.original));
      if (request.dados_propostos) card.append(reportMetrics(request.dados_propostos, t.proposed));
      const actions = make('div', 'authorization-actions');
      const approve = make('button', '', t.approve);
      approve.addEventListener('click', () => decide(request, true, t));
      const deny = make('button', 'secondary', t.deny);
      deny.addEventListener('click', () => decide(request, false, t));
      actions.append(approve, deny); card.append(actions);
      nationalSection.append(card);
    }
  }

  async function decide(request, approve, t) {
    const promptText = approve ? t.note : t.askDeny;
    const note = window.prompt(promptText);
    if (note === null) return;
    if (!approve && !note.trim()) { window.alert(t.askDeny); return; }
    const { error } = await supabase.rpc('fju_decidir_correcao_relatorio_semanal', {
      p_solicitacao_id: request.id, p_aprovar: approve, p_observacao: note.trim() || null
    });
    if (error) { window.alert(t.error + error.message); return; }
    await refresh();
    window.alert(approve ? t.approvedMessage : t.deniedMessage);
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
  const openReports = () => window.setTimeout(() => { void refresh(); }, 100);
  document.querySelector('[data-tab="relatorios"]')?.addEventListener('click', openReports);
  document.querySelectorAll('[data-report-tab]').forEach(button => button.addEventListener('click', openReports));
  document.getElementById('national-report-refresh')?.addEventListener('click', openReports);
  document.getElementById('fju-admin-language-select')?.addEventListener('change', openReports);
  window.addEventListener('focus', openReports);
  return { refresh };
}
