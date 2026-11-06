# Lunivo 1.7.2 · seleccionar equipos del proveedor

Código 37. Mis equipos → Elegir equipo del proveedor abre el selector directo. Dentro de Agregar equipo o lote propio también hay un acceso Seleccionar modelo del proveedor. Se elige proveedor, dueño, modelo y variante exacta del catálogo disponible en el teléfono; cada variante muestra características, costo y unidades disponibles. Split ofrece Saúl y Javier según los datos de su inventario; Samuel se selecciona automáticamente como dueño al elegir su proveedor. Los datos sin dueño se identifican como Sin dueño especificado.

Las opciones de modelo y variante dependen del proveedor y dueño elegidos. Los agotados se excluyen. Cambiar proveedor, dueño o modelo limpia la selección dependiente y el precio para evitar mezclar costos. Se usan las mismas filas y agrupación de modelos del catálogo, manteniendo las variantes separadas. Todos los controles se alimentan de la caché local: elegir opciones no genera lecturas adicionales de Firebase.

Después se escribe el precio final o se pulsa +$50/+$75/+$100. Los preparados existentes recuperan su precio y se actualizan sin duplicarse. Se mantiene la validación de disponibilidad/costo al guardar y vender, las transacciones compartidas de la cuenta y cantidad propia cero para estas referencias. Vender carga los datos y el precio preparados. Los accesos desde las tarjetas del proveedor abren el mismo selector con el equipo ya elegido.

Validación: suite nueva preparada con proveedores/dueños que comparten modelo y tienen diferentes costos, varias capacidades, agotados, cambio de dueño, precios manuales y aumentos, guardado repetido y venta precargada; claro/oscuro a 320/412/840/960. Las 28 suites de interfaz pasan. Compilación release pública y lint. La instalación física Samsung queda pendiente.

Se utilizan las reglas completas de 1.7.1 para los campos compartidos de precios preparados. Esta versión conserva el esquema y las claves de almacenamiento. Distribución v1.7.2 con la misma firma instalada, sin copia privada de proveedores, por el actualizador de GitHub.
