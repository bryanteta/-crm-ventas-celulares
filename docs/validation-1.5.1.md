# Lunivo 1.5.1-preview · Inventarios por proveedor

## Comportamiento

- Inicio, Inventario y Comparar ofrecen accesos a Split y TecnoShop.
- Split muestra exclusivamente la unión de los lotes de Samuel y Javier, con filtros Combinado, Samuel y Javier. Las URLs individuales se conservan al recargar. Los lotes permanecen separados para vender y devolver al dueño correcto.
- TecnoShop abre el catálogo del proveedor del PDF de referencia del 02/11/2026. El primer acceso carga sus 37 variantes/143 unidades declaradas, sin duplicar registros y sin ocultar o eliminar cotizaciones de otros proveedores. No es consulta de disponibilidad en vivo ni una integración REST nueva.
- Global conserva los equipos registrados de Saúl y los lotes sin asignar. No hay migraciones, reclasificaciones ni cambios de permisos de usuario.
- Cada opción de navegación tiene icono propio: casa, caja, agregar, comparar y comprobante.

## Verificación

Se ejecutan el núcleo Node (35 pruebas), las unitarias Android release con Robolectric (35), Android Lint y las 17 suites de interfaz. La prueba nueva de proveedores verifica ambos accesos, catálogo filtrado, combinado/individuales, historial de rutas y recarga, iconos distintos, venta/anulación en el lote correcto, conservación de otras existencias/cotizaciones y fallo de almacenamiento durante la carga del catálogo. Incluye seis anchos de pantalla.

Las pruebas de PDF y la retirada de comisiones siguen incluidas en la regresión web. El generador nativo de PDF no cambió; las cuatro pruebas instrumentadas de esa función se ejecutaron en la entrega 1.5.0 y no se cuentan como nuevamente ejecutadas aquí. No se afirma prueba en Samsung físico.

El paquete sigue siendo com.crmcelulares.app, versión 1.5.1-preview/código 20. La configuración local de Firebase y las claves de firma permanecen fuera de Git. No se publican reglas ni cambios en Firebase de producción. Inventarios y ventas continúan locales por cuenta/dispositivo.
