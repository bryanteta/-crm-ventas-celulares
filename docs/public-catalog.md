# Catálogo público de Lunivo

URL: https://bryanteta.github.io/-crm-ventas-celulares/catalogo/

Sitio independiente en `catalogo/`, publicado por GitHub Pages desde `main`. No cambia el CRM, la APK ni las reglas de Firestore. La consulta de cada variante abre WhatsApp de Lunivo (+503 7624 1930); el sitio no confirma ventas ni reserva unidades.

## Coincidencia con la app

El actualizador consulta las mismas fuentes y usa el mismo `feeds-core.js` que la app. El precio final se calcula con `SalesCore.suggestedPrice`: precio de origen + $80. Se conservan todas las unidades disponibles y sus distintos precios. Solo se suman cantidades cuando coinciden **todas las características públicas y el precio final**. No se descartan las alternativas de mayor precio. Cada variante tiene su propia tarjeta con sus características, condición, precio exacto y existencias. Solo se reúnen equipos idénticos: un cambio en capacidad, color, categoría, batería, ciclos, SIM, caja, avisos, descripción de condición o precio conserva una tarjeta separada. No hay un precio «Desde» que mezcle distintas variantes. Las descripciones libres se comparan internamente para evitar unir estados desconocidos; solo su huella forma parte del identificador público, sin publicar las notas.

Se conservan capacidad, color, batería, categoría, ciclos, SIM física, caja y avisos de pantalla/batería/desgaste cuando la fuente los proporciona. Lo desconocido no se inventa. Las fotos son imágenes oficiales de referencia de Apple y Samsung, no fotos de las unidades en venta; el color puede variar. El color real ofrecido aparece como texto en cada tarjeta. La suma de existencias y el desglose por precio deben coincidir con las fuentes que recibe la app en la misma consulta.

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

## Imágenes oficiales

`catalogo/product-images.json` conserva la URL de la página oficial, la URL original de cada imagen, el crédito, dimensiones, archivo local y SHA-256. Los 36 modelos de la publicación inicial de fotos tienen una imagen revisada. Las imágenes de iPhone proceden de la página oficial de identificación de modelos de Apple (https://support.apple.com/en-us/108044); las de Samsung proceden de sus páginas de producto, compra o soporte. No se utilizan fotos de otros comercios.

Las imágenes se guardan sin alterar sus bytes en `catalogo/assets/products/`, se cargan de forma diferida y se reutilizan entre variantes. No se consulta a Apple o Samsung desde el navegador del cliente. La foto es del modelo, no una promesa del color ni de la condición de una unidad. Si falta un modelo nuevo en el manifiesto o falla una foto, el inventario y el botón de consulta siguen disponibles con «Imagen no disponible».

Para volver a descargar las imágenes revisadas: `python3 scripts/fetch-catalog-images.py` (requiere Pillow para validar los archivos). No forma parte del cron de inventario, por lo que una caída de las webs de imágenes no impide actualizar existencias. Las pruebas comprueban las fuentes oficiales, hashes de archivos y la degradación ante imágenes ausentes.
