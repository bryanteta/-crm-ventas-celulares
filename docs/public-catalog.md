# Catálogo público de Lunivo

URL: https://bryanteta.github.io/-crm-ventas-celulares/catalogo/

Sitio independiente en `catalogo/`, publicado por GitHub Pages desde `main`. No cambia el CRM, la APK ni las reglas de Firestore. La consulta de cada variante abre WhatsApp de Lunivo (+503 7624 1930); el sitio no confirma ventas ni reserva unidades.

## Coincidencia con la app

El actualizador consulta las mismas fuentes y usa el mismo `feeds-core.js` que la app. El precio final se calcula con `SalesCore.suggestedPrice`: precio de origen + $80. Se conservan todas las unidades disponibles y sus distintos precios. Solo se suman cantidades cuando coinciden **todas las características públicas y el precio final**. No se descartan las alternativas de mayor precio. Cada variante tiene su propia tarjeta con sus características, condición, precio exacto y existencias. Solo se reúnen equipos idénticos: un cambio en capacidad, color, categoría, batería, ciclos, SIM, caja, avisos, descripción de condición o precio conserva una tarjeta separada. No hay un precio «Desde» que mezcle distintas variantes. Las descripciones libres se comparan internamente para evitar unir estados desconocidos; solo su huella forma parte del identificador público, sin publicar las notas.

Se conservan capacidad, color, batería, categoría, ciclos, SIM física, caja y avisos de pantalla/batería/desgaste cuando la fuente los proporciona. La condición predeterminada se publica como «Seminuevo», por indicación del comercio; «Nuevo» y «Open Box» se conservan si la fuente los indica. Los demás datos desconocidos se mantienen como tales. Las fotos son imágenes oficiales de referencia de Apple y Samsung, no fotos de las unidades en venta; la foto se selecciona por modelo y color exactos. Si no hay una equivalencia de color confirmada, se muestra «Foto de este color pendiente», sin usar otro color ni una imagen de toda la gama. La suma de existencias y el desglose por precio deben coincidir con las fuentes que recibe la app en la misma consulta.

Esto refleja el **inventario de proveedores de la app**, con la regla de $80 solicitada. No lee las ventas, clientes, garantías, equipos manuales ni precios personales preparados en la cuenta de Firebase. Estos datos siguen privados. App y web pueden tener horas de consulta distintas; la app actualiza cuando está abierta y el catálogo tiene su propia tarea periódica.

## Actualización automática gratuita

Archivo: `.github/workflows/refresh-catalog.yml`.

1. Guardar la clave de acceso del proveedor como **Actions Secret** llamado `SPLIT_INVENTORY_TOKEN` en https://github.com/bryanteta/-crm-ventas-celulares/settings/secrets/actions/new. No es una variable pública y nunca se pega en archivos, logs ni mensajes.
2. Comprobar que el archivo del workflow esté en `main` y que Actions esté habilitado. Abre https://github.com/bryanteta/-crm-ventas-celulares/actions/workflows/refresh-catalog.yml y ejecuta **Run workflow** para verificar la primera consulta.
3. Una ejecución correcta consulta ambas fuentes, construye el JSON público, ejecuta las pruebas, guarda únicamente `catalogo/inventory.json` y solicita explícitamente una compilación de Pages. Es necesario solicitarla porque los commits hechos con `GITHUB_TOKEN` no disparan el Pages heredado por sí solos.

La tarea está programada a los minutos 7 y 37 de cada hora, y permite ejecución manual. GitHub puede retrasar tareas programadas: no es tiempo real ni un máximo garantizado de 30 minutos. Actions y Pages en este repositorio público utilizan el servicio gratuito estándar de GitHub.

Permisos del workflow: `contents: write` para guardar el catálogo y `pages: write` para solicitar la publicación. La tarea no tiene permiso para administrar secretos. El secreto se envía solo al endpoint del proveedor durante la consulta. Las respuestas privadas se procesan dentro de un directorio temporal que se elimina al finalizar; no se suben artefactos privados ni se hace commit de datos crudos. Solo se guarda el JSON público.

No se puede copiar el secreto restringido del entorno cloud a GitHub; su propietario debe configurarlo directamente en la pantalla segura indicada arriba. Si la integración utilizada para trabajar en el repositorio no tiene permiso `workflows`, el archivo queda preparado localmente y debe añadirse desde GitHub por un administrador antes de poder activar la tarea.

Si falta el secreto o falla una fuente o la validación, no se sustituye el catálogo anterior. Una fuente válida con cero disponibles sí retira sus equipos del catálogo; no se mantienen unidades vendidas solo porque la lista esté vacía. Los fallos de Actions aparecen en la pestaña Actions. Revisar allí la primera ejecución para confirmar la activación.

## Comportamiento de la web

El navegador consulta solo `catalogo/inventory.json`. Revisa una nueva copia cada cinco minutos mientras está visible y al regresar a la pestaña. Conserva los filtros y no cambia la selección ni el precio de un diálogo abierto. Si falla la consulta en segundo plano, mantiene la lista anterior con un aviso. Al superar dos horas desde la última actualización muestra «Consultar stock» y advierte al visitante. La hora publicada utiliza `America/El_Salvador`.

La disponibilidad se confirma por WhatsApp antes de comprar. No hay claves, costos, proveedores, dueños, enlaces de origen, identificadores de fuentes, IMEI ni notas privadas en el JSON o los recursos del catálogo. Los nombres se convierten a modelos conocidos (por ejemplo, `IPHONE 13 PRO 128GB475` pasa a `iPhone 13 Pro`). Las observaciones se limitan a valores controlados.

## Actualización y pruebas locales

Con el secreto ya configurado en un entorno autorizado:

```sh
python3 scripts/refresh-public-catalog.py
npm test
npm run test:catalog
```

El actualizador usa un directorio temporal privado; el constructor comprueba ambas fuentes, cantidades, precios y fecha de menos de 24 horas, y reemplaza el JSON de forma atómica. Para el navegador, servir previamente el repositorio en `http://127.0.0.1:8000/`, o configurar `CATALOG_TEST_URL`.

Las pruebas cubren privacidad, precio exacto, conservación de cantidades y variantes, listas vacías, avisos de condición, fallo sin sobrescritura, filtros, WhatsApp, carga automática, preservación del diálogo y errores de actualización.

## Imágenes oficiales por modelo y color

`catalogo/product-images.json` (versión 2) indexa las fotos por la pareja `modelo|color`, con nombre de acabado oficial, página original, URL de imagen, crédito, dimensiones, archivo local y SHA-256. Las fotos de iPhone proceden de los selectores por modelo/acabado del comparador oficial de Apple (https://www.apple.com/iphone/compare/); se conserva el selector CSS y su hoja de estilos para comprobar que la foto corresponde al acabado indicado. Las de Samsung proceden de sus páginas oficiales de producto, compra o soporte; se conserva el SKU o la descripción de la galería cuando está disponible.

El manifiesto incorpora 94 combinaciones de modelo/color, incluidos iPhone 14 Plus Lila y iPhone 18 Pro Glaciar. Las imágenes muestran un solo acabado, que puede verse por delante y por detrás en la misma foto. No se usan composiciones de toda la gama ni se modifica o recolorea la foto original. El dueño confirmó que «Titanio» significa «Titanio natural»; este nombre se normaliza al generar el inventario.

Los alias de proveedor se vinculan a acabados oficiales del modelo: por ejemplo, Negro de iPhone 13 → Midnight, Celeste/Azul de iPhone 13 Pro → Sierra Blue, Dorado de iPhone 16 Pro → Desert Titanium y Blanco de iPhone 17 Pro Max → Silver. La correspondencia concreta figura en cada entrada como `officialColor`. Los colores realmente sin confirmar quedan registrados en `unavailable`, con foto pendiente. Se mantienen en venta con sus especificaciones y precio, sin inventar una foto del color.

Las fotos se guardan sin alterar sus bytes en `catalogo/assets/products/`, se cargan de forma diferida y se reutilizan entre equipos del mismo modelo y color. Son referencias comerciales del acabado, no fotografías ni prueba de la condición física de las unidades seminuevas. El navegador no consulta directamente a Apple o Samsung.

Para volver a descargar las imágenes revisadas: `python3 scripts/fetch-catalog-images.py` (requiere Pillow para validar archivos). Es posible limitar modelos con `--model 'iPhone 13'`. No forma parte del cron de inventario: una caída de las webs de imágenes no impide actualizar existencias. Un color nuevo sin foto revisada muestra el aviso de foto pendiente hasta añadir su entrada.

Las pruebas comprueban selección exacta por modelo/color, ausencia de fotos de otros acabados como alternativa, conservación de «Nuevo»/«Open Box», política «Seminuevo», fuentes oficiales, archivos originales y degradación ante imágenes ausentes.

## Control de datos de origen

Los colores declarados se validan antes de publicar: Lila/Lilac/Lavanda y Glaciar/Glacier están reconocidos; un nombre declarado no reconocido detiene la actualización en lugar de descartarlo silenciosamente. El último catálogo correcto se conserva hasta revisar el color. Un color realmente vacío puede seguir como «Color por confirmar» si tampoco figura en los detalles.

La condición sigue esta prioridad: categoría estructurada, estado de los detalles y, finalmente, título. Así, «Open Box» o «Seminuevo» en los detalles no se convierten en «Nuevo» porque un título antiguo contenga esa palabra. Se reconocen SIM física, chip físico, eSIM, RAM, avisos de componentes, pantalla reemplazada, burbujas/puntos negros de pantalla y cable incluido mediante etiquetas controladas. No se publican notas libres, costos ni datos del proveedor.

La revisión del 8 de noviembre contrastó 150 variantes/324 unidades, todos los colores explícitos (100 variantes), 136 valores de batería y 102 capacidades explícitas con una misma consulta de los proveedores. Coincidieron cantidades y el desglose de precios finales. El único equipo sin color de esa consulta era un iPhone 13 Pro 128 GB cuyo origen no incluía color. Estas cifras describen esa consulta, no un total fijo: el inventario puede cambiar en actualizaciones posteriores.

## Referencias de Flip4 Blanco y Amarillo

Se conservan los nombres comerciales «Blanco» y «Amarillo» del proveedor. Samsung Bespoke Studio documenta las combinaciones White/White y Yellow/Yellow con marco Silver, asociadas respectivamente a los SKU SM-F721B4SEXME y SM-F721B4YEXME. Se utilizan imágenes oficiales de esos acabados como referencias para cada color, sin cambiar las etiquetas visibles ni atribuir una edición o SKU concreto a las unidades del proveedor. El inventario de origen no especifica el marco ni la edición exacta de esas unidades.

Fuente de combinaciones: https://www.samsung.com/my/mobile/galaxy-bespoke/galaxy-z-flip4/ . La imagen amarilla se obtiene de la página oficial de soporte del SKU y la blanca del propio Studio. Las URLs, los acabados y la procedencia quedan documentados en el manifiesto de imágenes.
