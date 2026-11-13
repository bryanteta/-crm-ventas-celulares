Las fotos del catálogo se resuelven por modelo y color exactos en `product-images.json`. No se usa la foto de otro acabado ni se reemplazan las asignaciones revisadas.

`Actualizar galerías del catálogo` consulta cada 15 minutos el catálogo público de Cloudflare, busca las variantes sin imagen en los metadatos oficiales de Apple y Samsung y descarga las fotos originales al repositorio. Apple publica las fotos en su comparador; Samsung entrega el modelo, color y foto mediante su API de productos. No se requieren claves de proveedores ni se publica información privada. Los horarios de GitHub Actions pueden demorarse.

Si hay coincidencia verificable, el workflow actualiza el manifiesto y los archivos y activa Pages. La web vuelve a consultar el manifiesto cada cinco minutos durante la actualización del inventario, sin cambiar un diálogo abierto. Un equipo puede aparecer primero sin foto hasta completar esa publicación.

Las coincidencias ambiguas, los colores desconocidos o las fotos ausentes se dejan pendientes y se reintentan en las siguientes ejecuciones. Las fotos existentes se conservan si Apple, Samsung o Cloudflare no responden. Los modelos antiguos que las APIs ya no publican todavía pueden añadirse manualmente usando una fuente oficial y `fetch-catalog-images.py`.

Para ejecutar manualmente:

```sh
python3 -m pip install Pillow==11.3.0
python3 -m unittest discover -s tests -p test_catalog_images.py
python3 scripts/discover-catalog-images.py
```

La galería de «Ver equipo» usa `gallery` para vistas oficiales adicionales del mismo modelo y acabado. `fetch-catalog-galleries.py`, ejecutado en la misma tarea programada, descarga perspectivas de Samsung cuyos metadatos coinciden en modelo, color oficial y SKU, y versiones de mayor resolución de las comparaciones de Apple. No usa fotos de cajas ni de gamas completas como perspectivas de un color.

El carrusel solo incluye archivos de fotos distintas del modelo y color elegidos. No crea recortes para simular otras perspectivas. Si solo existe una foto verificada, muestra una imagen con zoom, sin flechas ni miniaturas repetidas. El zoom admite pellizcar, arrastrar, rueda, doble clic y controles de teclado; la navegación admite deslizar, miniaturas y flechas. La galería se reinicia al cambiar de color y no modifica precios ni cuotas.

Verificación del carrusel: `npm run test:catalog-gallery`. Para incluir el motor de Safari, instalar WebKit de Playwright y ejecutar con `TEST_WEBKIT=1`.

En los iPhone, el modal prioriza las fotos individuales revisadas (`singleDevice`), mostrando frente y reverso por separado. Las composiciones de Apple con dos teléfonos se conservan para las tarjetas del catálogo; las composiciones adicionales de reacondicionados y el `primaryImage` de Swappie no se importan como nuevas perspectivas. Si solo hay una vista individual verificada, no se añaden fotos repetidas para aumentar el contador. Para Samsung se consultan los catálogos oficiales de varias regiones y se exige coincidencia de modelo y acabado oficial antes de agregar una perspectiva.

La ampliación usa también galerías estructuradas de Swappie y Refurbed: exige que el modelo de la página coincida, que cada imagen corresponda al acabado indicado y, en Refurbed, que la variante seleccionada conserve el SKU esperado. Guarda el crédito y la página de origen por foto. Ante un límite HTTP 429 detiene las consultas a esa fuente durante la ejecución y conserva las imágenes anteriores.

`press-device-galleries.py` consulta las páginas públicas del archivo de Samsung Mobile Press, con paginación real y filtro de imágenes de producto. Solo incorpora archivos publicados cuyo embargo ya terminó y cuyo nombre identifica el modelo y acabado. No utiliza fotos privadas, grupos de colores, lápices por separado ni imágenes de otro acabado.

El carrusel admite hasta diez fotos adicionales, con miniaturas desplazables y seguimiento de la selección. La cobertura se calcula por modelo y color: un color sin confirmar o una combinación Bespoke no documentada queda pendiente, sin suplantarla por otra.

Los Flip4 Bespoke blanco/blanco y amarillo/amarillo, con marco plateado como en la referencia inicial, incluyen capturas del modelo 3D original del configurador de Samsung. Se conserva su geometría, paleta de materiales e iluminación; solo se cambian la vista y el estado de plegado mediante los controles originales del fabricante. `sourceType: manufacturer-3d-view` y `sourceRender` documentan el modelo, sus hashes y la configuración. Estas capturas se sirven como imágenes estáticas: el cliente no carga el visor 3D.

Para reproducir las capturas verificadas (requiere Chromium y Playwright):

```sh
python3 scripts/fetch-bespoke-render-sources.py /tmp/lunivo-bespoke-capture
node scripts/capture-bespoke-views.cjs /tmp/lunivo-bespoke-capture
python3 scripts/import-bespoke-captures.py /tmp/lunivo-bespoke-capture/captures.json
node scripts/check-gallery-coverage.cjs
```

La prueba de cobertura comprueba las vistas efectivamente mostradas, exige al menos dos vistas individuales verificadas por iPhone conocido y exige al menos tres archivos en las galerías generales de Samsung; comprueba hashes y encuadres y señala los registros sin color que el proveedor debe completar. La prueba del navegador también comprueba la cobertura completa, además de la navegación, el zoom y el desplazamiento de galerías largas.

`fetch-apple-device-galleries.py` agrega los detalles individuales de cámara publicados por Apple para las familias y los acabados revisados. Son archivos originales diferentes de las vistas de frente y reverso, no recortes creados para aumentar el contador. Su registro distingue los nombres de archivo de Sierra Blue, Alpine Green y (PRODUCT)RED de sus nombres comerciales. Se ejecuta con la actualización automática, conserva las asignaciones revisadas y deja pendientes las familias sin otra vista verificable.

El iPhone 11 Pro Max verde incluye además dos fotos de prensa individuales publicadas por GSMArena, revisadas para ese modelo y acabado. Su registro conserva el enlace y el crédito; no se aplican a otros colores.
