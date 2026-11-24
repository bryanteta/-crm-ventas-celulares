# Prueba física del candidato 1.7.35-rc.1

Usar un Android secundario con una cuenta separada y datos ficticios. Instalar sobre 1.7.34, sin desinstalar. Verificar firma, ventas, borradores, garantías, PDF, pagos divididos, existencias y correlativos.

1. Exportar desde Ajustes → Aplicación → Tus datos al selector del sistema. Cancelar una vez y comprobar que no anuncia guardado. Exportar e importar el archivo correcto; revisar vista previa y cancelar sin cambios.
2. Importar confirmando: comprobar cantidades, conflictos archivados y correlativos máximos. Con cuenta, verificar que no se escribe en Firebase antes de pulsar Sincronizar respaldo. Probar archivo inválido y de otra cuenta.
3. Para simular la base desaparecida, usar un dispositivo de desarrollo con datos ficticios; no borrar los datos de la aplicación ni hacerlo en el teléfono de venta. Con la app cerrada, eliminar solo IndexedDB mediante las herramientas de prueba disponibles. La build release no habilita depuración WebView; las pruebas automatizadas de navegador cubren este caso y un dispositivo de desarrollo puede usar una build depurable con la misma firma.
4. Abrir Ventas: debe mostrar Recuperar ventas y bloquear guardados. Con cuenta, consultar el servidor y restaurar. Sin cuenta, importar respaldo o indicar el último correlativo conocido. Verificar que no se reenvíe una operación ya aplicada ni se descuente inventario dos veces.
5. Guardar una venta, forzar cierre y abrir otra vez. Revisar PDF y siguiente número. Probar sin conexión y con poco espacio en el dispositivo dedicado: la recuperación fallida no debe sustituir la copia anterior.
6. Registrar teléfono, Android y Android System WebView, cantidad de registros, números antes/después y resultado de cada caso.

El APK instrumentado incluye StorageMigrationInstrumentedTest.backupUsesSystemPickerAndReportsCancellation, que verifica el flujo real del selector con cancelación interceptada, sin escribir archivos de clientes. También conserva la prueba aislada de migración y crecimiento.

La estable sigue en 1.7.34. Instalar este candidato (71) requiere una siguiente estable con código al menos 72. No se debe desinstalar para volver a una versión inferior.
