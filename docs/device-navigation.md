# Navegación de dispositivos en la app

Catálogo y Mis equipos conservan sus tarjetas, información y acciones. El menú añade la misma navegación de marcas/versiones de la web: Todos, iPhone y Samsung; al elegir marca aparece una fila horizontal de versiones sin cantidades.

Tocar una versión desplaza la lista hasta su encabezado. No filtra esa versión ni oculta las siguientes. Se revelan los elementos necesarios cuando el destino está después de Ver más. Si una búsqueda impide mostrar el destino, se limpian solo esos filtros; se conserva el proveedor/dueño y la opción de disponibles.

Desde 1.7.28, el menú permanece en su posición al inicio y desaparece de la vista al bajar. Después de desplazarse más de 500 px (o el 70% de la altura de pantalla) por debajo del menú, aparece un botón flotante circular con una flecha para volver a él. Desde 1.7.29 no muestra texto visible; conserva su nombre accesible «Subir al menú de dispositivos». Se oculta en otras secciones, al editar campos o con un diálogo abierto. Permite deslizar horizontalmente, admite teclado y ambos temas. Sus versiones corresponden al proveedor/dueño actual. Al cambiar de cuenta se descarta la selección; no se escriben modelos, stock, precios ni ventas.

La versión 1.7.31 no cambia reglas de Firebase. Se instala desde Ajustes → Aplicación → Actualizaciones.

Validación: navegación más allá de 60 filas, otros modelos presentes tras seleccionar una versión, recuperación de búsqueda, aislamiento por proveedor/cuenta, teclado, ocho combinaciones de ancho/tema, tarjetas idénticas al código anterior en estructura/dimensiones/estilos a 320/412/960 px y regresiones de inventario, orden y venta. El APK incluye el módulo nuevo y todos los scripts/estilos coinciden con los probados.

## Fluidez y controles integrados (1.7.30)

La vista principal muestra únicamente búsqueda, marcas y versiones, sin recuadro contenedor ni selector de orden. Los modelos conservan su orden numérico ascendente. La cabecera de inventario alinea los controles de espacio, avisos y ajustes. Las tarjetas se conservan en estructura, contenido, tamaño y estilo.

La flecha usa IntersectionObserver para detectar el umbral de aparición. No mide la posición del menú ni escribe su visibilidad continuamente durante el desplazamiento. En navegadores sin ese observador se calcula una posición de referencia al cambiar el diseño y se compara con scrollY. Tocar una versión ya renderizada desplaza directamente hasta ella, conservando los nodos de las tarjetas; solo se reconstruye la lista cuando es necesario revelar un destino o despejar filtros.

Prueba controlada en Chromium, 50 pasos de desplazamiento: las lecturas de geometría del menú bajaron de 150 a 0; las mutaciones de visibilidad de la flecha de 11 a 1. Tocar una versión visible pasó de 63 mutaciones de lista a 0. `tests/device-navigation-performance.cjs` verifica estas invariantes; `--fallback` comprueba también la ruta sin IntersectionObserver. Son mediciones del navegador de pruebas, no una garantía de FPS en todos los teléfonos.

## Cambio de proveedor (1.7.31)

Cambiar Todos/Samuel/Split o Saúl/Javier conserva los mismos botones y actualiza su estado. Las tarjetas que siguen visibles se reutilizan solo si su contenido y cuenta coinciden; cambiar un precio o registro invalida esa tarjeta. Un cambio de proveedor dentro del catálogo no repinta la navegación global ni vuelve a animar la cabecera. Los desplegables auxiliares anteriores no se construyen en segundo plano: las herramientas para añadir una alternativa se abren solo mediante esa acción del equipo.

`tests/provider-switch-performance.cjs` verifica botones persistentes, reutilización de tarjetas, precios actualizados, ausencia de reconstrucciones de cabecera/desplegables, ausencia de selectores de orden y datos de negocio intactos durante navegación.
