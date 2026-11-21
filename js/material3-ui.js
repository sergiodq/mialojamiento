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
  if (dashboard) primary.push({ label: 'Reservas', href: `${normalizeHref(dashboard.href)}#planningBoard`, icon: 'calendar_month' });
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
  const paths = {
    home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
    calendar_month: 'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 3v4M17 3v4M3 10h18M7 14h2M15 14h2M7 17h2M15 17h2',
    apartment: 'M4 21V5h10v16M14 10h6v11M2 21h20M7 8h4M7 12h4M7 16h4M17 13h1M17 17h1',
    group: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87',
    more_horiz: 'M4 12h.01M12 12h.01M20 12h.01',
    add: 'M12 5v14M5 12h14',
    close: 'M6 6l12 12M18 6 6 18',
    logout: 'M9 4H4v16h5M14 8l4 4-4 4M8 12h12'
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', name === 'more_horiz' ? '4' : '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', paths[name] || paths.home);
  svg.appendChild(path);
  span.appendChild(svg);
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
  const emailHintText = 'El correo de este usuario no puede modificarse.';
  // Reassigning even identical text creates a childList mutation and would
  // retrigger our observer forever on the user form.
  if (emailHint && emailHint.textContent !== emailHintText) emailHint.textContent = emailHintText;
  const propertiesHint = root.querySelector?.('#propiedadesSelectedHint');
  const propertiesHintText = 'Seleccioná una o varias propiedades para este usuario.';
  if (propertiesHint && propertiesHint.textContent !== propertiesHintText) propertiesHint.textContent = propertiesHintText;
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

const sessions = new WeakMap();

function getSidebarLinks(sidebar) {
  return [...sidebar.querySelectorAll('.nav-link')].map(link => ({
    label: (link.querySelector('span:not(.nav-icon)')?.textContent || link.textContent).trim(),
    href: link.getAttribute('href') || ''
  }));
}

function renderAdaptiveChrome(session) {
  const { doc, win } = session;
  if (doc.body.classList.contains('login-page')) return;
  const sidebar = doc.querySelector('#sidebar');
  if (!sidebar?.querySelector('.nav-link')) return;
  const links = getSidebarLinks(sidebar);
  const profileHtml = sidebar.querySelector('.sidebar-user')?.innerHTML || '';
  const signature = JSON.stringify([links, profileHtml]);
  const iconFor = { 'dashboard.html':'home', 'usuarios.html':'group', 'propiedades.html':'apartment', 'nueva_reserva.html':'add' };
  sidebar.querySelectorAll('.nav-link').forEach(link => {
    const icon = link.querySelector('.nav-icon');
    if (icon && !icon.querySelector('svg')) icon.replaceChildren(createIcon(iconFor[normalizeHref(link.getAttribute('href'))]));
    link.setAttribute('aria-label', links.find(item => item.href === link.getAttribute('href'))?.label || 'Navegar');
    if (link.classList.contains('active')) link.setAttribute('aria-current','page');
  });
  if (signature === session.signature) return;
  session.disposeChrome?.();
  session.signature = signature;
  const model = buildMobileNavModel(links, win.location.pathname.split('/').pop() || 'dashboard.html');

  const nav = doc.createElement('nav');
  nav.className = 'm3-bottom-nav';
  nav.setAttribute('aria-label','Navegación principal');
  for (const item of model.primary) {
    const a = doc.createElement('a');
    a.className = 'm3-bottom-nav-item';
    a.href = item.href;
    a.dataset.m3Label = item.label;
    a.appendChild(createIcon(item.icon));
    const label = doc.createElement('span');
    label.textContent = item.label;
    a.appendChild(label);
    nav.appendChild(a);
  }
  const more = doc.createElement('button');
  more.type = 'button';
  more.className = 'm3-bottom-nav-item';
  more.setAttribute('aria-expanded','false');
  more.setAttribute('aria-controls','m3-options-drawer');
  more.setAttribute('aria-haspopup','dialog');
  more.appendChild(createIcon('more_horiz'));
  const moreLabel = doc.createElement('span');
  moreLabel.textContent = 'Más';
  more.appendChild(moreLabel);
  nav.appendChild(more);

  const backdrop = doc.createElement('div');
  backdrop.className = 'm3-drawer-backdrop';
  backdrop.hidden = true;
  backdrop.setAttribute('aria-hidden','true');
  const drawer = doc.createElement('aside');
  drawer.id = 'm3-options-drawer';
  drawer.className = 'm3-drawer';
  drawer.hidden = true;
  drawer.inert = true;
  drawer.setAttribute('role','dialog');
  drawer.setAttribute('aria-modal','true');
  drawer.setAttribute('aria-label','Más opciones');
  drawer.setAttribute('aria-hidden','true');
  drawer.innerHTML = '<div class="m3-drawer-header"><div><strong>MiAlojamiento</strong><span>Tu espacio de gestión</span></div><button type="button" class="m3-icon-button" data-m3-close aria-label="Cerrar menú"></button></div><div class="m3-drawer-links"></div><div class="m3-drawer-profile"></div>';
  const closeButton = drawer.querySelector('[data-m3-close]');
  closeButton.appendChild(createIcon('close'));
  for (const item of model.secondary) {
    const a = doc.createElement('a');
    a.className = 'm3-drawer-link';
    a.href = item.href;
    a.appendChild(createIcon(item.icon));
    const label = doc.createElement('span');
    label.textContent = item.label;
    a.appendChild(label);
    drawer.querySelector('.m3-drawer-links').appendChild(a);
  }
  const sourceProfile = sidebar.querySelector('.sidebar-user');
  if (sourceProfile) drawer.querySelector('.m3-drawer-profile').appendChild(sourceProfile.cloneNode(true));
  const logout = doc.createElement('button');
  logout.type = 'button';
  logout.className = 'm3-drawer-logout';
  logout.append(createIcon('logout'),doc.createTextNode('Cerrar sesión'));
  logout.addEventListener('click',()=>sidebar.querySelector('#btnLogoutSidebar')?.click());
  drawer.querySelector('.m3-drawer-profile').appendChild(logout);

  let blocked = [];
  function close(restoreFocus=true) {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    drawer.hidden = true;
    backdrop.hidden = true;
    drawer.inert = true;
    drawer.setAttribute('aria-hidden','true');
    more.setAttribute('aria-expanded','false');
    doc.body.classList.remove('m3-drawer-open');
    blocked.forEach(([element,inert])=>{element.inert=inert;});
    blocked = [];
    if (restoreFocus && more.isConnected && win.innerWidth < 1200) more.focus();
  }
  function open() {
    drawer.hidden = false;
    backdrop.hidden = false;
    drawer.inert = false;
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    drawer.setAttribute('aria-hidden','false');
    more.setAttribute('aria-expanded','true');
    doc.body.classList.add('m3-drawer-open');
    blocked = [...doc.body.children].filter(el => el !== drawer && el !== backdrop && !['SCRIPT','STYLE','LINK'].includes(el.tagName)).map(el=>[el,el.inert]);
    blocked.forEach(([element])=>{element.inert=true;});
    closeButton.focus();
  }
  const keydown = event => {
    if (!drawer.classList.contains('is-open')) return;
    if (event.key === 'Escape') { event.preventDefault();close(); }
    if (event.key === 'Tab') {
      const focusable = [...drawer.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]')];
      const first=focusable[0],last=focusable.at(-1);
      if (event.shiftKey && doc.activeElement === first) {event.preventDefault();last.focus();}
      else if (!event.shiftKey && doc.activeElement === last) {event.preventDefault();first.focus();}
    }
  };
  const resize = () => {if (win.innerWidth >= 1200) close(false);};
  const refresh = () => nav.querySelectorAll('a').forEach(a => {
    const active = isMobileNavItemActive({label:a.dataset.m3Label,href:a.getAttribute('href')},model.currentHref,win.location.hash);
    a.classList.toggle('is-active',active);
    if (active) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
  });
  more.addEventListener('click',open);
  backdrop.addEventListener('click',()=>close());
  closeButton.addEventListener('click',()=>close());
  doc.addEventListener('keydown',keydown);
  win.addEventListener('hashchange',refresh);
  win.addEventListener('resize',resize);
  doc.body.append(nav,backdrop,drawer);
  refresh();
  let fab;
  if (model.fab && model.currentHref !== normalizeHref(model.fab.href)) {
    doc.querySelector('#quickNuevaReservaFab')?.setAttribute('hidden','');
    fab = doc.createElement('a');
    fab.className='m3-fab';
    fab.href=model.fab.href;
    fab.setAttribute('aria-label',model.fab.label);
    const label=doc.createElement('span');
    label.textContent=model.fab.label;
    fab.append(createIcon('add'),label);
    doc.body.appendChild(fab);
  }
  session.disposeChrome=()=>{
    close(false);
    doc.removeEventListener('keydown',keydown);
    win.removeEventListener('hashchange',refresh);
    win.removeEventListener('resize',resize);
    [nav,backdrop,drawer,fab].forEach(el=>el?.remove());
  };
}

export function initMaterial3UI() {
  if (typeof document === 'undefined' || sessions.has(document)) return;
  ensureStylesheet();
  const doc=document,win=doc.defaultView;
  const session={doc,win,signature:null,disposeChrome:null};
  sessions.set(doc,session);
  const run=()=>{
    const update=()=>{sanitizeVisibleText(doc);decorateTables(doc);renderAdaptiveChrome(session);};
    update();
    const observer=new win.MutationObserver(update);
    observer.observe(doc.body,{childList:true,subtree:true,characterData:true});
    // bfcache retains the document and its controls; only disconnect observers on pagehide.
    win.addEventListener('pagehide',()=>observer.disconnect());
    win.addEventListener('pageshow',()=>{observer.observe(doc.body,{childList:true,subtree:true,characterData:true});update();});
    doc.documentElement.classList.add('m3-ready');
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded',run,{once:true}); else run();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') initMaterial3UI();
