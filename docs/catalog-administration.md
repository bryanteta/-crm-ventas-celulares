# Administración de precios e imágenes de la web

Entrada: https://lunivosv.com/admin.html o enlace «Administración» al final del catálogo. El panel requiere una clave privada; publicarlo no habilita ediciones hasta configurar esa clave en el Worker.

## Activar el acceso una sola vez

En Cloudflare → Workers & Pages → `lunivo-inventory` → Settings → Variables and Secrets → Add:

- Tipo: **Secret**.
- Nombre: **CATALOG_ADMIN_TOKEN**.
- Valor: una clave aleatoria de al menos 32 caracteres; se recomienda una cadena aleatoria de 64 caracteres.
- Guardar con **Deploy / Save and Deploy** en las variables de ejecución, no en Settings → Builds.

Es una clave nueva de administración. No sustituye `SPLIT_INVENTORY_TOKEN`. No debe subirse al repositorio ni pegarse en enlaces o mensajes. Introduce esa misma clave en el panel. Para revocar accesos, rótala en Cloudflare; no afecta al proveedor ni borra los ajustes guardados.

La clave se envía únicamente por HTTPS en el encabezado Authorization. No se guarda en localStorage, sessionStorage, cookies ni URLs; al recargar la administración hay que entrar de nuevo. Si no está configurada, el servicio rechaza el acceso. No se permite crear una clave desde una página pública.

## Usar el editor

Busca por modelo, capacidad, color o proveedor y selecciona una variante. El precio editable es el precio final **al contado**, en USD; el regular y las cuotas mantienen la regla existente. Los equipos con las mismas características y proveedor comparten el ajuste; no se modifican cantidades ni las APIs originales.

Pega hasta ocho enlaces públicos HTTPS, uno por línea. Deben abrir directamente una imagen, no una página con un botón de descarga. La primera será la principal. «Comprobar fotos» muestra las vistas antes de guardar. Los enlaces privados de Drive o enlaces que vencen pueden dejar de funcionar para los visitantes.

Vaciar el precio devuelve el precio automático. Vaciar los enlaces devuelve las fotos automáticas. «Restaurar automático» restaura ambos. Una edición guardada permanece aunque el proveedor actualice precios o existencias; no vuelve a publicar equipos que ya no están disponibles. La web aplica cambios al recargar o en su siguiente consulta visible, sin cambiar un detalle de compra que ya esté abierto.

## Persistencia y controles

Los ajustes se almacenan en el Durable Object SQLite que ya usa el Worker, con claves independientes del ID de fila, precio y cantidad del proveedor. El catálogo automático queda intacto. La identidad distingue modelo, capacidad, color, condición, categoría, batería, observaciones y proveedor. No escribe en la app ni en Firestore.

Las escrituras usan una revisión global: si dos editores trabajan sobre versiones distintas, el segundo debe recargar antes de guardar. Cada operación valida token, origen, equipo, precio, URLs, dimensiones y tamaño; el precio puede estar entre $1 y $100,000, con hasta ocho fotos. El servidor no descarga URLs de imágenes arbitrarias. Los fallos de almacenamiento no se anuncian como guardados.

`/customizations.json` contiene únicamente los precios y metadatos públicos de fotos, nunca credenciales. El navegador usa la revisión válida más reciente y conserva la última si hay un fallo temporal. GitHub sincroniza una copia pública validada junto al inventario; esa copia alimenta las páginas de modelos y las vistas previas de compartir. Esas vistas estáticas se actualizan en la siguiente publicación automática; los servicios como WhatsApp pueden conservar su propia caché.

`GET /admin/catalog`, `PUT /admin/customizations` y `DELETE /admin/customizations` requieren la clave. Solo se aceptan orígenes Lunivo; el origen de desarrollo se habilita explícitamente en pruebas. El panel tiene `noindex` y una política de contenido que limita scripts y conexiones. Esto complementa, y no sustituye, la autorización en el servidor.

Pruebas: validación compartida de precios/enlaces e identidad, permisos del Worker, conflictos de revisión y fallos de escritura, reinicio real de SQLite con Miniflare, y flujo completo de navegador con login, fotos, guardado, catálogo, conflicto, recarga, restauración y cierre de sesión en móvil y computadora.
