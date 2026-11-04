# Lunivo 1.5.3-preview · Proveedores juntos

## Comportamiento

- Proveedores reúne las cotizaciones de TecnoShop y los lotes de Split en la misma pantalla. Inicio e Inventario ofrecen un único acceso a Proveedores. La navegación mantiene iconos diferentes.
- Todos permite comparar proveedores; Split y TecnoShop filtran la misma lista. Split conserva Combinado, Samuel y Javier con el dueño en cada tarjeta.
- Búsqueda común, selector de modelo y orden por menor importe o modelo. La búsqueda reconoce capacidades como 128 GB/128GB. Más filtros permite variante exacta y solo disponibles. La agrupación por modelo es para consultar: no afirma equivalencia de capacidad, estado, batería o accesorios. Cada variante conserva sus detalles.
- Split muestra el costo registrado; TecnoShop muestra el precio de su cotización. No se inventa un precio de venta ni se suman las existencias de proveedores.
- Los lotes de Split se proyectan en la lista para consultar; no se guardan copias en ofertas. Usar en venta mantiene el identificador del lote y su dueño. La confirmación descuenta existencias del lote correcto; anular devuelve esas unidades una sola vez.
- Elegir TecnoShop prepara una venta de proveedor sin descontar inventario registrado. Cambiar entre orígenes limpia la selección anterior y actualiza el proveedor.
- Todos conserva cotizaciones manuales de otros proveedores. El catálogo integrado de TecnoShop se carga si falta al abrir Todos/TecnoShop, una vez por cuenta, sin duplicar sus filas. Sigue siendo la lista PDF del 02/11/2026, sin consulta en vivo ni importación de nuevos PDFs.
- Inventario registrado mantiene la administración y los enlaces anteriores de Split, Global, Saúl y los equipos sin asignar. No hay migración del almacenamiento ni cambios en permisos o reglas Firebase.

## Validación

- Núcleo Node: **35 pruebas aprobadas**.
- Interfaz: **18 suites aprobadas**. Después de reforzar la limpieza de opciones de modelos al cambiar de cuenta se repiten las suites de proveedores e integridad, ambas aprobadas.
- Proveedores: acceso único, lista compartida y filtros, mismo modelo en ambas fuentes, precios ordenados, dueños Samuel/Javier, agotados deshabilitados, rutas y recarga, ventas y devolución al lote correcto, existencias de TecnoShop separadas, cotizaciones ajenas conservadas, almacenamiento lleno sin importación parcial y cambio a cuenta dañada sin mostrar modelos privados de la anterior.
- Se revisa desbordamiento en anchos de **320, 384, 412, 690, 840 y 960 px**. Las tarjetas conservan el formato compacto. Las capturas usan datos ficticios.
- Android release: **35 pruebas Robolectric aprobadas**, compilación correcta y **Lint sin incidencias**.
- APK: integridad ZIP, archivos web coincidentes con las fuentes y firma válida idéntica a 1.5.2. Se conserva `com.crmcelulares.app`; versión **1.5.3-preview**, código **22**.

No se realizaron pruebas en Samsung físico ni se repitieron pruebas instrumentadas del PDF nativo en esta entrega. Ventas, inventario, cotizaciones y garantías siguen locales por cuenta/dispositivo; la sincronización de Follows conserva su comportamiento. Las claves y configuración local de Firebase permanecen fuera de Git.

APK SHA-256: `baefec1c6277239e812c2419a7cbabf779a78cba3ae21ed9eab9083c39d47165`.
