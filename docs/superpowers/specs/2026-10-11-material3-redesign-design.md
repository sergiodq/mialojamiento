# MiAlojamiento · Rediseño Material 3

Fecha: 2026-10-11
Estado: listo para revisión

## Objetivo

Rediseñar toda la interfaz de MiAlojamiento para que se sienta como una app Android moderna basada en Material Design 3, manteniendo intacta la lógica de negocio, Firebase Authentication, Firestore, permisos, reservas y estructura de datos.

La prioridad es móvil, especialmente teléfonos Android angostos, sin degradar tablet ni escritorio.

## Principios

- Mostrar información de negocio, no detalles técnicos.
- Ocultar términos internos como Firebase, Firestore, Authentication, UID, índices y estados de implementación.
- Reducir textos explicativos y copy redundante.
- Dar más peso a acciones primarias y controles táctiles.
- No comprimir interfaces de escritorio en móvil: adaptar patrones.
- Mantener coherencia visual entre todas las pantallas.

## Navegación

### Móvil

Esquema híbrido Material 3:

- barra inferior fija con: Inicio, Reservas, Propiedades y Más;
- FAB destacado para Nueva reserva;
- Más abre drawer con funciones administrativas y secundarias;
- Usuarios, administración y cerrar sesión quedan en el drawer;
- respetar safe areas y no tapar contenido.

### Tablet

- navigation rail cuando el ancho lo permita;
- drawer para funciones secundarias;
- layouts de dos columnas cuando aporten claridad.

### Escritorio

- navegación lateral persistente;
- item activo claramente resaltado;
- perfil y cierre de sesión visualmente secundarios;
- estética Material 3 consistente con móvil.

## Sistema visual

Crear tokens CSS para primary, containers, surface, outline, error, success, warning, elevaciones, radios y tamaños táctiles.

Mantener la identidad azul/violeta actual, con tonos más suaves y consistentes.

Tipografía con sensación Android/Material, priorizando legibilidad y jerarquía.

Componentes a rediseñar:

- botones filled, tonal, outlined y text;
- FAB;
- cards;
- chips;
- inputs outlined;
- selects;
- checkboxes y switches;
- snackbars/toasts;
- diálogos;
- bottom navigation;
- navigation rail;
- drawer;
- app bar;
- listas y tablas adaptativas;
- badges de estado.

Objetivos táctiles:

- controles principales: mínimo 48 px;
- botones principales en móvil: 52–56 px;
- FAB: 56 px.

## Mensajes y copy

Toda la UI debe responder sólo:

1. qué pasó;
2. qué tiene que hacer el usuario.

No mostrar detalles técnicos.

Ejemplos:

- "La cuenta existe en Authentication, pero no tiene un perfil válido o activo en Firestore." → "No pudimos acceder a tu cuenta. Contactá al administrador."
- "Ese correo ya existe en Authentication." → "Ya existe una cuenta con este correo."
- `pendiente_auth` → "Tu cuenta todavía no está habilitada."
- error interno inesperado → "No pudimos completar la operación. Intentá nuevamente."
- recuperación exitosa → "Te enviamos un enlace para cambiar tu contraseña."

Los detalles técnicos quedan sólo en consola de desarrollo.

## Login

### Móvil

- pantalla completa;
- encabezado compacto;
- eliminar textos largos;
- segmented control/tabs grandes para Ingresar, Registrarme y Recuperar;
- inputs de 52–56 px;
- botón principal ancho completo;
- mensajes breves cerca de la acción;
- sin explicaciones técnicas.

### Escritorio

Puede conservar composición a dos paneles, simplificada y con el formulario como foco principal.

## Dashboard

### Móvil

Orden:

1. app bar;
2. resumen operativo con pocos KPI;
3. reservas de hoy/próximas;
4. ocupación;
5. acciones rápidas;
6. FAB Nueva reserva.

No encoger el planning desktop. En móvil se mostrará como lista/cards por propiedad y unidad, con navegación temporal simple.

### Tablet y escritorio

Mantener mayor densidad y planning completo, adaptado al sistema Material 3.

## Listados

### Móvil

Usuarios, propiedades, unidades y reservas se muestran como cards/listas táctiles con:

- título;
- 1–3 datos secundarios;
- estado;
- acción principal;
- acciones secundarias en menú de tres puntos cuando convenga.

No usar scroll horizontal de tabla como experiencia primaria móvil.

### Escritorio

Las tablas se conservan cuando aporten densidad y comparación rápida.

## Formularios

- una columna en móvil;
- secciones claras;
- ayudas sólo cuando evitan errores;
- botones principales visibles y grandes;
- errores debajo del campo;
- evitar grids rígidos con desbordes;
- usar sticky action bar cuando ayude.

## Responsive

Breakpoints funcionales:

- hasta 599 px: teléfono;
- 600–839 px: tablet compacta;
- 840–1199 px: tablet grande / desktop angosto;
- 1200 px o más: desktop.

El cambio de patrón depende del comportamiento, no sólo del ancho.

## Arquitectura de implementación

### CSS

El `styles.css` actual contiene varias generaciones de reglas. El rediseño debe consolidar progresivamente las capas y reducir conflictos.

Orden objetivo:

1. tokens;
2. base;
3. layout;
4. navegación;
5. componentes;
6. formularios;
7. data display;
8. estilos por página;
9. responsive.

### Componentes compartidos

`js/app-helpers.js` seguirá concentrando navegación y helpers compartidos, pero renderizará:

- bottom navigation;
- drawer;
- navegación desktop;
- app bar;
- mensajes simplificados.

La autorización y reglas de acceso no cambian.

### Archivos alcanzados

- `login.html`
- `dashboard.html`
- `usuarios.html`
- `nuevo_usuario.html`
- `propiedades.html`
- `unidades.html`
- `nueva_reserva.html`
- `css/styles.css`
- `js/app-helpers.js`
- JS de páginas sólo si se necesita para render adaptativo o copy.

## Fuera de alcance

No cambiar:

- modelo de datos Firestore;
- colecciones;
- permisos por rol;
- autenticación Firebase;
- reglas Firestore;
- bloqueo de reservas;
- cálculo de disponibilidad;
- lógica de alta/baja/reactivación;
- URLs públicas actuales salvo necesidad técnica explícita.

## Accesibilidad

- contraste suficiente;
- foco visible;
- labels reales;
- aria-label en botones sólo icono;
- objetivos táctiles adecuados;
- no depender sólo del color;
- respetar `prefers-reduced-motion`.

## Manejo de errores

Tres niveles:

1. campo: error junto al input;
2. operación: snackbar/callout breve;
3. bloqueante: pantalla o diálogo simple con siguiente paso.

Los detalles técnicos pueden ir a `console.error`, nunca a la UI.

## Estrategia de implementación

1. tokens y componentes Material 3;
2. navegación adaptativa compartida;
3. login;
4. dashboard;
5. listados;
6. formularios;
7. limpieza de copy técnico;
8. validación responsive y accesibilidad.

## Criterios de aceptación

- móvil usable sin scroll horizontal accidental;
- acciones principales con tamaño táctil adecuado;
- navegación inferior y FAB funcionales;
- drawer administrativo funcional;
- sin mensajes técnicos visibles;
- login completo y claro en 393×852;
- listados móviles en cards/listas, no tablas comprimidas;
- desktop conserva densidad y usabilidad;
- roles y permisos funcionan igual que antes;
- login, recuperación, creación de usuarios, propiedades, unidades y reservas siguen funcionando;
- no se altera el modelo de datos ni la seguridad.
