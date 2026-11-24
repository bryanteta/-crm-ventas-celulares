# Prueba de Lunivo 1.7.34-rc.1

Candidato firmado para un teléfono de pruebas. La estable continúa en 1.7.33. No se actualizan automáticamente los teléfonos de venta.

## Preparación

En un teléfono secundario, instala la 1.7.33 y crea datos ficticios. Anota el usuario seleccionado, cantidad de ventas, números de garantía, existencias e importes. Incluye una venta confirmada, un borrador, una venta con pago dividido y una garantía con accesorios de cortesía. Si pruebas sincronización, usa una cuenta de pruebas separada de la operación real.

Instala el APK candidato sobre la app existente para conservar su almacenamiento. El candidato tiene código 69; la siguiente estable deberá usar 70 o superior para actualizarlo. No se ofrece una bajada automática a 1.7.33. Por eso se prepara primero en un teléfono secundario.

## Comprobaciones

1. Abre ventas y verifica que estén los registros anteriores, borradores, garantías, accesorios e importes.
2. Revisa que las existencias sean las mismas y que el siguiente número de garantía avance sin repetir uno anterior.
3. Guarda una venta nueva, cierra y vuelve a abrir la app. Verifica que continúe guardada y que el borrador previo siga disponible.
4. Comprueba PDF y pago dividido; compara cantidades y bancos con la venta original.
5. Si usas una cuenta de pruebas, abre esa cuenta en otro teléfono y comprueba venta, garantía y edición concurrente. El modo local de cada teléfono debe permanecer separado.
6. En Ajustes → Aplicación → Tus datos, revisa espacio y cantidad de ventas. Primero prueba con espacio suficiente. Una prueba posterior con poco espacio debe hacerse en un dispositivo dedicado; nunca liberes espacio borrando los datos de Lunivo.
7. Registra modelo de teléfono, Android, versión de Android System WebView, cantidad migrada y cualquier error. Ante un error, conserva la app y sus datos para revisar la copia.

## Prueba instrumentada opcional con ADB

El APK de pruebas acompaña al candidato para un dispositivo de desarrollo. `StorageMigrationInstrumentedTest` usa una clave aislada y prueba 1.800 registros antiguos, crecimiento a 5.000 y recreación de la actividad. No reemplaza las pruebas manuales ni una prueba con el teléfono casi lleno.

```sh
adb install -r lunivo-1.7.34-rc.1-release.apk
adb install -r -t lunivo-1.7.34-rc.1-androidTest.apk
adb shell am instrument -w -e class com.crmcelulares.app.StorageMigrationInstrumentedTest com.crmcelulares.app.test/androidx.test.runner.AndroidJUnitRunner
```

Se fusionará y publicará la estable después de revisar los resultados físicos. Este candidato no cambia las reglas de Firebase ni la estrategia de lectura completa de Firestore.
