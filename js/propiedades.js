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
  canManageProperties,
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
        <td>
          <strong>${property.nombre}</strong><br>
          <small class="muted">${property.id}</small>
        </td>
        <td>${property.codigo || '—'}</td>
        <td>${property.tipo || '—'}</td>
        <td>${property.ciudad || '—'}</td>
        <td>${property.empresa_id || '—'}</td>
        <td>${property.check_in || '—'} / ${property.check_out || '—'}</td>
        <td>${property.activo ? '<span class="badge green">Activa</span>' : '<span class="badge orange">Inactiva</span>'}</td>
        <td>
          <div class="table-actions">
            <button class="btn-secondary btnEditProperty" data-id="${property.id}">Editar</button>
            <a class="btn-ghost" href="unidades.html?propiedad=${property.id}">Unidades</a>
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
    title.textContent = editingProperty ? 'Editar propiedad' : 'Nueva propiedad';
  }
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
  }
}

async function editProperty(propertyId) {
  editingProperty = await getPropertyById(propertyId);
  if (!editingProperty) {
    showToast('La propiedad seleccionada ya no existe.', 'warning', 'Atención');
    return;
  }
  fillForm();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindTableActions() {
  qs('#propiedadesBody')?.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('.btnEditProperty');
    if (!editBtn) return;
    await editProperty(editBtn.dataset.id);
  });
}

async function loadProperties() {
  properties = await listScopedProperties(currentProfile, { includeInactive: true });
  applyFilters();
}

async function init() {
  primeSidebarFromCache('propiedades');
  currentProfile = await requireAuth({ roles: ['superadmin', 'admin'], pageKey: 'propiedades' });
  if (!currentProfile || !canManageProperties(currentProfile)) return;

  renderTopbar({
    title: 'Propiedades',
    subtitle: 'Administrá hoteles, departamentos, cabañas y complejos con sus datos generales y comodidades.',
    actionsHtml: `<a class="btn" href="dashboard.html">Ir al dashboard</a>`
  });

  bindCommonActions();
  fillTypeOptions();
  renderAmenities();
  resetForm();
  bindTableActions();

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
