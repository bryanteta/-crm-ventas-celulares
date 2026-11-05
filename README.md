# Lunivo Suite

App Android y prototipo web para gestionar seguimientos, inventarios, ventas y garantías. Versión **1.5.9**; Android 8.0 o superior.

## Funciones

- **Ajustes:** Cuenta, Inventarios, Avisos y Aplicación. Los botones «?» explican las opciones sin ejecutarlas. En Aplicación puedes elegir Claro, Oscuro o seguir el teléfono; la selección y el logo se adaptan a ambos espacios. El cambio entre Follows y Ventas muestra el espacio activo y recupera la última pantalla de cada módulo, con los formularios sin guardar.
- **Follows:** clientes, agenda, usuarios que registran cada seguimiento, avisos nativos y sincronización opcional con Firebase.
- **Inventario:** una sola entrada para Samuel y Split (Saúl y Javier). Elige proveedor, busca un equipo y consulta precio por unidad, quién lo tiene y cuántos hay disponibles. Modelo, orden y demás filtros quedan en Más opciones. Las tarjetas abren detalles y permiten preparar la venta.
- **Mis equipos:** acceso visible en Inicio de Ventas e Inventario para consultar o agregar equipos. La categoría Lunivo corresponde al inventario propio y no entra en la comparación de proveedores. Se conservan los registros manuales anteriores de Samuel, Saúl y Javier. Mantiene alta, reposición, organización, descuento al vender y devolución al anular, sin reasignar registros existentes.
- **Inventarios conectados:** Samuel se lee desde su hoja pública de Google; Split desde su API de revendedores, separando Saúl y Javier. El APK privado incluye una copia verificada para mostrar equipos desde la primera apertura. Actualizar consulta las fuentes; conserva la última lista válida si no hay conexión o falla el guardado. Para actualizar Split, la clave se guarda una vez por cuenta/teléfono en Ajustes, cifrada mediante Android Keystore. Nunca se incluye en Git ni en el APK.
- **Tarjetas compactas:** modelo, detalles y dueño visibles; costo/precio y disponibilidad a la derecha. Toca el equipo para vender, agregar unidades u organizar. Los filtros de marca/orden se despliegan cuando los necesitas.
- **Ventas:** selección de equipo propio, oferta de proveedor o entrada manual; descuento de existencias junto con el guardado. Las ventas nuevas no descuentan comisiones. Los importes históricos se conservan.
- **Accesorios:** cargador completo, protector con tipo, case, caja genérica y varios accesorios adicionales, cada uno con su precio. Precio cero significa entrega sin costo. El comprobante incluye el detalle.
- **Garantías:** campos pendientes resaltados, mensajes junto a cada dato y salto al primer campo; abre la sección de pago si falta banco o meses. IMEI/serial manual y opcional, tres meses calendario desde la entrega y correlativo por mes/año. Exportación directa de PDF A4 vectorial y opción separada de impresión. Comprobantes claros para imprimir, incluso con la app en modo oscuro.

Ventas, garantías, inventario y cotizaciones permanecen **locales por cuenta y dispositivo**. Follows y los perfiles mantienen su sincronización existente. Los dueños del inventario son categorías de organización; no representan cuentas ni permisos individuales. Los inventarios externos se consultan mediante HTTPS y se conservan en el teléfono; no requieren lecturas de Firebase. No se importan PDFs nuevos automáticamente.

## Desarrollo web

Requiere Node.js 20 o superior, Python 3 y Chromium/Chrome.

```sh
npm ci
python3 -m http.server 8000
```

Abre `http://127.0.0.1:8000`. El almacenamiento del navegador es independiente del APK.

En otra terminal:

```sh
npm test
npm run test:ui
```

Las pruebas de interfaz usan Chromium en `/usr/bin/chromium`. Puedes definir `CHROMIUM_PATH` con la ruta de tu instalación. Las capturas y PDFs de prueba se escriben en `test-results/`; `LUNIVO_ARTIFACT_DIR` permite elegir otro directorio.

Para probar reglas y sincronización de Follows se necesita el emulador oficial de Firestore en `127.0.0.1:8787`, proyecto `demo-lunivo`. Ejecuta `npm run test:rules` y después `node tests/cloud-ui.cjs`, de forma secuencial: ambas suites usan y vacían el mismo emulador. No apuntes esas pruebas a producción.

## Android

Consulta [android/README.md](android/README.md) para compilar, configurar Firebase, conservar la firma de actualización y ejecutar las pruebas nativas. El APK se genera en `android/app/build/outputs/apk/release/app-release.apk`.

La configuración de Firebase y las claves de firma no se incluyen en Git. Instala las actualizaciones sobre el APK existente, sin desinstalar ni borrar sus datos.

La [revisión de entrega 1.5.9](docs/release-audit-1.5.9.md) detalla errores corregidos, pruebas y límites de validación. La entrega queda preparada localmente; no implica publicación ni despliegue de reglas.

## Inventarios de proveedores

El conector de Samuel verifica el formato real de la hoja, interpreta CSV y agrupa filas idénticas conservando sus cantidades y precios. Split usa `GET /api/v1/inventario` con `X-API-Key`; solo lee los equipos disponibles del API de revendedores. `SPLIT` se presenta como Saúl y `JAVIER` como Javier. No se escriben ventas ni reservas en sistemas de los proveedores.

Las descargas se validan completas antes de sustituir el inventario de ese proveedor en una escritura local. Una lista vacía válida retira los equipos que ya no están disponibles; un error HTTP, contenido inesperado, conteos incompletos o falta de espacio conserva la lista anterior. Se muestran fecha de consulta, unidades y estado. Los detalles de fuentes y conexión se consultan en Ajustes. La actualización automática al consultar se limita a una vez cada diez minutos por proveedor; los filtros no descargan. El botón Actualizar permite solicitar otra consulta.

El constructor puede generar una copia inicial privada con `python3 scripts/fetch-provider-snapshot.py`, usando `SPLIT_INVENTORY_TOKEN` configurado de forma segura en el entorno. Genera `android/provider-bootstrap.json`, ignorado por Git. Gradle lo empaqueta como datos de inventario; no contiene la clave ni datos de autenticación. Una compilación sin esa copia puede cargar los datos al actualizar y conserva cualquier descarga previa.

Pruebas del conector: `npm test`, `node tests/feeds-ui.cjs` y las pruebas nativas Android. Las dos instrumentadas `InventoryInstrumentedTest` verifican Keystore real y la carga de ambas listas mediante el puente en un WebView Android. Requieren generar la copia inicial e instalar el APK de prueba.
