# Lunivo 1.7.8 · inventario con precio simplificado

Código 43. El inventario global, Samuel, Split y Mis equipos muestran «Precio» y el importe de venta. Se quitaron los textos de costo del proveedor, venta sugerida y aumento de $80 de las tarjetas, sus detalles y los encabezados. El diálogo para organizar equipos también muestra el precio de venta en su resumen.

El cálculo del precio conserva el aumento predeterminado existente; no se modifican costos internos, precios personalizados guardados, cantidades, ventas ni reglas de Firebase. Se mantiene la elección de precios personalizados en el flujo de venta.

Validación: 74 pruebas Node aprobadas; pruebas de precios visibles y coincidencia con Vender, cotización actualizada, datos intactos, tarjetas compactas, navegación/teclado, agotados y aumento predeterminado. Diseño probado en claro/oscuro y hasta seis anchos. Compilación Android pública y lintRelease aprobados. APK verificado con la misma firma y sin el bootstrap privado de proveedores. Revisión visual en Chromium; no se realizó prueba física en Samsung.

Distribución: main y actualización v1.7.8 mediante la rama lunivo-updates, conservando las versiones anteriores.
