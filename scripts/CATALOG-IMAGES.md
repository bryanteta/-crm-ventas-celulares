Las fotos del catálogo se resuelven por modelo y color exactos en `product-images.json`. No se usa la foto de otro acabado ni se reemplazan las asignaciones revisadas.

`Actualizar fotos oficiales del catálogo` consulta cada 15 minutos el catálogo público de Cloudflare, busca las variantes sin imagen en los metadatos oficiales de Apple y Samsung y descarga las fotos originales al repositorio. Apple publica las fotos en su comparador; Samsung entrega el modelo, color y foto mediante su API de productos. No se requieren claves de proveedores ni se publica información privada. Los horarios de GitHub Actions pueden demorarse.

Si hay coincidencia verificable, el workflow actualiza el manifiesto y los archivos y activa Pages. La web vuelve a consultar el manifiesto cada cinco minutos durante la actualización del inventario, sin cambiar un diálogo abierto. Un equipo puede aparecer primero sin foto hasta completar esa publicación.

Las coincidencias ambiguas, los colores desconocidos o las fotos ausentes se dejan pendientes y se reintentan en las siguientes ejecuciones. Las fotos existentes se conservan si Apple, Samsung o Cloudflare no responden. Los modelos antiguos que las APIs ya no publican todavía pueden añadirse manualmente usando una fuente oficial y `fetch-catalog-images.py`.

Para ejecutar manualmente:

```sh
python3 -m pip install Pillow==11.3.0
python3 -m unittest discover -s tests -p test_catalog_images.py
python3 scripts/discover-catalog-images.py
```

La galería de «Ver equipo» usa `gallery` para vistas oficiales adicionales del mismo modelo y acabado. `fetch-catalog-galleries.py`, ejecutado en la misma tarea programada, descarga perspectivas de Samsung cuyos metadatos coinciden en modelo, color oficial y SKU, y versiones de mayor resolución de las comparaciones de Apple. No usa fotos de cajas ni de gamas completas como perspectivas de un color.

Cuando el fabricante no publica fotos independientes, el carrusel ofrece la vista general y acercamientos explícitamente identificados de la misma foto. El zoom admite pellizcar, arrastrar, rueda, doble clic y controles de teclado; la navegación admite deslizar, miniaturas y flechas. La galería se reinicia al cambiar de color y no modifica precios ni cuotas.

Verificación del carrusel: `npm run test:catalog-gallery`. Para incluir el motor de Safari, instalar WebKit de Playwright y ejecutar con `TEST_WEBKIT=1`.
