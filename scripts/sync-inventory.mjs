import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('../frontend/data.json',import.meta.url),'utf8'));
const fields=['id','name','muscle','equipment','unit','level','brand','modelName','disponibilidad_zubiarte'];
const canonical=data.exercises.map(e=>[e.id,Object.fromEntries(fields.map(k=>[k,e[k]??null]))]);
if(new Set(canonical.map(x=>x[0])).size!==canonical.length)throw Error('IDs duplicados');
fs.writeFileSync(new URL('../backend/src/inventory.mjs',import.meta.url),'export const inventory = new Map('+JSON.stringify(canonical)+');\n');
console.log(`${canonical.length} fichas sincronizadas con el backend.`);
