# Lunivo 1.7.4 · flujos y diseño más simples

Código 39. Inicio presenta Nueva venta como acción principal y dos accesos a inventario: Proveedores y Mis equipos. Inventario usa dos pestañas persistentes, con estado activo; se retiraron los accesos duplicados a las mismas pantallas. Se conservan las rutas existentes, datos y conexiones.

Las tarjetas de proveedores muestran Preparar con mi precio como acción principal. Usar en venta, Añadir alternativa y administrar existencias se agrupan en Más opciones. En Mis equipos, Vender es la acción principal; precio, organización y reposición se abren en Más opciones. Los menús son elementos details/summary nativos, con teclado y controles táctiles de al menos 44 px.

Preparar un equipo selecciona automáticamente dueño/modelo/variante cuando solo hay una opción disponible. Se conserva la elección explícita cuando hay varias, los costos separados por dueño y los precios ya guardados. Registrar equipo propio propone Lunivo al abrir desde el inventario global, conservando la posibilidad de cambiar el dueño.

Nueva venta usa un selector de origen en lugar de tres botones. Mis equipos incluye tanto unidades propias como opciones preparadas con precio; elegir una opción preparada carga su costo/precio y mantiene el cliente y otros datos del formulario. La venta se confirma como referencia del proveedor, con cantidad propia cero y sin deducir stock externo. Las unidades físicas mantienen su descuento transaccional. Los precios/costos actuales se verifican con el mismo flujo existente.

Registrar venta es la acción principal del formulario. Borrador y Limpiar están en Más opciones; el canal de venta es desplegable. Abrir estas opciones conserva el formulario y no escribe datos. El resumen prioriza garantía/comprobante y edición; costos, anulación y eliminación se agrupan en Detalles y opciones. Las confirmaciones y reglas financieras se conservan. Cambiar de pantalla de Ventas vuelve al principio de la nueva vista, evitando entrar a mitad del formulario; los filtros y actualizaciones de la misma ruta conservan su desplazamiento.

Diseño: jerarquía más clara, pestañas compactas, acciones secundarias discretas, tarjetas y formularios uniformes, ajustes en cuadrícula de dos columnas en móvil y espacios más compactos. Se conserva el logo específico del modo oscuro. Las optimizaciones de 1.7.3 y las búsquedas completas con bloques de 60 siguen activas.

Validación: 30 suites de interfaz, incluida una nueva de los recorridos simplificados, navegación por teclado, campos únicos automáticos, conservación del cliente al elegir equipo preparado, desplazamiento de navegación, menús sin mutación de datos y dos temas en 320/412/840/960. Se adaptan las pruebas anteriores para abrir las opciones secundarias por la interfaz real. Además: 69 pruebas Android release, 56 Node, 8 de reglas, transacciones compartidas y sincronización de Follows en Firestore Emulator. La prueba de dos sesiones confirma una venta eligiendo un equipo preparado desde Nueva venta y preservando el cliente.

APK público release y lint, misma firma existente, sin claves ni copia privada de proveedores. Esquema/reglas de Firebase conservados desde 1.7.1. Publicación en main y Release v1.7.4 con la rama lunivo-updates. Instalación y revisión en Samsung físico pendientes; la comprobación visual y de tamaños usa Chromium.
