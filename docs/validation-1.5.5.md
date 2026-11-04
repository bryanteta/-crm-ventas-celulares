# Lunivo 1.5.5-preview · Inventarios de Samuel y Split conectados

## Resultado

Las fuentes reales fueron leídas correctamente por HTTPS. La hoja pública de Samuel devolvió **249 equipos**, agrupados en **70 variantes**. El API de revendedores de Split devolvió **106 equipos**, agrupados en **91 variantes**: **44 de Saúl** (origen `SPLIT`) y **62 de Javier** (origen `JAVIER`). La copia consultada el 04/11/2026 a las 17:19 de El Salvador suma **355 equipos / 161 variantes**. Las cantidades pueden cambiar en consultas futuras.

El APK privado contiene esa copia normalizada, sin clave de acceso. Al abrir Proveedores la carga en el almacenamiento de la cuenta si falta una lista descargada. Los equipos aparecen dentro de Lunivo; los enlaces externos son opcionales. La comparación conserva modelos, variantes, dueños, precios y cantidades. El estado de actualización se despliega para dar prioridad a las tarjetas compactas.

## Lectura y actualización

- Samuel usa la exportación CSV pública de la hoja proporcionada. Se verificó su estructura real: fila de encabezados y columnas de modelo, color, almacenamiento, batería, categoría, precio, disponibilidad y observaciones. Cada fila representa una unidad; variantes idénticas con el mismo precio se agrupan sin perder cantidades. Se contrasta el total declarado.
- Split documenta en su página `GET /api/v1/inventario` con `X-API-Key`. La clave configurada en el entorno fue aceptada y la respuesta real fue 200. El conector interpreta `{actualizado, moneda, total, items}` y los campos `id, origen, modelo, detalle, color, precio`. Se descartan campos ajenos, incluido el nombre del cliente del API. Solo se lee inventario disponible; no se hacen ventas, reservas ni cambios en Split.
- Android realiza las consultas desde un puente exclusivo del origen empaquetado. Los destinos son dos URLs HTTPS fijas; no se siguen redirecciones ni se envía la clave a Google. Tamaño máximo 4 MiB y tiempos de espera acotados. Se validan contenido, esquema, total y precios antes de sustituir cada proveedor en una escritura local.
- Una respuesta válida vacía retira los equipos no disponibles. HTTP fallido, HTML, errores de formato, respuesta incompleta o falta de almacenamiento conservan la última lista válida. Las respuestas de otra cuenta se descartan.
- Actualizar inventarios solicita una consulta directa. Al abrir la pantalla también se actualizan listas con más de diez minutos, limitando reintentos. Buscar, ordenar y filtrar no descargan ni usan Firebase.
- Para actualizar Split desde un teléfono, se guarda una vez su clave en Ajustes → Conexión de inventarios. Se cifra con AES-GCM mediante Android Keystore y se vincula a la cuenta por AAD. La clave no se devuelve al WebView, no se guarda en localStorage ni se incorpora al código/APK. La copia incluida se ve antes de configurar la clave. Samuel no necesita clave.
- El archivo inicial `android/provider-bootstrap.json` permanece ignorado por Git. El script de generación usa el secreto del entorno solo en el encabezado HTTP destinado a Split y nunca exporta su valor. Gradle Sync elimina recursos generados obsoletos si no hay copia privada en otra compilación.

## Conservación de datos

Se conservan ventas, autores, accesorios, garantías, correlativos e inventario propio. Los equipos de proveedores son cotizaciones y no se convierten en existencias propias ni se descuentan en sistemas externos. Cuando existe una descarga, Proveedores muestra esa fuente y evita sumar los lotes locales a sus existencias. Los lotes locales siguen en Inventario registrado. Una descarga válida de Samuel sustituye la referencia PDF anterior integrada; conserva ofertas manuales y otros proveedores. La importación del PDF antiguo queda oculta cuando existe un inventario de Samuel descargado.

## Validación ejecutada

- **45 pruebas Node aprobadas**: datos anteriores, cálculos y garantías más CSV real, agrupación, cantidades, precios, orígenes, identificadores, respuestas incompletas, duplicados, totales y reemplazo conservador.
- **41 pruebas Android release aprobadas**: incluye solicitudes a destinos fijos, encabezado correcto solo para Split, errores HTTP/redirect/HTML/tamaño y cifrado AES-GCM con aislamiento de cuenta, además de las 35 anteriores.
- **19 suites de interfaz aprobadas**, incluida la nueva suite de inventarios descargados. Se repiten los flujos afectados tras los ajustes de actualización y presentación. Verifica carga inicial, claves fuera de localStorage, refresco, reducción de disponibilidad, vacío válido, persistencia sin conexión, cuota, reintento después del intervalo y descarte de respuestas de otra cuenta.
- **Prueba adicional con la copia real completa aprobada:** 355 equipos y 161 variantes en la interfaz, precios/cantidades idénticos al origen normalizado, filtros Saúl/Javier/Samuel, sin desbordamiento en anchos 320, 384, 412, 690, 840 y 960 px. Tarjetas cerradas de hasta 100 px de alto. Capturas de la app generadas fuera de Git.
- Compilación release aprobada; Lint sin errores, con seis avisos de nuevas versiones disponibles de las dependencias existentes. Se conservan las versiones fijadas y verificadas de esta app. Paquete `com.crmcelulares.app`, versión **1.5.5-preview**, código **24**. APK verificado contra las fuentes y con la firma de actualización anterior.

## Límites de la comprobación

Las lecturas de Google y Split se comprobaron desde el entorno de desarrollo; la interfaz y el puente se verificaron con las respuestas reales normalizadas y transportes de prueba. Se añadieron dos pruebas instrumentadas para Android Keystore y carga del WebView real, pero **no se ejecutaron**: el emulador API 35 no completó su arranque y rechazó la instalación con `Cannot access system provider: settings before system providers are installed`. El APK de pruebas se compiló, lo que no cuenta como ejecución. No se afirma prueba en Samsung físico ni actualización por red desde un teléfono. Las cuatro pruebas instrumentadas del PDF nativo de entregas anteriores no se repitieron. No se modificaron reglas ni servicios Firebase de producción.

APK SHA-256: `71e0af35e54d166c914f194014d5798a6209c5db9a0cd70a43f6036b3ba88f1f`.
