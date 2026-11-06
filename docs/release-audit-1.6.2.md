# Lunivo Suite 1.6.2 · edición de ventas y fecha de garantía

Android `com.crmcelulares.app`, código 31. Preparado localmente, sin publicar APK, desplegar Firebase ni hacer push.

## Cambios visibles

Desde **Ver venta → Editar venta** se pueden corregir cliente, fecha, contacto, cantidad, precio, accesorios con sus precios, pago, banco, meses, canal, proveedor, gastos y notas internas. En ventas manuales o de proveedor también se puede corregir el modelo y costo; el modelo y costo del equipo propio se mantienen para conservar el vínculo con sus existencias. Para sustituir ese equipo hay que anular y registrar otra venta. Los borradores mantienen su edición anterior. Las ventas anuladas se conservan como historial.

La edición conserva ID, vendedor original, fecha de creación, política histórica de comisiones, pago histórico, origen, correlativo y contador. Se registran el usuario y momento de la corrección, sin sustituir al autor original. Corregir la fecha, incluso a otro mes o año, no renumera un comprobante ya emitido: el correlativo y su mes de emisión se conservan. El nombre del archivo conserva el año de ese correlativo para mantener su identificación.

Las diferencias de cantidad de Mis equipos se aplican junto con la venta: aumentar descuenta solo la diferencia y reducir devuelve esa diferencia. La operación compartida requiere conexión, perfil activo y la versión de la venta que se abrió; un cambio de otro teléfono se rechaza sin sobrescribirlo. La interfaz permite descartar el formulario y cargar la actualización. No se eliminan IMEI para reducir cantidades: si hay más seriales que unidades, se pide revisar primero la garantía. Anular después de una edición devuelve las unidades vigentes una sola vez.

La garantía muestra **Fecha de venta**, de solo lectura, en lugar de tomar el día de emisión. La vista previa, impresión y PDF usan la misma fecha, y los tres meses calendario parten de ella. Ejemplo: una venta del 24/10/2026 con garantía preparada en noviembre muestra 24/10/2026 y vence el 24/01/2027. La lectura o impresión de un registro antiguo no reescribe sus datos: se toma la fecha de la venta al generar el documento. Confirmar, editar o guardar la garantía persiste la fecha correcta. Las condiciones particulares previamente guardadas se conservan.

Se mantienen los desplegables editables y las protecciones para que solo una pulsación local en la garantía visible inicie impresión o exportación.

## Firebase: activación necesaria

Publicar manualmente **todo** el archivo `firestore.rules` de esta entrega. Las reglas de 1.6.0/1.6.1 no autorizan `editSale`. La entrega incorpora la nueva operación, conserva la protección del autor y correlativo y verifica el ajuste atómico de existencias. No agrega colecciones ni traslada datos entre cuentas.

Actualizar todos los teléfonos sobre la app instalada, sin desinstalar ni borrar datos, para que todos generen las garantías con la fecha de venta. Si todavía no se activó la sincronización de ventas, completar primero los pasos de incorporación de todos los teléfonos descritos en el informe 1.6.0. Una edición rechazada por falta de reglas conserva la solicitud para reintentar y no se anuncia como confirmada.

## Verificación

- **56 pruebas Node aprobadas:** importes, almacenamiento, accesorios, edición atómica, vendedor y correlativo conservados, falta de existencias sin modificaciones parciales y fecha de garantía independiente de la emisión sin mutar historial.
- **61 pruebas unitarias Android release aprobadas:** incluyen edición y reintento idempotente, ajuste de stock, conflicto de versión, campos inmutables, anulación después de corregir cantidades y normalización de fecha tanto al confirmar como al guardar la garantía.
- **25 suites de interfaz:** nueva edición local con cantidades, precio, accesorios, pago, corrección de fecha, anulación, almacenamiento lleno, versión obsoleta, cancelar sin guardar y aislamiento de cuenta. Se verifica en claro/oscuro y seis anchos entre 320 y 960 px.
- **8 pruebas de reglas Firestore** y la integración anterior de Follows aprobadas contra el emulador oficial local. No se escriben datos en producción. Se conserva la coalescencia medida de una escritura para 20 ediciones rápidas y dos escrituras al reconectar cambios offline de seguimientos y perfiles.
- **Integración real del motor Java con Firestore y dos clientes:** modificar cantidad/precio/fecha y reflejar la edición y accesorios en el otro teléfono; vendedor original y editor distinto; correlativo y contador sin cambios; misma operación reintentada sin otro descuento; falta de stock y versiones obsoletas rechazadas; reducción y anulación devuelven solo las unidades correctas. La fecha recibida por la garantía coincide con la venta corregida. Se mantienen las pruebas de última unidad concurrente, números únicos, importación histórica y ausencia de órdenes de impresión en el otro teléfono.
- `testReleaseUnitTest`, `assembleRelease`, `assembleReleaseAndroidTest` y `lintRelease` aprobados. Se conservan seis avisos de actualización de dependencias y ningún error de lint.
- APK cotejado con recursos web, nuevo editor, copia privada de proveedores, versión, configuración Firebase y firma existente. No se consulta una nueva lista de proveedores en esta entrega.

Las pruebas de interfaz simulan el puente Android; el motor financiero es el Java de producción. Las nativas usan Robolectric. Las instrumentadas se compilan, pero no se ejecutan porque el emulador Android disponible no ofrece servicios del sistema utilizables. Queda pendiente la prueba de impresión física y exportación en los Samsung. Instalar siempre sobre la versión anterior para conservar los datos locales.

APK SHA-256: `e7f3aa44b15d87ce88399cd0bb2d3e46ec293fbe2262414eb42ff99c085eadc0`.
