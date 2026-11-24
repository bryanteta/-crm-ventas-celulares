# Lunivo 1.7.33 · Precios compartidos entre app y web

Publica en Android los cambios de sincronización de precios integrados en `main` (14117a0). La app consulta el mismo catálogo que la web, muestra «Venta web» cuando corresponde y usa ese importe como sugerencia al vender, conservando el costo del proveedor. Permite cambiar o restaurar el precio desde la tarjeta, conservando las fotos web y protegiendo cambios concurrentes.

Para editar: Ajustes → Inventario → Precios de la web → guardar la misma clave administrativa del catálogo. Se verifica antes de guardarla, cifrada con Android Keystore y separada de la clave de Split. Leer los precios públicos no requiere configurar esa clave. No requiere nuevas reglas de Firebase.

Versión Android 1.7.33, código 68, paquete `com.crmcelulares.app`. APK público firmado con la misma identidad instalada, SHA-256 del certificado `49be17458fe0ba6989d8523faa39ccb937b1576ded93a80de193dc59d44dd9f6`. Instalación sobre la app existente, sin desinstalar.

Validación: pruebas unitarias JS; 87 pruebas nativas Android sin fallos ni omisiones; compilación release con inventario privado excluido; flujos de interfaz de inventario, navegación, usuarios, ventas, accesorios, garantías, actualizador y puente Android; prueba de precios app ↔ Worker con edición concurrente, clave inválida/rotada y conservación de fotos; bancos y cuotas. Se ajustaron selectores, esperas de navegación y nombres históricos en las pruebas para el diseño actual; no se alteró la interfaz de esos flujos para hacerlas pasar.

Se verificaron paquete, versión, firma, coincidencia de los nuevos archivos web dentro del APK y ausencia del bootstrap de proveedores, archivos de firma y clave administrativa conocida. El manifiesto se genera del APK real y se verifican los archivos publicados mediante SHA-256. No se probó instalación física en un teléfono; Android conserva la confirmación normal de instalación.
