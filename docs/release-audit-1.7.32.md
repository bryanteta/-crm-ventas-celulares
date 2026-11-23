# Lunivo 1.7.32 · Garantía centrada al ajustar a una página

El PDF nativo reducía documentos largos desde el margen izquierdo. El detalle de pago dividido podía aumentar la altura y hacer visible un margen derecho mayor. Ahora el ajuste se realiza respecto al centro horizontal de la hoja A4 y mantiene el margen superior.

No cambian los importes, bancos, cuotas, abonos, total, accesorios ni datos guardados. Se conserva el ajuste completo a una página.

Validación: prueba de rasterización de la transformación de impresión con cuatro escalas (100%, 85%, 50% y 25%) y márgenes simétricos; pruebas unitarias Android; flujo de abono/transferencia, bancos separados y PDF HTML de una página con accesorios y cortesías. Se incorpora además una prueba instrumentada del PDF real con pago dividido y documento largo. Esta última se compila, pero no se ejecutó: el emulador de este entorno no completó el arranque sin aceleración de hardware. Falta comprobar la instalación y el PDF en un teléfono físico.

APK público con la misma identidad de firma, sin copia privada de proveedores. No requiere cambios de Firebase.
