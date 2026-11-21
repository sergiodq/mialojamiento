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
  isSoporte,
  SUPPORT_FIELDS,
  buildSupportPatch,
  isSuperadmin,
  PROPERTY_TYPES,
  GENERAL_AMENITIES,
  renderTopbar,
  primeSidebarFromCache,
  renderCheckboxChips,
  listScopedProperties,
  propertyMatchesFilter,
  getPropertyById,
  buildPropertyPayloadFromForm,
  generateInternalCode,
  qs,
  showToast,
  setFeedback,
  setButtonLoading
} from './app-helpers.js';
import { logoutUser } from './auth.js';

let currentProfile = null;
let properties = [];
let editingProperty = null;

function assignGeneratedPropertyCode() {
  const input = qs('[name="codigo"]');
  if (!input) return;
  if (editingProperty?.codigo) {
    input.value = editingProperty.codigo;
    return;
  }
  input.value = generateInternalCode('PRO');
}

function toggleReceptionHours() {
  const is24h = qs('[name="recepcion_24h"]')?.checked;
  qs('#horarioRecepcionDesdeField')?.toggleAttribute('hidden', Boolean(is24h));
  qs('#horarioRecepcionHastaField')?.toggleAttribute('hidden', Boolean(is24h));
}

function bindCommonActions() {
  qs('#btnLogoutSidebar')?.addEventListener('click', logoutUser);
}

function fillTypeOptions() {
  const select = qs('[name="tipo"]');
  if (!select) return;
  select.innerHTML = `<option value="">Seleccionar...</option>${PROPERTY_TYPES
    .map((type) => `<option value="${type}">${type}</option>`)
    .join('')}`;
}

function renderAmenities() {
  renderCheckboxChips(qs('#comodidadesGenerales'), GENERAL_AMENITIES, [], 'comodidad_general');
}

function renderTable(filtered = properties) {
  const tbody = qs('#propiedadesBody');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="table-empty">No hay propiedades cargadas.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((property) => `
      <tr>
        <td data-label="Propiedad">
          <div class="table-cell-content">
            <strong>${escapeHtml(property.nombre)}</strong>
            <small class="muted">${escapeHtml(property.id)}</small>
          </div>
        </td>
        <td data-label="Código">${escapeHtml(property.codigo || '—')}</td>
        <td data-label="Tipo">${escapeHtml(property.tipo || '—')}</td>
        <td data-label="Ciudad">${escapeHtml(property.ciudad || '—')}</td>
        <td data-label="Ámbito">${escapeHtml(property.empresa_id || '—')}</td>
        <td data-label="Horarios">${escapeHtml(property.check_in || '—')} / ${escapeHtml(property.check_out || '—')}</td>
        <td data-label="Estado">${property.activo ? '<span class="badge green">Activa</span>' : '<span class="badge orange">Inactiva</span>'}</td>
        <td data-label="Acciones">
          <div class="table-actions">
            <button type="button" class="btn-secondary btnEditProperty" data-id="${escapeHtml(property.id)}">${isSoporte(currentProfile) ? 'Ver / contacto' : 'Editar'}</button>
            <a class="btn-ghost" href="unidades.html?propiedad=${encodeURIComponent(property.id)}">Habitaciones</a>
            ${canManageProperties(currentProfile) ? `<button type="button" class="btnPropertyState ${property.activo ? 'management-deactivate' : 'management-reactivate'}" data-id="${escapeHtml(property.id)}">${property.activo ? 'Desactivar' : 'Reactivar'}</button>` : ''}
          </div>
        </td>
      </tr>
    `)
    .join('');
}

function applyFilters() {
  const text = qs('#filtroPropiedad')?.value || '';
  const includeInactive = qs('#verInactivas')?.checked || false;
  const filtered = properties.filter((item) => propertyMatchesFilter(item, text) && (includeInactive ? true : item.activo));
  renderTable(filtered);
  const count = qs('#propertyListCount');
  if (count) count.textContent = `${filtered.length} alojamiento${filtered.length === 1 ? '' : 's'} en el listado`;
}

function fillForm() {
  const form = qs('#propiedadForm');
  if (!form) return;

  qs('[name="nombre"]', form).value = editingProperty?.nombre || '';
  qs('[name="codigo"]', form).value = editingProperty?.codigo || generateInternalCode('PRO');
  qs('[name="tipo"]', form).value = editingProperty?.tipo || '';
  qs('[name="pais"]', form).value = editingProperty?.pais || 'Argentina';
  qs('[name="provincia"]', form).value = editingProperty?.provincia || '';
  qs('[name="ciudad"]', form).value = editingProperty?.ciudad || '';
  qs('[name="codigo_postal"]', form).value = editingProperty?.codigo_postal || '';
  qs('[name="direccion"]', form).value = editingProperty?.direccion || '';
  qs('[name="descripcion"]', form).value = editingProperty?.descripcion || '';
  qs('[name="check_in"]', form).value = editingProperty?.check_in || '14:00';
  qs('[name="check_out"]', form).value = editingProperty?.check_out || '10:00';
  qs('[name="recepcion_24h"]', form).checked = editingProperty?.recepcion_24h ?? false;
  qs('[name="horario_recepcion_desde"]', form).value = editingProperty?.horario_recepcion_desde || '08:00';
  qs('[name="horario_recepcion_hasta"]', form).value = editingProperty?.horario_recepcion_hasta || '22:00';
  // La vista Material 3 debe reflejar los horarios guardados, también al editar.
  for (const fieldName of ['check_in','check_out','horario_recepcion_desde','horario_recepcion_hasta']) {
    qs(`[name="${fieldName}"]`, form)?.dispatchEvent(new window.Event('input'));
  }
  qs('[name="incluye_desayuno"]', form).checked = editingProperty?.incluye_desayuno ?? false;
  qs('[name="admite_mascotas"]', form).checked = editingProperty?.admite_mascotas ?? false;
  qs('[name="politica_cancelacion"]', form).value = editingProperty?.politica_cancelacion || '';
  qs('[name="telefono"]', form).value = editingProperty?.telefono || '';
  qs('[name="email_contacto"]', form).value = editingProperty?.email_contacto || '';
  qs('[name="observaciones_internas"]', form).value = editingProperty?.observaciones_internas || '';
  qs('[name="activo"]', form).checked = editingProperty?.activo ?? true;
  qs('[name="empresa_id"]', form).value = editingProperty?.empresa_id || currentProfile.empresa_id || '';

  renderCheckboxChips(qs('#comodidadesGenerales'), GENERAL_AMENITIES, editingProperty?.comodidades_generales || [], 'comodidad_general');
  toggleReceptionHours();

  const title = qs('#propertyFormTitle');
  if (title) {
    title.textContent = editingProperty ? 'Editar alojamiento' : 'Nuevo alojamiento';
  }
  const context = qs('#propertyEditorContext');
  if (context) context.textContent = editingProperty
    ? `Modificando: ${editingProperty.nombre}. Los cambios se guardarán en este alojamiento.`
    : 'Completá los datos para crear un alojamiento.';
  const submit = qs('#propiedadForm button[type="submit"]');
  if (submit) submit.textContent = editingProperty ? 'Guardar cambios' : 'Crear alojamiento';

  if (isSoporte(currentProfile)) {
    for (const input of form.querySelectorAll('input,select,textarea')) {
      input.disabled = !SUPPORT_FIELDS.propiedades.includes(input.name) || !editingProperty;
    }
    const submit = qs('button[type="submit"]', form);
    if (submit) submit.disabled = !editingProperty;
    if (title) title.textContent = editingProperty ? 'Contacto y notas del alojamiento' : 'Seleccioná un alojamiento';
    if (submit) submit.textContent = 'Guardar contacto y notas';
  }
}

function setEditorVisible(visible) {
  const editor = qs('#propertyEditor');
  const list = qs('#propertyList');
  if (editor) editor.hidden = !visible;
  if (list) list.hidden = visible;
  if (visible) editor?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  editingProperty = null;
  qs('#propiedadForm')?.reset();
  renderAmenities();
  if (!isSuperadmin(currentProfile)) {
    qs('[name="empresa_id"]')?.closest('.field')?.setAttribute('hidden', 'hidden');
    const empresa = qs('[name="empresa_id"]');
    if (empresa) empresa.value = currentProfile.empresa_id || '';
  } else {
    qs('[name="empresa_id"]')?.closest('.field')?.removeAttribute('hidden');
  }
  fillForm();
  setFeedback(qs('#formFeedback'), '');
  setEditorVisible(false);
}

function startNewProperty() {
  if (!canManageProperties(currentProfile)) return;
  resetForm();
  setEditorVisible(true);
  qs('[name="nombre"]')?.focus();
}

async function setPropertyActiveState(propertyId) {
  if (!canManageProperties(currentProfile)) return;
  const property = properties.find(item => item.id === propertyId);
  if (!property) return;
  const activate = !property.activo;
  const message = activate
    ? `¿Reactivar "${property.nombre}"? Volverá a aparecer entre los alojamientos activos.`
    : `¿Desactivar "${property.nombre}"? No se borrarán sus datos ni sus reservas. Dejará de figurar como alojamiento activo.`;
  if (!window.confirm(message)) return;
  try {
    await updateDoc(doc(db, 'propiedades', property.id), {
      activo: activate,
      updated_at: serverTimestamp()
    });
    showToast(activate ? 'Alojamiento reactivado.' : 'Alojamiento desactivado. Conservamos su historial.', 'success', 'Hecho');
    if (!activate) {
      const toggle = qs('#verInactivas');
      if (toggle) toggle.checked = true;
    }
    await loadProperties();
  } catch (error) {
    showToast(error.message || 'No se pudo cambiar el estado del alojamiento.', 'error', 'Error');
  }
}

function validateUniqueCode(payload) {
  const duplicated = properties.find((item) =>
    item.codigo_normalizado === payload.codigo_normalizado &&
    item.empresa_id === payload.empresa_id &&
    item.id !== editingProperty?.id
  );

  if (duplicated) {
    throw new Error('Ya existe una propiedad con ese código dentro del mismo ámbito/empresa.');
  }
}

async function saveProperty(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = qs('#formFeedback');
  const submit = qs('button[type="submit"]', form);
  setFeedback(feedback, '');

  try {
    if (isSoporte(currentProfile)) {
      if (!editingProperty) throw new Error('Soporte no puede crear propiedades.');
      const changes = Object.fromEntries(SUPPORT_FIELDS.propiedades.map(key => [key, qs(`[name="${key}"]`, form)?.value.trim() || '']));
      await updateDoc(doc(db, 'propiedades', editingProperty.id), buildSupportPatch(currentProfile, 'propiedades', changes));
      showToast('Contacto y notas actualizados.', 'success', 'Hecho');
      await loadProperties();
      resetForm();
      return;
    }
    setButtonLoading(submit, true, editingProperty ? 'Guardando...' : 'Creando...');
    const payload = buildPropertyPayloadFromForm(form, currentProfile, editingProperty);

    if (!payload.nombre) throw new Error('Ingresá el nombre de la propiedad.');
    if (!payload.codigo) throw new Error('Ingresá el código interno.');
    if (!payload.tipo) throw new Error('Seleccioná el tipo de propiedad.');
    if (!payload.empresa_id) throw new Error('Definí el ámbito/empresa de la propiedad.');
    if (!payload.pais) throw new Error('Indicá el país de la propiedad.');
    if (!payload.provincia) throw new Error('Indicá la provincia o estado.');
    if (!payload.telefono) throw new Error('Ingresá un teléfono de contacto.');
    if (!payload.email_contacto) throw new Error('Ingresá un email de contacto.');
    if (!payload.recepcion_24h && (!payload.horario_recepcion_desde || !payload.horario_recepcion_hasta)) {
      throw new Error('Completá el horario de recepción o marcá recepción 24 horas.');
    }

    validateUniqueCode(payload);

    if (editingProperty) {
      await updateDoc(doc(db, 'propiedades', editingProperty.id), {
        ...payload,
        updated_at: serverTimestamp()
      });
      showToast('Propiedad actualizada correctamente.', 'success', 'Hecho');
    } else {
      await addDoc(collection(db, 'propiedades'), payload);
      showToast('Propiedad creada correctamente.', 'success', 'Hecho');
    }

    await loadProperties();
    resetForm();
  } catch (error) {
    setFeedback(feedback, error.message || 'No se pudo guardar la propiedad.', 'error');
  } finally {
    setButtonLoading(submit, false);
    if (isSoporte(currentProfile) && !editingProperty && submit) submit.disabled = true;
  }
}

async function editProperty(propertyId) {
  editingProperty = await getPropertyById(propertyId);
  if (!editingProperty) {
    showToast('La propiedad seleccionada ya no existe.', 'warning', 'Atención');
    return;
  }
  fillForm();
  setEditorVisible(true);
  qs('[name="nombre"]')?.focus();

}

function bindTableActions() {
  qs('#propiedadesBody')?.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('.btnEditProperty');
    if (editBtn) {
      await editProperty(editBtn.dataset.id);
      return;
    }
    const stateBtn = event.target.closest('.btnPropertyState');
    if (stateBtn) await setPropertyActiveState(stateBtn.dataset.id);
  });
}

async function loadProperties() {
  properties = await listScopedProperties(currentProfile, { includeInactive: true });
  applyFilters();
}

async function init() {
  primeSidebarFromCache('propiedades');
  currentProfile = await requireAuth({ roles: ['superadmin', 'admin', 'soporte'], pageKey: 'propiedades' });
  if (!currentProfile || !canReadProperties(currentProfile)) return;

  renderTopbar({
    title: 'Alojamientos',
    subtitle: 'Elegí un alojamiento para editar sus datos, habitaciones o estado.',
    actionsHtml: `<a class="btn" href="dashboard.html">Ir al dashboard</a>`
  });

  bindCommonActions();
  fillTypeOptions();
  renderAmenities();
  resetForm();
  if (!canManageProperties(currentProfile)) qs('#btnNuevaPropiedad')?.setAttribute('hidden','hidden');
  bindTableActions();
  qs('#btnNuevaPropiedad')?.addEventListener('click', startNewProperty);

  qs('#propiedadForm')?.addEventListener('submit', saveProperty);
  qs('#btnCancelarEdicionPropiedad')?.addEventListener('click', resetForm);
  qs('[name="recepcion_24h"]')?.addEventListener('change', toggleReceptionHours);
  qs('#filtroPropiedad')?.addEventListener('input', applyFilters);
  qs('#verInactivas')?.addEventListener('change', applyFilters);

  try {
    await loadProperties();
  } catch (error) {
    showToast(error.message || 'No se pudieron cargar las propiedades.', 'error', 'Error');
  }
}

init();
