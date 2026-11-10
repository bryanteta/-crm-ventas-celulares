# Lunivo 1.7.14 — Accesorios de cortesía personalizados

Android 1.7.14, código 49. El editor de garantía ofrece cargador completo, protector de pantalla, case y caja genérica, con selección múltiple, valores de referencia y «Otro accesorio» para agregar o quitar cortesías con nombre propio. Se utiliza el mismo estilo de selección que en los accesorios de venta. Los campos de referencia aparecen solo al seleccionar el artículo.

Se mantienen el esquema `{name, reference}` de las garantías, el límite de diez cortesías y las reglas actuales de Firebase. Las cortesías guardadas con nombres ajenos al catálogo se cargan en filas editables en lugar de descartarlas. Los artículos ya incluidos en los accesorios de venta no se duplican como cortesías del catálogo. Los importes de referencia no cambian precio, ingresos, costos, utilidad, existencias ni contadores.

El documento admite hasta 41 líneas: dispositivo, 30 accesorios de venta y 10 cortesías. El nombre del PDF por cliente/dispositivo y la garantía sin correlativo de 1.7.13 se conservan.

## Verificación

- `npm test`: 82 pruebas aprobadas. Cobertura de nombres personalizados, escape HTML, valores, límite, caja sin duplicar y finanzas sin cambios.
- `testReleaseUnitTest`: 76 pruebas nativas aprobadas. Se guardan diez cortesías personalizadas sin alterar importes; una undécima se rechaza atómicamente. El contrato PDF admite 41 líneas y rechaza 42.
- `tests/warranty-gifts-ui.cjs`: selección múltiple y personalizada, datos anteriores, validación con foco, quitar errores, recarga, cancelar sin borrar, límite, exportación y cuatro tamaños en ambos temas.
- `tests/warranty-ui.cjs`, `tests/accessories-ui.cjs` y `tests/receipt-actions-ui.cjs`: recorridos de garantía, accesorios cobrados y permisos de impresión intactos.
- PDF de ejemplo guardado mediante la salida HTML y revisado con `pdftotext`: diez cortesías completas, nombres personalizados, total $500.00 sin aumentar y sin correlativo.
- `assembleRelease lintRelease -PpublicRelease`: compilación correcta; firmado con el certificado instalado. El editor nuevo está incluido en el APK y la copia privada de proveedores está excluida.

No hubo teléfono/emulador conectado. Sigue pendiente comprobar el renderizado PDF nativo en un dispositivo físico; se verificaron su contrato, compilación, empaquetado y el PDF HTML equivalente. Actualizar los teléfonos vinculados a 1.7.14 antes de editar las nuevas cortesías: los editores antiguos no conservaban los nombres fuera del catálogo aunque pudieran mostrarlos en el comprobante.
