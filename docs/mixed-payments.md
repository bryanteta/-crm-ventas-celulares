# Abono y saldo a tasa cero

En Ventas, selecciona «Tasa cero». El campo «Abono recibido $» es opcional: indica el efectivo o transferencia ya recibido y elige el método del abono. El banco y las cuotas corresponden al saldo. Deja 0 para financiar toda la venta. Si se paga todo al contado, usa Efectivo o Transferencia.

El saldo se calcula sobre el total de la venta, incluidos accesorios cobrados y envío; las cortesías no se suman. El abono tampoco es un cargo adicional ni cambia ingresos, costos, utilidad, comisión o inventario. Debe ser menor que el total para que quede un saldo financiado.

El desglose se conserva al guardar borradores, confirmar, recargar y editar. Aparece en el detalle de venta y en la garantía: abono recibido, método del abono, saldo a tasa cero, banco y cuotas. Se conserva la garantía de una página A4, las cortesías con su valor y las condiciones justificadas.

Los campos opcionales del recibo son `paymentAdvance` (centavos enteros) y `advanceMethod` (Efectivo o Transferencia). Los recibos anteriores, sin estos campos, mantienen su comportamiento. Desde 1.7.25, el campo de cabecera muestra únicamente «Pago dividido». Junto al total se detallan «$250.00 en efectivo» o «$250.00 por transferencia», el saldo a tasa cero, banco y cuotas, sin «Abono recibido» ni paréntesis. El documento PDF admite un `paymentSummary` opcional para la etiqueta de cabecera.

## Activar la sincronización

La versión 1.7.24 requiere publicar `firestore.rules` actualizado para editar abonos en ventas sincronizadas. Publicar el APK no despliega reglas de Firebase.

1. Abre Firebase Console → tu proyecto de Lunivo → Firestore Database → Reglas.
2. Copia el contenido completo de https://raw.githubusercontent.com/bryanteta/-crm-ventas-celulares/main/firestore.rules y sustituye el editor de reglas.
3. Pulsa Publicar. Después actualiza la app desde Ajustes → Aplicación → Actualizaciones.

Las reglas mantienen el acceso por cuenta, la validación de operaciones y la integridad financiera. Las actualizaciones exclusivas del comprobante no reevalúan importes que no cambian, para respetar el límite de expresiones de Firestore.

Validación: pruebas de cálculo y documentos, flujo real de formulario y PDF web, motor Java, transacciones con emulador de Firestore (confirmar, editar abono/precio y emitir garantía; rechazo atómico de abonos inválidos), regresiones de edición y acciones de garantía.
