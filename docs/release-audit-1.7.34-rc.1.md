# Candidato Lunivo 1.7.34-rc.1

Base: `main` con el catálogo resistente a modelos nuevos; incorpora la rama de migración `1563bc2` y correcciones adicionales de recuperación. Android: código 69, paquete y firma originales. Reservar código 70 o superior para la siguiente estable. No se fusiona ni publica una actualización estable antes de la prueba física solicitada.

## Cambios

Ventas e inventario se migran del blob de localStorage a IndexedDB, con una fila por venta, transacciones de datos y solicitudes pendientes, verificación antes de retirar el formato anterior y diario de guardados interrumpidos. Se muestra el uso de espacio. El catálogo incluye las correcciones ya fusionadas para 16e, 17e, Air, XS Max, S25 Edge y omisión de modelos desconocidos sin congelar toda la publicación.

Se revisó la combinación por id para preservar revisiones confirmadas, fechas más recientes, máximos mensuales de correlativos y la operación de nube pendiente. Los registros antiguos aún sin revisión se incorporan a la migración de cuenta. Dos operaciones pendientes diferentes se conservan y bloquean la recuperación en vez de sobrescribir una. Los diarios viejos no pisan una copia confirmada más reciente. Un marcador evita empezar un historial vacío cuando falta una base anteriormente utilizada. La app espera la confirmación durable antes de anunciar una venta guardada o enviar una operación a Firestore.

## Validación

Pruebas unitarias JS; migración exacta de 1.800 ventas, crecimiento a 5.001, recarga, reversión de formatos antiguos, guardado fallido con diario lleno, pérdida simulada de la base, diario antiguo, preservación de cola y revisiones. Actualización de assets de APK 1.1.1/1.2.1 con datos y autores preservados. Transacciones reales con Firestore emulado y dos clientes: última unidad, correlativos, reintentos, garantía y edición compartida. Pruebas nativas Android y compilación del APK de instrumentación.

`StorageMigrationInstrumentedTest` prueba un WebView Android real, pero solo se compiló aquí. No hubo teléfono conectado ni KVM; no se afirma haber ejecutado la prueba física. No se verificó la expulsión real por poco espacio ni el apagado físico durante un guardado. Se mantienen pendientes para promoción estable, junto con la revisión de los casos de recuperación bloqueada y edición local simultánea en varias pestañas.

IndexedDB amplía la capacidad pero no hace infinito el espacio ni reemplaza un respaldo. SQLite/Room sigue siendo una alternativa recomendable para controlar la persistencia financiera nativa. No se implementa todavía el listener incremental de Firestore, ni se cambian reglas o datos de producción.

Ver [prueba del candidato](candidate-1.7.34-checklist.md) y [diseño y límites](suite-storage.md).
