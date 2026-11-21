# Roles y autorización

Propuesta autorizada por el usuario el 21/11/2026. Implementación local; no desplegar ni modificar datos reales.

## Objetivo

Completar superadmin y agregar soporte con lectura global de datos de negocio. Soporte solo modifica observaciones de reservas y teléfono, email de contacto y observaciones internas de propiedades. No crea datos, cambia accesos, modifica ocupación ni da bajas.

## Enfoques

Se mantiene Firebase cliente con autorización efectiva en Firestore, y capacidades separadas en interfaz. Un backend para administrar cuentas Auth de terceros queda fuera del alcance; agregarlo ahora aumentaría infraestructura sin ser necesario para estos permisos.

## Restricciones

- No borrar físicamente usuarios, propiedades, unidades ni reservas. Cancelar reservas libera únicamente sus locks técnicos.
- Admin queda limitado a su empresa y no puede crear, modificar ni asumir roles globales.
- Solo superadmin puede asignar superadmin y soporte. Un superadmin habilitado no puede ser desactivado ni degradado desde el cliente: evita perder el último sin contadores frágiles y sin backend.
- Usuarios deshabilitados o eliminados no conservan autorización por espejos obsoletos ni pueden auto-reactivarse.
- Perfil principal es autoridad canónica. Espejos deben coincidir con su perfil; modificaciones de identidad y permisos se validan también al acceder directamente al SDK.
- Registro y reparación propia solo completan campos permitidos, preservando empresa, rol y asignaciones. Documentos legacy que requieran corregir permisos se reparan por un administrador.
- Mantener filtros de empresa/propiedades para admin/recepción y consultas globales para superadmin/soporte.

## Verificación

Tests de capacidades, payloads de soporte, interacción DOM y reglas en emulador: accesos cruzados, escalamiento, escrituras mixtas, estados inactivos, registro y espejos, cancelación y locks. Revisión independiente al finalizar. Sin migración automática de producción.
