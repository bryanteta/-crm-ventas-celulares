# Lunivo Suite 1.6.1 · garantías e impresión local

Android `com.crmcelulares.app`, código 30. APK privado preparado localmente, sin publicación, despliegue de Firebase ni push al repositorio.

## Corrección y alcance

El reporte fue que una garantía de un usuario se imprimió en otro teléfono mientras se realizaba otra operación. No se reprodujo una orden de impresión originada por Firestore. Se encontró que la preparación asíncrona del documento en Android podía seguir activa al abandonar la garantía; su callback de carga no comprobaba la pantalla original.

La impresión y el guardado de PDF ahora exigen un toque real en el botón de la garantía visible en ese teléfono. Se comprueba que la vista previa siga correspondiendo al registro y se envía esa misma instantánea. La autorización local no se persiste ni sincroniza. Cambiar de comprobante, cuenta o pantalla, abrir un diálogo, editar o pasar a segundo plano invalida la preparación. Android destruye la vista que todavía estaba preparando el documento y rechaza un callback tardío, incluso si después se vuelve a la misma garantía. Un trabajo ya abierto por una acción explícita del usuario conserva el documento que solicitó.

El selector de archivos de Android mantiene la exportación solicitada al pausar la actividad. Los mensajes de resultado incluyen el ID de la solicitud y solo se muestran en la garantía correspondiente. La sincronización, la recarga y los clics programáticos no abren la impresión ni el selector.

## Desplegables

Marca, capacidad, color, batería, estado físico y banco cuentan con selector nativo junto al campo. Se puede escoger un valor frecuente o escribir uno propio. No se agregan datos por defecto para completar campos pendientes. Banco queda disponible tanto al registrar la venta como al preparar la garantía. Se conservan el método de pago, canal y estado comercial como desplegables; los estados comerciales históricos que no estén en la lista se mantienen al cargar y guardar. El IMEI sigue manual y opcional.

Se revisan controles táctiles de al menos 44 px, temas claro/oscuro y seis anchos entre 320 y 960 px. Los textos e importes de la venta, accesorios, vendedor, correlativo y condiciones de garantía no se recalculan por estos cambios.

## Comprobaciones

- 50 pruebas de lógica y almacenamiento Node.
- 24 suites de interfaz, incluida una nueva para pulsaciones locales, contextos, mensajes atrasados, selector de archivos, desplegables, valores personalizados e históricos, recarga y tamaños de pantalla.
- 57 pruebas unitarias Android release. Incluyen autorización local, salida y regreso a la misma garantía, pausa, contexto inválido, exportación rechazada desde otra pantalla y el callback real de carga de una vista cancelada.
- Integración de negocio contra el emulador oficial de Firestore, usando el motor Java de producción: ventas, existencias, correlativos, reintentos y garantías. Dos clientes simulan que un teléfono imprime/exporta mientras el otro prepara una venta: el segundo conserva su formulario y no recibe ninguna orden de impresión ni exportación. También se contrastan los datos de la garantía recibida con el documento enviado a PDF.
- Compilación release, APK de pruebas instrumentadas y lint sin errores; se conservan seis avisos de actualización de dependencias.
- Recursos web y copia privada de proveedores cotejados con el APK; misma identidad de firma para actualizar sin desinstalar. No se descarga una nueva lista de proveedores en esta entrega.

## Instalación y límites

Actualizar todos los teléfonos vinculados sobre la instalación existente, sin desinstalar ni borrar datos. Esta entrega usa las mismas reglas completas de Firestore de 1.6.0; no agrega colecciones ni requiere otra migración. Si aún no se activó Ventas compartidas, siguen aplicando los pasos de activación del informe 1.6.0.

Las pruebas de interfaz usan puentes simulados y las nativas usan Robolectric; las instrumentadas se compilan. El emulador Android disponible no tiene servicios del sistema utilizables, por lo que queda pendiente comprobar el selector y la impresión real en los teléfonos Samsung. La prevención se valida con eventos remotos simulados, dos clientes y callbacks nativos retrasados; no se atribuye una causa física confirmada al incidente del teléfono del usuario.

APK SHA-256: `fa402f5c591b3ef6944b245401d1ebb6d2023ab9d5cb82c44196b07bc36f8277`.
