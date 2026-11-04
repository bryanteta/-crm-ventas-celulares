# Lunivo para Android · 1.5.1-preview

App para instalación directa, paquete `com.crmcelulares.app`, código de versión 20. Interfaz local en WebView, recordatorios nativos y exportación de PDF mediante las APIs de Android. Android mínimo 8.0; compilación con SDK 35.

## Compilar

Requisitos: JDK 17/21, Android SDK Platform 35 y Build Tools 35.0.0. El wrapper fija Gradle 8.11.1. Define `ANDROID_HOME` o crea `android/local.properties`, ignorado por Git:

```properties
sdk.dir=/ruta/al/android-sdk
```

Desde `android/`:

```sh
./gradlew :app:testReleaseUnitTest :app:assembleRelease :app:assembleReleaseAndroidTest :app:lintRelease
```

APK: `app/build/outputs/apk/release/app-release.apk`.

La compilación copia la interfaz de la raíz y los recursos de `assets/`; no mantiene una segunda copia del HTML/JavaScript. No se incluyen credenciales privadas, configuraciones locales ni resultados de compilación en el repositorio.

## Firma e instalación

La entrega privada usa `signingConfigs.debug`, con depuración de la app desactivada. Para actualizar una instalación existente es indispensable conservar **el mismo keystore de firma** de las entregas anteriores; almacénalo de forma privada y úsalo en la configuración de tu entorno. Una clave debug generada en otra máquina no tiene la misma identidad. No se incluye el keystore en Git.

Instala sobre la app anterior:

```sh
adb install -r app/build/outputs/apk/release/app-release.apk
```

No desinstales ni borres los datos para actualizar. Se mantienen el origen HTTPS del WebView y las claves de almacenamiento anteriores. No hay una migración que elimine ventas o seguimientos.

## Configurar Firebase

Desde la raíz:

```sh
node scripts/configure-firebase.cjs /ruta/google-services.json
```

El script valida `com.crmcelulares.app` y crea `android/firebase.properties`, ignorado por Git. No reemplaza una configuración existente. La app usa esos valores para inicializar los SDK nativos; no necesita una cuenta de servicio. La plantilla `firebase.properties.example` no contiene claves.

En tu proyecto habilita Authentication con correo/contraseña y Cloud Firestore `(default)`. Las reglas de `firestore.rules` validan seguimientos/perfiles y limitan el acceso a la cuenta autenticada. Compilar o hacer push de este repositorio **no publica reglas**. Los despliegues de reglas requieren una acción administrativa independiente.

Una compilación sin configuración de Firebase conserva el modo local y muestra la sincronización como no disponible. Las contraseñas son gestionadas por Firebase Auth, no por el almacenamiento web.

Follows permite vincular varios teléfonos con la misma cuenta. Los perfiles de usuario comparten esa cuenta; cada dispositivo elige quién lo utiliza. El autor de un registro se conserva al editar. La importación de datos locales es explícita. Los cambios sin conexión y eliminaciones se reenvían al reconectar sin reemplazar toda la colección. Los recordatorios se programan con los datos descargados en ese teléfono.

## Inventario y ventas

El inventario conserva una vista global y sus identificadores de dueño (`samuel`, `saul`, `javier`). Split agrupa únicamente Samuel y Javier y permite filtrarlos por separado. TecnoShop abre un catálogo filtrado del proveedor y carga la referencia PDF integrada en su primer acceso. Los registros manuales de Saúl y los lotes sin asignar siguen disponibles en Global; no se reclasifican ni se combinan con la disponibilidad del proveedor. Cada lote conserva su identificador, cantidad y costo. Organizar un lote cambia solo dueño/marca. No combina existencias de dueños o costos diferentes. Las vistas permiten buscar y ordenar por modelo o marca y mostrar agotados. Los enlaces de inventarios todavía no están disponibles; la carga manual sirve para empezar a organizar los datos.

Registrar una venta de inventario descuenta las unidades en la misma escritura local. Un fallo de guardado no aplica un descuento parcial. No se permite stock negativo. Anular devuelve las unidades una sola vez y conserva el historial. Las ventas históricas cuyo pago de comisión ya se registró mantienen su restricción de anulación.

Las ventas nuevas llevan `commissionEnabled: false` y no descuentan los $15 anteriores. Los cálculos de registros anteriores sin esa marca mantienen sus importes originales. La comisión ya no tiene apartado ni acciones de pago en la interfaz.

Los accesorios se guardan como líneas con identificador, categoría, descripción y precio en centavos. Su suma debe coincidir con el total cobrado por accesorios. Precio cero es una cortesía. Los registros antiguos que solo tienen un importe conservan ese importe sin inventar un desglose. Las cortesías de garantía no se duplican cuando el accesorio ya está incluido en la venta.

Ventas, garantías, inventario y cotizaciones son locales por cuenta/dispositivo. No se sincronizan con Firebase en esta vista previa ni se importan automáticamente al cambiar de cuenta. Los datos del proveedor son referencia y no se suman al inventario propio. La lista TecnoShopSV corresponde al PDF compartido del 02/11/2026; no hay importación automática de PDFs nuevos.

## PDF e impresión

**Guardar PDF** abre el selector de archivos de Android. `ReceiptPdfDocument` dibuja un PDF A4 mediante `android.graphics.pdf.PdfDocument`: texto y líneas vectoriales, logo original sin reducir y paginación para datos largos. No usa capturas del WebView. El contenido incluye solo datos del cliente y no recibe costos, utilidad ni notas internas. El documento nativo se cierra antes de escribir en el destino elegido; los errores de almacenamiento no se notifican como guardados exitosos.

**Imprimir** conserva una acción independiente. El documento HTML se sirve desde memoria en una dirección HTTPS interna y solo pasa a impresión si termina de cargar correctamente. Se solicita A4, color y 600 dpi; el servicio de impresión puede ajustar sus opciones. La vista previa de la app utiliza un Shadow DOM, sin navegación `srcdoc` ni estilos que afecten al resto de la interfaz.

El IMEI es opcional; si se añade se admite como máximo uno por unidad sin repetir. La garantía dura tres meses calendario desde la entrega, ajustando el último día del mes. El correlativo usa mes + secuencia: 1001 = octubre, venta 1; 1101 = noviembre, venta 1. Se separa por año/mes, es local al dispositivo y no se consume con borradores o reimpresiones. Anular no reutiliza números.

## Notificaciones y pantallas Samsung

En Ajustes están la cuenta, los usuarios, la prueba de notificaciones y el sonido de entrada. Activa el permiso de notificaciones y, si lo necesitas, el acceso a alarmas exactas. Android puede retrasar avisos por reposo, canal, batería o No molestar. Forzar la detención desde Ajustes desactiva alarmas hasta abrir la app; al reiniciar se recuperan pendientes de las últimas 24 horas.

La interfaz se adapta al ancho de la ventana, incluida pantalla exterior/desplegada, horizontal y multiventana. `SafeAreaLayout` respeta barras, cámara, gestos y teclado. El sonido de inicio respeta silencio, vibración, No molestar y volumen cero. Las pruebas de viewport no sustituyen una comprobación física en el Note 20 Ultra y Z Fold.

## Pruebas

Las pruebas web se describen en el README de la raíz. Las unitarias Android usan Robolectric y las instrumentadas requieren un dispositivo o emulador.

Para probar exclusivamente el generador nativo de PDF, instala ambos APK y ejecuta:

```sh
adb install -r app/build/outputs/apk/release/app-release.apk
adb install -r app/build/outputs/apk/androidTest/release/app-release-androidTest.apk
adb shell am instrument -w -r -e class com.crmcelulares.app.ReceiptPdfDocumentInstrumentedTest com.crmcelulares.app.test/androidx.test.runner.AndroidJUnitRunner
```

La suite verifica PDF A4 válido, accesorios detallados, campos largos y errores de escritura. Escribe ejemplos ficticios en el directorio externo de archivos de la app, recuperables en un emulador con:

```sh
adb pull /sdcard/Android/data/com.crmcelulares.app/files/receipt-quality-example.pdf
```

`FinalAppTest` es una suite distinta para actualizaciones históricas y requiere preparar sus datos de origen; no debe contarse como ejecutada por compilarla.
