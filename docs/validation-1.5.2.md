# Lunivo 1.5.2-preview · Inventario compacto

## Cambios

- Las tarjetas de equipos muestran modelo, características, dueño, unidades, costo y disponibilidad. El costo registrado se identifica como **Costo**; no se inventa un precio de venta.
- Split conserva el combinado de Samuel y Javier y las vistas individuales. Global conserva todos los dueños y los lotes sin asignar.
- Al tocar una tarjeta se muestran el modelo completo y las acciones Vender, Agregar unidades y Organizar. Solo se abre una tarjeta a la vez; también funciona con teclado. Vender queda deshabilitado para agotados.
- TecnoShop usa el mismo formato compacto e identifica **Proveedor** y **Precio**, conservando su catálogo de referencia, fecha y selección para ventas.
- Búsqueda y dueño permanecen visibles; marca, orden y mostrar agotados se agrupan en un desplegable. Los indicadores de unidades/lotes ocupan una sola franja.
- No cambia el formato de almacenamiento, los saldos, la asignación de dueños ni la lógica de ventas, accesorios y garantías.

## Verificación

- Núcleo Node: **35 pruebas aprobadas**.
- Interfaz: **18 suites aprobadas**, incluidos alta/reposición, descuento atómico al vender, anulación sin doble devolución, aislamiento por cuenta, cuota de almacenamiento, accesorios, garantías, perfiles, notificaciones y proveedores.
- Prueba nueva de tarjetas: dueño visible, costo/precio correcto, acciones inicialmente plegadas, apertura exclusiva con ratón/teclado, agotados sin venta, selección de oferta y existencias conservadas. Sin desbordamiento y tarjetas cerradas de hasta 100 px en anchos 320, 384, 412, 690, 840 y 960 px.
- Las pruebas de flujo esperan a que se muestre el formulario tras navegar desde una oferta antes de comprobar los controles.
- Android release: **35 pruebas Robolectric aprobadas**, compilación y **Lint sin incidencias**.
- APK: ZIP íntegro, los 17 archivos web/recursos incluidos coinciden con las fuentes; firma verificada e idéntica a la entrega 1.5.1.

Paquete `com.crmcelulares.app`, versión `1.5.2-preview`, código **21**. Se instala como actualización manteniendo la identidad y el almacenamiento de la app.

Las comprobaciones de tamaños se ejecutaron en Chromium. No se realizó prueba en Samsung físico en esta entrega. El generador nativo de PDF no cambió; las pruebas instrumentadas de PDF de la entrega 1.5.0 no se cuentan como ejecutadas de nuevo. Firebase y sus reglas no se modifican. Inventarios, ventas y cotizaciones continúan locales por cuenta/dispositivo; TecnoShop sigue siendo una lista fechada, sin disponibilidad en vivo.

APK SHA-256: `51273115064dc42fab8c6e52ae036d435be7f2a86d305bf06333b360b5a6fc77`.
