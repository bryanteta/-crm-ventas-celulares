# Lunivo 1.7.15 — Plazo de garantía editable

Android 1.7.15, código 50. Se puede editar el plazo de garantía en meses, entre 1 y 36, con 3 por defecto. El periodo aparece en negrita y se recalculan el vencimiento desde la fecha de venta y el texto de las condiciones. Se conservan datos, cortesías, importes, identificadores y contadores. Editar una venta no restablece un plazo de garantía ya guardado.

El cálculo usa meses calendario, ajustando el día al último válido del mes y respetando años bisiestos. El PDF nativo recibe `warrantyMonths`, valida su rango y muestra el plazo en negrita; las solicitudes antiguas sin ese campo mantienen tres meses.

## Verificación

- `npm test`: 84 pruebas aprobadas, incluidos meses variables, fechas límite, negrita, condiciones coherentes, valores inválidos y preservación de datos.
- `testReleaseUnitTest`: 78 pruebas nativas aprobadas. Plazo guardado, conservación tras editar venta y rechazo atómico fuera de rango; contrato PDF compatible con tres meses anteriores.
- `npm run test:rules`: 8 pruebas aprobadas y compilación del archivo completo de reglas con Firestore Emulator.
- `tests/shared-business-ui.cjs`: motor Java real, transacciones y reglas con dos clientes. Garantía de seis meses recibida por el otro cliente sin modificar ingresos; permisos, stock, autores y concurrencia conservados.
- `tests/warranty-duration-ui.cjs`: tres por defecto, rango, foco, vencimiento/condiciones, negrita, recarga/cancelación, PDF y cuatro anchos en ambos temas.
- `tests/warranty-ui.cjs` y `tests/warranty-gifts-ui.cjs`: recorridos de garantía y cortesías intactos.
- PDF HTML guardado y revisado con `pdftotext`: un mes, vencimiento correcto de enero a febrero y ausencia del texto anterior de tres meses.
- `assembleRelease lintRelease -PpublicRelease`: compilación correcta, firma instalada conservada, editor incluido y copia privada de proveedores excluida.

No hubo teléfono/emulador Android conectado: queda pendiente probar el PDF nativo físicamente. Las pruebas con dos clientes corresponden al emulador de Firestore y al protocolo/motor Java, no a dos teléfonos físicos.

## Requisito de producción

Se necesita publicar `firestore.rules` en Firebase. La condición anterior exigía tres meses. Las reglas nuevas aceptan enteros de 1 a 36, con el resto de permisos sin cambios. No se dispone de credencial administrativa de Firebase en la sesión, por lo que no se desplegaron. La versión queda preparada en borrador para publicar la actualización general cuando el propietario complete ese paso. Ver `docs/firestore-warranty-duration.md`. Actualizar los dispositivos vinculados antes de usar plazos distintos de tres meses.
