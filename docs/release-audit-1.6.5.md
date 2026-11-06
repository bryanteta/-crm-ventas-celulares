# Lunivo 1.6.5 · accesorios, historial y rendimiento

Android `com.crmcelulares.app`, código 34. Entrega local, sin push ni despliegue.

- Protector de pantalla ofrece Hidrogel, Vidrio templado y Otro protector, sin los paréntesis Samsung/iPhone. Se mantienen las categorías, importes y detección del tipo al seleccionar un dispositivo; los borradores con etiquetas anteriores se cargan correctamente y la edición permite normalizarlas al guardar.
- Eliminar del historial retira la venta de las listas normales y recientes, conservando importe, utilidad, comisión histórica, vendedor, correlativo y existencias, según la elección del usuario. Ver eliminadas permite consultar y restaurar. Es una marca de visibilidad persistente, no una eliminación física del documento. Las ventas compartidas sincronizan esa marca; los borradores se mantienen locales. La operación es transaccional, idempotente, atribuida al usuario y rechaza una versión obsoleta.
- El editor deja de leer, validar y copiar el historial completo en cada pulsación. Usa la venta abierta y una copia del lote para la vista previa, agrupa eventos con requestAnimationFrame y evita recálculos duplicados de accesorios. Guardar conserva la validación contra los datos actuales y la transacción de Firestore, por lo que la optimización no permite ignorar conflictos o falta de stock. Las tarjetas de historial/recientes solo se reconstruyen al mostrar esa vista y se reutiliza el formateador de moneda.

Medición reproducible en Chromium: con 2,002 ventas, 40 eventos de entrada en un mismo cuadro producen cero lecturas del almacenamiento del historial y un recálculo. Es una comprobación del trabajo realizado, no una medición de milisegundos en un Samsung físico.

Validación: 56 pruebas Node, 62 unitarias Android release, 25 suites de interfaz y 8 pruebas de reglas, además de integración de Follows y transacciones con el motor Java real en Firestore local. Se prueba ocultar/reintentar/restaurar sin modificar finanzas ni stock y propagar la visibilidad entre dos teléfonos simulados. Se conservan pruebas de edición, fecha de garantía, autoría, stock, correlativos, pérdidas, almacenamiento lleno y conflictos. Release, APK instrumentado y lint compilados, sin errores; seis avisos de dependencias disponibles. Recursos y firma cotejados con el APK. Las pruebas físicas de teclado, plegado e impresión en Samsung siguen pendientes; las instrumentadas se compilan pero el emulador Android del entorno no ofrece servicios utilizables.

Para activar la nueva opción compartida, publicar todo el archivo firestore.rules de esta entrega y actualizar todos los teléfonos sin desinstalar. Las versiones anteriores no ocultan ventas marcadas por esta versión. No se añaden colecciones ni se borran registros. Conservar la firma de actualización y los datos de la app.

APK SHA-256: `f72c5ecd22071c760b67aceb33f7ffa6e640947996adbb2c77b008a430ce4ac3`.
