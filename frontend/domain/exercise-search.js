// Shared local search: index each actual exercise, never another machine's identity.
export function normalizeExerciseQuery(value){
 return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
const groupAliases={
 'grupo-aperturas-de-pecho':'mariposa butterfly pec deck fly aperturas pectorales',
 'grupo-press-de-pecho-horizontal':'press banca press plano chest press pectoral',
 'grupo-press-de-pecho-de-pie-maquina':'press pecho de pie pectoral standing chest press',
 'grupo-press-inclinado-de-pecho':'press inclinado pectoral superior incline chest press',
 'grupo-press-de-pecho-convergente':'press pecho convergente pectorales',
 'grupo-elevaciones-laterales-de-hombros':'elevacion lateral deltoides lateral lateral raise',
 'grupo-press-de-hombros':'press militar hombro shoulder press deltoides',
 'grupo-jalon-al-pecho':'jalon dorsal dorsales lat pulldown',
 'grupo-jalon-al-pecho-agarre-ancho':'jalon dorsal dorsales agarre ancho wide pulldown',
 'grupo-remo-sentado-en-polea-o-maquina':'remo bajo dorsal dorsales low row',
 'grupo-remo-alto-iso-lateral':'remo alto dorsal dorsales high row',
 'grupo-remo-pecho-apoyado':'remo dorsal dorsales pecho apoyado row',
 'grupo-prensa-de-piernas':'prensa piernas leg press',
 'grupo-extension-de-cuadriceps':'extension piernas leg extension cuadriceps',
 'grupo-extension-unilateral-de-cuadriceps':'extension piernas unilateral leg extension cuadriceps',
 'grupo-sentadilla-pendular-pendulum-squat':'sentadilla pendular pendulum squat',
 'grupo-hack-squat':'sentadilla hack hack squat',
 'grupo-crunch-abdominal':'abdominales crunch core',
 'grupo-hip-thrust':'empuje cadera hip thrust gluteos',
};
const muscleAliases={Pecho:'pectoral pectorales chest',Espalda:'dorsal dorsales back',Hombros:'hombro deltoides shoulder',Cuádriceps:'cuadriceps piernas pierna quad quads',Isquiotibiales:'femoral femorales piernas pierna hamstrings',Glúteos:'gluteo glutes glute piernas pierna',Gemelos:'pantorrillas pantorrilla calf calves piernas',Aductores:'aductor piernas pierna',Abdomen:'abdominal abdominales core abs',Bíceps:'biceps brazos brazo',Tríceps:'triceps brazos brazo',Movilidad:'estiramiento estiramientos movilidad stretching', 'Zona lumbar':'lumbar espalda baja'};
const equipmentAliases={'Máquina':'maquina maquinas machine',Mancuernas:'mancuerna mancuernas dumbbell dumbbells pesas peso libre',Barra:'barra barras barbell peso libre pesas',Polea:'polea poleas cable cables', 'Peso corporal':'peso corporal calistenia sin material bodyweight', Otro:''};
export function exerciseSearchRecord(e,group){
 const name=normalizeExerciseQuery(e.name), model=normalizeExerciseQuery(e.modelName), brand=normalizeExerciseQuery(e.brand), code=normalizeExerciseQuery(e.modelCode);
 // Only index the movement name, not its alternative brands, models or material options.
 const movement=normalizeExerciseQuery([group?.name,e.movementGroup?.replace(/^grupo-/,''),groupAliases[e.movementGroup]].filter(Boolean).join(' ')).replace(/\ben polea o maquina\b/g,'');
 const material=e.equipment==='Otro'?[e.equipment,...(e.materialOptions||[]).filter(m=>!/^maquina/i.test(normalizeExerciseQuery(m)))].join(' '):e.equipment;
 const text=normalizeExerciseQuery([name,model,brand,code,code.replaceAll(' ',''),e.machineLine,e.muscle,muscleAliases[e.muscle],material,equipmentAliases[e.equipment],movement,brand==='gym80'?'gym 80':null,e.brand==='Hammer Strength'?'hammer hammerstrength discos plate loaded':null].filter(Boolean).join(' '));
 return {name,model,brand,code,movement,text};
}
export function exerciseSearchScore(record,query){
 const q=normalizeExerciseQuery(query);if(!q)return 0;
 const tokens=q.split(' '),words=record.text.split(' ');
 if(!tokens.every(t=>words.some(w=>w.startsWith(t))||record.text.includes(t)))return -1;
 if(q===record.code||q===record.code.replaceAll(' ',''))return 120;
 if(q===record.name||q===record.model)return 110;
 if(record.name.startsWith(q)||record.model.startsWith(q))return 95;
 if(record.name.includes(q)||record.model.includes(q))return 85;
 if(record.movement.includes(q))return 70;
 return 30+tokens.filter(t=>record.name.includes(t)||record.model.includes(t)).length*5;
}
