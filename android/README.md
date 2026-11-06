# Lunivo para Android · 1.6.5

App para instalación directa, paquete `com.crmcelulares.app`, código de versión 34. Interfaz local en WebView, recordatorios nativos y exportación de PDF mediante las APIs de Android. Android mínimo 8.0; compilación con SDK 35.

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

La entrada **Inventario** reúne **Split (Saúl y Javier)** y **Samuel**. Inicio de Ventas e Inventario tienen acceso visible a **Mis equipos**, cuyo registro propio usa la categoría Lunivo. Más opciones conserva filtros y el enlace anterior al registro manual; las fuentes y detalles de conexión quedan en Ajustes. Buscar, comparar modelo y ordenar permite consultar ambos sin copiar lotes a cotizaciones. Los dueños y los identificadores persistidos permanecen intactos; cambiar la agrupación no reasigna inventarios ni reescribe ventas. La vista Global conserva los equipos sin asignar.

Las cotizaciones antiguas de TecnoShop se presentan como Samuel mediante un alias de lectura, conservando los datos originales y los accesos guardados `provider=tecnoshop`. Las ventas nuevas usan los nombres actuales; el historial financiero no se recalcula. Elegir un lote de Samuel usa su costo y descuenta solo sus unidades al confirmar. Split permite los filtros Combinado, Saúl y Javier.

Samuel se consulta como CSV desde su hoja pública de Google. Split usa su API de revendedores verificada: `GET https://split-crm.splitelsalvador.workers.dev/api/v1/inventario`, encabezado `X-API-Key`. Se proyectan sus orígenes `SPLIT` → Saúl y `JAVIER` → Javier. Solo se hacen lecturas; Lunivo no modifica inventarios o ventas del proveedor.

`InventoryHttp` solo admite esos dos destinos HTTPS fijos, no sigue redirecciones, limita tamaño y tiempos de espera y rechaza páginas HTML o respuestas fallidas. El puente `LunivoInventoryAndroid` solo se inyecta en el frame principal del origen de recursos empaquetados. El WebView no recibe la clave guardada. La clave se introduce en Ajustes y se cifra con AES-GCM y una clave de Android Keystore, vinculada a la cuenta por AAD. No se incluye en BuildConfig, fuentes, archivos de inventario ni APK.

El constructor privado ejecuta `python3 scripts/fetch-provider-snapshot.py` con `SPLIT_INVENTORY_TOKEN` del entorno. Las credenciales de proxy se usan solo en el encabezado dirigido a Split, sin imprimirlas ni guardarlas. El archivo resultante `android/provider-bootstrap.json`, ignorado por Git, contiene únicamente variantes/precios/cantidades y fecha de lectura. Gradle Sync lo incluye en `www/assets/provider-bootstrap.json` y elimina recursos generados obsoletos si falta en otra compilación.

La copia incluida se carga al abrir Inventario si la cuenta no tiene datos descargados. Samuel se actualiza automáticamente cuando la consulta tiene más de diez minutos. Split se actualiza del mismo modo una vez guardada su clave en el teléfono. Actualizar consulta ambas fuentes; si Split no tiene clave, conserva su copia y explica cómo configurarla. El inventario permanece visible sin conexión. La fecha distingue copia incluida y consulta directa.

`feeds-core.js` valida toda la respuesta, cuenta unidades, conserva precios distintos, vincula dueños y genera identificadores de variante estables. Cada proveedor se sustituye en una sola escritura del almacenamiento de la cuenta. Una actualización de Samuel retira la referencia PDF antigua integrada, conservando ofertas manuales y otros proveedores. No cambia ventas, autores, inventario propio ni correlativos. Una respuesta válida vacía retira los equipos no disponibles; errores y respuestas tardías de otra cuenta no reemplazan la lista guardada. Los lotes locales permanecen en Mis equipos; Inventario usa la fuente descargada cuando existe para evitar duplicar existencias.

Las tarjetas mantienen el formato compacto y sus acciones desplegables. Organizar cambia solo dueño/marca; los equipos de distintos dueños o costos no se combinan.

Registrar una venta de inventario descuenta las unidades en una transacción compartida con conexión cuando hay cuenta; en modo local, en la misma escritura local. Un fallo de guardado no aplica un descuento parcial. No se permite stock negativo. Anular devuelve las unidades una sola vez y conserva el historial. Las ventas históricas cuyo pago de comisión ya se registró mantienen su restricción de anulación.

Las ventas nuevas llevan `commissionEnabled: false` y no descuentan los $15 anteriores. Los cálculos de registros anteriores sin esa marca mantienen sus importes originales. La comisión ya no tiene apartado ni acciones de pago en la interfaz.

Los accesorios se guardan como líneas con identificador, categoría, descripción y precio en centavos. Su suma debe coincidir con el total cobrado por accesorios. Precio cero es una cortesía. Los registros antiguos que solo tienen un importe conservan ese importe sin inventar un desglose. Las cortesías de garantía no se duplican cuando el accesorio ya está incluido en la venta.

Las ventas confirmadas, garantías y Mis equipos se sincronizan con Firebase por cuenta. Borradores, cotizaciones, claves y cachés de proveedores permanecen locales. La confirmación de ventas y los cambios de existencias exigen conexión; los borradores se guardan offline. Publica manualmente las reglas y migra todos los teléfonos siguiendo el README principal. Los datos del proveedor son referencia y no se suman al inventario propio. La lista TecnoShopSV corresponde al PDF compartido del 02/11/2026; no hay importación automática de PDFs nuevos.

## PDF e impresión

**Guardar PDF** abre el selector de archivos de Android. `ReceiptPdfDocument` dibuja un PDF A4 mediante `android.graphics.pdf.PdfDocument`: texto y líneas vectoriales, logo original sin reducir y paginación para datos largos. No usa capturas del WebView. El contenido incluye solo datos del cliente y no recibe costos, utilidad ni notas internas. El documento nativo se cierra antes de escribir en el destino elegido; los errores de almacenamiento no se notifican como guardados exitosos.

**Imprimir** conserva una acción independiente. El documento HTML se sirve desde memoria en una dirección HTTPS interna y solo pasa a impresión si termina de cargar correctamente. Se solicita A4, color y 600 dpi; el servicio de impresión puede ajustar sus opciones. La vista previa de la app utiliza un Shadow DOM, sin navegación `srcdoc` ni estilos que afecten al resto de la interfaz.

El IMEI es opcional; si se añade se admite como máximo uno por unidad sin repetir. La garantía usa la fecha de la venta, aunque se prepare otro día, y dura tres meses calendario desde esa fecha, ajustando el último día del mes. El correlativo usa mes + secuencia: 1001 = octubre, venta 1; 1101 = noviembre, venta 1. Se separa por año/mes, es compartido por cuenta (local si no hay sesión) y no se consume con borradores o reimpresiones. Anular no reutiliza números.

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

Para verificar la nueva integración en un emulador, ejecuta únicamente sus dos pruebas:

```sh
adb shell am instrument -w -r -e class com.crmcelulares.app.InventoryInstrumentedTest com.crmcelulares.app.test/androidx.test.runner.AndroidJUnitRunner
```

Las pruebas instrumentadas usan una clave ficticia aislada para comprobar el cifrado y la borran al finalizar. La prueba de WebView verifica los datos reales empaquetados; no supone que el emulador tenga acceso de red a los proveedores. Las lecturas de los servicios reales se verifican por separado durante la generación de la copia.

La impresión de 1.6.1 queda autorizada por la pantalla local de la garantía y requiere una pulsación del usuario. Una impresión todavía en preparación se cancela al cambiar de contexto o pausar la actividad; una devolución tardía de carga no puede iniciarla. El selector de archivos mantiene el documento que el usuario solicitó exportar. Las respuestas incluyen el identificador de la solicitud para no escribir estados sobre otra garantía.

1.6.2 agrega `editSale` al motor y a las reglas de Firestore. Corregir una venta conserva el ID, autor, correlativo y contador. La cantidad de un equipo propio actualiza venta y stock en la misma transacción; se registra el editor. Actualizar el archivo completo de reglas antes de utilizar la edición compartida.

1.6.5 permite Eliminar del historial y recuperar desde Ver eliminadas sin anular, devolver stock ni cambiar importes. La visibilidad de ventas confirmadas se comparte entre dispositivos y requiere publicar el archivo completo de reglas actualizado. Los borradores siguen locales. El editor recalcula solo la venta abierta y agrupa eventos de teclado por cuadro; no lee el historial al escribir. Hidrogel y Vidrio templado se muestran sin marcas entre paréntesis.
