# NIVEL 4.6 — Edición del banco y catálogo de máquinas por marca

## Qué se ha cambiado

1. **Botón Añadir ejercicio del banco**: mejor separación del encabezado y las tarjetas, especialmente en móvil.
2. **Banco de ejercicios editable**: botón «Editar» junto a «Ver» en cada ejercicio, tanto precargados como personalizados. Edición de nombre, músculos, instrucciones, nivel, material, marca y línea/modelo. ID inmutable, con historial preservado. Para ejercicios con sesiones registradas no se puede cambiar su unidad (reps / segundos / minutos).
3. **Marcas**: añadidas 33 referencias con nombres documentados por fabricantes: Technogym Selection 900, Hammer Strength Plate Loaded, gym80 Sygnum y Sygnum Dual. El catálogo ahora tiene **163 ejercicios**.
4. **Filtros por marca** y «otras formas de este movimiento» en el detalle; ejercicios con barra, mancuernas, polea y peso corporal siguen existiendo por separado.
5. **Ediciones persistentes**: la propiedad `userEdited` evita que el catálogo predeterminado sobreescriba cambios al actualizar. La clave sigue siendo `nivel_fitness_data_v1` y el `schemaVersion` sigue siendo 4.

## Lo que está verificado y lo que no

Los nombres de equipos añadidos están en los catálogos de los fabricantes y las marcas se anuncian dentro de la cadena Fitness Park. **NO se ha verificado el inventario exacto de modelos de Fitness Park Zubiarte**. Por eso los ejercicios de cada marca están identificados como *referencias de catálogo* y no como presencia confirmada en la sala. Puedes editar el nombre exacto de cada equipo al comprobar su placa; ese cambio se conservará. Las máquinas Hammer Strength Plate Loaded se registran en **kg de discos por lado**, no con el peso total de la máquina; mantenlo consistente. Los kilos de máquinas distintas no son necesariamente comparables.

Fuentes oficiales consultadas:
- Technogym Selection 900: https://www.technogym.com/en-INT/category/selection-900/
- Hammer Strength Plate Loaded: https://www.lifefitness.com/en-us/catalog/strength-training/plate-loaded/hammer-strength
- gym80 Sygnum: https://www.gym80.co.uk/product-ranges/sygnum
- gym80 Sygnum Dual: https://www.gym80.co.uk/product-ranges/sygnum-dual
- Club Zubiarte: https://www.fitnesspark.es/club/bilbao-zubiarte/

## Cómo actualizar GitHub Pages

1. **Antes de actualizar, exporta tus datos desde Perfil → Descargar memoria JSON.** No subas ese archivo privado a un repositorio público.
2. Sustituye los archivos públicos de tu repositorio por los de este paquete y conserva `.github/workflows/pages.yml` e `icons/`.
3. Usa `git add .`, `git commit -m "NIVEL 4.6"` y `git push origin main`.
4. Comprueba el nuevo catálogo y edita una ficha de prueba. Los datos de tu navegador no se borran al actualizar. Si cambias de navegador/dispositivo, restaura el JSON.

Ejecución local: `python -m http.server 5500`, abrir `http://localhost:5500`.
