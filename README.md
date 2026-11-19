# NIVEL — Entrena. Registra. Evoluciona.

Aplicación web estática, de código sencillo (HTML + CSS + JavaScript), lista para **GitHub Pages**. No necesita `npm`, compiladores ni servidor. Es adaptable a móvil y se puede instalar como acceso directo (PWA).

## Qué incluye

- Registro de peso y de 10 medidas corporales, con fecha y notas; admite registrar **solo peso, solo una medida o varias a la vez**.
- Historial editable, eliminación de registros y gráficos de progreso.
- Rutina de fuerza de cinco días precargada y editable, con referencias de carga que **no son sesiones reales**.
- Registro de entrenamientos por series, kilos, repeticiones/tiempos, borradores y sesiones terminadas.
- Banco de 49 ejercicios, instrucciones y posibilidad de crear otros.
- Duplicar versiones de rutina sin perder el historial.
- Memoria local automática + descargar/restaurar respaldos **JSON**.

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `nivel`).
2. Sube **todos** los archivos y carpetas de este ZIP a la **raíz** del repositorio, incluida `.github/workflows/pages.yml`. Debe quedar `index.html` en la raíz, no dentro de una carpeta adicional.
3. Asegúrate de que la rama principal se llama `main`. Haz commit de los archivos.
4. En **Settings → Pages → Build and deployment**, selecciona **GitHub Actions**.
5. El flujo **Deploy NIVEL to GitHub Pages** publica el sitio. La dirección generalmente será `https://TU-USUARIO.github.io/nivel/`, según el nombre del repositorio. Comprueba la URL exacta en Settings → Pages.
6. En el móvil, abre la dirección y usa *Añadir a pantalla de inicio* (Safari/Chrome, según el dispositivo).

## Cómo funciona la memoria JSON

`data.json` es la **plantilla inicial** (perfil, plan de entrenamiento y 49 ejercicios); **no contiene mediciones ficticias**. La primera vez que abres NIVEL, la app lee ese archivo. A partir de ahí guarda automáticamente las modificaciones en `localStorage` del navegador.

**Importante:** GitHub Pages sirve archivos de forma estática. Por seguridad, un sitio web no puede modificar el `data.json` alojado en tu repositorio con cada medición. Por eso los datos se guardan en **ese navegador y dispositivo** y no se comparten con otros automáticamente.

Desde **Perfil → Descargar mi memoria (.json)** obtendrás un respaldo completo de tus datos; desde **Restaurar memoria JSON** puedes subir ese archivo en otro móvil o después de reinstalar el navegador. La importación sustituye todo el estado local y pide confirmación. Se recomienda descargar una copia semanal.

**Privacidad:** no publiques en tu repositorio de GitHub los respaldos JSON con medidas personales. Si borras los datos del navegador o abres NIVEL en otro dispositivo sin importar tu JSON, los datos anteriores no aparecerán. Para sincronización automática haría falta añadir autenticación y una base de datos externa.

## Archivos

- `index.html` — estructura y metadatos de la app.
- `styles.css` — todos los estilos para móvil y escritorio.
- `app.js` — lógica de mediciones, entrenamientos, rutinas, historial y JSON.
- `data.json` — plantilla inicial con 49 ejercicios y tu rutina de cinco días.
- `manifest.webmanifest` y `icons/icon.svg` — icono e instalación en pantalla de inicio.
- `sw.js` — cache de archivos estáticos para acceso offline tras la primera visita.
- `.github/workflows/pages.yml` — despliegue automático en GitHub Pages.

## Pruebas locales

Desde la carpeta del proyecto ejecuta:

```bash
python -m http.server 8000
```

Visita `http://localhost:8000`. Evita abrir `index.html` con doble clic, porque el navegador puede bloquear la lectura local de `data.json`.

Los archivos se ofrecen tal cual para un proyecto personal. Si más adelante utilizas datos sensibles de varias personas o necesitas sincronización y recuperación de cuenta, incorpora backend autenticado, cifrado en tránsito y controles de acceso.
