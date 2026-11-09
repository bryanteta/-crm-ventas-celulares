# Lunivo 1.7.12 — Samuel por API

Versión Android 1.7.12 (código 47). Samuel/TecnoShop se actualiza desde su API JSON en lugar de la hoja CSV. Split conserva su API y su configuración por cuenta. No requiere cambiar reglas de Firebase ni desinstalar la aplicación.

La ruta `getCatalogo` consultada es pública de lectura y no requiere clave. La clave proporcionada sin documentación no se incorpora al APK. Las redirecciones de Samuel se limitan a HTTPS en script.google.com y script.googleusercontent.com; la clave de Split nunca se envía a Samuel ni se reenvía mediante redirecciones.

Se usa el mismo adaptador `samuelApi` que el actualizador web. Solo se aceptan las unidades disponibles en `filas`; los próximos ingresos no se muestran como existencias. Las variantes equivalentes mantienen sus identificadores anteriores y los inventarios descargados siguen siendo válidos. Ante HTML, datos incompletos, falta de conexión o error al guardar se conserva la última lista válida. No hay retorno automático al Excel.

## Verificación

- `npm test`: 77 pruebas aprobadas (datos, ventas, garantías, proveedores y catálogo).
- `testReleaseUnitTest`: 73 pruebas nativas aprobadas, incluidas 8 de HTTP de inventario: redirecciones, aislamiento de credenciales, UTF-8, límites de respuesta y conexiones cerradas.
- `tests/feeds-ui.cjs`: actualización por puente con JSON, exclusión de próximos ingresos, conservación ante errores, persistencia, almacenamiento lleno y aislamiento entre cuentas.
- `tests/provider-inventory-ui.cjs`: proveedores/dueños, filtros, enlaces a fuentes y organización en seis anchos.
- `tests/prepared-devices-ui.cjs` y `tests/prepared-picker-ui.cjs`: precios preparados, selección de variantes, existencias y venta precargada, en cuatro tamaños.
- Consulta real con la clase Java `InventoryHttp`: 226 unidades disponibles en 66 variantes; 86 próximos ingresos excluidos. Los totales corresponden al momento de la prueba.
- `assembleRelease lintRelease -PpublicRelease`: compilación correcta. APK sin copia privada de inventarios, configuración privada de Firebase ni keystore. Manifiesto creado con `scripts/prepare-update.py`, que comprueba paquete, versión, hash y el certificado instalado.

No hubo teléfono ni emulador conectado. Queda pendiente verificar físicamente la instalación sobre la versión anterior y la actualización de proveedores en los Samsung del cliente. No se publicaron reglas ni se modificaron registros de clientes.
