# Lunivo 1.7.13 — Garantías y pago directo

Android 1.7.13, código 48. Las garantías dejan de mostrar el correlativo en la vista previa, impresión HTML, título del documento y PDF nativo (cabecera, control y pie de todas las páginas). Los números internos de las ventas y los contadores se conservan para sincronización e historial. No se requieren reglas nuevas de Firebase ni migraciones.

El PDF se propone como `Lunivo - Nombre del cliente - Modelo.pdf`. El nombre elimina separadores de ruta y caracteres de control, conserva acentos y limita longitud. Android valida el nombre antes de abrir el selector de archivos. Los nombres históricos siguen siendo aceptados por compatibilidad.

Contacto y pago quedan visibles al abrir el editor de garantía, antes de los datos del equipo. Los selectores de banco y cuotas son directos en registro, edición de venta y garantía. Se ofrecen Banco Agrícola y Banco BAC Credomatic (3/6/9/12), Banco Promerica y Banco Davivienda (3/6/9/12/18/24), y Banco Cuscatlán (3/6/9/12/18/24/36). Cambiar banco elimina un plazo que no esté permitido; las selecciones válidas se conservan. Los nombres antiguos BAC/Promerica se reconocen. Los bancos y cuotas fuera del catálogo guardados en ventas anteriores se muestran como registro anterior, sin borrarlos ni ofrecerlos para una venta nueva.

## Validación

- `npm test`: 80 pruebas aprobadas. Incluye documentos sin número, nombres de archivo seguros y coherencia de bancos/cuotas con la web.
- `testReleaseUnitTest`: 74 pruebas nativas aprobadas. Incluye nombres Unicode seguros, intent de guardado con cliente/modelo y aceptación de un documento sin número interno.
- `tests/warranty-ui.cjs`: borrador → venta → garantía → PDF, modificación/cancelación, persistencia, fallo atómico y aislamiento entre cuentas.
- `tests/receipt-actions-ui.cjs`: emisión exclusivamente por pulsación local, sin reimpresiones causadas por otra venta/dispositivo, aislamiento de respuestas y reinicios.
- `tests/receipt-integrity-ui.cjs`: contadores e importes conservados, anulación sin reutilizar números y garantía para ventas anteriores.
- `tests/sale-edit-ui.cjs`: pagos, fecha, cantidades, stock, importe, vendedor, errores de escritura y concurrencia; 2,002 ventas con recálculo agrupado.
- `tests/appearance-warranty-ui.cjs`: foco y mensajes por campo, contacto/pago visibles, tema oscuro y siete tamaños de pantalla.
- `tests/payment-flow-ui.cjs`: cinco bancos, plazos exactos hasta 36, cambio de banco, datos históricos y diseño en cuatro anchos y ambos temas.
- PDF guardado desde la salida HTML y revisado con `pdftotext`: cliente, modelo, fecha e importes presentes, sin correlativo.
- `assembleRelease lintRelease -PpublicRelease`: compilación correcta, cero errores de lint; avisos existentes de versiones de dependencias. Firma e integridad del APK verificadas con `prepare-update.py`.

No hubo teléfono ni emulador conectado. La prueba de generación con PdfDocument en Robolectric no pudo abrir una página por falta de soporte del entorno ("document is closed"); no se utiliza como validación de renderizado nativo. El PDF vectorial Android requiere comprobarse físicamente; sí se verificaron su contrato sin número, nombre, permisos de emisión, compilación y formato HTML equivalente. No se cambió el motor de dibujo ni la lógica financiera.
