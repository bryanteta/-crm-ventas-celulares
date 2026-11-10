# Activar plazos de garantía editables en Firebase

Lunivo 1.7.15 permite entre 1 y 36 meses, con 3 por defecto. La regla anterior de Firestore exigía exactamente `r.warrantyMonths==3`; por eso se necesita actualizarla antes de guardar plazos distintos en una cuenta compartida.

1. Entra a Firebase Console, abre el proyecto Lunivo y ve a **Firestore Database → Reglas**.
2. Copia el archivo completo `firestore.rules` de la raíz del repositorio y reemplaza el contenido del editor. Usa el botón Raw de GitHub para copiarlo sin números de línea.
3. Pulsa **Publicar**. Este cambio permite meses enteros de 1 a 36; conserva la autenticación, permisos y validación de ventas existentes.
4. Actualiza los teléfonos vinculados a Lunivo 1.7.15 antes de editar o emitir garantías con plazos diferentes. Los clientes antiguos solo aceptaban 3 meses.

Si prefieres modificar exclusivamente la condición, en `validReceipt` sustituye esta línea:

```javascript
&& r.serials is list && r.serials.size()<=quantity && r.warrantyMonths==3
```

por:

```javascript
&& r.serials is list && r.serials.size()<=quantity && safeInt(r.warrantyMonths,1,36)
```

No borres las otras reglas ni elimines la función `safeInt`. Publicar el APK o hacer push a GitHub no publica las reglas de Firebase.

El APK y las reglas están probados. La actualización general se mantiene en borrador hasta que las reglas de producción estén publicadas, para evitar rechazos al guardar garantías desde una cuenta compartida.
