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

El panel muestra cada registro disponible del inventario, sin ocultar variantes que comparten un ajuste. El resumen distingue unidades, variantes y modelos. La lista ordena iPhone por generación (incluido XR), seguido de Samsung. Busca por modelo, capacidad, color o proveedor, o usa los filtros de marca y proveedor. En móvil, selecciona una variante para abrir el editor y vuelve a la lista con «Volver a dispositivos». Al entrar o recargar se consulta el inventario actualizado, respetando el intervalo compartido de cinco minutos; si el proveedor falla, se conserva y se identifica la última lista guardada. El precio editable es el precio final **al contado**, en USD; el regular y las cuotas mantienen la regla existente. Los equipos con las mismas características y proveedor comparten el ajuste; no se modifican cantidades ni las APIs originales.

Pega hasta ocho enlaces públicos HTTPS, uno por línea. Deben abrir directamente una imagen, no una página con un botón de descarga. La primera será la principal. «Comprobar fotos» muestra las vistas antes de guardar. Los enlaces privados de Drive o enlaces que vencen pueden dejar de funcionar para los visitantes.

Vaciar el precio devuelve el precio automático. Vaciar los enlaces devuelve las fotos automáticas. «Restaurar automático» restaura ambos. Una edición guardada permanece aunque el proveedor actualice precios o existencias; no vuelve a publicar equipos que ya no están disponibles. La web aplica cambios al recargar o en su siguiente consulta visible, sin cambiar un detalle de compra que ya esté abierto.

## Persistencia y controles

Los ajustes se almacenan en el Durable Object SQLite que ya usa el Worker, con claves independientes del ID de fila, precio y cantidad del proveedor. El catálogo automático queda intacto. La identidad distingue modelo, capacidad, color, condición, categoría, batería, observaciones y proveedor. No escribe en la app ni en Firestore.

Los clientes actuales comparan el ajuste de cada equipo: dos administradores pueden editar equipos distintos sin conflicto. Si cambió el mismo ajuste, el panel ofrece «Recargar y conservar mis cambios» para revisarlo antes de volver a guardar. Los clientes antiguos conservan la protección por revisión global. Una reasignación actual compara ambos ajustes; los clientes anteriores comprueban la revisión global porque modifican dos claves; borrar un ajuste inexistente no genera una revisión nueva. Cada operación valida token, origen, equipo, precio, URLs, dimensiones y tamaño; el precio puede estar entre $1 y $100,000, con hasta ocho fotos. El servidor no descarga URLs de imágenes arbitrarias. Los fallos de almacenamiento no se anuncian como guardados.

`/customizations.json` contiene únicamente los precios y metadatos públicos de fotos, nunca credenciales. Si el Worker responde con datos válidos, su estado es autoritativo aunque su revisión se haya reiniciado. La copia estática se usa como respaldo antes de recibir datos en vivo; tras recibirlos, un fallo conserva la última respuesta en vivo. La sincronización de GitHub sigue la misma regla. La respuesta pública se puede guardar en caché durante 30 segundos; las rutas de administración nunca se guardan en caché. GitHub sincroniza una copia pública validada junto al inventario; esa copia alimenta las páginas de modelos y las vistas previas de compartir. Esas vistas estáticas se actualizan en la siguiente publicación automática; los servicios como WhatsApp pueden conservar su propia caché.

`GET /admin/catalog`, `PUT /admin/customizations` y `DELETE /admin/customizations` requieren la clave. Solo se aceptan orígenes Lunivo; el origen de desarrollo se habilita explícitamente en pruebas. El panel tiene `noindex` y una política de contenido que limita scripts y conexiones. Esto complementa, y no sustituye, la autorización en el servidor.

Pruebas: validación compartida de precios/enlaces e identidad, permisos del Worker, conflictos de revisión y fallos de escritura, reinicio real de SQLite con Miniflare, y flujo completo de navegador con login, fotos, guardado, catálogo, conflicto, recarga, restauración y cierre de sesión en móvil y computadora.

## Revisar cambios del proveedor

La identidad conserva proveedor, condición, batería y observaciones para evitar aplicar un precio o unas fotos al equipo equivocado. Un cambio de precio, cantidad o ID mantiene el ajuste. Un cambio de características o del conjunto de proveedores deja el ajuste guardado en «Ajustes sin coincidencia disponible»; no se aplica automáticamente a una variante diferente. Allí se puede elegir una variante de destino y confirmar la reasignación, o eliminar el ajuste. Los ajustes anteriores sin contexto guardado se identifican por su clave abreviada. No hay borrado automático por antigüedad: un equipo agotado puede volver al inventario.

Al guardar se conserva, solo para administración, el equipo y su rango de precios automáticos de referencia. El listado y el editor avisan si el precio automático cambió o si el precio manual está por debajo del automático. El aviso no representa el costo del proveedor ni modifica por sí solo el precio elegido.

El límite es de 1000 ajustes y 1 MiB de almacenamiento. Si se alcanza, el servidor devuelve HTTP 413 con instrucciones para eliminar ajustes sin equipo disponible o reducir las fotos. Se puede eliminar un ajuste y volver a guardar sin perder los demás. Las fotos externas se cargan sin enviar el referente tanto en el panel como en tarjetas, galería, zoom y páginas estáticas.

## Respaldos y restauración

En Administración → «Respaldos», **Descargar respaldo completo** guarda precios, fotos, contexto compacto y fechas en un JSON local, sin la clave. Conserva ese archivo en un lugar privado. **Restaurar archivo JSON** muestra el nombre, el total de ajustes, cuántos son nuevos, cuántos actuales se sustituirán, cuántos actuales son más recientes y cuántos carecen de fechas comparables antes de pedir confirmación; acepta ese formato completo y también el JSON público del repositorio. Sustituye los ajustes coincidentes y conserva los demás. Una revisión protege la restauración frente a cambios concurrentes. Los ajustes que no coincidan con el inventario quedan disponibles para revisar o reasignar; restaurar un precio no vuelve a crear existencias.

`GET /admin/backup` y `PUT /admin/import` requieren autenticación y no usan caché. Los archivos pueden tener hasta 4 MiB para admitir JSON con formato; el estado guardado sigue limitado a 1 MiB. La importación valida precios, fotos, contexto, claves y tamaño antes de guardar una única transacción; no importa la revisión antigua como revisión actual. El contexto no se publica en `/customizations.json`. Se guardan únicamente los campos que identifican la variante, su rango automático de referencia y la fecha; cantidades, IDs y fechas de llegada no ocupan el respaldo administrativo.

Al reducir la cantidad de ajustes o detectar un reinicio, la sincronización archiva la versión anterior no vacía en `backups/catalog-customizations/`, fuera del sitio publicado. Los archivos se identifican por revisión y hash y no se sobrescriben. Se conservan hasta 30 copias automáticas, incluida la que se esté archivando; las versiones anteriores y las ediciones normales permanecen en el historial de Git. Solo incluyen precios y fotos públicos; el contexto privado se conserva en el respaldo completo que se descarga desde Administración.

Solo un retroceso de revisión o fecha conserva el archivo público anterior y genera una advertencia en Actions. Los borrados intencionales con una revisión nueva, incluido restaurar el último ajuste a automático, se sincronizan sin una confirmación adicional; las páginas de modelos y de compartir reciben esa misma copia. Para confirmar un reinicio real: GitHub → Actions → «Actualizar inventario público de Lunivo» → Run workflow → activar `allow_customization_reset`. El respaldo anterior se archiva también en esa ejecución. Si el servicio sigue disponible, la web mantiene su prioridad sobre la copia estática. Para recuperar un archivo archivado, descárgalo del repositorio y restáuralo desde el panel con tu clave.

Las alertas y el rango de precio automático consideran **todos** los registros con la misma clave, aunque se haya elegido la fila más barata. Las reasignaciones nuevas comparan origen y destino por separado para permitir cambios ajenos sin sobrescribir un ajuste concurrente. Los clientes anteriores siguen usando la revisión global.

El acceso tiene una protección básica en memoria por IP: diez intentos fallidos en cinco minutos, con respuesta 429 y `Retry-After` para claves incorrectas. Una clave válida permite entrar y limpia los fallos de esa IP, incluso en redes compartidas; se limita también la cantidad de IP registradas. No guarda claves ni IP en SQLite y se reinicia con la instancia del Worker. Una regla adicional de Cloudflare puede reforzarlo si se necesita una protección persistente en el perímetro.

## Precios de la web desde la app Android

La app y la web usan los **mismos** precios: el Worker del catálogo es la única fuente. No hay una segunda copia que sincronizar ni conflictos entre bases distintas.

- **Web → app:** la app lee `/customizations.json` (público, sin clave) al abrir Ventas, Inventario o Ajustes, como máximo una vez por minuto y al volver a primer plano. Un equipo con precio web personalizado muestra **Venta web** en su tarjeta, y **Usar en venta** sugiere ese precio. El costo del proveedor no cambia y el precio de la venta se puede seguir editando. Sin ajuste, la venta sigue sugiriéndose con costo + $80, que es el mismo precio automático de la web.
- **App → web:** en Ajustes → Inventarios → *Precios de la web* se guarda una vez por teléfono y cuenta la misma `CATALOG_ADMIN_TOKEN`. Se verifica con el Worker (`GET /admin/session`) antes de guardarla y queda cifrada con Android Keystore, separada de la clave de Split. La WebView nunca la conserva. Después, cada tarjeta de proveedor tiene un desplegable **Precio web** para guardar un precio o volver al automático. Usa `PUT`/`DELETE /admin/customizations` con la misma validación, límite de intentos y protección contra cambios concurrentes que el panel web.
- **Solo precio:** la app no edita fotos. Si el equipo tiene fotos guardadas en la web, se conservan al cambiar o restaurar el precio desde la app.
- **Mismo equipo, misma clave:** la app agrupa las filas de Samuel y Split con el mismo código que publica el catálogo (`catalog-identity.js`, compartido con `scripts/catalog-core.cjs` y el Worker). Calcula así el mismo ID de producto y la misma clave de ajuste. Una fila que el catálogo no puede publicar (modelo o color desconocido) muestra el precio automático y no se puede editar.
- **Conflictos:** si alguien cambió ese precio en la web después de que la app lo cargó, la app no lo sobrescribe: muestra el aviso y carga el precio actual. Si la clave fue rotada en Cloudflare, la app lo indica y pide guardarla de nuevo.
- **Sin puente Android** (vista previa en navegador) no se muestran ni se consultan precios web.

Activación: desplegar el Worker con el endpoint `/admin/session` e instalar la nueva versión de la app. Pruebas: `tests/catalog-identity.test.cjs` (misma identidad que el catálogo público), `workers/catalog/admin.test.mjs` (sesión), `tests/web-prices-ui.cjs` (app ↔ Worker real en ambos sentidos), `CatalogHttpTest` e `InventoryBridgeCatalogTest` (Android).
