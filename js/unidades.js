import {
  db,
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp
} from './firebase-config.js';
import {
  requireAuth,
  escapeHtml,
  canManageProperties,
  canReadProperties,
  canCreateReservations,
  BED_OPTIONS,
  UNIT_TYPES,
  UNIT_AMENITIES,
  canAccessProperty,
  getPropertyById,
  listUnitsByProperty,
  buildUnitPayloadFromForm,
  generateInternalCode,
  deletePropertyUnit,
  renderTopbar,
  primeSidebarFromCache,
  renderCheckboxChips,
  qs,
  showToast,
  setFeedback,
  setButtonLoading
} from './app-helpers.js';
import { logoutUser } from './auth.js';

let currentProfile = null;
let currentProperty = null;
let units = [];
let editingUnit = null;

function assignGeneratedUnitCode() {
  const input = qs('[name="codigo"]');
  if (!input) return;
  if (editingUnit?.codigo) {
    input.value = editingUnit.codigo;
    return;
  }
  input.value = generateInternalCode('UNI');
}

function bindCommonActions() {
  qs('#btnLogoutSidebar')?.addEventListener('click', logoutUser);
}

function getPropertyIdFromUrl() {
  return new URLSearchParams(window.location.search).get('propiedad') || '';
}

function fillTypeOptions() {
  const select = qs('[name="tipo_unidad"]');
  if (!select) return;
  select.innerHTML = `<option value="">Seleccionar...</option>${UNIT_TYPES
    .map((type) => `<option value="${type}">${type}</option>`)
    .join('')}`;
}

function renderOptions(selectedBeds = [], selectedAmenities = []) {
  renderCheckboxChips(qs('#camasContainer'), BED_OPTIONS, selectedBeds, 'cama');
  renderCheckboxChips(qs('#comodidadesUnidad'), UNIT_AMENITIES, selectedAmenities, 'comodidad_unidad');
}

function fillForm() {
  const form = qs('#unidadForm');
  if (!form) return;

  qs('[name="codigo"]', form).value = editingUnit?.codigo || generateInternalCode('UNI');
  qs('[name="nombre"]', form).value = editingUnit?.nombre || '';
  qs('[name="tipo_unidad"]', form).value = editingUnit?.tipo_unidad || '';
  qs('[name="capacidad_max"]', form).value = editingUnit?.capacidad_max || '';
  qs('[name="capacidad_adultos"]', form).value = editingUnit?.capacidad_adultos || '';
  qs('[name="capacidad_ninos"]', form).value = editingUnit?.capacidad_ninos || '';
  qs('[name="activa"]', form).checked = editingUnit?.activa ?? true;

  renderOptions(editingUnit?.camas || [], editingUnit?.comodidades || []);

  qs('#unitFormTitle').textContent = editingUnit ? 'Editar habitación' : 'Nueva habitación';
  const context = qs('#unitEditorContext');
  if (context) context.textContent = editingUnit
    ? `Modificando ${editingUnit.nombre}. Los cambios se guardarán en esta habitación.`
    : 'Completá los datos de la nueva habitación.';
  const submit = qs('#unidadForm button[type="submit"]');
  if (submit) submit.textContent = editingUnit ? 'Guardar cambios' : 'Crear habitación';
}

function setEditorVisible(visible) {
  const editor = qs('#unitEditor');
  const list = qs('#unitList');
  if (editor) editor.hidden = !visible;
  if (list) list.hidden = visible;
  if (visible) editor?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  editingUnit = null;
  qs('#unidadForm')?.reset();
  renderOptions();
  fillForm();
  setFeedback(qs('#formFeedback'), '');
  setEditorVisible(false);
}

function startNewUnit() {
  if (!canManageProperties(currentProfile)) return;
  resetForm();
  setEditorVisible(true);
  qs('[name="nombre"]')?.focus();
}

function renderUnits() {
  const tbody = qs('#unidadesBody');
  if (!tbody) return;

  if (!units.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="table-empty">Todavía no cargaste unidades para esta propiedad.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = units
    .map((unit) => `
      <tr>
        <td data-label="Código"><strong>${escapeHtml(unit.codigo || '—')}</strong></td>
        <td data-label="Nombre">${escapeHtml(unit.nombre || '—')}</td>
        <td data-label="Tipo">${escapeHtml(unit.tipo_unidad || '—')}</td>
        <td data-label="Cap. máx">${unit.capacidad_max || 0}</td>
        <td data-label="Adultos">${unit.capacidad_adultos || 0}</td>
        <td data-label="Niños">${unit.capacidad_ninos || 0}</td>
        <td data-label="Estado">${unit.activa ? '<span class="badge green">Activa</span>' : '<span class="badge orange">Inactiva</span>'}</td>
        <td data-label="Acciones">
          <div class="table-actions">
            ${canManageProperties(currentProfile) ? `<button class="btn-secondary btnEditUnit" data-id="${escapeHtml(unit.id)}">Editar</button>
            ${unit.activa
              ? `<button type="button" class="btnDeleteUnit management-deactivate" data-id="${escapeHtml(unit.id)}">Desactivar</button>`
              : `<button type="button" class="btnReactivateUnit management-reactivate" data-id="${escapeHtml(unit.id)}">Reactivar</button>`}` : 'Solo consulta'}
          </div>
        </td>
      </tr>
    `)
    .join('');
}

async function loadUnits() {
  units = await listUnitsByProperty(currentProperty.id, { includeInactive: true });
  renderUnits();
  const count = qs('#unitListCount');
  if (count) count.textContent = `${units.length} habitación${units.length === 1 ? '' : 'es'} · ${units.filter(unit => unit.activa).length} activa${units.filter(unit => unit.activa).length === 1 ? '' : 's'}`;
}

async function saveUnit(event) {
  event.preventDefault();
  if (!canManageProperties(currentProfile)) return;
  const form = event.currentTarget;
  const feedback = qs('#formFeedback');
  const submit = qs('button[type="submit"]', form);
  setFeedback(feedback, '');

  try {
    setButtonLoading(submit, true, editingUnit ? 'Guardando...' : 'Creando...');
    const payload = buildUnitPayloadFromForm(form, currentProfile, editingUnit);

    if (!payload.codigo) throw new Error('Ingresá el código o número de la unidad.');
    if (!payload.nombre) throw new Error('Ingresá el nombre visible de la unidad.');
    if (!payload.tipo_unidad) throw new Error('Seleccioná el tipo de unidad.');
    if (payload.capacidad_max <= 0) throw new Error('La capacidad máxima debe ser mayor a cero.');
    if (payload.capacidad_adultos + payload.capacidad_ninos > payload.capacidad_max) {
      throw new Error('La suma de adultos y niños no debería superar la capacidad máxima.');
    }

    const duplicated = units.find((item) => item.codigo === payload.codigo && item.id !== editingUnit?.id);
    if (duplicated) {
      throw new Error('Ya existe otra unidad con ese código dentro de esta propiedad.');
    }

    if (editingUnit) {
      await updateDoc(doc(db, 'propiedades', currentProperty.id, 'unidades', editingUnit.id), {
        ...payload,
        updated_at: serverTimestamp()
      });
      showToast('Unidad actualizada correctamente.', 'success', 'Hecho');
    } else {
      await addDoc(collection(db, 'propiedades', currentProperty.id, 'unidades'), payload);
      showToast('Unidad creada correctamente.', 'success', 'Hecho');
    }

    await loadUnits();
    resetForm();
  } catch (error) {
    setFeedback(feedback, error.message || 'No se pudo guardar la unidad.', 'error');
  } finally {
    setButtonLoading(submit, false);
  }
}

async function editUnit(unitId) {
  editingUnit = units.find((item) => item.id === unitId) || null;
  if (!editingUnit) {
    showToast('La unidad ya no existe.', 'warning', 'Atención');
    return;
  }
  fillForm();
  setEditorVisible(true);
  qs('[name="nombre"]')?.focus();

}

async function deleteUnit(unitId) {
  if (!canManageProperties(currentProfile)) return;
  const unit = units.find((item) => item.id === unitId);
  if (!unit) return;
  if (!window.confirm(`Se desactivará la unidad ${unit.nombre || unit.codigo}, conservando su historial. ¿Continuar?`)) return;

  try {
    await deletePropertyUnit(currentProperty.id, unitId);
    showToast('Unidad desactivada. Se conserva su historial.', 'success', 'Hecho');
    await loadUnits();
  } catch (error) {
    showToast(error.message || 'No se pudo desactivar la habitación.', 'error', 'Error');
  }
}

async function reactivateUnit(unitId) {
  if (!canManageProperties(currentProfile)) return;
  const unit = units.find(item => item.id === unitId);
  if (!unit || unit.activa) return;
  if (!window.confirm(`¿Reactivar "${unit.nombre}"? Volverá a estar disponible para nuevas reservas si el alojamiento también está activo.`)) return;
  try {
    await updateDoc(doc(db,'propiedades',currentProperty.id,'unidades',unit.id), {
      activa: true, updated_at: serverTimestamp()
    });
    showToast('Habitación reactivada.', 'success', 'Hecho');
    await loadUnits();
  } catch (error) {
    showToast(error.message || 'No se pudo reactivar la habitación.', 'error', 'Error');
  }
}

function bindTableActions() {
  qs('#unidadesBody')?.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('.btnEditUnit');
    if (editBtn) {
      await editUnit(editBtn.dataset.id);
      return;
    }
    const deleteBtn = event.target.closest('.btnDeleteUnit');
    if (deleteBtn) {
      await deleteUnit(deleteBtn.dataset.id);
      return;
    }
    const reactivateBtn = event.target.closest('.btnReactivateUnit');
    if (reactivateBtn) await reactivateUnit(reactivateBtn.dataset.id);
  });
}

async function init() {
  primeSidebarFromCache('propiedades');
  currentProfile = await requireAuth({ roles: ['superadmin', 'admin', 'soporte'], pageKey: 'propiedades' });
  if (!currentProfile || !canReadProperties(currentProfile)) return;

  const propertyId = getPropertyIdFromUrl();
  if (!propertyId) {
    qs('#unidadesRoot').innerHTML = `<div class="callout error">Falta el parámetro de propiedad.</div>`;
    return;
  }

  currentProperty = await getPropertyById(propertyId);
  if (!currentProperty || !canAccessProperty(currentProfile, currentProperty)) {
    qs('#unidadesRoot').innerHTML = `<div class="callout error">No tenés acceso a esta propiedad.</div>`;
    return;
  }

  renderTopbar({
    title: `Habitaciones · ${escapeHtml(currentProperty.nombre)}`,
    subtitle: 'Consultá, editá o cambiá el estado de las habitaciones.',
    actionsHtml: `
      <a class="btn-ghost" href="propiedades.html">Volver a propiedades</a>
      ${canCreateReservations(currentProfile) ? `<a class="btn-secondary" href="nueva_reserva.html?propiedad=${currentProperty.id}">Reservar en esta propiedad</a>` : ''}
    `
  });

  bindCommonActions();
  fillTypeOptions();
  resetForm();
  if (!canManageProperties(currentProfile)) {
    qs('#unidadForm').hidden = true;
    qs('#btnNuevaUnidad')?.setAttribute('hidden','hidden');
  }
  qs('#btnNuevaUnidad')?.addEventListener('click',startNewUnit);
  bindTableActions();

  qs('#unidadForm')?.addEventListener('submit', saveUnit);
  qs('#btnCancelarEdicionUnidad')?.addEventListener('click', resetForm);
  qs('#propertyResume').innerHTML = `
    <div class="stat-item"><span>Propiedad</span><strong>${escapeHtml(currentProperty.nombre)}</strong></div>
    <div class="stat-item"><span>Código</span><strong>${escapeHtml(currentProperty.codigo || '—')}</strong></div>
    <div class="stat-item"><span>Ciudad</span><strong>${escapeHtml(currentProperty.ciudad || '—')}</strong></div>
    <div class="stat-item"><span>Check-in / out</span><strong>${escapeHtml(currentProperty.check_in)} / ${escapeHtml(currentProperty.check_out)}</strong></div>
  `;

  try {
    await loadUnits();
  } catch (error) {
    showToast(error.message || 'No se pudieron cargar las unidades.', 'error', 'Error');
  }
}

init();
