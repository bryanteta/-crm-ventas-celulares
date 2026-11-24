# Respaldos públicos del catálogo

La sincronización conserva aquí versiones anteriores validadas de precios y fotos cuando se reduce el número de ajustes o se detecta un reinicio de revisión o fecha. Las ediciones normales permanecen en el historial de Git. Estos archivos no forman parte del sitio publicado. Solo contienen datos que ya eran públicos; nunca claves ni contexto privado de administración. Se conservan hasta 30 copias automáticas, incluida la que se esté archivando; las anteriores siguen en el historial de Git.

Para recuperar uno, descarga su JSON y usa Administración → Respaldos → Restaurar archivo. La restauración necesita la clave y conserva los ajustes ajenos al archivo. Para incluir también el contexto y las fechas, descarga un respaldo completo desde el panel.

Solo un retroceso de revisión o fecha mantiene la copia estática anterior y avisa en Actions. Eliminar ajustes o restaurar el último a automático con una revisión nueva se sincroniza normalmente, incluidas las páginas de modelos y de compartir. Solo una ejecución manual con `allow_customization_reset` confirma ese reemplazo. La web sigue dando prioridad al Worker cuando está disponible.
