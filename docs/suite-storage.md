# Almacenamiento local de Ventas (IndexedDB)

## Problema

Hasta la 1.7.33 la suite guardaba ventas, ofertas, inventario, contadores y metadatos de la nube en
un único valor de `localStorage` (`lunivo-suite-preview-v1:<cuenta>`). Cada lectura hacía `getItem` +
`JSON.parse` del blob completo y cada guardado lo reescribía entero. Con ventas realistas (~2,4 KB
con accesorios y garantía), Chromium/WebView lanzaba `QuotaExceededError` a partir de ~2.100 ventas
(~5 M caracteres, límite compartido con seguimientos, perfiles y precios web). En modo cuenta el
límite llegaba antes, porque cada teléfono copia las ventas de todos.

## Diseño

`suite-store.js` guarda la suite en IndexedDB (base `lunivo-suite`, cientos de MB en WebView):

| Almacén   | Clave                    | Contenido                                                       |
|-----------|--------------------------|-----------------------------------------------------------------|
| `sales`   | `[clave de cuenta, id]`  | JSON de una venta                                               |
| `state`   | clave de cuenta          | resto de campos (ofertas, inventario, contadores, `cloud`, …), orden de las ventas y `jid` de la última transacción |
| `backups` | `[clave de cuenta, fecha]` | copia previa si una importación del formato anterior reemplazó datos distintos |

- **Lectura**: al abrir la cuenta se carga todo en memoria una vez. `read()` en `suite.js` devuelve un
  clon de esa copia y valida igual que antes (solo cuando la versión cambia).
- **Escritura atómica**: cada `commit()` calcula qué filas cambiaron respecto de la última copia
  guardada y escribe esas filas más la fila `state` en **una** transacción. Ventas, inventario y
  `cloud.pending` se guardan juntos o no se guardan.
- **Sin esperar**: la memoria se actualiza al instante y la transacción se crea en la misma tarea,
  así la interfaz se comporta como antes (síncrona).
- **Diario**: Chromium aborta transacciones sin terminar al recargar o cerrar. Por eso cada commit
  deja en `localStorage` (`lunivo-suite-journal-v1:<cuenta>`) solo las filas que escribe; se borra al
  completar la transacción y, si quedó pendiente, se reaplica al abrir. Es pequeño (ventas
  modificadas + resto + orden) y, si no cabe, la transacción sigue siendo la fuente principal.
- **Fallos**: si una transacción falla después de empezar, se restaura la última copia guardada y se
  avisa ("No se pudieron guardar los datos…"). Si falla al empezar, `commit()` lanza el error como
  antes y nada cambia.
- **Varias pestañas**: tras guardar se avisa por `BroadcastChannel` y las demás pestañas recargan.
- **Sin IndexedDB** (almacenamiento bloqueado): se mantiene el comportamiento anterior con
  `localStorage`.

## Migración

Al abrir una cuenta, si existe el blob anterior en `localStorage`:

1. Se copia completo a IndexedDB (si había datos distintos, la versión previa va a `backups`).
2. Se vuelve a leer y se compara fila por fila con el blob.
3. Solo si coincide se elimina el blob, liberando su espacio.

Si el blob no se puede leer, no se toca y la suite muestra el mismo error de siempre. Si una versión
anterior (o una pestaña antigua) vuelve a escribir el formato anterior, se adopta como la copia más
reciente con el mismo procedimiento, **combinándola** con lo ya migrado: esa versión anterior no veía
las ventas de IndexedDB, así que reemplazar perdería las que no conocía. Las ventas e inventario se
unen por `id` (gana la copia del formato anterior, escrita más tarde) y `receiptCounters` conserva el
mayor número de cada mes, para no repetir correlativos. Así, publicar por error una versión anterior
y volver a actualizar no borra ventas (`tests/storage-rollback-ui.cjs`). La validación de registros sigue en `read()`, sin cambios.

## Ajustes

*Ajustes → App → Tus datos* muestra el espacio de `localStorage` (seguimientos, perfiles, ajustes),
lo que usa la base del teléfono y cuántas ventas hay guardadas. Al pasar el 70 % aparece un aviso en
la sección y una notificación una vez por sesión.

## Pruebas

- `tests/storage-scale-ui.cjs` (incluida en `node scripts/test-ui.cjs`): migra 1.800 ventas sin
  pérdida (idéntico byte a byte), crece a 5.000, registra una venta desde el formulario, recarga al
  instante, revierte un fallo de transacción y comprueba el aviso del 70 %.
- Las pruebas de interfaz leen los datos con `LunivoSuiteStore.peek(clave)` y simulan "almacenamiento
  lleno" sustituyendo `IDBObjectStore.prototype.put`. `tests/profile-fixture.cjs` espera a que la
  suite abra sus datos tras cada `goto`/`reload`.

Medido en Chromium con 5.000 ventas (~11,8 M caracteres): clonar en lectura ~24 ms, guardar
(diferencia + transacción) ~48 ms; un render completo del historial ~60 ms.

## Pendiente: lecturas de Firestore

`BusinessCloudManager.account()` abre un listener sin límite sobre `suiteSales` y `suiteInventory`.
Firestore cobra de nuevo cada documento del resultado cuando el listener se reanuda tras más de
~30 minutos (cada apertura en frío). Ejemplo: 5.000 ventas × 3 teléfonos × 4 aperturas al día =
60.000 lecturas, por encima de la cuota gratuita de 50.000/día.

Diseño propuesto (no incluido en este cambio porque requiere el SDK de Android y el emulador de
Firestore para validarlo):

1. Los documentos nunca se borran (ocultar es un campo) y todos llevan `updatedAt` de servidor, así
   que el listener puede ser incremental: `whereGreaterThan("updatedAt", marca)`, con la marca por
   cuenta guardada en `SharedPreferences` (menos un margen de unos minutos).
2. Para los snapshots incrementales, enviar `reset:false` a `suite-sync.js` (`merge` ya fusiona por id).
3. Reconciliación completa ocasional (p. ej. una vez al día o al vincular un teléfono nuevo) para
   cubrir relojes o marcas perdidas.
4. Añadir el índice de `updatedAt` si Firestore lo pide y una prueba en `tests/shared-business-ui.cjs`.

## Revisión del candidato 1.7.34-rc.1

Este cambio se prepara como candidato, no como actualización estable. Android usa código 69 y nombre `1.7.34-rc.1`; reservar código 70 o superior para la siguiente estable permite actualizar también los teléfonos que probaron el candidato. La versión estable sigue siendo 1.7.33.

Se reforzaron estos casos después de revisar la rama:

- La confirmación de una venta y las demás operaciones de negocio esperan a que termine la transacción local. Se solicita `durability: strict` cuando el WebView lo admite; los motores anteriores conservan su transacción normal. La solicitud pendiente de nube se guarda antes de enviarla; el acuse también se guarda antes de mostrar el resultado. Si cambia la cuenta mientras se guarda, no se envía la solicitud en otra cuenta.
- Al reaparecer el formato anterior, las revisiones ya confirmadas por la nube conservan su copia actual. Las ventas locales con fechas de edición, anulación, visibilidad o garantía más recientes no se reemplazan por una copia anterior. Si no hay fechas comparables se mantiene la política anterior: la copia reaparecida gana por id, pero queda una copia de recuperación en IndexedDB. No se puede deducir cuál edición es más nueva solo del id.
- Se conserva la operación pendiente y el estado de sincronización actuales. Los registros antiguos sin revisión de nube se añaden a la migración pendiente. Dos operaciones pendientes distintas no se sobrescriben: se bloquea la recuperación conservando ambos orígenes para revisión.
- Cada diario nuevo identifica sus posibles copias base. Un diario de otra copia o más antiguo se archiva para revisión y no pisa una transacción confirmada más nueva. Un diario ilegible o sin copia base no se borra silenciosamente.
- Un marcador pequeño permite detectar que faltó una base anteriormente confirmada o que no pudo abrirse. En ese caso no se crea un historial vacío ni se reinicia el correlativo automáticamente. Si se borran todos los datos de la app, también se borra el marcador; ninguna base local puede proteger por sí sola frente a esa acción.

### Viabilidad y límites

IndexedDB es una API válida en Chromium/WebView y elimina el límite pequeño del blob de localStorage. No ofrece almacenamiento infinito: depende del espacio del teléfono y de la cuota concedida al origen. `navigator.storage.persist()` se solicita, pero el WebView puede no concederlo. localStorage tampoco sustituye un respaldo y también desaparece al borrar los datos de la app.

Para un producto exclusivamente Android, SQLite/Room permite controlar mejor la persistencia en el almacenamiento privado nativo. Este candidato **todavía usa IndexedDB**, no SQLite/Room. La decisión de pasar a SQLite debe conservar las mismas garantías transaccionales, migración verificable y respaldo fuera del dispositivo. No se debe prometer que nunca se perderán datos solo por cambiar la API de almacenamiento.

La unión por id es apropiada para no omitir registros, pero no resuelve por sí sola conflictos, anulaciones, inventario ni operaciones pendientes. Las revisiones de servidor, las fechas comparables y los máximos por mes son necesarios; los casos ambiguos requieren conservar ambas copias y revisarlos. El aviso entre pestañas recarga datos, pero no convierte el modo local en un sistema de edición simultánea: las operaciones compartidas siguen usando las transacciones idempotentes de Firestore.

El Worker es una fuente única razonable para los precios; la clave administrativa es de alto privilegio y solo debe guardarse en los teléfonos autorizados. Permisos por usuario o claves revocables por dispositivo serían una evolución posterior. La mejora de lecturas de Firestore, el alias «16 e» con espacio y las fechas locales de la lista se mantienen fuera de este candidato.

### Evidencia y comprobación física pendiente

Se ejecutan escala (1.800 → 5.001 ventas), reversión, pérdida simulada de base, diario antiguo, diario lleno y transacción fallida, colas de nube y fechas, actualización de assets antiguos, dos clientes con Firestore real emulado y las pruebas nativas Android. `StorageMigrationInstrumentedTest` está compilada para ejecutar migración y 5.000 registros en un WebView real con una clave de prueba aislada. No se ha ejecutado aquí: no hay teléfono conectado ni aceleración KVM para el emulador.

No se ha comprobado la expulsión real por almacenamiento casi lleno, el apagado físico durante un guardado ni la instalación sobre un teléfono con ventas reales. La prueba física es la condición pendiente antes de fusionar y publicar una versión estable. El APK candidato no debe convertirse en el último release estable automáticamente.
