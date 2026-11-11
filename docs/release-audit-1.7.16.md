# Lunivo 1.7.16 — Garantía desde la venta

Android 1.7.16, código 51. La garantía aprovecha los datos del equipo seleccionado: marca, capacidad, color, batería, estado comercial y estado físico cuando están definidos. También interpreta datos concretos de la descripción del proveedor (por ejemplo, «Seminuevo · 97% · sin daños visibles»). Los grados A/B/C se consideran seminuevos, conforme al catálogo. Samsung sin porcentaje usa «En excelentes condiciones».

Los datos se guardan en el comprobante de la venta, sobreviven a borradores y quedan separados de futuras actualizaciones del proveedor. Los equipos preparados conservan su descripción original. Al abrir una venta antigua incompleta se sugieren solo los datos recuperables de su propia descripción, sin consultar el inventario actual. Las correcciones existentes tienen prioridad y los campos ambiguos quedan pendientes. Un aviso indica cuáles faltan. Con datos completos se puede abrir directamente la vista previa.

Se mantienen cliente, contacto, pago, banco, cuotas, fecha real de venta, cortesías y plazo editable de tres meses por defecto. El IMEI/serial sigue siendo manual y opcional. La extracción no copia costos, claves o notas internas en los campos de garantía. No cambia el esquema ni requiere nuevas reglas de Firestore.

## Validación

- 87 pruebas JavaScript aprobadas, incluyendo extracción, datos ambiguos y conservación de correcciones, pago y cortesías.
- Prueba nueva `tests/warranty-autofill-ui.cjs`: proveedor → borrador → venta → garantía, sin reescribir datos completos; pago y fecha conservados, edición, datos históricos congelados, recuperación de descripción antigua y validación de datos desconocidos sin escrituras.
- Recorridos de garantía, plazo, cortesías, apariencia/validación, equipos preparados, integridad del comprobante y edición de ventas aprobados.
- 78 pruebas Android aprobadas; compilación y lint de release correctos.
- APK firmado con la identidad instalada, versión/código y archivos finales incluidos verificados; copia privada de proveedores excluida.

Las pruebas de interfaz se hicieron en navegador. No se conectó un teléfono Android físico para esta revisión. La app conserva los contratos existentes de guardado y PDF nativo.
