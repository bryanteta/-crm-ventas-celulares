# Lunivo 1.6.3 · revisión de Ventas y Editar venta

Paquete Android `com.crmcelulares.app`, código 32. Preparado localmente, sin push ni despliegue.

Correcciones verificadas:

- Nombres de cliente y modelos largos se ajustan en las tarjetas y el resumen sin desplazar importes ni desbordar la pantalla.
- El editor conserva visibles el encabezado y las acciones de guardar/cancelar al desplazarse. Los desplegables tienen área táctil de al menos 44 px y los controles se limitan al ancho disponible. Se corrigen los indicadores de secciones en oscuro.
- Cambiar a otro ID de venta cierra y limpia el editor anterior. Antes solo se comprobaba la ruta general del resumen y podía quedar abierto un registro distinto del visible.
- Un error tardío de guardado no modifica el editor después de cerrarlo o cambiar de cuenta.
- Agregar un accesorio lleva el foco al nombre del nuevo accesorio, en lugar de un importe de otra fila.

Validación: 61 pruebas unitarias Android release aprobadas; 56 pruebas Node, 25 suites de interfaz y transacciones contra Firestore local con el motor Java de producción y dos clientes. Se comprueban precio/cantidad, accesorios, pago, existencias insuficientes, anulación, fallos de almacenamiento, versiones obsoletas, autor y correlativo, garantía fechada desde la venta y ausencia de impresión remota. Se amplía la regresión con cambios de ID y textos de 100/200 caracteres en claro/oscuro y seis anchos. Se cotejan los recursos del APK con los archivos finales y se verifica la firma de actualización. El motor financiero nativo y las reglas no cambian respecto a 1.6.2.

Las pruebas instrumentadas se compilan; la impresión y las barras del sistema siguen pendientes de comprobación física en Samsung porque el emulador Android disponible no ofrece servicios utilizables. Las pruebas de navegador simulan el puente Android. No se afirma ausencia total de errores fuera de estos casos.

Instalar sobre la versión existente sin desinstalar. Se utilizan las reglas completas de 1.6.2; no hace falta publicarlas otra vez si ya se actualizaron.

APK SHA-256: `11f6ec96aecaea830247b7b67e776081c4505ee9ac55b886d48a46496438b110`.
