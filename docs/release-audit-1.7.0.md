# Lunivo 1.7.0 · actualizador GitHub

Código 35, paquete com.crmcelulares.app. Búsqueda automática diaria y manual, aviso de versión, descarga e instalación explícitas desde Ajustes → Aplicación. El instalador de Android requiere autorización y confirmación. La app no envía sus datos comerciales a GitHub.

Verificación de HTTPS y repositorio, etiqueta, hash SHA-256, tamaño máximo de 50 MiB, paquete, versión superior y firma igual a la instalada. Verificación repetida antes de abrir el instalador. Si la app deja de tener foco durante esa verificación, requiere volver a pulsar Instalar. Se bloquean descargas/consultas simultáneas; los errores permiten reintentar sin alterar la instalación. No hay instalación silenciosa ni reanudación parcial de descargas.

Pruebas: 66 unitarias Android release (cuatro nuevas de manifiesto, URLs/redirecciones y datos inválidos), 56 Node y 26 suites de interfaz. Se verifica consulta inicial, botones explícitos, bloqueo durante descarga, búsqueda manual y apertura de la sección correcta desde Inventario. Compilación release y APK instrumentado, lint sin errores (seis avisos de actualización de dependencias). La instalación física, permisos de fuentes externas y actualización real en Samsung requieren comprobación en un dispositivo: las pruebas de interfaz simulan el puente y las nativas usan Robolectric.

El APK público se compila con -PpublicRelease: excluye provider-bootstrap.json y las claves de proveedores. Mantiene la firma anterior y los recursos web se cotejan con el APK final. Las configuraciones privadas de compilación y los keystores no se incluyen en Git ni en los assets de Releases. La app mantiene las cachés y conexiones ya configuradas al actualizar; una instalación nueva necesita consultar/configurar sus proveedores.

La distribución usa un Release público estable con APK y lunivo-update.json. Se valida su descarga pública y el hash después de publicar. Ver docs/github-updates.md para preparar versiones posteriores y conservar la firma. La primera instalación del actualizador se hace manualmente sobre la app existente, sin desinstalar. No se despliegan reglas Firebase; se mantienen las de 1.6.5.
