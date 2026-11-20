/* NIVEL — app estática para GitHub Pages. Persistencia: localStorage + copias JSON.
   GitHub Pages NO puede modificar data.json ni sincronizar dispositivos. */
const STORAGE_KEY = 'nivel_fitness_data_v1';
const APP_VERSION = 4;
const FIELDS = [
  ['weightKg','Peso','kg',25,300], ['waistCm','Cintura','cm',30,200],
  ['abdomenCm','Abdomen (ombligo)','cm',30,200], ['hipCm','Cadera','cm',40,200],
  ['chestCm','Pecho','cm',40,200], ['neckCm','Cuello','cm',20,70],
  ['armLeftCm','Brazo izquierdo','cm',10,70], ['armRightCm','Brazo derecho','cm',10,70],
  ['thighLeftCm','Muslo izquierdo','cm',20,120], ['thighRightCm','Muslo derecho','cm',20,120],
  ['fatPct','Grasa corporal','%',2,70],
];
const DAYS = ['','Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
let db;
const VALID_VIEWS = ['home','training','progress','library','profile','measurements','sessions','loads'];
const viewFromHash = () => {const candidate=location.hash.replace(/^#\/?/, '');return VALID_VIEWS.includes(candidate)?candidate:'home';};
let view = viewFromHash();
let chartMetric = 'waistCm';
// Vistas de detalle separadas: nunca se expanden listados dentro del panel principal.
const PARENT_VIEW = {measurements:'progress',sessions:'training',loads:'training'};
let bodyViewSide = 'FRONT';
let bodyChart = null;
let anatomySelectedId = null;
let showingModal = false;
const FOCUSES = [
  ['equilibrado','Físico equilibrado'], ['definicion','Definición / recomposición'],
  ['musculo','Hipertrofia / ganar músculo'], ['fuerza','Fuerza máxima'],
  ['resistencia','Resistencia muscular'], ['core','Abdomen y core'],
  ['gluteos','Glúteos'], ['piernas','Piernas completas'], ['espalda','Espalda y postura'],
  ['pecho','Pecho'], ['hombros','Hombros'], ['brazos','Brazos'],
  ['cardio','Condición cardiovascular'], ['funcional','Fuerza funcional y movilidad']
];
const VALID_FOCUSES = FOCUSES.map(x=>x[0]);
const EXERCISE_GROUPS = ['Pecho','Espalda','Hombros','Bíceps','Tríceps','Cuádriceps','Isquiotibiales','Glúteos','Abdomen','Cardio'];
const E = (value='') => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const uid = () => (globalThis.crypto?.randomUUID?.() || `n-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const fmtNum = (x, decimals=1) => x == null || x === '' ? '—' : new Intl.NumberFormat('es-ES',{maximumFractionDigits:decimals}).format(Number(x));
const madridToday = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const madridWeekday = (date) => { const d=new Date(`${date}T12:00:00Z`).getUTCDay(); return d===0?7:d; };
let selectedDay = madridWeekday(madridToday());
const niceDate = (date) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(date||'')) return '—'; const [y,m,d]=date.split('-'); return `${d}/${m}/${y}`; };
const num = (raw) => { const s=String(raw??'').trim().replace(',','.'); return s===''?null:(Number.isFinite(Number(s))?Number(s):NaN); };
const validDate = (d) => {if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return false;const [y,m,day]=d.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,day));return dt.toISOString().slice(0,10)===d;};
const lastByDate = (a,b) => b.date.localeCompare(a.date) || (b.createdAt||'').localeCompare(a.createdAt||'');
const activeRoutine = () => db.routines.find(r=>r.id===db.activeRoutineId)||db.routines[0];
const exercise = (id) => db.exercises.find(e=>e.id===id)||{id,name:'Ejercicio eliminado',unit:'reps',loadUnit:'Sin carga',muscle:'Otro',equipment:'Otro',instructions:''};
const suggestedLoad = (rx) => rx.suggestedKg == null ? 'Por determinar' : `${fmtNum(rx.suggestedKg)} kg`;
const newestMetric = (key) => [...db.measurements].sort(lastByDate).find(m=>Number.isFinite(m[key]));
const toast = (msg, error=false) => {document.querySelector('.toast')?.remove(); const el=document.createElement('div');el.className=`toast${error?' error':''}`;el.textContent=msg;document.body.append(el);setTimeout(()=>el.remove(),3500);};
function persist() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(db)); return true; }
  catch(err) { toast('No se pudo guardar en este navegador. Exporta una copia JSON.',true); console.error(err); return false; }
}
function ensureData(obj) {
  if (!obj || typeof obj !== 'object' || ![1,2,3,4].includes(obj.schemaVersion) ||
      !Array.isArray(obj.measurements) || !Array.isArray(obj.exercises) ||
      !Array.isArray(obj.routines) || !Array.isArray(obj.sessions) ||
      !obj.profile || typeof obj.profile !== 'object') throw new Error('Este JSON no es una copia válida de NIVEL.');
  if(obj.measurements.length>50000 || obj.exercises.length>5000 || obj.sessions.length>50000 || obj.routines.length>500)
    throw new Error('La copia es demasiado grande.');
  if(!obj.routines.length || !obj.routines.every(r=>r.days && typeof r.days==='object'))
    throw new Error('Faltan las rutinas en el archivo.');
  const d=JSON.parse(JSON.stringify(obj));
  d.schemaVersion=APP_VERSION;
  if(!Array.isArray(d.goals)) {
    d.goals=d.profile.goalName ? [{id:uid(),name:d.profile.goalName,description:d.profile.goal||'',targetDate:d.profile.goalDate||'',metric:'none',targetValue:null,createdAt:new Date().toISOString(),done:false}] : [];
  }
  if(!d.planner || !Array.isArray(d.planner.availableDays)) d.planner={availableDays:[1,2,3,5,6],sessionsPerWeek:5,focus:'equilibrado',minutesPerSession:65,level:'intermedio'};
  d.goals=d.goals.filter(x=>x&&typeof x==='object'&&typeof x.name==='string').slice(0,100);
  d.routines.forEach(r=>Object.entries(r.days).forEach(([dayNo,day])=>{
    if(!Array.isArray(day.exercises))day.exercises=[];
    if(typeof day.rest!=='boolean')day.rest=day.exercises.length===0;
  }));
  if(d.activeSession && !Array.isArray(d.activeSession.exercises))d.activeSession=null;
  return d;
}
function mergeCatalog(current,defaults){
  const known=new Map(current.exercises.map(e=>[e.id,e]));
  for(const ex of defaults.exercises){
    if(!known.has(ex.id)){current.exercises.push(ex);continue;}
    // Update only built-in labels and capabilities. Never alter custom exercises or session history.
    const own=known.get(ex.id);
    if(!own.custom){own.name=ex.name;own.muscle=ex.muscle;own.equipment=ex.equipment;own.unit=ex.unit;own.loadUnit=ex.loadUnit;own.supportsDistance=!!ex.supportsDistance;own.instructions=ex.instructions;own.level=ex.level||own.level||'General';}
  }
  return current;
}
async function init(){
  try{
    let current=null;
    const saved=localStorage.getItem(STORAGE_KEY);
    if(saved){try{current=ensureData(JSON.parse(saved));}catch(err){console.error('No se pudo leer la copia local',err);throw Error('La memoria anterior no se reconoce. Para protegerla no se ha sobrescrito: exporta una copia desde las herramientas del navegador antes de continuar.');}}
    let defaults=null;
    try{const response=await fetch('./data.json',{cache:'no-store'});if(response.ok)defaults=ensureData(await response.json());}
    catch(err){console.warn('Catálogo no disponible; se usarán datos guardados',err);}
    if(!current&&!defaults)throw Error('No se pudo abrir data.json. Sube todos los archivos a GitHub Pages.');
    db=current ? (defaults?mergeCatalog(current,defaults):current) : defaults;
    persist();render();
  }catch(err){document.getElementById('app').innerHTML=`<div class="empty" style="min-height:80vh"><strong>No se pudo abrir NIVEL</strong><p>${E(err.message)}</p></div>`;}
  if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(console.warn);
}
function renderKeepScroll(){const top=window.scrollY;render();requestAnimationFrame(()=>window.scrollTo(0,top));}
function navigateTo(name){if(!VALID_VIEWS.includes(name))return;view=name;closeModal();if(location.hash!==`#/${name}`)location.hash=`/${name}`;render();window.scrollTo(0,0);}

function navItem(name,label,icon) {return `<button class="nav-btn ${(PARENT_VIEW[view]||view)===name?'active':''}" data-nav="${name}" aria-label="${label}"><span class="nav-icon">${icon}</span>${label}</button>`;}
function bottomItem(name,label,icon) {return `<button class="bottom-btn ${(PARENT_VIEW[view]||view)===name?'active':''}" data-nav="${name}" aria-label="${label}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`;}
function render(){
  const titles={home:'Home',training:'Entrenar',progress:'Progreso',library:'Ejercicios',profile:'Perfil',measurements:'Todas las mediciones',sessions:'Historial de sesiones',loads:'Cargas utilizadas'};
  document.title=`${titles[view]} · NIVEL`;
  document.getElementById('app').innerHTML=`<div class="app-shell">
    <aside class="sidebar"><div class="side-brand">NIVEL<b>.</b></div><nav class="nav-list">${navItem('home','Home','⌂')}${navItem('training','Entrenar','◈')}${navItem('progress','Progreso','↗')}${navItem('library','Ejercicios','▤')}${navItem('profile','Perfil','◉')}</nav><div class="side-foot"><small>ENTRENA. REGISTRA. EVOLUCIONA.</small><div class="fineprint">Datos guardados en este navegador. Haz copias JSON desde Perfil.</div></div></aside>
    <main class="workspace"><div class="mobile-header"><div class="brand">NIVEL<b>.</b></div><span class="pill green">Tu progreso</span></div><div class="topbar"><span class="today">${niceDate(madridToday())} · Fitness Park</span><span class="pill green">PLAN PERSONAL</span></div>
     ${view==='home'?homeHTML():view==='training'?trainingHTML():view==='progress'?progressHTML():view==='library'?libraryHTML():view==='measurements'?measurementsPageHTML():view==='sessions'?sessionsPageHTML():view==='loads'?loadsPageHTML():profileHTML()}
    </main><nav class="bottomnav">${bottomItem('home','Home','⌂')}${bottomItem('training','Entrenar','◈')}${bottomItem('progress','Progreso','↗')}${bottomItem('library','Ejercicios','▤')}${bottomItem('profile','Perfil','◉')}</nav></div>`;
  if(view==='progress')requestAnimationFrame(mountBodyMap);
  else destroyBodyMap();
}
function header(title,sub='',action=''){return `<div class="page-title row-between wrap"><div><div class="eyebrow">TU SEGUIMIENTO</div><h1>${E(title)}</h1>${sub?`<p class="muted">${E(sub)}</p>`:''}</div>${action}</div>`;}
function stat(label,value,info=''){return `<div class="card"><div class="stat-label">${E(label)}</div><div class="stat-value">${E(value)}</div>${info?`<div class="stat-detail">${E(info)}</div>`:''}</div>`;}
function activeGoals(){return (db.goals||[]).filter(g=>!g.done).sort((a,b)=>(a.targetDate||'9999').localeCompare(b.targetDate||'9999'));}
function goalSummary(g){
 let info=g.targetDate ? `Hasta el ${niceDate(g.targetDate)}` : 'Sin fecha límite';
 if(g.metric && g.metric!=='none' && g.targetValue!=null){
   const current=newestMetric(g.metric), meta=FIELDS.find(f=>f[0]===g.metric);
   info+= current && meta?` · Actual ${fmtNum(current[g.metric])} ${meta[2]} / Objetivo ${fmtNum(g.targetValue)} ${meta[2]}`:` · Meta ${fmtNum(g.targetValue)} ${meta?.[2]||''}`;
 }
 return info;
}
function homeHTML(){
  const w=newestMetric('weightKg'),c=newestMetric('waistCm'),a=newestMetric('abdomenCm');
  const day=activeRoutine().days[String(madridWeekday(madridToday()))];
  const sessions=db.sessions.filter(s=>s.status==='completed').sort(lastByDate);
  const goals=activeGoals(),upcoming=goals.find(g=>g.targetDate>=madridToday())||goals[0];
  const daysLeft=upcoming?.targetDate ? Math.ceil((new Date(upcoming.targetDate+'T12:00:00Z')-new Date(madridToday()+'T12:00:00Z'))/86400000) : null;
  return `${header('Cada día, un nivel más.','Controla tu evolución sin perder tu historial.',`<button class="btn primary" data-action="new-measure">+ Medición</button>`)}
    <div class="card glow hero"><div class="eyebrow">${upcoming ? E(daysLeft!=null&&daysLeft>=0?`${daysLeft} DÍAS PARA ${upcoming.name}`:upcoming.name) : 'TU PLAN DE ENTRENAMIENTO'}</div><h2>${day?.rest?'Hoy toca recuperación':day?.title||'Tu progreso empieza aquí'}</h2><p>${day?.rest?'Puedes descansar o registrar una sesión libre si entrenaste.':'Anota cargas y series en el orden real; no importa el orden del plan.'}</p><button class="btn primary" data-nav="training">Ver entrenamiento →</button></div>
    <div class="grid3 section">${stat('Último peso',w?`${fmtNum(w.weightKg)} kg`:'Sin datos',w?niceDate(w.date):'Registra tu primera medición')}${stat('Última cintura',c?`${fmtNum(c.waistCm)} cm`:'Sin datos',c?niceDate(c.date):'Medición pendiente')}${stat('Sesiones terminadas',String(sessions.length),sessions[0]?`Última: ${niceDate(sessions[0].date)}`:'Comienza tu primera sesión')}</div>
    <div class="grid2 section"><div class="card"><div class="row-between"><h2>Evolución del peso</h2><button class="html-button" data-nav="progress">Ver todo</button></div>${chartHTML('weightKg')}</div><div class="card"><div class="row-between"><h2>Objetivos activos</h2><button class="btn small" data-action="new-goal">+ Nuevo</button></div>${goals.length?goals.slice(0,3).map(g=>`<div class="list-row"><div><strong>${E(g.name)}</strong><p class="muted">${E(goalSummary(g))}</p></div></div>`).join(''):'<p class="muted">Añade tu primer objetivo desde Perfil.</p>'}<button class="btn small section" data-nav="profile">Ver objetivos</button></div></div>
    <p class="footnote section">Las referencias de kilos son orientativas, no entrenamientos registrados. ${a?`Último abdomen: ${fmtNum(a.abdomenCm)} cm (${niceDate(a.date)}).`:''}</p>`;
}

function chartHTML(metric){
  const field=FIELDS.find(f=>f[0]===metric);
  if(!field)return '';
  const points=[...db.measurements].filter(m=>Number.isFinite(m[metric])&&validDate(m.date)).sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt||'').localeCompare(b.createdAt||''));
  if(!points.length)return `<div class="empty chart-empty"><span class="symbol">⌁</span><strong>Sin datos de ${E(field[1].toLowerCase())}</strong><small>Registra esta medida para ver su evolución.</small></div>`;
  const vals=points.map(m=>m[metric]),lo=Math.min(...vals),hi=Math.max(...vals),span=Math.max(hi-lo,metric==='weightKg'?1:1.5),pad=span*.24;
  const min=lo-pad,max=hi+pad,top=18,bottom=160,left=58,right=654,width=right-left,height=bottom-top;
  const x=i=>points.length===1?(left+right)/2:left+i*width/(points.length-1);
  const y=v=>bottom-((v-min)/(max-min))*height;
  const nums=points.map((pt,i)=>[x(i),y(pt[metric])]);
  const line=nums.map(([px,py],i)=>`${i===0?'M':'L'}${px.toFixed(2)} ${py.toFixed(2)}`).join(' ');
  const area=`${line} L${nums.at(-1)[0].toFixed(2)} ${bottom} L${nums[0][0].toFixed(2)} ${bottom} Z`;
  const change=vals.at(-1)-vals[0];
  const gid=`fill-${metric}`;
  const grid=[0,.25,.5,.75,1].map(frac=>{
    const ty=top+frac*height;const value=max-frac*(max-min);
    return `<line x1="${left}" x2="${right}" y1="${ty.toFixed(2)}" y2="${ty.toFixed(2)}" stroke="#34465a" stroke-width="1" stroke-dasharray="5 7" opacity=".6"/><text x="${left-10}" y="${ty+4}" text-anchor="end" fill="#9daec0" font-size="12">${fmtNum(value,1)}</text>`;
  }).join('');
  return `<div class="chart-headline"><div><small>ACTUAL</small><strong>${fmtNum(vals.at(-1),2)} <span>${field[2]}</span></strong></div><span class="chart-change ${change<0?'down':change>0?'up':'flat'}">${vals.length>1?`${change>0?'+':''}${fmtNum(change,2)} ${field[2]} desde el inicio`:'Primera medición'}</span></div>
  <div class="chart-modern"><svg viewBox="0 0 700 204" role="img" aria-label="Evolución de ${E(field[1])}: de ${fmtNum(vals[0])} a ${fmtNum(vals.at(-1))} ${field[2]}" preserveAspectRatio="xMidYMid meet">
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c4f46d" stop-opacity=".28"/><stop offset="100%" stop-color="#c4f46d" stop-opacity=".01"/></linearGradient></defs>
  ${grid}<path d="${area}" fill="url(#${gid})"/><path d="${line}" fill="none" stroke="#c4f46d" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
  ${nums.map(([px,py],i)=>`<circle cx="${px}" cy="${py}" r="4.4" fill="#0c171d" stroke="#c4f46d" stroke-width="2.6"><title>${niceDate(points[i].date)} · ${fmtNum(vals[i],2)} ${field[2]}</title></circle>`).join('')}
  </svg></div><div class="chart-axis"><span>${niceDate(points[0].date)}</span><span>${niceDate(points.at(-1).date)}</span></div><p class="small-note">${points.length} ${points.length===1?'registro':'registros'} · Valores registrados, sin estimaciones ni interpolaciones.</p>`;
}
function compositionHTML(){
 const all=[...db.measurements].filter(m=>Number.isFinite(m.weightKg)&&validDate(m.date)).sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt||'').localeCompare(b.createdAt||''));
 const latest=all.at(-1);
 const complete=[...all].reverse().find(m=>Number.isFinite(m.fatPct));
 const total=latest?.weightKg??null;
 const fat=complete?complete.weightKg*complete.fatPct/100:null;
 const lean=complete?complete.weightKg-fat:null;
 const compWeight=complete?.weightKg??null;
 const pct=complete?.fatPct??0;
 const ring=complete?`<div class="comp-ring" style="--fat-pct:${pct};"><div class="comp-ring-inner"><small>GRASA</small><strong>${fmtNum(pct,1)}%</strong></div></div>`:`<div class="comp-ring no-data"><div class="comp-ring-inner"><small>COMPOSICIÓN</small><strong>—</strong></div></div>`;
 const bars=all.slice(-9);
 const max=Math.max(1,...bars.map(m=>m.weightKg));
 return `<section class="card section composition-card"><div class="row-between wrap"><div><div class="eyebrow">COMPOSICIÓN CORPORAL</div><h2>Tu peso, por componentes</h2><p class="muted">Peso total y estimación de grasa / masa libre de grasa.</p></div><span class="pill green">${complete?'Desglose disponible':'Pendiente de % grasa'}</span></div>
 <div class="comp-grid"><div class="comp-main"><span class="comp-overline">ÚLTIMO PESO</span><div class="comp-total">${total==null?'—':fmtNum(total,2)} <span>kg</span></div><small>${latest?niceDate(latest.date):'Registra tu primer peso'}</small>${ring}</div>
 <div class="comp-side"><div class="comp-metric fat"><div><span class="comp-dot"></span> Grasa corporal</div><strong>${fat==null?'—':fmtNum(fat,2)} <span>kg</span></strong><small>${complete?`${fmtNum(pct,1)}% del peso del ${niceDate(complete.date)}`:'Registra peso y % de grasa en una misma medición'}</small></div>
 <div class="comp-metric lean"><div><span class="comp-dot"></span> Masa libre de grasa</div><strong>${lean==null?'—':fmtNum(lean,2)} <span>kg</span></strong><small>${complete?`Calculada sobre ${fmtNum(compWeight,2)} kg`:'No disponible sin % de grasa'}</small></div>
 <div class="comp-legend"><i class="lean-key"></i> Masa libre de grasa <i class="fat-key"></i> Masa grasa <i class="unknown-key"></i> Peso sin desglose</div></div></div>
 ${bars.length?`<div class="comp-historical"><div class="row-between wrap"><h3>Peso y composición en el tiempo</h3><small>${bars.length} últimas mediciones de peso</small></div><div class="comp-bars">${bars.map(m=>{
 const hasFat=Number.isFinite(m.fatPct);const height=Math.max(7,m.weightKg/max*100);const fp=hasFat?m.fatPct:0;
 return `<div class="comp-column"><span class="comp-value">${fmtNum(m.weightKg,1)}</span><div class="comp-bar-track"><div class="comp-bar" style="height:${height}%">${hasFat?`<div class="comp-bar-lean" style="height:${100-fp}%"></div><div class="comp-bar-fat" style="height:${fp}%"></div>`:`<div class="comp-bar-unknown"></div>`}</div></div><small>${niceDate(m.date).slice(0,5)}</small></div>`;
 }).join('')}</div></div>`:`<div class="empty"><strong>Aún no hay pesos registrados</strong><small>El gráfico se irá construyendo con tus mediciones.</small></div>`}
 <p class="comp-disclaimer">El desglose se calcula como peso × % de grasa registrado <strong>en el mismo registro</strong>. La «masa libre de grasa» incluye agua, huesos, órganos y músculo: no equivale a masa muscular. Si la última composición es anterior al último peso, se muestran sus fechas por separado.</p></section>`;
}
const BODY_METRICS=['neckCm','chestCm','armLeftCm','armRightCm','waistCm','abdomenCm','hipCm','thighLeftCm','thighRightCm'];
const BODY_METRIC_LABELS = {neckCm:'Cuello',chestCm:'Pecho',armLeftCm:'Brazo izquierdo',armRightCm:'Brazo derecho',waistCm:'Cintura',abdomenCm:'Abdomen',hipCm:'Cadera',thighLeftCm:'Muslo izquierdo',thighRightCm:'Muslo derecho'};
function bodyHTML(){
 const selected=BODY_METRIC_LABELS[chartMetric]||'Selecciona una medida';
 return `<section class="card section body-card"><div class="row-between wrap"><div><div class="eyebrow">MAPA ANATÓMICO</div><h2>Medidas corporales</h2><p class="muted">Toca una región anatómica para marcarla; consulta la medida asociada y su histórico.</p></div><span class="pill">Medidas en cm</span></div>

<div class="body-panel">
  <div class="body-figure">
    <div class="anatomy-toolbar">
      <span class="label">Vista corporal</span>
    </div>
 <div id="anatomyMap" class="anatomy-map" role="group" aria-label="Mapa anatómico interactivo"></div>
 <div class="anatomy-selection"><small>REGIÓN SELECCIONADA</small><strong>${E(selected)}</strong><button class="html-button" data-action="goto-metric-chart">Ver gráfica histórica ↗</button></div><p class="fineprint">Atlas ilustrativo de músculos; las medidas son perímetros corporales y no representan el tamaño de cada músculo.</p></div>
 <div class="body-measure-list">${BODY_METRICS.map(key=>{const m=newestMetric(key),on=chartMetric===key,name=BODY_METRIC_LABELS[key];return `<button type="button" class="body-measure ${on?'selected':''}" data-action="choose-body-metric" data-metric="${key}" aria-pressed="${on}"><span><small>${E(name)}</small><strong>${m?`${fmtNum(m[key],1)} cm`:'—'}</strong></span><span class="body-date">${m?niceDate(m.date):'Sin medir'}</span></button>`;}).join('')}</div></div></section>`;
}
const ANATOMY_ALIASES={
 neckCm:['neck','trapezius'],chestCm:['chest','pectoral'],
 armLeftCm:['biceps','triceps','brachialis'],armRightCm:['biceps','triceps','brachialis'],
 waistCm:['oblique','transvers'],abdomenCm:['abs','rectus-abdominis'],
 hipCm:['glute','hip','abductor'],thighLeftCm:['quad','hamstring','adductor','vastus','femoris','gracilis','sartorius'],
 thighRightCm:['quad','hamstring','adductor','vastus','femoris','gracilis','sartorius']
};
function allBodyIds(){const mus=globalThis.BodyMuscles?.MUSCLE_MAP;if(!mus)return [];const list=Array.isArray(mus)?mus:Object.values(mus);return list.map(m=>typeof m==='string'?m:(m?.id||m?.key||'')).filter(Boolean);}
function muscleMatchesMetric(id,metric){const key=String(id).toLowerCase(),alias=ANATOMY_ALIASES[metric]||[];if(!alias.some(x=>key.includes(x)))return false; if(metric==='armLeftCm'||metric==='thighLeftCm')return key.includes('left');if(metric==='armRightCm'||metric==='thighRightCm')return key.includes('right');return true;}
function measurementForMuscle(muscleId){const id=String(muscleId).toLowerCase();const side=id.includes('left')?'Left':id.includes('right')?'Right':'';
 if(/neck|trapez/.test(id))return 'neckCm';if(/chest|pectoral/.test(id))return 'chestCm';
 if(/biceps|triceps|forearm|brachialis/.test(id))return side==='Left'?'armLeftCm':side==='Right'?'armRightCm':'armLeftCm';
 if(/oblique|serratus|transvers/.test(id))return 'waistCm';if(/abdom|abs|rectus-ab/.test(id))return 'abdomenCm';
 if(/glut|hip|abductor/.test(id))return 'hipCm';
 if(/quad|hamstring|adductor|vastus|femoris/.test(id))return side==='Left'?'thighLeftCm':side==='Right'?'thighRightCm':'thighLeftCm';
 return null;
}
function destroyBodyMap(){if(bodyChart){try{bodyChart.destroy()}catch{}bodyChart=null;}}
let anatomyScriptRequested=false;
function mountBodyMap(){const container=document.getElementById('anatomyMap');if(!container)return;destroyBodyMap();const lib=globalThis.BodyMuscles;
 if(!lib?.BodyChart||!lib?.ViewSide){
   if(!anatomyScriptRequested){
     anatomyScriptRequested=true;
     const script=document.createElement('script');script.async=true;
     script.src='https://unpkg.com/@emmorts/body-muscles@2.1.1/dist/umd/body-muscles.umd.min.js';
     setTimeout(()=>{const current=document.getElementById('anatomyMap');if(current&&!globalThis.BodyMuscles&&current.querySelector('.anatomy-loader'))current.innerHTML='<div class="anatomy-fallback"><strong>Sin conexión al atlas anatómico</strong><small>Puedes consultar tus medidas desde las tarjetas. El atlas necesita internet la primera vez.</small></div>';},6000);
     script.onload=()=>{if(view==='progress')mountBodyMap();};
     script.onerror=()=>{const current=document.getElementById('anatomyMap');if(current)current.innerHTML='<div class="anatomy-fallback"><strong>Mapa anatómico no disponible</strong><small>Revisa tu conexión. Mientras tanto, puedes elegir medidas usando las tarjetas.</small></div>';};
     document.head.append(script);
   }
   return;
 }
 try{
   const bodyState={};const selectedIds=new Set(allBodyIds().filter(id=>muscleMatchesMetric(id,chartMetric)));if(anatomySelectedId)selectedIds.add(anatomySelectedId);for(const id of selectedIds)bodyState[id]={intensity:7,selected:true};
   bodyChart=new lib.BodyChart(container,{view:bodyViewSide==='BACK'?lib.ViewSide.BACK:lib.ViewSide.FRONT,bodyState,ariaLabel:'Mapa anatómico humano. Selecciona músculos con el dedo o teclado.',showViewLabel:false,onMuscleClick:(id)=>{
     anatomySelectedId=String(id);const metric=measurementForMuscle(id);if(metric){chartMetric=metric;renderKeepScroll();}else{const state={};state[id]={intensity:7,selected:true};bodyChart?.update({bodyState:state});}
   }});
 }catch(err){console.warn('Error al inicializar Body Muscles',err);container.innerHTML='<div class="anatomy-fallback"><strong>No se pudo dibujar el atlas.</strong><small>Utiliza las tarjetas de medidas para elegir la zona.</small></div>';}
}

function trainingHTML(){
 const plan=activeRoutine(),day=plan.days[String(selectedDay)]||{title:'Sin plan',exercises:[],rest:true},sess=db.activeSession;
 return `${header('Tus entrenamientos',`${plan.name}. Registra lo que hagas, aunque sea día libre.`,`<button class="btn" data-action="planner-open">✦ Asistente de rutinas</button>`)}
 <div class="day-list">${[1,2,3,4,5,6,7].map(i=>{const d=plan.days[String(i)];return `<button class="day-chip ${selectedDay===i?'selected':''}" data-day="${i}"><small>${DAYS[i]}</small><b>${d?.rest?'Desc.':`Día ${i}`}</b></button>`}).join('')}</div>
 ${sess?`<section class="section">${sessionHTML(sess)}</section>`:''}
 <section class="section"><div class="row-between wrap"><div><div class="eyebrow">DÍA ${selectedDay}</div><h2>${E(day.title)}</h2><p class="muted">${day.rest?'Descanso programado. Puedes registrar un entrenamiento libre sin modificar el plan.':'Orden sugerido: puedes realizar los ejercicios en cualquier otro orden.'}</p></div>
 </div>${!sess?`<div class="training-controls">${!day.rest?`<button class="btn primary" data-action="start-session">▶ Rutina del día</button>`:''}<button class="btn ${day.rest?'primary':''}" data-action="free-session">+ Sesión libre</button></div>`:''}
 ${day.rest?`<div class="card empty"><span class="symbol">☾</span><strong>Recuperación programada</strong><p>Si entrenaste hoy, usa «Sesión libre» y añade los ejercicios del banco.</p></div>`:`<div class="stack planned-exercises">${day.exercises.map((rx,i)=>exerciseRow(rx,i)).join('')}</div>`}
 <div class="row-between section wrap"><button class="btn" data-action="routine-add">+ Añadir al plan</button><button class="btn ghost" data-action="routine-copy">Duplicar plan</button></div></section>
 <section class="section card"><div class="row-between wrap"><h2>Historial de sesiones</h2><span class="pill">${db.sessions.filter(s=>s.status==='completed').length} completadas</span></div>${sessionHistoryHTML(5)}<div class="list-footer"><button class="btn" data-nav="sessions">Ver todas las sesiones →</button></div></section><section class="card section load-shortcut"><div><div class="eyebrow">REGISTRO PERSONAL</div><h2>Mis cargas utilizadas</h2><p class="muted">Consulta el último peso real por ejercicio en su propia página. Al entrenar, lo tendrás precargado en la primera serie.</p></div><button class="btn" data-nav="loads">Abrir cargas →</button></section>`;
}
function exerciseRow(rx,i){const e=exercise(rx.exerciseId);return `<div class="exercise-card"><div class="row-between"><div class="row" style="min-width:0"><div class="number">${i+1}</div><div><h3>${E(e.name)}</h3><p><span class="muscle-tag">${E(e.muscle)}</span> · ${E(e.equipment)} ${rx.optional?'· opcional':''}</p></div></div><button class="btn small ghost" data-action="routine-edit" data-index="${i}">Editar</button></div><div class="exercise-details"><p>${rx.sets} series × ${rx.min}${rx.max!==rx.min?`–${rx.max}`:''} ${unitLabel(e.unit,rx.perSide)} · <strong>${e.unit==='minutes'?'Sin kg':suggestedLoad(rx)}</strong></p>${rx.notes?`<small>${E(rx.notes)}</small>`:''}</div></div>`;}
function unitLabel(unit,side=false){return unit==='seconds'?'segundos':unit==='minutes'?'minutos':`repeticiones${side?' por lado':''}`;}
function lastLoadEntry(id){
  // Search across ALL completed sessions and repeated appearances of the exercise.
  const sessions=[...db.sessions].filter(s=>s.status==='completed').sort((a,b)=>
    b.date.localeCompare(a.date)||(b.endedAt||b.createdAt||'').localeCompare(a.endedAt||a.createdAt||''));
  for(const ses of sessions){
    for(const ex of [...ses.exercises].reverse()){
      if(ex.exerciseId!==id)continue;
      const set=[...ex.sets].reverse().find(t=>t.done && Number.isFinite(t.load));
      if(set)return {load:set.load,date:ses.date,reps:set.reps,sessionId:ses.id};
    }
  }
  return null;
}
function lastLoad(id){return lastLoadEntry(id)?.load??null;}
function recentLoadRecords(){
 const records=[];
 for(const item of db.exercises){if(item.unit==='minutes'||item.equipment==='Peso corporal'||item.loadUnit==='Sin carga')continue;
  const hit=lastLoadEntry(item.id);if(hit)records.push({...hit,name:item.name,id:item.id,muscle:item.muscle});}
 return records.sort((a,b)=>b.date.localeCompare(a.date));
}
function loadsPageHTML(){const records=recentLoadRecords();return `${subpageHeader('Cargas utilizadas','Últimos pesos reales de cada ejercicio, ordenados por fecha.','training')}
 <div class="card"><div class="row-between wrap"><div><h2>Últimos pesos utilizados</h2><p class="muted">Solo cargas de series completadas, nunca las sugeridas sin realizar.</p></div><span class="pill green">${records.length} ejercicios</span></div>
 ${records.length?`<label class="field filter-on-page"><span class="label">Buscar ejercicio</span><input type="search" id="loadsSearch" placeholder="Ej. Chest Press, Curl…" aria-label="Buscar entre cargas guardadas"></label><div class="load-grid" id="loadResults">${records.map(item=>`<button class="load-item load-link" data-action="load-detail" data-id="${E(item.id)}" data-load-item data-text="${E((item.name+' '+item.muscle).toLowerCase())}"><span><strong>${E(item.name)}</strong><small>${E(item.muscle)} · ${niceDate(item.date)}</small></span><b>${fmtNum(item.load,2)} <span>kg</span></b></button>`).join('')}</div>`:'<div class="empty"><strong>Aún no hay cargas registradas</strong><small>Guarda una serie con kilos para que aparezca aquí. La próxima primera serie se rellenará con tu último peso real.</small></div>'}</div>`;}
function loadDetailModal(id){const item=exercise(id),matches=[];
 for(const s of db.sessions.filter(s=>s.status==='completed'))for(const ex of s.exercises.filter(ex=>ex.exerciseId===id))for(const set of ex.sets.filter(set=>set.done&&Number.isFinite(set.load)))matches.push({date:s.date,load:set.load,reps:set.reps});
 matches.sort((a,b)=>b.date.localeCompare(a.date));modal('Historial de carga · '+item.name,`<p class="muted">${E(item.muscle)} · ${matches.length} series registradas con peso</p><div class="scroll-table"><table><thead><tr><th>Fecha</th><th>Peso</th><th>Reps</th></tr></thead><tbody>${matches.map(x=>`<tr><td>${niceDate(x.date)}</td><td><strong>${fmtNum(x.load,2)} kg</strong></td><td>${fmtNum(x.reps,0)}</td></tr>`).join('')}</tbody></table></div>`);}
function subpageHeader(title,subtitle,parent){return `<div class="subpage-head"><button class="btn ghost back-link" data-nav="${parent}" aria-label="Volver a ${parent==='progress'?'Progreso':'Entrenar'}">← Volver a ${parent==='progress'?'Progreso':'Entrenar'}</button></div>${header(title,subtitle)}`;}

function makeSession(dayId,free=false){
 const day=activeRoutine().days[String(dayId)]||{title:'Día libre',exercises:[]};
 return {id:uid(),date:madridToday(),day:dayId,routineId:activeRoutine().id,title:free?`Sesión libre · ${DAYS[dayId]}`:day.title,status:'in_progress',startedAt:new Date().toISOString(),exercises:free?[]:day.exercises.map(rx=>makeSessionExercise(rx.exerciseId,rx.sets,rx.perSide,rx.suggestedKg))};
}
function makeSessionExercise(exerciseId,sets=3,perSide=false,suggestedKg=null){
 const e=exercise(exerciseId),previous=lastLoad(e.id);
 return {id:uid(),exerciseId:e.id,name:e.name,unit:e.unit,perSide,finishedAt:null,completionOrder:null,sets:Array.from({length:sets},(_,i)=>({id:uid(),load:e.unit==='minutes'||e.loadUnit==='Sin carga'||e.loadUnit==='Peso corporal'?null:(i===0?(previous??suggestedKg??null):(suggestedKg??null)),reps:null,seconds:null,minutes:null,distanceKm:null,inclinePct:null,rir:null,done:false}))};
}
function validResult(ex,set){
 if(ex.unit==='minutes')return (Number.isFinite(set.minutes)&&set.minutes>0)||(Number.isFinite(set.distanceKm)&&set.distanceKm>0);
 return Number.isFinite(set[ex.unit])&&set[ex.unit]>0;
}
function orderedSessionExercises(s){
 return s.exercises.map((ex,i)=>({...ex,originalIndex:i})).sort((a,b)=>{
  const aDone=a.completionOrder!=null,bDone=b.completionOrder!=null;
  return aDone&&!bDone?-1:!aDone&&bDone?1:aDone&&bDone?a.completionOrder-b.completionOrder:a.originalIndex-b.originalIndex;
 });
}
function setInputs(ex,set,ei,si){
 const e=exercise(ex.exerciseId),f=(key,label,inputMode='decimal',placeholder='—')=>`<label class="compact-field"><span>${E(label)}</span><input aria-label="${E(label)}" inputmode="${inputMode}" data-set-field="${key}" data-ex="${ei}" data-set="${si}" placeholder="${placeholder}" value="${set[key]==null?'':E(String(set[key]).replace('.',','))}"></label>`;
 const done=`<label class="done"><span class="sr-only">Completar serie</span><input aria-label="Completar serie" type="checkbox" data-set-done data-ex="${ei}" data-set="${si}" ${set.done?'checked':''}></label>`;
 if(ex.unit==='minutes')return `<div class="set-row-flex ${set.done?'completed':''}"><b class="set-number">${si+1}</b>${f('minutes','Min','decimal')}${e.supportsDistance?f('distanceKm','km','decimal'):''}${ex.exerciseId==='cardio-cinta'?f('inclinePct','Inclinación %','decimal'):''}${done}</div>`;
 const bodyweight=e.equipment==='Peso corporal'||e.loadUnit==='Sin carga'||e.loadUnit==='Peso corporal';
 return `<div class="set-row-flex ${set.done?'completed':''}"><b class="set-number">${si+1}</b>${!bodyweight?f('load','Kg'):''}${f(ex.unit,ex.unit==='seconds'?'Segundos':'Reps','decimal')}${f('rir','RIR','numeric')}${done}</div>`;
}
function sessionExerciseHTML(s,ex,orderNo){
 const ei=s.exercises.findIndex(x=>x.id===ex.id),finished=ex.completionOrder!=null,
 count=ex.sets.filter(t=>t.done).length,e=exercise(ex.exerciseId),name=e.name==='Ejercicio eliminado'?ex.name:e.name;
 return `<div class="card session-exercise ${finished?'exercise-finished':''}" data-session-card="${E(ex.id)}"><div class="row-between wrap"><div class="row"><span class="number ${finished?'finished-number':''}">${finished?orderNo:'·'}</span><div><div class="set-title">${E(name)}</div><span class="muscle-tag">${E(e.muscle)}</span> <small>· ${finished?`${count} series guardadas · orden real ${orderNo}`:`${unitLabel(ex.unit,ex.perSide)} · pendiente`}</small></div></div><span class="pill ${finished?'green':''}">${finished?'HECHO':'POR HACER'}</span></div>
 ${!finished?`<div class="set-list">${ex.sets.map((set,si)=>setInputs(ex,set,ei,si)).join('')}</div><div class="row-between wrap session-tools"><button class="btn small ghost" data-action="add-set" data-ex="${ei}">+ Serie</button><button class="btn small ghost" data-action="remove-set" data-ex="${ei}">− Última serie</button><button class="btn primary" data-action="finish-exercise" data-ex="${ei}">✓ Guardar este ejercicio</button></div>`:`<div class="row-between wrap session-tools"><p class="muted">${ex.sets.filter(t=>t.done).map(t=>ex.unit==='minutes'?`${fmtNum(t.minutes)} min${t.distanceKm!=null?` · ${fmtNum(t.distanceKm,2)} km`:''}`:`${fmtNum(t[ex.unit])} ${unitLabel(ex.unit)}${t.load!=null?` · ${fmtNum(t.load)} kg`:''}`).join(' / ')}</p><button class="btn small" data-action="reopen-exercise" data-ex="${ei}">Editar ejercicio</button></div>`}</div>`;
}
function sessionHTML(s){
 const done=orderedSessionExercises(s).filter(ex=>ex.completionOrder!=null),pending=orderedSessionExercises(s).filter(ex=>ex.completionOrder==null);
 return `<div class="session-card"><div class="row-between wrap"><div><span class="eyebrow">SESIÓN EN CURSO</span><h2>${E(s.title)}</h2><small>${done.length} ejercicios terminados · ${pending.length} pendientes</small></div><button class="btn danger small" data-action="cancel-session">Descartar</button></div>
 <label class="field section" style="max-width:230px"><span class="label">Fecha de la sesión</span><input type="date" data-session-date value="${E(s.date)}" max="${madridToday()}"></label>
 <div class="row-between section wrap"><h3>Orden real de entrenamiento</h3><button class="btn small" data-action="session-add">+ Añadir ejercicio del banco</button></div>
 ${done.length?`<div class="stack">${done.map((ex,i)=>sessionExerciseHTML(s,ex,i+1)).join('')}</div>`:''}
 <h3 class="section muted">Pendientes · orden previsto</h3>${pending.length?`<div class="stack">${pending.map(ex=>sessionExerciseHTML(s,ex,0)).join('')}</div>`:`<p class="muted">No hay ejercicios pendientes. Puedes añadir otro del banco.</p>`}
 <button class="btn primary block section" data-action="finish-session">Guardar entrenamiento (${done.length} ejercicios terminados)</button><p class="small-note">Usa «Guardar este ejercicio» cuando lo termines. El primero que finalices pasará a ser el n.º 1, aunque fuera el cuarto del plan. Puedes registrar solo una parte del entrenamiento. Los pendientes sin completar no se guardan en el historial.</p></div>`;
}

function lastFiveDaysStart(){
  const d=new Date(`${madridToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate()-4);
  return d.toISOString().slice(0,10);
}
function sessionHistoryHTML(daysLimit){
  const all=[...db.sessions].filter(s=>s.status==='completed').sort(lastByDate);
  const daysStart=daysLimit==null?null:lastFiveDaysStart();
  const items=all.filter(s=>!daysStart||s.date>=daysStart);
  if(!items.length)return `<div class="empty"><strong>${all.length?'No hay entrenamientos en los últimos cinco días':'Todavía no has guardado entrenamientos'}</strong><small>${all.length?'Pulsa «Ver todo el historial» para consultar sesiones anteriores.':'Cuando termines tu primera sesión, aparecerá aquí.'}</small></div>`;
  return items.map(s=>`<div class="list-row"><div><strong>${E(s.title)}</strong><p class="muted">${niceDate(s.date)} · ${s.exercises.filter(e=>e.sets.some(x=>x.done)).length} ejercicios · ${s.exercises.reduce((n,e)=>n+e.sets.filter(x=>x.done).length,0)} series</p></div><div class="row history-actions"><button class="btn small" data-action="session-detail" data-id="${E(s.id)}">Ver</button><button class="btn small danger" data-action="delete-session" data-id="${E(s.id)}">Borrar</button></div></div>`).join('');
}
function progressHTML(){
 const rows=[...db.measurements].sort(lastByDate),met=FIELDS.find(f=>f[0]===chartMetric),visible=rows.slice(0,5);
 return `${header('Tu progreso','Composición corporal, medidas actuales y evolución histórica.',`<button class="btn primary" data-action="new-measure">+ Nueva medición</button>`)}
 <div class="grid3">${stat('Registros',String(rows.length),'Mediciones fechadas')}${stat('Peso actual',newestMetric('weightKg')?`${fmtNum(newestMetric('weightKg').weightKg,2)} kg`:'—')}${stat('Cintura actual',newestMetric('waistCm')?`${fmtNum(newestMetric('waistCm').waistCm,1)} cm`:'—')}</div>
 ${compositionHTML()}
 ${bodyHTML()}
 <section id="measure-history-chart" class="card section"><div class="row-between wrap"><div><div class="eyebrow">HISTÓRICO</div><h2>Evolución de ${E(met?.[1]||'medida')}</h2><p class="muted">Incluye la medición actual y todas las anteriores.</p></div><select class="select-inline chart-select" id="chartMetric" aria-label="Medida del gráfico">${FIELDS.map(f=>`<option value="${f[0]}" ${chartMetric===f[0]?'selected':''}>${E(f[1])}</option>`).join('')}</select></div>${chartHTML(chartMetric)}</section>
 <section class="card section"><div class="row-between wrap"><div><h2>Historial de mediciones</h2><p class="muted">${rows.length} registros · mostrando ${visible.length}</p></div><button class="btn small" data-action="export">Copia JSON</button></div>
 ${rows.length?visible.map(m=>`<div class="list-row"><div><strong>${niceDate(m.date)}</strong><p class="muted">${FIELDS.filter(f=>Number.isFinite(m[f[0]])).map(f=>`${E(f[1])}: ${fmtNum(m[f[0]],2)} ${f[2]}`).join(' · ')}</p>${m.notes?`<small>${E(m.notes)}</small>`:''}</div><div class="row history-actions"><button class="btn small" data-action="edit-measure" data-id="${E(m.id)}">Editar</button><button class="btn danger small" data-action="delete-measure" data-id="${E(m.id)}">Borrar</button></div></div>`).join(''):`<div class="empty"><span class="symbol">↗</span><strong>Registra tu primera medición</strong><small>Puedes registrar solo el peso o solo una medida.</small><button class="btn primary" data-action="new-measure">Empezar</button></div>`}
 ${rows.length?`<div class="list-footer"><button class="btn" data-nav="measurements">Ver todas las mediciones →</button></div>`:''}</section>`;
}
function measurementsPageHTML(){const rows=[...db.measurements].sort(lastByDate);
 return `${subpageHeader('Todas las mediciones','Historial completo por fecha, sin expandir el resumen de Progreso.','progress')}
 <div class="card"><div class="row-between wrap"><span class="pill green">${rows.length} registros</span><div class="row wrap"><button class="btn" data-action="export">↓ Copia JSON</button><button class="btn primary" data-action="new-measure">+ Medición</button></div></div>
 ${rows.length?rows.map(m=>`<div class="list-row"><div><strong>${niceDate(m.date)}</strong><p class="muted">${FIELDS.filter(f=>Number.isFinite(m[f[0]])).map(f=>`${E(f[1])}: ${fmtNum(m[f[0]],2)} ${f[2]}`).join(' · ')}</p>${m.notes?`<small>${E(m.notes)}</small>`:''}</div><div class="row history-actions"><button class="btn small" data-action="edit-measure" data-id="${E(m.id)}">Editar</button><button class="btn danger small" data-action="delete-measure" data-id="${E(m.id)}">Borrar</button></div></div>`).join(''):'<div class="empty"><strong>Sin mediciones todavía</strong><small>Puedes registrar peso o cualquier perímetro independientemente.</small></div>'}</div>`;
}
function sessionsPageHTML(){const count=db.sessions.filter(s=>s.status==='completed').length;
 return `${subpageHeader('Historial de sesiones','Todas tus sesiones guardadas y sus series, incluidas sesiones libres.','training')}
 <section class="card"><div class="row-between wrap"><h2>Todos los entrenamientos</h2><span class="pill green">${count} sesiones</span></div>${sessionHistoryHTML(null)}</section>`;
}

function libraryHTML(){
 const muscles=['Todos',...new Set(db.exercises.map(e=>e.muscle))];
 return `${header('Banco de ejercicios',`${db.exercises.length} ejercicios disponibles. Busca por músculo, material o nivel.`,`<button class="btn primary" data-action="new-exercise">+ Nuevo ejercicio</button>`)}
 <div class="card"><div class="filters"><input id="exerciseSearch" type="search" placeholder="Buscar ejercicio, material…" aria-label="Buscar ejercicios"><select id="muscleFilter" class="select-inline" aria-label="Grupo muscular">${muscles.map(m=>`<option value="${E(m)}">${E(m)}</option>`).join('')}</select><select id="levelFilter" class="select-inline" aria-label="Nivel del ejercicio"><option value="Todos">Todos los niveles</option><option value="Principiante">Principiante</option><option value="Intermedio">Intermedio</option><option value="Avanzado">Avanzado</option></select></div><p class="small-note">Las máquinas usan nombres habituales en inglés; pueden variar según la marca. Otros ejercicios mantienen sus nombres en español.</p></div>
 <div class="grid2 section" id="exerciseResults">${db.exercises.map(e=>`<div class="exercise-card" data-library-item data-text="${E(`${e.name} ${e.muscle} ${e.equipment}`.toLowerCase())}" data-muscle="${E(e.muscle)}" data-level="${E(e.level||'General')}"><div class="row-between"><div><h3>${E(e.name)}</h3><p><span class="muscle-tag">${E(e.muscle)}</span> · ${E(e.equipment)} <span class="level-chip">${E(e.level||'General')}</span></p></div><button class="btn small" data-action="exercise-detail" data-id="${E(e.id)}">Ver</button></div><small>${E(e.instructions)}</small></div>`).join('')}</div>`;
}
function profileHTML(){
 return `${header('Tu perfil y objetivos','Crea varios objetivos y genera una nueva rutina según tus días disponibles.')}
 <div class="grid2"><form class="card" id="profileForm"><h2>Datos de referencia</h2><div class="form-grid"><label class="field"><span class="label">Altura (cm)</span><input name="heightCm" inputmode="decimal" value="${E(db.profile.heightCm)}"></label><label class="field"><span class="label">Peso de referencia (kg)</span><input name="referenceWeightKg" inputmode="decimal" value="${E(db.profile.referenceWeightKg)}"></label><label class="field full"><span class="label">Gimnasio</span><input name="gym" maxlength="100" value="${E(db.profile.gym)}"></label></div><button class="btn primary block section" type="submit">Guardar perfil</button></form>
 <div class="card"><h2>Memoria de tus datos</h2><p>Los registros se guardan en <strong>este navegador</strong>. No se suben a GitHub.</p><div class="stack"><button class="btn primary block" data-action="export">↓ Descargar memoria (.json)</button><label class="btn block" for="importFile">↑ Restaurar memoria JSON</label><input id="importFile" type="file" accept=".json,application/json" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none"><button class="btn danger block" data-action="reset">Borrar todos mis datos locales</button></div><p class="fineprint section">Haz copias de seguridad frecuentes, especialmente antes de cambiar de teléfono o limpiar el navegador. No subas tu respaldo personal a un repositorio público.</p></div></div>
 <section class="card section"><div class="row-between wrap"><div><h2>Tus objetivos</h2><p class="muted">Puedes mantener varios objetivos activos a la vez: peso, cintura o rendimiento.</p></div><button class="btn primary" data-action="new-goal">+ Añadir objetivo</button></div>${db.goals.length?db.goals.map(g=>`<div class="list-row"><div><strong>${E(g.name)}</strong> ${g.done?'<span class="pill green">CUMPLIDO</span>':''}<p class="muted">${E(goalSummary(g))}</p>${g.description?`<small>${E(g.description)}</small>`:''}</div><div class="row wrap"><button class="btn small" data-action="edit-goal" data-id="${E(g.id)}">Editar</button><button class="html-button danger" data-action="delete-goal" data-id="${E(g.id)}">Borrar</button></div></div>`).join(''):'<div class="empty">No hay objetivos todavía.</div>'}</section>
 <section class="card section"><div class="row-between wrap"><div><h2>Asistente de rutinas</h2><p class="muted">Planifica con tus días disponibles, número de sesiones y objetivo principal.</p></div><button class="btn primary" data-action="planner-open">✦ Crear mi rutina</button></div><p class="small-note">Generador inteligente local, basado en reglas de entrenamiento: funciona sin internet ni claves de API. No es una IA conversacional. También puedes copiar tus preferencias para consultarlas en ChatGPT.</p></section>
 <section class="card section"><div class="row-between wrap"><div><h2>Versiones de tu rutina</h2><p class="muted">Crear una versión no elimina las sesiones anteriores.</p></div><button class="btn" data-action="routine-copy">Duplicar</button></div>${db.routines.map(r=>`<div class="list-row"><div><strong>${E(r.name)}</strong><p class="muted">${r.id===db.activeRoutineId?'Rutina activa':'Versión guardada'}</p></div>${r.id===db.activeRoutineId?`<span class="pill green">ACTIVA</span>`:`<button class="btn small" data-action="routine-activate" data-id="${E(r.id)}">Activar</button>`}</div>`).join('')}</section>`;
}
function goalModal(id){
 const g=db.goals.find(g=>g.id===id)||{};
 modal(id?'Editar objetivo':'Nuevo objetivo',`<form id="goalForm" data-id="${E(g.id||'')}"><div class="form-grid"><label class="field full"><span class="label">Nombre del objetivo</span><input name="name" value="${E(g.name||'')}" maxlength="100" required placeholder="Ej.: mejorar fuerza o perder cintura"></label><label class="field"><span class="label">Fecha límite (opcional)</span><input name="targetDate" type="date" value="${E(g.targetDate||'')}"></label><label class="field"><span class="label">Qué quieres seguir</span><select name="metric"><option value="none">Sin cifra concreta</option>${FIELDS.map(f=>`<option value="${f[0]}" ${g.metric===f[0]?'selected':''}>${E(f[1])} (${f[2]})</option>`).join('')}</select></label><label class="field"><span class="label">Valor objetivo (opcional)</span><input name="targetValue" inputmode="decimal" placeholder="Ej.: 75,0" value="${g.targetValue==null?'':E(g.targetValue)}"></label><label class="field full"><span class="label">Descripción</span><textarea name="description" maxlength="1000" placeholder="Qué te gustaría conseguir">${E(g.description||'')}</textarea></label><label class="field full row"><input type="checkbox" name="done" style="width:auto" ${g.done?'checked':''}>Objetivo cumplido</label></div><button class="btn primary block section" type="submit">Guardar objetivo</button></form>`);
}
function plannerModal(){
 const p=db.planner,selected=p.availableDays||[1,2,3,5,6];
 modal('Asistente de rutinas',`<form id="plannerForm"><p>Elige los días que <strong>puedes entrenar</strong>, el objetivo que más te importa y tu experiencia. Se crea otra versión de la rutina sin borrar tus registros.</p>
 <div class="day-choices">${[1,2,3,4,5,6,7].map(i=>`<label class="day-choice"><input type="checkbox" name="availableDay" value="${i}" ${selected.includes(i)?'checked':''}><span>${DAYS[i]}</span></label>`).join('')}</div>
 <div class="form-grid section"><label class="field"><span class="label">Días activos por semana</span><select name="sessionsPerWeek">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${p.sessionsPerWeek===n?'selected':''}>${n} ${n===1?'día':'días'}</option>`).join('')}</select></label>
 <label class="field"><span class="label">Duración por sesión</span><select name="minutesPerSession">${[35,45,60,75,90].map(n=>`<option value="${n}" ${p.minutesPerSession===n?'selected':''}>${n} min</option>`).join('')}</select></label>
 <label class="field"><span class="label">Enfoque prioritario</span><select name="focus">${FOCUSES.map(([k,v])=>`<option value="${k}" ${p.focus===k?'selected':''}>${v}</option>`).join('')}</select></label>
 <label class="field"><span class="label">Experiencia</span><select name="level">${[['principiante','Principiante'],['intermedio','Intermedio'],['avanzado','Avanzado']].map(([k,v])=>`<option value="${k}" ${p.level===k?'selected':''}>${v}</option>`).join('')}</select></label></div>
 <p class="small-note">El modo avanzado selecciona variantes más exigentes y ajusta volumen y rangos, pero no establece cargas sin historial. Revisa técnica y recuperación. Máximo seis sesiones; queda al menos un día de descanso.</p>
 <div class="stack"><button class="btn primary block" type="submit">Generar nueva versión de rutina</button><button class="btn block" type="button" data-action="copy-ai-prompt">Copiar consulta para ChatGPT</button></div></form>`);
}
function modal(title,content){showingModal=true;document.getElementById('dialog-root')?.remove();const root=document.createElement('div');root.id='dialog-root';root.className='modal-backdrop';root.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="${E(title)}"><div class="modal-head"><h2>${E(title)}</h2><button class="modal-close" data-action="close-modal" aria-label="Cerrar ventana" title="Cerrar">×</button></div>${content}</div>`;document.body.append(root);}
function closeModal(){showingModal=false;document.getElementById('dialog-root')?.remove();}
function measurementModal(id){const rec=db.measurements.find(m=>m.id===id);modal(rec?'Editar medición':'Nueva medición',`<form id="measureForm" data-id="${E(id||'')}"><label class="field"><span class="label">Fecha de medición</span><input type="date" name="date" required value="${E(rec?.date||madridToday())}" max="${madridToday()}"></label><div class="form-grid section">${FIELDS.map(f=>`<label class="field"><span class="label">${E(f[1])} (${f[2]})</span><input name="${f[0]}" inputmode="decimal" placeholder="Opcional" value="${rec?.[f[0]]==null?'':E(String(rec[f[0]]).replace('.',','))}"></label>`).join('')}<label class="field full"><span class="label">Notas (opcionales)</span><textarea name="notes" placeholder="Contexto de la medición">${E(rec?.notes||'')}</textarea></label></div><p class="footnote">Solo necesitas introducir al menos un valor. Los demás pueden quedar vacíos.</p><button class="btn primary block" type="submit">Guardar medición</button></form>`);}
function routineModal(i,add=false){const day=activeRoutine().days[String(selectedDay)],rx=day.exercises[i];modal(add?'Añadir ejercicio':'Editar ejercicio',`<form id="routineForm" data-index="${add?'-1':i}"><div class="form-grid"><label class="field full"><span class="label">Ejercicio</span><select name="exerciseId">${db.exercises.map(e=>`<option value="${E(e.id)}" ${rx?.exerciseId===e.id?'selected':''}>${E(e.name)}</option>`).join('')}</select></label><label class="field"><span class="label">Series</span><input name="sets" type="number" min="1" max="20" value="${rx?.sets??3}"></label><label class="field"><span class="label">Reps mínimas / seg.</span><input name="min" type="number" min="1" max="600" value="${rx?.min??8}"></label><label class="field"><span class="label">Reps máximas / seg.</span><input name="max" type="number" min="1" max="600" value="${rx?.max??12}"></label><label class="field"><span class="label">Peso sugerido (kg)</span><input name="suggestedKg" inputmode="decimal" placeholder="Sin definir" value="${rx?.suggestedKg??''}"></label><label class="field full"><span class="label">Notas</span><textarea name="notes">${E(rx?.notes||'')}</textarea></label><label class="field full row"><input type="checkbox" style="width:auto" name="perSide" ${rx?.perSide?'checked':''}>Por cada lado / pierna</label><label class="field full row"><input type="checkbox" style="width:auto" name="optional" ${rx?.optional?'checked':''}>Ejercicio opcional</label></div><div class="row-between section"><button class="btn primary" type="submit">Guardar</button>${!add?`<button class="btn danger" type="button" data-action="routine-remove" data-index="${i}">Eliminar del día</button>`:''}</div></form>`);}
function sessionAddModal(){
 if(!db.activeSession){toast('Primero comienza una sesión.',true);return;}
 modal('Añadir ejercicio a esta sesión',`<form id="sessionAddForm"><label class="field"><span class="label">Busca y elige ejercicio</span><input id="sessionCatalogSearch" type="search" placeholder="Buscar en el banco (${db.exercises.length} ejercicios)…"><select name="exerciseId" id="sessionExerciseSelect" size="7" required style="height:220px;margin-top:10px">${db.exercises.map(e=>`<option value="${E(e.id)}" data-text="${E((e.name+' '+e.muscle).toLowerCase())}">${E(e.name)} · ${E(e.muscle)}</option>`).join('')}</select></label><label class="field section"><span class="label">Series que vas a registrar</span><input name="sets" type="number" min="1" max="20" value="3"></label><button class="btn primary block section" type="submit">Añadir a mi sesión</button></form>`);
}
function exerciseModal(id){const e=id?exercise(id):null;modal(e?'Detalle del ejercicio':'Crear ejercicio',e?`<p><span class="muscle-tag">${E(e.muscle)}</span> <span class="pill">${E(e.equipment)}</span> <span class="level-chip">${E(e.level||'General')}</span></p><p>${E(e.instructions)}</p><p class="footnote">Unidad: ${E(e.unit==='seconds'?'segundos':e.unit==='minutes'?'minutos':'repeticiones')} · Carga: ${E(e.loadUnit)}</p>${e.custom?`<button class="btn danger" data-action="delete-exercise" data-id="${E(e.id)}">Eliminar ejercicio propio</button>`:''}`:`<form id="exerciseForm"><div class="form-grid"><label class="field full"><span class="label">Nombre</span><input name="name" required maxlength="100"></label><label class="field"><span class="label">Músculo</span><input name="muscle" required placeholder="Espalda" maxlength="40"></label><label class="field"><span class="label">Material</span><select name="equipment"><option>Máquina</option><option>Mancuernas</option><option>Polea</option><option>Barra</option><option>Peso corporal</option><option>Otro</option></select></label><label class="field"><span class="label">Unidad</span><select name="unit"><option value="reps">Repeticiones</option><option value="seconds">Segundos</option><option value="minutes">Minutos</option></select></label><label class="field"><span class="label">Tipo de carga</span><select name="loadUnit"><option>Máquina</option><option>Por mancuerna</option><option>Total</option><option>Peso corporal</option><option>Sin carga</option></select></label><label class="field"><span class="label">Nivel</span><select name="level"><option>Principiante</option><option>Intermedio</option><option>Avanzado</option></select></label><label class="field full"><span class="label">Cómo se realiza</span><textarea name="instructions" maxlength="1000" required></textarea></label></div><button class="btn primary block section" type="submit">Añadir al banco</button></form>`);}
function detailSession(id){
 const s=db.sessions.find(x=>x.id===id);if(!s)return;
 const exs=[...s.exercises].filter(e=>e.sets.some(t=>t.done)).sort((a,b)=>(a.completionOrder??999)-(b.completionOrder??999));
 modal('Sesión · '+niceDate(s.date),`<p class="muted">${E(s.title)} · ${exs.length} ejercicios en orden de realización</p>${exs.map((ex,i)=>{
 const e=exercise(ex.exerciseId),display=e.name==='Ejercicio eliminado'?ex.name:e.name;
 return `<div class="card section"><strong>${i+1}. ${E(display)}</strong> <span class="muscle-tag">${E(e.muscle)}</span><div class="scroll-table"><table><thead><tr><th>Serie</th><th>${ex.unit==='minutes'?'Minutos':'Kg'}</th><th>${ex.unit==='minutes'?'Km':ex.unit==='seconds'?'Segundos':'Reps'}</th>${ex.unit==='minutes'&&ex.exerciseId==='cardio-cinta'?'<th>Inclinación %</th>':''}</tr></thead><tbody>${ex.sets.filter(t=>t.done).map((set,si)=>`<tr><td>${si+1}</td><td>${ex.unit==='minutes'?fmtNum(set.minutes,2):set.load==null?'—':`${fmtNum(set.load)} kg`}</td><td>${ex.unit==='minutes'?fmtNum(set.distanceKm,2):fmtNum(set[ex.unit],2)}</td>${ex.unit==='minutes'&&ex.exerciseId==='cardio-cinta'?`<td>${fmtNum(set.inclinePct,1)}</td>`:''}</tr>`).join('')}</tbody></table></div></div>`;}).join('')}`);
}

function doExport(){const name=`NIVEL-respaldo-${madridToday()}.json`,data=JSON.stringify({...db,exportedAt:new Date().toISOString()},null,2),blob=new Blob([data],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Copia JSON descargada');}
async function doImport(file){
 if(!file)return;
 if(file.size>5_000_000){toast('El JSON supera 5 MB.',true);return;}
 try{
   const incoming=ensureData(JSON.parse(await file.text()));
   if(!confirm('Importar sustituirá los datos de este navegador. ¿Has guardado antes tu copia actual?'))return;
   let seed=null;
   try{const res=await fetch('./data.json',{cache:'no-store'});if(res.ok)seed=ensureData(await res.json());}catch(err){console.warn('No se pudo actualizar el banco al importar',err);}
   db=seed?mergeCatalog(incoming,seed):incoming;
   if(!persist())return;
   navigateTo('home');toast('Memoria JSON restaurada sin perder compatibilidad con versiones antiguas');
 }catch(err){toast(err.message||'Error al importar JSON',true);}
}
function chooseAvailableDays(avail, count){
 if(count===1)return [avail[Math.floor(avail.length/2)]];
 return Array.from({length:count},(_,i)=>avail[Math.round(i*(avail.length-1)/(count-1))]);
}
function generateRoutine(p){
 const n=p.sessionsPerWeek,chosen=chooseAvailableDays(p.availableDays,n),focus=p.focus,level=p.level;
 const types=n===1?['Full body'] : n===2?['Full body A','Full body B'] : n===3?['Full body A','Full body B','Full body C'] : n===4?['Torso A','Pierna A','Torso B','Pierna B'] : n===5?['Push','Pierna A','Pull','Torso B','Posterior + core'] : ['Push A','Pull A','Pierna A','Push B','Pull B','Pierna B'];
 const presets={
  'Full body':['prensa','press-pecho','jalon','peso-muerto-rumano','elev-lateral','dead-bug'],
  'Full body A':['prensa','press-pecho','jalon','curl-femoral','plancha'],
  'Full body B':['peso-muerto-rumano','press-inclinado-manc','remo-sentado','zancadas','crunch-suelo'],
  'Full body C':['prensa','press-hombro-maq','jalon-neutro','hip-thrust','plancha-lateral'],
  'Torso A':['press-pecho','jalon','press-hombro-maq','remo-sentado','elev-lateral','curl-biceps','triceps-polea'],
  'Torso B':['press-inclinado-maq','remo-alto','jalon-neutro','aperturas-polea','elev-lateral','curl-martillo','triceps-cuerda'],
  'Pierna A':['prensa','curl-femoral','extension-cuadriceps','gemelos','dead-bug','plancha'],
  'Pierna B':['peso-muerto-rumano','hip-thrust','zancadas','curl-femoral','gemelos','crunch-inverso'],
  'Push':['press-pecho','press-inclinado-manc','press-hombro-maq','elev-lateral','triceps-polea','flexiones'],
  'Push A':['press-pecho','press-inclinado-manc','press-hombro-maq','elev-lateral','triceps-polea'],
  'Push B':['press-inclinado-maq','press-pecho','elev-lateral','triceps-cuerda','flexiones'],
  'Pull':['jalon','remo-sentado','remo-alto','peck-inverso','curl-biceps','dead-bug'],
  'Pull A':['jalon','remo-sentado','peck-inverso','curl-biceps','plancha-lateral'],
  'Pull B':['jalon-neutro','remo-alto','facepull','curl-martillo','crunch-suelo'],
  'Posterior + core':['peso-muerto-rumano','hip-thrust','curl-femoral','zancadas','pallof','plancha'],
 };
 const focusExtras={
  equilibrado:[],definicion:['cardio-cinta'],musculo:['press-inclinado-manc','remo-manc'],
  fuerza:level==='avanzado'?['press-banca-barra','sentadilla-barra']:['press-pecho','prensa'],resistencia:['sentadilla-corporal','flexiones','mountain-climbers'],
  core:level==='avanzado'?['plancha-copenhague','elev-piernas-colgado','crunch-inverso']:['dead-bug','plancha','crunch-inverso'],
  gluteos:level==='principiante'?['puente-gluteo','abductores','hip-thrust']:['hip-thrust','bulgaras-manc','abductores'],piernas:['hack-squat-maquina','curl-femoral','gemelos'],
  espalda:level==='avanzado'?['dominadas','remo-barra','facepull']:['jalon','remo-sentado','facepull'],pecho:['press-banca','aperturas-polea','flexiones'],
  hombros:['elev-lateral-polea','press-hombro-maq','peck-inverso'],brazos:['curl-scott','triceps-cuerda','curl-martillo'],
  cardio:['cardio-cinta','bicicleta','remo-ergometro'],funcional:['sentadilla-goblet','step-up','bird-dog','movilidad-cadera']
 };
 const advancedReplacements={
  'prensa':'sentadilla-barra','press-pecho':'press-banca-barra','jalon':'dominadas-lastradas',
  'peso-muerto-rumano':'peso-muerto-barra','split-squat':'bulgaras-manc',
  'jalon-neutro':'dominadas','zancadas':'bulgaras-manc'
 };
 const cap=p.minutesPerSession<=35?4:p.minutesPerSession<=45?5:p.minutesPerSession<=60?6:p.minutesPerSession<=75?7:8;
 const old=activeRoutine(),allOld=Object.values(old.days).flatMap(day=>day.exercises||[]);
 const validIds=new Set(db.exercises.map(e=>e.id));
 const makeRx=(id,position)=>{
   const lib=exercise(id),prev=allOld.find(rx=>rx.exerciseId===id),actual=lastLoad(id),cardio=lib.unit==='minutes',body=lib.equipment==='Peso corporal';
   const sets=cardio?1:level==='principiante'?2:level==='avanzado'?(position<2&&!body?4:3):body?2:3;
   let low=cardio?(focus==='cardio'&&p.minutesPerSession<=45?10:20):lib.unit==='seconds'?30:focus==='fuerza'?4:focus==='resistencia'?12:body?10:8;
   let high=cardio?(focus==='cardio'&&p.minutesPerSession<=45?15:30):lib.unit==='seconds'?50:focus==='fuerza'?6:focus==='resistencia'?20:body?15:12;
   if(focus==='core' && lib.unit==='reps' && body){low=10;high=20;}
   return {exerciseId:id,sets,min:low,max:high,suggestedKg:cardio||body?null:actual??prev?.suggestedKg??null,perSide:['zancadas','split-squat','plancha-lateral','bulgaras-manc','plancha-copenhague'].includes(id),optional:cardio,notes:level==='avanzado'&&['dominadas-lastradas','sentadilla-barra','press-banca-barra','peso-muerto-barra'].includes(id)?'Variante avanzada: realiza solo si dominas la técnica.': ''};
 };
 const days={};for(let i=1;i<=7;i++)days[String(i)]={title:'Descanso y recuperación',rest:true,exercises:[]};
 chosen.forEach((weekday,i)=>{
   const title=types[i];let ids=[...(presets[title]||presets['Full body'])];
   if(level==='avanzado'&&focus!=='cardio'&&focus!=='funcional')ids=ids.map(id=>advancedReplacements[id]&&validIds.has(advancedReplacements[id])?advancedReplacements[id]:id);
   const extras=(focusExtras[focus]||[]).filter(id=>validIds.has(id));
   if(extras.length){
     // Keep the first two foundation exercises where possible and insert a targeted focus.
     const target=extras[i%extras.length];
     if(!ids.includes(target))ids.splice(Math.min(2,ids.length),0,target);
     const second=extras[(i+1)%extras.length];
     if(p.minutesPerSession>=75&&second&&!ids.includes(second))ids.push(second);
   }
   if(focus==='cardio'){ids=['cardio-cinta','bicicleta','remo-ergometro','plancha','movilidad-cadera',...ids].filter((id,i,a)=>a.indexOf(id)===i);}
   if(focus==='definicion' && p.minutesPerSession>=60 && !ids.includes('cardio-cinta'))ids.push('cardio-cinta');
   ids=[...new Set(ids)].filter(id=>validIds.has(id)).slice(0,cap);
   days[String(weekday)]={title,rest:false,exercises:ids.map(makeRx)};
 });
 const focusLabel=FOCUSES.find(x=>x[0]===focus)?.[1]||focus;
 return {id:uid(),name:`${focusLabel} · ${n} días · ${level} · ${madridToday()}`,createdAt:madridToday(),generated:true,days};
}
function plannerPrompt(){
 const form=document.getElementById('plannerForm');let p=db.planner;
 if(form){const fd=new FormData(form);p={availableDays:fd.getAll('availableDay').map(Number),sessionsPerWeek:Number(fd.get('sessionsPerWeek')),minutesPerSession:Number(fd.get('minutesPerSession')),focus:String(fd.get('focus')),level:String(fd.get('level'))};}return `Actúa como entrenador y propón una rutina segura de fuerza para NIVEL. Tengo disponibles ${p.availableDays.map(i=>DAYS[i]).join(', ')} y quiero entrenar ${p.sessionsPerWeek} días/semana, ${p.minutesPerSession} min/sesión. Experiencia ${p.level}. Objetivo principal ${p.focus}. Mis objetivos: ${db.goals.filter(g=>!g.done).map(g=>g.name+': '+(g.description||'')).join('; ')}. Rutina actual: ${activeRoutine().name}. Usa ejercicios de gimnasio accesibles, al menos 1 día de descanso, incluye series, repeticiones y progresión, evita inventar pesos de ejercicios que aún no registro. Dame una planificación de lunes a domingo en español.`;
}
async function copyPlannerPrompt(){
 const text=plannerPrompt();try{await navigator.clipboard.writeText(text);toast('Consulta copiada para ChatGPT');}
 catch(e){modal('Copia esta consulta para ChatGPT',`<textarea rows="12" readonly id="copyPrompt">${E(text)}</textarea><p class="small-note">Selecciona el texto y cópialo manualmente.</p>`);}
}
function doAction(target){const action=target.dataset.action,id=target.dataset.id,index=Number(target.dataset.index),exIdx=Number(target.dataset.ex);
  switch(action){
    case 'new-measure':measurementModal();break;
    case 'new-goal':goalModal();break;
    case 'edit-goal':goalModal(id);break;
    case 'delete-goal':if(confirm('¿Borrar este objetivo?')){db.goals=db.goals.filter(g=>g.id!==id);persist();render();toast('Objetivo eliminado');}break;
    case 'planner-open':plannerModal();break;
    case 'copy-ai-prompt':copyPlannerPrompt();break;
    case 'edit-measure':measurementModal(id);break;
    case 'delete-measure':if(confirm('¿Eliminar esta medición?')){db.measurements=db.measurements.filter(m=>m.id!==id);persist();render();toast('Medición eliminada');}break;
    case 'start-session':if(db.activeSession){toast('Termina primero tu sesión actual',true);break;}db.activeSession=makeSession(selectedDay);persist();renderKeepScroll();break;
    case 'free-session':if(db.activeSession){toast('Termina primero la sesión actual',true);break;}db.activeSession=makeSession(selectedDay,true);persist();renderKeepScroll();sessionAddModal();break;
    case 'session-add':sessionAddModal();break;
    case 'finish-exercise':{const ex=db.activeSession?.exercises[exIdx];if(!ex)break;
      const valid=ex.sets.filter(t=>validResult(ex,t));
      if(!valid.length){toast('Introduce reps, segundos o minutos/km en al menos una serie.',true);break;}
      for(const t of ex.sets){if(validResult(ex,t)){if(t.load!=null&&(t.load<0||t.load>1000)){toast('Revisa los kilos.',true);return;}t.done=true;}else t.done=false;}
      ex.completionOrder=1+Math.max(0,...db.activeSession.exercises.map(x=>x.completionOrder||0));ex.finishedAt=new Date().toISOString();
      persist();renderKeepScroll();toast(`Ejercicio ${ex.completionOrder} guardado`);break;}
    case 'reopen-exercise':{const ex=db.activeSession?.exercises[exIdx];if(!ex)break;ex.completionOrder=null;ex.finishedAt=null;persist();renderKeepScroll();break;}
    case 'finish-session':{
      const s=db.activeSession;if(!s)break;
      // If user filled series but forgot the per-exercise button, preserve those without demanding all planned exercises.
      let order=Math.max(0,...s.exercises.map(e=>e.completionOrder||0));
      for(const ex of s.exercises){
        if(ex.completionOrder==null){
          ex.sets.forEach(t=>{if(validResult(ex,t))t.done=true;});
          if(ex.sets.some(t=>t.done)){ex.completionOrder=++order;ex.finishedAt=new Date().toISOString();}
        }
      }
      const done=s.exercises.filter(ex=>ex.sets.some(t=>t.done));
      if(!done.length){toast('Registra al menos un ejercicio; puedes guardar solo lo que hayas hecho.',true);break;}
      for(const ex of done){for(const t of ex.sets.filter(t=>t.done)){if(!validResult(ex,t)){toast('Revisa las series completadas de '+ex.name,true);return;}}}
      s.status='completed';s.exercises=done.sort((a,b)=>(a.completionOrder??999)-(b.completionOrder??999));
      s.exercises.forEach(ex=>ex.sets=ex.sets.filter(t=>t.done));
      s.endedAt=new Date().toISOString();db.sessions.push(s);db.activeSession=null;
      persist();renderKeepScroll();toast('¡Sesión guardada con los ejercicios realizados y en su orden real!');break;
    }
    case 'cancel-session':if(confirm('¿Descartar la sesión en curso?')){db.activeSession=null;persist();render();}break;
    case 'add-set':{const ex=db.activeSession?.exercises[exIdx];if(!ex)break;if(ex.sets.length>=30){toast('Máximo 30 series',true);break;}const last=ex.sets.at(-1);ex.sets.push({id:uid(),load:last?.load??null,reps:null,seconds:null,minutes:null,distanceKm:null,inclinePct:null,rir:null,done:false});persist();renderKeepScroll();break;}
    case 'remove-set':{const ex=db.activeSession?.exercises[exIdx];if(ex&&ex.sets.length>1){ex.sets.pop();persist();renderKeepScroll();}break;}
    case 'session-detail':detailSession(id);break;
    case 'delete-session':if(confirm('¿Borrar esta sesión del historial?')){db.sessions=db.sessions.filter(s=>s.id!==id);persist();render();toast('Sesión borrada');}break;
    case 'routine-edit':routineModal(index);break;
    case 'routine-add':routineModal(-1,true);break;
    case 'routine-remove':if(confirm('¿Quitar este ejercicio del día?')){activeRoutine().days[String(selectedDay)].exercises.splice(index,1);persist();closeModal();render();}break;
    case 'routine-copy':{const current=activeRoutine(),name=prompt('Nombre de la nueva versión de rutina:',`${current.name} (versión nueva)`);if(!name?.trim())break;const copy=JSON.parse(JSON.stringify(current));copy.id=uid();copy.name=name.trim().slice(0,100);copy.createdAt=madridToday();db.routines.push(copy);db.activeRoutineId=copy.id;persist();render();toast('Nueva versión activada');break;}
    case 'routine-activate':if(db.routines.some(r=>r.id===id)){db.activeRoutineId=id;persist();render();toast('Rutina activada');}break;
    case 'exercise-detail':exerciseModal(id);break;
    case 'new-exercise':exerciseModal();break;
    case 'delete-exercise':{if(db.routines.some(r=>Object.values(r.days).some(d=>d.exercises.some(rx=>rx.exerciseId===id)))||db.sessions.some(s=>s.exercises.some(e=>e.exerciseId===id))){toast('Este ejercicio figura en alguna rutina o sesión; no se puede borrar.',true);break;}if(confirm('¿Eliminar ejercicio personalizado?')){db.exercises=db.exercises.filter(e=>e.id!==id);persist();closeModal();render();}}break;
    case 'export':doExport();break;
    case 'reset':if(confirm('Esta acción borra TODAS tus medidas, sesiones y cambios de rutina de este navegador. ¿Has exportado una copia JSON?')){if(confirm('Última confirmación: ¿borrar todos los datos locales?')){localStorage.removeItem(STORAGE_KEY);location.reload();}}break;
    case 'body-side':bodyViewSide=target.dataset.side==='BACK'?'BACK':'FRONT';renderKeepScroll();break;
    case 'load-detail':loadDetailModal(id);break;
    case 'choose-body-metric':chartMetric=target.dataset.metric;anatomySelectedId=null;renderKeepScroll();break;
    case 'goto-metric-chart':document.getElementById('measure-history-chart')?.scrollIntoView({behavior:'smooth',block:'start'});break;
    case 'close-modal':closeModal();break;
  }
}
function formSubmit(form){const fd=new FormData(form);if(form.id==='measureForm'){
 const date=String(fd.get('date')||'');if(!validDate(date)||date>madridToday()){toast('Selecciona una fecha válida, no futura.',true);return;}
 const m={id:form.dataset.id||uid(),date,notes:String(fd.get('notes')||'').trim().slice(0,1000),createdAt:new Date().toISOString()};let count=0;
 for(const [key,label,unit,min,max] of FIELDS){const v=num(fd.get(key));if(Number.isNaN(v)||(v!=null&&(v<min||v>max))){toast(`${label}: introduce un valor entre ${min} y ${max} ${unit}.`,true);return;}m[key]=v;if(v!=null)count++;}
 if(!count){toast('Escribe al menos el peso o una medida.',true);return;}
 const i=db.measurements.findIndex(x=>x.id===m.id);if(i>=0)m.createdAt=db.measurements[i].createdAt;
 if(i>=0)db.measurements[i]=m;else db.measurements.push(m);persist();closeModal();render();toast('Medición guardada correctamente');
 }else if(form.id==='profileForm'){
   const height=num(fd.get('heightCm')),weight=num(fd.get('referenceWeightKg'));
   if(Number.isNaN(height)||Number.isNaN(weight)||(height!=null&&(height<100||height>230))||(weight!=null&&(weight<25||weight>300))){toast('Comprueba altura y peso de referencia.',true);return;}
   db.profile={...db.profile,heightCm:height,referenceWeightKg:weight,gym:String(fd.get('gym')||'').slice(0,100)};persist();render();toast('Perfil guardado');
 }else if(form.id==='goalForm'){
   const id=form.dataset.id||uid(),name=String(fd.get('name')||'').trim(),targetDate=String(fd.get('targetDate')||''),metric=String(fd.get('metric')||'none'),targetValue=num(fd.get('targetValue'));
   if(!name||name.length>100||(targetDate&&!validDate(targetDate))||(!['none',...FIELDS.map(f=>f[0])].includes(metric))||Number.isNaN(targetValue)||(targetValue!=null&&(targetValue<0||targetValue>1000))){toast('Revisa los datos del objetivo.',true);return;}
   if(metric==='none'&&targetValue!=null){toast('Selecciona una medida o elimina el valor objetivo.',true);return;}
   const old=db.goals.find(g=>g.id===id),goal={id,name:name.slice(0,100),targetDate,metric,targetValue,description:String(fd.get('description')||'').slice(0,1000),done:fd.has('done'),createdAt:old?.createdAt||new Date().toISOString()};
   if(old)Object.assign(old,goal);else db.goals.push(goal);
   persist();closeModal();render();toast('Objetivo guardado');
 }else if(form.id==='sessionAddForm'){
   const exId=String(fd.get('exerciseId')||''),sets=Number(fd.get('sets'));if(!db.activeSession||!db.exercises.some(x=>x.id===exId)||!Number.isInteger(sets)||sets<1||sets>20){toast('Elige un ejercicio y un número válido de series.',true);return;}
   const found=exercise(exId);db.activeSession.exercises.push(makeSessionExercise(exId,found.unit==='minutes'?1:sets));persist();closeModal();renderKeepScroll();toast('Ejercicio añadido a la sesión');
 }else if(form.id==='plannerForm'){
   const available=[...fd.getAll('availableDay')].map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=7).sort((a,b)=>a-b),n=Number(fd.get('sessionsPerWeek')),
   minutes=Number(fd.get('minutesPerSession')),focus=String(fd.get('focus')||'equilibrado'),level=String(fd.get('level')||'intermedio');
   if(n<1||n>6||!Number.isInteger(n)||available.length<n||!VALID_FOCUSES.includes(focus)||!['principiante','intermedio','avanzado'].includes(level)||![35,45,60,75,90].includes(minutes)){
      toast('Marca al menos tantos días disponibles como sesiones activas (máximo 6).',true);return;
   }
   db.planner={availableDays:available,sessionsPerWeek:n,minutesPerSession:minutes,focus,level};
   if(!confirm('¿Crear y activar una NUEVA versión de rutina? Tu plan anterior y todo tu historial se conservarán.')){persist();return;}
   const proposal=generateRoutine(db.planner);db.routines.push(proposal);db.activeRoutineId=proposal.id;persist();closeModal();selectedDay=chooseAvailableDays(available,n)[0];navigateTo('training');toast('Nueva rutina generada. Revisa ejercicios y cargas antes de entrenar.');
 }else if(form.id==='routineForm'){
   const day=activeRoutine().days[String(selectedDay)],idx=Number(form.dataset.index),sets=Number(fd.get('sets')),min=Number(fd.get('min')),max=Number(fd.get('max')),load=num(fd.get('suggestedKg'));
   if(!db.exercises.some(e=>e.id===fd.get('exerciseId'))||!Number.isInteger(sets)||sets<1||sets>20||!Number.isInteger(min)||!Number.isInteger(max)||min<1||max>600||max<min||Number.isNaN(load)||(load!=null&&(load<0||load>500))){toast('Revisa series, repeticiones y kilos.',true);return;}
   const rx={exerciseId:String(fd.get('exerciseId')),sets,min,max,suggestedKg:load,notes:String(fd.get('notes')||'').slice(0,1000),perSide:fd.has('perSide'),optional:fd.has('optional')};if(idx<0){day.exercises.push(rx);if(day.rest){day.rest=false;day.title='Entrenamiento extra';}}else day.exercises[idx]=rx;persist();closeModal();render();toast('Rutina actualizada');
 }else if(form.id==='exerciseForm'){
   const name=String(fd.get('name')||'').trim(),instructions=String(fd.get('instructions')||'').trim(),muscle=String(fd.get('muscle')||'').trim();if(name.length<2||!muscle||!instructions){toast('Completa nombre, grupo muscular y técnica.',true);return;}
   db.exercises.push({id:uid(),name:name.slice(0,100),muscle:muscle.slice(0,40),equipment:String(fd.get('equipment')),unit:String(fd.get('unit')),loadUnit:String(fd.get('loadUnit')),instructions:instructions.slice(0,1000),level:['Principiante','Intermedio','Avanzado'].includes(String(fd.get('level')))?String(fd.get('level')):'Principiante',custom:true});persist();closeModal();render();toast('Ejercicio añadido al banco');
 }}
function filterLibrary(){const level=document.getElementById('levelFilter')?.value||'Todos';const q=(document.getElementById('exerciseSearch')?.value||'').trim().toLowerCase(),muscle=document.getElementById('muscleFilter')?.value||'Todos';document.querySelectorAll('[data-library-item]').forEach(el=>{el.hidden=!(el.dataset.text.includes(q)&&(muscle==='Todos'||el.dataset.muscle===muscle)&&(level==='Todos'||el.dataset.level===level));});}
window.addEventListener('hashchange',()=>{const next=viewFromHash();if(view!==next){view=next;closeModal();render();window.scrollTo(0,0);}});
document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-nav]');if(nav){navigateTo(nav.dataset.nav);return;}
 const day=e.target.closest('[data-day]');if(day){selectedDay=Number(day.dataset.day);render();return;}
 const a=e.target.closest('[data-action]');if(a){e.preventDefault();doAction(a);}
 if(e.target.classList.contains('modal-backdrop'))closeModal();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&showingModal)closeModal();if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-body-metric]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
document.addEventListener('submit',e=>{if(['measureForm','profileForm','routineForm','exerciseForm','goalForm','sessionAddForm','plannerForm'].includes(e.target.id)){e.preventDefault();formSubmit(e.target);}});
document.addEventListener('change',e=>{
 if(e.target.id==='chartMetric'){chartMetric=e.target.value;render();return;}
 if(e.target.id==='muscleFilter'||e.target.id==='levelFilter'){filterLibrary();return;}
 if(e.target.id==='importFile'){doImport(e.target.files[0]);e.target.value='';return;}
 if(e.target.hasAttribute('data-session-date')){const date=e.target.value;if(validDate(date)&&date<=madridToday()){db.activeSession.date=date;persist();}else{toast('Fecha de sesión no válida.',true);render();}return;}
 if(e.target.hasAttribute('data-set-done')){const ex=db.activeSession?.exercises[Number(e.target.dataset.ex)],set=ex?.sets[Number(e.target.dataset.set)];if(!set)return;if(e.target.checked&&!validResult(ex,set)){toast('Introduce las repeticiones, el tiempo o los km antes de marcar la serie.',true);e.target.checked=false;return;}set.done=e.target.checked;persist();renderKeepScroll();}
});
document.addEventListener('input',e=>{
 if(e.target.id==='exerciseSearch'){filterLibrary();return;}
 if(e.target.id==='loadsSearch'){const q=e.target.value.toLocaleLowerCase('es').trim();document.querySelectorAll('[data-load-item]').forEach(el=>{el.hidden=!el.dataset.text.includes(q);});return;}
 if(e.target.id==='sessionCatalogSearch'){
   const q=e.target.value.trim().toLocaleLowerCase('es');const select=document.getElementById('sessionExerciseSelect');
   if(select){[...select.options].forEach(o=>{o.hidden=!o.dataset.text.includes(q);});const first=[...select.options].find(o=>!o.hidden);if(first)select.value=first.value;}
   return;
 }
 const el=e.target;if(!el.hasAttribute('data-set-field')||!db.activeSession)return;
 const ex=db.activeSession.exercises[Number(el.dataset.ex)],set=ex?.sets[Number(el.dataset.set)];if(!set)return;
 const field=el.dataset.setField,v=num(el.value);if(Number.isNaN(v)||(v!=null&&(v<0||v>(field==='minutes'?600:field==='distanceKm'?200:field==='inclinePct'?40:1000))))return;
 set[field]=v;persist();
});
init();
