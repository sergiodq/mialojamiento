import {
  db,
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from './firebase-config.js';
import {
  requireAuth,
  canManageUsers,
  isSuperadmin,
  isAdmin,
  ROLES,
  REGISTRATION_STATES,
  renderTopbar,
  listScopedProperties,
  getUserById,
  getEmailIndex,
  findUserCandidateByEmail,
  buildUserPayloadFromForm,
  fillMultiSelect,
  qs,
  showToast,
  setFeedback,
  setButtonLoading,
  upsertUserSupportDocs
} from './app-helpers.js';
import { logoutUser } from './auth.js';

let currentProfile = null;
let existingUser = null;
let availableProperties = [];

function getCheckedPropertyIds() {
  return [...document.querySelectorAll('#propiedadIdsChips input[type="checkbox"]:checked')]
    .map((input) => input.value)
    .filter(Boolean);
}

function syncPropertySelectFromChecks() {
  const select = qs('[name="propiedad_ids"]');
  if (!select) return;
  const selectedIds = new Set(getCheckedPropertyIds());
  [...select.options].forEach((option) => {
    option.selected = selectedIds.has(option.value);
  });
}

function updateSelectedPropertiesHint() {
  const hint = qs('#propiedadesSelectedHint');
  if (!hint) return;
  const total = availableProperties.length;
  const selected = getCheckedPropertyIds().length;
  hint.innerHTML = selected
    ? `Seleccionadas: <strong>${selected}</strong> de ${total}. Podés marcar una o varias propiedades para este usuario de recepción. Se mantiene compatibilidad con el campo legacy <span class="codeish">propiedad_id</span>.`
    : `Marcá una o varias propiedades para este usuario de recepción. Se mantiene compatibilidad con el campo legacy <span class="codeish">propiedad_id</span>.`;
}

function renderPropertyCheckboxes(selectedIds = []) {
  const container = qs('#propiedadIdsChips');
  if (!container) return;

  const selectedSet = new Set(selectedIds || []);

  if (!availableProperties.length) {
    container.innerHTML = '<div class="muted">No hay propiedades activas disponibles para asignar.</div>';
    updateSelectedPropertiesHint();
    return;
  }

  container.innerHTML = availableProperties
    .map((property) => `
      <label class="checkbox-chip property-checkbox-item">
        <input type="checkbox" value="${property.id}" ${selectedSet.has(property.id) ? 'checked' : ''}>
        <span>
          <strong>${property.nombre}</strong>
          <small>${property.codigo || property.ciudad || property.id}</small>
        </span>
      </label>
    `)
    .join('');

  syncPropertySelectFromChecks();
  updateSelectedPropertiesHint();
}

function bindCommonActions() {
  qs('#btnLogoutSidebar')?.addEventListener('click', logoutUser);
}

function getUserIdFromUrl() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

function updateRoleUI() {
  const role = qs('[name="rol"]')?.value || ROLES.RECEPCION;
  const propsWrap = qs('#propiedadesAsignadasWrap');
  const empresaField = qs('#empresaField');

  if (role === ROLES.RECEPCION) {
    propsWrap?.removeAttribute('hidden');
  } else {
    propsWrap?.setAttribute('hidden', 'hidden');
  }

  if (isSuperadmin(currentProfile)) {
    empresaField?.removeAttribute('hidden');
  } else {
    empresaField?.setAttribute('hidden', 'hidden');
    const empresaInput = qs('[name="empresa_id"]');
    if (empresaInput) empresaInput.value = currentProfile.empresa_id || '';
  }
}

function populateRoleOptions() {
  const select = qs('[name="rol"]');
  if (!select) return;

  const options = isSuperadmin(currentProfile)
    ? [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.RECEPCION]
    : [ROLES.ADMIN, ROLES.RECEPCION];

  select.innerHTML = options.map((role) => `<option value="${role}">${role}</option>`).join('');
}

async function loadPropertiesOptions() {
  const select = qs('[name="propiedad_ids"]');
  availableProperties = await listScopedProperties(currentProfile, { includeInactive: false });

  if (!select) return;
  select.innerHTML = availableProperties
    .map((property) => `<option value="${property.id}">${property.nombre} · ${property.codigo || property.ciudad || property.id}</option>`)
    .join('');

  renderPropertyCheckboxes(existingUser?.propiedad_ids || []);
}

function fillForm() {
  if (!existingUser) return;

  qs('[name="nombre"]').value = existingUser.nombre || '';
  qs('[name="email"]').value = existingUser.email || '';
  qs('[name="rol"]').value = existingUser.rol || ROLES.RECEPCION;
  qs('[name="empresa_id"]').value = existingUser.empresa_id || '';
  fillMultiSelect(qs('[name="propiedad_ids"]'), existingUser.propiedad_ids || []);
  renderPropertyCheckboxes(existingUser.propiedad_ids || []);

  const emailInput = qs('[name="email"]');
  const lockHint = qs('#emailLockHint');
  if (existingUser.uid && emailInput) {
    emailInput.readOnly = true;
    lockHint.hidden = false;
  }

  updateRoleUI();
}

async function saveUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = qs('#formFeedback');
  const submit = qs('button[type="submit"]', form);
  setFeedback(feedback, '');

  try {
    setButtonLoading(submit, true, existingUser ? 'Guardando...' : 'Creando...');

    const payload = buildUserPayloadFromForm(form, currentProfile, existingUser);
    if (!payload.nombre) {
      throw new Error('Ingresá el nombre del usuario.');
    }
    if (!payload.email) {
      throw new Error('Ingresá el correo.');
    }
    if (!payload.empresa_id && payload.rol !== ROLES.SUPERADMIN) {
      throw new Error('Definí un ámbito/empresa para el usuario.');
    }
    if (payload.rol === ROLES.RECEPCION && !payload.propiedad_ids.length) {
      throw new Error('Un recepcionista debe tener al menos una propiedad asignada.');
    }
    if (!isSuperadmin(currentProfile) && payload.rol === ROLES.SUPERADMIN) {
      throw new Error('Solo un superadmin puede crear otro superadmin.');
    }
    if (existingUser?.uid && payload.email !== existingUser.email) {
      throw new Error('No se puede cambiar el email de un usuario que ya tiene Auth vinculado sin backend/Admin SDK.');
    }

    const index = await getEmailIndex(payload.email);
    const reusableUser = existingUser ? null : await findUserCandidateByEmail(payload.email);
    let savedId = existingUser?.id || '';
    let infoMessage = '';

    if (existingUser) {
      if (index && index.usuario_id && index.usuario_id !== existingUser.id) {
        throw new Error('Ese correo ya pertenece a otro usuario del sistema.');
      }

      payload.uid = existingUser.uid || '';
      payload.estado_registro = existingUser.uid ? REGISTRATION_STATES.ACTIVO : REGISTRATION_STATES.PENDIENTE_AUTH;

      await updateDoc(doc(db, 'usuarios', existingUser.id), {
        ...payload,
        updated_at: serverTimestamp()
      });

      await upsertUserSupportDocs(existingUser.id, payload, { previousEmail: existingUser.email });
      savedId = existingUser.id;
      infoMessage = existingUser.uid
        ? 'Usuario actualizado. Conserva su cuenta de acceso actual.'
        : 'Usuario actualizado. Sigue pendiente de completar su registro.';
    } else if (reusableUser || index?.usuario_id) {
      if (reusableUser && !reusableUser.eliminado && reusableUser.activo) {
        throw new Error('Ya existe un usuario activo con ese correo.');
      }

      const sourceUser = reusableUser || null;
      const recoveredUid = sourceUser?.uid || index?.uid || '';

      const reactivatedPayload = {
        ...payload,
        uid: recoveredUid,
        activo: true,
        eliminado: false,
        eliminado_at: null,
        eliminado_por: '',
        estado_registro: recoveredUid
          ? REGISTRATION_STATES.REQUIERE_RESET
          : REGISTRATION_STATES.PENDIENTE_AUTH,
        created_at: sourceUser?.created_at || payload.created_at || serverTimestamp(),
        creado_por: sourceUser?.creado_por || payload.creado_por || (currentProfile.uid || currentProfile.id || ''),
        updated_at: serverTimestamp()
      };

      savedId = sourceUser?.id || index?.usuario_id || '';
      if (!savedId) {
        throw new Error('No se pudo determinar qué usuario reactivar.');
      }

      await setDoc(doc(db, 'usuarios', savedId), reactivatedPayload, { merge: true });
      await upsertUserSupportDocs(savedId, reactivatedPayload, { previousEmail: sourceUser?.email || payload.email });

      infoMessage = reactivatedPayload.uid
        ? 'Se reactivó el usuario, pero no podrá entrar hasta usar “Olvidé mi clave” y definir una nueva contraseña.'
        : 'Se reactivó el usuario. Quedó pendiente de registrarse en la pantalla de login.';
    } else {
      const created = await addDoc(collection(db, 'usuarios'), payload);
      savedId = created.id;
      await upsertUserSupportDocs(created.id, payload);
      infoMessage = 'Usuario creado. Ahora debe ingresar a login.html y usar “Registrarme”.';
    }

    showToast(infoMessage, 'success', 'Guardado correcto');
    window.location.href = `nuevo_usuario.html?id=${savedId}&ok=1`;
  } catch (error) {
    setFeedback(feedback, error.message || 'No se pudo guardar el usuario.', 'error');
  } finally {
    setButtonLoading(submit, false);
  }
}

async function init() {
  currentProfile = await requireAuth({ roles: ['superadmin', 'admin'], pageKey: 'usuarios' });
  if (!currentProfile || !canManageUsers(currentProfile)) return;

  renderTopbar({
    title: 'Nuevo usuario',
    subtitle: 'Creá perfiles, reactivá correos dados de baja y definí el alcance por empresa y propiedades.',
    actionsHtml: `<a class="btn-ghost" href="usuarios.html">Volver al listado</a>`
  });

  bindCommonActions();
  populateRoleOptions();
  await loadPropertiesOptions();

  const userId = getUserIdFromUrl();
  if (userId) {
    existingUser = await getUserById(userId);
    if (!existingUser) {
      setFeedback(qs('#formFeedback'), 'El usuario que querés editar no existe.', 'error');
      return;
    }
    fillForm();
  } else {
    renderPropertyCheckboxes();
    updateRoleUI();
  }

  qs('[name="rol"]')?.addEventListener('change', updateRoleUI);
  qs('#propiedadIdsChips')?.addEventListener('change', () => {
    syncPropertySelectFromChecks();
    updateSelectedPropertiesHint();
  });
  qs('#usuarioForm')?.addEventListener('submit', saveUser);

  const params = new URLSearchParams(window.location.search);
  if (params.get('ok')) {
    showToast('Los cambios quedaron guardados.', 'success', 'Hecho');
  }
}

init();
