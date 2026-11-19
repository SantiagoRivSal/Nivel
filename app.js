/* NIVEL — app estática para GitHub Pages. Persistencia: localStorage + copias JSON.
   GitHub Pages NO puede modificar data.json ni sincronizar dispositivos. */
const STORAGE_KEY = 'nivel_fitness_data_v1';
const APP_VERSION = 1;
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
let view = 'home';
let chartMetric = 'weightKg';
let showingModal = false;
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
  if (!obj || typeof obj!=='object' || obj.schemaVersion!==APP_VERSION || !Array.isArray(obj.measurements) || !Array.isArray(obj.exercises) || !Array.isArray(obj.routines) || !Array.isArray(obj.sessions) || !obj.profile || typeof obj.profile!=='object') throw new Error('Este archivo no es una copia válida de NIVEL (versión 1).');
  if (obj.measurements.length>50000 || obj.exercises.length>5000 || obj.sessions.length>50000 || obj.routines.length>500) throw new Error('La copia es demasiado grande.');
  if (obj.routines.length<1 || !obj.routines.every(r=>r.days && typeof r.days==='object')) throw new Error('Faltan las rutinas en el archivo.');
  return JSON.parse(JSON.stringify(obj));
}
async function init(){
  try{
    const saved=localStorage.getItem(STORAGE_KEY);
    if(saved){ try {db=ensureData(JSON.parse(saved));} catch(e){console.warn('Copia local inválida',e);}}
    if(!db){const response=await fetch('./data.json',{cache:'no-cache'});if(!response.ok)throw Error(`No se pudo abrir data.json (${response.status}).`);db=ensureData(await response.json());persist();}
    render();
  }catch(e){document.getElementById('app').innerHTML=`<div class="empty" style="min-height:80vh"><strong>No se pudo cargar NIVEL</strong><p>${E(e.message)}</p><p>Sube todos los archivos a GitHub Pages, incluido <code>data.json</code>. No abras index.html con doble clic: necesita un servidor web.</p></div>`;}
  if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(console.warn);
}
function navItem(name,label,icon) {return `<button class="nav-btn ${view===name?'active':''}" data-nav="${name}" aria-label="${label}"><span class="nav-icon">${icon}</span>${label}</button>`;}
function bottomItem(name,label,icon) {return `<button class="bottom-btn ${view===name?'active':''}" data-nav="${name}" aria-label="${label}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`;}
function render(){
  const titles={home:'Hoy',training:'Entrenar',progress:'Progreso',library:'Ejercicios',profile:'Perfil'};
  document.title=`${titles[view]} · NIVEL`;
  document.getElementById('app').innerHTML=`<div class="app-shell">
    <aside class="sidebar"><div class="side-brand">NIVEL<b>.</b></div><nav class="nav-list">${navItem('home','Hoy','⌂')}${navItem('training','Entrenar','◈')}${navItem('progress','Progreso','↗')}${navItem('library','Ejercicios','▤')}${navItem('profile','Perfil','◉')}</nav><div class="side-foot"><small>ENTRENA. REGISTRA. EVOLUCIONA.</small><div class="fineprint">Datos guardados en este navegador. Haz copias JSON desde Perfil.</div></div></aside>
    <main class="workspace"><div class="mobile-header"><div class="brand">NIVEL<b>.</b></div><span class="pill green">Tu progreso</span></div><div class="topbar"><span class="today">${niceDate(madridToday())} · Fitness Park</span><span class="pill green">PLAN PERSONAL</span></div>
     ${view==='home'?homeHTML():view==='training'?trainingHTML():view==='progress'?progressHTML():view==='library'?libraryHTML():profileHTML()}
    </main><nav class="bottomnav">${bottomItem('home','Hoy','⌂')}${bottomItem('training','Entrenar','◈')}${bottomItem('progress','Progreso','↗')}${bottomItem('library','Ejercicios','▤')}${bottomItem('profile','Perfil','◉')}</nav></div>`;
}
function header(title,sub='',action=''){return `<div class="page-title row-between wrap"><div><div class="eyebrow">TU SEGUIMIENTO</div><h1>${E(title)}</h1>${sub?`<p class="muted">${E(sub)}</p>`:''}</div>${action}</div>`;}
function stat(label,value,info=''){return `<div class="card"><div class="stat-label">${E(label)}</div><div class="stat-value">${E(value)}</div>${info?`<div class="stat-detail">${E(info)}</div>`:''}</div>`;}
function homeHTML(){
  const w=newestMetric('weightKg'),c=newestMetric('waistCm'),a=newestMetric('abdomenCm');
  const day=activeRoutine().days[String(madridWeekday(madridToday()))];
  const sessions=db.sessions.filter(s=>s.status==='completed').sort(lastByDate);
  const daysLeft=db.profile.goalDate?Math.ceil((new Date(db.profile.goalDate+'T12:00:00Z')-new Date(madridToday()+'T12:00:00Z'))/86400000):null;
  return `${header('Cada día, un nivel más.','Controla tu evolución sin perder el historial.',`<button class="btn primary" data-action="new-measure">+ Medición</button>`)}
    <div class="card glow hero"><div class="eyebrow">${daysLeft!=null&&daysLeft>=0?`${daysLeft} DÍAS PARA ${E(db.profile.goalName||'TU OBJETIVO')}`:'TU PLAN DE ENTRENAMIENTO'}</div><h2>${day?.rest?'Hoy toca recuperación':day?.title||'Tu progreso empieza aquí'}</h2><p>${day?.rest?'Recupérate para entrenar mejor mañana.':'Anota las cargas de cada serie y comprueba tus avances con el tiempo.'}</p><button class="btn primary" data-nav="training">Ver entrenamiento →</button></div>
    <div class="grid3 section">${stat('Último peso',w?`${fmtNum(w.weightKg)} kg`:'Sin datos',w?niceDate(w.date):'Registra tu primera medición')}${stat('Última cintura',c?`${fmtNum(c.waistCm)} cm`:'Sin datos',c?niceDate(c.date):'Medición pendiente')}${stat('Sesiones terminadas',String(sessions.length),sessions[0]?`Última: ${niceDate(sessions[0].date)}`:'Comienza tu primera sesión')}</div>
    <div class="grid2 section"><div class="card"><div class="row-between"><h2>Evolución del peso</h2><button class="html-button" data-nav="progress">Ver todo</button></div>${chartHTML('weightKg')}</div><div class="card"><div class="row-between"><h2>Tu próximo paso</h2><span class="pill green">ACTIVO</span></div><div class="stack"><div class="list-row"><div><strong>Tu rutina</strong><p class="muted">${E(activeRoutine().name)} · 5 días</p></div><button class="btn small" data-nav="training">Abrir</button></div><div class="list-row"><div><strong>Registro corporal</strong><p class="muted">Peso, cintura o ambas cosas, con fecha</p></div><button class="btn small" data-action="new-measure">Añadir</button></div><div class="list-row"><div><strong>Respaldo JSON</strong><p class="muted">Protege tus datos con una copia</p></div><button class="btn small" data-action="export">Exportar</button></div></div></div></div>
    <p class="footnote section">Las referencias de peso de tu plan son orientativas y no representan entrenamientos realizados. ${a?`Último abdomen: ${fmtNum(a.abdomenCm)} cm (${niceDate(a.date)}).`:''}</p>`;
}
function chartHTML(metric){
  const field=FIELDS.find(f=>f[0]===metric),points=[...db.measurements].filter(m=>Number.isFinite(m[metric])&&validDate(m.date)).sort((a,b)=>a.date.localeCompare(b.date));
  if(!points.length)return `<div class="empty" style="min-height:160px"><span class="symbol">⌁</span><strong>Aún no hay datos</strong><small>El gráfico aparecerá al registrar tus valores.</small></div>`;
  let min=Math.min(...points.map(x=>x[metric])),max=Math.max(...points.map(x=>x[metric]));let pad=Math.max((max-min)*.2,metric==='weightKg'?.5:1);min-=pad;max+=pad;
  const x=i=>points.length===1?50:8+(i/(points.length-1))*84;
  const y=v=>12+(1-(v-min)/(max-min))*69;
  const xy=points.map((p,i)=>`${x(i)},${y(p[metric])}`).join(' ');
  const d=points.map((p,i)=>`${i===0?'M':'L'}${x(i)} ${y(p[metric])}`).join(' ');
  const first=points[0][metric],last=points.at(-1)[metric],change=last-first;
  return `<div class="chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Gráfico de ${E(field[1])}"><line x1="8" x2="92" y1="80" y2="80" stroke="#435267" stroke-width=".35" stroke-dasharray="2 2"/><line x1="8" x2="92" y1="45" y2="45" stroke="#324557" stroke-width=".25" stroke-dasharray="2 2"/><path d="${d}" fill="none" stroke="#c4f46d" stroke-width="1.3" vector-effect="non-scaling-stroke"/>${points.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p[metric])}" r="1.6" fill="#c4f46d"><title>${niceDate(p.date)}: ${fmtNum(p[metric])} ${field[2]}</title></circle>`).join('')}</svg></div><div class="chart-axis"><span>${niceDate(points[0].date)} · ${fmtNum(first)} ${field[2]}</span><span>${niceDate(points.at(-1).date)} · ${fmtNum(last)} ${field[2]}</span></div><p class="small-note">${points.length>1?`Variación: ${change>0?'+':''}${fmtNum(change,2)} ${field[2]} (${points.length} registros)`:'Primera medición registrada'}</p>`;
}
function trainingHTML(){
  const plan=activeRoutine();
  const day=plan.days[String(selectedDay)]||{title:'Sin plan',exercises:[],rest:true};
  const sess=db.activeSession;
  return `${header('Tus entrenamientos',`${plan.name}. Registra series y cargas reales.`,`<button class="btn" data-action="routine-copy">Duplicar plan</button>`)}
  <div class="day-list">${[1,2,3,4,5,6,7].map(i=>`<button class="day-chip ${selectedDay===i?'selected':''}" data-day="${i}"><small>${DAYS[i]}</small><b>${i===4||i===7?'Desc.':`Día ${i}`}</b></button>`).join('')}</div>
  ${sess?`<section class="section">${sessionHTML(sess)}</section>`:''}
  <section class="section"><div class="row-between wrap"><div><div class="eyebrow">DÍA ${selectedDay}</div><h2>${E(day.title)}</h2><p class="muted">${day.rest?'Día de descanso: movilidad o paseo suave.':'Cargas sugeridas: son solo referencias de partida.'}</p></div>${!day.rest&&!sess?`<button class="btn primary" data-action="start-session">▶ Empezar sesión</button>`:''}</div>
   ${day.rest?`<div class="card empty"><span class="symbol">☾</span><strong>Recuperación</strong><p>El descanso también cuenta para progresar.</p></div>`:`<div class="stack">${day.exercises.map((rx,i)=>exerciseRow(rx,i)).join('')}</div>`}
  ${!day.rest?`<div class="row-between section wrap"><button class="btn" data-action="routine-add">+ Añadir ejercicio</button><button class="btn ghost" data-action="routine-copy">Crear una versión nueva</button></div>`:''}</section>
  <section class="section card"><div class="row-between wrap"><h2>Historial de sesiones</h2><span class="pill">${db.sessions.filter(s=>s.status==='completed').length} completadas</span></div>${sessionHistoryHTML(5)}</section>`;
}
function exerciseRow(rx,i){const e=exercise(rx.exerciseId);return `<div class="exercise-card"><div class="row-between"><div class="row" style="min-width:0"><div class="number">${i+1}</div><div><h3>${E(e.name)}</h3><p>${E(e.muscle)} · ${E(e.equipment)} ${rx.optional?'· opcional':''}</p></div></div><button class="btn small ghost" data-action="routine-edit" data-index="${i}" aria-label="Editar ejercicio">Editar</button></div><div class="exercise-details"><p>${rx.sets} series × ${rx.min}${rx.max!==rx.min?`–${rx.max}`:''} ${e.unit==='seconds'?'segundos':e.unit==='minutes'?'minutos':`repeticiones${rx.perSide?' por lado':''}`} · <strong>${suggestedLoad(rx)}</strong></p>${rx.notes?`<small>${E(rx.notes)}</small>`:''}</div></div>`;}
function lastLoad(id){const all=db.sessions.filter(s=>s.status==='completed').sort(lastByDate);for(const ses of all){const ex=ses.exercises.find(x=>x.exerciseId===id);if(ex){const set=[...ex.sets].reverse().find(s=>s.done&&s.load!=null);if(set)return set.load;}}return null;}
function makeSession(dayId){
 const day=activeRoutine().days[String(dayId)];return {id:uid(),date:madridToday(),day:dayId,routineId:activeRoutine().id,title:day.title,status:'in_progress',startedAt:new Date().toISOString(),exercises:day.exercises.map(rx=>{const e=exercise(rx.exerciseId),previous=lastLoad(e.id);return {id:uid(),exerciseId:e.id,name:e.name,unit:e.unit,perSide:rx.perSide,sets:Array.from({length:rx.sets},()=>({id:uid(),load:previous??rx.suggestedKg??null,reps:null,seconds:null,minutes:null,done:false}))};})};
}
function sessionHTML(s){
 const count=s.exercises.reduce((n,e)=>n+e.sets.filter(t=>t.done).length,0),all=s.exercises.reduce((n,e)=>n+e.sets.length,0);
 return `<div class="session-card"><div class="row-between wrap"><div><span class="eyebrow">SESIÓN EN CURSO</span><h2>${E(s.title)}</h2><small>${count}/${all} series completadas</small></div><button class="btn danger small" data-action="cancel-session">Descartar</button></div>
 <label class="field section" style="max-width:230px"><span class="label">Fecha de la sesión</span><input type="date" data-session-date value="${E(s.date)}" max="${madridToday()}"></label>
 ${s.exercises.map((ex,ei)=>`<div class="card section"><div class="row-between wrap"><div><div class="set-title">${E(ex.name)}</div><small>${E(ex.unit==='seconds'?'Segundos':ex.unit==='minutes'?'Minutos':'Repeticiones')} ${ex.perSide?'por lado':''} ${lastLoad(ex.exerciseId)!=null?`· Anterior: ${fmtNum(lastLoad(ex.exerciseId))} kg`:''}</small></div><button class="btn small" data-action="add-set" data-ex="${ei}">+ Serie</button></div>
 <div class="set-head"><span>#</span><span>Kg</span><span>${ex.unit==='reps'?'Reps':ex.unit==='seconds'?'Seg':'Min'}</span><span>RIR</span><span>✓</span></div>
 ${ex.sets.map((set,si)=>`<div class="set-row ${set.done?'completed':''}"><span>${si+1}</span><input aria-label="Kilogramos" inputmode="decimal" data-set-field="load" data-ex="${ei}" data-set="${si}" placeholder="—" value="${set.load==null?'':E(String(set.load).replace('.',','))}"><input aria-label="${ex.unit}" inputmode="numeric" data-set-field="${ex.unit}" data-ex="${ei}" data-set="${si}" placeholder="—" value="${E(set[ex.unit]??'')}"><input aria-label="RIR (opcional)" inputmode="numeric" data-set-field="rir" data-ex="${ei}" data-set="${si}" placeholder="—" value="${E(set.rir??'')}"><label class="done"><input aria-label="Completar serie" type="checkbox" data-set-done data-ex="${ei}" data-set="${si}" ${set.done?'checked':''}></label></div>`).join('')}
 <button class="html-button danger" data-action="remove-set" data-ex="${ei}">− Quitar última serie</button></div>`).join('')}
 <button class="btn primary block section" data-action="finish-session">Guardar sesión terminada (${count} series)</button><p class="small-note">Los cambios se guardan automáticamente en este navegador mientras completas las series.</p></div>`;
}
function sessionHistoryHTML(limit){const items=[...db.sessions].filter(s=>s.status==='completed').sort(lastByDate).slice(0,limit||1000);return items.length?items.map(s=>`<div class="list-row"><div><strong>${E(s.title)}</strong><p class="muted">${niceDate(s.date)} · ${s.exercises.reduce((n,e)=>n+e.sets.filter(x=>x.done).length,0)} series realizadas</p></div><div class="row"><button class="btn small" data-action="session-detail" data-id="${E(s.id)}">Ver</button><button class="html-button danger" data-action="delete-session" data-id="${E(s.id)}">Borrar</button></div></div>`).join(''):`<div class="empty"><strong>Todavía no has guardado entrenamientos</strong><small>Cuando termines tu primera sesión, aparecerá aquí.</small></div>`;}
function progressHTML(){
 const rows=[...db.measurements].sort(lastByDate),met=FIELDS.find(f=>f[0]===chartMetric);
 return `${header('Tu progreso','Registra peso o cualquier medida, sin completar campos obligatorios.',`<button class="btn primary" data-action="new-measure">+ Nueva medición</button>`)}
 <div class="grid3">${stat('Registros',String(rows.length),'Cada registro conserva su fecha')}${stat('Peso actual',newestMetric('weightKg')?`${fmtNum(newestMetric('weightKg').weightKg)} kg`:'—')}${stat('Cintura actual',newestMetric('waistCm')?`${fmtNum(newestMetric('waistCm').waistCm)} cm`:'—')}</div>
 <section class="card section"><div class="row-between wrap"><div><h2>Gráfico de evolución</h2><p class="muted">Selecciona la medida que quieras comparar.</p></div><select class="select-inline" id="chartMetric" aria-label="Medida del gráfico">${FIELDS.map(f=>`<option value="${f[0]}" ${chartMetric===f[0]?'selected':''}>${E(f[1])}</option>`).join('')}</select></div>${chartHTML(chartMetric)}</section>
 <section class="card section"><div class="row-between wrap"><h2>Historial de mediciones</h2><button class="btn small" data-action="export">Copia JSON</button></div>${rows.length?rows.map(m=>`<div class="list-row"><div><strong>${niceDate(m.date)}</strong><p class="muted">${FIELDS.filter(f=>Number.isFinite(m[f[0]])).map(f=>`${E(f[1])}: ${fmtNum(m[f[0]],2)} ${f[2]}`).join(' · ')}</p>${m.notes?`<small>${E(m.notes)}</small>`:''}</div><div class="row"><button class="btn small" data-action="edit-measure" data-id="${E(m.id)}">Editar</button><button class="html-button danger" data-action="delete-measure" data-id="${E(m.id)}">Borrar</button></div></div>`).join(''):`<div class="empty"><span class="symbol">↗</span><strong>Registra tu primera medición</strong><small>Puedes registrar solo el peso o solo una medida.</small><button class="btn primary" data-action="new-measure">Empezar</button></div>`}</section>`;
}
function libraryHTML(){const muscles=['Todos',...new Set(db.exercises.map(e=>e.muscle))];return `${header('Banco de ejercicios',`${db.exercises.length} ejercicios disponibles. Puedes crear los tuyos.`,`<button class="btn primary" data-action="new-exercise">+ Nuevo ejercicio</button>`)}<div class="card"><div class="filters"><input id="exerciseSearch" type="search" placeholder="Buscar ejercicio, material…" aria-label="Buscar ejercicios"><select id="muscleFilter" class="select-inline">${muscles.map(m=>`<option value="${E(m)}">${E(m)}</option>`).join('')}</select></div></div><div class="grid2 section" id="exerciseResults">${db.exercises.map(e=>`<div class="exercise-card" data-library-item data-text="${E(`${e.name} ${e.muscle} ${e.equipment}`.toLowerCase())}" data-muscle="${E(e.muscle)}"><div class="row-between"><div><h3>${E(e.name)}</h3><p>${E(e.muscle)} · ${E(e.equipment)}</p></div><button class="btn small" data-action="exercise-detail" data-id="${E(e.id)}">Ver</button></div><small>${E(e.instructions)}</small></div>`).join('')}</div>`;}
function profileHTML(){return `${header('Tu perfil','Tu planificación y tus copias de seguridad.')}<div class="grid2"><form class="card" id="profileForm"><h2>Objetivo y datos</h2><div class="form-grid"><label class="field"><span class="label">Altura (cm)</span><input name="heightCm" inputmode="decimal" value="${E(db.profile.heightCm)}"></label><label class="field"><span class="label">Peso de referencia (kg)</span><input name="referenceWeightKg" inputmode="decimal" value="${E(db.profile.referenceWeightKg)}"></label><label class="field full"><span class="label">Gimnasio</span><input name="gym" maxlength="100" value="${E(db.profile.gym)}"></label><label class="field full"><span class="label">Nombre del objetivo</span><input name="goalName" maxlength="100" value="${E(db.profile.goalName)}"></label><label class="field"><span class="label">Fecha objetivo</span><input type="date" name="goalDate" value="${E(db.profile.goalDate)}"></label><label class="field full"><span class="label">Descripción del objetivo</span><textarea name="goal" maxlength="1000">${E(db.profile.goal)}</textarea></label></div><button class="btn primary block section" type="submit">Guardar perfil</button></form>
 <div class="card"><h2>Memoria de tus datos</h2><p>Los registros se conservan en <strong>este navegador y dispositivo</strong>. Tu repositorio de GitHub Pages no recibe ni actualiza tus datos.</p><div class="stack"><button class="btn primary block" data-action="export">↓ Descargar mi memoria (.json)</button><label class="btn block" for="importFile">↑ Restaurar memoria JSON</label><input id="importFile" type="file" accept=".json,application/json" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none"><button class="btn danger block" data-action="reset">Borrar todos mis registros locales</button></div><p class="fineprint section">Haz una copia cada semana. Si cambias de móvil, importas el mismo archivo JSON en el nuevo dispositivo. No guardes tus mediciones privadas en un repositorio público.</p></div></div>
 <section class="card section"><div class="row-between wrap"><div><h2>Versiones de tu rutina</h2><p class="muted">Puedes crear nuevas versiones sin borrar el historial.</p></div><button class="btn" data-action="routine-copy">Duplicar rutina</button></div>${db.routines.map(r=>`<div class="list-row"><div><strong>${E(r.name)}</strong><p class="muted">${r.id===db.activeRoutineId?'Rutina activa':'Rutina archivada o alternativa'}</p></div>${r.id===db.activeRoutineId?`<span class="pill green">ACTIVA</span>`:`<button class="btn small" data-action="routine-activate" data-id="${E(r.id)}">Activar</button>`}</div>`).join('')}</section>
 <div class="card section"><h2>Información importante</h2><p class="footnote">Esta versión funciona sin cuenta ni servidor. LocalStorage permite mantener cambios tras cerrar la web, pero no sincroniza automáticamente con otro teléfono u ordenador. Exportar/importar JSON es la forma de transferir datos.</p></div>`;}
function modal(title,content){showingModal=true;document.getElementById('dialog-root')?.remove();const root=document.createElement('div');root.id='dialog-root';root.className='modal-backdrop';root.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="${E(title)}"><div class="modal-head"><h2>${E(title)}</h2><button class="modal-close" data-action="close-modal" aria-label="Cerrar">×</button></div>${content}</div>`;document.body.append(root);}
function closeModal(){showingModal=false;document.getElementById('dialog-root')?.remove();}
function measurementModal(id){const rec=db.measurements.find(m=>m.id===id);modal(rec?'Editar medición':'Nueva medición',`<form id="measureForm" data-id="${E(id||'')}"><label class="field"><span class="label">Fecha de medición</span><input type="date" name="date" required value="${E(rec?.date||madridToday())}" max="${madridToday()}"></label><div class="form-grid section">${FIELDS.map(f=>`<label class="field"><span class="label">${E(f[1])} (${f[2]})</span><input name="${f[0]}" inputmode="decimal" placeholder="Opcional" value="${rec?.[f[0]]==null?'':E(String(rec[f[0]]).replace('.',','))}"></label>`).join('')}<label class="field full"><span class="label">Notas (opcionales)</span><textarea name="notes" placeholder="Contexto de la medición">${E(rec?.notes||'')}</textarea></label></div><p class="footnote">Solo necesitas introducir al menos un valor. Los demás pueden quedar vacíos.</p><button class="btn primary block" type="submit">Guardar medición</button></form>`);}
function routineModal(i,add=false){const day=activeRoutine().days[String(selectedDay)],rx=day.exercises[i];modal(add?'Añadir ejercicio':'Editar ejercicio',`<form id="routineForm" data-index="${add?'-1':i}"><div class="form-grid"><label class="field full"><span class="label">Ejercicio</span><select name="exerciseId">${db.exercises.map(e=>`<option value="${E(e.id)}" ${rx?.exerciseId===e.id?'selected':''}>${E(e.name)}</option>`).join('')}</select></label><label class="field"><span class="label">Series</span><input name="sets" type="number" min="1" max="20" value="${rx?.sets??3}"></label><label class="field"><span class="label">Reps mínimas / seg.</span><input name="min" type="number" min="1" max="600" value="${rx?.min??8}"></label><label class="field"><span class="label">Reps máximas / seg.</span><input name="max" type="number" min="1" max="600" value="${rx?.max??12}"></label><label class="field"><span class="label">Peso sugerido (kg)</span><input name="suggestedKg" inputmode="decimal" placeholder="Sin definir" value="${rx?.suggestedKg??''}"></label><label class="field full"><span class="label">Notas</span><textarea name="notes">${E(rx?.notes||'')}</textarea></label><label class="field full row"><input type="checkbox" style="width:auto" name="perSide" ${rx?.perSide?'checked':''}>Por cada lado / pierna</label><label class="field full row"><input type="checkbox" style="width:auto" name="optional" ${rx?.optional?'checked':''}>Ejercicio opcional</label></div><div class="row-between section"><button class="btn primary" type="submit">Guardar</button>${!add?`<button class="btn danger" type="button" data-action="routine-remove" data-index="${i}">Eliminar del día</button>`:''}</div></form>`);}
function exerciseModal(id){const e=id?exercise(id):null;modal(e?'Detalle del ejercicio':'Crear ejercicio',e?`<p><span class="pill">${E(e.muscle)}</span> <span class="pill">${E(e.equipment)}</span></p><p>${E(e.instructions)}</p><p class="footnote">Unidad: ${E(e.unit==='seconds'?'segundos':e.unit==='minutes'?'minutos':'repeticiones')} · Carga: ${E(e.loadUnit)}</p>${e.custom?`<button class="btn danger" data-action="delete-exercise" data-id="${E(e.id)}">Eliminar ejercicio propio</button>`:''}`:`<form id="exerciseForm"><div class="form-grid"><label class="field full"><span class="label">Nombre</span><input name="name" required maxlength="100"></label><label class="field"><span class="label">Músculo</span><input name="muscle" required placeholder="Espalda" maxlength="40"></label><label class="field"><span class="label">Material</span><select name="equipment"><option>Máquina</option><option>Mancuernas</option><option>Polea</option><option>Barra</option><option>Peso corporal</option><option>Otro</option></select></label><label class="field"><span class="label">Unidad</span><select name="unit"><option value="reps">Repeticiones</option><option value="seconds">Segundos</option><option value="minutes">Minutos</option></select></label><label class="field"><span class="label">Tipo de carga</span><select name="loadUnit"><option>Máquina</option><option>Por mancuerna</option><option>Total</option><option>Peso corporal</option><option>Sin carga</option></select></label><label class="field full"><span class="label">Cómo se realiza</span><textarea name="instructions" maxlength="1000" required></textarea></label></div><button class="btn primary block section" type="submit">Añadir al banco</button></form>`);}
function detailSession(id){const s=db.sessions.find(x=>x.id===id);if(!s)return;modal('Sesión · '+niceDate(s.date),`<p class="muted">${E(s.title)}</p>${s.exercises.map(ex=>`<div class="card section"><strong>${E(ex.name)}</strong><div class="scroll-table"><table><thead><tr><th>Serie</th><th>Peso</th><th>${ex.unit==='reps'?'Reps':ex.unit==='seconds'?'Seg':'Min'}</th></tr></thead><tbody>${ex.sets.filter(t=>t.done).map((set,i)=>`<tr><td>${i+1}</td><td>${set.load==null?'—':`${fmtNum(set.load)} kg`}</td><td>${fmtNum(set[ex.unit])}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}`);}
function doExport(){const name=`NIVEL-respaldo-${madridToday()}.json`,data=JSON.stringify({...db,exportedAt:new Date().toISOString()},null,2),blob=new Blob([data],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Copia JSON descargada');}
async function doImport(file){if(!file)return;if(file.size>5_000_000){toast('El JSON supera 5 MB.',true);return;}try{const next=ensureData(JSON.parse(await file.text()));if(!confirm('Importar sustituirá TODOS los datos de este navegador. ¿Continuar?'))return;db=next;persist();closeModal();view='home';render();toast('Memoria JSON restaurada correctamente');}catch(e){toast(e.message||'Error al importar JSON',true);}}
function doAction(target){const action=target.dataset.action,id=target.dataset.id,index=Number(target.dataset.index),exIdx=Number(target.dataset.ex);
  switch(action){
    case 'new-measure':measurementModal();break;
    case 'edit-measure':measurementModal(id);break;
    case 'delete-measure':if(confirm('¿Eliminar esta medición?')){db.measurements=db.measurements.filter(m=>m.id!==id);persist();render();toast('Medición eliminada');}break;
    case 'start-session':if(db.activeSession){toast('Termina primero tu sesión actual',true);break;}db.activeSession=makeSession(selectedDay);persist();render();break;
    case 'finish-session':{const s=db.activeSession;if(!s)break;const done=s.exercises.flatMap(e=>e.sets).filter(t=>t.done);if(!done.length){toast('Marca al menos una serie completada.',true);break;}for(const ex of s.exercises){for(const set of ex.sets){if(set.done){if(!(set[ex.unit]>=1)){toast('Completa las repeticiones o el tiempo de las series marcadas.',true);return;}}}}
        s.status='completed';s.exercises.forEach(e=>e.sets=e.sets.filter(t=>t.done));s.endedAt=new Date().toISOString();db.sessions.push(s);db.activeSession=null;persist();render();toast('¡Entrenamiento guardado!');break;}
    case 'cancel-session':if(confirm('¿Descartar la sesión en curso?')){db.activeSession=null;persist();render();}break;
    case 'add-set':{const ex=db.activeSession?.exercises[exIdx];if(!ex)break;if(ex.sets.length>=30){toast('Máximo 30 series',true);break;}const last=ex.sets.at(-1);ex.sets.push({id:uid(),load:last?.load??null,reps:null,seconds:null,minutes:null,done:false});persist();render();break;}
    case 'remove-set':{const ex=db.activeSession?.exercises[exIdx];if(ex&&ex.sets.length>1){ex.sets.pop();persist();render();}break;}
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
   const height=num(fd.get('heightCm')),weight=num(fd.get('referenceWeightKg')),goalDate=String(fd.get('goalDate')||'');if(height!=null&&(height<100||height>230)||weight!=null&&(weight<25||weight>300)){toast('Comprueba altura y peso de referencia.',true);return;}if(goalDate&&!validDate(goalDate)){toast('La fecha del objetivo no es válida.',true);return;}
   db.profile={...db.profile,heightCm:height,referenceWeightKg:weight,gym:String(fd.get('gym')||'').slice(0,100),goalDate,goalName:String(fd.get('goalName')||'').slice(0,100),goal:String(fd.get('goal')||'').slice(0,1000)};persist();render();toast('Perfil guardado');
 }else if(form.id==='routineForm'){
   const day=activeRoutine().days[String(selectedDay)],idx=Number(form.dataset.index),sets=Number(fd.get('sets')),min=Number(fd.get('min')),max=Number(fd.get('max')),load=num(fd.get('suggestedKg'));
   if(!db.exercises.some(e=>e.id===fd.get('exerciseId'))||!Number.isInteger(sets)||sets<1||sets>20||!Number.isInteger(min)||!Number.isInteger(max)||min<1||max>600||max<min||Number.isNaN(load)||(load!=null&&(load<0||load>500))){toast('Revisa series, repeticiones y kilos.',true);return;}
   const rx={exerciseId:String(fd.get('exerciseId')),sets,min,max,suggestedKg:load,notes:String(fd.get('notes')||'').slice(0,1000),perSide:fd.has('perSide'),optional:fd.has('optional')};if(idx<0)day.exercises.push(rx);else day.exercises[idx]=rx;persist();closeModal();render();toast('Rutina actualizada');
 }else if(form.id==='exerciseForm'){
   const name=String(fd.get('name')||'').trim(),instructions=String(fd.get('instructions')||'').trim(),muscle=String(fd.get('muscle')||'').trim();if(name.length<2||!muscle||!instructions){toast('Completa nombre, grupo muscular y técnica.',true);return;}
   db.exercises.push({id:uid(),name:name.slice(0,100),muscle:muscle.slice(0,40),equipment:String(fd.get('equipment')),unit:String(fd.get('unit')),loadUnit:String(fd.get('loadUnit')),instructions:instructions.slice(0,1000),custom:true});persist();closeModal();render();toast('Ejercicio añadido al banco');
 }}
function filterLibrary(){const q=(document.getElementById('exerciseSearch')?.value||'').trim().toLowerCase(),muscle=document.getElementById('muscleFilter')?.value||'Todos';document.querySelectorAll('[data-library-item]').forEach(el=>{el.hidden=!(el.dataset.text.includes(q)&&(muscle==='Todos'||el.dataset.muscle===muscle));});}
document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-nav]');if(nav){view=nav.dataset.nav;closeModal();render();window.scrollTo(0,0);return;}
 const day=e.target.closest('[data-day]');if(day){selectedDay=Number(day.dataset.day);render();return;}
 const a=e.target.closest('[data-action]');if(a){e.preventDefault();doAction(a);}
 if(e.target.classList.contains('modal-backdrop'))closeModal();
});
document.addEventListener('submit',e=>{if(['measureForm','profileForm','routineForm','exerciseForm'].includes(e.target.id)){e.preventDefault();formSubmit(e.target);}});
document.addEventListener('change',e=>{
 if(e.target.id==='chartMetric'){chartMetric=e.target.value;render();return;}
 if(e.target.id==='muscleFilter'){filterLibrary();return;}
 if(e.target.id==='importFile'){doImport(e.target.files[0]);e.target.value='';return;}
 if(e.target.hasAttribute('data-session-date')){const date=e.target.value;if(validDate(date)&&date<=madridToday()){db.activeSession.date=date;persist();}else{toast('Fecha de sesión no válida.',true);render();}return;}
 if(e.target.hasAttribute('data-set-done')){const ex=db.activeSession?.exercises[Number(e.target.dataset.ex)],set=ex?.sets[Number(e.target.dataset.set)];if(!set)return;set.done=e.target.checked;persist();render();}
});
document.addEventListener('input',e=>{
 if(e.target.id==='exerciseSearch'){filterLibrary();return;}
 const el=e.target;if(!el.hasAttribute('data-set-field')||!db.activeSession)return;
 const ex=db.activeSession.exercises[Number(el.dataset.ex)],set=ex?.sets[Number(el.dataset.set)];if(!set)return;
 const field=el.dataset.setField,v=num(el.value);if(Number.isNaN(v)||(v!=null&&(v<0||v>1000)))return;
 set[field]=v;persist();
});
init();
