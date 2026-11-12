# Inventario automático de Lunivo en Cloudflare

Servicio preparado para Cloudflare Workers Free, con un Durable Object respaldado por SQLite. Consulta las APIs de Samuel y Split cada cinco minutos. Reutiliza el mismo generador de catálogo que GitHub, con precio de proveedor + $80, agrupación por especificaciones y exclusión de datos privados. Solo almacena el JSON público completo.

**Estado:** servicio desplegado en `https://lunivo-inventory.bra0307h.workers.dev` y URL configurada en `catalogo/inventory-source.json`. La web conserva el archivo de GitHub como respaldo. Se comprobó el catálogo público y la disponibilidad del secreto en producción, sin leer ni publicar su valor.

## Crear el Worker desde tu panel

1. Abre <https://dash.cloudflare.com/> y entra en **Workers & Pages**.
2. Pulsa **Create application** y elige **GitHub** para crear un **Worker**.
3. Selecciona `bryanteta/-crm-ventas-celulares`, rama `main`.
4. En la configuración usa estos valores:

| Campo | Valor |
| --- | --- |
| Nombre del Worker / proyecto | `lunivo-inventory` |
| Root directory / directorio raíz | `workers/catalog` |
| Build command | vacío |
| Deploy command | `npm run deploy` |

5. Pulsa **Save and Deploy**. El archivo `wrangler.jsonc` crea el almacenamiento SQLite y el disparador `*/5 * * * *`. Ambos son compatibles con Workers Free; no hace falta crear KV, usar un plan de pago o mover el dominio de GitHub.
6. Dentro del Worker abre **Settings → Variables and Secrets → Add**. Tipo **Secret**, nombre **`SPLIT_INVENTORY_TOKEN`**, valor: la misma clave de revendedor que usas para Split. Guarda y despliega el cambio. La clave se introduce directamente en Cloudflare; no se pega en el chat, Git ni archivos públicos. Samuel no necesita clave.
7. Copia la dirección HTTPS del Worker, parecida a `https://lunivo-inventory.tu-subdominio.workers.dev`, y compártela en el chat para conectar la web y verificar el resultado. Esa dirección es pública y no contiene la clave.

Si Cloudflare solicita elegir un subdominio `workers.dev`, elige uno disponible. El nombre del proyecto debe coincidir exactamente con `lunivo-inventory`. Si ya existe un Worker con ese nombre, conecta ese proyecto al repositorio con los mismos ajustes.

## Verificar y conectar

- `/` identifica el servicio y sus rutas.
- `/health` devuelve `ready` y la fecha de la última captura pública, sin claves ni detalles de errores privados.
- `/inventory.json` devuelve únicamente el catálogo público. La primera consulta puede iniciar una captura; si se acaba de agregar la clave, el siguiente intento puede tardar hasta cinco minutos por el intervalo global.
- Antes de activar, comprobar `ready: true`, los modelos, las unidades y los precios. Después colocar la URL completa terminada en `/inventory.json` en `catalogo/inventory-source.json`, publicar y verificar lunivosv.com.
- La web consulta el servicio aproximadamente cada minuto mientras está visible, sin cambiar un diálogo abierto. Si el servicio falla o tiene una lista antigua, usa el respaldo estático; una lista más vieja no sustituye otra más reciente que ya esté visible.

Los cron son consultas periódicas, no eventos instantáneos del proveedor. Cloudflare puede tardar varios minutos en propagar un disparador nuevo. Las cuotas del plan gratuito se aplican: si se agotan, el navegador conserva el respaldo de GitHub. El almacenamiento guarda la última captura válida, aunque falle uno de los proveedores; nunca publica una mezcla parcial. Una respuesta vacía válida sí elimina las unidades que ya no están disponibles.

## Evitar compilaciones innecesarias

En **Settings → Builds → Build watch paths**, si aparece esa opción, limita las rutas a `workers/catalog/**`, `scripts/catalog-core.cjs`, `device-core.js`, `feeds-core.js` y `sales-core.js`. Así, los cambios de inventario estático de GitHub no vuelven a compilar el Worker. La actualización de los datos se ejecuta por cron independientemente de los builds.

## Desarrollo y verificación

```sh
cd workers/catalog
npm ci
npm test
npm run test:runtime
npm run dev
```

La clave local, si se necesita, va en `.dev.vars` (ignorado por Git). Nunca va en Wrangler, el manifiesto público o el código de la web. Los tests usan respuestas y claves ficticias; no requieren una cuenta Cloudflare ni credenciales reales.

`npm test` comprueba ambas APIs, +$80, datos vacíos válidos, privacidad, redirects, caché global y conservación ante errores de proveedor/almacenamiento. `test:runtime` compila y ejecuta el Worker con SQLite real en el entorno local de Cloudflare, incluyendo persistencia tras reinicio. Desde la raíz, `node scripts/test-catalog-live.cjs` verifica el cliente con Cloudflare, respaldo, listas antiguas y diálogo estable.

Si la clave se guardó por error en las variables cifradas de Build, el comando `npm run deploy` la copia al secreto de runtime únicamente durante un Build de producción de Cloudflare en `main`. Se pasa por la entrada estándar del CLI, sin escribirla en archivos ni imprimirla. Fuera de ese entorno no se sincronizan secretos de la máquina de desarrollo.
