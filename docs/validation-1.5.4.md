# Lunivo 1.5.4-preview · Split y Samuel

**Estado:** organización y etiquetas implementadas; alimentación automática de las nuevas fuentes pendiente de verificar por bloqueo de red del entorno.

## Organización y conservación

- Split corresponde exclusivamente a **Saúl y Javier**, con combinado e individuales. **Samuel** es proveedor independiente y reemplaza el nombre visible TecnoShop.
- Los lotes de Samuel aparecen en su proveedor y su inventario individual. Saúl se incluye en Split. No se intercambian dueños ni se reescriben identificadores, cantidades, costos, autores o ventas históricas.
- Las cotizaciones antiguas se presentan con el alias Samuel. Los datos originales se conservan y las rutas guardadas `provider=tecnoshop` siguen abriendo Samuel.
- Las ventas nuevas de lotes usan Split/Samuel según el dueño real. Se preservan el descuento atómico, la devolución al anular y la separación entre cotizaciones y existencias registradas.
- Los accesos a la hoja de Samuel y la web de Split están en Fuentes de inventario. Son enlaces externos; no se anuncian como sincronización activa.
- La referencia PDF del 02/11/2026 se mantiene como archivo anterior e importación explícita. Ya no se carga automáticamente al abrir Proveedores. Consultar las vistas no cambia el almacenamiento.

## Verificación local

- **35 pruebas Node aprobadas**, incluida la nueva asignación de proveedores, aliases y conservación de los objetos originales.
- **18 suites de interfaz aprobadas**. Tras ajustar el cierre del panel de fuentes después de importar la referencia anterior se repiten proveedores y Suite; ambas aprobadas.
- Se verifica Split sin Samuel, Samuel con sus propios lotes y referencias anteriores, dueño visible, filtros y recarga, seis anchos de 320 a 960 px, selección de costo/proveedor, venta y anulación al lote correcto, datos originales intactos, fallo de almacenamiento sin importación parcial y aislamiento de cuentas.
- **35 pruebas Android release/Robolectric aprobadas**, compilación y Lint sin incidencias.
- APK con paquete `com.crmcelulares.app`, versión `1.5.4-preview`, código **23**, firma de actualización conservada y archivos web verificados contra las fuentes.
- No se prueban teléfonos Samsung físicos ni se repiten pruebas instrumentadas del PDF nativo en esta entrega.

## Bloqueo de las nuevas conexiones

Las peticiones HTTPS desde este entorno a `docs.google.com` y `split-crm.splitelsalvador.workers.dev` fallaron con **Tunnel connection failed: 403 Forbidden** del proxy, antes de alcanzar los servicios. No se ha podido leer la hoja, inspeccionar el código o documentación de Split ni comprobar su autenticación. El usuario no tiene confirmado si la clave entregada es token de API o contraseña.

Se guardó un borrador de configuración que preserva los dominios anteriores y agrega esos dos hosts. También se declaró `SPLIT_INVENTORY_TOKEN` para introducir la clave en Ajustes del entorno, con destino limitado al host de Split. No se copió el valor al código, APK, enlaces, archivos locales ni Git. **El borrador guardado no aplica permisos al entorno actual.**

Para continuar, revisar y guardar la configuración en Ajustes del entorno y publicar el entorno. Después se deben reintentar las lecturas permitidas y verificar el esquema, permisos, autenticación y mecanismo de actualización antes de desarrollar o anunciar la alimentación automática. No se adivinan endpoints de API ni se elude el proxy. Las reglas y servicios Firebase de producción no se modificaron.

APK SHA-256: `12c90c6b0631859501c937faa0285d3b34100bd02cebd8ba6ff1d1ac66cca349`.
