import {
  requireAuth,
  canCreateReservations,
  escapeHtml,
  isSoporte,
  buildSupportPatch,
  RESERVATION_STATUSES,
  renderTopbar,
  primeSidebarFromCache,
  listScopedProperties,
  listUnitsByProperty,
  getReservationById,
  getPropertyById,
  canAccessReservation,
  buildReservationPayload,
  saveReservationWithLocks,
  formatDate,
  qs,
  fillSelectOptions,
  showToast,
  setFeedback,
  setButtonLoading
} from './app-helpers.js';
import { logoutUser } from './auth.js';
import { db, doc, updateDoc } from './firebase-config.js';

let currentProfile = null;
let properties = [];
let units = [];
let editingReservation = null;

function updateReservationPageChrome() {
  const isEditing = Boolean(editingReservation);
  const pageTitle = isEditing ? 'Editar reserva' : 'Nueva reserva';
  const pageSubtitle = isEditing
    ? 'Actualizá los datos de la reserva.'
    : 'Elegí alojamiento, fechas y habitación para comenzar.';

  document.title = `MiAlojamiento · ${pageTitle}`;

  renderTopbar({
    title: pageTitle,
    subtitle: pageSubtitle,
    actionsHtml: `<a class="btn-ghost" href="dashboard.html">Volver</a>`
  });

  const title = qs('#reservationPageTitle');
  if (title) title.textContent = pageTitle;

  const submit = qs('#reservaForm button[type="submit"]');
  if (submit) submit.textContent = isEditing ? 'Guardar cambios' : 'Guardar reserva';
}

function bindCommonActions() {
  qs('#btnLogoutSidebar')?.addEventListener('click', logoutUser);
}

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    reservationId: params.get('id') || '',
    presetPropertyId: params.get('propiedad') || ''
  };
}

function fillStatuses() {
  const select = qs('[name="estado"]');
  if (!select) return;
  select.innerHTML = RESERVATION_STATUSES
    .map((status) => `<option value="${status}">${status}</option>`)
    .join('');
}

function updateManualMode() {
  const manualCheckbox = qs('[name="usar_unidad_manual"]');
  const manualWrap = qs('#unidadManualWrap');
  const unitSelect = qs('[name="unidad_id"]');
  const hint = qs('#unitHint');

  const noUnits = units.length === 0;
  const manual = manualCheckbox?.checked || noUnits;

  manualCheckbox.checked = manual;
  if (noUnits) {
    manualCheckbox.disabled = true;
    hint.textContent = 'No hay habitaciones cargadas. Ingresá una manualmente.';
  } else {
    manualCheckbox.disabled = false;
    hint.textContent = 'Elegí una habitación disponible o ingresala manualmente.';
  }

  if (manual) {
    manualWrap?.removeAttribute('hidden');
    unitSelect?.setAttribute('disabled', 'disabled');
  } else {
    manualWrap?.setAttribute('hidden', 'hidden');
    unitSelect?.removeAttribute('disabled');
  }

  updateCapacityHint();
}

function updateCapacityHint() {
  const manual = qs('[name="usar_unidad_manual"]')?.checked || units.length === 0;
  const unitId = qs('[name="unidad_id"]')?.value || '';
  const manualCapacity = qs('[name="capacidad_manual"]')?.value || '';
  const hint = qs('#capacityHint');

  if (manual) {
    hint.textContent = manualCapacity
      ? `Capacidad: ${manualCapacity} huésped(es).`
      : 'Podés indicar la capacidad para controlar la cantidad de huéspedes.';
    return;
  }

  const unit = units.find((item) => item.id === unitId);
  hint.textContent = unit
    ? `Capacidad máxima: ${unit.capacidad_max}. Adultos: ${unit.capacidad_adultos}. Niños: ${unit.capacidad_ninos}.`
    : 'Seleccioná una unidad para ver su capacidad.';
}

async function loadProperties() {
  properties = await listScopedProperties(currentProfile, { includeInactive: Boolean(getUrlParams().reservationId) });
  const select = qs('[name="propiedad_id"]');

  fillSelectOptions(select, properties, {
    valueKey: 'id',
    labelBuilder: (property) => `${property.nombre} · ${property.codigo || property.ciudad || property.id}`
  });
}

async function loadUnits(propertyId, preserveSelection = '') {
  units = propertyId ? await listUnitsByProperty(propertyId, { includeInactive: Boolean(editingReservation) }) : [];
  const select = qs('[name="unidad_id"]');

  select.innerHTML = units.length
    ? `<option value="">Seleccionar unidad...</option>${units
        .map((unit) => `<option value="${escapeHtml(unit.id)}">${escapeHtml(unit.codigo || unit.nombre)} · ${escapeHtml(unit.nombre)}</option>`)
        .join('')}`
    : '<option value="">Sin unidades activas</option>';

  if (preserveSelection && units.some((item) => item.id === preserveSelection)) {
    select.value = preserveSelection;
  }

  updateManualMode();
}

async function fillEditData() {
  if (!editingReservation) return;

  qs('[name="cliente"]').value = editingReservation.cliente || '';
  qs('[name="fecha_inicio"]').value = editingReservation.fecha_inicio || '';
  qs('[name="fecha_fin"]').value = editingReservation.fecha_fin || '';
  qs('[name="estado"]').value = editingReservation.estado || 'pendiente';
  qs('[name="huespedes"]').value = editingReservation.huespedes || 1;
  qs('[name="total"]').value = editingReservation.total || '';
  qs('[name="observaciones"]').value = editingReservation.observaciones || '';
  qs('[name="propiedad_id"]').value = editingReservation.propiedad_id || '';

  await loadUnits(editingReservation.propiedad_id, editingReservation.unidad_id || '');

  const isManual = !editingReservation.unidad_id;
  qs('[name="usar_unidad_manual"]').checked = isManual;
  qs('[name="unidad_manual"]').value = isManual ? (editingReservation.unidad || editingReservation.unidad_nombre || '') : '';
  qs('[name="capacidad_manual"]').value = isManual ? (editingReservation.capacidad_unidad || '') : '';
  updateManualMode();
  updateCapacityHint();

  updateReservationPageChrome();
}

function bindFormInteractions() {
  qs('[name="propiedad_id"]')?.addEventListener('change', async (event) => {
    await loadUnits(event.target.value);
  });

  qs('[name="usar_unidad_manual"]')?.addEventListener('change', updateManualMode);
  qs('[name="unidad_id"]')?.addEventListener('change', updateCapacityHint);
  qs('[name="capacidad_manual"]')?.addEventListener('input', updateCapacityHint);
}

async function saveReservation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = qs('#formFeedback');
  const submit = qs('button[type="submit"]', form);
  setFeedback(feedback, '');

  try {
    if (isSoporte(currentProfile)) {
      if (!editingReservation) throw new Error('Soporte no puede crear reservas.');
      const patch = buildSupportPatch(currentProfile, 'reservas', {
        observaciones: qs('[name="observaciones"]', form)?.value.trim() || ''
      });
      await updateDoc(doc(db, 'reservas', editingReservation.id), patch);
      showToast('Observaciones actualizadas.', 'success', 'Hecho');
      return;
    }
    setButtonLoading(submit, true, editingReservation ? 'Guardando...' : 'Creando...');

    const propertyId = qs('[name="propiedad_id"]', form)?.value || '';
    const selectedProperty = properties.find((item) => item.id === propertyId);
    if (!selectedProperty) {
      throw new Error('Seleccioná una propiedad válida.');
    }

    const manual = qs('[name="usar_unidad_manual"]', form)?.checked || units.length === 0;
    const selectedUnit = manual ? null : units.find((item) => item.id === (qs('[name="unidad_id"]', form)?.value || ''));

    if (!manual && !selectedUnit) {
      throw new Error('Seleccioná una unidad real para la reserva.');
    }
    if (manual && !qs('[name="unidad_manual"]', form)?.value.trim()) {
      throw new Error('Ingresá el nombre o código de la unidad manual.');
    }

    const payload = buildReservationPayload({
      form,
      actorProfile: currentProfile,
      selectedProperty,
      selectedUnit,
      existingReservation: editingReservation
    });

    const reservationId = await saveReservationWithLocks(payload, editingReservation?.id || '');
    showToast(
      editingReservation ? 'Reserva actualizada correctamente.' : 'Reserva creada correctamente.',
      'success',
      'Hecho'
    );
    window.location.href = `nueva_reserva.html?id=${reservationId}&ok=1`;
  } catch (error) {
    setFeedback(feedback, error.message || 'No se pudo guardar la reserva.', 'error');
  } finally {
    setButtonLoading(submit, false);
  }
}

async function init() {
  primeSidebarFromCache('nueva-reserva');
  currentProfile = await requireAuth({ pageKey: 'nueva-reserva' });
  if (!currentProfile || (!canCreateReservations(currentProfile) && !isSoporte(currentProfile))) return;

  const { reservationId, presetPropertyId } = getUrlParams();
  if (isSoporte(currentProfile) && !reservationId) {
    qs('#reservaForm').hidden = true;
    setFeedback(qs('#legacyHint'), 'Soporte puede consultar reservas existentes y editar sus observaciones.', 'info');
    return;
  }

  updateReservationPageChrome();

  bindCommonActions();
  fillStatuses();
  bindFormInteractions();
  await loadProperties();

  if (presetPropertyId && properties.some((item) => item.id === presetPropertyId)) {
    qs('[name="propiedad_id"]').value = presetPropertyId;
    await loadUnits(presetPropertyId);
  }

  if (reservationId) {
    editingReservation = await getReservationById(reservationId);
    if (!editingReservation || !canAccessReservation(currentProfile, editingReservation)) {
      setFeedback(qs('#formFeedback'), 'No existe la reserva o no tenés permisos para editarla.', 'error');
      return;
    }
    await fillEditData();
  } else {
    await loadUnits(qs('[name="propiedad_id"]')?.value || '');
  }
  if (isSoporte(currentProfile)) {
    for (const input of qs('#reservaForm').querySelectorAll('input,select,textarea')) {
      input.disabled = input.name !== 'observaciones';
    }
    renderTopbar({ title: 'Consultar reserva', subtitle: 'Soporte solo puede editar las observaciones.', actionsHtml: '<a class="btn-ghost" href="dashboard.html">Volver al dashboard</a>' });
  }

  qs('#reservaForm')?.addEventListener('submit', saveReservation);

  const params = new URLSearchParams(window.location.search);
  if (params.get('ok')) {
    showToast('La reserva quedó guardada.', 'success', 'Todo bien');
  }


}

init();
