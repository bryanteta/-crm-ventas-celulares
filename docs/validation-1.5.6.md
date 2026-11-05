# Lunivo 1.5.6-preview · Inventario más sencillo

## Cambio de experiencia

Antes, Inventario abría el registro manual y Proveedores abría las listas descargadas. La entrada principal ahora es **Inventario**, con los equipos de Samuel y Split. El menú de Ventas queda en Inicio, Inventario, Vender y Ventas. Los enlaces anteriores siguen funcionando.

La pantalla principal presenta:

- Todos, Samuel y Split, con cantidades de equipos. En Split se conservan Todo Split, Saúl y Javier.
- Una búsqueda y el botón Actualizar.
- Tarjetas compactas con modelo, detalles breves, proveedor/dueño, precio por unidad y cantidad disponible.
- Un total de equipos disponibles en lugar de mezclar el conteo de unidades con el de variantes.

Los nombres se presentan sin mayúsculas innecesarias ni capacidad duplicada en el título. Las especificaciones repetidas se eliminan de la presentación. Los modelos y detalles originales se conservan en el almacenamiento y en el detalle desplegado.

Modelo, orden, variante exacta, disponibilidad, quitar filtros, cotizaciones manuales y **Mis equipos · Registro manual** quedan dentro de Más opciones. El registro manual conserva alta, organización, reposición, ventas y devolución al anular. No hay cambios de claves de almacenamiento ni migración de datos.

Las fuentes y el detalle de conexión pasan a Ajustes. La lista muestra una fecha breve o un aviso del proveedor que no se pudo actualizar. El botón para revisar la conexión abre Ajustes. La conexión, la copia sin conexión y la protección de la clave de Split mantienen su comportamiento anterior. No se modifican endpoints, reglas Firebase, importes financieros ni el generador de PDF.

## Validación

- **45 pruebas Node aprobadas**.
- **41 pruebas unitarias Android release aprobadas**.
- **19 suites de interfaz aprobadas**. Se adaptaron las rutas a la entrada única Inventario y al acceso manual por Más opciones. Una espera de prueba para un control trasladado al desplegable se corrigió y la suite afectada volvió a ejecutarse.
- La prueba con la copia real de **355 equipos / 161 variantes** verifica precios, cantidades e identificadores conservados, las cuatro entradas de navegación, filtros y conexiones fuera de la vista inicial y al menos dos tarjetas en la primera pantalla de 412 × 915.
- Sin desbordamiento en anchos **320, 384, 412, 690, 840 y 960 px**; tarjetas cerradas de hasta 100 px. Las capturas muestran la copia verificada del 04/11/2026; su fecha no se presenta como una nueva descarga.
- Compilación y Lint sin errores. Se conservan las versiones de dependencias fijadas; Lint puede advertir que hay versiones posteriores disponibles.
- APK `com.crmcelulares.app`, versión **1.5.6-preview**, código **25**, con la misma firma de actualización. Fuentes web y copia inicial cotejadas con el APK.

No se repiten pruebas instrumentadas ni se afirma prueba física en Samsung. No se vuelve a descargar inventario real para este cambio de interfaz; la copia incluida y los datos guardados conservan su fecha y la aplicación mantiene la actualización desde los proveedores.

APK SHA-256: `5a59141cb92a73bf5fba2f891af68108b2cef31f18aeb3d3b77449d88e192131`.
