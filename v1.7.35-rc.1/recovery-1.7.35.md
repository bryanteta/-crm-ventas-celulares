# Recuperación de Ventas · 1.7.35-rc.1

Candidata Android código 71, firmada con la identidad instalada. La estable sigue en 1.7.34 (70). Reservar 72 para 1.7.35 estable. No fusionar ni activar una actualización general antes de revisar la prueba física.

## Uso

Si el almacenamiento está bloqueado, Ventas muestra Recuperar ventas. Reintentar apertura sirve para fallos temporales. Exportar datos conserva lo legible, el diario, el formato anterior y las copias internas. El archivo contiene datos de clientes: usar una ubicación privada en el selector del sistema. También se puede exportar o importar desde Ajustes → Aplicación → Tus datos.

Con cuenta, Consultar copia de la nube hace lecturas explícitas del servidor de ventas, inventario, correlativos y registros de idempotencia. La vista previa no escribe en Firebase ni reenvía solicitudes. Se conservan borradores legibles; Firebase no puede devolver datos locales que nunca se sincronizaron. Solicitudes ya aplicadas se descartan de la cola; si quedan dos distintas, se elige explícitamente cuál conservar y las demás quedan archivadas. Antes de confirmar se consulta de nuevo y se exige otra vista previa si la nube cambió.

Restaurar requiere confirmación. Una transacción estricta guarda las copias anteriores y los datos nuevos, comprueba las filas dentro de la misma transacción y solo después habilita Ventas. El fallo de copia o verificación aborta toda la transacción. Los correlativos conservan el máximo de todas las fuentes legibles. La limpieza de localStorage es posterior; las huellas de fuentes archivadas impiden reproducirlas si esa limpieza falla.

En modo local, sin un correlativo conocido del mes, se exige escribir la última secuencia emitida (0 si no hubo garantías). Empezar historial local nuevo se ofrece por separado, exige exportación previa y dos confirmaciones, y conserva los pisos conocidos. No se ofrece ante errores temporales. Si todo el almacenamiento y los respaldos desaparecieron, no se puede deducir el último número.

Importar exige formato lunivo-sales-backup versión 1, la misma cuenta e importes/ids válidos. Muestra nuevos, idénticos y diferencias antes de escribir. Lo nuevo se agrega; una revisión confirmada actual no se pisa; una fecha posterior comparable puede ganar en registros locales. Diferencias ambiguas conservan la versión actual y quedan archivadas con el archivo importado. Los correlativos suben al máximo. La migración a Firebase queda pausada: Sincronizar respaldo requiere una acción y confirmación independientes.

## Límites y comprobación

El puente transfiere partes base64 ordenadas, con límite total 128 MB y SHA-256; el selector del sistema se usa para exportar/importar. No se envía un archivo de varios MB dentro de un solo mensaje. Una cancelación no se anuncia como exportación guardada. El límite y el espacio disponible pueden impedir preparar un respaldo; no se descartan copias para continuar.

Las lecturas de recuperación se hacen al servidor; Firestore Android no ofrece una consulta transaccional conjunta de estas tres colecciones. La segunda lectura antes de confirmar detecta cambios observados, pero no bloquea operaciones de otros teléfonos. Los listeners y las revisiones del servidor siguen siendo autoritativos al reconectar. Evitar ventas simultáneas durante la prueba inicial de recuperación. El trabajo no cambia reglas ni datos de producción, ni implementa SQLite/Room o listeners incrementales.

Pruebas: migración/escala/reversión, base borrada con app cerrada, bloqueo, cancelación, fallo atómico, diario dañado, cuota y reintento, correlativos máximos, dos pendientes y operación aplicada sin reenvío, cuenta cambiada, exportación/importación por partes y restauración repetida sin duplicados. Regresión de interfaz y dos clientes con Firestore emulado. Pruebas nativas del selector, cancelación, orden de partes y reconstrucción de archivos grandes. La prueba instrumentada del selector se compila pero requiere Android real.
