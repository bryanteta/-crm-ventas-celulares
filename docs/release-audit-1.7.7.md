# Lunivo 1.7.7 · precio de venta visible en inventario

Código 42. Las tarjetas de Proveedores y Mis equipos muestran Venta sugerida como importe principal, calculado con costo + $80 por unidad. Debajo se ven el costo y el aumento, incluso con la tarjeta cerrada. Se aplica a inventario global, Samuel, Split y filtros por dueño. El orden por precio sigue siendo válido al sumar el mismo aumento a todos los costos.

Al abrir una tarjeta se detalla el costo y el precio sugerido. Los precios personalizados existentes de Mis equipos se presentan como Mi precio guardado; siguen disponibles como elección explícita al vender. Para equipos preparados se utiliza la última cotización disponible en el teléfono cuando existe, manteniendo el costo registrado como referencia si no hay cotización local. El guardado y la disponibilidad conservan las comprobaciones existentes. Consultar el inventario no reescribe precios, costos, existencias ni ventas.

La sugerencia usa la misma función de centavos en Inventario y Nueva venta para evitar diferencias. La tipografía y la línea de costo conservan tarjetas de hasta 100 px en los tamaños probados, con contraste en ambos temas.

Validación: suite nueva para coincidencia inventario→Vender, costos actualizados y cotización por proveedor/dueño, preservación de datos y cuatro tamaños en claro/oscuro. Diez suites relacionadas de inventario, proveedores, preparación de precios, aumento de $80, flujos y rendimiento; 56 pruebas Node; transacciones compartidas con dos sesiones y el motor Java en Firestore Emulator. Compilación pública release y lint. Se revisó la captura de las tarjetas. Comprobación física Samsung pendiente.

Distribución main + Release estable v1.7.7 mediante lunivo-updates, firma conservada y APK sin copia privada ni claves de proveedores. Las reglas y el esquema de Firebase permanecen como en 1.7.1.
