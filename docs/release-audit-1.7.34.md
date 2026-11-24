# Lunivo 1.7.34 · Migración y recuperación de ventas

Publica los cambios validados del candidato 1.7.34-rc.1, sin modificar su lógica de almacenamiento. Android: código 70, paquete com.crmcelulares.app y certificado original. Actualiza tanto 1.7.33 (68) como el candidato (69) sin desinstalar.

Ventas pasa del blob de localStorage a IndexedDB con verificación de migración, diario de recuperación y espera de guardado antes de confirmar. Conserva correlativos, revisiones y solicitudes pendientes. Recuperar una copia antigua no debe sustituir una revisión confirmada ni una edición local con fecha posterior comprobable. Operaciones pendientes incompatibles se conservan y bloquean la recuperación para revisión. Incluye el indicador de espacio y las correcciones de catálogo ya incorporadas en main.

Validación previa del candidato: 117 pruebas JS y 87 nativas Android; 1.800 ventas migradas exactamente y crecimiento a 5.001; recarga, reversión y fallos de guardado; actualización de assets antiguos; dos clientes con Firestore emulado. La última verificación de migración y recuperación en GitHub pasó. La promoción cambia solo la versión visible, el código Android y la documentación. Se recompila el APK público y se verifican firma, paquete, assets, exclusión de datos privados y hash del archivo distribuido.

El usuario solicita publicar la actualización y realizará la prueba física. No se ha verificado aquí la instalación en un teléfono, el apagado durante un guardado ni el funcionamiento con poco espacio real. La prueba instrumentada de WebView se compiló, pero no se ejecutó en Android físico. La guía del candidato continúa disponible como referencia histórica. No se despliegan reglas ni se modifican datos de Firebase.

IndexedDB amplía el almacenamiento pero no es ilimitado ni sustituye un respaldo. SQLite/Room, las lecturas incrementales de Firestore y la edición local simultánea en varias pestañas siguen fuera de esta entrega.
