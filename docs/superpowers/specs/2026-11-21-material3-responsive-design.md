# Material 3 · adaptación completa

Pedido del usuario: dar a MiAlojamiento aspecto de app Material Design 3, adaptable a los dispositivos más comunes. Se aplica el diseño existente `2026-10-11-material3-redesign-design.md` al producto actual y sus cuatro roles.

## Dirección

Identidad azul/violeta, superficies tonales claras, iconos vectoriales coherentes, jerarquía tipográfica y controles de 48–56 px. Se conserva HTML/CSS/JS: completar la capa compartida evita introducir un framework y reescribir los flujos existentes. Una librería externa de componentes implicaría migraciones innecesarias para este alcance.

## Adaptación

- 320–599 px: barra inferior, FAB cuando el rol permite reservar, listados en tarjetas, formularios de una columna y planning en lista por unidad.
- 600–1199 px: rail de navegación, drawer para cuenta y opciones secundarias, formularios de una o dos columnas según el espacio disponible. Planning en lista hasta 839 px, tabla a partir de 840 px.
- 1200 px o más: sidebar persistente, tablas densas y formularios de dos columnas; a partir de 1440 px se aprovecha mayor anchura sin estirar demasiado la lectura.
- Pantallas bajas/horizontales: scroll vertical natural, controles accesibles, sin paneles recortados por alturas rígidas. Safe areas, zoom y textos largos no deben tapar acciones.

## Componentes

Una sola hoja Material 3 legible cargada explícitamente al final del head de las siete páginas; estilos de navegación, tablas/tarjetas, campos, badges, botones, login y planning en esa capa. Los iconos se dibujan con SVG local.

La navegación se obtiene de enlaces autorizados del sidebar y se actualiza si cambia el perfil. Drawer con nombre accesible, Escape, foco contenido y restauración al disparador. Botones de icono con etiquetas. Foco visible y movimiento reducido.

## Verificación

320×568, 360×800, 390×844, 412×915; horizontal 844×390; tablets 768×1024 y 1024×768; escritorio 1280×800 y 1440×900. Revisar login, dashboard, usuarios, nuevo usuario, propiedades, unidades y reserva. Comprobar desborde real del documento, disposición, navegación por teclado y contenidos largos. Datos de prueba solo locales; smoke autenticado de producción sin guardar formularios.

## Invariantes

No modificar Firestore, autorización, modelo de datos, cálculos de reservas ni cuentas. Conservar restricciones de superadmin, soporte, admin y recepción. Publicación por el flujo existente de GitHub/Vercel, tras validación.
