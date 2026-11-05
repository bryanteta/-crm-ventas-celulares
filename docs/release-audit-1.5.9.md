# Lunivo 1.5.9 · Revisión y preparación local

Entrega preparada para instalación directa de APK, versión **1.5.9**, código **28**. Se conserva el paquete `com.crmcelulares.app`, el origen del WebView, las claves de almacenamiento y la firma de actualización. No se publica la app, no se hace push ni se despliegan reglas de Firebase.

## Errores corregidos

| Caso encontrado | Comportamiento corregido |
| --- | --- |
| Limpiar un seguimiento en edición mantenía seleccionado el registro anterior. | Limpiar deja el formulario como un seguimiento nuevo; guardar no sobrescribe el anterior. |
| Eliminar localmente el seguimiento que se estaba editando podía dejar un editor vinculado a un registro inexistente. | Se conserva el texto como una copia nueva, con otro identificador al guardar. |
| Atrás de Android navegaba o salía en lugar de cerrar una ventana. | Cierra primero la ayuda superior y después el selector o diálogo, conservando ruta y formulario. El controlador web de cierre se comprueba en navegador; el cableado Android compila. |
| Recuperar contraseña admitía pulsaciones repetidas durante la solicitud. | Muestra espera y bloquea solicitudes simultáneas; permite reintentar tras un error. Las pruebas no envían correos reales. |
| Guardar/quitar la clave de Split podía solaparse, o una respuesta inicial tardía deshacer el estado mostrado. | Controles mutuamente excluyentes y respuestas versionadas por cuenta; errores persistentes y reintento de comprobación desde Actualizar. La creación de la clave nativa se serializa. |
| Un accesorio desmarcado o meses de tasa cero ocultos podían seguir bloqueando la validación. | Solo se validan los controles aplicables, conservando sus valores si se vuelven a activar. |
| Errores de accesorios o tasa cero se notificaban lejos del campo. | Se abre el desplegable necesario y se enfoca el nombre, importe, tipo, banco o meses pendientes. El límite de accesorios adicionales queda visible y desactiva el botón. |
| Los selectores permitían escoger equipos u ofertas agotados. | Las opciones agotadas están desactivadas; también se rechaza confirmar una oferta que quedó agotada mientras se preparaba la venta. |
| Listas de Follows con datos y nombres de accesorios tenían contraste insuficiente en modo oscuro. | Se adaptan fondos, textos, bordes y estados de esas vistas pobladas. |
| Un almacenamiento local ilegible podía sustituirse al intentar guardar; cambiar a una cuenta dañada podía exponer datos anteriores. | Se valida el destino antes de cambiar de identidad, se bloquean escrituras sobre datos ilegibles y se ocultan registros si falla la apertura de una cuenta. El borrador y las alarmas existentes se conservan ante una lectura local fallida; una transición de cuenta fallida limpia los avisos privados anteriores. |

No se recalculan importes históricos, no se reasignan inventarios y no se modifican condiciones de garantía, correlativos ni fuentes externas.

## Validación

- **49 pruebas Node aprobadas**: almacenamiento, cambios de cuenta, importes exactos, inventarios, accesorios, comprobantes y lectura de proveedores.
- **22 suites de interfaz aprobadas**: Follows, calendario, usuarios, ajustes, ayudas, módulos, modo oscuro, proveedores, equipos propios, ventas, borradores, anulación, garantías y exportación. Incluyen cuotas de almacenamiento, reintentos y solicitudes duplicadas. Se conservan las comprobaciones en pantalla estrecha, desplegada y horizontal.
- **42 pruebas unitarias Android release aprobadas**.
- **8 pruebas de reglas Firestore aprobadas**, más la suite de sincronización contra el emulador oficial local: importación explícita, edición offline, reconexión, eliminaciones, autoría, perfiles y aislamiento entre cuentas. No se escriben datos en Firebase de producción. Se mantiene la coalescencia medida: 20 ediciones rápidas producen una escritura; cambios offline de registros y perfiles producen dos al reconectar.
- `assembleRelease`, `assembleReleaseAndroidTest` y `lintRelease` sin errores. Se mantienen seis avisos `GradleDependency` sobre actualizaciones disponibles; no se cambian dependencias en esta entrega.
- APK íntegro, versión y firma verificadas; los recursos web y la copia privada de proveedores se cotejan con el contenido empaquetado. La copia conserva su fecha anterior; no se presenta como una descarga nueva.

## Límite de la comprobación nativa

Las pruebas de navegador simulan los puentes Android; las unitarias nativas utilizan Robolectric. Se añaden tres pruebas instrumentadas para Atrás, apariencia/barras y el botón real de notificaciones, y se prepara la suite existente de PDF e inventarios sin consultar proveedores en vivo.

Las instrumentadas **se compilan, pero no se ejecutan**: el emulador API 35 del entorno no levanta de forma utilizable los servicios `activity`, `window` y `package`. Se intentó una instancia nueva y se diagnosticó la conexión; se detuvo tras comprobar el fallo. Esto no equivale a una prueba física en Note 20 Ultra o Z Fold. Antes de distribución amplia queda la comprobación final en un Android funcional.

En un emulador de prueba funcional, después de instalar el APK release y `app-release-androidTest.apk`, ejecutar:

```sh
adb shell am instrument -w -e class com.crmcelulares.app.ReleaseAuditInstrumentedTest,com.crmcelulares.app.ReceiptPdfDocumentInstrumentedTest,com.crmcelulares.app.InventoryInstrumentedTest com.crmcelulares.app.test/androidx.test.runner.AndroidJUnitRunner
```

La entrega mantiene la identidad de firma privada utilizada por las versiones instaladas. No incluye una publicación en Google Play. Para actualizar el teléfono, instalar el APK sobre la versión anterior sin desinstalar ni borrar datos.

APK SHA-256: `2d4f9889e4fe33210fa406c4fc12f164bd0f220cc9cbb07ac7752a36a042f05e`.
