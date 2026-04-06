import {
  auth,
  authReady,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  runTransaction,
  onAuthStateChanged,
  signOut
} from './firebase-config.js';

export const APP_NAME = 'MiAlojamiento';

export const ROLES = Object.freeze({
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  RECEPCION: 'recepcion'
});

export const REGISTRATION_STATES = Object.freeze({
  PENDIENTE_AUTH: 'pendiente_auth',
  REQUIERE_RESET: 'requiere_reset',
  ACTIVO: 'activo'
});

export const RESERVATION_STATUSES = [
  'pendiente',
  'pendiente de pago',
  'confirmada',
  'bloqueada',
  'mantenimiento',
  'cancelada'
];

export const ACTIVE_RESERVATION_STATUSES = new Set([
  'pendiente',
  'pendiente de pago',
  'confirmada',
  'bloqueada',
  'mantenimiento'
]);

export const PROPERTY_TYPES = [
  'hotel',
  'apart hotel',
  'hostería',
  'cabaña',
  'departamento',
  'complejo'
];

export const UNIT_TYPES = [
  'single',
  'doble',
  'triple',
  'cuádruple',
  'suite',
  'departamento',
  'cabaña',
  'loft',
  'familiar'
];

export const GENERAL_AMENITIES = [
  'wifi',
  'desayuno',
  'estacionamiento',
  'pileta',
  'spa',
  'gimnasio',
  'pet friendly',
  'recepción 24h',
  'aire acondicionado',
  'restaurante',
  'traslado',
  'lavandería'
];

export const UNIT_AMENITIES = [
  'wifi',
  'tv',
  'frigobar',
  'aire',
  'cocina',
  'microondas',
  'smart tv',
  'escritorio',
  'balcón',
  'baño privado',
  'caja fuerte',
  'blackout'
];

export const BED_OPTIONS = [
  '1 cama single',
  '2 camas single',
  '1 cama matrimonial',
  '1 cama queen',
  '1 cama king',
  '1 sofá cama',
  '1 cama cucheta',
  '2 camas matrimoniales'
];

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function normalizeText(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
}

export function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map(v => String(v).trim()))];
}

export function generateInternalCode(prefix = 'ID') {
  const safePrefix = String(prefix || 'ID').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'ID';
  const timePart = Date.now().toString(36).slice(-5).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${safePrefix}-${timePart}${randomPart}`;
}

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatCurrencyARS(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(toNumber(value, 0));
}

export function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year}`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  try {
    const date = value.toDate ? value.toDate() : new Date(value);
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
  } catch {
    return String(value);
  }
}

export function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysISO(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function dateRangeNights(startISO, endISO) {
  const dates = [];
  if (!startISO || !endISO) return dates;
  let cursor = startISO;
  while (cursor < endISO) {
    dates.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return dates;
}

export function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

export function ensureToastWrap() {
  let wrap = qs('#toastWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toastWrap';
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  return wrap;
}

export function showToast(message, type = 'success', title = '') {
  const wrap = ensureToastWrap();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
    <div>${escapeHtml(message)}</div>
  `;
  wrap.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = '0.25s ease';
    setTimeout(() => toast.remove(), 260);
  }, 3600);
}

export function setFeedback(container, message = '', type = 'info') {
  if (!container) return;
  if (!message) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `<div class="callout ${escapeHtml(type)}">${escapeHtml(message)}</div>`;
}

export function setButtonLoading(button, isLoading, loadingText = 'Guardando...') {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = loadingText;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) button.innerHTML = button.dataset.originalText;
  }
}

export function renderCheckboxChips(container, values, selectedValues = [], inputName = 'items') {
  if (!container) return;
  const selectedSet = new Set((selectedValues || []).map(v => String(v).trim()));
  container.innerHTML = values
    .map(
      (value) => `
        <label class="checkbox-chip">
          <input type="checkbox" name="${escapeHtml(inputName)}" value="${escapeHtml(value)}" ${selectedSet.has(value) ? 'checked' : ''}>
          <span>${escapeHtml(value)}</span>
        </label>
      `
    )
    .join('');
}

export function getCheckedValues(container) {
  return uniqueStrings(qsa('input[type="checkbox"]:checked', container).map((input) => input.value));
}

export function getMultiSelectValues(select) {
  if (!select) return [];
  return [...select.selectedOptions].map(option => option.value).filter(Boolean);
}

export function fillMultiSelect(select, values = []) {
  const valueSet = new Set(values);
  [...select.options].forEach((option) => {
    option.selected = valueSet.has(option.value);
  });
}

export function renderStatusBadge(status = '') {
  const normalized = normalizeText(status);
  return `<span class="status-badge status-${normalized}">${escapeHtml(status || '—')}</span>`;
}

export function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

export function normalizeUserDoc(raw = {}, id = '') {
  const email = normalizeEmail(raw.email);
  const propiedadIds = uniqueStrings([
    ...ensureArray(raw.propiedad_ids),
    raw.propiedad_id || ''
  ]);

  return {
    id,
    nombre: raw.nombre || '',
    email,
    email_normalizado: raw.email_normalizado || email,
    rol: raw.rol || ROLES.RECEPCION,
    activo: raw.activo !== false,
    eliminado: raw.eliminado === true,
    uid: raw.uid || '',
    estado_registro: raw.estado_registro || (raw.uid ? REGISTRATION_STATES.ACTIVO : REGISTRATION_STATES.PENDIENTE_AUTH),
    empresa_id: raw.empresa_id || '',
    propiedad_id: raw.propiedad_id || '',
    propiedad_ids: propiedadIds,
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,
    creado_por: raw.creado_por || '',
    actualizado_por: raw.actualizado_por || '',
    eliminado_at: raw.eliminado_at || null,
    eliminado_por: raw.eliminado_por || ''
  };
}

export function normalizePropertyDoc(raw = {}, id = '') {
  return {
    id,
    nombre: raw.nombre || '',
    codigo: raw.codigo || '',
    codigo_normalizado: raw.codigo_normalizado || normalizeText(raw.codigo || ''),
    tipo: raw.tipo || '',
    pais: raw.pais || 'Argentina',
    provincia: raw.provincia || '',
    ciudad: raw.ciudad || '',
    codigo_postal: raw.codigo_postal || '',
    direccion: raw.direccion || '',
    descripcion: raw.descripcion || '',
    activo: raw.activo !== false,
    empresa_id: raw.empresa_id || '',
    check_in: raw.check_in || '14:00',
    check_out: raw.check_out || '10:00',
    recepcion_24h: raw.recepcion_24h === true,
    horario_recepcion_desde: raw.horario_recepcion_desde || '08:00',
    horario_recepcion_hasta: raw.horario_recepcion_hasta || '22:00',
    telefono: raw.telefono || '',
    email_contacto: raw.email_contacto || '',
    incluye_desayuno: raw.incluye_desayuno === true,
    admite_mascotas: raw.admite_mascotas === true,
    politica_cancelacion: raw.politica_cancelacion || '',
    observaciones_internas: raw.observaciones_internas || '',
    comodidades_generales: uniqueStrings(raw.comodidades_generales || []),
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,
    creado_por: raw.creado_por || '',
    actualizado_por: raw.actualizado_por || ''
  };
}

export function normalizeUnitDoc(raw = {}, id = '') {
  return {
    id,
    codigo: raw.codigo || '',
    nombre: raw.nombre || '',
    tipo_unidad: raw.tipo_unidad || '',
    capacidad_max: toNumber(raw.capacidad_max, 0),
    capacidad_adultos: toNumber(raw.capacidad_adultos, 0),
    capacidad_ninos: toNumber(raw.capacidad_ninos, 0),
    camas: uniqueStrings(raw.camas || []),
    comodidades: uniqueStrings(raw.comodidades || []),
    activa: raw.activa !== false,
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,
    creado_por: raw.creado_por || '',
    actualizado_por: raw.actualizado_por || ''
  };
}

export function computeUnidadKey(reserva = {}) {
  if (reserva.unidad_id) return String(reserva.unidad_id);
  return normalizeText(reserva.unidad || reserva.unidad_nombre || 'unidad-manual');
}

export function normalizeReservationDoc(raw = {}, id = '') {
  const fechaInicio = raw.fecha_inicio || '';
  const fechaFin = raw.fecha_fin || '';
  const unidad = raw.unidad || raw.unidad_nombre || '';
  const unidadId = raw.unidad_id || '';
  const unidadKey = raw.unidad_key || (unidadId ? unidadId : normalizeText(unidad || 'unidad-manual'));

  return {
    id,
    cliente: raw.cliente || '',
    propiedad_id: raw.propiedad_id || '',
    propiedad_nombre: raw.propiedad_nombre || '',
    unidad_id: unidadId,
    unidad,
    unidad_nombre: raw.unidad_nombre || unidad,
    unidad_key: unidadKey,
    capacidad_unidad: toNumber(raw.capacidad_unidad, 0),
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    estado: raw.estado || 'pendiente',
    huespedes: toNumber(raw.huespedes, 1),
    total: toNumber(raw.total, 0),
    observaciones: raw.observaciones || '',
    empresa_id: raw.empresa_id || '',
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,
    creado_por: raw.creado_por || '',
    actualizado_por: raw.actualizado_por || '',
    creado_por_nombre: raw.creado_por_nombre || '',
    actualizado_por_nombre: raw.actualizado_por_nombre || ''
  };
}

export function isSuperadmin(profile) {
  return profile?.rol === ROLES.SUPERADMIN;
}

export function isAdmin(profile) {
  return profile?.rol === ROLES.ADMIN;
}

export function isRecepcion(profile) {
  return profile?.rol === ROLES.RECEPCION;
}

export function canManageUsers(profile) {
  return isSuperadmin(profile) || isAdmin(profile);
}

export function canManageProperties(profile) {
  return isAdmin(profile);
}

export function canCreateReservations(profile) {
  return isAdmin(profile) || isRecepcion(profile);
}

export function canManageTargetUser(actor, target) {
  if (!actor || !target) return false;
  if (isSuperadmin(actor)) return true;
  if (!isAdmin(actor)) return false;
  if (target.rol === ROLES.SUPERADMIN) return false;
  return actor.empresa_id && actor.empresa_id === target.empresa_id;
}

export function canAccessProperty(profile, propiedad) {
  if (!profile || !propiedad) return false;
  if (isSuperadmin(profile)) return true;
  if (isAdmin(profile)) return profile.empresa_id === propiedad.empresa_id;
  const allowed = new Set(profile.propiedad_ids || []);
  return allowed.has(propiedad.id);
}

export function canAccessReservation(profile, reserva) {
  if (!profile || !reserva) return false;
  if (isSuperadmin(profile)) return true;
  if (isAdmin(profile)) return profile.empresa_id === reserva.empresa_id;
  const allowed = new Set(profile.propiedad_ids || []);
  return allowed.has(reserva.propiedad_id);
}

export function getNavItems(profile) {
  return [
    { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html', show: true, icon: '⌂' },
    { key: 'usuarios', label: 'Usuarios', href: 'usuarios.html', show: canManageUsers(profile), icon: 'U' },
    { key: 'propiedades', label: 'Propiedades', href: 'propiedades.html', show: canManageProperties(profile), icon: 'P' },
    { key: 'nueva-reserva', label: 'Nueva reserva', href: 'nueva_reserva.html', show: canCreateReservations(profile), icon: 'R' }
  ].filter(item => item.show);
}

export function renderSidebar(profile, currentPage = 'dashboard') {
  const container = qs('#sidebar');
  if (!container) return;

  const navItems = getNavItems(profile)
    .map((item) => `
      <a class="nav-link ${item.key === currentPage ? 'active' : ''}" href="${item.href}">
        <span class="nav-icon">${item.icon}</span>
        <span>${escapeHtml(item.label)}</span>
      </a>
    `)
    .join('');

  container.innerHTML = `
    <button type="button" class="sidebar-close-btn" data-sidebar-close aria-label="Cerrar menú">×</button>

    <div class="brand">
      <div class="brand-badge">M</div>
      <div>
        <h1>${APP_NAME}</h1>
        <span>Gestión hotelera simple, prolija y escalable</span>
      </div>
    </div>

    <div class="nav-group">
      ${navItems}
    </div>

    <div class="sidebar-footer">
      <div class="sidebar-user">
        <strong>${escapeHtml(profile.nombre || 'Usuario')}</strong>
        <small>${escapeHtml(profile.email || '')}</small><br>
        <small>Rol: ${escapeHtml(profile.rol || '—')}</small>
        ${profile.empresa_id ? `<br><small>Ámbito: ${escapeHtml(profile.empresa_id)}</small>` : ''}
      </div>
      <button id="btnLogoutSidebar" class="btn-ghost">Cerrar sesión</button>
    </div>
  `;

  setupResponsiveSidebarControls();
}

export function renderTopbar({ title, subtitle = '', actionsHtml = '' }) {
  const topbar = qs('#topbar');
  if (!topbar) return;
  topbar.innerHTML = `
    <div class="topbar-leading">
      <button type="button" class="mobile-sidebar-toggle" data-sidebar-open aria-label="Abrir menú">☰</button>
      <div class="title-block">
        <h2>${escapeHtml(title)}</h2>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
      </div>
    </div>
    <div class="topbar-actions">${actionsHtml}</div>
  `;

  setupResponsiveSidebarControls();
}

function setupResponsiveSidebarControls() {
  const body = document.body;
  if (!body) return;

  let backdrop = qs('.sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'sidebar-backdrop';
    backdrop.setAttribute('aria-label', 'Cerrar menú');
    document.body.appendChild(backdrop);
  }

  const closeSidebar = () => body.classList.remove('sidebar-open');
  const openSidebar = () => body.classList.add('sidebar-open');

  qsa('[data-sidebar-open]').forEach((btn) => {
    if (btn.dataset.sidebarBound === '1') return;
    btn.dataset.sidebarBound = '1';
    btn.addEventListener('click', openSidebar);
  });

  qsa('[data-sidebar-close]').forEach((btn) => {
    if (btn.dataset.sidebarBound === '1') return;
    btn.dataset.sidebarBound = '1';
    btn.addEventListener('click', closeSidebar);
  });

  if (backdrop.dataset.sidebarBound !== '1') {
    backdrop.dataset.sidebarBound = '1';
    backdrop.addEventListener('click', closeSidebar);
  }

  qsa('.nav-link', qs('#sidebar')).forEach((link) => {
    if (link.dataset.sidebarBound === '1') return;
    link.dataset.sidebarBound = '1';
    link.addEventListener('click', closeSidebar);
  });

  if (!window.__mialojamientoResponsiveSidebarResizeBound) {
    window.__mialojamientoResponsiveSidebarResizeBound = true;
    window.addEventListener('resize', () => {
      if (window.innerWidth > 980) closeSidebar();
    });
  }
}

export function renderEmptyState(container, title, message) {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <div>${escapeHtml(message)}</div>
    </div>
  `;
}

export function selectedPropertyIds(profile) {
  return uniqueStrings(profile?.propiedad_ids || []);
}

export function reservationLockDocId(propiedadId, unidadKey, dateISO) {
  return `${propiedadId}__${unidadKey}__${dateISO}`;
}

export function reservationLockIdsFromData(data) {
  if (!data?.propiedad_id || !data?.unidad_key || !data?.fecha_inicio || !data?.fecha_fin) {
    return [];
  }
  if (!ACTIVE_RESERVATION_STATUSES.has(data.estado)) return [];
  return dateRangeNights(data.fecha_inicio, data.fecha_fin).map((dateISO) =>
    reservationLockDocId(data.propiedad_id, data.unidad_key, dateISO)
  );
}

export async function waitForAuthUser() {
  await authReady;
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user || null);
    });
  });
}


async function safeGetDoc(ref) {
  try {
    return await getDoc(ref);
  } catch {
    return null;
  }
}

async function safeGetDocs(q) {
  try {
    return await getDocs(q);
  } catch {
    return null;
  }
}

function dedupeUsersById(users = []) {
  const map = new Map();
  users.forEach((user) => {
    if (user?.id && !map.has(user.id)) {
      map.set(user.id, user);
    }
  });
  return [...map.values()];
}

function pickBestUserCandidate(candidates = [], { preferPending = false } = {}) {
  const valid = candidates.filter(Boolean);

  if (preferPending) {
    const pending = valid.find((user) =>
      user.activo &&
      !user.eliminado &&
      (user.estado_registro === REGISTRATION_STATES.PENDIENTE_AUTH || !user.uid)
    );
    if (pending) return pending;
  }

  const active = valid.find((user) =>
    user.activo &&
    !user.eliminado &&
    (
      user.estado_registro === REGISTRATION_STATES.ACTIVO ||
      user.estado_registro === REGISTRATION_STATES.PENDIENTE_AUTH
    )
  );
  if (active) return active;

  return valid[0] || null;
}

export async function findUserCandidatesByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return [];

  const found = [];

  const byNormalized = await safeGetDocs(query(
    collection(db, 'usuarios'),
    where('email_normalizado', '==', normalizedEmail),
    limit(5)
  ));
  if (byNormalized?.docs?.length) {
    found.push(...byNormalized.docs.map((snap) => normalizeUserDoc(snap.data(), snap.id)));
  }

  const byEmail = await safeGetDocs(query(
    collection(db, 'usuarios'),
    where('email', '==', normalizedEmail),
    limit(5)
  ));
  if (byEmail?.docs?.length) {
    found.push(...byEmail.docs.map((snap) => normalizeUserDoc(snap.data(), snap.id)));
  }

  return dedupeUsersById(found);
}

export async function findUserCandidateByEmail(email, options = {}) {
  return pickBestUserCandidate(await findUserCandidatesByEmail(email), options);
}

export async function findUserCandidateByUid(uid) {
  if (!uid) return null;

  const direct = await safeGetDoc(doc(db, 'usuarios', uid));
  const directUser = direct?.exists?.() ? normalizeUserDoc(direct.data(), direct.id) : null;
  if (directUser && directUser.uid === uid) return directUser;

  const querySnap = await safeGetDocs(query(
    collection(db, 'usuarios'),
    where('uid', '==', uid),
    limit(5)
  ));

  const users = querySnap?.docs?.map((snap) => normalizeUserDoc(snap.data(), snap.id)) || [];
  if (directUser) users.unshift(directUser);

  return pickBestUserCandidate(dedupeUsersById(users));
}

async function repairUserDocumentForAuthUser(profile, currentUser, { activate = false } = {}) {
  const nextState = activate ? REGISTRATION_STATES.ACTIVO : (profile.estado_registro || REGISTRATION_STATES.ACTIVO);

  try {
    await updateDoc(doc(db, 'usuarios', profile.id), {
      uid: currentUser.uid,
      email_normalizado: normalizeEmail(profile.email || currentUser.email || ''),
      estado_registro: nextState,
      activo: true,
      eliminado: false,
      propiedad_id: profile.propiedad_id || '',
      propiedad_ids: selectedPropertyIds(profile),
      updated_at: serverTimestamp(),
      actualizado_por: currentUser.uid
    });
  } catch {
    // Si reglas o datos legacy impiden actualizar el doc principal,
    // igual intentamos continuar con el auto-heal de los documentos auxiliares.
  }
}

async function repairSupportDocsForProfile(profile, currentUser, { activate = false } = {}) {
  const normalizedEmail = normalizeEmail(profile.email || currentUser.email || '');

  await upsertUserSupportDocs(profile.id, {
    ...profile,
    email: normalizedEmail,
    email_normalizado: normalizedEmail,
    uid: currentUser.uid,
    activo: true,
    eliminado: false,
    estado_registro: activate ? REGISTRATION_STATES.ACTIVO : (profile.estado_registro || REGISTRATION_STATES.ACTIVO),
    propiedad_id: profile.propiedad_id || '',
    propiedad_ids: selectedPropertyIds(profile)
  });
}

export async function resolveProfileFromAuthenticatedUser(currentUser) {
  if (!currentUser) return null;

  const normalizedEmail = normalizeEmail(currentUser.email || '');
  let profile = null;
  let mirrorExists = false;
  let emailIndexExists = false;

  const authMirrorSnap = await safeGetDoc(doc(db, 'usuarios_auth', currentUser.uid));
  if (authMirrorSnap?.exists?.()) {
    mirrorExists = true;
    const usuarioId = authMirrorSnap.data().usuario_id || '';
    if (usuarioId) {
      profile = await getUserById(usuarioId);
    }
  }

  if (!profile && normalizedEmail) {
    const indexSnap = await safeGetDoc(doc(db, 'email_index', normalizedEmail));
    if (indexSnap?.exists?.()) {
      emailIndexExists = true;
      const usuarioId = indexSnap.data().usuario_id || '';
      if (usuarioId) {
        profile = await getUserById(usuarioId);
      }
    }
  }

  if (!profile) {
    profile = await findUserCandidateByUid(currentUser.uid);
  }

  if (!profile && normalizedEmail) {
    profile = await findUserCandidateByEmail(normalizedEmail);
  }

  if (!profile) return null;

  const profileEmail = normalizeEmail(profile.email || '');
  if (normalizedEmail && profileEmail && profileEmail !== normalizedEmail) {
    return null;
  }

  if (profile.uid && profile.uid !== currentUser.uid) {
    return null;
  }

  if (!profile.activo || profile.eliminado) {
    return null;
  }

  const shouldActivate =
    profile.estado_registro !== REGISTRATION_STATES.ACTIVO &&
    (
      profile.estado_registro === REGISTRATION_STATES.PENDIENTE_AUTH ||
      !profile.estado_registro
    );

  const needsRepair =
    shouldActivate ||
    !mirrorExists ||
    !emailIndexExists ||
    !profile.uid ||
    profile.email_normalizado !== normalizedEmail ||
    !Array.isArray(profile.propiedad_ids);

  if (needsRepair) {
    if (shouldActivate || !profile.uid || profile.email_normalizado !== normalizedEmail || !Array.isArray(profile.propiedad_ids)) {
      await repairUserDocumentForAuthUser(profile, currentUser, { activate: shouldActivate });
    }

    await repairSupportDocsForProfile(profile, currentUser, { activate: shouldActivate });

    profile = {
      ...profile,
      uid: currentUser.uid,
      email: normalizedEmail || profile.email,
      email_normalizado: normalizedEmail || profile.email_normalizado,
      estado_registro: REGISTRATION_STATES.ACTIVO,
      activo: true,
      eliminado: false,
      propiedad_id: profile.propiedad_id || '',
      propiedad_ids: selectedPropertyIds(profile)
    };
  }

  if (profile.estado_registro !== REGISTRATION_STATES.ACTIVO) {
    return null;
  }

  return profile;
}

export async function getCurrentProfile() {
  const currentUser = auth.currentUser || await waitForAuthUser();
  if (!currentUser) return null;
  return resolveProfileFromAuthenticatedUser(currentUser);
}

export async function requireAuth({ roles = [], pageKey = 'dashboard' } = {}) {
  const currentUser = auth.currentUser || await waitForAuthUser();
  if (!currentUser) {
    window.location.href = 'login.html';
    return null;
  }

  const profile = await getCurrentProfile();

  if (!profile) {
    await signOut(auth).catch(() => {});
    window.location.href = 'login.html?error=sin-perfil';
    return null;
  }

  if (roles.length && !roles.includes(profile.rol)) {
    showToast('No tenés permisos para entrar a esa pantalla.', 'warning', 'Acceso restringido');
    window.location.href = 'dashboard.html';
    return null;
  }

  renderSidebar(profile, pageKey);
  return profile;
}

export async function upsertUserSupportDocs(userId, payload, { previousEmail = '' } = {}) {
  const normalized = normalizeUserDoc(payload, userId);
  const batch = writeBatch(db);

  const currentEmailKey = normalized.email_normalizado || normalizeEmail(normalized.email);
  const previousEmailKey = normalizeEmail(previousEmail);

  if (previousEmailKey && previousEmailKey !== currentEmailKey) {
    batch.delete(doc(db, 'email_index', previousEmailKey));
  }

  batch.set(doc(db, 'email_index', currentEmailKey), {
    usuario_id: userId,
    uid: normalized.uid || '',
    email: normalized.email,
    email_normalizado: currentEmailKey,
    rol: normalized.rol,
    empresa_id: normalized.empresa_id || '',
    activo: normalized.activo,
    eliminado: normalized.eliminado,
    estado_registro: normalized.estado_registro,
    updated_at: serverTimestamp()
  }, { merge: true });

  if (normalized.uid) {
    batch.set(doc(db, 'usuarios_auth', normalized.uid), {
      usuario_id: userId,
      uid: normalized.uid,
      email: normalized.email,
      email_normalizado: currentEmailKey,
      rol: normalized.rol,
      empresa_id: normalized.empresa_id || '',
      propiedad_id: normalized.propiedad_id || '',
      propiedad_ids: normalized.propiedad_ids || [],
      activo: normalized.activo,
      eliminado: normalized.eliminado,
      estado_registro: normalized.estado_registro,
      updated_at: serverTimestamp()
    }, { merge: true });
  }

  await batch.commit();
}

export async function markUserAsDeleted(actorProfile, userProfile) {
  const sameDocument = actorProfile?.id && userProfile?.id && actorProfile.id === userProfile.id;
  const sameAuthUser = actorProfile?.uid && userProfile?.uid && actorProfile.uid === userProfile.uid;

  if (sameDocument || sameAuthUser) {
    throw new Error('No podés darte de baja a vos mismo.');
  }

  const targetRef = doc(db, 'usuarios', userProfile.id);
  const nextPayload = {
    activo: false,
    eliminado: true,
    eliminado_at: serverTimestamp(),
    eliminado_por: actorProfile.uid || actorProfile.id || '',
    updated_at: serverTimestamp(),
    actualizado_por: actorProfile.uid || actorProfile.id || ''
  };

  await updateDoc(targetRef, nextPayload);
  await upsertUserSupportDocs(userProfile.id, {
    ...userProfile,
    ...nextPayload,
    email: userProfile.email,
    uid: userProfile.uid
  });
}

export async function reactivateUser(actorProfile, userProfile) {
  if (!userProfile?.id) {
    throw new Error('No se pudo identificar el usuario a reactivar.');
  }

  const targetRef = doc(db, 'usuarios', userProfile.id);
  const nextPayload = {
    activo: true,
    eliminado: false,
    eliminado_at: null,
    eliminado_por: '',
    estado_registro: userProfile.uid
      ? REGISTRATION_STATES.ACTIVO
      : (userProfile.estado_registro || REGISTRATION_STATES.PENDIENTE_AUTH),
    updated_at: serverTimestamp(),
    actualizado_por: actorProfile.uid || actorProfile.id || ''
  };

  await updateDoc(targetRef, nextPayload);
  await upsertUserSupportDocs(userProfile.id, {
    ...userProfile,
    ...nextPayload,
    email: userProfile.email,
    uid: userProfile.uid
  });
}

export async function getEmailIndex(email) {
  const emailKey = normalizeEmail(email);
  if (!emailKey) return null;
  const snap = await safeGetDoc(doc(db, 'email_index', emailKey));
  return snap?.exists?.() ? snap.data() : null;
}

export async function getUserById(userId) {
  if (!userId) return null;
  const snap = await safeGetDoc(doc(db, 'usuarios', userId));
  return snap?.exists?.() ? normalizeUserDoc(snap.data(), snap.id) : null;
}

export async function getPropertyById(propertyId) {
  if (!propertyId) return null;
  const snap = await getDoc(doc(db, 'propiedades', propertyId));
  return snap.exists() ? normalizePropertyDoc(snap.data(), snap.id) : null;
}

export async function getUnitById(propertyId, unitId) {
  if (!propertyId || !unitId) return null;
  const snap = await getDoc(doc(db, 'propiedades', propertyId, 'unidades', unitId));
  return snap.exists() ? normalizeUnitDoc(snap.data(), snap.id) : null;
}

export async function getReservationById(reservationId) {
  if (!reservationId) return null;
  const snap = await getDoc(doc(db, 'reservas', reservationId));
  return snap.exists() ? normalizeReservationDoc(snap.data(), snap.id) : null;
}

export async function listScopedProperties(profile, { includeInactive = false } = {}) {
  if (!profile) return [];
  let items = [];

  if (isSuperadmin(profile)) {
    const snap = await getDocs(query(collection(db, 'propiedades'), orderBy('nombre')));
    items = snap.docs.map(docSnap => normalizePropertyDoc(docSnap.data(), docSnap.id));
  } else if (isAdmin(profile)) {
    const snap = await getDocs(query(
      collection(db, 'propiedades'),
      where('empresa_id', '==', profile.empresa_id)
    ));
    items = snap.docs.map(docSnap => normalizePropertyDoc(docSnap.data(), docSnap.id));
  } else {
    const ids = selectedPropertyIds(profile);
    const docs = await Promise.all(ids.map((id) => getPropertyById(id)));
    items = docs.filter(Boolean);
  }

  items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return includeInactive ? items : items.filter(item => item.activo);
}

export async function listUnitsByProperty(propertyId, { includeInactive = false } = {}) {
  if (!propertyId) return [];
  const snap = await getDocs(query(collection(db, 'propiedades', propertyId, 'unidades'), orderBy('codigo')));
  const items = snap.docs.map(docSnap => normalizeUnitDoc(docSnap.data(), docSnap.id));
  return includeInactive ? items : items.filter(item => item.activa);
}

export async function listScopedUsers(profile, { includeDeleted = false } = {}) {
  if (!profile || !canManageUsers(profile)) return [];
  let items = [];

  if (isSuperadmin(profile)) {
    const snap = await getDocs(collection(db, 'usuarios'));
    items = snap.docs.map(docSnap => normalizeUserDoc(docSnap.data(), docSnap.id));
  } else {
    const snap = await getDocs(query(collection(db, 'usuarios'), where('empresa_id', '==', profile.empresa_id)));
    items = snap.docs.map(docSnap => normalizeUserDoc(docSnap.data(), docSnap.id));
  }

  items = items.filter((user) => includeDeleted ? true : !user.eliminado);
  items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return items;
}

export async function listScopedReservations(profile) {
  if (!profile) return [];
  let items = [];

  if (isSuperadmin(profile)) {
    const snap = await getDocs(collection(db, 'reservas'));
    items = snap.docs.map(docSnap => normalizeReservationDoc(docSnap.data(), docSnap.id));
  } else if (isAdmin(profile)) {
    const snap = await getDocs(query(collection(db, 'reservas'), where('empresa_id', '==', profile.empresa_id)));
    items = snap.docs.map(docSnap => normalizeReservationDoc(docSnap.data(), docSnap.id));
  } else {
    const propertyIds = selectedPropertyIds(profile);
    const snapshots = await Promise.all(
      propertyIds.map((propId) =>
        getDocs(query(collection(db, 'reservas'), where('propiedad_id', '==', propId)))
      )
    );

    items = snapshots.flatMap((snap) =>
      snap.docs.map(docSnap => normalizeReservationDoc(docSnap.data(), docSnap.id))
    );
  }

  items.sort((a, b) => {
    const left = `${b.fecha_inicio || ''}${b.updated_at?.seconds || 0}`;
    const right = `${a.fecha_inicio || ''}${a.updated_at?.seconds || 0}`;
    return left.localeCompare(right);
  });

  return items;
}

export function buildUserPayloadFromForm(form, actorProfile, existingUser = null) {
  const rol = qs('[name="rol"]', form)?.value || ROLES.RECEPCION;
  const email = normalizeEmail(qs('[name="email"]', form)?.value);
  const propertyIds = rol === ROLES.RECEPCION
    ? uniqueStrings(getMultiSelectValues(qs('[name="propiedad_ids"]', form)))
    : [];
  const propertyId = propertyIds[0] || '';

  return {
    nombre: qs('[name="nombre"]', form)?.value.trim() || '',
    email,
    email_normalizado: email,
    rol,
    empresa_id: isSuperadmin(actorProfile) && rol === ROLES.SUPERADMIN
      ? ''
      : (qs('[name="empresa_id"]', form)?.value.trim() || existingUser?.empresa_id || actorProfile.empresa_id || ''),
    propiedad_id: propertyId,
    propiedad_ids: propertyIds,
    activo: true,
    eliminado: false,
    uid: existingUser?.uid || '',
    estado_registro: existingUser?.uid
      ? (existingUser?.estado_registro || REGISTRATION_STATES.ACTIVO)
      : REGISTRATION_STATES.PENDIENTE_AUTH,
    created_at: existingUser?.created_at || serverTimestamp(),
    updated_at: serverTimestamp(),
    creado_por: existingUser?.creado_por || actorProfile.uid || actorProfile.id || '',
    actualizado_por: actorProfile.uid || actorProfile.id || '',
    eliminado_at: null,
    eliminado_por: ''
  };
}

export function buildPropertyPayloadFromForm(form, actorProfile, existingProperty = null) {
  const codigo = qs('[name="codigo"]', form)?.value.trim() || existingProperty?.codigo || generateInternalCode('PRO');

  return {
    nombre: qs('[name="nombre"]', form)?.value.trim() || '',
    codigo,
    codigo_normalizado: normalizeText(codigo),
    tipo: qs('[name="tipo"]', form)?.value || '',
    pais: qs('[name="pais"]', form)?.value.trim() || 'Argentina',
    provincia: qs('[name="provincia"]', form)?.value.trim() || '',
    ciudad: qs('[name="ciudad"]', form)?.value.trim() || '',
    codigo_postal: qs('[name="codigo_postal"]', form)?.value.trim() || '',
    direccion: qs('[name="direccion"]', form)?.value.trim() || '',
    descripcion: qs('[name="descripcion"]', form)?.value.trim() || '',
    activo: qs('[name="activo"]', form)?.checked ?? true,
    empresa_id: isSuperadmin(actorProfile)
      ? (qs('[name="empresa_id"]', form)?.value.trim() || '')
      : (actorProfile.empresa_id || ''),
    check_in: qs('[name="check_in"]', form)?.value || '14:00',
    check_out: qs('[name="check_out"]', form)?.value || '10:00',
    recepcion_24h: qs('[name="recepcion_24h"]', form)?.checked ?? false,
    horario_recepcion_desde: qs('[name="horario_recepcion_desde"]', form)?.value || '08:00',
    horario_recepcion_hasta: qs('[name="horario_recepcion_hasta"]', form)?.value || '22:00',
    telefono: qs('[name="telefono"]', form)?.value.trim() || '',
    email_contacto: qs('[name="email_contacto"]', form)?.value.trim() || '',
    incluye_desayuno: qs('[name="incluye_desayuno"]', form)?.checked ?? false,
    admite_mascotas: qs('[name="admite_mascotas"]', form)?.checked ?? false,
    politica_cancelacion: qs('[name="politica_cancelacion"]', form)?.value.trim() || '',
    observaciones_internas: qs('[name="observaciones_internas"]', form)?.value.trim() || '',
    comodidades_generales: getCheckedValues(qs('#comodidadesGenerales')),
    created_at: existingProperty?.created_at || serverTimestamp(),
    updated_at: serverTimestamp(),
    creado_por: existingProperty?.creado_por || actorProfile.uid || actorProfile.id || '',
    actualizado_por: actorProfile.uid || actorProfile.id || ''
  };
}

export function buildUnitPayloadFromForm(form, actorProfile, existingUnit = null) {
  const capacidadMax = toNumber(qs('[name="capacidad_max"]', form)?.value, 0);
  const capacidadAdultos = toNumber(qs('[name="capacidad_adultos"]', form)?.value, 0);
  const capacidadNinos = toNumber(qs('[name="capacidad_ninos"]', form)?.value, 0);

  return {
    codigo: qs('[name="codigo"]', form)?.value.trim() || existingUnit?.codigo || generateInternalCode('UNI'),
    nombre: qs('[name="nombre"]', form)?.value.trim() || '',
    tipo_unidad: qs('[name="tipo_unidad"]', form)?.value || '',
    capacidad_max: capacidadMax,
    capacidad_adultos: capacidadAdultos,
    capacidad_ninos: capacidadNinos,
    camas: getCheckedValues(qs('#camasContainer')),
    comodidades: getCheckedValues(qs('#comodidadesUnidad')),
    activa: qs('[name="activa"]', form)?.checked ?? true,
    created_at: existingUnit?.created_at || serverTimestamp(),
    updated_at: serverTimestamp(),
    creado_por: existingUnit?.creado_por || actorProfile.uid || actorProfile.id || '',
    actualizado_por: actorProfile.uid || actorProfile.id || ''
  };
}

export function buildReservationPayload({
  form,
  actorProfile,
  selectedProperty,
  selectedUnit,
  existingReservation = null
}) {
  const unidadManual = qs('[name="unidad_manual"]', form)?.value.trim() || '';
  const unitLabel = selectedUnit
    ? (selectedUnit.codigo || selectedUnit.nombre || selectedUnit.id)
    : unidadManual;

  return {
    cliente: qs('[name="cliente"]', form)?.value.trim() || '',
    propiedad_id: selectedProperty.id,
    propiedad_nombre: selectedProperty.nombre,
    unidad_id: selectedUnit?.id || '',
    unidad: unitLabel,
    unidad_nombre: selectedUnit?.nombre || unidadManual || unitLabel,
    unidad_key: selectedUnit?.id || normalizeText(unitLabel || 'unidad-manual'),
    capacidad_unidad: selectedUnit?.capacidad_max || toNumber(qs('[name="capacidad_manual"]', form)?.value, 0),
    fecha_inicio: qs('[name="fecha_inicio"]', form)?.value || '',
    fecha_fin: qs('[name="fecha_fin"]', form)?.value || '',
    estado: qs('[name="estado"]', form)?.value || 'pendiente',
    huespedes: toNumber(qs('[name="huespedes"]', form)?.value, 1),
    total: toNumber(qs('[name="total"]', form)?.value, 0),
    observaciones: qs('[name="observaciones"]', form)?.value.trim() || '',
    empresa_id: selectedProperty.empresa_id || actorProfile.empresa_id || '',
    created_at: existingReservation?.created_at || serverTimestamp(),
    updated_at: serverTimestamp(),
    creado_por: existingReservation?.creado_por || actorProfile.uid || actorProfile.id || '',
    actualizado_por: actorProfile.uid || actorProfile.id || '',
    creado_por_nombre: existingReservation?.creado_por_nombre || actorProfile.nombre || actorProfile.email || '',
    actualizado_por_nombre: actorProfile.nombre || actorProfile.email || ''
  };
}

export function validateReservationData(reservation) {
  if (!reservation.cliente) {
    throw new Error('Ingresá el nombre del huésped o cliente.');
  }
  if (!reservation.propiedad_id) {
    throw new Error('Seleccioná una propiedad.');
  }
  if (!reservation.unidad_key) {
    throw new Error('Seleccioná una unidad o cargá una manual.');
  }
  if (!reservation.fecha_inicio || !reservation.fecha_fin) {
    throw new Error('Completá fecha de check-in y check-out.');
  }
  if (reservation.fecha_inicio >= reservation.fecha_fin) {
    throw new Error('La fecha de salida debe ser posterior a la fecha de entrada.');
  }
  if (reservation.huespedes <= 0) {
    throw new Error('La cantidad de huéspedes debe ser mayor a cero.');
  }
  if (reservation.capacidad_unidad > 0 && reservation.huespedes > reservation.capacidad_unidad) {
    throw new Error('La cantidad de huéspedes supera la capacidad de la unidad.');
  }
}

export async function saveReservationWithLocks(reservationPayload, reservationId = '') {
  validateReservationData(reservationPayload);

  const reservationRef = reservationId
    ? doc(db, 'reservas', reservationId)
    : doc(collection(db, 'reservas'));

  await runTransaction(db, async (transaction) => {
    let previous = null;
    if (reservationId) {
      const currentSnap = await transaction.get(reservationRef);
      if (!currentSnap.exists()) {
        throw new Error('La reserva que intentás editar ya no existe.');
      }
      previous = normalizeReservationDoc(currentSnap.data(), currentSnap.id);
    }

    const previousLocks = new Set(reservationLockIdsFromData(previous || {}));
    const nextLocks = new Set(reservationLockIdsFromData(reservationPayload));

    for (const lockId of nextLocks) {
      const lockRef = doc(db, 'reserva_ocupacion', lockId);
      const lockSnap = await transaction.get(lockRef);
      if (lockSnap.exists()) {
        const lockData = lockSnap.data();
        if (lockData.reserva_id !== reservationRef.id) {
          throw new Error('Ya existe una reserva o bloqueo para esa unidad en alguna de las fechas elegidas.');
        }
      }
    }

    transaction.set(reservationRef, {
      ...reservationPayload,
      updated_at: serverTimestamp(),
      ...(reservationId ? {} : { created_at: serverTimestamp() })
    }, { merge: true });

    for (const lockId of previousLocks) {
      if (!nextLocks.has(lockId)) {
        transaction.delete(doc(db, 'reserva_ocupacion', lockId));
      }
    }

    for (const lockId of nextLocks) {
      const parts = lockId.split('__');
      const dateISO = parts[parts.length - 1];
      transaction.set(doc(db, 'reserva_ocupacion', lockId), {
        reserva_id: reservationRef.id,
        propiedad_id: reservationPayload.propiedad_id,
        unidad_key: reservationPayload.unidad_key,
        fecha: dateISO,
        estado: reservationPayload.estado,
        updated_at: serverTimestamp()
      }, { merge: true });
    }
  });

  return reservationRef.id;
}

export async function deleteReservationWithLocks(reservationId) {
  if (!reservationId) {
    throw new Error('Falta el identificador de la reserva.');
  }

  const reservationRef = doc(db, 'reservas', reservationId);

  await runTransaction(db, async (transaction) => {
    const currentSnap = await transaction.get(reservationRef);
    if (!currentSnap.exists()) {
      throw new Error('La reserva que intentás eliminar ya no existe.');
    }

    const currentReservation = normalizeReservationDoc(currentSnap.data(), currentSnap.id);
    const currentLocks = new Set(reservationLockIdsFromData(currentReservation));

    transaction.delete(reservationRef);

    for (const lockId of currentLocks) {
      transaction.delete(doc(db, 'reserva_ocupacion', lockId));
    }
  });
}

export async function deletePropertyUnit(propertyId, unitId) {
  await deleteDoc(doc(db, 'propiedades', propertyId, 'unidades', unitId));
}

export function reservationMatchesFilters(reserva, text = '', status = '') {
  const term = normalizeText(text);
  const haystack = normalizeText([
    reserva.cliente,
    reserva.propiedad_nombre,
    reserva.unidad,
    reserva.unidad_nombre,
    reserva.observaciones
  ].join(' '));

  const byText = !term || haystack.includes(term);
  const byStatus = !status || reserva.estado === status;
  return byText && byStatus;
}

export function propertyMatchesFilter(propiedad, text = '') {
  const term = normalizeText(text);
  if (!term) return true;
  const haystack = normalizeText([
    propiedad.nombre,
    propiedad.codigo,
    propiedad.tipo,
    propiedad.pais,
    propiedad.provincia,
    propiedad.ciudad,
    propiedad.codigo_postal,
    propiedad.direccion,
    propiedad.telefono,
    propiedad.email_contacto,
    propiedad.empresa_id
  ].join(' '));
  return haystack.includes(term);
}

export function userMatchesFilter(user, text = '') {
  const term = normalizeText(text);
  if (!term) return true;
  const haystack = normalizeText([
    user.nombre,
    user.email,
    user.rol,
    user.empresa_id
  ].join(' '));
  return haystack.includes(term);
}

export function fillSelectOptions(select, items, { valueKey = 'id', labelBuilder = (item) => item.nombre } = {}) {
  if (!select) return;
  const previousValue = select.value;
  select.innerHTML = items.map((item) =>
    `<option value="${escapeHtml(item[valueKey])}">${escapeHtml(labelBuilder(item))}</option>`
  ).join('');
  if ([...select.options].some(option => option.value === previousValue)) {
    select.value = previousValue;
  }
}

export function monthMatrix(date = new Date()) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(first);
  const day = first.getDay();
  const offset = day === 0 ? 6 : day - 1;
  start.setDate(first.getDate() - offset);

  const matrix = [];
  for (let i = 0; i < 42; i += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    matrix.push(current);
  }
  return matrix;
}

export function dateToISO(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function buildCalendarReservationsMap(reservas = []) {
  const map = new Map();

  reservas.forEach((reserva) => {
    if (!reserva.fecha_inicio || !reserva.fecha_fin) return;
    dateRangeNights(reserva.fecha_inicio, reserva.fecha_fin).forEach((dateISO) => {
      if (!map.has(dateISO)) map.set(dateISO, []);
      map.get(dateISO).push(reserva);
    });
  });

  return map;
}
