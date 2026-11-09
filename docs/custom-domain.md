# Dominio lunivosv.com

El catálogo funciona directamente en la raíz, sin `/catalogo/`, mediante GitHub Actions/Pages. Los enlaces anteriores con `/catalogo/` redirigen a la raíz; el inventario mantiene su actualización programada. La app Android utiliza su fuente original y no necesita recompilarse.

## DNS en Namecheap

Los servidores autoritativos son `dns1.registrar-servers.com` y `dns2.registrar-servers.com`. El dominio raíz apunta a las cuatro IP de GitHub Pages y `www` a `bryanteta.github.io`. Los DNS, el certificado TLS y HTTPS obligatorio quedaron comprobados.

Configuración guardada en **Domain List → Manage → Advanced DNS**:

| Tipo | Host | Valor | TTL |
|---|---|---|---|
| A | @ | 185.199.108.153 | Automatic |
| A | @ | 185.199.109.153 | Automatic |
| A | @ | 185.199.110.153 | Automatic |
| A | @ | 185.199.111.153 | Automatic |
| CNAME | www | bryanteta.github.io | Automatic |

No modificar registros MX, TXT u otros servicios. Evitar registros A/AAAA antiguos de esos mismos hosts que apunten a otros servidores. No se necesita Cloudflare ni cambiar los nameservers.

## Activación en GitHub

Configuración activa en Settings → Pages:

- Source: **GitHub Actions** (`build_type: workflow`).
- Custom domain: **lunivosv.com**.
- Enforce HTTPS: **activado**; certificado válido para el dominio y `www`.

Se verificó la [publicación inicial en la raíz](https://github.com/bryanteta/-crm-ventas-celulares/actions/runs/42551124219). También se ejecutó una [consulta de proveedores](https://github.com/bryanteta/-crm-ventas-celulares/actions/runs/42551165478) y se comprobó su [publicación automática posterior](https://github.com/bryanteta/-crm-ventas-celulares/actions/runs/42551196339). El JSON publicado en `/inventory.json` coincidió con el de `/catalogo/inventory.json` y correspondió a esa consulta nueva.

GitHub no controla los DNS de Namecheap; este paso no se puede hacer solo con un commit. Es recomendable verificar también la propiedad del dominio en la configuración personal de GitHub → Pages, usando el TXT específico que GitHub indique.

La migración de publicación usa `build_type: workflow`, `.github/workflows/deploy-catalog.yml` y los permisos estándar de Pages. El actualizador programado dispara el publicador mediante `workflow_run` al finalizar con éxito; no depende de las compilaciones heredadas de Pages. El dominio es una configuración de dirección y no modifica las consultas de proveedores ni los precios.

Mientras Pages mantenga la fuente legacy, el `index.html` del CRM redirige únicamente los hosts `lunivosv.com` y `www.lunivosv.com` a `/catalogo/`, conservando parámetros y fragmento. Esto evita que el dominio abra el CRM anterior; la app Android usa `appassets.androidplatform.net` y conserva su interfaz. Al activar la publicación por Actions, el artefacto coloca directamente el catálogo en la raíz y esta redirección deja de intervenir.
