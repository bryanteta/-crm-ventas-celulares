# Lunivo 1.7.3 · fluidez y revisión de flujos

Código 38. La navegación de Ventas construía las tarjetas de proveedores, Mis equipos y selectores de venta en cada actualización, incluso cuando esas pantallas estaban ocultas. Follows construía listado, resumen y calendario a la vez, y el calendario formateaba cada fecha una vez por día del mes. Esto bloqueaba el hilo de la interfaz al pulsar botones.

Ahora se construye el contenido de la vista activa. Los selectores necesarios se preparan también al usar un equipo, una oferta o continuar un borrador para conservar esos flujos. Los selectores sin cambios conservan sus opciones y las nuevas opciones se insertan mediante fragmentos separados del documento. Los formateadores de moneda/fechas se reutilizan; el calendario agrupa los registros por día en una pasada.

Los inventarios, historial, listado de seguimientos y citas del día muestran bloques de 60 con Ver más. La búsqueda y los totales utilizan todos los datos. Cambiar de filtro reinicia el bloque; cambiar de cuenta usa un estado separado. Abrir una notificación revela y enfoca su seguimiento aunque esté fuera del primer bloque y conserva ese foco al completar la navegación.

Las búsquedas de listas grandes y los recálculos del formulario se agrupan por fotograma. Las listas pequeñas mantienen respuesta inmediata. Cada versión nueva del almacenamiento se valida completa; mientras no cambie, se evita repetir las mismas validaciones. Cada lectura sigue devolviendo una copia independiente, conservando el rollback si falla el guardado, la detección de datos dañados y el aislamiento de cuentas. Se muestran Guardando…/Confirmando… y bloqueo durante operaciones compartidas pendientes. El esquema y reglas de Firebase son los de 1.7.1.

## Medición reproducible

Prueba navigation-performance-ui.cjs, Chromium en el entorno de desarrollo, viewport 412×915, 2.000 ofertas, 1.000 equipos y 400 seguimientos. La actualización explícita de Nueva venta tardó 1.198 ms antes y 14–48 ms en ejecuciones después del cambio, con distinta carga concurrente de pruebas/compilación. Nodos presentes: 76.679 → 4.741. Tarjetas ocultas construidas: 2.000 proveedores + 1.000 equipos + 400 seguimientos → cero al abrir esa vista. Estas mediciones describen el caso reproducido; no son tiempos garantizados en un teléfono.

La prueba añade 2.000 ventas para verificar paginación, búsqueda hasta el último registro, continuación de borrador, validación de un importe alterado y reutilización de validaciones para almacenamiento idéntico. También abre un seguimiento que está fuera del primer bloque desde una notificación.

## Verificación y distribución

69 pruebas unitarias Android release, 56 Node, 29 suites de interfaz, 8 de reglas, sincronización de Follows y transacciones de negocio con dos sesiones en Firestore Emulator y el motor Java. Se verifican ventas/garantías, edición, borradores, proveedores y preparados, anulación/ocultación, stock/correlativos, errores de almacenamiento, aislamiento de cuentas, temas y tamaños de pantalla. Compilación pública release y lint (0 errores; 6 avisos de dependencias).

Instalación y medición física en Note 20 Ultra/Z Fold 7 pendientes. APK público con la firma existente y sin copia privada ni claves de proveedores, distribuido en lunivo-updates y el Release estable v1.7.3. Instalar sobre la app existente conserva sus datos y conexiones.
