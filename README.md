# Lunivo Suite

App Android y prototipo web para gestionar seguimientos, inventarios, ventas y garantías. Versión **1.6.3**; Android 8.0 o superior.

## Funciones

- **Ajustes:** Cuenta, Inventarios, Avisos y Aplicación. Los botones «?» explican las opciones sin ejecutarlas. En Aplicación puedes elegir Claro, Oscuro o seguir el teléfono; la selección y el logo se adaptan a ambos espacios. El cambio entre Follows y Ventas muestra el espacio activo y recupera la última pantalla de cada módulo, con los formularios sin guardar.
- **Follows:** clientes, agenda, usuarios que registran cada seguimiento, avisos nativos y sincronización opcional con Firebase.
- **Inventario:** una sola entrada para Samuel y Split (Saúl y Javier). Elige proveedor, busca un equipo y consulta precio por unidad, quién lo tiene y cuántos hay disponibles. Los filtros rápidos Todos, iPhone y Samsung funcionan en Global y por proveedor o dueño; modelo exacto y orden quedan en Más opciones. Las tarjetas abren detalles y permiten preparar la venta.
- **Mis equipos:** acceso visible en Inicio de Ventas e Inventario para consultar o agregar equipos. La categoría Lunivo corresponde al inventario propio y no entra en la comparación de proveedores. Se conservan los registros manuales anteriores de Samuel, Saúl y Javier. Mantiene alta, reposición, organización, descuento al vender y devolución al anular, sin reasignar registros existentes.
- **Inventarios conectados:** Samuel se lee desde su hoja pública de Google; Split desde su API de revendedores, separando Saúl y Javier. El APK privado incluye una copia verificada para mostrar equipos desde la primera apertura. Actualizar consulta las fuentes; conserva la última lista válida si no hay conexión o falla el guardado. Para actualizar Split, la clave se guarda una vez por cuenta/teléfono en Ajustes, cifrada mediante Android Keystore. Nunca se incluye en Git ni en el APK.
- **Tarjetas compactas:** modelo, detalles y dueño visibles; costo/precio y disponibilidad a la derecha. Toca el equipo para vender, agregar unidades u organizar. Los filtros de marca/orden se despliegan cuando los necesitas.
- **Ventas:** desde Ver venta → Editar venta puedes corregir cliente, fecha, cantidad, precio, accesorios, pago, gastos y notas. El autor original y correlativo se conservan, y queda registrado quién editó. La diferencia de unidades de Mis equipos se aplica en la misma transacción. Modelo y costo del equipo propio se conservan; para cambiar de equipo se anula y se registra otra venta. Selección de equipo propio, oferta de proveedor o entrada manual; descuento de existencias junto con el guardado. Las ventas nuevas no descuentan comisiones. Los importes históricos se conservan.
- **Accesorios:** cargador completo, protector con tipo, case, caja genérica y varios accesorios adicionales, cada uno con su precio. Precio cero significa entrega sin costo. El comprobante incluye el detalle.
- **Garantías:** desplegables editables para marca, capacidad, color, batería, estado físico y banco; también aceptan texto propio. El estado comercial conserva valores históricos. Impresión y exportación exigen una pulsación local en la garantía visible: al salir, editar, cambiar de cuenta o poner la app en segundo plano se descarta la impresión todavía en preparación. La sincronización recibe registros y nunca ejecuta impresiones. Los estados de una exportación no se muestran en otra garantía. Campos pendientes resaltados, mensajes junto a cada dato y salto al primer campo; abre la sección de pago si falta banco o meses. IMEI/serial manual y opcional, fecha tomada de la venta (también si se emite más tarde), tres meses calendario desde esa fecha y correlativo por mes/año. Exportación directa de PDF A4 vectorial y opción separada de impresión. Comprobantes claros para imprimir, incluso con la app en modo oscuro.

Con sesión iniciada en Android, **ventas confirmadas, garantías y Mis equipos se comparten por cuenta**. La confirmación exige conexión y un perfil activo; guarda al vendedor, descuenta existencias y asigna un correlativo común en una transacción. Los borradores, cotizaciones y cachés de proveedores siguen locales. El modo sin cuenta conserva el funcionamiento local. Follows y los perfiles mantienen su sincronización existente. Los dueños del inventario son categorías de organización; no representan cuentas ni permisos individuales. Los inventarios externos se consultan mediante HTTPS y se conservan en el teléfono; no requieren lecturas de Firebase. No se importan PDFs nuevos automáticamente.

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

Para probar reglas y sincronización de Follows se necesita el emulador oficial de Firestore en `127.0.0.1:8787`, proyecto `demo-lunivo`. Ejecuta `npm run test:rules` y después `node tests/cloud-ui.cjs`, de forma secuencial: todas las suites usan y vacían el mismo emulador. Para ventas compartidas ejecuta también `npm run test:business`; requiere JDK 17/21 y `LUNIVO_JSON_JAR` apuntando a un JAR de org.json (el JAR del emulador oficial sirve). Prueba el motor Java de producción con transacciones reales y dos clientes de interfaz. No apuntes esas pruebas a producción.

## Android

Consulta [android/README.md](android/README.md) para compilar, configurar Firebase, conservar la firma de actualización y ejecutar las pruebas nativas. El APK se genera en `android/app/build/outputs/apk/release/app-release.apk`.

La configuración de Firebase y las claves de firma no se incluyen en Git. Instala las actualizaciones sobre el APK existente, sin desinstalar ni borrar sus datos.

La [revisión de entrega 1.6.0](docs/release-audit-1.6.0.md) detalla errores corregidos, pruebas y límites de validación. La entrega queda preparada localmente; no implica publicación ni despliegue de reglas.

## Inventarios de proveedores

El conector de Samuel verifica el formato real de la hoja, interpreta CSV y agrupa filas idénticas conservando sus cantidades y precios. Split usa `GET /api/v1/inventario` con `X-API-Key`; solo lee los equipos disponibles del API de revendedores. `SPLIT` se presenta como Saúl y `JAVIER` como Javier. No se escriben ventas ni reservas en sistemas de los proveedores.

Las descargas se validan completas antes de sustituir el inventario de ese proveedor en una escritura local. Una lista vacía válida retira los equipos que ya no están disponibles; un error HTTP, contenido inesperado, conteos incompletos o falta de espacio conserva la lista anterior. Se muestran fecha de consulta, unidades y estado. Los detalles de fuentes y conexión se consultan en Ajustes. La actualización automática al consultar se limita a una vez cada diez minutos por proveedor; los filtros no descargan. El botón Actualizar permite solicitar otra consulta.

El constructor puede generar una copia inicial privada con `python3 scripts/fetch-provider-snapshot.py`, usando `SPLIT_INVENTORY_TOKEN` configurado de forma segura en el entorno. Genera `android/provider-bootstrap.json`, ignorado por Git. Gradle lo empaqueta como datos de inventario; no contiene la clave ni datos de autenticación. Una compilación sin esa copia puede cargar los datos al actualizar y conserva cualquier descarga previa.

Pruebas del conector: `npm test`, `node tests/feeds-ui.cjs` y las pruebas nativas Android. Las dos instrumentadas `InventoryInstrumentedTest` verifican Keystore real y la carga de ambas listas mediante el puente en un WebView Android. Requieren generar la copia inicial e instalar el APK de prueba.

## Activar ventas compartidas

Antes de instalar 1.6.2 en todos los teléfonos, publica manualmente el archivo completo [firestore.rules](firestore.rules) en el proyecto Firebase existente. Esta entrega no publica la app ni las reglas. Las colecciones nuevas son `suiteSales`, `suiteInventory`, `suiteCounters` y `suiteOperations`, dentro de `users/{uid}`. Las reglas mantienen Follows y perfiles.

Pausa el registro de ventas mientras actualizas y conectas todos los teléfonos antiguos. Actualiza todos los teléfonos sin desinstalar. Abre la misma cuenta en cada uno con conexión y espera a que termine «Preparando Ventas compartidas» antes de registrar nuevas ventas. Se incorporan las ventas confirmadas y equipos previamente guardados para esa cuenta; la zona sin cuenta no se importa automáticamente. Los registros con el mismo ID no se sobrescriben. Se conservan autores, importes y correlativos históricos; si dos instalaciones antiguas ya usaron un mismo número, esos comprobantes no se renumeran. La sincronización reserva el máximo correlativo importado, por lo que deben conectarse todos los teléfonos antiguos antes de emitir comprobantes nuevos.

Una solicitud pendiente conserva su identificador y usuario hasta recibir confirmación; al reconectar o reintentar no duplica venta ni existencias. Anular devuelve unidades una sola vez. Las ediciones de garantía y organización de equipos rechazan cambios basados en una versión anterior. La firma de usuario es el nombre del perfil seleccionado; los perfiles comparten la cuenta y no tienen contraseñas ni permisos independientes. La app no reserva ni descuenta existencias de proveedores externos.

Firebase lee las ventas e inventario de la cuenta al abrir sus listeners y después recibe cambios; no son consultas periódicas. Las operaciones usan transacciones cortas y un registro de idempotencia. El consumo crece con el historial y los dispositivos conectados; no se presenta como ilimitado.

Para habilitar **Editar venta** con cuenta en 1.6.2, publicar manualmente la versión completa actual de `firestore.rules`; las reglas de 1.6.0/1.6.1 no autorizan la nueva operación. Actualizar todos los teléfonos para que las garantías compartidas utilicen la misma fecha. El correlativo, su mes de emisión y el vendedor original se conservan incluso al corregir una fecha de otro mes o año. El nombre del archivo conserva el año del correlativo emitido.
