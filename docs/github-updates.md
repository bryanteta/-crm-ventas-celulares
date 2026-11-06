# Actualizaciones gratuitas mediante GitHub Releases

Lunivo 1.7.0 incorpora el actualizador en Ajustes → Aplicación → Actualizaciones. Se instala una vez sobre la app existente. Después consulta el último release estable público, como máximo una vez cada 24 horas por teléfono; Buscar actualización permite una consulta manual. Descargar e Instalar requieren pulsaciones independientes. Android puede pedir autorizar instalaciones desde Lunivo y siempre confirma la instalación. No se instala silenciosamente ni se desinstala la versión anterior.

Fuente fija: `bryanteta/-crm-ventas-celulares`, API pública `releases/latest`, asset `lunivo-update.json`, o la copia de ese manifiesto en la rama `lunivo-updates/vX.Y.Z/` cuando el release no tiene adjuntos. La instalación actual usa esa rama pública de distribución porque la credencial del entorno no admite subir adjuntos a uploads.github.com. El manifiesto contiene `versionCode`, `versionName`, `apkUrl` y `sha256`. Solo se aceptan HTTPS, el repositorio y etiqueta correctos; las redirecciones quedan limitadas a GitHub y sus hosts de assets o raw.githubusercontent.com. La descarga está limitada a 50 MiB. Antes de instalar se vuelven a comprobar SHA-256, paquete, versión superior y los certificados de firma contra la instalación actual. Los errores conservan la app y sus datos. Una descarga interrumpida se reinicia; no hay reanudación parcial. GitHub puede limitar consultas por IP; los fallos permiten reintentar.

## Publicar una versión futura

1. Incrementar `versionCode` y `versionName` en `android/app/build.gradle` y actualizar la versión visible. Conservar el mismo keystore privado. La identidad instalada tiene SHA-256 `49be17458fe0ba6989d8523faa39ccb937b1576ded93a80de193dc59d44dd9f6`. Respaldar ese keystore en privado antes de sustituir el entorno; no subirlo al repo ni a Releases. Un keystore nuevo no actualiza las instalaciones existentes.
2. Ejecutar pruebas y compilar con `./gradlew -PpublicRelease assembleRelease`. Este indicador excluye la copia privada de proveedores; las conexiones y cachés existentes de cada teléfono se conservan. Los clientes nuevos deben consultar/configurar sus inventarios en la app. Nunca publicar `android/provider-bootstrap.json` ni claves.
3. Copiar el APK firmado como `lunivo-X.Y.Z-release.apk`. Crear el manifiesto, usando las rutas de Build Tools de la máquina:

```sh
python3 scripts/prepare-update.py /ruta/lunivo-X.Y.Z-release.apk --aapt /ruta/build-tools/aapt --apksigner /ruta/build-tools/apksigner --distribution-branch --tag vX.Y.Z --out /ruta/lunivo-update.json
```

El script valida paquete, nombre de versión, etiqueta y firma instalada. Calcula el hash real. No editar el hash manualmente ni reutilizar una versión publicada.

4. Hacer push del código probado. En la rama separada `lunivo-updates`, agregar una carpeta nueva `vX.Y.Z/` con el APK público y `lunivo-update.json`; conservar las carpetas publicadas. Hacer push de esa rama. Crear un release **borrador** `vX.Y.Z` que apunte al commit probado de `main`, con enlaces a los archivos públicos de esa carpeta. Verificar ambos archivos y publicar el borrador como último release estable. También se admiten los dos archivos como adjuntos del release si se dispone de credenciales de subida; en ese caso preparar el manifiesto sin `--distribution-branch`. No usar prerelease para actualizaciones generales; la API latest lo omite. No publicar antes de que ambos archivos estén accesibles.
5. Comprobar la API pública, descargar ambos archivos publicados y comparar el hash. Las próximas aperturas/búsquedas de Lunivo detectarán la versión superior.

No se necesitan tokens GitHub dentro de la app. Las credenciales para publicar se quedan en el equipo del desarrollador. El sistema no compila ni publica cada cambio de código automáticamente: la publicación del release es el paso que entrega cada actualización.

La primera versión del actualizador debe instalarse manualmente; las versiones antiguas no lo pueden recibir por sí solas. Se mantienen las reglas de Firebase de 1.6.5. La publicación de un APK no despliega reglas ni cambia datos. Las verificaciones automáticas se complementan con una prueba física de instalación en Android, permisos del sistema y firma conservada.
