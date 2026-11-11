# Lunivo 1.7.17 — Accesorios cobrados y cortesías

Android 1.7.17, código 52. La nueva venta tiene dos apartados independientes: Accesorios cobrados, con importe que suma al total, y Cortesías, gratis para el cliente. La selección de cortesías está disponible al registrar la venta y se conserva en borradores y garantías. Los importes nuevos de accesorios cobrados deben ser mayores a cero; los registros anteriores a cero se conservan sin modificar sus importes.

La garantía muestra por separado la lista de accesorios ya cobrados y el editor de cortesías. Los productos del catálogo incluidos en la venta se deshabilitan como cortesía; los nombres personalizados coincidentes se rechazan con un error y foco en el campo. Los valores referenciales se conservan en los datos, bajo un desplegable opcional de referencia interna, y no cambian ingresos ni utilidad.

HTML y PDF nativo separan el resumen cobrado (con el total del cliente) de la tabla de cortesías. Las cortesías siempre muestran precio al cliente $0.00, incluso cuando tienen un valor referencial interno o provienen de una línea histórica sin cargo. Se evitan líneas duplicadas por catálogo o nombre normalizado. No se modifica el esquema ni se requieren nuevas reglas de Firebase.

## Validación

- 88 pruebas JavaScript aprobadas, incluyendo separación en los datos del PDF y HTML, referencias fuera de los importes cobrados y conservación del registro original.
- `accessory-separation-ui`: cobro cero rechazado en nuevas líneas, protección contra duplicados de catálogo y personalizados, borrador/recarga, pago y cortesías conservados, edición de venta sin alterar regalos ni correlativos, dos temas y lectura de líneas históricas a cero.
- Recorridos de accesorios, cortesías, autocompletado, plazo de garantía, comprobantes, edición de ventas, integridad, margen por defecto y apariencia/validación aprobados.
- PDF HTML guardado y revisado con `pdftotext`: tabla cobrada y tabla de cortesías aparte; referencias de $1,000 no aparecen como cobro; cortesías a $0.00.
- 78 pruebas Android aprobadas; compilación y lint release correctos. La generación PDF nativa usa secciones independientes y fuerza $0.00 en las cortesías.

No se conectó un Android físico para esta revisión. Las pruebas visuales se realizaron en navegador; el PDF nativo se compiló y conserva el contrato existente.
