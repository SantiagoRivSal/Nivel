import {exerciseSearchRecord,exerciseSearchScore} from './domain/exercise-search.js';
import {DAY_AREAS,AREA_LABELS,AREA_GROUPS,GOAL_GROUPS,GOAL_LABELS,FOCUS_GROUPS,FOCUS_AREAS,focusGoal,weeklyAreas,generateDay,mergeDayProposal} from './domain/day-planner.js';
import {WEEK,createRoutineDraft,moveDraftExercise,setDraftExercise,removeDraftExercise,buildSavedRoutine} from './domain/routine-draft.js';
import {interpretRequest,filterRequestedCatalog,adjustDay} from './domain/local-coach.js';
/* NIVEL — app estática para GitHub Pages. Persistencia: localStorage + copias JSON.
   GitHub Pages NO puede modificar data.json ni sincronizar dispositivos. */
const STORAGE_KEY = 'nivel_fitness_data_v1';
const APP_VERSION = 4;
// Accent preference is part of the existing personal backup, not a new schema.
const THEMES = Object.freeze({verde:'Verde',azul:'Azul',rosa:'Rosa',amarillo:'Amarillo'});
const validTheme = value => typeof value==='string' && Object.hasOwn(THEMES,value);
const currentTheme = () => validTheme(db?.profile?.theme) ? db.profile.theme : 'verde';
function applyTheme(){document.documentElement.dataset.theme=currentTheme();}
function changeTheme(value){
  if(!validTheme(value))return;
  const previous=currentTheme();
  db.profile.theme=value;
  if(!persist()){
    db.profile.theme=previous;
    const selected=document.querySelector(`input[name="appTheme"][value="${previous}"]`);
    if(selected)selected.checked=true;
    return;
  }
  applyTheme();
  const status=document.getElementById('themeStatus');
  if(status)status.textContent=`Color activo: ${THEMES[value]}.`;
}
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
const VALID_VIEWS = ['home','training','progress','library','profile','measurements','sessions','loads','plan','workout','workout-exercise','routines','goals','personal','backup','composition','body','charts','appearance','custom-session','session-templates'];
const viewFromHash = () => {const candidate=location.hash.replace(/^#\/?/, '').split('/')[0];return VALID_VIEWS.includes(candidate)?candidate:'home';};
let view = viewFromHash();
let chartMetric = 'waistCm';
// Vistas de detalle separadas: nunca se expanden listados dentro del panel principal.
const PARENT_VIEW = {measurements:'progress',sessions:'training',loads:'training',plan:'training',workout:'training','workout-exercise':'training',routines:'training',goals:'profile',personal:'profile',backup:'profile',appearance:'profile','custom-session':'training','session-templates':'training',composition:'progress',body:'progress',charts:'progress'};
let bodyViewSide = 'FRONT';
let bodyChart = null;
let anatomySelectedId = null;
let showingModal = false;
let workoutExerciseId=view==='workout-exercise'?decodeWorkoutId():null;
function decodeWorkoutId(){try{return decodeURIComponent(location.hash.replace(/^#\/?/, '').split('/')[1]||'');}catch{return '';}}
let libraryPage=1;
let libraryFilters={q:'',muscle:'Todos',level:'Todos',brand:'Todas',open:false};
const FOCUSES = FOCUS_GROUPS.flatMap(([,rows])=>rows);
function groupedOptions(groups,selected){return groups.map(([title,rows])=>`<optgroup label="${E(title)}">${rows.map(([v,l])=>`<option value="${E(v)}" ${v===selected?'selected':''}>${E(l)}</option>`).join('')}</optgroup>`).join('');}
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
const activeRoutine = () => db.routines.find(r=>r.id===db.activeRoutineId)||db.routines[0]||{id:null,name:'Sin rutina activa',days:{}};
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
  if(!obj.routines.every(r=>r.days && typeof r.days==='object'))
    throw new Error('Faltan las rutinas en el archivo.');
  const d=JSON.parse(JSON.stringify(obj));
  d.schemaVersion=APP_VERSION;
  d.profile.theme=validTheme(d.profile.theme)?d.profile.theme:'verde';
  if(!Array.isArray(d.goals)) {
    d.goals=d.profile.goalName ? [{id:uid(),name:d.profile.goalName,description:d.profile.goal||'',targetDate:d.profile.goalDate||'',metric:'none',targetValue:null,createdAt:new Date().toISOString(),done:false}] : [];
  }
  if(!d.planner || !Array.isArray(d.planner.availableDays)) d.planner={availableDays:[1,2,3,5,6],sessionsPerWeek:5,focus:'equilibrado',minutesPerSession:65,level:'intermedio'};
  d.goals=d.goals.filter(x=>x&&typeof x==='object'&&typeof x.name==='string').slice(0,100);
  d.routines.forEach(r=>Object.entries(r.days).forEach(([dayNo,day])=>{
    if(!Array.isArray(day.exercises))day.exercises=[];
    if(typeof day.rest!=='boolean')day.rest=day.exercises.length===0;
  }));
  d.routines.forEach(r=>{for(let i=1;i<=7;i++)if(!r.days[i])r.days[i]={title:'Descanso',rest:true,exercises:[]};});
  if(!d.routines.some(r=>r.id===d.activeRoutineId))d.activeRoutineId=d.routines[0]?.id??null;
  if(!Array.isArray(d.movementCatalog))d.movementCatalog=[];
  if(!Array.isArray(d.machineReferenceCatalog))d.machineReferenceCatalog=[];
  if(!d.machineAvailability||typeof d.machineAvailability!=='object'||Array.isArray(d.machineAvailability))d.machineAvailability={};
  if(d.activeSession && !Array.isArray(d.activeSession.exercises))d.activeSession=null;
  d.sessionTemplates=Array.isArray(d.sessionTemplates)?d.sessionTemplates.filter(t=>t&&typeof t.name==='string'&&Array.isArray(t.exercises)).slice(0,100):[];
  d.sessionDraft=d.sessionDraft&&typeof d.sessionDraft.name==='string'&&Array.isArray(d.sessionDraft.exercises)?d.sessionDraft:null;
  return d;
}
function isSelectable(e){return !!e && !e.archived && (!e.brand || modelOptions(e).some(v=>v.exerciseId===e.id && machineStatus(v)!=='no_disponible'));}
function activeExercises(){return db.exercises.filter(isSelectable);}
function isActiveExercise(id){return isSelectable(db.exercises.find(e=>e.id===id));}
function inventoryExercises(){return db.exercises.filter(e=>!e.archived);}
function mergeCatalog(current,defaults){
 if(defaults.catalogInfo?.inventoryRevision){
  const active=new Map(defaults.exercises.map(e=>[e.id,e]));
  for(const own of current.exercises){
   const fresh=active.get(own.id);
   if(!fresh){own.archived=!(own.custom && !own.brand && ['Peso corporal','Mancuernas','Barra','Polea','Otro'].includes(own.equipment));if(!own.archived){own.machineVariants=[];own.materialOptions=(own.materialOptions||[]).filter(m=>!['Máquina','Máquina Smith','Máquina asistida','Máquina cardio','Cardio','Cinta de correr','Bicicleta'].includes(m));}continue;}
   // Preserve edited labels/instructions only if the actual modality and load match.
   const compatible=own.equipment===fresh.equipment && own.unit===fresh.unit && own.loadUnit===fresh.loadUnit && (own.brand||'')===(fresh.brand||'');
   if(compatible && own.userEdited){const {name,instructions,level}=own;Object.assign(own,structuredClone(fresh),{name:fresh.brand?fresh.name:name,instructions,level,userEdited:true,archived:false});}
   else{if(!compatible && (current.sessions.some(s=>s.exercises?.some(x=>x.exerciseId===own.id))||current.activeSession?.exercises?.some(x=>x.exerciseId===own.id))){own.archived=true;active.delete(own.id);continue;}Object.assign(own,structuredClone(fresh),{archived:false});}
   own.machineVariants=structuredClone(fresh.machineVariants||[]);own.materialOptions=structuredClone(fresh.materialOptions||[fresh.equipment]);
   active.delete(own.id);
  }
  current.exercises.push(...[...active.values()].map(e=>structuredClone(e)));
  current.movementCatalog=structuredClone(defaults.movementCatalog);current.machineReferenceCatalog=structuredClone(defaults.machineReferenceCatalog||[]);current.catalogInfo=structuredClone(defaults.catalogInfo);
  return current;
 }

  const known=new Map(current.exercises.map(e=>[e.id,e]));
  for(const ex of defaults.exercises){
    if(!known.has(ex.id)){current.exercises.push(ex);continue;}
    // Update only built-in labels and capabilities. Never alter custom exercises or session history.
    const own=known.get(ex.id);
    if(!own.custom && !own.userEdited){
      for(const field of ['name','muscle','equipment','unit','loadUnit','supportsDistance','instructions','level','brand','machineLine','movementGroup','catalogVerified','materialOptions','machineVariants','modelName','modelCode','sourceGroupId','levelEstimated']){
        if(Object.hasOwn(ex,field)) own[field]=ex[field];
      }
    }
  }
  if(defaults.movementCatalog?.length)current.movementCatalog=defaults.movementCatalog;
  if(defaults.machineReferenceCatalog)current.machineReferenceCatalog=defaults.machineReferenceCatalog;
  if(defaults.catalogInfo)current.catalogInfo=defaults.catalogInfo;
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
function navigateTo(name){if(!VALID_VIEWS.includes(name))return;view=name;closeModal();const path=`/${name}${name==='workout-exercise'&&workoutExerciseId?'/'+encodeURIComponent(workoutExerciseId):''}`;if(location.hash!==`#${path}`)location.hash=path;render();window.scrollTo(0,0);}

function navItem(name,label,icon) {return `<button class="nav-btn ${(PARENT_VIEW[view]||view)===name?'active':''}" data-nav="${name}" aria-label="${label}"><span class="nav-icon">${icon}</span>${label}</button>`;}
function bottomItem(name,label,icon) {return `<button class="bottom-btn ${(PARENT_VIEW[view]||view)===name?'active':''}" data-nav="${name}" aria-label="${label}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`;}
function render(){
  applyTheme();
  const titles={home:'Inicio',training:'Entrenar',progress:'Progreso',library:'Ejercicios',profile:'Perfil',measurements:'Todas las mediciones',sessions:'Historial de sesiones',loads:'Cargas utilizadas',plan:'Plan semanal',workout:'Sesión en curso','workout-exercise':'Registrar ejercicio',routines:'Mis rutinas',goals:'Objetivos',personal:'Datos personales',backup:'Copias de seguridad',composition:'Composición corporal',body:'Medidas corporales',charts:'Evolución',appearance:'Apariencia','custom-session':'Crear sesión','session-templates':'Mis sesiones'};
  document.title=`${titles[view]} · NIVEL`;
  document.getElementById('app').innerHTML=`<div class="app-shell">
    <aside class="sidebar"><div class="side-brand">NIVEL<b>.</b></div><nav class="nav-list">${navItem('home','Inicio','⌂')}${navItem('training','Entrenar','◈')}${navItem('progress','Progreso','↗')}${navItem('library','Ejercicios','▤')}${navItem('profile','Perfil','◉')}</nav><div class="side-foot"><small>ENTRENA. REGISTRA. EVOLUCIONA.</small><div class="fineprint">Datos guardados en este navegador. Haz copias JSON desde Perfil.</div></div></aside>
    <main class="workspace"><div class="mobile-header"><div class="brand">NIVEL<b>.</b></div><span class="pill green">Tu progreso</span></div><div class="topbar"><span class="today">${niceDate(madridToday())} · Fitness Park</span><span class="pill green">PLAN PERSONAL</span></div>
     ${view==='home'?homeHTML():view==='training'?trainingHTML():view==='progress'?progressHTML():view==='library'?libraryHTML():view==='measurements'?measurementsPageHTML():view==='sessions'?sessionsPageHTML():view==='loads'?loadsPageHTML():view==='plan'?planPageHTML():view==='workout'?workoutPageHTML():view==='workout-exercise'?workoutExercisePageHTML():view==='routines'?routinesPageHTML():view==='goals'?goalsPageHTML():view==='personal'?personalPageHTML():view==='backup'?backupPageHTML():view==='appearance'?appearancePageHTML():view==='custom-session'?customSessionHTML():view==='session-templates'?templatesHTML():view==='composition'?subpageHeader('Composición corporal','','progress')+compositionHTML():view==='body'?subpageHeader('Medidas corporales','','progress')+bodyHTML():view==='charts'?chartsPageHTML():profileHTML()}
    </main><nav class="bottomnav">${bottomItem('home','Inicio','⌂')}${bottomItem('training','Entrenar','◈')}${bottomItem('progress','Progreso','↗')}${bottomItem('library','Ejercicios','▤')}${bottomItem('profile','Perfil','◉')}</nav></div>`;
  if(view==='library'){for(const [id,key] of [['exerciseSearch','q'],['muscleFilter','muscle'],['levelFilter','level'],['brandFilter','brand']]){const el=document.getElementById(id);if(el)el.value=libraryFilters[key];}const details=document.querySelector('#exerciseSearch')?.parentElement.querySelector('details');if(details)details.open=libraryFilters.open;filterLibrary(false);}
  if(view==='body')requestAnimationFrame(mountBodyMap);
  else destroyBodyMap();
}
function menuLink(title,subtitle,attrs,icon='›'){return `<button type="button" class="section-link" ${attrs}><span class="section-link-icon" aria-hidden="true">${icon}</span><span class="section-link-copy"><strong>${E(title)}</strong>${subtitle?`<small>${E(subtitle)}</small>`:''}</span><span class="section-link-chevron" aria-hidden="true">›</span></button>`;}
function menuGroup(content){return `<div class="section-menu">${content}</div>`;}
function modalBack(attrs,label='Volver'){return `<button type="button" class="btn ghost small modal-back" ${attrs}>← ${E(label)}</button>`;}
function pageBack(parent,label){return `<button class="btn ghost small page-back" data-nav="${parent}">← ${E(label)}</button>`;}
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
 const w=newestMetric('weightKg'),c=newestMetric('waistCm'),plan=activeRoutine(),day=plan.days[madridWeekday(madridToday())],goal=activeGoals()[0];
 return `${header('Inicio',niceDate(madridToday()))}<div class="card glow hero"><div class="eyebrow">HOY</div><h2>${E(db.activeSession?'Sesión en curso':day?.title||'Tu entrenamiento')}</h2><p>${E(plan.name)}</p><button class="btn primary" data-nav="${db.activeSession?'workout':'training'}">${db.activeSession?'Continuar sesión':'Entrenar'}</button></div><div class="grid2 home-stats section">${stat('Peso actual',w?fmtNum(w.weightKg)+' kg':'—')}${stat('Cintura',c?fmtNum(c.waistCm)+' cm':'—')}</div><section class="section"><h2>Accesos rápidos</h2>${menuGroup(menuLink('Nueva medición','Registra peso o medidas','data-action="new-measure"','＋')+menuLink('Crear rutina','Manual o asistente NIVEL','data-action="routine-create"','＋')+menuLink('Mis rutinas',`${db.routines.length} guardadas`,'data-nav="routines"','◈')+menuLink('Mi progreso','Gráficas y composición','data-nav="progress"','↗')+menuLink('Objetivos',goal?goal.name:'Define tu próximo objetivo','data-nav="goals"','◎'))}</section>`;
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
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="100%" stop-color="var(--accent)" stop-opacity=".01"/></linearGradient></defs>
  ${grid}<path d="${area}" fill="url(#${gid})"/><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
  ${nums.map(([px,py],i)=>`<circle cx="${px}" cy="${py}" r="4.4" fill="#0c171d" stroke="var(--accent)" stroke-width="2.6"><title>${niceDate(points[i].date)} · ${fmtNum(vals[i],2)} ${field[2]}</title></circle>`).join('')}
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
     script.onload=()=>{if(view==='body')mountBodyMap();};
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

function trainingHTML(){const plan=activeRoutine(),day=plan.days[madridWeekday(madridToday())],sess=db.activeSession;
 return `${header('Entrenar','Elige qué quieres hacer.')}<div class="card glow"><div class="eyebrow">HOY · ${E(DAYS[madridWeekday(madridToday())])}</div><h2>${E(sess?sess.title:day?.title||'Sin rutina activa')}</h2><p class="muted">${E(sess?'Tienes un entrenamiento pendiente de guardar.':plan.name)}</p><button class="btn primary block" ${sess?'data-nav="workout"':'data-action="today-plan"'}>${sess?'Continuar sesión':'Ver plan de hoy'}</button></div><section class="section">${menuGroup(menuLink('Plan semanal','Consulta los ejercicios por día','data-nav="plan"','▦')+menuLink('Crear rutina','Manual o asistente NIVEL','data-action="routine-create"','＋')+menuLink('Mis rutinas',`${db.routines.length} versiones`,'data-nav="routines"','◈')+menuLink('Crear sesión personalizada','Elige ejercicios, orden y objetivos','data-nav="custom-session"','＋')+menuLink('Mis sesiones personalizadas',`${db.sessionTemplates.length} plantillas`,'data-nav="session-templates"','▤')+menuLink('Asistente NIVEL','Planifica una semana con el asistente local','data-action="planner-open"','✦')+(!sess?menuLink('Sesión libre','Entrena sin seguir un plan','data-action="free-session"','＋'):'')+menuLink('Historial de sesiones',`${db.sessions.filter(s=>s.status==='completed').length} sesiones`,'data-nav="sessions"','◷')+menuLink('Mis cargas','Consulta tus pesos registrados','data-nav="loads"','↗'))}</section>`;
}
function planPageHTML(){const plan=activeRoutine(),day=plan.days[selectedDay]||{title:'Sin plan',exercises:[],rest:true};return `${pageBack('training','Entrenar')}${header('Plan semanal',plan.name)}${plan.id?`<div class="day-list">${[1,2,3,4,5,6,7].map(i=>`<button class="day-chip ${selectedDay===i?'selected':''}" data-day="${i}"><small>${DAYS[i]}</small><b>${plan.days[i]?.rest?'Desc.':i}</b></button>`).join('')}</div><h2 class="section">${E(day.title)}</h2>${db.activeSession?'<button class="btn primary block" data-nav="workout">Continuar sesión en curso</button>':day.rest?'<button class="btn block" data-action="free-session">Iniciar sesión libre</button>':'<button class="btn primary block" data-action="start-session">▶ Iniciar entrenamiento</button>'}<div class="section stack">${day.exercises.map((rx,i)=>exerciseRow(rx,i)).join('')||'<p class="muted">No hay ejercicios para este día.</p>'}</div><div class="section">${menuGroup(menuLink('Añadir ejercicio','Modificar este día','data-action="routine-add"','＋')+menuLink('Editar rutina','Nombre, días y ejercicios',`data-action="routine-manage" data-id="${E(plan.id)}"`,'✎'))}</div>`:'<div class="card empty"><strong>No tienes una rutina activa</strong><button class="btn primary" data-action="routine-create">Crear rutina</button></div>'}`;}
function workoutPageHTML(){const s=db.activeSession;if(!s)return `${pageBack('training','Entrenar')}${header('Entrenamiento')}<p class="muted">No hay una sesión en curso.</p><button class="btn primary block" data-nav="plan">Ver plan semanal</button>`;return `${pageBack('training','Entrenar')}${header('Sesión en curso',s.title)}${sessionHTML(s)}`;}
function workoutExercisePageHTML(){const s=db.activeSession,ex=s?.exercises.find(x=>x.id===workoutExerciseId);if(!ex)return `${pageBack('workout','Sesión')}${header('Registrar ejercicio')}<p class="muted">Selecciona un ejercicio de la sesión.</p>`;return `${pageBack('workout','Lista de ejercicios')}${header('Registrar ejercicio')}${ex.target?`<div class="card"><strong>Objetivo: ${E(targetText(ex.target))}</strong>${ex.target.notes?`<p class="muted">${E(ex.target.notes)}</p>`:''}</div><div class="section"></div>`:''}${sessionExerciseHTML(s,ex,ex.completionOrder||0)}${ex.completionOrder==null&&!ex.sets.some(t=>t.done||validResult(ex,t))?`<button class="btn danger block section" data-action="custom-active-remove" data-id="${E(ex.id)}">Quitar ejercicio de esta sesión</button>`:''}`;}
function exerciseRow(rx,i,routineId=activeRoutine().id,dayNo=selectedDay,fromManager=false){const e=exercise(rx.exerciseId),attrs=`data-id="${E(routineId)}" data-weekday="${dayNo}" data-index="${i}" data-manager="${fromManager?'1':'0'}"`;return `<button class="section-link plan-exercise" data-action="routine-exercise-detail" ${attrs}><span class="section-link-icon">${i+1}</span><span class="section-link-copy"><strong>${E(e.name)}</strong><small>${E(e.muscle)} · ${rx.sets} × ${rx.min}${rx.max!==rx.min?'–'+rx.max:''} ${unitLabel(e.unit,rx.perSide)}</small>${compactMachine(e)}</span><span class="section-link-chevron">›</span></button>`;}
function compactMachine(e){if(!isActiveExercise(e.id))return '<small class="compact-machine">Fuera del inventario activo · sustituir</small>';const all=modelOptions(e),models=all.filter(v=>machineStatus(v)!=='no_disponible'),best=all.find(v=>v.exerciseId===e.id)||models[0];return `<small class="compact-machine">${E(best&&['Máquina','Cardio'].includes(e.equipment)?`${best.marca} · ${best.modelo} · ${statusLabel(best)}${models.filter(v=>v.key!==best.key).length?' · +'+models.filter(v=>v.key!==best.key).length+' alternativas':''}`:e.equipment)}</small>`;}
function routineExerciseDetail(r,k,i,manager=false){const rx=r?.days[k]?.exercises[i];if(!rx)return;const e=exercise(rx.exerciseId),attrs=contextAttrs(r,k,i,manager);modal(e.name,`${manager?modalBack(`data-action="routine-day" data-id="${E(r.id)}" data-weekday="${k}"`,FULL_DAYS[k]):''}<div class="card"><div class="library-card-meta">${exerciseMeta(e)}</div><h2 class="section">${rx.sets} × ${rx.min}${rx.max!==rx.min?'–'+rx.max:''} ${unitLabel(e.unit,rx.perSide)}</h2><p>${['Sin carga','Peso corporal'].includes(e.loadUnit)||e.unit==='minutes'?'Sin carga':E(suggestedLoad(rx))}</p>${rx.notes?`<p>${E(rx.notes)}</p>`:''}</div><div class="section">${equipmentAdvice(e,r.id,k,i,manager)}</div>${menuGroup(menuLink('Editar ejercicio del plan','Series, repeticiones y carga',`data-action="routine-edit" ${attrs}`,'✎')+menuLink('Ficha del ejercicio','Técnica e instrucciones',`data-action="exercise-detail" data-id="${E(e.id)}"`,'▤'))}`);}
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
 return {id:uid(),date:madridToday(),day:dayId,routineId:free?null:activeRoutine().id,title:free?`Sesión libre · ${DAYS[dayId]}`:day.title,status:'in_progress',startedAt:new Date().toISOString(),exercises:free?[]:day.exercises.map(rx=>({...makeSessionExercise(rx.exerciseId,rx.sets,rx.perSide,rx.suggestedKg),target:structuredClone(rx)}))};
}
function makeSessionExercise(exerciseId,sets=3,perSide=false,suggestedKg=null){
 const e=exercise(exerciseId),previous=lastLoad(e.id);
 return {id:uid(),exerciseId:e.id,name:e.name,brand:e.brand||'',machineLine:e.machineLine||'',modelName:e.modelName||'',loadUnit:e.loadUnit,unit:e.unit,perSide,finishedAt:null,completionOrder:null,sets:Array.from({length:sets},(_,i)=>({id:uid(),load:e.unit==='minutes'||e.loadUnit==='Sin carga'||e.loadUnit==='Peso corporal'?null:(i===0?(previous??suggestedKg??null):(suggestedKg??null)),reps:null,seconds:null,minutes:null,distanceKm:null,inclinePct:null,rir:null,done:false}))};
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
 if(ex.unit==='minutes')return `<div class="set-row-flex ${set.done?'completed':''}"><b class="set-number">${si+1}</b>${f('minutes','Min','decimal')}${e.supportsDistance?f('distanceKm','km','decimal'):''}${ex.exerciseId==='cardio-cinta'?f('inclinePct','Inclinación %','decimal'):''}</div>`;
 const bodyweight=e.equipment==='Peso corporal'||e.loadUnit==='Sin carga'||e.loadUnit==='Peso corporal';
 const weightLabel=e.loadUnit==='Por lado'?'Kg/lado':e.loadUnit==='Por mancuerna'?'Kg/manc.':'Kg';
 return `<div class="set-row-flex ${set.done?'completed':''}"><b class="set-number">${si+1}</b>${!bodyweight?f('load',weightLabel):''}${f(ex.unit,ex.unit==='seconds'?'Segundos':'Reps','decimal')}${f('rir','RIR','numeric')}</div>`;
}
function sessionExerciseHTML(s,ex,orderNo){
 const ei=s.exercises.findIndex(x=>x.id===ex.id),finished=ex.completionOrder!=null,
 count=ex.sets.filter(t=>t.done).length,e=exercise(ex.exerciseId),name=e.name==='Ejercicio eliminado'?ex.name:e.name;
 return `<div class="card session-exercise ${finished?'exercise-finished':''}" data-session-card="${E(ex.id)}"><div class="row-between wrap"><div class="row"><span class="number ${finished?'finished-number':''}">${finished?orderNo:'·'}</span><div><div class="set-title">${E(name)}</div>${e.brand?`<small>${E([e.brand,e.machineLine,e.modelName].filter(Boolean).join(' · '))}</small><br>`:''}<span class="muscle-tag">${E(e.muscle)}</span> <small>· ${finished?`${count} series guardadas · orden real ${orderNo}`:`${unitLabel(ex.unit,ex.perSide)} · pendiente`}</small></div></div><span class="pill ${finished?'green':''}">${finished?'HECHO':'POR HACER'}</span></div>
 ${!finished?`<div class="set-list">${ex.sets.map((set,si)=>setInputs(ex,set,ei,si)).join('')}</div><div class="row-between wrap session-tools"><button class="btn small ghost" data-action="add-set" data-ex="${ei}">+ Serie</button><button class="btn small ghost" data-action="remove-set" data-ex="${ei}">− Última serie</button><button class="btn primary" data-action="finish-exercise" data-ex="${ei}">✓ Guardar este ejercicio</button></div>`:`<div class="exercise-result-box">${ex.sets.filter(t=>t.done).map((t,idx)=>`<div class="exercise-result-line"><strong>Serie ${idx+1}</strong><span>${ex.unit==='minutes'?`${fmtNum(t.minutes)} min${t.distanceKm!=null?` · ${fmtNum(t.distanceKm,2)} km`:''}${t.inclinePct!=null?` · ${fmtNum(t.inclinePct,1)}%`:''}`:`${fmtNum(t[ex.unit])} ${unitLabel(ex.unit)}${t.load!=null?` · ${fmtNum(t.load)} kg`:''}${t.rir!=null?` · RIR ${fmtNum(t.rir,0)}`:''}`}</span></div>`).join('')}</div><div class="session-tools session-tools-finished"><button class="btn block" data-action="reopen-exercise" data-ex="${ei}">Editar ejercicio</button></div>`}</div>`;
}
function sessionHTML(s){const all=orderedSessionExercises(s),done=all.filter(e=>e.completionOrder!=null),pending=all.filter(e=>e.completionOrder==null);const row=(ex,i)=>{const e=exercise(ex.exerciseId);return menuLink(ex.name||e.name,`${ex.completionOrder!=null?'Hecho · ':'Pendiente · '}${ex.sets.filter(t=>t.done).length}/${ex.sets.length} series${e.brand?' · '+e.brand:''}`,`data-action="open-workout-exercise" data-id="${E(ex.id)}"`,ex.completionOrder!=null?'✓':String(i+1));};return `<div class="card"><div class="row-between"><strong>${done.length} de ${all.length} ejercicios</strong><span class="pill green">En curso</span></div><div class="bar-track"><div class="bar" style="width:${all.length?done.length/all.length*100:0}%"></div></div></div><div class="section"><h2>Pendientes</h2>${pending.length?menuGroup(pending.map(row).join('')):'<p class="muted">No hay ejercicios pendientes.</p>'}<button class="btn block section" data-action="session-add">+ Añadir ejercicio</button></div>${done.length?`<section class="section"><h2>Completados</h2>${menuGroup(done.map(row).join(''))}</section>`:''}<button class="btn primary block section" data-action="finish-session">Guardar entrenamiento</button><details class="secondary-details section"><summary>Opciones de sesión</summary><label class="field section"><span class="label">Fecha</span><input type="date" data-session-date value="${E(s.date)}" max="${madridToday()}"></label><button class="btn danger block section" data-action="cancel-session">Descartar sesión</button></details>`;}
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
function progressHTML(){const w=newestMetric('weightKg'),c=newestMetric('waistCm');return `${header('Progreso','Consulta una sección o registra una medición.')}<div class="grid2 home-stats">${stat('Peso',w?fmtNum(w.weightKg)+' kg':'—')}${stat('Cintura',c?fmtNum(c.waistCm)+' cm':'—')}</div><button class="btn primary block section" data-action="new-measure">+ Nueva medición</button><section class="section">${menuGroup(menuLink('Composición corporal','Peso, grasa y masa libre de grasa','data-nav="composition"','◉')+menuLink('Medidas corporales','Mapa anatómico y perímetros','data-nav="body"','◎')+menuLink('Evolución','Gráficas por medida','data-nav="charts"','↗')+menuLink('Historial de mediciones',`${db.measurements.length} registros`,'data-nav="measurements"','◷'))}</section>`;}
function chartsPageHTML(){const met=FIELDS.find(f=>f[0]===chartMetric);return `${pageBack('progress','Progreso')}${header('Evolución')}<section id="measure-history-chart" class="card section"><div class="row-between wrap"><div><div class="eyebrow">HISTÓRICO</div><h2>Evolución de ${E(met?.[1]||'medida')}</h2><p class="muted">Incluye la medición actual y todas las anteriores.</p></div><select class="select-inline chart-select" id="chartMetric" aria-label="Medida del gráfico">${FIELDS.map(f=>`<option value="${f[0]}" ${chartMetric===f[0]?'selected':''}>${E(f[1])}</option>`).join('')}</select></div>${chartHTML(chartMetric)}</section>`;}

function measurementsPageHTML(){const rows=[...db.measurements].sort(lastByDate);
 return `${subpageHeader('Todas las mediciones','Historial completo por fecha, sin expandir el resumen de Progreso.','progress')}
 <div class="card"><div class="row-between wrap"><span class="pill green">${rows.length} registros</span><div class="row wrap"><button class="btn" data-action="export">↓ Copia JSON</button><button class="btn primary" data-action="new-measure">+ Medición</button></div></div>
 ${rows.length?rows.map(m=>`<div class="list-row"><div><strong>${niceDate(m.date)}</strong><p class="muted">${FIELDS.filter(f=>Number.isFinite(m[f[0]])).map(f=>`${E(f[1])}: ${fmtNum(m[f[0]],2)} ${f[2]}`).join(' · ')}</p>${m.notes?`<small>${E(m.notes)}</small>`:''}</div><div class="row history-actions"><button class="btn small" data-action="edit-measure" data-id="${E(m.id)}">Editar</button><button class="btn danger small" data-action="delete-measure" data-id="${E(m.id)}">Borrar</button></div></div>`).join(''):'<div class="empty"><strong>Sin mediciones todavía</strong><small>Puedes registrar peso o cualquier perímetro independientemente.</small></div>'}</div>`;
}
function sessionsPageHTML(){const count=db.sessions.filter(s=>s.status==='completed').length;
 return `${subpageHeader('Historial de sesiones','Todas tus sesiones guardadas y sus series, incluidas sesiones libres.','training')}
 <section class="card"><div class="row-between wrap"><h2>Todos los entrenamientos</h2><span class="pill green">${count} sesiones</span></div>${sessionHistoryHTML(null)}</section>`;
}

const MACHINE_BRANDS = ['Hammer Strength','gym80','Technogym'];
const BRAND_CATALOGS = {
  'Technogym':'https://www.technogym.com/en-INT/category/selection-900/',
  'Hammer Strength':'https://www.lifefitness.com/en-us/catalog/strength-training/plate-loaded/hammer-strength',
  'gym80':'https://www.gym80.co.uk/product-ranges/sygnum'
};
function fullExerciseName(e){return `${e.name}${e.brand?' · '+e.brand+(e.machineLine?' '+e.machineLine:''):''}`;}
function exerciseMeta(e){
 return `<span class="muscle-tag">${E(e.muscle)}</span><span class="exercise-equip">${E(e.equipment)}</span>${e.brand?`<span class="brand-chip">${E(e.brand)}${e.machineLine?` · ${E(e.machineLine)}`:''}</span>`:''}`;
}
// Machine references belong to the movement; each selected model keeps a separate exercise ID.
const machineText = v=>[v.marca,v.linea,v.modelo,v.codigo?'#'+v.codigo:''].filter(Boolean).join(' · ');
const machineKey = (group,v)=>[group,v.marca,v.linea,v.codigo||v.modelo].map(normalizeExerciseQuery).join('|');
const machineGroup = e=>e.movementGroup==='prensa-piernas'?'grupo-prensa-de-piernas':e.movementGroup;
function movementEntry(e){return db.movementCatalog.find(g=>g.id===machineGroup(e));}
function modelOptions(e){
 const group=machineGroup(e),entry=movementEntry(e),map=new Map();
 if(!group&&!e.brand)return [];
 const add=(v,ex)=>{if(!v?.marca||!v.modelo)return;const key=machineKey(group,v);if(!map.has(key))map.set(key,{...v,key,exerciseId:ex?.id||null});else if(ex&&!map.get(key).exerciseId)map.get(key).exerciseId=ex.id;};
 for(const v of [...(entry?.machineVariants||[]),...(e.machineVariants||[])])add(v);
 for(const x of db.exercises.filter(x=>!x.archived&&(group?machineGroup(x)===group:x.id===e.id)&&x.brand)){
  const name=x.modelName||x.name,existing=[...map.values()].find(v=>v.key===x.variantKey||(normalizeExerciseQuery(v.marca)===normalizeExerciseQuery(x.brand)&&normalizeExerciseQuery(v.linea)===normalizeExerciseQuery(x.machineLine)&&(x.modelCode&&String(v.codigo)===String(x.modelCode)||normalizeExerciseQuery(v.modelo)===normalizeExerciseQuery(name))));
  if(existing){if(!existing.exerciseId||x.id===e.id)existing.exerciseId=x.id;}
  else add({marca:x.brand,linea:x.machineLine,modelo:name,codigo:x.modelCode||null,disponibilidad_zubiarte:x.disponibilidad_zubiarte},x);
 }
 return [...map.values()].filter(v=>v.exerciseId && db.exercises.some(x=>x.id===v.exerciseId&&!x.archived)).sort((a,b)=>{const rank=v=>machineStatus(v)==='confirmada'?0:machineStatus(v)==='no_disponible'?2:1;return rank(a)-rank(b)||machineText(a).localeCompare(machineText(b),'es');});
}
const inventoryKey=v=>machineKey('equipo',v);
function machineStatus(v){return db.machineAvailability[inventoryKey(v)]||db.machineAvailability[v.key]||v.disponibilidad_zubiarte||'sin_verificar';}
const statusLabel=v=>({confirmada:'Confirmada en mi gimnasio',no_disponible:'No disponible',sin_verificar:v.marca==='Technogym'?'Provisional · Por confirmar':'Por confirmar'}[machineStatus(v)]||'Por confirmar');
function equipmentAdvice(e,routineId,dayNo,index,manager=false){
 const models=modelOptions(e), usable=models.filter(v=>machineStatus(v)!=='no_disponible'),materials=[...new Set([e.equipment,...(movementEntry(e)?.materialOptions||[]),...(e.materialOptions||[])])];
 const current=usable.find(v=>v.exerciseId===e.id),preferred=usable.find(v=>machineStatus(v)==='confirmada')||current||usable.find(v=>v.exerciseId&&exercise(v.exerciseId).loadUnit===e.loadUnit)||usable.find(v=>/selection|select|sygnum/i.test(v.linea||''))||usable[0];
 const useMachine=['Máquina','Cardio'].includes(e.equipment);
 const summary=useMachine&&preferred?`<strong>${current?'Equipo del ejercicio':'Máquina sugerida'}:</strong> ${E(machineText(current||preferred))} <span class="machine-state">${E(statusLabel(current||preferred))}</span>`:`<strong>Material previsto:</strong> ${E(e.equipment)}${useMachine?' · sin modelo confirmado':''}`;
 const alternative=usable.filter(v=>v.key!==(current||preferred)?.key);
 return `<div class="equipment-advice">${models.some(v=>v.exerciseId===e.id&&machineStatus(v)==='no_disponible')?'<div class="small-note">El equipo del plan está marcado como no disponible; elige una alternativa.</div>':''}${summary}${current&&preferred&&current.key!==preferred.key?`<div>Alternativa confirmada: ${E(machineText(preferred))}</div>`:''}${alternative.length?`<div class="machine-other">${useMachine?'Otras máquinas':'Máquinas alternativas'}: ${E([...new Set(alternative.map(v=>v.marca))].join(', '))} · ${alternative.length} referencias</div>`:''}${materials.length>1?`<div class="machine-other">También: ${E(materials.filter(m=>m!==e.equipment).join(', '))}</div>`:''}<button class="btn small ghost" data-action="routine-machines" data-id="${E(routineId)}" data-weekday="${dayNo}" data-index="${index}" data-manager="${manager?'1':'0'}">${models.length?'Ver máquinas y alternativas ('+models.length+')':'Ver equipo y alternativas'}</button></div>`;
}
function routineContext(target){const r=db.routines.find(r=>r.id===target.dataset.id)||(!target.dataset.id?activeRoutine():null);const dayNo=Number(target.dataset.weekday)||selectedDay;return {r,dayNo,index:Number(target.dataset.index),manager:target.dataset.manager==='1'};}
function contextAttrs(r,dayNo,index,manager){return `data-id="${E(r.id)}" data-weekday="${dayNo}" data-index="${index}" data-manager="${manager?'1':'0'}"`;}
function machineModal(r,k,i,manager){const rx=r?.days[k]?.exercises[i];if(!rx)return;const e=exercise(rx.exerciseId),models=modelOptions(e),attrs=contextAttrs(r,k,i,manager),others=activeExercises().filter(x=>x.id!==e.id&&machineGroup(e)&&machineGroup(x)===machineGroup(e)&&!x.brand&&x.unit===e.unit);modal('Máquinas y alternativas',`${modalBack(`data-action="routine-exercise-detail" ${attrs}`,'Ejercicio')}<p class="muted">${E(e.name)} · selecciona un equipo para ver sus opciones.</p>${models.length?menuGroup(models.map(v=>menuLink(v.modelo,`${v.marca} · ${statusLabel(v)}${v.exerciseId===e.id?' · En el plan':''}`,`data-action="routine-model-detail" ${attrs} data-model="${E(v.key)}"`,'◈')).join('')):'<p class="muted">No hay modelos específicos en el catálogo.</p>'}${others.length?`<details class="secondary-details section"><summary>Otras modalidades (${others.length})</summary><div class="section">${menuGroup(others.map(x=>menuLink(x.name,x.equipment,`data-action="routine-use-exercise" ${attrs} data-exercise="${E(x.id)}"`,'⇄')).join(''))}</div></details>`:''}<p class="small-note">Las referencias de catálogo no confirman su presencia en el gimnasio.</p>`);}
function routineModelModal(r,k,i,manager,key){const rx=r?.days[k]?.exercises[i],e=rx&&exercise(rx.exerciseId),v=e&&modelOptions(e).find(v=>v.key===key);if(!v)return;const attrs=contextAttrs(r,k,i,manager)+` data-model="${E(v.key)}"`;modal(v.modelo,`${modalBack(`data-action="routine-machines" ${attrs}`,'Máquinas')}<div class="card"><strong>${E(machineText(v))}</strong><p class="muted">${E(statusLabel(v))}</p></div><button class="btn primary block section" data-action="machine-use" ${attrs} ${machineStatus(v)==='no_disponible'||v.exerciseId===e.id?'disabled':''}>${v.exerciseId===e.id?'Ya está en la rutina':'Usar en rutina'}</button><section class="section"><h3>Disponibilidad en mi gimnasio</h3><div class="stack">${[['confirmada','Tengo esta máquina'],['no_disponible','No está disponible'],['sin_verificar','Por confirmar']].map(([status,label])=>`<button class="btn ${machineStatus(v)===status?'primary':''} block" data-action="machine-status" ${attrs} data-status="${status}">${label}</button>`).join('')}</div></section>`);}

function replaceRoutineExercise(r,dayNo,index,id){const rx=r?.days[dayNo]?.exercises[index],next=activeExercises().find(x=>x.id===id);if(!rx||!next||rx.exerciseId===id)return false;const previous=exercise(rx.exerciseId);if(previous.unit!==next.unit){toast('Esta variante usa otra unidad; edita el ejercicio manualmente.',true);return false;}rx.exerciseId=id;rx.suggestedKg=['Sin carga','Peso corporal'].includes(next.loadUnit)||next.unit==='minutes'?null:lastLoad(id);return true;}
function useMachine(r,dayNo,index,key,manager){const rx=r?.days[dayNo]?.exercises[index];if(!rx)return;const e=exercise(rx.exerciseId),v=modelOptions(e).find(v=>v.key===key);if(!v||!v.exerciseId||!isActiveExercise(v.exerciseId)||machineStatus(v)==='no_disponible')return;
 if(v.exerciseId){replaceRoutineExercise(r,dayNo,index,v.exerciseId);persist();render();machineModal(r,dayNo,index,manager);return;}
 const attrs=contextAttrs(r,dayNo,index,manager);modal('Elegir cómo registrar la carga',`<form id="modelUseForm" ${attrs} data-model="${E(key)}"><p>${E(machineText(v))}</p><label class="field"><span class="label">Tipo de carga (comprueba la máquina)</span><select name="loadUnit" required><option value="">Seleccionar…</option>${['Máquina','Por lado','Total','Sin carga'].map(v=>`<option>${v}</option>`).join('')}</select></label><p class="small-note">Si la máquina tiene discos, confirma si registrarás por lado o el total. Se crea una ficha independiente para no mezclar pesos.</p><button class="btn primary block section" type="submit">Usar este modelo</button></form>`);
}
function catalogModelsHTML(e){const models=modelOptions(e);return models.length?menuGroup(models.map(v=>menuLink(v.modelo,`${v.marca} · ${statusLabel(v)}`,`data-action="library-model-detail" data-id="${E(e.id)}" data-model="${E(v.key)}"`,'◈')).join('')):'<p class="muted">No hay modelos específicos.</p>';}
function libraryModelModal(e,key){const v=e&&modelOptions(e).find(v=>v.key===key);if(!v)return;const attrs=`data-id="${E(e.id)}" data-model="${E(v.key)}"`;modal(v.modelo,`${modalBack(`data-action="exercise-models" data-id="${E(e.id)}"`,'Máquinas')}<div class="card"><strong>${E(machineText(v))}</strong><p class="muted">${E(statusLabel(v))}</p></div><div class="stack section">${[['confirmada','Tengo esta máquina'],['no_disponible','No está disponible'],['sin_verificar','Por confirmar']].map(([status,label])=>`<button class="btn ${machineStatus(v)===status?'primary':''} block" data-action="library-machine-status" ${attrs} data-status="${status}">${label}</button>`).join('')}</div>`);}
function exerciseVariants(e){
 if(!e.movementGroup)return '';
 const options=activeExercises().filter(x=>x.id!==e.id && x.movementGroup===e.movementGroup).slice(0,12);
 if(!options.length)return '';
 return `<div class="exercise-variants"><h3>Otras formas de este movimiento</h3><p class="small-note">Cada modalidad y cada máquina tienen su propio historial de cargas; los kilos no son directamente comparables.</p><div class="variant-grid">${options.map(x=>`<button class="variant-choice" type="button" data-action="exercise-detail" data-id="${E(x.id)}"><span>${E(x.name)}</span><small>${E(x.brand||x.equipment)}${x.machineLine?' · '+E(x.machineLine):''}</small></button>`).join('')}</div></div>`;
}
function machineReferenceHTML(){
 const refs=db.machineReferenceCatalog||[];if(!refs.length)return '';
 return `<details class="secondary-details section"><summary>Inventario de las tres marcas (${refs.length} modelos)</summary><p class="small-note">Nombres originales de tu listado. Technogym está disponible provisionalmente. Confirma cada modelo o márcalo como no disponible en su ficha.</p>${['gym80','Hammer Strength','Technogym'].map(brand=>{const rows=refs.filter(r=>r.brand===brand);return `<details class="secondary-details section"><summary>${E(brand)} · ${rows.length} modelos${brand==='Technogym'?' · Provisional':''}</summary><div class="section-menu">${rows.map(r=>`<div class="section-link"><span class="section-link-copy"><strong>${E(r.model)}</strong><small>${E([r.line,...r.codes.map(c=>'Código '+c),r.movements.join(' / ')].filter(Boolean).join(' · '))}</small></span></div>`).join('')}</div></details>`;}).join('')}</details>`;
}
function libraryHTML(){const muscles=['Todos',...new Set(inventoryExercises().map(e=>e.muscle))];return `${header('Ejercicios',`${inventoryExercises().length} fichas · Technogym provisional`)}<div class="stack"><input id="exerciseSearch" type="search" placeholder="Buscar ejercicio o máquina…" aria-label="Buscar ejercicios"><details class="secondary-details"><summary>Filtros</summary><div class="stack section"><select id="muscleFilter" class="select-inline" aria-label="Grupo muscular">${muscles.map(m=>`<option value="${E(m)}">${E(m)}</option>`).join('')}</select><select id="levelFilter" class="select-inline" aria-label="Nivel del ejercicio"><option value="Todos">Todos los niveles</option><option value="Principiante">Principiante</option><option value="Intermedio">Intermedio</option><option value="Avanzado">Avanzado</option></select><select id="brandFilter" class="select-inline" aria-label="Marca de la máquina"><option value="Todas">Todas las marcas</option><option value="Sin marca">Sin marca / otras modalidades</option>${MACHINE_BRANDS.map(b=>`<option value="${E(b)}">${E(b)}</option>`).join('')}</select></div></details><button class="btn block" data-action="new-exercise">+ Nuevo ejercicio</button>${machineReferenceHTML()}</div><div class="section"><p id="libraryCount" class="muted small-note"></p><div class="section-menu" id="exerciseResults">${inventoryExercises().map(e=>`<button hidden class="section-link" data-library-item data-text="${E(JSON.stringify(exerciseSearchRecord(e,movementEntry(e))))}" data-muscle="${E(e.muscle)}" data-level="${E(e.level||'General')}" data-brand="${E(e.brand||'Sin marca')}" data-action="exercise-detail" data-id="${E(e.id)}"><span class="section-link-copy"><strong>${E(e.name)}</strong><small>${E(e.muscle)} · ${E(e.brand||e.equipment)}</small></span><span class="section-link-chevron">›</span></button>`).join('')}</div><div class="row-between section" id="libraryPager"><button class="btn small" data-action="library-prev">← Anterior</button><small id="libraryPage"></small><button class="btn small" data-action="library-next">Siguiente →</button></div></div>`;}

function profileHTML(){return `${header('Perfil',db.profile.gym||'Tu espacio personal')}${menuGroup(menuLink('Datos personales','Altura, peso de referencia y gimnasio','data-nav="personal"','◉')+menuLink('Objetivos',`${activeGoals().length} activos`,'data-nav="goals"','◎')+menuLink('Mis rutinas','Crear o gestionar versiones','data-nav="routines"','◈')+menuLink('Apariencia',`Color: ${THEMES[currentTheme()]}`,'data-nav="appearance"','◐')+menuLink('Copias de seguridad','Exportar, restaurar y borrar datos','data-nav="backup"','↓'))}`;}
function appearancePageHTML(){
 const active=currentTheme();
 return `${pageBack('profile','Perfil')}${header('Apariencia','Personaliza el color de NIVEL.')}
 <fieldset class="theme-picker"><legend class="label">Color de la aplicación</legend><div class="theme-grid">${Object.entries(THEMES).map(([key,name])=>`<label class="theme-option" data-swatch="${key}"><input type="radio" name="appTheme" value="${key}" ${active===key?'checked':''}><span class="theme-option-inner"><span class="theme-swatch" aria-hidden="true"><span class="theme-check">✓</span></span><strong>${name}</strong></span></label>`).join('')}</div></fieldset>
 <p id="themeStatus" class="small-note" aria-live="polite">Color activo: ${THEMES[active]}.</p><p class="muted theme-help">Los cambios se guardan automáticamente. Se mantiene el fondo oscuro.</p>`;
}
function personalPageHTML(){return `${pageBack('profile','Perfil')}${header('Datos personales')}<form class="card" id="profileForm"><h2>Datos de referencia</h2><div class="form-grid"><label class="field"><span class="label">Altura (cm)</span><input name="heightCm" inputmode="decimal" value="${E(db.profile.heightCm)}"></label><label class="field"><span class="label">Peso de referencia (kg)</span><input name="referenceWeightKg" inputmode="decimal" value="${E(db.profile.referenceWeightKg)}"></label><label class="field full"><span class="label">Gimnasio</span><input name="gym" maxlength="100" value="${E(db.profile.gym)}"></label></div><button class="btn primary block section" type="submit">Guardar perfil</button></form>`;}
function backupPageHTML(){return `${pageBack('profile','Perfil')}${header('Copias de seguridad')}<div class="card"><h2>Memoria de tus datos</h2><p>Los registros se guardan en <strong>este navegador</strong>. No se suben a GitHub.</p><div class="stack"><button class="btn primary block" data-action="export">↓ Descargar memoria (.json)</button><label class="btn block" for="importFile">↑ Restaurar memoria JSON</label><input id="importFile" type="file" accept=".json,application/json" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none"><button class="btn danger block" data-action="reset">Borrar todos mis datos locales</button></div><p class="fineprint section">Haz copias de seguridad frecuentes, especialmente antes de cambiar de teléfono o limpiar el navegador. No subas tu respaldo personal a un repositorio público.</p></div>`;}
function goalsPageHTML(){const upcoming=activeGoals().find(g=>g.targetDate>=madridToday()),remaining=upcoming?Math.ceil((new Date(upcoming.targetDate+'T12:00:00Z')-new Date(madridToday()+'T12:00:00Z'))/86400000):null;return `${pageBack('profile','Perfil')}${header('Objetivos')}${upcoming?`<div class="card glow"><div class="eyebrow">PRÓXIMO OBJETIVO</div><h2>${E(upcoming.name)}</h2><p class="muted">${remaining} días · ${niceDate(upcoming.targetDate)}</p></div>`:''}<section class="card section"><div class="row-between wrap"><div><h2>Tus objetivos</h2><p class="muted">Puedes mantener varios objetivos activos a la vez: peso, cintura o rendimiento.</p></div><button class="btn primary" data-action="new-goal">+ Añadir objetivo</button></div>${db.goals.length?db.goals.map(g=>`<div class="list-row"><div><strong>${E(g.name)}</strong> ${g.done?'<span class="pill green">CUMPLIDO</span>':''}<p class="muted">${E(goalSummary(g))}</p>${g.description?`<small>${E(g.description)}</small>`:''}</div><div class="row wrap"><button class="btn small" data-action="edit-goal" data-id="${E(g.id)}">Editar</button><button class="html-button danger" data-action="delete-goal" data-id="${E(g.id)}">Borrar</button></div></div>`).join(''):'<div class="empty">No hay objetivos todavía.</div>'}</section>`;}
function routinesPageHTML(){return `${pageBack('training','Entrenar')}${header('Mis rutinas','Todas las versiones guardadas.')}<button class="btn primary block" data-action="routine-create">+ Crear rutina</button>${routineDraft?`<button class="btn block section" data-action="draft-open">Continuar borrador · ${E(routineDraft.name)}</button>`:''}<section class="section stack">${routineVersionsHTML()}</section>`;}

const FULL_DAYS=['','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
function routineDays(r){return Object.entries(r.days).filter(([k,d])=>!d.rest&&d.exercises.length).map(([k])=>Number(k)).sort((a,b)=>a-b);}
function estimatedMinutes(r){const times=routineDays(r).map(k=>Math.ceil((7+r.days[k].exercises.reduce((n,rx)=>{const e=exercise(rx.exerciseId),sets=Number(rx.sets)||1;return n+(e.unit==='minutes'?sets*Number(rx.max||rx.min||1):sets*(e.unit==='seconds'?Number(rx.max||30)/60:0.7)*(rx.perSide?2:1)+Math.max(0,sets-1)*1.5+1.5);},0))/5)*5);return times.length?[Math.min(...times),Math.max(...times)]:null;}
function routineType(r){return r.focus?FOCUSES.find(x=>x[0]===r.focus)?.[1]||r.focus:FOCUSES.find(([k,label])=>r.name.startsWith(label+' ·'))?.[1]||'Sin especificar';}
function routineSplit(r){if(r.split)return r.split;const titles=routineDays(r).map(k=>r.days[k].title).join(' ').toLowerCase();if(/full body/.test(titles))return 'Full body (según los días)';if(/push/.test(titles)&&/torso/.test(titles)&&/pierna/.test(titles))return 'Push / Torso / Pierna (según los días)';if(/push/.test(titles)&&/pull/.test(titles)&&/pierna/.test(titles))return 'Push / Pull / Legs (según los días)';if(/torso/.test(titles)&&/pierna/.test(titles))return 'Torso / pierna (según los días)';return 'Personalizada';}
function routineSummary(r){const days=routineDays(r),t=estimatedMinutes(r);return `<div class="routine-meta"><span>${days.length} días · ${E(days.map(i=>DAYS[i]).join(', ')||'Sin días activos')}</span><span>${r.minutesPerSession?E(r.minutesPerSession)+' min objetivo · ':''}${t?`~${t[0]}${t[1]!==t[0]?'–'+t[1]:''} min estimados/sesión`:'Duración sin estimar'}</span><span>${E(routineType(r))} · ${E(routineSplit(r))}</span></div>`;}
function routineVersionsHTML(){return db.routines.length?db.routines.map(r=>`<button class="section-link routine-link" data-action="routine-manage" data-id="${E(r.id)}"><span class="section-link-copy"><strong>${E(r.name)} ${r.id===activeRoutine().id?'<span class="pill green">Activa</span>':''}</strong>${routineSummary(r)}</span><span class="section-link-chevron">›</span></button>`).join(''):'<p class="muted">No tienes rutinas guardadas.</p>';}
function routineManager(r){if(!r)return;const attrs=`data-id="${E(r.id)}"`;modal(r.name,`<div class="card">${routineSummary(r)}</div><div class="section">${menuGroup(menuLink('Datos de la rutina','Nombre, objetivo y duración',`data-action="routine-meta" ${attrs}`,'✎')+menuLink('Días y ejercicios','Organiza tu semana',`data-action="routine-days" ${attrs}`,'▦')+menuLink('Opciones de rutina','Activar, duplicar o eliminar',`data-action="routine-options" ${attrs}`,'⋯'))}</div>`);}
function routineDaysModal(r){if(!r)return;modal('Días y ejercicios',`${modalBack(`data-action="routine-manage" data-id="${E(r.id)}"`,'Rutina')}${menuGroup([1,2,3,4,5,6,7].map(k=>menuLink(FULL_DAYS[k],`${r.days[k].title} · ${r.days[k].exercises.length} ejercicios`,`data-action="routine-day" data-id="${E(r.id)}" data-weekday="${k}"`,'▦')).join(''))}`);}
function routineDayModal(r,k){const d=r?.days[k];if(!d)return;const attrs=`data-id="${E(r.id)}" data-weekday="${k}"`;modal(FULL_DAYS[k],`${modalBack(`data-action="routine-days" data-id="${E(r.id)}"`,'Días')}<h3>${E(d.title)}</h3><div class="stack">${d.exercises.map((rx,i)=>exerciseRow(rx,i,r.id,k,true)).join('')||'<p class="muted">Sin ejercicios.</p>'}</div><button class="btn primary block section" data-action="routine-add" ${contextAttrs(r,k,-1,true)}>+ Añadir ejercicio</button><details class="secondary-details section"><summary>Opciones del día</summary><form data-routine-day-form ${attrs} class="stack section"><label class="field"><span class="label">Nombre del día</span><input name="title" required maxlength="100" value="${E(d.title)}"></label><button class="btn block" type="submit">Guardar nombre</button></form><form data-routine-move-form ${attrs} class="stack section"><label class="field"><span class="label">Intercambiar con</span><select name="destination">${[1,2,3,4,5,6,7].filter(n=>n!==k).map(n=>`<option value="${n}">${FULL_DAYS[n]}</option>`).join('')}</select></label><button class="btn block" type="submit">Intercambiar días</button></form></details>`);}
function routineOptionsModal(r){if(!r)return;const attrs=`data-id="${E(r.id)}"`;modal('Opciones de rutina',`${modalBack(`data-action="routine-manage" ${attrs}`,'Rutina')}<div class="stack">${r.id!==activeRoutine().id?`<button class="btn primary block" data-action="routine-activate" ${attrs}>Activar rutina</button>`:'<p class="muted">Esta rutina está activa.</p>'}<button class="btn block" data-action="routine-copy" ${attrs}>Duplicar rutina</button><button class="btn danger block" data-action="routine-delete" ${attrs}>Eliminar rutina</button></div><p class="small-note">Tu historial de sesiones se conserva.</p>`);}
function routineMetaModal(r){if(!r)return;modal('Datos de la rutina',`${modalBack(`data-action="routine-manage" data-id="${E(r.id)}"`,'Rutina')}<form id="routineMetaForm" data-id="${E(r.id)}"><div class="form-grid"><label class="field full"><span class="label">Nombre de la rutina</span><input name="name" required maxlength="100" value="${E(r.name)}"></label><label class="field"><span class="label">Objetivo o prioridad semanal</span><select name="focus"><option value="">Sin especificar</option>${groupedOptions(FOCUS_GROUPS,r.focus)}</select></label><label class="field"><span class="label">Duración objetivo (min/sesión)</span><input name="minutesPerSession" type="number" min="10" max="240" value="${E(r.minutesPerSession||'')}" placeholder="Opcional"></label><label class="field full"><span class="label">Distribución (ej. Push/Pull/Legs)</span><input name="split" maxlength="80" value="${E(r.split||'')}" placeholder="Personalizada"></label></div><button class="btn primary block section" type="submit">Guardar datos de rutina</button></form>`);}

function goalModal(id){
 const g=db.goals.find(g=>g.id===id)||{};
 modal(id?'Editar objetivo':'Nuevo objetivo',`<form id="goalForm" data-id="${E(g.id||'')}"><div class="form-grid"><label class="field full"><span class="label">Nombre del objetivo</span><input name="name" value="${E(g.name||'')}" maxlength="100" required placeholder="Ej.: mejorar fuerza o perder cintura"></label><label class="field"><span class="label">Fecha límite (opcional)</span><input name="targetDate" type="date" value="${E(g.targetDate||'')}"></label><label class="field"><span class="label">Qué quieres seguir</span><select name="metric"><option value="none">Sin cifra concreta</option>${FIELDS.map(f=>`<option value="${f[0]}" ${g.metric===f[0]?'selected':''}>${E(f[1])} (${f[2]})</option>`).join('')}</select></label><label class="field"><span class="label">Valor objetivo (opcional)</span><input name="targetValue" inputmode="decimal" placeholder="Ej.: 75,0" value="${g.targetValue==null?'':E(g.targetValue)}"></label><label class="field full"><span class="label">Descripción</span><textarea name="description" maxlength="1000" placeholder="Qué te gustaría conseguir">${E(g.description||'')}</textarea></label><label class="field full row"><input type="checkbox" name="done" style="width:auto" ${g.done?'checked':''}>Objetivo cumplido</label></div><button class="btn primary block section" type="submit">Guardar objetivo</button></form>`);
}
function plannerModal(){
 const p=db.planner,selected=p.availableDays||[1,2,3,5,6];
 modal('Asistente de rutinas',`<form id="plannerForm"><p>Elige los días que <strong>puedes entrenar</strong>, el objetivo que más te importa y tu experiencia. Se crea otra versión de la rutina sin borrar tus registros.</p>
 <div class="day-choices">${[1,2,3,4,5,6,7].map(i=>`<label class="day-choice"><input type="checkbox" name="availableDay" value="${i}" ${selected.includes(i)?'checked':''}><span>${DAYS[i]}</span></label>`).join('')}</div>
 <div class="form-grid section"><label class="field full"><span class="label">Nombre de la nueva rutina (opcional)</span><input name="routineName" maxlength="100" placeholder="Ej. Definición noviembre"></label><label class="field"><span class="label">Días activos por semana</span><select name="sessionsPerWeek">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${p.sessionsPerWeek===n?'selected':''}>${n} ${n===1?'día':'días'}</option>`).join('')}</select></label>
 <label class="field"><span class="label">Duración por sesión</span><select name="minutesPerSession">${[35,45,60,65,75,90].map(n=>`<option value="${n}" ${p.minutesPerSession===n?'selected':''}>${n} min</option>`).join('')}</select></label>
 <label class="field"><span class="label">Objetivo o prioridad semanal</span><select name="focus">${groupedOptions(FOCUS_GROUPS,p.focus)}</select></label>
 <label class="field"><span class="label">Experiencia</span><select name="level">${[['principiante','Principiante'],['intermedio','Intermedio'],['avanzado','Avanzado']].map(([k,v])=>`<option value="${k}" ${p.level===k?'selected':''}>${v}</option>`).join('')}</select></label></div>
 <label class="field section"><span class="label">Mensaje para NIVEL (opcional)</span><textarea name="plannerRequest" maxlength="500" rows="3" placeholder="Ej.: solo mancuernas y poleas, 45 minutos, 4 ejercicios por día.">${E(p.request||'')}</textarea></label><p class="small-note">El chat local reconoce material, tiempo, nivel y número de ejercicios; las zonas se distribuyen según el objetivo y los días elegidos. Revisa el resultado.</p><p class="small-note">El modo avanzado selecciona variantes más exigentes y ajusta volumen y rangos, pero no establece cargas sin historial. Revisa técnica y recuperación. Máximo seis sesiones; queda al menos un día de descanso.</p>
 <div class="stack"><button class="btn primary block" type="submit">Generar y revisar rutina</button></div></form>`);
}
function modal(title,content){showingModal=true;document.getElementById('dialog-root')?.remove();const root=document.createElement('div');root.id='dialog-root';root.className='modal-backdrop';root.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="${E(title)}"><div class="modal-head"><h2>${E(title)}</h2><button class="modal-close" data-action="close-modal" aria-label="Cerrar ventana" title="Cerrar">×</button></div>${content}</div>`;document.body.append(root);organizeModalForm(root);const picker=root.querySelector('[data-exercise-combobox]');if(picker&&!picker.querySelector('[data-combo-value]').value)openExerciseCombo(picker);root.querySelector('.modal')?.scrollTo(0,0);}
function organizeModalForm(root){
 const form=root.querySelector('form');if(!form)return;
 const groups={exerciseForm:[['Datos básicos',['name','muscle','equipment','level'],true],['Máquina y modelo',['brand','machineLine','modelName','modelCode','movementGroup']],['Registro de entrenamiento',['unit','loadUnit','supportsDistance']],['Técnica e instrucciones',['instructions']]],measureForm:[['Peso y composición',['weightKg','fatPct'],true],['Tronco',['waistCm','abdomenCm','hipCm','chestCm','neckCm']],['Brazos y piernas',['armLeftCm','armRightCm','thighLeftCm','thighRightCm']],['Notas',['notes']]],routineForm:[['Ejercicio y series',['exerciseId','sets','min','max','suggestedKg'],true],['Opciones y notas',['notes','perSide','optional']]],plannerForm:[['Tu objetivo',['routineName','focus','level'],true],['Frecuencia y duración',['sessionsPerWeek','minutesPerSession'],true]]}[form.id];
 const grid=form.querySelector('.form-grid');if(!groups||!grid)return;
 const fields=[...grid.children];const wrapper=document.createElement('div');wrapper.className='stack form-sections';
 for(const [title,names,open] of groups){const details=document.createElement('details');details.className='secondary-details form-section';details.open=!!open;const summary=document.createElement('summary');summary.textContent=title;details.append(summary);const content=document.createElement('div');content.className='form-grid section';for(const field of fields){const inputs=[...field.querySelectorAll('[name]')];if(inputs.some(el=>names.includes(el.name)))content.append(field);}details.append(content);wrapper.append(details);}
 for(const field of fields)if(field.parentNode===grid)wrapper.append(field);grid.replaceWith(wrapper);
 form.addEventListener('invalid',ev=>{let el=ev.target.closest('details');if(el)el.open=true;},true);
}
function closeModal(){showingModal=false;document.getElementById('dialog-root')?.remove();}
function measurementModal(id){const rec=db.measurements.find(m=>m.id===id);modal(rec?'Editar medición':'Nueva medición',`<form id="measureForm" data-id="${E(id||'')}"><label class="field"><span class="label">Fecha de medición</span><input type="date" name="date" required value="${E(rec?.date||madridToday())}" max="${madridToday()}"></label><div class="form-grid section">${FIELDS.map(f=>`<label class="field"><span class="label">${E(f[1])} (${f[2]})</span><input name="${f[0]}" inputmode="decimal" placeholder="Opcional" value="${rec?.[f[0]]==null?'':E(String(rec[f[0]]).replace('.',','))}"></label>`).join('')}<label class="field full"><span class="label">Notas (opcionales)</span><textarea name="notes" placeholder="Contexto de la medición">${E(rec?.notes||'')}</textarea></label></div><p class="footnote">Solo necesitas introducir al menos un valor. Los demás pueden quedar vacíos.</p><button class="btn primary block" type="submit">Guardar medición</button></form>`);}
// Selector de ejercicios: cerrado al entrar; al tocarlo ofrece todo el banco,
// permite escribir para filtrar y guarda el ID estable del ejercicio elegido.
function exercisePickerMeta(e){
 const model=e.brand?modelOptions(e).find(v=>v.exerciseId===e.id):null;
 return [e.muscle,e.brand||e.equipment,e.brand?movementEntry(e)?.name:null,e.machineLine,e.modelName&&e.modelName!==e.name?e.modelName:null,e.modelCode?'Código '+e.modelCode:null,e.loadUnit,model?statusLabel(model):null].filter(Boolean).join(' · ');
}
function exerciseComboboxHTML(prefix,selectedId=''){
 const entries=activeExercises().sort((a,b)=>a.name.localeCompare(b.name,'es',{sensitivity:'base'}));
 const current=entries.find(e=>e.id===selectedId),display=current?fullExerciseName(current):'';
 const muscles=[...new Set(entries.map(e=>e.muscle))].sort((a,b)=>a.localeCompare(b,'es'));
 const equipment=[...new Set(entries.map(e=>e.equipment))].sort((a,b)=>a.localeCompare(b,'es'));
 const brands=[...new Set(entries.map(e=>e.brand).filter(Boolean))].sort();
 const opts=values=>values.map(v=>`<option value="${E(v)}">${E(v)}</option>`).join('');
 return `<div class="exercise-combobox" data-exercise-combobox>
  <div class="exercise-combo-control">
   <input id="${prefix}Search" class="exercise-combo-input" data-combo-search type="search" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="${prefix}Options" aria-label="Buscar ejercicio, marca o modelo" autocomplete="off" spellcheck="false" placeholder="Ej. pecho, gym80, 4341…" value="${E(display)}">
   <button type="button" class="exercise-combo-toggle" data-combo-toggle aria-label="Mostrar u ocultar ejercicios" aria-controls="${prefix}Options" aria-expanded="false"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
  </div>
  <input type="hidden" name="exerciseId" data-combo-value value="${E(current?selectedId:'')}">
  <div class="exercise-combo-selection" data-combo-selection aria-live="polite" ${current?'':'hidden'}>${current?'Seleccionado: '+E(exercisePickerMeta(current)):''}</div>
  <div class="exercise-combo-panel" data-combo-panel hidden>
   <div class="exercise-combo-filters"><label><span>Material / marca</span><select data-combo-material><option value="">Todos</option><optgroup label="Material">${equipment.map(v=>`<option value="${E('equipment:'+v)}">${E(v)}</option>`).join('')}</optgroup><optgroup label="Marca">${brands.map(v=>`<option value="${E('brand:'+v)}">${E(v)}</option>`).join('')}</optgroup></select></label><label><span>Músculo</span><select data-combo-muscle><option value="">Todos</option>${opts(muscles)}</select></label></div>
   <p class="exercise-combo-count" data-combo-count role="status"></p>
   <div class="exercise-combo-menu" id="${prefix}Options" role="listbox" aria-label="Ejercicios disponibles">
    ${entries.map((e,i)=>`<button type="button" role="option" class="exercise-combo-option" id="${prefix}Option${i}" data-combo-option data-exercise-id="${E(e.id)}" data-exercise-name="${E(fullExerciseName(e))}" data-meta="${E(exercisePickerMeta(e))}" data-search="${E(JSON.stringify(exerciseSearchRecord(e,movementEntry(e))))}" data-equipment="${E(e.equipment)}" data-brand="${E(e.brand||'')}" data-muscle="${E(e.muscle)}" data-order="${i}" aria-selected="${selectedId===e.id}"><span>${E(e.name)}</span><small>${E(exercisePickerMeta(e))}</small></button>`).join('')}
   </div>
   <p class="exercise-combo-empty" data-combo-empty hidden>No hay resultados. Prueba otro nombre, modelo, código o elimina los filtros.</p>
  </div>
 </div>`;
}
function routineModal(i,add=false,r=activeRoutine(),dayNo=selectedDay,manager=false){const day=r?.days[dayNo];if(!day)return;const rx=day.exercises[i];modal(add?'Añadir ejercicio':'Editar ejercicio',`<form id="routineForm" ${contextAttrs(r,dayNo,add?-1:i,manager)}><div class="form-grid"><div class="field full"><span class="label">Ejercicio</span>${exerciseComboboxHTML('routineExercise',rx?.exerciseId||'')}</div><label class="field"><span class="label">Series</span><input name="sets" type="number" min="1" max="20" value="${rx?.sets??3}"></label><label class="field"><span class="label">Mínimo (reps / seg / min)</span><input name="min" type="number" min="1" max="600" value="${rx?.min??8}"></label><label class="field"><span class="label">Máximo (reps / seg / min)</span><input name="max" type="number" min="1" max="600" value="${rx?.max??12}"></label><label class="field"><span class="label">Peso sugerido (kg)</span><input name="suggestedKg" inputmode="decimal" placeholder="Sin definir" value="${rx?.suggestedKg??''}"></label><label class="field full"><span class="label">Notas</span><textarea name="notes">${E(rx?.notes||'')}</textarea></label><label class="field full row"><input type="checkbox" style="width:auto" name="perSide" ${rx?.perSide?'checked':''}>Por cada lado / pierna</label><label class="field full row"><input type="checkbox" style="width:auto" name="optional" ${rx?.optional?'checked':''}>Ejercicio opcional</label></div><div class="row-between section wrap"><button class="btn primary" type="submit">Guardar</button>${!add?`<button class="btn danger" type="button" data-action="routine-remove" ${contextAttrs(r,dayNo,i,manager)}>Eliminar del día</button>`:''}</div></form>`);}
function sessionAddModal(){
 if(!db.activeSession){toast('Primero comienza una sesión.',true);return;}
 modal('Añadir ejercicio a esta sesión',`<form id="sessionAddForm"><div class="field"><span class="label">Busca y elige ejercicio</span>${exerciseComboboxHTML('sessionExercise')}</div><label class="field section"><span class="label">Series que vas a registrar</span><input name="sets" type="number" min="1" max="20" value="3"></label><button class="btn primary block section" type="submit">Añadir a mi sesión</button></form>`);
}
// El formulario utiliza el input oculto name="exerciseId". Nunca inferimos el ID
// únicamente a partir del texto que alguien escriba en el buscador.
function normalizeExerciseQuery(text){return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();}
function closeExerciseCombo(combo){if(!combo)return;const panel=combo.querySelector('[data-combo-panel]'),input=combo.querySelector('[data-combo-search]'),toggle=combo.querySelector('[data-combo-toggle]');if(panel)panel.hidden=true;input?.setAttribute('aria-expanded','false');input?.removeAttribute('aria-activedescendant');toggle?.setAttribute('aria-expanded','false');combo.classList.remove('is-open');}
function filterExerciseCombo(combo,query=''){
 const options=[...combo.querySelectorAll('[data-combo-option]')],material=combo.querySelector('[data-combo-material]').value,muscle=combo.querySelector('[data-combo-muscle]').value;
 const ranked=options.map(option=>{const score=exerciseSearchScore(JSON.parse(option.dataset.search),query);const eligible=(!material||material==='equipment:'+option.dataset.equipment||material==='brand:'+option.dataset.brand)&&(!muscle||muscle===option.dataset.muscle);return {option,score:eligible?score:-1};});
 ranked.sort((a,b)=>b.score-a.score||Number(a.option.dataset.order)-Number(b.option.dataset.order));
 const menu=combo.querySelector('.exercise-combo-menu');let count=0;
 for(const {option,score} of ranked){option.hidden=score<0;if(!option.hidden)count++;option.classList.remove('is-active');menu.append(option);}
 const empty=combo.querySelector('[data-combo-empty]');empty.hidden=count!==0;menu.hidden=count===0;menu.scrollTop=0;
 combo.querySelector('[data-combo-count]').textContent=`${count} ${count===1?'resultado':'resultados'} · catálogo activo`;
 combo.querySelector('[data-combo-search]')?.removeAttribute('aria-activedescendant');return count;
}
function comboQuery(combo){return combo.querySelector('[data-combo-value]').value?'':combo.querySelector('[data-combo-search]').value;}
function openExerciseCombo(combo){
 if(!combo)return;
 document.querySelectorAll('[data-exercise-combobox]').forEach(other=>{if(other!==combo)closeExerciseCombo(other);});
 const panel=combo.querySelector('[data-combo-panel]'),input=combo.querySelector('[data-combo-search]'),toggle=combo.querySelector('[data-combo-toggle]');
 if(!panel||!input)return;
 panel.hidden=false;filterExerciseCombo(combo,comboQuery(combo));input.setAttribute('aria-expanded','true');toggle?.setAttribute('aria-expanded','true');combo.classList.add('is-open');
}
function chooseExerciseCombo(option){
 const combo=option.closest('[data-exercise-combobox]');if(!combo||option.hidden)return;
 combo.querySelector('[data-combo-value]').value=option.dataset.exerciseId;
 const input=combo.querySelector('[data-combo-search]');input.value=option.dataset.exerciseName;
 combo.querySelectorAll('[data-combo-option]').forEach(o=>o.setAttribute('aria-selected',String(o===option)));
 const selection=combo.querySelector('[data-combo-selection]');selection.textContent='Seleccionado: '+option.dataset.meta;selection.hidden=false;
 closeExerciseCombo(combo);input.blur();
}
function activeExerciseComboOption(combo,step){
 const visible=[...combo.querySelectorAll('[data-combo-option]')].filter(o=>!o.hidden);
 if(!visible.length)return;
 const index=visible.findIndex(o=>o.classList.contains('is-active'));
 const next=visible[index<0?(step>0?0:visible.length-1):(index+step+visible.length)%visible.length];
 visible.forEach(o=>o.classList.toggle('is-active',o===next));
 combo.querySelector('[data-combo-search]')?.setAttribute('aria-activedescendant',next.id);
 next.scrollIntoView({block:'nearest'});
}
function exerciseModal(id, mode='detail'){
 const e=id?db.exercises.find(x=>x.id===id):null;
 if(id&&!e){toast('No se encontró ese ejercicio.',true);return;}
 if(e&&mode!=='edit'){
   const ref=e.brand&&BRAND_CATALOGS[e.brand]?`<p class="small-note">${e.catalogVerified&&!e.userEdited?'Denominación documentada en catálogo oficial.':'Nombre personalizado por ti.'} La presencia de este modelo en Zubiarte no está confirmada. <a href="${BRAND_CATALOGS[e.brand]}" target="_blank" rel="noopener noreferrer">Consultar catálogo de la marca</a>.</p>`:'';
   const attrs=`data-id="${E(e.id)}"`;modal(e.name,`<div class="card"><div class="library-card-meta">${exerciseMeta(e)}</div><p class="small-note">${E(e.level||'General')} · ${E(e.loadUnit)}</p></div><div class="section">${menuGroup(menuLink('Cómo se realiza','Técnica e instrucciones',`data-action="exercise-instructions" ${attrs}`,'▤')+menuLink('Máquinas y modelos',`${modelOptions(e).length} referencias del catálogo`,`data-action="exercise-models" ${attrs}`,'◈')+menuLink('Otras variantes','Alternativas del movimiento',`data-action="exercise-variants" ${attrs}`,'⇄')+menuLink('Editar ficha','Datos, material y técnica',`data-action="exercise-edit" ${attrs}`,'✎')+(e.custom?menuLink('Eliminar ejercicio propio','Solo si no tiene registros',`data-action="delete-exercise" ${attrs}`,'−'):'') )}</div>`);
   return;
 }
 const selected=e||{};
 const used=!!e&&(db.sessions.some(s=>s.exercises?.some(x=>x.exerciseId===e.id))||db.activeSession?.exercises?.some(x=>x.exerciseId===e.id));
 const option=(value,current)=>`<option value="${E(value)}" ${value===current?'selected':''}>${E(value)}</option>`;
 modal(e?'Editar ejercicio':'Crear ejercicio',`<form id="exerciseForm" data-id="${E(e?.id||'')}"><div class="form-grid"><label class="field full"><span class="label">Nombre de la máquina o ejercicio</span><input name="name" value="${E(selected.name||'')}" ${selected.brand?'readonly':''} required maxlength="100" placeholder="Ej. Lat Machine"></label><label class="field"><span class="label">Grupo muscular</span><input name="muscle" value="${E(selected.muscle||'')}" required placeholder="Espalda" maxlength="40"></label><label class="field"><span class="label">Material</span><select name="equipment">${['Máquina','Mancuernas','Polea','Barra','Peso corporal','Cardio','Otro'].map(v=>option(v,selected.equipment||'Máquina')).join('')}</select></label><label class="field"><span class="label">Marca (máquina, polea o cardio)</span><select name="brand">${[['','Sin marca específica'],...MACHINE_BRANDS.map(b=>[b,b])].map(([value,label])=>`<option value="${E(value)}" ${value===(selected.brand||'')?'selected':''}>${E(label)}</option>`).join('')}</select></label><label class="field full"><span class="label">Serie o modelo (opcional)</span><input name="machineLine" maxlength="80" value="${E(selected.machineLine||'')}" placeholder="Ej. Selection 900, Sygnum Dual"></label><label class="field"><span class="label">Modelo exacto</span><input name="modelName" maxlength="100" value="${E(selected.modelName||'')}"></label><label class="field"><span class="label">Código de máquina</span><input name="modelCode" maxlength="40" value="${E(selected.modelCode||'')}"></label><label class="field full"><span class="label">Grupo de movimiento (para las alternativas)</span><select name="movementGroup"><option value="">Sin agrupar</option>${[...new Map([...db.movementCatalog.map(g=>[g.id,g.name]),...(selected.movementGroup?[[selected.movementGroup,db.movementCatalog.find(g=>g.id===selected.movementGroup)?.name||selected.movementGroup]]:[])]).entries()].map(([v,l])=>`<option value="${E(v)}" ${v===selected.movementGroup?'selected':''}>${E(l)}</option>`).join('')}</select></label><label class="field"><span class="label">Unidad</span><select name="unit" ${used?'disabled':''}>${[['reps','Repeticiones'],['seconds','Segundos'],['minutes','Minutos']].map(([v,l])=>`<option value="${v}" ${v===(selected.unit||'reps')?'selected':''}>${l}</option>`).join('')}</select>${used?`<input type="hidden" name="unit" value="${E(selected.unit)}">`:''}</label><label class="field"><span class="label">Tipo de carga</span><select name="loadUnit" ${used?'disabled':''}>${['Máquina','Por mancuerna','Por lado','Total','Peso corporal','Sin carga'].map(v=>option(v,selected.loadUnit||'Máquina')).join('')}</select>${used?`<input type="hidden" name="loadUnit" value="${E(selected.loadUnit)}">`:''}</label><label class="field"><span class="label">Nivel</span><select name="level">${['Principiante','Intermedio','Avanzado'].map(v=>option(v,selected.level||'Principiante')).join('')}</select></label><label class="field full row"><input type="checkbox" name="supportsDistance" ${selected.supportsDistance?'checked':''}>Permitir registrar distancia (cardio)</label><label class="field full"><span class="label">Cómo se realiza</span><textarea name="instructions" maxlength="1200" required>${E(selected.instructions||'')}</textarea></label></div>${used?'<p class="small-note">La unidad y el tipo de carga están bloqueados porque existen series guardadas. Puedes editar las instrucciones sin borrar el historial. El nombre de un modelo del inventario se conserva.</p>':''}<p class="small-note">Puedes editar la técnica y los ejercicios libres. El nombre inglés de cada modelo del inventario se conserva; su ID y las cargas anteriores no cambian.</p><div class="modal-actions"><button class="btn primary" type="submit">${e?'Guardar cambios':'Añadir al banco'}</button>${e?`<button type="button" class="btn ghost" data-action="exercise-detail" data-id="${E(e.id)}">Cancelar</button>`:''}</div></form>`);
}

function detailSession(id){
 const s=db.sessions.find(x=>x.id===id);if(!s)return;
 const exs=[...s.exercises].filter(e=>e.sets.some(t=>t.done)).sort((a,b)=>(a.completionOrder??999)-(b.completionOrder??999));
 modal('Sesión · '+niceDate(s.date),`<p class="muted">${E(s.title)} · ${exs.length} ejercicios en orden de realización</p>${exs.map((ex,i)=>{
 const e=exercise(ex.exerciseId),display=ex.name||e.name;
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
 const n=p.sessionsPerWeek,chosen=chooseAvailableDays(p.availableDays,n),focus=p.focus,areas=weeklyAreas(focus,n),catalog=activeExercises(),request=String(p.request||'').trim().slice(0,500);
 const base={area:areas[0],goal:focusGoal(focus),level:p.level,minutes:p.minutesPerSession},first=interpretRequest(request,base),level=first.prefs.level;
 const days=Object.fromEntries(WEEK.map(k=>[k,{title:'Descanso y recuperación',rest:true,exercises:[]}])) ;
 chosen.forEach((weekday,i)=>{const area=areas[i],parsed=interpretRequest(request,{...base,area}),preferences={...parsed.prefs,request,goalOverride:parsed.goalExplicit?parsed.prefs.goal:null};const generated=generateDay(filterRequestedCatalog(catalog,parsed),preferences);if(!generated.exercises.length)throw Error('No hay ejercicios compatibles para '+AREA_LABELS[area]+'. Revisa nivel, petición o inventario.');days[weekday]={...generated,rest:false,preferences};});
 const label=FOCUSES.find(x=>x[0]===focus)?.[1]||focus;
 return {id:uid(),name:`${label} · ${n} días · ${level} · ${madridToday()}`.slice(0,100),createdAt:madridToday(),generated:true,focus,level,minutesPerSession:first.prefs.minutes,split:[...new Set(areas)].map(a=>AREA_LABELS[a]).join(' / ').slice(0,160),days};
}
function doAction(target){const action=target.dataset.action,id=target.dataset.id,index=Number(target.dataset.index),exIdx=Number(target.dataset.ex);
  switch(action){
    case 'custom-new':if(!db.sessionDraft||confirm('¿Sustituir el borrador actual?')){db.sessionDraft={name:'Mi sesión',exercises:[]};persist();navigateTo('custom-session');}break;
    case 'custom-edit':customExerciseModal(Number(target.dataset.index));break;
    case 'custom-remove':if(confirm('¿Quitar este ejercicio del borrador?')){db.sessionDraft.exercises.splice(Number(target.dataset.index),1);persist();closeModal();render();}break;
    case 'custom-move':{const a=db.sessionDraft?.exercises,i=Number(target.dataset.index),j=i+Number(target.dataset.direction);if(a&&i>=0&&i<a.length&&j>=0&&j<a.length){[a[i],a[j]]=[a[j],a[i]];persist();closeModal();render();}break;}
    case 'custom-name':customNameModal();break;
    case 'custom-save':saveTemplate();break;
    case 'custom-start':startCustom();break;
    case 'custom-load':loadTemplate(id);break;
    case 'custom-delete':if(confirm('¿Eliminar esta plantilla? El historial no cambia.')){db.sessionTemplates=db.sessionTemplates.filter(t=>t.id!==id);if(db.sessionDraft?.templateId===id)delete db.sessionDraft.templateId;persist();render();}break;
    case 'custom-active-remove':{const ex=db.activeSession?.exercises.find(x=>x.id===id);if(ex&&ex.completionOrder==null&&!ex.sets.some(t=>t.done||validResult(ex,t))&&confirm('¿Quitar este ejercicio pendiente?')){db.activeSession.exercises=db.activeSession.exercises.filter(x=>x.id!==id);persist();navigateTo('workout');}break;}
    case 'routine-create':routineCreateModal();break;
    case 'draft-manual':openNewDraft('manual',{});break;
    case 'draft-open':dayReview=null;draftEditor();break;
    case 'draft-generate-local':dayGenerateModal();break;
    case 'draft-revise-day':{const q=dayReview?.merged.preferences?.request||'';dayReview=null;dayGenerateModal(q);break;}
    case 'draft-apply-day':applyDayReview();break;
    case 'draft-day':draftEditor(Number(target.dataset.weekday));break;
    case 'draft-add':draftExerciseModal(-1);break;
    case 'draft-edit':draftExerciseModal(index);break;
    case 'draft-remove':if(removeDraftExercise(routineDraft,draftDay,index))draftEditor();break;
    case 'draft-move':if(moveDraftExercise(routineDraft,draftDay,index,Number(target.dataset.direction)))draftEditor();break;
    case 'draft-rest':if(routineDraft&&(!routineDraft.days[draftDay].exercises.length||confirm('¿Quitar todos los ejercicios de este día y marcarlo como descanso?'))){routineDraft.days[draftDay]={title:'Descanso',rest:true,exercises:[]};draftEditor();}break;
    case 'draft-discard':if(confirm('¿Descartar el borrador sin guardar?')){routineDraft=null;closeModal();render();}break;
    case 'draft-save':saveRoutineDraft(target.dataset.activate==='1');break;
    case 'today-plan':selectedDay=madridWeekday(madridToday());navigateTo('plan');break;
    case 'open-workout-exercise':workoutExerciseId=id;navigateTo('workout-exercise');break;
    case 'routine-exercise-detail':{const c=routineContext(target);routineExerciseDetail(c.r,c.dayNo,c.index,c.manager);break;}
    case 'routine-meta':routineMetaModal(db.routines.find(r=>r.id===id));break;
    case 'routine-days':routineDaysModal(db.routines.find(r=>r.id===id));break;
    case 'routine-day':routineDayModal(db.routines.find(r=>r.id===id),Number(target.dataset.weekday));break;
    case 'routine-options':routineOptionsModal(db.routines.find(r=>r.id===id));break;
    case 'routine-model-detail':{const c=routineContext(target);routineModelModal(c.r,c.dayNo,c.index,c.manager,target.dataset.model);break;}
    case 'exercise-instructions':{const e=db.exercises.find(e=>e.id===id);if(e)modal('Cómo se realiza',`${modalBack(`data-action="exercise-detail" data-id="${E(id)}"`,'Ficha')}<h3>${E(e.name)}</h3><p>${E(e.instructions)}</p>`);break;}
    case 'exercise-models':{const e=db.exercises.find(e=>e.id===id);if(e)modal('Máquinas y modelos',`${modalBack(`data-action="exercise-detail" data-id="${E(id)}"`,'Ficha')}${catalogModelsHTML(e)}<p class="small-note">Confirma la presencia de los modelos en tu club.${e.brand&&BRAND_CATALOGS[e.brand]?` <a href="${BRAND_CATALOGS[e.brand]}" target="_blank" rel="noopener noreferrer">Catálogo oficial</a>.`:''}</p>`);break;}
    case 'exercise-variants':{const e=db.exercises.find(e=>e.id===id);if(e)modal('Otras variantes',`${modalBack(`data-action="exercise-detail" data-id="${E(id)}"`,'Ficha')}${exerciseVariants(e)||'<p class="muted">No hay variantes asociadas.</p>'}`);break;}
    case 'library-model-detail':libraryModelModal(db.exercises.find(e=>e.id===id),target.dataset.model);break;
    case 'library-prev':libraryPage=Math.max(1,libraryPage-1);filterLibrary(false);window.scrollTo(0,0);break;
    case 'library-next':libraryPage++;filterLibrary(false);window.scrollTo(0,0);break;

    case 'new-measure':measurementModal();break;
    case 'new-goal':goalModal();break;
    case 'edit-goal':goalModal(id);break;
    case 'delete-goal':if(confirm('¿Borrar este objetivo?')){db.goals=db.goals.filter(g=>g.id!==id);persist();render();toast('Objetivo eliminado');}break;
    case 'planner-open':plannerModal();break;
    case 'edit-measure':measurementModal(id);break;
    case 'delete-measure':if(confirm('¿Eliminar esta medición?')){db.measurements=db.measurements.filter(m=>m.id!==id);persist();render();toast('Medición eliminada');}break;
    case 'start-session':if((activeRoutine().days[selectedDay]?.exercises||[]).some(rx=>!isActiveExercise(rx.exerciseId))){toast('El plan contiene equipos retirados. Edita los ejercicios antes de iniciar.',true);break;}if(db.activeSession){toast('Termina primero tu sesión actual',true);break;}db.activeSession=makeSession(selectedDay);persist();navigateTo('workout');break;
    case 'free-session':if(db.activeSession){toast('Termina primero la sesión actual',true);break;}db.activeSession=makeSession(view==='plan'?selectedDay:madridWeekday(madridToday()),true);persist();navigateTo('workout');sessionAddModal();break;
    case 'session-add':sessionAddModal();break;
    case 'finish-exercise':{const ex=db.activeSession?.exercises[exIdx];if(!ex)break;
      const valid=ex.sets.filter(t=>validResult(ex,t));
      if(!valid.length){toast('Introduce reps, segundos o minutos/km en al menos una serie.',true);break;}
      if(valid.some(t=>t.load!=null&&(t.load<0||t.load>1000))){toast('Revisa los kilos.',true);return;}
      for(const t of ex.sets)t.done=validResult(ex,t);
      ex.completionOrder=1+Math.max(0,...db.activeSession.exercises.map(x=>x.completionOrder||0));ex.finishedAt=new Date().toISOString();
      persist();navigateTo('workout');toast(`Ejercicio ${ex.completionOrder} guardado`);break;}
    case 'reopen-exercise':{const ex=db.activeSession?.exercises[exIdx];if(!ex)break;ex.completionOrder=null;ex.finishedAt=null;ex.sets.forEach(t=>{t.done=false;});persist();renderKeepScroll();break;}
    case 'finish-session':{
      const s=db.activeSession;if(!s)break;
      // If user filled series but forgot the per-exercise button, preserve those without demanding all planned exercises.
      let order=Math.max(0,...s.exercises.map(e=>e.completionOrder||0));
      for(const ex of s.exercises){
        if(ex.completionOrder==null){
          ex.sets.forEach(t=>{t.done=validResult(ex,t);});
          if(ex.sets.some(t=>t.done)){ex.completionOrder=++order;ex.finishedAt=new Date().toISOString();}
        }
      }
      const done=s.exercises.filter(ex=>ex.sets.some(t=>t.done));
      if(!done.length){toast('Registra al menos un ejercicio; puedes guardar solo lo que hayas hecho.',true);break;}
      for(const ex of done){for(const t of ex.sets.filter(t=>t.done)){if(!validResult(ex,t)){toast('Revisa las series completadas de '+ex.name,true);return;}}}
      s.status='completed';s.exercises=done.sort((a,b)=>(a.completionOrder??999)-(b.completionOrder??999));
      s.exercises.forEach(ex=>ex.sets=ex.sets.filter(t=>t.done));
      s.endedAt=new Date().toISOString();db.sessions.push(s);db.activeSession=null;
      persist();navigateTo('training');toast('¡Sesión guardada con los ejercicios realizados y en su orden real!');break;
    }
    case 'cancel-session':if(confirm('¿Descartar la sesión en curso?')){db.activeSession=null;persist();navigateTo('training');}break;
    case 'add-set':{const ex=db.activeSession?.exercises[exIdx];if(!ex)break;if(ex.sets.length>=30){toast('Máximo 30 series',true);break;}const last=ex.sets.at(-1);ex.sets.push({id:uid(),load:last?.load??null,reps:null,seconds:null,minutes:null,distanceKm:null,inclinePct:null,rir:null,done:false});persist();renderKeepScroll();break;}
    case 'remove-set':{const ex=db.activeSession?.exercises[exIdx];if(ex&&ex.sets.length>1){ex.sets.pop();persist();renderKeepScroll();}break;}
    case 'session-detail':detailSession(id);break;
    case 'delete-session':if(confirm('¿Borrar esta sesión del historial?')){db.sessions=db.sessions.filter(s=>s.id!==id);persist();render();toast('Sesión borrada');}break;
    case 'routine-manage':routineManager(db.routines.find(r=>r.id===id));break;
    case 'routine-edit':{const c=routineContext(target);routineModal(c.index,false,c.r,c.dayNo,c.manager);break;}
    case 'routine-add':{const c=routineContext(target);routineModal(-1,true,c.r,c.dayNo,c.manager);break;}
    case 'routine-remove':{const c=routineContext(target),d=c.r?.days[c.dayNo];if(d?.exercises[c.index]&&confirm('¿Quitar este ejercicio del día?')){d.exercises.splice(c.index,1);d.rest=!d.exercises.length;persist();closeModal();render();if(c.manager)routineDayModal(c.r,c.dayNo);}break;}
    case 'routine-copy':{const current=id?db.routines.find(r=>r.id===id):activeRoutine();if(!current?.id)break;const name=prompt('Nombre de la nueva versión de rutina:',`${current.name} (versión nueva)`);if(!name?.trim())break;const copy=JSON.parse(JSON.stringify(current));copy.id=uid();copy.name=name.trim().slice(0,100);copy.createdAt=madridToday();db.routines.push(copy);db.activeRoutineId=copy.id;persist();closeModal();render();toast('Nueva versión activada');break;}
    case 'routine-delete':{const r=db.routines.find(r=>r.id===id);if(!r)break;if(db.activeSession?.routineId===id){toast('Finaliza o descarta la sesión en curso antes de eliminar esta rutina.',true);break;}if(!confirm(`¿Eliminar «${r.name}»? Las sesiones y cargas históricas se conservarán.`))break;db.routines=db.routines.filter(x=>x.id!==id);if(db.activeRoutineId===id)db.activeRoutineId=db.routines[0]?.id??null;persist();closeModal();render();toast('Rutina eliminada; historial conservado');break;}
    case 'routine-machines':{const c=routineContext(target);machineModal(c.r,c.dayNo,c.index,c.manager);break;}
    case 'machine-status':{const c=routineContext(target),rx=c.r?.days[c.dayNo]?.exercises[c.index],v=rx&&modelOptions(exercise(rx.exerciseId)).find(x=>x.key===target.dataset.model);if(!v)break;const status=target.dataset.status;if(!['confirmada','no_disponible','sin_verificar'].includes(status))break;db.machineAvailability[inventoryKey(v)]=status;persist();render();routineModelModal(c.r,c.dayNo,c.index,c.manager,v.key);break;}
    case 'machine-use':{const c=routineContext(target);useMachine(c.r,c.dayNo,c.index,target.dataset.model,c.manager);break;}
    case 'routine-use-exercise':{const c=routineContext(target);if(replaceRoutineExercise(c.r,c.dayNo,c.index,target.dataset.exercise)){persist();render();machineModal(c.r,c.dayNo,c.index,c.manager);toast('Variante actualizada');}break;}
    case 'routine-activate':if(db.routines.some(r=>r.id===id)){db.activeRoutineId=id;persist();closeModal();render();toast('Rutina activada');}break;
    case 'library-machine-status':{const e=db.exercises.find(x=>x.id===id),v=e&&modelOptions(e).find(v=>v.key===target.dataset.model),status=target.dataset.status;if(v&&['confirmada','no_disponible','sin_verificar'].includes(status)){db.machineAvailability[inventoryKey(v)]=status;persist();libraryModelModal(e,v.key);}break;}
    case 'exercise-detail':exerciseModal(id);break;
    case 'exercise-edit':exerciseModal(id,'edit');break;
    case 'new-exercise':exerciseModal();break;
    case 'delete-exercise':{if(db.sessionDraft?.exercises.some(x=>x.exerciseId===id)||db.sessionTemplates.some(t=>t.exercises.some(x=>x.exerciseId===id))||db.routines.some(r=>Object.values(r.days).some(d=>d.exercises.some(rx=>rx.exerciseId===id)))||db.sessions.some(s=>s.exercises.some(e=>e.exerciseId===id))||db.activeSession?.exercises.some(e=>e.exerciseId===id)){toast('Este ejercicio figura en alguna rutina o sesión; no se puede borrar.',true);break;}if(confirm('¿Eliminar ejercicio personalizado?')){db.exercises=db.exercises.filter(e=>e.id!==id);persist();closeModal();render();}}break;
    case 'export':doExport();break;
    case 'reset':if(confirm('Esta acción borra TODAS tus medidas, sesiones y cambios de rutina de este navegador. ¿Has exportado una copia JSON?')){if(confirm('Última confirmación: ¿borrar todos los datos locales?')){localStorage.removeItem(STORAGE_KEY);location.reload();}}break;
    case 'body-side':bodyViewSide=target.dataset.side==='BACK'?'BACK':'FRONT';renderKeepScroll();break;
    case 'load-detail':loadDetailModal(id);break;
    case 'choose-body-metric':chartMetric=target.dataset.metric;anatomySelectedId=null;renderKeepScroll();break;
    case 'goto-metric-chart':navigateTo('charts');break;
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
   const exId=String(fd.get('exerciseId')||''),sets=Number(fd.get('sets'));if(!db.activeSession||!isActiveExercise(exId)||!Number.isInteger(sets)||sets<1||sets>20){toast('Elige un ejercicio y un número válido de series.',true);return;}
   const found=exercise(exId);db.activeSession.exercises.push(makeSessionExercise(exId,found.unit==='minutes'?1:sets));persist();closeModal();renderKeepScroll();toast('Ejercicio añadido a la sesión');
 }else if(form.id==='plannerForm'){
   const available=[...fd.getAll('availableDay')].map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=7).sort((a,b)=>a-b),n=Number(fd.get('sessionsPerWeek')),
   minutes=Number(fd.get('minutesPerSession')),focus=String(fd.get('focus')||'equilibrado'),level=String(fd.get('level')||'intermedio');
   if(n<1||n>6||!Number.isInteger(n)||available.length<n||!VALID_FOCUSES.includes(focus)||!['principiante','intermedio','avanzado'].includes(level)||![35,45,60,65,75,90].includes(minutes)){
      toast('Marca al menos tantos días disponibles como sesiones activas (máximo 6).',true);return;
   }
   const newPlanner={availableDays:available,sessionsPerWeek:n,minutesPerSession:minutes,focus,level,request:String(fd.get('plannerRequest')||'').trim().slice(0,500)};
   let proposal;try{proposal=generateRoutine(newPlanner);}catch(err){return toast(err.message,true);}db.planner=newPlanner;const name=String(fd.get('routineName')||'').trim();if(name)proposal.name=name.slice(0,100);if(openNewDraft('local',proposal))persist();
 }else if(form.id==='routineMetaForm'){
   const r=db.routines.find(r=>r.id===form.dataset.id);if(!r)return;const name=String(fd.get('name')||'').trim(),focus=String(fd.get('focus')||''),minutes=num(fd.get('minutesPerSession'));if(!name||name.length>100||(focus&&!VALID_FOCUSES.includes(focus))||(minutes!=null&&(!Number.isInteger(minutes)||minutes<10||minutes>240))){toast('Revisa los datos de la rutina.',true);return;}Object.assign(r,{name,focus,minutesPerSession:minutes,split:String(fd.get('split')||'').trim().slice(0,80)});persist();render();routineManager(r);toast('Datos de rutina guardados');
 }else if(form.hasAttribute('data-routine-day-form')||form.hasAttribute('data-routine-move-form')){
   const c=routineContext(form),d=c.r?.days[c.dayNo];if(!d)return;
   if(form.hasAttribute('data-routine-day-form')){const title=String(fd.get('title')||'').trim();if(!title)return;d.title=title.slice(0,100);}else{const dest=Number(fd.get('destination'));if(!c.r.days[dest]||dest===c.dayNo)return;[c.r.days[c.dayNo],c.r.days[dest]]=[c.r.days[dest],c.r.days[c.dayNo]];}persist();render();routineDayModal(c.r,c.dayNo);toast('Día actualizado');
 }else if(form.id==='modelUseForm'){
   const c=routineContext(form),rx=c.r?.days[c.dayNo]?.exercises[c.index];if(!rx)return;const e=exercise(rx.exerciseId),v=modelOptions(e).find(v=>v.key===form.dataset.model),loadUnit=String(fd.get('loadUnit')||'');if(!v||machineStatus(v)==='no_disponible'||!['Máquina','Por lado','Total','Sin carga'].includes(loadUnit))return;const id=uid();db.exercises.push({id,name:v.modelo,muscle:e.muscle,equipment:e.unit==='minutes'?'Cardio':'Máquina',unit:e.unit,loadUnit,level:e.level,instructions:v.exerciseId?exercise(v.exerciseId).instructions:(db.exercises.find(x=>machineGroup(x)===machineGroup(e)&&x.equipment==='Máquina'&&!x.brand)?.instructions||'Ajusta el equipo según sus instrucciones, realiza el movimiento con control y revisa el recorrido antes de añadir carga.'),brand:v.marca,machineLine:v.linea||'',modelName:v.modelo,modelCode:v.codigo||'',movementGroup:machineGroup(e),variantKey:v.key,custom:true,userEdited:true,catalogVerified:false,supportsDistance:!!e.supportsDistance});replaceRoutineExercise(c.r,c.dayNo,c.index,id);persist();render();machineModal(c.r,c.dayNo,c.index,c.manager);toast('Modelo guardado como ficha independiente');
 }else if(form.id==='routineForm'){
   const c=routineContext(form),day=c.r?.days[c.dayNo];if(!day)return;const idx=c.index,sets=Number(fd.get('sets')),min=Number(fd.get('min')),max=Number(fd.get('max')),load=num(fd.get('suggestedKg'));
   if(!isActiveExercise(fd.get('exerciseId'))||!Number.isInteger(sets)||sets<1||sets>20||!Number.isInteger(min)||!Number.isInteger(max)||min<1||max>600||max<min||Number.isNaN(load)||(load!=null&&(load<0||load>500))){toast('Revisa series, repeticiones y kilos.',true);return;}
   const previous=day.exercises[idx],newId=String(fd.get('exerciseId')),newEx=exercise(newId);const safeLoad=previous&&previous.exerciseId!==newId?lastLoad(newId):load;const rx={exerciseId:newId,sets,min,max,suggestedKg:newEx.unit==='minutes'||['Sin carga','Peso corporal'].includes(newEx.loadUnit)?null:safeLoad,notes:String(fd.get('notes')||'').slice(0,1000),perSide:fd.has('perSide'),optional:fd.has('optional')};if(idx<0){day.exercises.push(rx);if(day.rest){day.rest=false;day.title='Entrenamiento extra';}}else day.exercises[idx]=rx;day.rest=false;persist();closeModal();render();if(c.manager)routineDayModal(c.r,c.dayNo);toast('Rutina actualizada');
 }else if(form.id==='exerciseForm'){
   const id=String(form.dataset.id||''),old=id?db.exercises.find(x=>x.id===id):null;
   if(id&&!old){toast('Ejercicio no encontrado.',true);return;}
   if(old?.archived){toast('Ficha histórica: no se puede editar. Crea o elige una ficha del catálogo activo.',true);return;}
   const name=String(fd.get('name')||'').trim(),instructions=String(fd.get('instructions')||'').trim(),muscle=String(fd.get('muscle')||'').trim(),
    equipment=String(fd.get('equipment')||''),unit=String(fd.get('unit')||''),loadUnit=String(fd.get('loadUnit')||''),level=String(fd.get('level')||''),
    brand=['Máquina','Cardio','Polea'].includes(equipment)?String(fd.get('brand')||''):'',machineLine=brand?String(fd.get('machineLine')||'').trim():'';
   if(name.length<2||name.length>100||!muscle||muscle.length>40||!instructions||instructions.length>1200||!['Máquina','Mancuernas','Polea','Barra','Peso corporal','Cardio','Otro'].includes(equipment)||!['reps','seconds','minutes'].includes(unit)||!['Máquina','Por mancuerna','Por lado','Total','Peso corporal','Sin carga'].includes(loadUnit)||!['Principiante','Intermedio','Avanzado'].includes(level)||!(brand===''||MACHINE_BRANDS.includes(brand))){toast('Revisa los campos del ejercicio.',true);return;}
   if(['Máquina','Cardio'].includes(equipment)||brand){if(!old||old.archived||old.equipment!==equipment||old.brand!==brand||old.machineLine!==machineLine||String(old.modelName||'')!==String(fd.get('modelName')||'').trim()||String(old.modelCode||'')!==String(fd.get('modelCode')||'').trim()){toast('Solo se permiten máquinas del inventario revisado. Para ampliar el inventario, actualiza el catálogo.',true);return;}}
   if(old?.brand&&(old.equipment!==equipment||old.brand!==brand)){toast('Conserva la identidad de la máquina; crea otra ficha para peso libre.',true);return;}
   const hasHistory=old&&(db.sessions.some(s=>s.exercises?.some(x=>x.exerciseId===id))||db.activeSession?.exercises?.some(x=>x.exerciseId===id));
   if(hasHistory&&(old.unit!==unit||old.loadUnit!==loadUnit)){toast('No se puede cambiar la unidad o tipo de carga de un ejercicio con sesiones guardadas.',true);return;}
   const props={name:old?.brand?old.name:name.slice(0,100),muscle:muscle.slice(0,40),equipment,unit,loadUnit,instructions:instructions.slice(0,1200),level,brand,machineLine:machineLine.slice(0,80),modelName:brand?String(fd.get('modelName')||'').trim().slice(0,100):'',modelCode:brand?String(fd.get('modelCode')||'').trim().slice(0,40):'',movementGroup:String(fd.get('movementGroup')||'')||null,supportsDistance:unit==='minutes'&&fd.has('supportsDistance')};
   if(old?.brand && old.movementGroup!==props.movementGroup){toast('El grupo de una máquina del inventario no se puede cambiar desde esta ficha.',true);return;}
   if(old){if(old.movementGroup!==props.movementGroup||old.brand!==props.brand||old.machineLine!==props.machineLine||old.modelName!==props.modelName||old.modelCode!==props.modelCode){delete old.variantKey;delete old.machineVariants;delete old.materialOptions;}Object.assign(old,props,{userEdited:true,catalogVerified:false});}
   else db.exercises.push({id:uid(),...props,custom:true,userEdited:true,catalogVerified:false});
   persist();closeModal();render();toast(old?'Cambios guardados sin perder el historial':'Ejercicio añadido al banco');
 }}
function filterLibrary(reset=true){if(reset)libraryPage=1;libraryFilters={q:document.getElementById('exerciseSearch')?.value||'',muscle:document.getElementById('muscleFilter')?.value||'Todos',level:document.getElementById('levelFilter')?.value||'Todos',brand:document.getElementById('brandFilter')?.value||'Todas',open:!!document.querySelector('#exerciseSearch')?.parentElement.querySelector('details')?.open};const level=document.getElementById('levelFilter')?.value||'Todos',q=normalizeExerciseQuery(document.getElementById('exerciseSearch')?.value||''),muscle=document.getElementById('muscleFilter')?.value||'Todos',brand=document.getElementById('brandFilter')?.value||'Todas',items=[...document.querySelectorAll('[data-library-item]')],matches=items.filter(el=>exerciseSearchScore(JSON.parse(el.dataset.text),q)>=0&&(muscle==='Todos'||el.dataset.muscle===muscle)&&(level==='Todos'||el.dataset.level===level)&&(brand==='Todas'||el.dataset.brand===brand)).sort((a,b)=>exerciseSearchScore(JSON.parse(b.dataset.text),q)-exerciseSearchScore(JSON.parse(a.dataset.text),q)),pages=Math.max(1,Math.ceil(matches.length/20));libraryPage=Math.min(libraryPage,pages);const shown=new Set(matches.slice((libraryPage-1)*20,libraryPage*20));items.forEach(el=>el.hidden=!shown.has(el));const results=document.getElementById('exerciseResults');matches.forEach(el=>results?.append(el));const count=document.getElementById('libraryCount'),page=document.getElementById('libraryPage'),pager=document.getElementById('libraryPager');if(count)count.textContent=matches.length?`${matches.length} ejercicios · ${shown.size} en esta página`:'No se encontraron ejercicios';if(page)page.textContent=`${libraryPage} / ${pages}`;if(pager){pager.querySelector('[data-action="library-prev"]').disabled=libraryPage<=1;pager.querySelector('[data-action="library-next"]').disabled=libraryPage>=pages;pager.hidden=pages<=1;}}
window.addEventListener('hashchange',()=>{const next=viewFromHash(),nextExercise=next==='workout-exercise'?decodeWorkoutId():null;if(view!==next||(next==='workout-exercise'&&workoutExerciseId!==nextExercise)){view=next;workoutExerciseId=nextExercise;closeModal();render();window.scrollTo(0,0);}});
document.addEventListener('click',e=>{
 const option=e.target.closest('[data-combo-option]');if(option){e.preventDefault();chooseExerciseCombo(option);return;}
 const toggle=e.target.closest('[data-combo-toggle]');if(toggle){e.preventDefault();const combo=toggle.closest('[data-exercise-combobox]');if(combo.querySelector('[data-combo-panel]').hidden)openExerciseCombo(combo);else closeExerciseCombo(combo);return;}
 const search=e.target.closest('[data-combo-search]');if(search){const combo=search.closest('[data-exercise-combobox]');if(combo.querySelector('[data-combo-panel]').hidden)openExerciseCombo(combo);return;}
 if(!e.target.closest('[data-exercise-combobox]'))document.querySelectorAll('[data-exercise-combobox]').forEach(closeExerciseCombo);
 const nav=e.target.closest('[data-nav]');if(nav){navigateTo(nav.dataset.nav);return;}
 const day=e.target.closest('[data-day]');if(day){selectedDay=Number(day.dataset.day);render();return;}
 const a=e.target.closest('[data-action]');if(a){e.preventDefault();doAction(a);}
 if(e.target.classList.contains('modal-backdrop'))closeModal();
});
document.addEventListener('keydown',e=>{
 if(e.target.matches('[data-combo-search]')){
   const combo=e.target.closest('[data-exercise-combobox]');
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){
     e.preventDefault();if(combo.querySelector('[data-combo-panel]').hidden)openExerciseCombo(combo);
     activeExerciseComboOption(combo,e.key==='ArrowDown'?1:-1);return;
   }
   if(e.key==='Enter'&&!combo.querySelector('[data-combo-panel]').hidden){
     e.preventDefault();const active=combo.querySelector('[data-combo-option].is-active:not([hidden])');const visible=combo.querySelectorAll('[data-combo-option]:not([hidden])');if(active)chooseExerciseCombo(active);else if(combo.querySelector('[data-combo-value]').value)closeExerciseCombo(combo);else if(visible.length===1)chooseExerciseCombo(visible[0]);else if(visible.length>1)activeExerciseComboOption(combo,1);return;
   }
   if(e.key==='Escape'&&!combo.querySelector('[data-combo-panel]').hidden){e.preventDefault();e.stopPropagation();closeExerciseCombo(combo);return;}

 }
 if(e.key==='Escape'&&showingModal)closeModal();
 if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-body-metric]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
});
document.addEventListener('focusin',e=>{if(e.target.matches('[data-combo-search]')){
 const combo=e.target.closest('[data-exercise-combobox]');const selected=combo.querySelector('[data-combo-value]').value;
 if(selected)e.target.select();if(combo.querySelector('[data-combo-panel]').hidden)openExerciseCombo(combo);
}});

document.addEventListener('submit',e=>{if(e.target.id==='draftDayGenerateForm'){e.preventDefault();submitDayGeneration(e.target);return;}if(e.target.id==='draftExerciseForm'){e.preventDefault();submitDraftExercise(e.target);return;}if(['customExerciseForm','customNameForm'].includes(e.target.id)){e.preventDefault();submitCustom(e.target);return;}if(['measureForm','profileForm','routineForm','exerciseForm','goalForm','sessionAddForm','plannerForm','routineMetaForm','modelUseForm'].includes(e.target.id)||e.target.hasAttribute('data-routine-day-form')||e.target.hasAttribute('data-routine-move-form')){e.preventDefault();formSubmit(e.target);}});
document.addEventListener('change',e=>{
 if(e.target.matches('[data-combo-material],[data-combo-muscle]')){const combo=e.target.closest('[data-exercise-combobox]');filterExerciseCombo(combo,comboQuery(combo));return;}
 if(routineDraft&&e.target.dataset.dayPref){const d=routineDraft.days[draftDay],p=dailyPrefs(d),key=e.target.dataset.dayPref;p[key]=key==='minutes'?Number(e.target.value):e.target.value;d.preferences=p;return;}
 if(routineDraft&&e.target.id==='draftFocus'){routineDraft.focus=e.target.value;const p=dailyPrefs(routineDraft.days[draftDay]),el=document.querySelector('[data-general-goal]');if(el)el.textContent=`Objetivo ${p.goalOverride?'ajustado por chat':'general'}: ${GOAL_LABELS[p.goal]}.`;return;}
 if(routineDraft&&e.target.id==='draftMinutes'){routineDraft.minutesPerSession=e.target.value?Number(e.target.value):null;return;}
 if(e.target.matches('input[name="appTheme"]')){if(e.target.checked)changeTheme(e.target.value);return;}
 if(e.target.id==='chartMetric'){chartMetric=e.target.value;render();return;}
 if(e.target.id==='muscleFilter'||e.target.id==='levelFilter'||e.target.id==='brandFilter'){filterLibrary();return;}
 if(e.target.id==='importFile'){doImport(e.target.files[0]);e.target.value='';return;}
 if(e.target.hasAttribute('data-session-date')){const date=e.target.value;if(validDate(date)&&date<=madridToday()){db.activeSession.date=date;persist();}else{toast('Fecha de sesión no válida.',true);render();}return;}
});
document.addEventListener('input',e=>{
 if(routineDraft&&e.target.id==='draftName'){routineDraft.name=e.target.value;return;}
 if(routineDraft&&e.target.id==='draftDayTitle'){routineDraft.days[draftDay].title=e.target.value;return;}
 if(e.target.id==='exerciseSearch'){filterLibrary();return;}
 if(e.target.id==='loadsSearch'){const q=e.target.value.toLocaleLowerCase('es').trim();document.querySelectorAll('[data-load-item]').forEach(el=>{el.hidden=!el.dataset.text.includes(q);});return;}
 if(e.target.matches('[data-combo-search]')){
   const combo=e.target.closest('[data-exercise-combobox]');
   combo.querySelector('[data-combo-value]').value='';
   combo.querySelectorAll('[data-combo-option]').forEach(o=>o.setAttribute('aria-selected','false'));
   combo.querySelector('[data-combo-selection]').hidden=true;
   openExerciseCombo(combo);
   return;
 }
 const el=e.target;if(!el.hasAttribute('data-set-field')||!db.activeSession)return;
 const ex=db.activeSession.exercises[Number(el.dataset.ex)],set=ex?.sets[Number(el.dataset.set)];if(!set)return;
 const field=el.dataset.setField,v=num(el.value);if(Number.isNaN(v)||(v!=null&&(v<0||v>(field==='minutes'?600:field==='distanceKm'?200:field==='inclinePct'?40:1000))))return;
 set[field]=v;set.done=false;persist();
});
// NIVEL 5.1: editable session drafts and local session planning.
function targetText(rx){const e=exercise(rx.exerciseId);return `${rx.sets} × ${rx.min}${rx.max!==rx.min?'–'+rx.max:''} ${unitLabel(e.unit,rx.perSide)}${rx.suggestedKg!=null?' · '+fmtNum(rx.suggestedKg)+' kg':''}`;}
function customSessionHTML(){const d=db.sessionDraft;return `${pageBack('training','Entrenar')}${header('Crear sesión','Construye tu entrenamiento a tu manera.')}${!d?`<button class="btn primary block" data-action="custom-new">+ Empezar desde cero</button><div class="section">${menuGroup(menuLink('Mis plantillas','Reutiliza una sesión','data-nav="session-templates"','▤')+menuLink('Asistente NIVEL','Prepara un día en el editor semanal','data-action="draft-manual"','✦'))}</div>`:`<div class="card row-between"><div><h2>${E(d.name)}</h2><small>${d.exercises.length} ejercicios · borrador guardado</small></div><button class="btn small" data-action="custom-name">Renombrar</button></div><section class="section"><h2>Ejercicios</h2>${d.exercises.length?menuGroup(d.exercises.map((rx,i)=>menuLink(fullExerciseName(exercise(rx.exerciseId)),targetText(rx),`data-action="custom-edit" data-index="${i}"`,String(i+1))).join('')):'<p class="muted">Añade los ejercicios que quieras hacer.</p>'}<button class="btn block section" data-action="custom-edit" data-index="-1">+ Añadir ejercicio</button></section><div class="stack section"><button class="btn primary block" data-action="custom-start" ${!d.exercises.length||db.activeSession?'disabled':''}>Iniciar entrenamiento</button>${db.activeSession?'<small>Finaliza la sesión en curso antes de empezar otra.</small>':''}<button class="btn block" data-action="custom-save" ${!d.exercises.length?'disabled':''}>Guardar como plantilla</button><button class="btn ghost block" data-action="custom-new">Nuevo borrador</button></div>`}`;}
function templatesHTML(){return `${pageBack('training','Entrenar')}${header('Mis sesiones personalizadas','Plantillas reutilizables, independientes de las rutinas semanales.')}<button class="btn primary block" data-nav="custom-session">Abrir creador de sesiones</button><section class="section stack">${db.sessionTemplates.map(t=>`<div class="card"><h3>${E(t.name)}</h3><p class="muted">${t.exercises.length} ejercicios</p><div class="row wrap"><button class="btn" data-action="custom-load" data-id="${E(t.id)}">Abrir y editar</button><button class="btn danger small" data-action="custom-delete" data-id="${E(t.id)}">Eliminar</button></div></div>`).join('')||'<p class="muted">Todavía no tienes plantillas.</p>'}</section>`;}
function customNameModal(){if(db.sessionDraft)modal('Nombre de la sesión',`<form id="customNameForm"><label class="field"><span class="label">Nombre</span><input name="name" required maxlength="100" value="${E(db.sessionDraft.name)}"></label><button class="btn primary block section">Guardar</button></form>`);}
function customExerciseModal(i){const d=db.sessionDraft;if(!d||(!Number.isInteger(i))||i>=d.exercises.length||i< -1)return;const rx=d.exercises[i],e=rx&&exercise(rx.exerciseId);modal(rx?'Editar ejercicio':'Añadir ejercicio',`<form id="customExerciseForm" data-index="${i}"><label class="field"><span class="label">Ejercicio o máquina</span></label>${exerciseComboboxHTML('customExercise',rx?.exerciseId||'')}<div class="form-grid section"><label class="field"><span class="label">Series</span><input type="number" name="sets" min="1" max="20" required value="${rx?.sets??3}"></label><label class="field"><span class="label">Mín. reps / seg / min</span><input type="number" name="min" min="1" max="600" required value="${rx?.min??8}"></label><label class="field"><span class="label">Máx. reps / seg / min</span><input type="number" name="max" min="1" max="600" required value="${rx?.max??12}"></label><label class="field"><span class="label">Peso orientativo (kg)</span><input name="kg" inputmode="decimal" value="${rx?.suggestedKg??''}"></label></div><details class="secondary-details section"><summary>Más opciones</summary><label class="field section"><span class="label">Notas y descansos</span><textarea name="notes" maxlength="500">${E(rx?.notes||'')}</textarea></label><label class="row section"><input type="checkbox" name="perSide" ${rx?.perSide?'checked':''}> Por lado</label></details>${e?`<p class="small-note">${E(e.unit)} · ${E(e.loadUnit)}. Cambiar de máquina no conserva los kilos anteriores.</p>`:''}<button class="btn primary block section">Guardar ejercicio</button></form>${rx?`<div class="section stack"><div class="row wrap"><button class="btn small" data-action="custom-move" data-index="${i}" data-direction="-1" ${i===0?'disabled':''}>↑ Subir</button><button class="btn small" data-action="custom-move" data-index="${i}" data-direction="1" ${i===d.exercises.length-1?'disabled':''}>↓ Bajar</button></div><button class="btn danger block" data-action="custom-remove" data-index="${i}">Quitar ejercicio</button></div>`:''}`);}
function validRx(rx){const e=activeExercises().find(e=>e.id===rx?.exerciseId);return !!e&&Number.isInteger(rx.sets)&&rx.sets>=1&&rx.sets<=20&&Number.isInteger(rx.min)&&Number.isInteger(rx.max)&&rx.min>=1&&rx.max>=rx.min&&rx.max<=600;}
function saveTemplate(){const d=db.sessionDraft;if(!d?.exercises.length||!d.exercises.every(validRx))return toast('Revisa los ejercicios del borrador.',true);const i=db.sessionTemplates.findIndex(t=>t.id===d.templateId);if(i<0&&db.sessionTemplates.length>=100)return toast('Máximo 100 plantillas.',true);const t={id:i>=0?d.templateId:uid(),name:d.name,exercises:structuredClone(d.exercises)};if(i>=0)db.sessionTemplates[i]=t;else db.sessionTemplates.push(t);d.templateId=t.id;persist();toast('Plantilla guardada');}
function loadTemplate(id){const t=db.sessionTemplates.find(x=>x.id===id);if(!t)return;if(db.sessionDraft&&db.sessionDraft.templateId!==id&&!confirm('¿Abrir esta plantilla y sustituir el borrador actual?'))return;db.sessionDraft={name:t.name,templateId:t.id,exercises:structuredClone(t.exercises)};persist();navigateTo('custom-session');}
function startCustom(){const d=db.sessionDraft;if(db.activeSession)return toast('Termina primero tu sesión actual.',true);if(!d?.exercises.length||!d.exercises.every(validRx))return toast('Revisa los ejercicios del borrador.',true);const s=makeSession(madridWeekday(madridToday()),true);s.title=d.name;s.routineId=null;s.exercises=d.exercises.map(rx=>{const ex=makeSessionExercise(rx.exerciseId,rx.sets,rx.perSide,rx.suggestedKg);if(rx.suggestedKg!=null&&ex.sets[0]?.load!=null)ex.sets[0].load=rx.suggestedKg;return {...ex,target:structuredClone(rx)};});db.activeSession=s;persist();navigateTo('workout');}
async function submitCustom(form){const fd=new FormData(form);if(form.id==='customNameForm'){const name=String(fd.get('name')||'').trim();if(!name)return;db.sessionDraft.name=name.slice(0,100);persist();closeModal();render();return;}if(form.id==='customExerciseForm'){const d=db.sessionDraft,i=Number(form.dataset.index),old=d?.exercises[i],id=String(fd.get('exerciseId')||''),e=exercise(id),kg=num(fd.get('kg'));const rx={exerciseId:id,sets:Number(fd.get('sets')),min:Number(fd.get('min')),max:Number(fd.get('max')),perSide:fd.has('perSide'),notes:String(fd.get('notes')||'').slice(0,500),suggestedKg:e.unit==='minutes'||['Sin carga','Peso corporal'].includes(e.loadUnit)||(old&&old.exerciseId!==id)?null:kg};if(!d||!validRx(rx)||!Number.isInteger(i)||i< -1||i>=d.exercises.length||Number.isNaN(kg)||(kg!=null&&(kg<0||kg>1000)))return toast('Selecciona un ejercicio y revisa los valores.',true);if(i===-1){if(d.exercises.length>=50)return toast('Máximo 50 ejercicios.',true);d.exercises.push(rx);}else d.exercises[i]=rx;persist();closeModal();render();return;}}

// One editor for the two routine creation modes. Drafts are in memory until saved.
let routineDraft=null,draftDay=1;
function routineCreateModal(){modal('Crear rutina',`<p class="muted">Elige cómo quieres construir tu semana.</p>${menuGroup(menuLink('Asistente NIVEL','Genera una semana según días, objetivo y nivel.','data-action="planner-open"','◈')+menuLink('Rutina manual','Empieza desde cero y configura cada día.','data-action="draft-manual"','＋'))}${routineDraft?`<button class="btn block section" data-action="draft-open">Continuar borrador · ${E(routineDraft.name)}</button>`:''}<p class="small-note">Las dos opciones abren el mismo editor antes de guardar. No modifican tu rutina activa.</p>`);}
function openNewDraft(source,proposal){if(routineDraft&&!confirm('¿Sustituir el borrador de rutina sin guardar?'))return false;dayReview=null;routineDraft=createRoutineDraft(source,proposal);draftDay=WEEK.find(k=>!routineDraft.days[k].rest)||1;navigateTo('routines');draftEditor();return true;}
function draftEditor(k=draftDay){if(!routineDraft||!WEEK.includes(k))return;draftDay=k;const r=routineDraft,d=r.days[k],count=WEEK.filter(n=>r.days[n].exercises.length).length;modal('Editar nueva rutina',`<div class="eyebrow">BORRADOR · ${E(({local:'AUTOMÁTICA',manual:'MANUAL'})[r.source]||'RUTINA')}</div><label class="field section"><span class="label">Nombre de la rutina</span><input id="draftName" maxlength="100" value="${E(r.name)}"></label><details class="secondary-details section"><summary>Objetivo y duración</summary><label class="field section"><span class="label">Objetivo</span><select id="draftFocus"><option value="">Sin especificar</option>${groupedOptions(FOCUS_GROUPS,r.focus)}</select></label><label class="field section"><span class="label">Minutos por sesión (opcional)</span><input type="number" id="draftMinutes" min="10" max="240" value="${r.minutesPerSession??''}"></label></details><div class="day-list draft-week section">${WEEK.map(n=>`<button class="day-chip ${n===k?'selected':''}" data-action="draft-day" data-weekday="${n}" aria-pressed="${n===k}"><small>${DAYS[n]}</small><b>${r.days[n].exercises.length||'—'}</b></button>`).join('')}</div><div class="row-between section"><h3>${FULL_DAYS[k]}</h3><span class="pill">${d.exercises.length} ejercicios</span></div><label class="field"><span class="label">Nombre del día</span><input id="draftDayTitle" maxlength="100" value="${E(d.title)}" placeholder="Ej. Pecho y tríceps"></label>${dayPrefsHTML(d)}<div class="stack section">${d.exercises.map((rx,i)=>`<div class="card draft-exercise"><button class="section-link" data-action="draft-edit" data-index="${i}"><span class="section-link-copy"><strong>${i+1}. ${E(fullExerciseName(exercise(rx.exerciseId)))}</strong><small>${E(targetText(rx))}</small>${compactMachine(exercise(rx.exerciseId))}${!isActiveExercise(rx.exerciseId)?'<small>Equipo no disponible: sustituir.</small>':''}</span><span class="section-link-chevron">›</span></button><div class="row wrap"><button class="btn small" data-action="draft-move" data-index="${i}" data-direction="-1" ${i===0?'disabled':''} aria-label="Subir ejercicio ${i+1}">↑</button><button class="btn small" data-action="draft-move" data-index="${i}" data-direction="1" ${i===d.exercises.length-1?'disabled':''} aria-label="Bajar ejercicio ${i+1}">↓</button><button class="btn small ghost" data-action="draft-remove" data-index="${i}">Quitar</button></div></div>`).join('')||'<p class="muted">Sin ejercicios. Este día se guardará como descanso.</p>'}</div>${d.exercises.length?'<button class="btn ghost block" data-action="draft-rest">Marcar día de descanso</button>':''}<div class="section stack"><p class="small-note">${count} de 7 días de entrenamiento. ${count===7?'Revisa la recuperación; conviene reservar descanso. ':''}El borrador no se guarda hasta confirmar. Puedes cerrar y retomarlo mientras no recargues.</p><button class="btn primary block" data-action="draft-save">Guardar rutina</button><button class="btn block" data-action="draft-save" data-activate="1">Guardar y activar</button><button class="btn ghost block" data-action="draft-discard">Descartar borrador</button></div>`);}
function draftExerciseModal(i){const d=routineDraft?.days[draftDay];if(!d||!Number.isInteger(i)||i< -1||i>=d.exercises.length)return;const rx=d.exercises[i];modal(i===-1?'Añadir ejercicio':'Editar ejercicio',`${modalBack('data-action="draft-open"',FULL_DAYS[draftDay])}<form id="draftExerciseForm" data-index="${i}"><div class="field"><span class="label">Ejercicio del catálogo activo</span>${exerciseComboboxHTML('draftExercise',rx?.exerciseId||'')}</div><div class="form-grid section"><label class="field"><span class="label">Series</span><input name="sets" type="number" min="1" max="20" required value="${rx?.sets??3}"></label><label class="field"><span class="label">Mínimo (reps / seg / min)</span><input name="min" type="number" min="1" max="600" required value="${rx?.min??8}"></label><label class="field"><span class="label">Máximo (reps / seg / min)</span><input name="max" type="number" min="1" max="600" required value="${rx?.max??12}"></label><label class="field"><span class="label">Peso orientativo (kg)</span><input name="kg" inputmode="decimal" value="${rx?.suggestedKg??''}" placeholder="Sin definir"></label><label class="field full"><span class="label">Notas y descanso</span><textarea name="notes" maxlength="500">${E(rx?.notes||'')}</textarea></label><label class="field full row"><input type="checkbox" name="perSide" ${rx?.perSide?'checked':''}> Por lado</label><label class="field full row"><input type="checkbox" name="optional" ${rx?.optional?'checked':''}> Opcional</label></div><p class="small-note">Comprueba la unidad del ejercicio seleccionado. Si cambias de máquina o modalidad, no se trasladarán las cargas anteriores.</p><button class="btn primary block section">Guardar ejercicio en el borrador</button></form>`);}
function submitDraftExercise(form){const fd=new FormData(form),i=Number(form.dataset.index),id=String(fd.get('exerciseId')||''),e=exercise(id),old=routineDraft?.days[draftDay]?.exercises[i],kg=num(fd.get('kg'));const rx={exerciseId:id,sets:e.unit==='minutes'?1:Number(fd.get('sets')),min:Number(fd.get('min')),max:Number(fd.get('max')),suggestedKg:e.unit==='minutes'||['Sin carga','Peso corporal'].includes(e.loadUnit)||(old&&old.exerciseId!==id)?null:kg,notes:String(fd.get('notes')||'').slice(0,500),perSide:fd.has('perSide'),optional:fd.has('optional')};if(!validRx(rx)||Number.isNaN(kg)||(kg!=null&&(kg<0||kg>1000))||!setDraftExercise(routineDraft,draftDay,i,rx))return toast('Selecciona un ejercicio disponible y revisa los valores.',true);draftEditor();}
function saveRoutineDraft(activate){if(!routineDraft)return;try{const m=routineDraft.minutesPerSession;if(m!=null&&(!Number.isInteger(m)||m<10||m>240))throw Error('Indica una duración entre 10 y 240 minutos.');if(db.routines.length>=500)throw Error('Máximo 500 rutinas guardadas.');for(const k of WEEK){const d=routineDraft.days[k];if(d.exercises.length){const p=dailyPrefs(d);if(!Number.isInteger(p.minutes)||p.minutes<15||p.minutes>120)throw Error('Revisa la duración de '+FULL_DAYS[k]+' (15–120 minutos).');d.preferences=p;}}const r=buildSavedRoutine(routineDraft,{id:uid(),date:madridToday(),validExercise:validRx});const before=db.activeRoutineId;db.routines.push(r);if(activate||!before)db.activeRoutineId=r.id;if(!persist()){db.routines.pop();db.activeRoutineId=before;return;}routineDraft=null;closeModal();navigateTo('routines');toast(activate?'Rutina guardada y activada':'Rutina guardada');}catch(err){toast(err.message,true);}}

function dailyPrefs(d){const r=routineDraft,p=d.preferences||{},legacy=FOCUS_AREAS[p.goal],area=Object.hasOwn(DAY_AREAS,p.area)?p.area:legacy||FOCUS_AREAS[r.focus]||'full';return {area,goal:Object.hasOwn(GOAL_LABELS,p.goalOverride)?p.goalOverride:focusGoal(r.focus||'equilibrado'),goalOverride:Object.hasOwn(GOAL_LABELS,p.goalOverride)?p.goalOverride:null,level:['principiante','intermedio','avanzado'].includes(p.level)?p.level:['principiante','intermedio','avanzado'].includes(r.level)?r.level:db.planner.level||'intermedio',minutes:p.minutes??Math.min(120,Math.max(15,r.minutesPerSession||db.planner.minutesPerSession||60)),request:p.request||'',limit:p.limit||null};}
function requestSummary(p){try{return interpretRequest(p.request,{...p,goal:focusGoal(routineDraft.focus||'equilibrado')}).summary;}catch{return 'Revisa la petición en el chat antes de generar.';}}
function dayPrefsHTML(d){const p=dailyPrefs(d),opts=(arr,selected)=>arr.map(([v,l])=>`<option value="${E(v)}" ${v===selected?'selected':''}>${E(l)}</option>`).join('');return `<div class="card section daily-builder"><h3>¿Qué quieres entrenar este día?</h3><div class="form-grid section"><label class="field full"><span class="label">Zona muscular / combinación</span><select data-day-pref="area">${groupedOptions(AREA_GROUPS,p.area)}</select></label><label class="field"><span class="label">Nivel</span><select data-day-pref="level">${opts([['principiante','Principiante'],['intermedio','Intermedio'],['avanzado','Avanzado']],p.level)}</select></label><label class="field"><span class="label">Duración (minutos)</span><input type="number" data-day-pref="minutes" min="15" max="120" value="${E(p.minutes)}"></label></div><p class="small-note"><span data-general-goal>Objetivo ${p.goalOverride?'ajustado por chat':'general'}: ${E(GOAL_LABELS[p.goal])}.</span> Solo se modifica ${FULL_DAYS[draftDay].toLowerCase()}.</p>${p.request?`<p class="small-note">${E(requestSummary(p))} ${p.limit&&d.exercises.length!==p.limit?'El número de ejercicios puede variar según tiempo y catálogo.':''}</p>`:''}<div class="stack section"><button class="btn primary block" data-action="draft-add">+ Añadir ejercicio manualmente</button><button class="btn block" data-action="draft-generate-local">✦ Chat de NIVEL · Crear o completar</button></div></div>`;}
let dayReview=null;
function dayGenerateModal(message){if(!routineDraft)return;const d=routineDraft.days[draftDay],p=dailyPrefs(d);if(!Number.isInteger(p.minutes)||p.minutes<15||p.minutes>120)return toast('Indica entre 15 y 120 minutos para este día.',true);d.preferences=p;const has=d.exercises.length>0;modal(`Chat NIVEL · ${FULL_DAYS[draftDay]}`,`${modalBack('data-action="draft-open"',FULL_DAYS[draftDay])}<div class="card"><div class="eyebrow">ASISTENTE LOCAL</div><p>Vamos a preparar ${E(AREA_LABELS[p.area])}, ${E(p.level)}, ${p.minutes} min. Puedes pedirme otro tiempo, un material o un número de ejercicios.</p><small>No usa servicios externos. Interpreta instrucciones concretas mediante reglas.</small></div><form id="draftDayGenerateForm" data-weekday="${draftDay}"><label class="field section"><span class="label">¿Qué hacemos?</span><select name="mode">${has?'<option value="append">Completar sin cambiar mis ejercicios</option>':''}<option value="replace">${has?'Crear un día nuevo (sustituir)':'Crear desde cero'}</option>${has?'<option value="adjust">Ajustar series, repeticiones y descanso</option>':''}</select></label><label class="field section"><span class="label">Tu mensaje (opcional)</span><textarea name="request" maxlength="500" rows="4" placeholder="Ej.: 45 minutos, solo poleas y mancuernas, sin saltos, 4 ejercicios.">${E(message??p.request)}</textarea></label><p class="small-note">Reconoce duración, nivel, número de ejercicios, solo/sin material, sin saltos, y objetivos como fuerza o hipertrofia. La zona se elige en el editor. Revisa siempre la interpretación.</p><button class="btn primary block section" type="submit">Enviar a NIVEL</button><p id="draftDayStatus" role="status" class="small-note"></p></form>`);}
function submitDayGeneration(form){if(!routineDraft)return;const draft=routineDraft,k=Number(form.dataset.weekday),d=draft.days[k],fd=new FormData(form),mode=String(fd.get('mode')),p=dailyPrefs(d);if(k!==draftDay||!['append','replace','adjust'].includes(mode))return;const snapshot=JSON.stringify(d),status=form.querySelector('#draftDayStatus');try{const request=String(fd.get('request')||'').trim().slice(0,500),parsed=interpretRequest(request,{...p,goal:focusGoal(routineDraft.focus||'equilibrado')});const catalog=filterRequestedCatalog(activeExercises(),parsed);const proposal=mode==='adjust'?adjustDay(activeExercises(),parsed.prefs,d):generateDay(catalog,parsed.prefs,mode==='append'?d.exercises:[]);const merged=mergeDayProposal(d,proposal,mode,validRx);merged.preferences={...p,level:parsed.prefs.level,minutes:parsed.prefs.minutes,limit:parsed.prefs.limit||null,goal:parsed.prefs.goal,goalOverride:parsed.goalExplicit?parsed.prefs.goal:null,request};const explanation=parsed.summary+' '+(mode==='append'||mode==='adjust'?'Las restricciones de material no eliminan los ejercicios que ya elegiste. ':'')+(parsed.prefs.limit&&merged.exercises.length!==parsed.prefs.limit?'El total solicitado no se alcanzó por tiempo, catálogo o ejercicios existentes. ':'')+'El tiempo es aproximado. El texto no reconocido no se interpreta. No se calculan cargas nuevas.';dayReview={draft,k,snapshot,merged,mode,source:'local',explanation};showDayReview();}catch(err){status.textContent=String(err.message||'No se pudo generar la propuesta.').slice(0,300);}}
function showDayReview(){const a=dayReview;if(!a)return;modal(`Revisar · ${FULL_DAYS[a.k]}`,`${modalBack('data-action="draft-open"','Volver sin aplicar')}<p class="muted">${a.mode==='append'?'Se conservan tus ejercicios y se añaden los nuevos.':a.mode==='adjust'?'Se conservan tus ejercicios y su orden; se ajustan las series, repeticiones y notas.':'Se sustituirá únicamente este día.'}</p>${a.explanation?`<p>${E(a.explanation)}</p>`:''}<div class="stack section">${a.merged.exercises.map((rx,i)=>`<div class="card"><strong>${i+1}. ${E(fullExerciseName(exercise(rx.exerciseId)))}</strong><p class="small-note">${E(targetText(rx))}${rx.notes?' · '+E(rx.notes):''}</p></div>`).join('')}</div><button class="btn primary block section" data-action="draft-apply-day">Aplicar solo a ${FULL_DAYS[a.k]}</button><button class="btn block section" data-action="draft-revise-day">Cambiar petición</button><button class="btn ghost block section" data-action="draft-open">Cancelar</button>`);}
function applyDayReview(){const a=dayReview;if(!a||routineDraft!==a.draft||draftDay!==a.k||JSON.stringify(routineDraft.days[a.k])!==a.snapshot||!a.merged.exercises.every(validRx)){dayReview=null;return toast('El día o el inventario cambió; vuelve a generar.',true);}routineDraft.days[a.k]=a.merged;dayReview=null;draftEditor();toast('Día actualizado. El resto de la semana no cambió.');}

init();
