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
