# MiAlojamiento

Aplicación web de gestión hotelera hecha con HTML + CSS + JavaScript vanilla, Firebase Authentication y Cloud Firestore.

## Qué incluye

- Login + registro controlado + recuperación de contraseña
- Soft delete de usuarios
- Reactivación por email existente
- Roles: `superadmin`, `admin`, `recepcion`
- Propiedades con datos completos
- Unidades por propiedad
- Reservas con validación de capacidad
- Validación de conflictos por unidad con documentos de ocupación
- Dashboard con KPIs, calendario mensual y listado filtrable
- Compatibilidad gradual con datos legacy

## Arquitectura aplicada

### Colecciones principales
- `usuarios`
- `propiedades`
- `propiedades/{propiedadId}/unidades`
- `reservas`

### Colecciones internas de soporte
Se agregan tres colecciones internas para resolver problemas reales de seguridad, lookup y consistencia:

1. `usuarios_auth/{uid}`
   - espejo liviano del perfil
   - permite resolver el perfil por `uid`
   - simplifica reglas de seguridad y navegación autenticada

2. `email_index/{email_normalizado}`
   - índice por correo
   - evita duplicados
   - permite reactivación y lookup exacto sin depender de queries inseguras por email

3. `reserva_ocupacion/{propiedad__unidad__fecha}`
   - documentos de bloqueo por noche
   - permite prevenir superposición de reservas con `runTransaction`
   - funciona tanto para `unidad_id` real como para fallback manual legacy

## Decisiones importantes

### 1) Alta de usuarios sin Admin SDK
Con el stack pedido (solo frontend + Firebase client SDK), un admin **no puede crear usuarios de Authentication de terceros** sin backend.
Por eso el flujo implementado es:

- admin/superadmin crea el perfil de Firestore
- el usuario queda `pendiente_auth`
- el usuario entra a `login.html` y usa `Registrarme`
- recién ahí se crea la cuenta Auth y se vincula el `uid`

### 2) Baja lógica
Cuando se “elimina” un usuario:
- no se borra el documento de Firestore
- se marca `activo = false`
- `eliminado = true`
- si tenía `uid`, se conserva
- si se vuelve a crear con el mismo mail, se reactiva el mismo perfil

### 3) Reutilización de correos
El email no se busca por query abierta sino por `email_index/{email_normalizado}`.
Eso permite:
- detectar existente activo
- reactivar dado de baja
- saber si ya tiene `uid`
- saber si debe registrarse o iniciar sesión / recuperar contraseña

### 4) Conflicto de reservas
No se usa solo una query “best effort”.
Cada reserva activa genera locks diarios en `reserva_ocupacion`.
Si otro usuario intenta reservar la misma unidad en fechas cruzadas, la transacción falla.

## Estructura del proyecto

```text
MiAlojamiento/
├─ login.html
├─ dashboard.html
├─ usuarios.html
├─ nuevo_usuario.html
├─ propiedades.html
├─ unidades.html
├─ nueva_reserva.html
├─ firestore.rules
├─ firestore.indexes.json
├─ README.md
├─ css/
│  └─ styles.css
└─ js/
   ├─ firebase-config.js
   ├─ auth.js
   ├─ app-helpers.js
   ├─ dashboard.js
   ├─ usuarios.js
   ├─ nuevo-usuario.js
   ├─ propiedades.js
   ├─ unidades.js
   └─ nueva-reserva.js
```

## Configuración

### 1) Firebase
Editar `js/firebase-config.js` y reemplazar el objeto `firebaseConfig` por los datos reales de tu proyecto.

### 2) Authentication
En Firebase Console:
- habilitar `Email/Password`

### 3) Firestore
Crear la base en modo Native y desplegar:
- `firestore.rules`
- `firestore.indexes.json`

### 4) Usuario inicial
Como el flujo normal depende de un admin existente, para el primer superadmin tenés dos caminos:

#### Opción rápida
Crear manualmente:
- un usuario en Authentication
- un doc en `usuarios`
- un doc en `usuarios_auth/{uid}`
- un doc en `email_index/{email_normalizado}`

#### Opción alternativa
Cargar primero un usuario `pendiente_auth` en `usuarios`, luego registrarlo desde la UI y después editar su rol a `superadmin` manualmente una sola vez.

## Modelo de datos

### usuarios/{usuarioId}
```json
{
  "nombre": "Ana Pérez",
  "email": "ana@empresa.com",
  "email_normalizado": "ana@empresa.com",
  "rol": "admin",
  "activo": true,
  "eliminado": false,
  "uid": "firebaseUidOpcional",
  "estado_registro": "activo",
  "empresa_id": "empresa-demo",
  "propiedad_id": "",
  "propiedad_ids": [],
  "created_at": "serverTimestamp",
  "updated_at": "serverTimestamp",
  "creado_por": "uid",
  "actualizado_por": "uid",
  "eliminado_at": null,
  "eliminado_por": ""
}
```

### usuarios_auth/{uid}
```json
{
  "usuario_id": "abc123",
  "email": "ana@empresa.com",
  "email_normalizado": "ana@empresa.com",
  "rol": "admin",
  "empresa_id": "empresa-demo",
  "propiedad_id": "",
  "propiedad_ids": [],
  "activo": true,
  "eliminado": false,
  "estado_registro": "activo",
  "updated_at": "serverTimestamp"
}
```

### email_index/{email_normalizado}
```json
{
  "usuario_id": "abc123",
  "uid": "firebaseUidOpcional",
  "email": "ana@empresa.com",
  "rol": "admin",
  "empresa_id": "empresa-demo",
  "activo": true,
  "eliminado": false,
  "estado_registro": "activo",
  "updated_at": "serverTimestamp"
}
```

### propiedades/{propiedadId}
```json
{
  "nombre": "Hotel Centro",
  "codigo": "HCENTRO",
  "codigo_normalizado": "hcentro",
  "tipo": "hotel",
  "ciudad": "Buenos Aires",
  "direccion": "Av. Siempre Viva 123",
  "descripcion": "Hotel corporativo",
  "activo": true,
  "empresa_id": "empresa-demo",
  "check_in": "14:00",
  "check_out": "10:00",
  "comodidades_generales": ["wifi", "desayuno"],
  "created_at": "serverTimestamp",
  "updated_at": "serverTimestamp",
  "creado_por": "uid",
  "actualizado_por": "uid"
}
```

### propiedades/{propiedadId}/unidades/{unidadId}
```json
{
  "codigo": "101",
  "nombre": "Habitación 101",
  "tipo_unidad": "doble",
  "capacidad_max": 2,
  "capacidad_adultos": 2,
  "capacidad_ninos": 0,
  "camas": ["1 cama matrimonial"],
  "comodidades": ["tv", "aire"],
  "activa": true,
  "created_at": "serverTimestamp",
  "updated_at": "serverTimestamp",
  "creado_por": "uid",
  "actualizado_por": "uid"
}
```

### reservas/{reservaId}
```json
{
  "cliente": "Juan Gómez",
  "propiedad_id": "prop1",
  "propiedad_nombre": "Hotel Centro",
  "unidad_id": "unit1",
  "unidad": "101",
  "unidad_nombre": "Habitación 101",
  "unidad_key": "unit1",
  "capacidad_unidad": 2,
  "fecha_inicio": "2026-04-10",
  "fecha_fin": "2026-04-12",
  "estado": "confirmada",
  "huespedes": 2,
  "total": 120000,
  "observaciones": "",
  "empresa_id": "empresa-demo",
  "created_at": "serverTimestamp",
  "updated_at": "serverTimestamp",
  "creado_por": "uid",
  "actualizado_por": "uid",
  "creado_por_nombre": "Ana Pérez",
  "actualizado_por_nombre": "Ana Pérez"
}
```

### reserva_ocupacion/{propiedad__unidad__fecha}
```json
{
  "reserva_id": "res123",
  "propiedad_id": "prop1",
  "unidad_key": "unit1",
  "fecha": "2026-04-10",
  "estado": "confirmada",
  "updated_at": "serverTimestamp"
}
```

## Migración de datos legacy

### Usuarios viejos
Si tenés documentos viejos en `usuarios` sin:
- `email_normalizado`
- `propiedad_ids`
- `eliminado`
- `estado_registro`

la app los normaliza en lectura y los puede reparar al editar / guardar.

### Reservas viejas
Si una reserva vieja solo tiene:
- `unidad` como texto
- sin `unidad_id`

la app sigue funcionando porque calcula:
- `unidad_key = normalize(unidad)` si no existe `unidad_id`

### Propiedades viejas
Si una propiedad no tiene:
- `comodidades_generales`
- `check_in`
- `check_out`

la app usa defaults en UI y se completa al editar.

## Limitación honesta importante
Sin backend o Admin SDK:
- no se puede borrar la cuenta de Authentication de otro usuario desde la interfaz
- no se puede cambiar el email de Authentication de otro usuario de forma segura

Por eso:
- la baja es lógica en Firestore
- si un usuario ya tenía `uid`, al reactivarlo puede volver a entrar con su password existente
- si no recuerda su clave, usa `Olvidé mi contraseña`

## Recomendación de evolución
Si más adelante querés endurecer todavía más la seguridad o automatizar invitaciones:
- agregar Cloud Functions / Admin SDK
- enviar invitación por mail
- borrar usuarios Auth al dar de baja si el negocio lo requiere
- usar una colección `empresas` formal en vez de strings sueltos
