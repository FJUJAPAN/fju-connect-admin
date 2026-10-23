/* FJU JAPAN — ícones vetoriais sem bibliotecas externas */
(()=>{const paths={
 jovens:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>',
 relatorios:'<path d="M4 20V11h4v9M10 20V4h4v16M16 20v-7h4v7M2 20h20"/>',
 inscricoes:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7M12 2v3"/>',
 autorizacoes:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 lideranca:'<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0M18 4l2 1-1 2"/>',
 config:'<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/>',
 materias:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h3M14 15h2"/>'
};
document.querySelectorAll('#inicio .fju-dashboard-actions>.fju-action-card').forEach(card=>{const key=card.getAttribute('data-open-tab')||(card.classList.contains('fju-action-link')?'materias':'');const icon=card.querySelector('.fju-action-icon');if(!icon||!paths[key])return;icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+paths[key]+'</svg>';});
})();
