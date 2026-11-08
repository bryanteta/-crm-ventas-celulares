# Catálogo público de Lunivo

URL: https://bryanteta.github.io/-crm-ventas-celulares/catalogo/

El catálogo es un sitio independiente en `catalogo/`. GitHub Pages publica la carpeta desde `main` sin cambiar el CRM, su inicio, la APK ni las reglas de Firestore. No hay login, reservas ni confirmación de ventas: la consulta de cada variante abre WhatsApp de Lunivo (+503 7624 1930).

## Datos públicos

`inventory.json` guarda una copia del inventario disponible, con el precio final en centavos de USD. El proceso de publicación aplica `SalesCore.suggestedPrice`: costo de la fuente + $80. El cliente no recibe costos, margen, proveedores, propietarios, enlaces de origen, credenciales, IMEI, notas libres ni identificadores de las fuentes.

Los nombres se convierten a modelos conocidos (por ejemplo, `IPHONE 13 PRO 128GB475` pasa a `iPhone 13 Pro`). Se extraen capacidad, color, batería y estado mediante valores controlados; los avisos de batería/pantalla y desgaste se conservan como observaciones para el comprador sin publicar notas privadas. El estado que no esté confirmado se presenta como tal. Los dibujos de teléfonos son ilustraciones decorativas, no fotos de las unidades.

Cuando coinciden especificaciones y observaciones, se conserva el precio de venta más bajo. No se suman ni anuncian cantidades que puedan pertenecer a precios distintos. La ficha agrupa las variantes del mismo modelo y dice «Desde» cuando existen varios precios. La disponibilidad se debe confirmar con Lunivo antes de comprar.

## Actualizar la copia publicada

La primera publicación es una captura, **no una sincronización automática**. Cada carga muestra la fecha de actualización en hora de El Salvador. Después de 48 horas se muestra una advertencia y los distintivos pasan a «Consultar stock».

En un entorno autorizado con `SPLIT_INVENTORY_TOKEN` ya configurado para consultar el origen, ejecutar desde la raíz:

```sh
catalog_snapshot_dir=$(mktemp -d)
python3 scripts/fetch-provider-snapshot.py --output "$catalog_snapshot_dir/inventory-private.json"
node scripts/build-public-catalog.cjs "$catalog_snapshot_dir/inventory-private.json" catalogo/inventory.json
rm -r "$catalog_snapshot_dir"
npm test
npm run test:catalog
```

Para la prueba de navegador, servir previamente el repositorio en `http://127.0.0.1:8000/`, o configurar `CATALOG_TEST_URL`. Después revisar y publicar **solo** `catalogo/inventory.json` con commit y push a `main`.

El archivo privado permanece fuera del repositorio. El constructor comprueba que estén ambas fuentes, sus cantidades, los precios y una fecha de captura de menos de 24 horas. Falla ante formatos desconocidos, fuentes vacías o respuestas incompletas y escribe mediante sustitución atómica: un fallo no sustituye la última lista correcta.

La actualización programada requiere un ejecutor con acceso autorizado a las fuentes y un mecanismo seguro de credenciales. No se ha instalado un cron ni se han copiado secretos al repositorio. En esta sesión la integración de GitHub no permite administrar Actions Secrets (403), y el secreto del entorno está restringido al dominio de origen; no se exporta a GitHub.

## Validación

- `npm test`: reglas de transformación pública, privacidad, precio de venta, fuentes incompletas y pruebas existentes del CRM.
- `npm run test:catalog`: navegador real; filtros, búsqueda, ordenación, variantes, precios, WhatsApp, errores/reintento, lista desactualizada, texto sin ejecución de HTML, ausencia de llamadas a proveedores y pantallas de 320/412/840/1280 px.
- Los únicos recursos del navegador proceden de `catalogo/`. No se modifica la seguridad de Firestore para hacer público el inventario.
