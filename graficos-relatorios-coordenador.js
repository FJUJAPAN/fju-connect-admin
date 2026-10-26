/* FJU JAPAN — gráfico comparativo do relatório semanal do Coordenador Local.
   Renderização SVG acessível, sem dependências de CDN e sem consultas extras. */
(()=>{
'use strict';
const NS='http://www.w3.org/2000/svg';
const fieldKeys=[
 'total_jovens_unicos','jovens_firmes','jovens_novos','jovens_afastados',
 'presenca_domingo_930','presenca_encontro_fju','batizados_espirito_santo','batizados_aguas'
];
const dictionary={
 pt:{
  title:'Evolução da minha igreja',detail:'Compare os relatórios que sua igreja enviou.',metric:'O que comparar',
  interval:'Período',last:'Último envio',previous:'Envio anterior',change:'Variação',higher:'a mais',lower:'a menos',
  same:'sem alteração',needTwo:'Envie pelo menos dois relatórios para comparar a evolução.',
  noValue:'Sem valores disponíveis para este indicador.',note:'O gráfico mostra semanas com relatório enviado. Semanas sem envio não são estimadas.',
  one:'semana',many:'semanas',weeks:'Últimos envios',unit:'jovens',metricNames:[
   'Total de jovens (sem repetir)','Jovens firmes','Jovens novos','Jovens afastados',
   'Presença no domingo','Presença no Encontro FJU','Batizados com o Espírito Santo','Batizados nas águas']
 },
 ja:{
  title:'教会の成長グラフ',detail:'提出済みの週間報告を比較できます。',metric:'比較する項目',
  interval:'期間',last:'最新の報告',previous:'前回の報告',change:'増減',higher:'増加',lower:'減少',
  same:'変化なし',needTwo:'推移を見るには2回以上の報告が必要です。',
  noValue:'この項目の数値はまだありません。',note:'提出した週だけを表示します。未提出の週の値は推定しません。',
  one:'週',many:'週',weeks:'最近の報告',unit:'人',metricNames:[
   '青年実人数','堅固な青年','新しい青年','離れた青年',
   '日曜日の出席','FJUミーティングの出席','聖霊のバプテスマ','水のバプテスマ']
 },
 en:{
  title:'My church progress',detail:'Compare your church’s submitted weekly reports.',metric:'Compare metric',
  interval:'Period',last:'Latest report',previous:'Previous report',change:'Difference',higher:'more',lower:'fewer',
  same:'no change',needTwo:'Submit at least two reports to compare progress.',
  noValue:'No numbers yet for this metric.',note:'Only submitted weeks are shown. Missing weeks are not estimated.',
  one:'week',many:'weeks',weeks:'Recent reports',unit:'youth',metricNames:[
   'Unique youth total','Steady youth','New youth','Inactive youth',
   'Sunday attendance','FJU meeting attendance','Holy Spirit baptisms','Water baptisms']
 }
};
const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el};
const svgEl=(tag,attrs)=>{const el=document.createElementNS(NS,tag);for(const [key,val] of Object.entries(attrs||{}))el.setAttribute(key,String(val));return el};
const dateLabel=iso=>iso.slice(8,10)+'/'+iso.slice(5,7);
const validNumber=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const weekTime=s=>Date.parse(s+'T12:00:00Z');
function renderGraph(container,reports,language){
 const t=dictionary[language]||dictionary.pt;
 const model=(Array.isArray(reports)?reports:[]).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.semana_domingo||''))
  .sort((a,b)=>a.semana_domingo.localeCompare(b.semana_domingo));
 const shell=node('section','fju-coord-chart');
 const heading=node('div','fju-coord-chart-heading');
 heading.append(node('h4','',t.title),node('p','',t.detail));shell.append(heading);
 const controls=node('div','fju-coord-chart-controls');
 const metricGroup=node('label','fju-coord-chart-control');
 metricGroup.append(node('span','',t.metric));
 const select=node('select');select.setAttribute('aria-label',t.metric);
 fieldKeys.forEach((key,i)=>{const option=node('option','',t.metricNames[i]);option.value=key;select.append(option)});
 metricGroup.append(select);
 const periodGroup=node('label','fju-coord-chart-control');periodGroup.append(node('span','',t.interval));
 const period=node('select');period.setAttribute('aria-label',t.interval);
 for(const n of [4,8,12,20]){const option=node('option','',n+' '+(n===1?t.one:t.many));option.value=String(n);period.append(option)}
 period.value='8';periodGroup.append(period);controls.append(metricGroup,periodGroup);shell.append(controls);
 const statistics=node('div','fju-coord-chart-summary');shell.append(statistics);
 const viewport=node('div','fju-coord-chart-viewport');shell.append(viewport);
 const note=node('p','fju-coord-chart-note',t.note);shell.append(note);
 container.append(shell);
 function update(){
  const metric=select.value, subset=model.slice(-Number(period.value)),points=subset.map(r=>({...r,value:validNumber(r[metric])})).filter(r=>r.value!==null);
  const previous=points.length>=2?points[points.length-2]:null;
  const latest=points.length?points[points.length-1]:null;
  const difference=previous&&latest?latest.value-previous.value:null;
  statistics.replaceChildren();viewport.replaceChildren();
  const stat=(label,value,kind)=>{const box=node('div','fju-coord-chart-stat'+(kind?' fju-coord-chart-stat-'+kind:''));box.append(node('span','',label),node('strong','',value));statistics.append(box)};
  stat(t.last,latest?latest.value.toLocaleString(language==='ja'?'ja-JP':language==='en'?'en-US':'pt-BR'):'—');
  stat(t.previous,previous?previous.value.toLocaleString(language==='ja'?'ja-JP':language==='en'?'en-US':'pt-BR'):'—');
  const changeStr=difference===null?'—':difference===0?t.same:(difference>0?'+':'')+difference+' '+(difference>0?t.higher:t.lower);
  stat(t.change,changeStr,difference===null?'':difference<0?'down':difference>0?'up':'');
  if(points.length<2){viewport.append(node('p','fju-coord-chart-empty',latest?t.needTwo:t.noValue));return}
  const width=740,height=276,left=48,right=21,top=21,bottom=48,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const maxValue=Math.max(1,...points.map(p=>p.value));
  const ceilTick=Math.max(1,Math.ceil(maxValue/4));
  const maxY=ceilTick*4;
  const xMin=weekTime(subset[0].semana_domingo),xMax=weekTime(subset[subset.length-1].semana_domingo);
  const x=iso=>xMax===xMin?left+plotWidth/2:left+plotWidth*((weekTime(iso)-xMin)/(xMax-xMin));
  const y=value=>top+plotHeight*(1-value/maxY);
  const svg=svgEl('svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':t.title+' — '+t.metricNames[fieldKeys.indexOf(metric)]+' — '+points.map(p=>dateLabel(p.semana_domingo)+': '+p.value).join(', ')});
  svg.classList.add('fju-coord-chart-svg');
  for(let i=0;i<=4;i++){
   const val=ceilTick*i,py=y(val);
   svg.append(svgEl('line',{x1:left,y1:py,x2:width-right,y2:py,class:'fju-coord-chart-grid-line'}));
   const label=svgEl('text',{x:left-10,y:py+4,class:'fju-coord-chart-axis','text-anchor':'end'});label.textContent=String(val);svg.append(label);
  }
  const n=subset.length;const minGap=55;const step=Math.max(1,Math.ceil(n/Math.max(2,Math.floor(plotWidth/minGap))));
  subset.forEach((row,i)=>{
   if(i%step!==0&&i!==n-1)return;
   const tick=svgEl('text',{x:x(row.semana_domingo),y:height-17,class:'fju-coord-chart-axis','text-anchor':'middle'});
   tick.textContent=dateLabel(row.semana_domingo);svg.append(tick);
  });
  let section=[];
  const drawSection=()=>{
   if(section.length<2){section=[];return}
   const path=section.map((p,i)=>(i?'L':'M')+x(p.semana_domingo).toFixed(2)+' '+y(p.value).toFixed(2)).join(' ');
   svg.append(svgEl('path',{d:path,class:'fju-coord-chart-line'}));section=[];
  };
  for(const row of subset){
   const value=validNumber(row[metric]);
   if(value===null){drawSection();continue}
   const prev=section[section.length-1];
   if(prev&&weekTime(row.semana_domingo)-weekTime(prev.semana_domingo)>8*86400000)drawSection();
   section.push({semana_domingo:row.semana_domingo,value});
  }
  drawSection();
  for(const p of points){
   const dot=svgEl('circle',{cx:x(p.semana_domingo),cy:y(p.value),r:p===latest?5.5:4.5,class:'fju-coord-chart-dot'});
   const hint=svgEl('title');hint.textContent=dateLabel(p.semana_domingo)+' — '+t.metricNames[fieldKeys.indexOf(metric)]+': '+p.value;
   dot.append(hint);svg.append(dot);
  }
  viewport.append(svg);
 }
 select.addEventListener('change',update);
 period.addEventListener('change',update);
 update();
}
window.fjuAdminRenderReportChart=renderGraph;
})();