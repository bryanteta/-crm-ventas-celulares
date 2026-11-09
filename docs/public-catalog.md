# Catálogo público de Lunivo

URL principal: https://lunivosv.com/

Dominio activo con HTTPS y publicación mediante GitHub Actions. La raíz abre directamente el catálogo; `www.lunivosv.com` redirige al dominio principal y la ruta anterior `/catalogo/` redirige a la raíz.

Sitio independiente en `catalogo/`, publicado por GitHub Actions/Pages desde `main`. El archivo `scripts/prepare-catalog-site.cjs` prepara el catálogo en la raíz y una redirección para `/catalogo/`, conservando los recursos antiguos para pestañas abiertas, sin incluir los archivos del CRM ni Android. No cambia el CRM, la APK ni las reglas de Firestore. La consulta de cada variante abre WhatsApp de Lunivo (+503 7624 1930); el sitio no confirma ventas ni reserva unidades.

## Coincidencia con la app

El actualizador usa `feeds-core.js` para normalizar los inventarios de los mismos proveedores. El catálogo web consulta Samuel mediante la API JSON de TecnoShop; la app Android también usa esta API desde la versión 1.7.12. Las versiones instaladas anteriores siguen usando CSV hasta actualizarse. Los adaptadores conservan la misma representación de variantes y precios. El precio promocional al contado se calcula con `SalesCore.suggestedPrice`: precio de origen + $80. Se conservan todas las unidades disponibles y sus distintos precios. Solo se suman cantidades cuando coinciden **todas las características públicas y el precio final**. No se descartan las alternativas de mayor precio. La vista agrupa colores en una tarjeta cuando coinciden modelo, capacidad, condición, categoría, batería, ciclos, SIM, caja, RAM, avisos y precio. Cada color conserva su variante, foto y existencias. Cambiar cualquiera de esas especificaciones mantiene una tarjeta separada; dos variantes distintas del mismo color también se conservan por separado. Los círculos de color permiten seleccionar desde la tarjeta o el detalle, y WhatsApp recibe la variante seleccionada. El JSON conserva todas las variantes originales y no modifica sus cantidades. No hay un precio «Desde» que mezcle distintas variantes. Las descripciones libres se comparan internamente para evitar unir estados desconocidos; solo su huella forma parte del identificador público, sin publicar las notas.

Se conservan capacidad, color, batería, categoría, ciclos, SIM física, caja y avisos de pantalla/batería/desgaste cuando la fuente los proporciona. La condición predeterminada se publica como «Seminuevo», por indicación del comercio; «Nuevo» y «Open Box» se conservan si la fuente los indica. Los demás datos desconocidos se mantienen como tales. Las fotos son imágenes oficiales de referencia de Apple y Samsung, no fotos de las unidades en venta; la foto se selecciona por modelo y color exactos. Si no hay una equivalencia de color confirmada, se muestra «Foto de este color pendiente», sin usar otro color ni una imagen de toda la gama. La suma de existencias y el desglose por precio deben coincidir con las fuentes que recibe la app en la misma consulta.

Esto refleja el **inventario de proveedores de la app**, con la regla de $80 solicitada. No lee las ventas, clientes, garantías, equipos manuales ni precios personales preparados en la cuenta de Firebase. Estos datos siguen privados. App y web pueden tener horas de consulta distintas; la app actualiza cuando está abierta y el catálogo tiene su propia tarea periódica.

## Actualización automática gratuita

Archivo: `.github/workflows/refresh-catalog.yml`.

1. Guardar la clave de acceso del proveedor como **Actions Secret** llamado `SPLIT_INVENTORY_TOKEN` en https://github.com/bryanteta/-crm-ventas-celulares/settings/secrets/actions/new. No es una variable pública y nunca se pega en archivos, logs ni mensajes.
2. Comprobar que el archivo del workflow esté en `main` y que Actions esté habilitado. Abre https://github.com/bryanteta/-crm-ventas-celulares/actions/workflows/refresh-catalog.yml y ejecuta **Run workflow** para verificar la primera consulta.
3. Una ejecución correcta consulta ambas fuentes, construye el JSON público, ejecuta las pruebas, guarda únicamente `catalogo/inventory.json`. Al terminar correctamente dispara `.github/workflows/deploy-catalog.yml` mediante `workflow_run`, que publica la versión más reciente de `main`. Este evento funciona aunque el commit de datos lo haya realizado `GITHUB_TOKEN`. Si la consulta falla, no se despliega un reemplazo.

La tarea está programada a los minutos 7, 22, 37 y 52 de cada hora, y permite ejecución manual. Si falla una consulta, reintenta hasta tres veces antes de conservar la última publicación válida. GitHub puede retrasar o descartar tareas programadas: no es tiempo real ni un máximo garantizado de 15 minutos. Actions y Pages en este repositorio público utilizan el servicio gratuito estándar de GitHub.

Permisos: el actualizador usa `contents: write` para guardar el catálogo. Durante la transición el actualizador conserva `pages: write` para publicar por el mecanismo anterior si la fuente sigue en modo legacy. El publicador independiente usa `contents: read`, `pages: write` e `id-token: write`, sin acceso a la clave del proveedor. La tarea no tiene permiso para administrar secretos. El secreto se envía solo al endpoint del proveedor durante la consulta. Las respuestas privadas se procesan dentro de un directorio temporal que se elimina al finalizar; no se suben artefactos privados ni se hace commit de datos crudos. Solo se guarda el JSON público.

No se puede copiar el secreto restringido del entorno cloud a GitHub; su propietario debe configurarlo directamente en la pantalla segura indicada arriba. Si la integración utilizada para trabajar en el repositorio no tiene permiso `workflows`, el archivo queda preparado localmente y debe añadirse desde GitHub por un administrador antes de poder activar la tarea.

Si falta el secreto o falla una fuente o la validación, no se sustituye el catálogo anterior. Una fuente válida con cero disponibles sí retira sus equipos del catálogo; no se mantienen unidades vendidas solo porque la lista esté vacía. Los fallos de Actions aparecen en la pestaña Actions. Revisar allí la primera ejecución para confirmar la activación.

## Comportamiento de la web

El navegador consulta `inventory.json` relativo a la ubicación de la página: tanto la raíz como `/catalogo/` reciben el mismo inventario. Revisa una nueva copia cada cinco minutos mientras está visible y al regresar a la pestaña. Conserva los filtros y no cambia la selección ni el precio de un diálogo abierto. Si falla la consulta en segundo plano, mantiene la lista anterior con un aviso. Al superar dos horas desde la última actualización, las tarjetas muestran «Consultar stock», sin un aviso general de antigüedad. La hora publicada utiliza `America/El_Salvador`.

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

## Tema claro y oscuro

El botón de luna/sol de la cabecera alterna el tema. La primera visita usa modo claro, independientemente del tema del teléfono. Una elección manual se guarda en `lunivo-catalog-theme` de este catálogo y se conserva en visitas posteriores. Cambiar el tema del sistema no altera esa selección. Los cambios se reflejan entre pestañas. No se escriben datos en Firebase ni se modifica el inventario. Si el navegador bloquea almacenamiento, la selección sigue funcionando durante la visita.

`theme.js` aplica la preferencia en la cabecera del documento antes de cargar los estilos para evitar el destello claro al abrir el modo oscuro. También ajusta el color de la barra del navegador. Las superficies, botones, filtros, avisos y diálogos tienen su paleta oscura. Las fotos de productos conservan sus colores originales sobre una base neutra.

Validación: `npm run test:catalog-theme` comprueba modo claro predeterminado incluso en dispositivos oscuros, persistencia manual, sincronización entre pestañas, contraste, diálogo oscuro, footer adaptable y funcionamiento con almacenamiento bloqueado.

## Comprobaciones de actualización y presentación

El 8 de noviembre se confirmó que las consultas y publicaciones manuales funcionaban, pero no aparecían ejecuciones con evento `schedule`. Se volvió a registrar el horario (minutos 22 y 52 UTC), y se deshabilitó/habilitó la tarea para reactivar la programación. La tarea también consulta los proveedores al publicar cambios de la portada, código del catálogo o manifiesto de imágenes. Los commits de `GITHUB_TOKEN` no disparan otra tarea, y se mantiene la solicitud explícita de compilación de Pages.

Una ejecución manual correcta no demuestra que el cron esté funcionando. Para comprobar el automático se debe revisar una ejecución cuyo evento sea `schedule`, su resultado y la nueva fecha del JSON público. GitHub puede retrasar o descartar tareas programadas; si se necesita un horario independiente se puede usar un programador externo que invoque `workflow_dispatch` con una credencial de GitHub limitada al repositorio, guardada de forma privada en ese programador.

Las fotos Samsung usan metadatos de encuadre calculados sobre los márgenes transparentes originales. El navegador centra el dispositivo dentro de la misma zona que los iPhone, sin cambiar los archivos ni sus colores. En iPhone, «Batería en excelente estado» se usa cuando el proveedor no aporta porcentaje; los porcentajes existentes se conservan y no se inventa un 100%. En Samsung se muestra siempre «Batería en excelentes condiciones», sin porcentajes, en tarjetas, detalles y WhatsApp.

## Promoción al contado y tasa cero

El importe `priceCents` del inventario público sigue siendo el precio promocional exclusivo al contado. En cada tarjeta se resalta y se muestra tachado el precio regular, calculado como el promocional más un 10%, redondeado una sola vez al dólar más cercano (mitades hacia arriba); por ejemplo, $935.00 → $1,029.00. El promocional conserva sus centavos originales. El cálculo se deriva en el navegador de cada actualización del inventario; no se suma el 10% al JSON ni se publica el precio de compra.

Las condiciones de pago se presentan junto al precio de cada equipo y en su detalle, sin una leyenda adicional en la portada. En el detalle del equipo, elegir Tasa cero aplica el precio regular y muestra banco y cuotas. Al seleccionar banco aparecen sus opciones con el monto mensual visible antes de elegir el plazo. Se seleccionan directamente, sin un desplegable adicional. Banco Agrícola y Banco BAC Credomatic ofrecen 3, 6, 9 y 12 cuotas; Banco Promerica y Banco Davivienda agregan 18 y 24; Banco Cuscatlán agrega 18, 24 y 36 según la configuración comercial indicada por el usuario y guardada en `catalogo/payment-plans.json`. No se consulta una API bancaria ni se autoriza un financiamiento: el enlace de WhatsApp permite consultar con Lunivo el equipo, forma de pago, banco, plazo y total elegidos.

Cada opción muestra el plazo y el importe de la cuota. Los importes se muestran sin el prefijo «Desde», tanto en las tarjetas como en las cuotas y mensajes de WhatsApp. Al elegir el plazo se oculta el mensaje auxiliar, incluido el desglose de cuotas; el total regular exacto permanece en el bloque de precio. Se conservan instrucciones antes de seleccionar y mensajes de error de configuración. No se muestran aproximaciones, «Por mes» o «Última». Cambiar banco restablece el plazo; abrir otro equipo restablece la opción al contado. Un fallo de configuración conserva el catálogo y permite consultar por WhatsApp sin inventar cuotas.

Validación: `npm run test:catalog-payments` verifica todos los precios públicos, los cinco bancos y sus plazos hasta 36 cuotas, redondeo al dólar, mensajes de WhatsApp, reinicio entre equipos, fallos de configuración y diseño en ambos temas a 320/412/840/1140 px. Complementan las pruebas existentes de catálogo y modo oscuro.

La presentación recupera el diseño compacto anterior, sin un recuadro adicional dentro de la tarjeta ni un bloque enmarcado en el detalle. Conserva los textos «Precio regular», «Precio promocional» y «Precio exclusivo por pago de contado», el regular tachado y el promocional resaltado, con adaptación a ambos temas.

Los acentos de botones, opciones seleccionadas, enfoque y portada usan tonos azules en ambos temas. Los importes promocionales y el check de contado conservan su color verde; las fotos de los dispositivos conservan sus colores originales.

## Verificación de la programación

Se confirmó una ejecución real con evento `schedule`, no causada por un push ni una ejecución manual: [42534114500](https://github.com/bryanteta/-crm-ventas-celulares/actions/runs/42534114500), terminada correctamente el 8 de noviembre a las 5:13 p. m. de El Salvador. Consultó las fuentes, pasó las pruebas de integridad y solicitó la publicación de Pages. Esto confirma que GitHub registró la programación; no garantiza puntualidad. Se amplió la frecuencia a cuatro consultas por hora y se incorporaron reintentos ante fallos transitorios. La clave de Split permanece en GitHub Actions, sin exponerse en la web.

El footer organiza la identidad de Lunivo, el contacto por WhatsApp, el acceso al inventario y los enlaces oficiales de Instagram y Linktree. La nota comercial y la moneda se muestran en una franja inferior. La estructura se adapta a móvil y escritorio en ambos temas.

La imagen y el nombre del equipo son botones accesibles que abren el mismo detalle que «Ver equipo», también con teclado. El contacto del footer no muestra el número telefónico como texto. El enlace de consulta prepara un borrador de WhatsApp con saludo, modelo/capacidad, estado/categoría, batería, color y los demás detalles públicos disponibles, separados en líneas con emojis. Incluye el método de pago y, al seleccionar tasa cero, banco, plazo e importe de la cuota. Se reinicia al cambiar de equipo y no envía mensajes automáticamente.

La portada presenta imágenes oficiales de Samsung S26 Ultra celeste (Sky Blue) y iPhone 18 Pro Max Burgundy (Borgoña). La selección promocional no agrega registros ni unidades al inventario. Las leyendas de portada muestran únicamente el color. Si el modelo/color no está en la consulta actual, no se asigna un identificador de equipo disponible ni se agregan existencias. La imagen del S26 Ultra muestra frente y reverso, incluida la pantalla, en el acabado celeste oficial. Se conserva el logotipo como alternativa si las fotos no cargan o no hay inventario de la marca.

Las consultas detalladas utilizan directamente `https://api.whatsapp.com/send` con `phone` y `text` codificado una sola vez con `encodeURIComponent`. Se verificó que el servicio conserva los emojis y saltos de línea en sus enlaces de apertura de WhatsApp. Se evita la redirección del enlace corto, que en la comprobación reemplazó los emojis por caracteres de sustitución. El enlace sigue preparando un borrador; no envía mensajes automáticamente.

## Fuente API de Samuel / TecnoShop

La actualización del catálogo consulta por HTTP GET la implementación de Apps Script proporcionada por el comercio, con `fn=getCatalogo&a=[]`. Esa ruta de lectura responde públicamente con `{c, v}`; `c` contiene el catálogo JSON con `columnas`, `filas`, `proximos`, `ahora` y `leido`. Se verificó que no requiere token; los parámetros de clave probados no cambian esa respuesta pública. La clave facilitada no se incluye en el repositorio, el sitio, las imágenes ni el JSON publicado. Si el proveedor entrega otro endpoint autenticado, se debe configurar siguiendo su contrato, sin adivinar su autenticación.

El nuevo adaptador `samuelApi` acepta el sobre JSON o el catálogo ya decodificado, valida columnas, tipos, precios y fechas, y toma solamente las unidades de `filas`. `proximos` no se publica como stock disponible. Agrupa únicamente variantes idénticas y conserva los identificadores para datos equivalentes. No se consulta el CSV desde la actualización web ni se vuelve a él si la API falla: los reintentos conservan el último catálogo válido. El adaptador CSV se conserva por compatibilidad con los datos existentes. Android 1.7.12 consulta la misma API JSON y mantiene los identificadores y las listas guardadas.

La comprobación de integración contrastó 226 unidades de esta API con su fuente anterior: coincidieron variantes, cantidades, especificaciones y precios. El catálogo público mantiene el aumento de $80 y las reglas de precio promocional/regular, sin publicar costos ni el catálogo crudo del proveedor.

## Cobertura de imágenes revisada el 9 de noviembre de 2026

Las APIs de inventario de Samuel y Split no incluyen campos de imagen en sus respuestas actuales. Se conservan fotos oficiales locales por modelo y color. Se añadieron las equivalencias de iPhone 15 Pro Max Blanco → White Titanium y Gris → Natural Titanium, usando los mismos archivos oficiales ya verificados para esos acabados; el nombre del proveedor se mantiene en la vista. Samsung S26 Morado usa la galería oficial de Cobalt Violet, SKU SM-S942UZVEXAA, con vista frontal y trasera.

En la consulta revisada solo permanece sin foto el iPhone 13 Pro cuyo color está por confirmar. No se asigna otro acabado para llenar ese espacio. Los archivos nuevos conservan sus bytes originales, fuente, dimensiones, encuadre y SHA-256 en `product-images.json`.
