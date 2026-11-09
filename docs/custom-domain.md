# Dominio lunivosv.com

El catálogo se prepara para funcionar directamente en la raíz, sin `/catalogo/`, mediante GitHub Actions/Pages. Conserva la ruta anterior y la actualización programada del inventario. La app Android utiliza su fuente original y no necesita recompilarse.

## DNS en Namecheap

Los servidores autoritativos detectados son `dns1.registrar-servers.com` y `dns2.registrar-servers.com`. El dominio raíz apunta a `162.255.119.141` y `www` a `parkingpage.namecheap.com`, por lo que todavía no dirige al catálogo.

En **Domain List → Manage → Advanced DNS**, sustituir únicamente los registros de parking/redirección de `@` y `www` por:

| Tipo | Host | Valor | TTL |
|---|---|---|---|
| A | @ | 185.199.108.153 | Automatic |
| A | @ | 185.199.109.153 | Automatic |
| A | @ | 185.199.110.153 | Automatic |
| A | @ | 185.199.111.153 | Automatic |
| CNAME | www | bryanteta.github.io | Automatic |

No modificar registros MX, TXT u otros servicios. Evitar registros A/AAAA antiguos de esos mismos hosts que apunten a otros servidores. No se necesita Cloudflare ni cambiar los nameservers.

## Activación en GitHub

Después de comprobar los DNS, establecer `lunivosv.com` en Settings → Pages → Custom domain (también se puede hacer con la API autorizada del repositorio). Esperar la emisión del certificado y activar Enforce HTTPS cuando esté disponible. No activar el dominio mientras siga apuntando al parking: GitHub redirige la dirección anterior hacia el dominio personalizado.

GitHub no controla los DNS de Namecheap; este paso no se puede hacer solo con un commit. Es recomendable verificar también la propiedad del dominio en la configuración personal de GitHub → Pages, usando el TXT específico que GitHub indique.

La migración de publicación usa `build_type: workflow`, `.github/workflows/deploy-catalog.yml` y los permisos estándar de Pages. El actualizador programado dispara el publicador mediante `workflow_run` al finalizar con éxito; no depende de las compilaciones heredadas de Pages. El dominio es una configuración de dirección y no modifica las consultas de proveedores ni los precios.
