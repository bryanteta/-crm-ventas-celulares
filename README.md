# Lunivo Suite

App Android y prototipo web para gestionar seguimientos, inventarios, ventas y garantías. Versión **1.5.4-preview**; Android 8.0 o superior.

## Funciones

- **Follows:** clientes, agenda, usuarios que registran cada seguimiento, avisos nativos y sincronización opcional con Firebase.
- **Proveedores:** Split reúne **Saúl y Javier**; **Samuel** tiene su proveedor e inventario separado. Todos permite compararlos por modelo e importe. Las tarjetas indican dueño, cantidad y costo/precio. Los lotes se muestran sin duplicar las existencias.
- **Inventario registrado:** administración, reposición y organización por dueño. Global conserva todos los equipos y los lotes sin asignar. Los registros existentes conservan sus identificadores, propietarios, cantidades y costos.
- **Fuentes externas pendientes:** están identificadas la hoja de Google de Samuel y la web de Split. Los enlaces abren las páginas externas; todavía no alimentan automáticamente la app. La referencia PDF anterior se conserva para consulta/importación explícita; ya no se carga automáticamente al abrir Proveedores.
- **Tarjetas compactas:** modelo, detalles y dueño visibles; costo/precio y disponibilidad a la derecha. Toca el equipo para vender, agregar unidades u organizar. Los filtros de marca/orden se despliegan cuando los necesitas.
- **Ventas:** selección de equipo propio, oferta de proveedor o entrada manual; descuento de existencias junto con el guardado. Las ventas nuevas no descuentan comisiones. Los importes históricos se conservan.
- **Accesorios:** cargador completo, protector con tipo, case, caja genérica y varios accesorios adicionales, cada uno con su precio. Precio cero significa entrega sin costo. El comprobante incluye el detalle.
- **Garantías:** IMEI/serial manual y opcional, tres meses calendario desde la entrega y correlativo por mes/año. Exportación directa de PDF A4 vectorial y opción separada de impresión.

Ventas, garantías, inventario y cotizaciones permanecen **locales por cuenta y dispositivo**. Follows y los perfiles mantienen su sincronización existente. Los dueños del inventario son categorías de organización; no representan cuentas ni permisos individuales. No hay importación automática de enlaces o PDFs nuevos.

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
