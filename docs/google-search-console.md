# Guía para indexar Lunivo en Google

Sitio principal: https://lunivosv.com/

## La página actual se conserva

Se han añadido archivos y páginas independientes. No se cambiaron la portada, su HTML, sus textos, su título, el diseño, los menús, las tarjetas, los filtros, las galerías, los botones, los enlaces de WhatsApp ni el código de actualización del inventario. Tampoco se añadió un enlace de navegación a estas páginas en la portada.

Las páginas nuevas por modelo quedan en `/modelos/`. Google puede descubrirlas a través del sitemap, y los visitantes que lleguen desde una búsqueda pueden consultar ahí los modelos y volver al catálogo actual. Son páginas públicas normales: muestran el mismo contenido tanto a personas como a Google y no sustituyen la página principal.

## Qué quedó preparado

- **https://lunivosv.com/robots.txt**: permite rastrear las páginas, imágenes, JavaScript y CSS, e indica la ubicación del sitemap.
- **https://lunivosv.com/sitemap.xml**: lista la portada, el directorio de modelos y las páginas por modelo disponibles.
- **https://lunivosv.com/modelos/**: directorio independiente de iPhone y Samsung.
- Páginas como **https://lunivosv.com/modelos/iphone-11/**: fotos, capacidades, colores, estado y precios visibles sin depender de JavaScript ni abrir el modal.
- Las páginas nuevas incluyen título, descripción, idioma `es-SV`, URL canónica y datos estructurados de organización, navegación y productos. Los metadatos existentes de la portada se conservaron.
- Las páginas y el sitemap se regeneran al publicar el inventario. La URL de cada modelo se conserva aunque cambie un precio o una variante.
- Los enlaces existentes `/equipo/.../` para compartir por WhatsApp conservan su funcionamiento y sus metadatos; no se incluyen como páginas independientes en el sitemap.

## 1. Añadir la propiedad en Search Console

1. Entra a https://search.google.com/search-console/ con la cuenta de Google que administrará Lunivo.
2. Elige **Añadir propiedad**.
3. Selecciona **Dominio**.
4. Escribe **lunivosv.com**, sin `https://`, `www` ni carpetas.
5. Pulsa **Continuar**.
6. Copia el registro TXT que te muestra Google. Su formato será `google-site-verification=...`; usa el valor exacto que te dé tu cuenta.

Si ya tienes esta propiedad verificada en tu cuenta, continúa con el paso 3.

## 2. Verificar el dominio con un TXT en Namecheap

En la revisión de DNS, el dominio utiliza `dns1.registrar-servers.com` y `dns2.registrar-servers.com`, de Namecheap. Tener el inventario en Cloudflare Workers no cambia por sí solo dónde se administran los DNS del dominio.

1. Entra a **Namecheap → Domain List**.
2. Junto a **lunivosv.com**, pulsa **Manage**.
3. Abre **Advanced DNS → Host Records → Add New Record**.
4. Añade este registro junto a los registros existentes:

| Campo | Valor |
|---|---|
| Type | TXT Record |
| Host | @ |
| Value | El valor completo `google-site-verification=...` que te dio Google |
| TTL | Automatic |

5. Guarda el nuevo TXT.
6. Vuelve a Search Console y pulsa **Verificar**.
7. Si aún no detecta el registro, espera a que se propague y vuelve a intentarlo. Conserva el TXT después de la verificación, porque Google puede volver a comprobarlo.

Este método verifica el dominio sin añadir etiquetas ni archivos de verificación a la página actual.

Si trasladaste los nameservers a Cloudflare después de esta revisión, añade el TXT en **Cloudflare → lunivosv.com → DNS → Records → Add record**, con tipo `TXT`, nombre `@` y el mismo valor de Google.

## 3. Enviar el sitemap

1. En Search Console, selecciona la propiedad **lunivosv.com**.
2. Abre **Sitemaps**.
3. En **Añadir un sitemap**, introduce:

   **https://lunivosv.com/sitemap.xml**

4. Pulsa **Enviar**.
5. Comprueba que Google lo pueda leer. La cantidad de URL puede cambiar cuando entre o salga algún modelo del inventario.

No hace falta enviar un sitemap por proveedor ni por dispositivo individual.

## 4. Solicitar la indexación inicial

Usa la barra **Inspeccionar cualquier URL** de Search Console:

1. Pega **https://lunivosv.com/**.
2. Pulsa **Probar URL publicada**.
3. Si es accesible, pulsa **Solicitar indexación**.
4. Repite con **https://lunivosv.com/modelos/**.
5. Repite con dos o tres modelos importantes del directorio, por ejemplo **https://lunivosv.com/modelos/iphone-11/**.

Usa las URL de `/modelos/`. Los filtros `?equipo=...`, los fragmentos `#inventario`, los enlaces temporales `/equipo/.../` y el acceso antiguo `/catalogo/` no son las páginas que queremos solicitar por separado.

## 5. Revisar los resultados

- En **Inspección de URL → Probar URL publicada → Ver página probada**, comprueba que Google vea las fotos, características y precios.
- Prueba una página de modelo en **https://search.google.com/test/rich-results** para revisar los datos estructurados. Google decide si los utiliza para mostrar resultados enriquecidos.
- Consulta después **Indexación → Páginas** y **Rendimiento → Resultados de búsqueda**.

No se han inventado reseñas, dirección física, garantías, gastos de envío ni políticas de devolución. Esta preparación no equivale a registrar productos en Google Merchant Center.

## Estados habituales

- **Sitemap leído correctamente**: Google recibió la lista de páginas y puede seguir procesándola.
- **Descubierta / rastreada, actualmente sin indexar**: Google conoce la URL pero aún no la ha incluido.
- **Página con redirección en `/catalogo/` o `/equipo/.../`**: puede ser normal, porque son enlaces que llevan al catálogo actual. El sitemap prioriza las páginas estables por modelo.
- **404 en un equipo retirado o un modelo que ya no está disponible**: puede ser normal al salir del inventario. El sitemap actual solo lista modelos disponibles.

La indexación puede tardar días o semanas. Google decide qué páginas incluye y en qué posición; enviar el sitemap no garantiza resultados inmediatos. No hace falta repetir la misma solicitud todos los días.

## Dar acceso a tu vendedor o encargado

Después de verificar la propiedad, puedes invitarlo desde **Ajustes → Usuarios y permisos**, usando su correo de Google.

La verificación y el envío a Search Console requieren entrar en la cuenta del propietario. No se han realizado automáticamente desde el sitio.
