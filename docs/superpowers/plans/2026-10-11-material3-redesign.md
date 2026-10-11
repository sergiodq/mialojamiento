# MiAlojamiento Material 3 Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar MiAlojamiento con una interfaz mobile-first inspirada en Material Design 3, manteniendo intacta la lógica de autenticación, permisos, reservas y datos.

**Architecture:** La lógica actual se conserva. El cambio se concentra en `css/styles.css`, markup de páginas y componentes compartidos de `js/app-helpers.js`. En móvil se usa bottom navigation + FAB + drawer; en desktop se conserva navegación lateral Material 3.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Firebase Authentication, Firestore.

**Spec:** `docs/superpowers/specs/2026-10-11-material3-redesign-design.md`

## Global Constraints

- No cambiar modelo de datos, colecciones, Firestore rules ni permisos por rol.
- No cambiar lógica de disponibilidad o bloqueo de reservas.
- No mostrar Firebase, Firestore, Authentication, UID, índices ni estados internos al usuario.
- Hasta 599 px: teléfono; 600–839 px: tablet compacta; 840–1199 px: tablet grande; 1200+ desktop.
- Objetivos táctiles mínimos de 48 px; botones principales móviles 52–56 px; FAB 56 px.
- Sin scroll horizontal accidental en móvil.
- Respetar `prefers-reduced-motion`, foco visible y contraste suficiente.

## Review Focus

- Usuario con rol `recepcion`: no debe ver opciones administrativas y sí debe poder reservar.
- Usuario `admin`: debe conservar acceso a usuarios, propiedades y reservas.
- `superadmin`: debe conservar su navegación y alcance sin exponer campos técnicos.
- Teléfono de 393×852: login, dashboard y formularios deben entrar correctamente sin overflow horizontal.
- Errores Firebase inesperados: la UI debe mostrar mensajes simples y la consola puede conservar detalle técnico.

---

### Task 1: Sistema visual Material 3

**Files:**
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: clases HTML existentes.
- Produces: tokens y clases compartidas para app bar, buttons, cards, fields, chips, FAB, navigation, drawer y responsive.

- [ ] Consolidar tokens Material 3 y tamaños táctiles.
- [ ] Rediseñar botones, campos, cards, chips, badges, snackbars y superficies.
- [ ] Crear reglas responsive por los cuatro breakpoints del spec.
- [ ] Verificar ausencia de overflow horizontal a 393 px.
- [ ] Commit: `feat: add Material 3 visual system`.

### Task 2: Navegación adaptativa compartida

**Files:**
- Modify: `js/app-helpers.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `getNavItems(profile)`, permisos actuales y `currentPage`.
- Produces: sidebar desktop, bottom navigation móvil, FAB de nueva reserva y drawer para acciones secundarias.

- [ ] Mantener filtrado por permisos actual.
- [ ] Renderizar navegación móvil con Inicio, Reservas, Propiedades y Más según permisos.
- [ ] Añadir drawer móvil para Usuarios, perfil y cerrar sesión.
- [ ] Añadir FAB de Nueva reserva sólo cuando `canCreateReservations(profile)` sea true.
- [ ] Verificar roles `superadmin`, `admin` y `recepcion`.
- [ ] Commit: `feat: add adaptive Material navigation`.

### Task 3: Login Material 3 y copy no técnico

**Files:**
- Modify: `login.html`
- Modify: `js/auth.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: flujo actual `loginUser`, `registerPendingUser`, `sendReset`.
- Produces: misma funcionalidad con copy de usuario final.

- [ ] Simplificar encabezado y textos.
- [ ] Mantener Ingresar / Registrarme / Recuperar como segmented control táctil.
- [ ] Traducir errores técnicos a mensajes de negocio.
- [ ] Mantener `console.error` para detalle técnico cuando corresponda.
- [ ] Verificar login y recuperación en 393×852.
- [ ] Commit: `feat: redesign authentication screens`.

### Task 4: Dashboard mobile-first

**Files:**
- Modify: `dashboard.html`
- Modify: JS de dashboard si el render actual necesita wrappers/clases adaptativas.
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: datos y cálculos actuales.
- Produces: jerarquía visual mobile-first sin cambiar consultas.

- [ ] Priorizar resumen operativo y reservas próximas.
- [ ] Convertir bloques densos en cards/listas móviles.
- [ ] Mantener planning completo en tablet grande/desktop.
- [ ] Integrar FAB y bottom navigation sin tapar contenido.
- [ ] Commit: `feat: redesign dashboard for mobile`.

### Task 5: Usuarios y nuevo usuario

**Files:**
- Modify: `usuarios.html`
- Modify: `nuevo_usuario.html`
- Modify: JS de usuarios sólo para copy/render adaptativo si hace falta.
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: CRUD y permisos existentes.
- Produces: cards móviles y tabla desktop, formulario de una columna en móvil.

- [ ] Mantener todas las acciones existentes.
- [ ] Ocultar estados técnicos y mostrar estados comprensibles.
- [ ] Adaptar acciones secundarias para móvil.
- [ ] Commit: `feat: redesign user management`.

### Task 6: Propiedades y unidades

**Files:**
- Modify: `propiedades.html`
- Modify: `unidades.html`
- Modify: JS de páginas sólo si hace falta para wrappers/copy.
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: CRUD y permisos existentes.
- Produces: cards/listas móviles, formularios Material 3 y vistas densas desktop.

- [ ] Convertir listados móviles a cards táctiles.
- [ ] Mantener tablas o grids densos en desktop cuando aporten valor.
- [ ] Asegurar inputs y acciones de mínimo 48 px.
- [ ] Commit: `feat: redesign properties and units`.

### Task 7: Nueva reserva

**Files:**
- Modify: `nueva_reserva.html`
- Modify: JS de reserva sólo para copy/render adaptativo si hace falta.
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: validaciones, disponibilidad y creación de reserva actuales.
- Produces: formulario Material 3 mobile-first sin cambiar lógica.

- [ ] Una columna en móvil y secciones claras.
- [ ] Acción primaria visible y grande.
- [ ] Errores junto al campo u operación, sin mensajes técnicos.
- [ ] Verificar que reservas válidas e inválidas se comporten igual que antes.
- [ ] Commit: `feat: redesign reservation flow`.

### Task 8: Limpieza global de copy y verificación

**Files:**
- Modify: JS de páginas que aún expongan mensajes técnicos.
- Modify: `css/styles.css` sólo para correcciones finales.

**Interfaces:**
- Consumes: aplicación completa.
- Produces: experiencia consistente Material 3.

- [ ] Buscar y reemplazar mensajes visibles con `Firebase`, `Firestore`, `Authentication`, `UID`, `pendiente_auth` y equivalentes internos.
- [ ] Verificar login, recuperación, dashboard, usuarios, propiedades, unidades y reservas.
- [ ] Verificar 393×852, tablet compacta y desktop.
- [ ] Verificar navegación y permisos de los tres roles.
- [ ] Verificar foco, labels, aria-label y reduced motion.
- [ ] Commit: `chore: polish Material 3 responsive experience`.
