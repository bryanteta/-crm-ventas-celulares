# Lunivo 1.6.4 · modal Editar venta

Se reemplaza el desplazamiento de todo el diálogo con botones superpuestos por tres áreas independientes: encabezado, cuerpo desplazable y acciones. El encabezado y los botones ocupan espacio propio y no cubren controles. Guardar conserva su asociación explícita con el formulario mediante `form="sale-edit-form"`, y Cancelar sigue accesible cuando una solicitud compartida bloquea los campos. Guardar se mantiene bloqueado durante solicitudes pendientes y vuelve a aplicar ese estado tras un error. Al abrir se reinicia el desplazamiento; los errores lógicos de guardado se desplazan a la vista.

La regresión comprueba las coordenadas de cliente, modelo y precio después de desplazarlos al centro: deben quedar entre el encabezado y el pie, sin solaparse. Se prueba en claro/oscuro, seis anchos de 320 a 960 px y horizontal de 412 px de alto. Se mantienen las comprobaciones de alta/edición, cantidad y stock, precio, accesorios, pago, autor y correlativo, falta de stock, almacenamiento lleno, conflicto de versión, anulación y cambio de cuenta. Pasan además las suites de ajustes y apariencia/garantía, las 56 pruebas Node y la integración de negocio con el motor Java de producción y dos clientes contra Firestore local.

Release, APK instrumentado y lint compilados, sin errores; se mantienen los seis avisos de actualización de dependencias. El motor financiero nativo y las reglas no cambian. Recursos finales y firma de actualización cotejados con el APK. No se publica ni se hace push.

Las pruebas de interfaz simulan el puente Android. Sigue pendiente la comprobación física con teclado y plegado en Samsung; el emulador Android del entorno no dispone de servicios utilizables. Instalar sobre la app existente sin desinstalar. Usar las mismas reglas completas de 1.6.2, sin cambios adicionales en Firebase.

APK SHA-256: `4d9cc50d89be569af8f2c1dd7e3be1d433c6e8ad5fe34c51520ea3a5e3c5ffb3`.
