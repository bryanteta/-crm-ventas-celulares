# Lunivo 1.7.11 · orden por modelo a elección

Código 46. El inventario de proveedores abre por modelo de menor a mayor. Un selector visible permite invertirlo a mayor a menor sin abrir Más opciones. La comparación numérica ordena iPhone 8, 11 y 16 y Galaxy S9, S10 y S24 por generación, independientemente del precio. El mismo selector se ofrece en Mis equipos; se conserva su alternativa de marca y modelo.

El orden elegido se conserva al filtrar proveedores, dueños y familias. Quitar filtros o cambiar cuenta restablece el orden ascendente en Proveedores; cambiar cuenta también lo restablece en Mis equipos. No se modifica almacenamiento de inventario, precios, existencias ni ventas. El catálogo web público no cambia.

Validación: 74 pruebas Node; interfaz de orden numérico ascendente/descendente, proveedores/dueños/familias y Mis equipos, controles visibles y ausencia de desbordamiento a 320/412/840 px. Pruebas existentes de precios visibles y coincidencia con Vender, organización de proveedores y dueños. Compilación pública Android y lintRelease aprobados. Firma conservada y ausencia del bootstrap privado verificadas. Sin prueba física Samsung.

Distribución: main y actualización v1.7.11 mediante lunivo-updates.
