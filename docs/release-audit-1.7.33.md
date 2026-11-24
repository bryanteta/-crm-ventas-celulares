# Lunivo 1.7.33 · Precios de la web sincronizados con la app

Las tarjetas de proveedores muestran el mismo precio que la web pública. Con la clave de administración del catálogo guardada en Ajustes → Inventarios → *Precios de la web*, cada tarjeta permite guardar un precio web o volver al automático; el cambio se ve en la web y en la app. **Usar en venta** sugiere el precio web; sin ajuste se mantiene costo + $80. La app no edita fotos y conserva las guardadas en la web.

La clave se verifica con el Worker antes de guardarse, queda cifrada con Android Keystore y separada de la clave de Split. Una edición nunca sobrescribe un cambio más reciente hecho en la web. Detalles: [administración del catálogo](catalog-administration.md#precios-de-la-web-desde-la-app-android).

Requisito: el Worker `lunivo-inventory` desplegado desde `main` con la ruta `/admin/session` (commit 14117a0). No requiere cambios de Firebase ni de `firestore.rules`.

Validación: pruebas unitarias (`npm test`), Worker (`admin.test.mjs`, runtime de Cloudflare), `tests/web-prices-ui.cjs` contra el Worker real en ambos sentidos, `CatalogHttpTest`. Pendiente en el equipo de compilación: pruebas unitarias Android con Robolectric (`InventoryBridgeCatalogTest`), compilación firmada y prueba física de instalación sobre 1.7.32.

APK público con la misma identidad de firma, sin copia privada de proveedores.
