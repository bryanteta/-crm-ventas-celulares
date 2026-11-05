# Lunivo 1.5.7-preview · Ajustes y cambio de espacio

## Experiencia

Ajustes se organiza en cuatro secciones: **Cuenta**, **Inventarios**, **Avisos** y **Aplicación**. Los controles existentes conservan sus identificadores y sus acciones; se presentan dentro de tarjetas y solo se muestra la sección elegida. Al abrir Ajustes desde Inventario se selecciona la conexión de proveedores.

Los botones **?** explican cuenta, usuarios, autoría, inventarios, clave de Split, permisos y pruebas de notificaciones, sonido, almacenamiento y sincronización. Abrir una explicación no guarda datos ni ejecuta la acción explicada. Las ayudas se cierran con Entendido, la cruz, Escape o pulsando fuera; devuelven el foco al control original. Las secciones admiten navegación con flechas, Inicio y Fin.

El selector entre **Follows** y **Ventas** usa tarjetas con iconos y colores diferentes, indica el espacio en uso y explica las herramientas de cada uno. Durante la sesión se recuerda la última ruta de ambos espacios, incluidos sus parámetros. Volver conserva los campos sin guardar. Elegir el espacio activo mantiene la pantalla actual. En pantalla desplegada, Ventas conserva el menú lateral vertical; en teléfono utiliza cuatro botones inferiores. Se corrige un punto de corte que comprimía los cuatro botones dentro del ancho de la barra lateral. La transición respeta la preferencia de movimiento reducido y anuncia el destino a lectores de pantalla.

La versión mostrada en Información se actualiza junto con el APK. No se cambian reglas Firebase, destinos de proveedores, claves de almacenamiento, importes, inventarios, ventas ni PDFs. Ventas, garantías y Mis equipos siguen siendo locales por cuenta y teléfono; las ayudas lo explican.

## Validación

- **45 pruebas Node aprobadas**.
- **20 suites de interfaz aprobadas**, incluidas integridad de ventas, descuento y devolución de inventario, accesorios, garantías, cuentas, perfiles, notificaciones y almacenamiento.
- **41 pruebas unitarias Android release aprobadas**, sin errores ni omisiones.
- La nueva suite comprueba categorías, ayuda sin acciones ni guardados, foco y teclado, prueba de notificación, clave escrita conservada al abrir ayuda, formularios sin guardar y retorno a las rutas de ambos módulos.
- Ajustes sin desbordamiento en anchos **320, 384, 412, 690, 840 y 960 px**. El selector cabe también en **915 × 412**; captura adicional de pantalla desplegada en **840 × 920**. Movimiento reducido sin animación.
- Compilación release y Lint sin errores. Lint mantiene seis avisos `GradleDependency` sobre versiones posteriores disponibles; no se actualizan dependencias en este cambio de interfaz.
- APK `com.crmcelulares.app`, versión **1.5.7-preview**, código **26**, con la misma firma de actualización. Recursos web, incluido `settings-ui.js`, y copia inicial privada cotejados con el APK.

Las pruebas de interfaz usan Chromium y puentes Android simulados; las pruebas unitarias Android usan Robolectric. No se ejecutan pruebas instrumentadas ni pruebas físicas en Samsung para este cambio. La copia inicial de proveedores conserva su fecha de verificación anterior; no se presenta como una nueva descarga.

APK SHA-256: `0452db3c5e3baaf351115bbb24260ad449c0e6b535b95bb395ca846219812126`.
