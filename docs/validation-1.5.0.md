# Lunivo 1.5.0-preview · Validación

## Cambios

Inventario global y vistas independientes de Samuel, Saúl y Javier, con modelos compactos, búsqueda, marca y orden alfabético. Los lotes anteriores pueden asignarse sin cambiar cantidades, costos o ventas históricas. Los enlaces están pendientes: no hay conexión automática a inventarios externos.

Se retiró el apartado de Comisiones. Las ventas nuevas no descuentan los $15; los registros anteriores conservan sus cifras. Los accesorios se registran y aparecen por separado en el comprobante, incluyendo productos sin costo. El PDF se exporta directamente con texto y líneas vectoriales, sin capturar el WebView.

## Pruebas ejecutadas

- **34 pruebas Node:** persistencia, separación entre cuentas, datos sin conexión, importación y autoría de Follows; cálculos exactos, política sin comisiones nuevas y compatibilidad histórica; inventario, accesorios y sus totales; correlativo, fechas, IMEI opcional y documentos sin información interna.
- **35 pruebas unitarias Android release con Robolectric:** cero fallos, errores u omitidas. Esquema/caché nativos, recordatorios, permisos, áreas seguras, sonido, carga local de impresión, validación del documento, destino PDF y cancelación del selector.
- **4 pruebas instrumentadas en Android 15/API 35:** PDF A4 nativo válido; desglose de accesorios; campos largos con más de una página; fallo de escritura propagado. Se ejecutó únicamente ReceiptPdfDocumentInstrumentedTest. FinalAppTest se compiló y no se contó como ejecutado.
- **16 suites web:** ventas e integridad, inventario/propietarios, accesorios, retirada de comisiones, navegación, recibos y garantías, inicio/sonido, ajustes/avisos, compatibilidad Lunivo, perfiles, puente Android, almacenamiento y hora de El Salvador. Cinco/seis tamaños en las nuevas pantallas y siete en la regresión Android.
- **Firebase en emulador:** ocho pruebas de reglas y flujo entre dos sesiones de Follows, sin conexión, eliminación, perfiles y aislamiento entre cuentas. No se usó el proyecto de producción.
- **Android Lint:** sin incidencias. APK release e instrumentación compilados.

## Inspección del PDF real de Android

Se recuperaron los PDFs producidos por PdfDocument en el emulador y se abrieron con un lector independiente. El ejemplo normal tiene una página A4 (595 × 842 puntos), texto seleccionable y el logo original de 1254 × 1254. Se comprobaron los trazados vectoriales de los glifos y la ausencia de una imagen que cubra toda la página.

El caso largo conserva los 500 seriales, sin faltantes ni duplicados, y las observaciones finales. El ejemplo de accesorios contiene los productos y precios individuales y el total $791.00. Las páginas adicionales se permiten para conservar el tamaño de letra. Las cifras y clientes de los ejemplos son ficticios.

## Actualización y límites

Versión 1.5.0-preview / código 19; paquete y certificado conservados frente a 1.4.3. Los recursos web empaquetados se compararon byte a byte con las fuentes; el APK es íntegro y no tiene depuración habilitada.

No se probó un Note 20 Ultra o Z Fold físico ni una impresora real. La exportación nativa sí se ejecutó en Android emulado. No se publicaron reglas ni se modificó Firebase de producción. Ventas e inventario siguen siendo locales por cuenta/dispositivo; los perfiles de Follows mantienen su sincronización existente.
