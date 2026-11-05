# Lunivo 1.5.8-preview · Equipos propios, garantía guiada y modo oscuro

## Cambios

- Accesos visibles **Ver mis equipos** y **+ Agregar equipo** en Inicio de Ventas e Inventario. El alta directa abre el formulario y selecciona **Lunivo**. Esta nueva categoría de inventario propio queda fuera de los conteos y comparaciones de Samuel y Split. Los registros anteriores conservan sus dueños, identificadores, costos y cantidades; no hay reasignación ni migración destructiva.
- Garantías identifica los campos pendientes por nombre, muestra el error junto a cada campo y lleva al primero. La lista permite ir a otro dato pendiente. Los errores se retiran al editar; el resumen conserva los que quedan. Banco, meses, contacto, fecha e IMEI inválidos se pueden localizar; la sección de pago se abre al necesitarla. IMEI y contacto permanecen opcionales. Una validación fallida no guarda cambios ni consume correlativo.
- **Ajustes → Aplicación → Apariencia** ofrece Claro, Oscuro y Según el teléfono. Sigue los cambios del sistema solo en ese último modo. La selección es local al teléfono e independiente de la cuenta, se aplica antes de pintar el fondo y se conserva al reiniciar. Si no se puede guardar, se mantiene la selección anterior.
- Paleta azul noche con superficies diferenciadas, campos, tarjetas, inventarios, agenda, avisos, ayudas y selector de espacios adaptados. Se genera una variante clara del isotipo original para cabecera e inicio oscuro, en `assets/lunivo-mark-dark.png`.
- Android adapta fondo, barras y color de los iconos del sistema. La apariencia sobrevive al refresco de insets sin cubrir la hora, recrear el contenido ni modificar su geometría. El puente de apariencia solo admite mensajes del frame principal del origen de recursos empaquetados.
- Vista previa, impresión y exportación PDF conservan fondo blanco, logo original y contenido vectorial. No se cambian las reglas de Firebase ni se consultan de nuevo las fuentes reales para esta actualización; se conserva la copia inicial y su fecha de verificación.

## Pruebas

- **47 pruebas Node aprobadas**: incluyen identificación precisa de campos de garantía sin mutación y separación del inventario propio respecto de proveedores.
- **21 suites de interfaz aprobadas**. La nueva suite recorre alta propia → venta y descuento → garantía incompleta → corrección → exportación; comprueba que fallar no escribe datos ni consume correlativos, que el IMEI sigue opcional y que el PDF conserva los importes.
- Apariencia comprobada tras recarga, cambio de tema del sistema, selección manual y fallo de almacenamiento. Se verifica el logo alternativo cargado y contraste de la acción principal de al menos **4.5:1**.
- Sin desbordamiento en **320 × 740, 384 × 832, 412 × 915, 690 × 840, 840 × 920, 960 × 840 y 915 × 412**, en inventario, venta, ajustes, Follows y agenda. Capturas de modo oscuro en teléfono y pantalla desplegada.
- **42 pruebas unitarias Android release aprobadas**, incluida la nueva prueba de barras claras/oscuras y conservación del área segura tras refresco.
- Compilación release y Lint sin errores; se mantienen seis avisos `GradleDependency` de versiones posteriores disponibles. No se actualizan dependencias en este cambio.
- APK `com.crmcelulares.app`, versión **1.5.8-preview**, código **27**, con la firma de actualización anterior. Recursos web, logo y copia privada cotejados con los archivos empaquetados.

Las suites de interfaz usan Chromium con puentes simulados y las pruebas Android usan Robolectric. No se ejecutan pruebas instrumentadas ni se afirma prueba física en Samsung para esta entrega. Ventas, equipos propios y garantías continúan locales por cuenta y dispositivo; Follows conserva la sincronización existente.

APK SHA-256: `5085e7b6ad7325b804e876702822b6d2218ac372da4f1576caca6a48de42f720`.
