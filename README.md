# NIVEL 5.9.1 — Entrenamiento personal

## Ejecutar desde la carpeta general (macOS, Windows, Linux)

Con Node.js 22 o superior instalado, abre una terminal en la carpeta que contiene `package.json` y ejecuta:

```sh
npm run dev
```

Abre http://localhost:8787. No se requiere `npm install` para el desarrollo local: el servidor usa exclusivamente módulos incorporados de Node. Detén el servidor con Ctrl+C. Si el puerto está ocupado, detén el servidor anterior o cambia `PORT` (cambiar el puerto cambia el origen de almacenamiento del navegador).

## Actualización y datos

1. En la versión anterior, Perfil → Copias de seguridad → exportar JSON.
2. Descomprime la nueva versión en una carpeta nueva. No superpongas archivos antiguos: se retiraron módulos y configuraciones que ya no se usan.
3. Ejecuta `npm run dev` y abre la misma dirección de antes, en el mismo navegador. Así se conserva localStorage (`nivel_fitness_data_v1`, esquema 4). Si cambia la dirección, importa el respaldo.
4. No publiques tu respaldo personal ni archivos privados de configuración.

## Crear rutinas

Entrenar → Crear rutina: Manual o Asistente NIVEL. En ambos casos hay un editor semanal común. El objetivo general y la duración de referencia se establecen arriba. Cada día tiene un único selector de enfoque, nivel y minutos. Hay 47 enfoques agrupados y 11 objetivos de rendimiento/composición/recuperación, además de las prioridades musculares compatibles con versiones anteriores.

El asistente semanal admite un mensaje opcional y genera una propuesta para los días seleccionados. El chat diario permite crear, completar sin cambiar tus ejercicios, o ajustar las series, repeticiones y descansos de los elegidos. Revisa la propuesta y aplícala únicamente al día correspondiente. El modo manual conserva todos los controles de edición.

### Buscar y seleccionar ejercicios

El selector compartido se abre al añadir un ejercicio en el editor semanal, al editar una rutina guardada, en sesiones personalizadas y durante un entrenamiento en curso. Escribe el nombre del movimiento, marca, modelo o código. Ejemplos: `mariposa gym80`, `4341`, `hammer pecho`, `bíceps polea`. Puedes combinar palabras en cualquier orden y omitir las tildes. Los filtros por material/marca y músculo se combinan con el texto y muestran el número de resultados. Selecciona una ficha concreta antes de guardar. Cada modelo conserva su propio identificador, tipo de carga e historial; no se seleccionan máquinas archivadas o marcadas como no disponibles. Los modelos sin verificar se identifican como «Por confirmar». Los sinónimos son locales y no abarcan todas las denominaciones posibles. El banco de ejercicios comparte la misma búsqueda, incluyendo las fichas no archivadas que se han marcado como no disponibles para poder gestionar su estado.

### Qué reconoce el chat local

- `45 minutos`, `4 ejercicios`, `principiante`, `intermedio`, `avanzado`.
- `solo poleas y mancuernas`, `sin máquinas`, `sin barra`, `sin material`, `sin saltos` (filtra nombres conocidos de saltos/carrera; no es una evaluación clínica de impacto).
- `hipertrofia`, `fuerza`, `powerbuilding`, `resistencia muscular`, `definición`.

Las zonas musculares se seleccionan en el formulario. El chat aplica reglas deterministas, no es un modelo de lenguaje ni un entrenador médico. No entiende cualquier frase; muestra la interpretación para revisión. El número de ejercicios y el tiempo son orientativos y dependen del catálogo y nivel. En el modo completar o ajustar, las restricciones no borran los ejercicios que elegiste. No inventa pesos ni prescribe tratamientos. Las cargas existentes no se cambian automáticamente: revisa que sean adecuadas a los nuevos rangos. El generador no optimiza automáticamente la recuperación o volumen semanal a partir de tu historial. La nomenclatura y programación flexible se inspiran en la actualización ACSM de 2026 (https://pubmed.ncbi.nlm.nih.gov/41843416/); las combinaciones son opciones de organización, no protocolos clínicos.

## Inventario y datos personales

351 fichas activas, 92 modelos del inventario (98 fichas de máquina/cardio, incluidas modalidades de modelos multifunción). Los 71 modelos Technogym del listado original están activos provisionalmente, incluyendo Vertical Traction y Total Abdominal; 5 gym80 y 16 Hammer Strength se conservan. Los modelos no disponibles siguen excluidos de selectores y generador. Se conservan IDs anteriores cuando existían, unidades, historial, colores, ejercicios libres y datos personales. Los nuevos movimientos tienen fichas independientes; el nombre inglés original y la descripción del movimiento en español permiten distinguirlos. El inventario original se conserva en `catalogo-reserva/`. Las instrucciones de los modelos sin ficha específica son orientativas; sigue las indicaciones de la máquina. Los borradores semanales sin guardar siguen en memoria hasta recargar.

## Arquitectura

- `frontend/domain/day-planner.js`: agrupaciones, objetivos, planificación semanal, selección y prescripción diaria.
- `frontend/domain/exercise-search.js`: normalización, sinónimos y puntuación de coincidencias del buscador compartido.
- `frontend/domain/local-coach.js`: interpretación de instrucciones y restricciones locales.
- `frontend/domain/routine-draft.js`: edición, movimientos y guardado de rutinas.
- `scripts/dev.mjs`: servidor local de archivos públicos.
- `backend/src/index.mjs`: adaptador de publicación estática; las rutas de API devuelven 404.
- `backend/src/inventory.mjs`: inventario sincronizado para futuras extensiones.

No hay integración de IA externa, claves, formularios de conexión ni consultas de entrenamiento a servidores externos. Si previamente desplegaste un servicio externo, la actualización local no lo desactiva remotamente: elimina sus secretos o redespliega desde esta versión. No reutilices la configuración privada anterior.

## Pruebas y publicación

```sh
npm run check
npm test
npm run sync:inventory
```

Para publicar opcionalmente en Cloudflare, instala las dependencias de desarrollo (`npm install`), autentícate con Wrangler y ejecuta `npm run deploy`. Se conserva el nombre del Worker anterior para facilitar la actualización. Si publicas en GitHub Pages, usa el workflow incluido, que publica exclusivamente `frontend/`.

Las pruebas automatizadas comprueban inventario, migración, combinaciones, planificación, interpretación y edición. Las pruebas incluyen, incluyendo búsqueda por modelo/código, sinónimos, marcas y exclusión de máquinas no disponibles. Chromium bloqueó la navegación de prueba por política del entorno; no se completó la validación visual/interactiva.

## Registro de series (5.9.1)

Ya no hay casillas de selección por serie. Introduce los datos y pulsa «Guardar este ejercicio»: se guardan las series con repeticiones, segundos o minutos/km válidos. Las series vacías se omiten. Al guardar el entrenamiento también se conservan las series válidas pendientes. El historial anterior y el catálogo no cambian.
