const TECHNICAL_RULES = [
  { test: /cuenta existe en authentication.*perfil válido.*firestore/i, message: 'No pudimos acceder a tu cuenta. Contactá al administrador.' },
  { test: /correo ya existe en authentication/i, message: 'Ya existe una cuenta con este correo.' },
  { test: /auth\/email-already-in-use|email-already-in-use/i, message: 'Ya existe una cuenta con este correo.' },
  { test: /auth\/invalid-credential|invalid-credential|wrong-password|user-not-found/i, message: 'El correo o la contraseña no son correctos.' },
  { test: /auth\/too-many-requests|too-many-requests/i, message: 'Hiciste varios intentos seguidos. Esperá un momento y probá nuevamente.' },
  { test: /auth\/network-request-failed|network-request-failed/i, message: 'No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.' },
  { test: /pendiente_auth/i, message: 'Tu cuenta todavía no está habilitada.' },
  { test: /requiere_reset/i, message: 'Necesitás cambiar tu contraseña antes de continuar.' },
  { test: /firebase|firestore|authentication|\buid\b|índice|index/i, message: 'No pudimos completar la operación. Intentá nuevamente.' }
];

export function friendlyMessage(value = '') {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const rule = TECHNICAL_RULES.find(item => item.test.test(text));
  return rule ? rule.message : text;
}

function normalizeHref(href = '') {
  return String(href).split('#')[0].split('?')[0].replace(/^\.\//, '');
}

function normalizeLabel(label = '') {
  return String(label).trim().toLowerCase();
}

export function isMobileNavItemActive(item, currentHref = '', currentHash = '') {
  const target = normalizeHref(item?.href || '');
  const current = normalizeHref(currentHref || '');
  if (target !== current) return false;
  if (item?.label === 'Reservas') return currentHash === '#planningBoard';
  if (item?.label === 'Inicio' && current === 'dashboard.html') return currentHash !== '#planningBoard';
  return true;
}

export function buildMobileNavModel(links = [], currentHref = '') {
  const normalized = links.filter(item => item?.href).map(item => ({
    label: String(item.label || '').trim(),
    href: String(item.href || '').trim()
  }));
  const byLabel = (name) => normalized.find(item => normalizeLabel(item.label) === name);
  const dashboard = byLabel('dashboard');
  const properties = byLabel('propiedades');
  const users = byLabel('usuarios');
  const newReservation = byLabel('nueva reserva');
  const primary = [];
  if (dashboard) primary.push({ label: 'Inicio', href: dashboard.href, icon: 'home' });
  if (newReservation && dashboard) primary.push({ label: 'Reservas', href: `${normalizeHref(dashboard.href)}#planningBoard`, icon: 'calendar_month' });
  if (properties) primary.push({ label: 'Propiedades', href: properties.href, icon: 'apartment' });
  return {
    primary,
    secondary: users ? [{ label: 'Usuarios', href: users.href, icon: 'group' }] : [],
    fab: newReservation ? { label: 'Nueva reserva', href: newReservation.href, icon: 'add' } : null,
    currentHref: normalizeHref(currentHref)
  };
}

function ensureStylesheet() {
  if (document.querySelector('link[data-material3]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/material3.css';
  link.dataset.material3 = 'true';
  document.head.appendChild(link);
}

function createIcon(name) {
  const span = document.createElement('span');
  span.className = 'm3-icon';
  span.setAttribute('aria-hidden', 'true');
  const icons = { home: '⌂', calendar_month: '▣', apartment: '▦', group: '●●', more_horiz: '•••', add: '+', close: '×' };
  span.textContent = icons[name] || '•';
  return span;
}

function sanitizeVisibleText(root = document) {
  const selectors = ['.callout', '.callout *', '.notice', '.notice *', '.toast', '.toast *', '#authMessage', '#loginFeedback', '#registerFeedback', '#resetFeedback', '#formFeedback', '.field small'];
  root.querySelectorAll?.(selectors.join(',')).forEach((node) => {
    const original = node.textContent?.trim();
    if (!original || node.children.length) return;
    const clean = friendlyMessage(original);
    if (clean !== original) node.textContent = clean;
  });
  const emailHint = root.querySelector?.('#emailLockHint');
  if (emailHint) emailHint.textContent = 'El correo de este usuario no puede modificarse.';
  const propertiesHint = root.querySelector?.('#propiedadesSelectedHint');
  if (propertiesHint) propertiesHint.textContent = 'Seleccioná una o varias propiedades para este usuario.';
}

function decorateTables(root = document) {
  root.querySelectorAll?.('table').forEach((table) => {
    table.classList.add('m3-responsive-table');
    const labels = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach((row) => {
      [...row.children].forEach((cell, index) => {
        if (cell.tagName === 'TD' && labels[index]) cell.dataset.label = labels[index];
      });
    });
  });
}

function openDrawer(drawer, backdrop) {
  drawer.classList.add('is-open');
  backdrop.classList.add('is-open');
  document.body.classList.add('m3-drawer-open');
}

function closeDrawer(drawer, backdrop) {
  drawer.classList.remove('is-open');
  backdrop.classList.remove('is-open');
  document.body.classList.remove('m3-drawer-open');
}

function getSidebarLinks(sidebar) {
  return [...sidebar.querySelectorAll('.nav-link')].map(link => ({ label: link.textContent.trim(), href: link.getAttribute('href') || '' }));
}

function renderAdaptiveChrome() {
  if (document.body.classList.contains('login-page')) return;
  const sidebar = document.querySelector('#sidebar');
  if (!sidebar || !sidebar.querySelector('.nav-link') || document.querySelector('.m3-bottom-nav')) return;
  const model = buildMobileNavModel(getSidebarLinks(sidebar), window.location.pathname.split('/').pop() || 'dashboard.html');
  const nav = document.createElement('nav');
  nav.className = 'm3-bottom-nav';
  nav.setAttribute('aria-label', 'Navegación principal');

  model.primary.forEach(item => {
    const a = document.createElement('a');
    a.className = 'm3-bottom-nav-item';
    a.href = item.href;
    a.dataset.m3Label = item.label;
    if (isMobileNavItemActive(item, model.currentHref, window.location.hash)) a.classList.add('is-active');
    a.appendChild(createIcon(item.icon));
    const label = document.createElement('span');
    label.textContent = item.label;
    a.appendChild(label);
    nav.appendChild(a);
  });

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'm3-bottom-nav-item';
  more.appendChild(createIcon('more_horiz'));
  const moreLabel = document.createElement('span');
  moreLabel.textContent = 'Más';
  more.appendChild(moreLabel);
  nav.appendChild(more);
  document.body.appendChild(nav);

  const refreshActiveState = () => {
    nav.querySelectorAll('a.m3-bottom-nav-item').forEach((link) => {
      link.classList.toggle('is-active', isMobileNavItemActive({
        label: link.dataset.m3Label,
        href: link.getAttribute('href') || ''
      }, model.currentHref, window.location.hash));
    });
  };
  window.addEventListener('hashchange', refreshActiveState);
  refreshActiveState();

  const backdrop = document.createElement('div');
  backdrop.className = 'm3-drawer-backdrop';
  const drawer = document.createElement('aside');
  drawer.className = 'm3-drawer';
  drawer.setAttribute('aria-label', 'Más opciones');
  drawer.innerHTML = `<div class="m3-drawer-header"><div><strong>MiAlojamiento</strong><span>Más opciones</span></div><button type="button" class="m3-icon-button" data-m3-close aria-label="Cerrar">×</button></div><div class="m3-drawer-links"></div><div class="m3-drawer-profile"></div>`;
  const drawerLinks = drawer.querySelector('.m3-drawer-links');
  model.secondary.forEach(item => {
    const a = document.createElement('a');
    a.className = 'm3-drawer-link';
    a.href = item.href;
    a.appendChild(createIcon(item.icon));
    const label = document.createElement('span');
    label.textContent = item.label;
    a.appendChild(label);
    drawerLinks.appendChild(a);
  });

  const sidebarUser = sidebar.querySelector('.sidebar-user');
  const profile = drawer.querySelector('.m3-drawer-profile');
  if (sidebarUser) profile.appendChild(sidebarUser.cloneNode(true));
  const logout = document.createElement('button');
  logout.type = 'button';
  logout.className = 'm3-drawer-logout';
  logout.textContent = 'Cerrar sesión';
  logout.addEventListener('click', () => sidebar.querySelector('#btnLogoutSidebar')?.click());
  profile.appendChild(logout);

  document.body.append(backdrop, drawer);
  more.addEventListener('click', () => openDrawer(drawer, backdrop));
  backdrop.addEventListener('click', () => closeDrawer(drawer, backdrop));
  drawer.querySelector('[data-m3-close]')?.addEventListener('click', () => closeDrawer(drawer, backdrop));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDrawer(drawer, backdrop); });

  if (model.fab && model.currentHref !== normalizeHref(model.fab.href)) {
    document.querySelector('#quickNuevaReservaFab')?.setAttribute('hidden', '');
    const fab = document.createElement('a');
    fab.className = 'm3-fab';
    fab.href = model.fab.href;
    fab.setAttribute('aria-label', model.fab.label);
    fab.appendChild(createIcon('add'));
    const text = document.createElement('span');
    text.textContent = model.fab.label;
    fab.appendChild(text);
    document.body.appendChild(fab);
  }
}

function startObservers() {
  const observer = new MutationObserver(() => {
    sanitizeVisibleText(document);
    decorateTables(document);
    renderAdaptiveChrome();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

export function initMaterial3UI() {
  if (typeof document === 'undefined') return;
  ensureStylesheet();
  const run = () => {
    sanitizeVisibleText(document);
    decorateTables(document);
    renderAdaptiveChrome();
    startObservers();
    document.documentElement.classList.add('m3-ready');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') initMaterial3UI();
