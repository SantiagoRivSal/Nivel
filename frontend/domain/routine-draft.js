// Shared weekly routine model. No UI, storage or AI dependencies.
export const WEEK = Object.freeze([1,2,3,4,5,6,7]);
export function createRoutineDraft(source, proposal={}) {
 const days=Object.fromEntries(WEEK.map(k=>[k,{title:'Descanso',rest:true,exercises:[]}]));
 for(const k of WEEK){const d=proposal.days?.[k];if(d){days[k]={title:String(d.title||'Entrenamiento').slice(0,100),rest:!d.exercises?.length,exercises:structuredClone(d.exercises||[]),...(d.preferences?{preferences:structuredClone(d.preferences)}:{})};}}
 return {name:proposal.name||'Mi rutina',source,generated:source!=='manual',focus:proposal.focus||'',level:proposal.level||'',minutesPerSession:proposal.minutesPerSession||null,split:proposal.split||'Personalizada',days};
}
export function moveDraftExercise(draft,day,index,direction){const a=draft?.days[day]?.exercises,j=index+direction;if(!a||!Number.isInteger(index)||![-1,1].includes(direction)||index<0||index>=a.length||j<0||j>=a.length)return false;[a[index],a[j]]=[a[j],a[index]];return true;}
export function setDraftExercise(draft,day,index,rx){const d=draft?.days[day];if(!d||!Number.isInteger(index)||index< -1||index>=d.exercises.length||(index===-1&&d.exercises.length>=50))return false;if(index===-1)d.exercises.push(structuredClone(rx));else d.exercises[index]=structuredClone(rx);d.rest=false;if(d.title==='Descanso')d.title='Entrenamiento';return true;}
export function removeDraftExercise(draft,day,index){const d=draft?.days[day];if(!d||!Number.isInteger(index)||index<0||index>=d.exercises.length)return false;d.exercises.splice(index,1);d.rest=!d.exercises.length;return true;}
export function buildSavedRoutine(draft,{id,date,validExercise}){
 if(!draft||!draft.name?.trim()||draft.name.trim().length>100)throw Error('Introduce un nombre válido.');
 const days=Object.fromEntries(WEEK.map(k=>{const d=draft.days[k];if(!d||!Array.isArray(d.exercises)||d.exercises.length>50||!d.exercises.every(validExercise))throw Error('Revisa los ejercicios y sus valores en cada día.');return [k,{title:d.exercises.length?(d.title.trim()||'Entrenamiento'):'Descanso',rest:!d.exercises.length,exercises:structuredClone(d.exercises),...(d.exercises.length&&d.preferences?{preferences:structuredClone(d.preferences)}:{})}];}));
 if(!WEEK.some(k=>!days[k].rest))throw Error('Añade al menos un ejercicio en algún día.');
 return {...structuredClone(draft),name:draft.name.trim(),days,id,createdAt:date};
}
