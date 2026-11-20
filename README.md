# NIVEL 4 — Entrena · Registra · Evoluciona

Web estática para **GitHub Pages** (HTML, CSS, JavaScript y JSON), optimizada para teléfono. No necesita Node, NPM ni servidor de aplicación.

## Novedades de NIVEL 4

1. **Interfaz móvil mejorada**: botones principales más amplios y separados de las tarjetas (especialmente «Rutina del día» y «Sesión libre»); separación uniforme entre acciones, campos, tarjetas y series; controles táctiles de al menos 44–48 px.
2. **Selectores desplegables renovados**: fondo oscuro, contraste, flecha visible, estados de foco; conservan los selectores nativos del móvil por accesibilidad.
3. **Cargas utilizadas en pantalla independiente**: desde Entrenar → «Abrir cargas». Se listan los últimos pesos **realmente guardados** por ejercicio; al pulsar uno se abre su historial de series y fechas. Ya no se repite el historial de kilos en cada ejercicio programado.
4. **Las cargas siguen siendo sugerencia automática**: cuando inicias una sesión, el último peso usado se ofrece en la **primera serie** del mismo ejercicio, sin sobrescribir tu historial ni obligarte a usarlo.
5. **«Ver más» abre otra pantalla**: el historial completo de mediciones, el historial completo de sesiones y la lista completa de cargas son vistas separadas con botón de regreso. Se pueden consultar con enlaces `#/measurements`, `#/sessions` y `#/loads`; también funciona el botón Atrás del navegador.
6. **Nuevo mapa corporal anatómico**: biblioteca externa [Body Muscles (`@emmorts/body-muscles`)](https://github.com/emmorts/body-muscles), versión 2.1.1, con zonas musculares SVG interactivas y vistas delante/detrás. Tocar una región selecciona la medida corporal relacionada y la marca visualmente. Tocar una tarjeta de medida selecciona su valor y actualiza el gráfico de evolución. **La anatomía es ilustrativa**: una medida de cintura, por ejemplo, es un perímetro, no el tamaño de un músculo.
7. **Ventanas**: botón rojo `×` destacado arriba a la derecha, separado del título y cómodo para tocar.

Se mantienen las funciones de NIVEL 3: 130 ejercicios, cinco días de rutina, sesiones libres, registrar ejercicios de uno en uno y en orden real, kilómetros/minutos/inclinación en caminadora, composición grasa/magra si registras porcentaje de grasa, varios objetivos, asistente local, exportación e importación JSON.

## Antes de actualizar: protege tus registros

**Primero abre tu app anterior, ve a Perfil → Descargar memoria (.json) y guarda el archivo en privado.**

La nueva versión reutiliza `localStorage` con la **misma clave** `nivel_fitness_data_v1` y acepta copias antiguas (`schemaVersion` 1, 2 y 3), migrándolas a la versión 4. No borra medidas, sesiones ni ejercicios personales. El `data.json` incluido es **solo la plantilla**: no sustituye tu historial personal.

- Si mantienes exactamente la **misma dirección de GitHub Pages y el mismo navegador**, los registros existentes deberían reaparecer automáticamente.
- Si cambias de dispositivo/navegador, usa Perfil → Restaurar memoria JSON. Restaurar **sustituye** lo guardado en el dispositivo destino.
- GitHub Pages **no sincroniza** automáticamente datos entre teléfonos ni puede reescribir el JSON alojado en el repositorio. Evita subir tus respaldos personales a un repositorio público.
- Al actualizar es posible que tu navegador muestre contenido antiguo por la caché PWA. Cierra y reabre la aplicación; si no cambia, recarga en el navegador. **No borres los datos de navegación** sin tener tu copia.

## Atlas anatómico: funcionamiento y conexión

El mapa usa un módulo de terceros de código abierto, **[@emmorts/body-muscles 2.1.1](https://www.npmjs.com/package/@emmorts/body-muscles)**, distribuido bajo **Apache-2.0**, cargado de forma diferida desde `unpkg.com`. La primera vez requiere conexión a internet. Si el servicio/CDN no está disponible, los registros y las tarjetas de medidas continúan funcionando, y verás un aviso en lugar del mapa. El mapa no es un escaneo médico, un modelo de tu cuerpo ni una medición automática.

El script se carga en la página, por lo que el proveedor de la biblioteca debe ser de confianza, como ocurre con cualquier librería JavaScript de terceros. Si quieres una versión totalmente independiente de CDN, puedes instalar/incorporar localmente la versión empaquetada en una futura actualización.

## Cómo ejecutarlo en VS Code

Abre la carpeta en VS Code y ejecuta:

```bash
python -m http.server 5500
```

Si `python` no existe en Windows, prueba `py -m http.server 5500`. Abre `http://localhost:5500` en Chrome. También funciona con la extensión **Live Server**.

## Publicar en GitHub Pages

1. Sube **todos los archivos y carpetas a la raíz** del repositorio, incluyendo `.github/workflows/pages.yml`, `icons/`, `data.json`, `index.html`, `styles.css` y `app.js`.
2. En GitHub: **Settings → Pages → Build and deployment → GitHub Actions**.
3. Si ya tienes el repo conectado desde VS Code:

```bash
git add .
git commit -m "NIVEL 4 - interfaz responsive e historial por pantallas"
git push origin main
```

4. Abre la misma URL habitual de NIVEL desde tu teléfono.

## Revisión recomendada después de publicar

- Comprobar que siguen tus mediciones y sesiones anteriores.
- Entrar en **Entrenar → Abrir cargas** y consultar una carga anterior.
- Iniciar una rutina y confirmar que la **primera serie** sugiere el último peso real.
- En **Progreso**, entrar en **Ver todas las mediciones** y regresar.
- En **Entrenar**, entrar en **Ver todas las sesiones** y regresar.
- En **Progreso**, tocar **Delante/Detrás**, una región muscular y una tarjeta de medida; comprobar que se ve seleccionada.
- Probar en un móvil estrecho que los botones verdes no toquen las tarjetas y los selectores sean legibles.

## Qué he comprobado en esta entrega

- Sintaxis de `app.js` (`node --check`).
- Pruebas de lógica: migración desde esquema 3 preservando una medición; primera serie prellenada desde la última carga; separación de las páginas de medidas/sesiones/cargas; navegación por hash; correspondencia de regiones anatómicas.
- **No se ha podido completar una prueba visual automatizada en un navegador real en este entorno.** Revisa la apariencia definitiva después de desplegar, especialmente el atlas externo.
