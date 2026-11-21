# Auditoría inicial de seguridad — MiAlojamiento

Fecha: 2026-11-21. Rama: `audit/seguridad-firestore-20261121`.

## Alcance

Se inspeccionaron el árbol completo del repositorio y los archivos de entrada, autenticación, utilidades, reglas de Firestore, dashboard, hojas CSS y pruebas existentes. Esta primera intervención se concentra en las reglas de autorización de Firestore, no en un rediseño general.

## Problemas detectados y cambios propuestos

1. **Escalada de privilegios**: un administrador podía modificar `usuarios_auth` para concederse el rol `superadmin`. Ahora las escrituras administrativas de perfiles, espejos e índices impiden asignar ese rol o editar perfiles superadmin.
2. **Separación entre empresas**: las escrituras de administradores sobre usuarios y documentos auxiliares ahora verifican la pertenencia a su empresa, incluso al actualizar o borrar índices.
3. **Reservas**: las actualizaciones verifican la empresa del registro previo y del nuevo; recepción debe tener asignadas tanto la propiedad de origen como la de destino.
4. **Propiedades de recepción**: los accesos de recepción exigen también coincidencia con la empresa, no solo un ID incluido en `propiedad_ids`.
5. **Altas y reparación de perfiles**: los usuarios no pueden autoconcederse otras propiedades al escribir su espejo de autenticación ni al reparar el perfil principal.
6. **Usuarios desactivados**: un espejo de autenticación marcado como inactivo o eliminado deja de habilitar roles en las reglas.

## Límites y verificaciones pendientes

- Los cambios son únicamente del archivo `firestore.rules` en GitHub: **no se publicaron en Firebase**.
- Las pruebas estáticas revisan patrones de autorización, pero **no sustituyen** pruebas del emulador de Firestore con documentos reales.
- Antes de desplegar, probar: superadmin, admin de dos empresas, recepción de dos propiedades, usuario inactivo, registro pendiente, recuperación, alta/baja de usuarios y reserva/transacciones de ocupación.
- Validar que los perfiles legados tengan `activo`, `eliminado` y `propiedad_ids` con los formatos esperados.
- Revisar especialmente el modelo de `reserva_ocupacion`: un control verdaderamente fuerte debe validar la relación con reservas y su transacción, no solamente la propiedad.
- La interfaz no es uniforme: el login carga `material3.css`, mientras que el dashboard usa `responsive.css`. Hay reglas históricas acumuladas en `styles.css`. Se recomienda una fase independiente de consolidación visual con pruebas en celular.
- No se ejecutaron pruebas de navegador, Firebase ni `npm test` en esta sesión porque el entorno de ejecución no pudo descargar el repositorio; sí se realizaron comprobaciones estáticas del código obtenido mediante la integración de GitHub.

## Despliegue

1. Revisar y probar este pull request con el emulador Firestore.
2. Fusionar solo tras validar los flujos.
3. Desplegar las reglas en el proyecto Firebase correspondiente mediante un procedimiento controlado; actualizar GitHub por sí solo no modifica las reglas activas.
