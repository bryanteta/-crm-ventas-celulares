# Lunivo Suite 1.6.0 · revisión local

Entrega Android privada, paquete `com.crmcelulares.app`, código 29. Preparada localmente; no se ha publicado el APK, desplegado Firebase ni enviado cambios al remoto.

## Cambios

- Filtros rápidos **Todos / iPhone / Samsung** en Inventario y Mis equipos. Se aplican en Global, por proveedor y por dueño, conservan el ámbito al cambiar de filtro y no modifican equipos. iPad y Xiaomi quedan fuera de esos dos filtros.
- Modo oscuro corregido en listas pobladas, accesorios, Cancelar edición, Eliminar, indicadores de agotados y avisos nativos. Se revisan fondos, controles y desbordamientos a seis anchos. El comprobante conserva papel blanco para impresión.
- Ventas confirmadas, garantías y Mis equipos compartidos mediante la cuenta Firebase. Los borradores, cotizaciones, cachés de proveedores y claves de Split permanecen en el teléfono. El modo sin cuenta conserva sus datos separados.
- Confirmar exige conexión y un perfil activo sincronizado. Una transacción guarda venta, descuento de equipo propio, correlativo mensual y registro de operación. La venta queda atribuida al usuario que confirma; si el borrador tenía otro autor, se conserva esa referencia adicional. Los perfiles comparten credenciales y no constituyen firmas criptográficas ni permisos independientes.
- Las garantías conservan al vendedor original y registran quién las actualizó. Una edición basada en datos antiguos se rechaza; el botón para descartar los cambios del formulario y cargar la actualización permite continuar sin reiniciar la app.
- Reintentos con el mismo identificador recuperan una confirmación sin duplicar venta, correlativo ni movimiento de existencias. Anular repone una sola vez. Las solicitudes pendientes sobreviven al cierre y se recuperan al volver la conexión.
- Los datos anteriores de la cuenta se incorporan sin sobrescribir IDs existentes ni volver a descontar existencias. Se conservan importes, vendedores y comprobantes históricos. No se renumeran comprobantes emitidos en versiones antiguas, aunque distintos teléfonos ya hubieran usado un número igual.

## Activación pendiente de hacer por el administrador

Pausa el registro de ventas durante la actualización y la incorporación de los datos de todos los teléfonos. Las versiones anteriores siguen registrando ventas locales y no participan de la reserva compartida.

1. Publicar el archivo **completo** `firestore.rules` en el proyecto Firebase existente. Las colecciones nuevas son `users/{uid}/suiteSales`, `suiteInventory`, `suiteCounters` y `suiteOperations`; se conservan las reglas de Follows y perfiles.
2. Actualizar todos los teléfonos a 1.6.0 instalando sobre la app existente, sin desinstalar ni borrar sus datos.
3. Abrir la misma cuenta con conexión en todos los teléfonos que tengan registros anteriores. Esperar a que termine «Preparando Ventas compartidas» en cada uno antes de confirmar ventas nuevas. Esto permite reservar el máximo correlativo anterior y reunir los registros locales de esa cuenta.
4. Revisar en dos dispositivos una venta y su garantía, el vendedor, el descuento de un equipo propio y una anulación antes de distribuir ampliamente.

Sin las nuevas reglas no se anuncia una venta local como confirmada en la nube: se muestra el problema y se conserva el borrador o la solicitud pendiente. Los equipos de proveedores externos son referencia de consulta; Lunivo no los reserva ni descuenta en la plataforma del proveedor.

## Pruebas automatizadas

- **50 pruebas Node:** almacenamiento, aislamiento, importes exactos, accesorios, comprobantes, proveedores y detección de iPhone/Samsung.
- **23 suites de interfaz:** recorridos de Follows, Ventas, inventarios, perfiles, ajustes, ayudas, temas, notificaciones, garantías, exportación y fallos de almacenamiento. Incluyen pantallas estrechas, desplegadas y horizontales.
- **51 pruebas unitarias Android release:** nueve cubren el nuevo motor de negocio, incluidas autoría, stock, anulación, importación histórica, reintentos y versiones obsoletas.
- **8 pruebas de reglas Firestore** y la suite anterior de sincronización de Follows contra el emulador oficial: cuentas, perfiles, autoría, edición offline, importación explícita y eliminaciones. Se conserva la coalescencia medida: 20 ediciones rápidas generan una escritura; cambios offline de registros y perfiles generan dos al reconectar.
- **Integración de ventas compartidas:** el motor Java de producción se ejecuta dentro de transacciones reales del emulador, bajo las reglas de esta entrega. Se comprueba la carrera de dos ventas por la última unidad, correlativos concurrentes distintos, recuperación idempotente y devolución única. Prueba migración sin sobrescribir autores ni descontar stock otra vez, reserva de números históricos y aislamiento entre cuentas. Dos clientes de interfaz comprueban venta, garantía, autor original/editor distinto, rechazo y recuperación de edición obsoleta, borrador offline, cierre con acuse perdido y alta de equipo compartido.
- `testReleaseUnitTest`, `assembleRelease`, `assembleReleaseAndroidTest` y `lintRelease` aprobados. Lint conserva seis avisos de dependencias disponibles y ningún error.
- APK cotejado con los 21 recursos web de origen, copia privada de proveedores, versión, configuración Firebase y firma de actualización. La copia de proveedores conserva su fecha anterior; no representa una descarga nueva.

Las pruebas cloud usan exclusivamente `demo-lunivo` en el emulador local. Los rechazos de reglas incluidos en los logs son pruebas negativas intencionales. Los conflictos de correlativo pueden causar rechazo de una escritura obsoleta antes de que Firestore reporte conflicto; el cliente vuelve a leer y reintenta la misma operación, de forma acotada, sin cambiar su identificador.

## Límite de validación física

Las pruebas de navegador simulan el protocolo del puente; el motor financiero probado es el mismo Java de producción. Las unitarias nativas usan Robolectric. Las instrumentadas se compilan, pero **no se ejecutaron**: el emulador Android del entorno no ofrece servicios de actividad/ventana/paquetes utilizables. Queda pendiente la prueba final en un Note 20 Ultra, Z Fold u otro Android funcional, incluyendo barras del sistema, notificación real y exportación PDF.

La firma conserva la identidad de las entregas privadas anteriores y la depuración está desactivada. No es una publicación en Google Play. Los listeners cargan ventas e inventario de la cuenta y después reciben cambios; el consumo Firebase crece con el historial y los teléfonos conectados. No se afirma capacidad ilimitada.

APK SHA-256: `c754900b95b2a6117cdad18922f76c7048b10d35c8350f3d5744a08cc798cef7`.
