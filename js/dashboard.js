import {
  requireAuth,
  canManageUsers,
  canManageProperties,
  canCreateReservations,
  isSuperadmin,
  listScopedProperties,
  listScopedReservations,
  listUnitsByProperty,
  renderTopbar,
  primeSidebarFromCache,
  renderEmptyState,
  reservationMatchesFilters,
  deleteReservationWithLocks,
  formatDate,
  dateToISO,
  addDaysISO,
  normalizeText,
  ACTIVE_RESERVATION_STATUSES,
  qs,
  showToast,
  escapeHtml
} from './app-helpers.js';
import { logoutUser } from './auth.js';

let currentProfile = null;
let properties = [];
let reservations = [];
let filteredReservations = [];
let plannerGroups = [];
let currentMonth = new Date();
let calendarView = 'month';
const unitsCache = new Map();
let plannerViewTouchedByUser = false;

function isSmallMobile() {
  return window.innerWidth <= 520;
}

function applyResponsiveDefaultView() {
  if (plannerViewTouchedByUser) return;
  calendarView = isSmallMobile() ? 'week' : 'month';
}

function startOfWeek(date) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diff);
  return base;
}

function buildWeekDays(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return current;
  });
}

function buildMonthDays(date) {
  const total = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Array.from({ length: total }, (_, index) => new Date(date.getFullYear(), date.getMonth(), index + 1));
}

function getVisibleDates() {
  return calendarView === 'week' ? buildWeekDays(currentMonth) : buildMonthDays(currentMonth);
}

function getVisibleRange() {
  const visibleDates = getVisibleDates();
  const startISO = dateToISO(visibleDates[0]);
  const endISO = addDaysISO(dateToISO(visibleDates[visibleDates.length - 1]), 1);
  return { startISO, endISO, visibleDates };
}

function isActiveReservation(item) {
  return ACTIVE_RESERVATION_STATUSES.has(item?.estado || '');
}

function reservationTouchesRange(item, range = getVisibleRange()) {
  if (!item?.fecha_inicio || !item?.fecha_fin) return false;
  return item.fecha_inicio < range.endISO && item.fecha_fin > range.startISO;
}

function reservationTouchesDay(item, dayISO) {
  if (!item?.fecha_inicio || !item?.fecha_fin) return false;
  return item.fecha_inicio <= dayISO && item.fecha_fin > dayISO;
}

function reservationBelongsToActiveInventory(item) {
  if (!item?.propiedad_id) return false;

  const propertyIsVisible = properties.some((property) => property.id === item.propiedad_id && property.activo);
  if (!propertyIsVisible) return false;

  const activeUnits = unitsCache.get(item.propiedad_id) || [];
  if (!activeUnits.length) return false;

  if (item.unidad_id) {
    return activeUnits.some((unit) => unit.id === item.unidad_id);
  }

  const reservationUnitKeys = new Set([
    normalizeText(item.unidad || ''),
    normalizeText(item.unidad_nombre || ''),
    item.unidad_key || ''
  ].filter(Boolean));

  return activeUnits.some((unit) => {
    const unitKeys = [
      unit.id,
      normalizeText(unit.nombre || ''),
      normalizeText(unit.codigo || '')
    ].filter(Boolean);

    return unitKeys.some((key) => reservationUnitKeys.has(key));
  });
}

function updateViewButtons() {
  qs('#viewMonthBtn')?.classList.toggle('is-active', calendarView === 'month');
  qs('#viewWeekBtn')?.classList.toggle('is-active', calendarView === 'week');
}

function buildReservationTooltip(item) {
  return [
    `Cliente: ${item.cliente || '—'}`,
    `Propiedad: ${item.propiedad_nombre || '—'}`,
    `Unidad: ${item.unidad_nombre || item.unidad || '—'}`,
    `Ingreso: ${formatDate(item.fecha_inicio)}`,
    `Salida: ${formatDate(item.fecha_fin)}`,
    `Huéspedes: ${item.huespedes ?? '—'}`,
    `Estado: ${item.estado || '—'}`
  ].join('\n');
}

function reservationStatusClass(status = '') {
  return normalizeText(status || 'pendiente') || 'pendiente';
}

function bindCommonActions() {
  qs('#btnLogoutSidebar')?.addEventListener('click', logoutUser);
}

function configureDashboardMode() {
  const superadminMode = isSuperadmin(currentProfile);
  qs('#regularDashboardSection')?.toggleAttribute('hidden', superadminMode);
  qs('#superadminSummarySection')?.toggleAttribute('hidden', !superadminMode);
}

function renderQuickActions() {
  const btnReservation = qs('#quickNuevaReserva');
  const btnReservationFab = qs('#quickNuevaReservaFab');

  if (isSuperadmin(currentProfile)) {
    btnReservation?.setAttribute('hidden', 'hidden');
    btnReservationFab?.setAttribute('hidden', 'hidden');
    return;
  }

  if (canCreateReservations(currentProfile)) {
    btnReservation?.removeAttribute('hidden');
    btnReservationFab?.removeAttribute('hidden');
  }
}

function getSelectedPropertyId() {
  return qs('#filtroPropiedad')?.value || '';
}

function activeFiltersExist() {
  return Boolean((qs('#filtroTexto')?.value || '').trim() || qs('#filtroEstado')?.value || getSelectedPropertyId());
}

function sortUnits(left, right) {
  const a = `${left.codigo || ''} ${left.nombre || ''}`.trim();
  const b = `${right.codigo || ''} ${right.nombre || ''}`.trim();
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}

function buildRoomRow({ property, unit = null, legacyLabel = '' }, scopedReservations = []) {
  const code = unit?.codigo || '';
  const name = unit?.nombre || legacyLabel || 'Unidad';
  const prettyName = [code, code && name && code !== name ? name : !code ? name : ''].filter(Boolean).join(' · ');
  const subtitleBits = [];

  if (unit?.tipo_unidad) subtitleBits.push(unit.tipo_unidad);
  if (unit?.capacidad_max) subtitleBits.push(`${unit.capacidad_max} pax`);
  if (!unit && legacyLabel) subtitleBits.push('unidad manual');

  const legacyKey = normalizeText(legacyLabel || unit?.nombre || unit?.codigo || 'unidad-manual');
  const unitKeys = new Set([
    unit?.id || '',
    legacyKey,
    normalizeText(unit?.nombre || ''),
    normalizeText(unit?.codigo || '')
  ].filter(Boolean));

  const rowReservations = scopedReservations
    .filter((item) => {
      if (item.propiedad_id !== property.id) return false;
      if (item.unidad_id && unit?.id) return item.unidad_id === unit.id;
      return unitKeys.has(item.unidad_key) || unitKeys.has(normalizeText(item.unidad || item.unidad_nombre || ''));
    })
    .sort((a, b) => `${a.fecha_inicio || ''}`.localeCompare(`${b.fecha_inicio || ''}`));

  return {
    propertyId: property.id,
    propertyName: property.nombre,
    unitId: unit?.id || '',
    unitKey: unit?.id || legacyKey,
    label: prettyName || legacyLabel || 'Unidad',
    subtitle: subtitleBits.join(' · ') || 'Sin detalle cargado',
    capacity: Number(unit?.capacidad_max || 0),
    isManual: !unit,
    reservations: rowReservations
  };
}

function buildPlannerGroups() {
  const filtersActive = activeFiltersExist();
  const groups = [];

  properties.forEach((property) => {
    const propertyUnits = [...(unitsCache.get(property.id) || [])].sort(sortUnits);
    const propertyReservations = filteredReservations.filter((item) => item.propiedad_id === property.id);
    const rows = [];
    const rowKeys = new Set();

    propertyUnits.forEach((unit) => {
      const row = buildRoomRow({ property, unit }, propertyReservations);
      if (!filtersActive || row.reservations.length) {
        rows.push(row);
        rowKeys.add(row.unitKey);
        rowKeys.add(normalizeText(unit.nombre || ''));
        rowKeys.add(normalizeText(unit.codigo || ''));
      }
    });

    const manualUnitLabels = [...new Set(
      propertyReservations
        .map((item) => item.unidad || item.unidad_nombre || '')
        .filter(Boolean)
    )];

    manualUnitLabels.forEach((label) => {
      const row = buildRoomRow({ property, legacyLabel: label }, propertyReservations);
      if (!rowKeys.has(row.unitKey) && row.reservations.length) {
        rows.push(row);
        rowKeys.add(row.unitKey);
      }
    });

    rows.sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true, sensitivity: 'base' }));

    if (rows.length) {
      groups.push({
        property,
        rows,
        visibleReservations: propertyReservations.filter((item) => reservationTouchesRange(item)).length
      });
    }
  });

  plannerGroups = groups;
}

function updatePropertyFilterOptions() {
  const select = qs('#filtroPropiedad');
  if (!select) return;
  const selected = select.value;
  select.innerHTML = `
    <option value="">Todas</option>
    ${properties.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.nombre)}</option>`).join('')}
  `;
  select.value = properties.some((item) => item.id === selected) ? selected : '';
}

function calculateKPIs() {
  const today = new Date().toISOString().slice(0, 10);
  const range = getVisibleRange();
  const rows = plannerGroups.flatMap((group) => group.rows);
  const visibleReservations = filteredReservations.filter((item) => reservationTouchesRange(item, range));
  const occupiedToday = rows.filter((row) => row.reservations.some((item) => isActiveReservation(item) && reservationTouchesDay(item, today))).length;
  const totalUnits = rows.length;
  const totalPax = rows.reduce((sum, row) => sum + (row.capacity || 0), 0);
  const availableToday = Math.max(totalUnits - occupiedToday, 0);
  const confirmedVisible = visibleReservations.filter((item) => item.estado === 'confirmada').length;

  qs('#kpiUnidades').textContent = String(totalUnits);
  qs('#kpiPaxMax').textContent = String(totalPax);
  qs('#kpiOcupadasHoy').textContent = String(occupiedToday);
  qs('#kpiDisponiblesHoy').textContent = String(availableToday);
  qs('#kpiReservasVisibles').textContent = String(visibleReservations.length);
  qs('#kpiConfirmadasVisibles').textContent = String(confirmedVisible);

  const periodLabel = qs('#kpiVisiblePeriodLabel');
  if (periodLabel) {
    periodLabel.textContent = calendarView === 'week' ? 'Reservas de la semana' : 'Reservas del mes';
  }
}

function renderPlannerResume() {
  const resume = qs('#plannerResume');
  if (!resume) return;

  const range = getVisibleRange();
  const visibleReservations = filteredReservations.filter((item) => reservationTouchesRange(item, range));
  const propertiesVisible = plannerGroups.length;
  const checkins = visibleReservations.filter((item) => item.fecha_inicio >= range.startISO && item.fecha_inicio < range.endISO).length;
  const checkouts = visibleReservations.filter((item) => item.fecha_fin > range.startISO && item.fecha_fin <= range.endISO).length;
  const pendientes = visibleReservations.filter((item) => ['pendiente', 'pendiente de pago'].includes(item.estado)).length;
  const bloqueos = visibleReservations.filter((item) => ['bloqueada', 'mantenimiento'].includes(item.estado)).length;

  resume.innerHTML = `
    <div class="dashboard-inline-stat">
      <span class="dashboard-inline-stat-label">Rango visible</span>
      <strong>${calendarView === 'week' ? '7 días' : `${range.visibleDates.length} días`}</strong>
    </div>
    <div class="dashboard-inline-stat soft">
      <span class="dashboard-inline-stat-label">Propiedades</span>
      <strong>${propertiesVisible}</strong>
    </div>
    <div class="dashboard-inline-stat success">
      <span class="dashboard-inline-stat-label">Check-ins</span>
      <strong>${checkins}</strong>
    </div>
    <div class="dashboard-inline-stat">
      <span class="dashboard-inline-stat-label">Check-outs</span>
      <strong>${checkouts}</strong>
    </div>
    <div class="dashboard-inline-stat warning">
      <span class="dashboard-inline-stat-label">Pendientes</span>
      <strong>${pendientes}</strong>
    </div>
    <div class="dashboard-inline-stat soft">
      <span class="dashboard-inline-stat-label">Bloqueos</span>
      <strong>${bloqueos}</strong>
    </div>
  `;
}

function buildMonthSegments(visibleDates = []) {
  const segments = [];
  visibleDates.forEach((date) => {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const current = segments[segments.length - 1];
    if (!current || current.key !== key) {
      segments.push({
        key,
        month: date.getMonth(),
        year: date.getFullYear(),
        days: [date]
      });
      return;
    }
    current.days.push(date);
  });
  return segments;
}

function buildEmptyCells(dates = []) {
  return dates
    .map((date) => {
      const day = date.getDay();
      const dayISO = dateToISO(date);
      const classes = [
        'planning-day-cell',
        day === 0 || day === 6 ? 'is-weekend' : '',
        dayISO === new Date().toISOString().slice(0, 10) ? 'is-today' : ''
      ].filter(Boolean);
      return `<td class="${classes.join(' ')}"></td>`;
    })
    .join('');
}

function renderReservationCell(item, span) {
  const statusClass = reservationStatusClass(item.estado);
  return `
    <td colspan="${span}" class="planning-reservation-cell status-${statusClass}">
      <div class="planning-reservation-bar status-${statusClass}" data-tooltip="${escapeHtml(buildReservationTooltip(item))}" title="${escapeHtml(buildReservationTooltip(item))}">
        <div class="planning-reservation-content">
          <div class="planning-reservation-topline">
            <strong class="planning-reservation-title">${escapeHtml(item.cliente || 'Reserva')}</strong>
            <span class="planning-reservation-badge">${escapeHtml(item.estado || 'pendiente')}</span>
          </div>
          <div class="planning-reservation-meta-grid">
            <span><strong>Unidad:</strong> ${escapeHtml(item.unidad || item.unidad_nombre || 'Unidad')}</span>
            <span><strong>Huésp.:</strong> ${item.huespedes || 0}</span>
            <span class="full"><strong>Estadía:</strong> ${formatDate(item.fecha_inicio)} → ${formatDate(item.fecha_fin)}</span>
          </div>
        </div>
        <div class="planning-reservation-actions compact-actions">
          <a class="planning-action-btn" href="nueva_reserva.html?id=${encodeURIComponent(item.id)}">Editar</a>
          <button type="button" class="planning-action-btn danger btnDeleteReservation" data-id="${escapeHtml(item.id)}" data-cliente="${escapeHtml(item.cliente || '')}" aria-label="Eliminar reserva">×</button>
        </div>
      </div>
    </td>
  `;
}

function renderUnitScheduleRow(row, visibleDates, range) {
  const visibleStart = range.startISO;
  const totalDays = visibleDates.length;
  const rowReservations = row.reservations
    .filter((item) => reservationTouchesRange(item, range))
    .sort((a, b) => `${a.fecha_inicio || ''}`.localeCompare(`${b.fecha_inicio || ''}`));

  let cursor = 0;
  let cells = '';

  rowReservations.forEach((item) => {
    const startISO = item.fecha_inicio > visibleStart ? item.fecha_inicio : visibleStart;
    const endISO = item.fecha_fin < range.endISO ? item.fecha_fin : range.endISO;
    let startIndex = visibleDates.findIndex((date) => dateToISO(date) === startISO);

    if (startIndex < 0) startIndex = 0;

    let endIndex = visibleDates.findIndex((date) => dateToISO(date) === endISO);
    if (endIndex < 0) endIndex = totalDays;

    if (startIndex > cursor) {
      cells += buildEmptyCells(visibleDates.slice(cursor, startIndex));
    }

    const span = Math.max(endIndex - Math.max(startIndex, cursor), 1);
    cells += renderReservationCell(item, span);
    cursor = Math.max(cursor, startIndex + span);
  });

  if (cursor < totalDays) {
    cells += buildEmptyCells(visibleDates.slice(cursor));
  }

  return `
    <tr class="planning-unit-row ${row.isManual ? 'is-manual-row' : ''}">
      <th scope="row" class="planning-sticky planning-room-cell">
        <div class="planning-room-main">${escapeHtml(row.label)}</div>
        <div class="planning-room-sub">${escapeHtml(row.subtitle)}</div>
      </th>
      ${cells}
    </tr>
  `;
}


function renderMobilePlanningBoard() {
  const container = qs('#planningBoard');
  if (!container) return;

  const range = getVisibleRange();

  if (!plannerGroups.length) {
    renderEmptyState(container, 'Sin unidades visibles', 'No hay coincidencias para los filtros actuales o todavía no cargaste unidades.');
    return;
  }

  const monthLabel = qs('#calendarMonthLabel');
  const prevButton = qs('#calendarPrev');
  const nextButton = qs('#calendarNext');
  const visibleDates = range.visibleDates;

  if (calendarView === 'week') {
    const firstDay = visibleDates[0];
    const lastDay = visibleDates[visibleDates.length - 1];
    const firstLabel = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(firstDay);
    const lastLabel = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(lastDay);
    if (monthLabel) monthLabel.textContent = `${firstLabel} → ${lastLabel}`;
    if (prevButton) prevButton.textContent = '← Semana anterior';
    if (nextButton) nextButton.textContent = 'Semana siguiente →';
  } else {
    if (monthLabel) {
      monthLabel.textContent = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(currentMonth);
    }
    if (prevButton) prevButton.textContent = '← Mes anterior';
    if (nextButton) nextButton.textContent = 'Mes siguiente →';
  }

  updateViewButtons();

  container.innerHTML = `
    <div class="mobile-planner-stack">
      ${plannerGroups.map((group) => {
        const visibleRows = group.rows.filter((row) => row.reservations.some((item) => reservationTouchesRange(item, range)));
        const rowsToRender = visibleRows.length ? visibleRows : group.rows;
        return `
          <article class="mobile-property-card">
            <div class="mobile-property-head">
              <div>
                <h4>${escapeHtml(group.property.nombre)}</h4>
                <div class="mobile-property-type">${escapeHtml(group.property.tipo || 'propiedad')}</div>
              </div>
              <div class="mobile-property-badges">
                <span>${group.rows.length} unidades</span>
                <span>${group.visibleReservations} reservas</span>
              </div>
            </div>

            <div class="mobile-units-list">
              ${rowsToRender.map((row) => {
                const visibleReservations = row.reservations
                  .filter((item) => reservationTouchesRange(item, range))
                  .sort((a, b) => `${a.fecha_inicio || ''}`.localeCompare(`${b.fecha_inicio || ''}`));

                return `
                  <section class="mobile-unit-card ${row.isManual ? 'is-manual' : ''}">
                    <div class="mobile-unit-head">
                      <div class="mobile-unit-title">${escapeHtml(row.label)}</div>
                      <div class="mobile-unit-subtitle">${escapeHtml(row.subtitle)}</div>
                    </div>

                    ${visibleReservations.length ? `
                      <div class="mobile-reservations-list">
                        ${visibleReservations.map((item) => {
                          const statusClass = reservationStatusClass(item.estado);
                          return `
                            <article class="mobile-reservation-card status-${statusClass}">
                              <div class="mobile-reservation-top">
                                <strong>${escapeHtml(item.cliente || 'Reserva')}</strong>
                                <span class="mobile-reservation-status">${escapeHtml(item.estado || 'pendiente')}</span>
                              </div>
                              <div class="mobile-reservation-meta">
                                <span><strong>Unidad:</strong> ${escapeHtml(item.unidad || item.unidad_nombre || 'Unidad')}</span>
                                <span><strong>Huésp.:</strong> ${item.huespedes || 0}</span>
                                <span><strong>Ingreso:</strong> ${formatDate(item.fecha_inicio)}</span>
                                <span><strong>Salida:</strong> ${formatDate(item.fecha_fin)}</span>
                              </div>
                              <div class="mobile-reservation-actions">
                                <a class="planning-action-btn" href="nueva_reserva.html?id=${encodeURIComponent(item.id)}">Editar</a>
                                <button type="button" class="planning-action-btn danger btnDeleteReservation" data-id="${escapeHtml(item.id)}" data-cliente="${escapeHtml(item.cliente || '')}" aria-label="Eliminar reserva">Eliminar</button>
                              </div>
                            </article>
                          `;
                        }).join('')}
                      </div>
                    ` : `
                      <div class="mobile-unit-empty">Sin reservas visibles en este período.</div>
                    `}
                  </section>
                `;
              }).join('')}
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderPlanningBoard() {
  const container = qs('#planningBoard');
  if (!container) return;

  if (isSmallMobile()) {
    renderMobilePlanningBoard();
    return;
  }

  const range = getVisibleRange();
  const visibleDates = range.visibleDates;

  if (!plannerGroups.length) {
    renderEmptyState(container, 'Sin unidades visibles', 'No hay coincidencias para los filtros actuales o todavía no cargaste unidades.');
    return;
  }

  const monthLabel = qs('#calendarMonthLabel');
  const prevButton = qs('#calendarPrev');
  const nextButton = qs('#calendarNext');

  if (calendarView === 'week') {
    const firstDay = visibleDates[0];
    const lastDay = visibleDates[visibleDates.length - 1];
    const firstLabel = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(firstDay);
    const lastLabel = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(lastDay);
    if (monthLabel) monthLabel.textContent = `${firstLabel} → ${lastLabel}`;
    if (prevButton) prevButton.textContent = '← Semana anterior';
    if (nextButton) nextButton.textContent = 'Semana siguiente →';
  } else {
    if (monthLabel) {
      monthLabel.textContent = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(currentMonth);
    }
    if (prevButton) prevButton.textContent = '← Mes anterior';
    if (nextButton) nextButton.textContent = 'Mes siguiente →';
  }

  updateViewButtons();

  const monthSegments = buildMonthSegments(visibleDates);
  const monthHeaders = monthSegments
    .map((segment) => {
      const label = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(segment.year, segment.month, 1));
      return `<th colspan="${segment.days.length}" class="planning-month-header">${escapeHtml(label)}</th>`;
    })
    .join('');

  const dayHeaders = visibleDates
    .map((date) => {
      const dayISO = dateToISO(date);
      const isWeekend = [0, 6].includes(date.getDay());
      const isToday = dayISO === new Date().toISOString().slice(0, 10);
      return `
        <th class="planning-day-header ${isWeekend ? 'is-weekend' : ''} ${isToday ? 'is-today' : ''}">
          <span class="planning-day-number">${date.getDate()}</span>
          <small>${new Intl.DateTimeFormat('es-AR', { weekday: 'short' }).format(date).replace('.', '')}</small>
        </th>
      `;
    })
    .join('');

  const body = plannerGroups
    .map((group) => {
      const visibleCount = group.rows.reduce((sum, row) => sum + row.reservations.filter((item) => reservationTouchesRange(item, range)).length, 0);
      return `
        <tr class="planning-property-row">
          <th scope="row" class="planning-sticky planning-property-cell">
            <div class="planning-property-name">${escapeHtml(group.property.nombre)}</div>
            <div class="planning-property-meta">
              <span>${group.rows.length} unidades</span>
              <span>${visibleCount} reservas visibles</span>
              <span>${group.property.tipo || 'propiedad'}</span>
            </div>
          </th>
          <td colspan="${visibleDates.length}" class="planning-property-summary planning-property-summary-spacer"></td>
        </tr>
        ${group.rows.map((row) => renderUnitScheduleRow(row, visibleDates, range)).join('')}
      `;
    })
    .join('');

  container.innerHTML = `
    <table class="planning-board-table is-${calendarView}-view">
      <thead>
        <tr>
          <th rowspan="2" class="planning-sticky planning-corner-header">Habitaciones / unidades</th>
          ${monthHeaders}
        </tr>
        <tr>
          ${dayHeaders}
        </tr>
      </thead>
      <tbody>
        ${body}
      </tbody>
    </table>
  `;
}

function renderSuperadminSummary() {
  const stateBox = qs('#superadminStateSummary');
  const recentBox = qs('#superadminRecentReservations');
  if (!stateBox || !recentBox) return;

  const orderedStates = [
    'confirmada',
    'pendiente',
    'pendiente de pago',
    'bloqueada',
    'mantenimiento',
    'cancelada'
  ];

  const counts = orderedStates.map((status) => ({
    status,
    total: reservations.filter((item) => item.estado === status).length
  }));

  stateBox.innerHTML = counts
    .map((item) => `
      <div class="stat-item">
        <span>${escapeHtml(item.status)}</span>
        <strong>${item.total}</strong>
      </div>
    `)
    .join('');

  const recent = [...reservations]
    .sort((a, b) => `${b.fecha_inicio || ''}`.localeCompare(`${a.fecha_inicio || ''}`))
    .slice(0, 8);

  recentBox.innerHTML = recent.length
    ? recent.map((item) => `
        <div class="stat-item">
          <span>${escapeHtml(item.cliente || 'Reserva')} · ${escapeHtml(item.propiedad_nombre || '—')}</span>
          <strong>${escapeHtml(item.estado || 'pendiente')} · ${formatDate(item.fecha_inicio)}</strong>
        </div>
      `).join('')
    : '<div class="muted">No hay reservas para resumir.</div>';
}

function applyFilters() {
  const text = qs('#filtroTexto')?.value || '';
  const status = qs('#filtroEstado')?.value || '';
  const propertyId = getSelectedPropertyId();

  filteredReservations = reservations.filter((reservation) => {
    if (propertyId && reservation.propiedad_id !== propertyId) return false;
    return reservationMatchesFilters(reservation, text, status);
  });

  buildPlannerGroups();
  calculateKPIs();

  if (isSuperadmin(currentProfile)) {
    renderSuperadminSummary();
    return;
  }

  renderPlannerResume();
  renderPlanningBoard();
}

async function loadData() {
  properties = await listScopedProperties(currentProfile, { includeInactive: false });
  const allReservations = await listScopedReservations(currentProfile);

  unitsCache.clear();
  const unitsEntries = await Promise.all(
    properties.map(async (property) => [property.id, await listUnitsByProperty(property.id, { includeInactive: false })])
  );
  unitsEntries.forEach(([propertyId, units]) => unitsCache.set(propertyId, units));

  reservations = allReservations.filter(reservationBelongsToActiveInventory);

  updatePropertyFilterOptions();
  filteredReservations = [...reservations];
  buildPlannerGroups();
  calculateKPIs();

  if (isSuperadmin(currentProfile)) {
    renderSuperadminSummary();
  } else {
    renderPlannerResume();
    renderPlanningBoard();
  }
}

async function handleDeleteReservation(reservationId, clientName = '') {
  if (!reservationId) return;

  if (!window.confirm(`Se eliminará la reserva de ${clientName || 'este cliente'}. ¿Continuar?`)) {
    return;
  }

  try {
    await deleteReservationWithLocks(reservationId);
    showToast('La reserva fue eliminada correctamente.', 'success', 'Reserva eliminada');
    await loadData();
    applyFilters();
  } catch (error) {
    showToast(error.message || 'No se pudo eliminar la reserva.', 'error', 'Error');
  }
}

function bindFilters() {
  if (isSuperadmin(currentProfile)) return;

  qs('#filtroTexto')?.addEventListener('input', applyFilters);
  qs('#filtroEstado')?.addEventListener('change', applyFilters);
  qs('#filtroPropiedad')?.addEventListener('change', applyFilters);

  qs('#calendarPrev')?.addEventListener('click', () => {
    currentMonth = calendarView === 'week'
      ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() - 7)
      : new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    applyFilters();
  });

  qs('#calendarNext')?.addEventListener('click', () => {
    currentMonth = calendarView === 'week'
      ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() + 7)
      : new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    applyFilters();
  });

  qs('#viewMonthBtn')?.addEventListener('click', () => {
    plannerViewTouchedByUser = true;
    calendarView = 'month';
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    applyFilters();
  });

  qs('#viewWeekBtn')?.addEventListener('click', () => {
    plannerViewTouchedByUser = true;
    calendarView = 'week';
    applyFilters();
  });

  qs('#planningBoard')?.addEventListener('click', async (event) => {
    const deleteButton = event.target.closest('.btnDeleteReservation');
    if (!deleteButton) return;
    event.preventDefault();
    event.stopPropagation();
    await handleDeleteReservation(deleteButton.dataset.id, deleteButton.dataset.cliente);
  });
}

async function init() {
  primeSidebarFromCache('dashboard');
  currentProfile = await requireAuth({ pageKey: 'dashboard' });
  if (!currentProfile) return;

  renderTopbar({
    title: 'Dashboard',
    subtitle: isSuperadmin(currentProfile)
      ? 'Vista ejecutiva para superadmin: administración de usuarios y resumen de reservas.'
      : 'Planning operativo por habitaciones, con foco en disponibilidad y reservas visibles.',
    actionsHtml: `
      <a id="quickNuevaReserva" hidden class="btn btn-compact topbar-dashboard-cta" href="nueva_reserva.html">Nueva reserva</a>
    `
  });

  configureDashboardMode();
  bindCommonActions();
  renderQuickActions();
  bindFilters();
  applyResponsiveDefaultView();

  window.addEventListener('resize', () => {
    if (plannerViewTouchedByUser) return;
    const previous = calendarView;
    applyResponsiveDefaultView();
    if (previous !== calendarView && !isSuperadmin(currentProfile)) {
      applyFilters();
    }
  });

  try {
    await loadData();
  } catch (error) {
    showToast(error.message || 'No se pudo cargar el dashboard.', 'error', 'Error');

    if (isSuperadmin(currentProfile)) {
      renderEmptyState(qs('#superadminStateSummary'), 'Sin datos', 'No se pudo obtener el resumen de reservas.');
      renderEmptyState(qs('#superadminRecentReservations'), 'Sin datos', 'No se pudo obtener el resumen reciente.');
    } else {
      renderEmptyState(qs('#planningBoard'), 'Sin datos', 'No se pudieron obtener las reservas ni las unidades para el planning.');
    }
  }
}

init();
