# NIVEL 5.0 — Personalización del color

Actualización de NIVEL 4.9. Conserva `schemaVersion: 4`, la clave de almacenamiento local `nivel_fitness_data_v1` y el catálogo original de 333 ejercicios. No cambia las reglas de generación de rutinas ni la lógica de cargas por máquina.

## Nueva sección: Perfil → Apariencia

- Cuatro colores de acento: verde original (#c4f46d), azul (#7cc7ff), rosa (#ff9fcf) y amarillo (#ffe077).
- El cambio se aplica inmediatamente y se conserva en `profile.theme`, dentro de la memoria JSON personal. Los respaldos anteriores sin esta propiedad usan el verde.
- Se mantiene el fondo oscuro, los colores de error y el significado del gráfico de composición corporal. El icono instalado de la PWA permanece fijo.
- No se modifica el catálogo ni los registros de entrenamiento.

## Funciones conservadas de NIVEL 4.9

- Inicio: entrenamiento de hoy, dos medidas y accesos rápidos.
- Entrenar: plan semanal, sesión en curso, sesiones libres, mis rutinas, historial y cargas. En una sesión se muestran primero los ejercicios pendientes y completados; al elegir uno se abren sus series. Guardar el ejercicio vuelve a la lista.
- Mis rutinas: lista compacta con nombre, días, duración y enfoque. Cada versión abre un menú con sus datos, días y ejercicios, y opciones (activar, duplicar, eliminar). La edición de los días se hace uno por uno.
- Progreso: composición, medidas/mapa anatómico, evolución e historial en pantallas diferentes.
- Ejercicios: búsqueda, filtros desplegables, 20 resultados por página. Las fichas abren instrucciones, máquinas, alternativas o edición; cada modelo tiene sus propias opciones de disponibilidad y uso.
- Perfil: datos personales, objetivos, rutinas y copias de seguridad separados.
- Formularios extensos: grupos desplegables de campos. Todos los campos se guardan juntos; abrir o cerrar un grupo no descarta lo escrito. En móvil, los diálogos ocupan la pantalla completa y los submenús tienen botones de regreso.

## Actualizar GitHub Pages

1. Exporta primero tu memoria personal desde Perfil → Copias de seguridad (en 4.8, Perfil → Descargar memoria JSON).
2. Sustituye los siete archivos del paquete en el repositorio. Conserva las carpetas `icons/` y `.github/`, no incluidas en el archivo original compartido. No publiques tu respaldo personal.
3. Haz commit y push. Abre la aplicación en el mismo navegador; se conserva el almacenamiento local. La caché del service worker cambia a `nivel-static-v50`.
4. Comprueba el plan semanal, el banco, la edición y una sesión libre. En caso de cambiar de navegador o de dispositivo, restaura tu respaldo.

## Pruebas y límites de esta actualización

- Sintaxis de JavaScript comprobada con Node. Pruebas de DOM en Chromium a 390 × 844: los cuatro temas, selector, navegación, persistencia y restauración simuladas, compatibilidad con preferencias inválidas, ausencia de desbordamiento horizontal y comparación de los datos guardados (solo cambia la preferencia de color). Se inspeccionó visualmente la pantalla de Apariencia.
- La navegación web real está bloqueada en el entorno de prueba; se cargaron el JS y el CSS directamente y se simuló localStorage. No se ha comprobado la instalación y recarga reales de GitHub Pages ni Safari/iOS.
- El catálogo de modelos sigue sin ser un inventario verificado de Fitness Park Zubiarte. Los estados de disponibilidad que ya registraste se conservan.
