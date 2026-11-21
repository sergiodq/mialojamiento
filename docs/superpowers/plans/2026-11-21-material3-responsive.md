# Material 3 responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Interfaz Material 3 coherente y usable desde teléfonos de 320 px hasta escritorio amplio.

**Architecture:** Consolidar la capa visual existente y reparar navegación compartida. Mantener el stack y los flujos de datos actuales.

**Tech Stack:** HTML, CSS, JavaScript, SVG, node:test, jsdom, navegador para QA visual.

**Spec:** docs/superpowers/specs/2026-11-21-material3-responsive-design.md

## Global Constraints

No modificar reglas, datos, roles ni cálculos de reservas. SVG locales. Objetivos táctiles mínimos de 48 px. No desborde horizontal del documento; planning de escritorio puede desplazarse dentro de su contenedor.

## Review Focus

- Enlaces con iconos mantienen destinos y permisos reales.
- Cambio de perfil/caché no deja acciones de un rol anterior.
- Drawer se cierra por Escape, devuelve foco y no bloquea escritorio al redimensionar.
- Listados y formularios caben en 320 px y con texto largo/zoom.
- Safe areas, teclado y pantallas horizontales no ocultan acciones.

## Tasks

- [x] 1. Tests DOM de navegación real, actualización del sidebar, drawer y atributos accesibles; reproducir fallos y corregir `js/material3-ui.js`.
- [x] 2. Sustituir `css/material3.css` por tokens y componentes legibles; integrar carga explícita y metadatos en las siete páginas; ajustar umbral visual del planning a 840 px.
- [x] 3. Preview con fixtures locales y bloqueo de escrituras. Revisar dimensiones del spec y corregir desbordes observados; capturas móvil/tablet/desktop.
- [ ] 4. Suite completa, revisión independiente, commit/PR/CI, despliegue por Vercel y verificación final.

## Ledger

- Base limpia: main, 733c520. Rama de trabajo: codex/material3-responsive.
- Hallazgo: `getSidebarLinks` incorpora los glifos de los iconos al nombre; el modelo espera etiquetas limpias y pierde destinos/FAB. La capa responsive actual oculta el sidebar hasta 1024 px pero solo ofrece navegación inferior hasta 599 px.

- Validación: 47 pruebas de aplicación aprobadas; navegación de los cuatro roles revisada con fixtures sin escrituras.
- QA: 70 combinaciones de página/tamaño; se corrigieron mínimo de ancho de propiedades, altura accidental del filtro en tablet y selector legacy de tres pestañas en login.
- Revisión independiente: sin hallazgos; corrección de re-decoración de iconos verificada con RED/GREEN y sin loops del observer.
