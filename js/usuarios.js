import {
  requireAuth,
  canManageUsers,
  listScopedUsers,
  markUserAsDeleted,
  reactivateUser,
  renderTopbar,
  primeSidebarFromCache,
  userMatchesFilter,
  qs,
  showToast
} from './app-helpers.js';
import { logoutUser } from './auth.js';

let currentProfile = null;
let users = [];

function bindCommonActions() {
  qs('#btnLogoutSidebar')?.addEventListener('click', logoutUser);
}

function roleLabel(role = '') {
  return {
    superadmin: 'Superadmin',
    admin: 'Administrador',
    recepcion: 'Recepción'
  }[role] || role || '—';
}

function accessLabel(state = '') {
  return {
    activo: 'Activo',
    pendiente_auth: 'Pendiente',
    requiere_reset: 'Debe cambiar la contraseña'
  }[state] || 'Pendiente';
}

function renderTable(filtered = users) {
  const tbody = qs('#usuariosBody');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">No hay usuarios para mostrar.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((user) => `
      <tr>
        <td data-label="Usuario"><strong>${user.nombre || '—'}</strong></td>
        <td data-label="Email">${user.email}</td>
        <td data-label="Rol">${roleLabel(user.rol)}</td>
        <td data-label="Ámbito">${user.empresa_id || '—'}</td>
        <td data-label="Propiedades">${user.propiedad_ids?.length ? `${user.propiedad_ids.length} asignada${user.propiedad_ids.length === 1 ? '' : 's'}` : '—'}</td>
        <td data-label="Acceso">${accessLabel(user.estado_registro)}</td>
        <td data-label="Estado">${user.eliminado ? '<span class="badge red">Desactivado</span>' : (user.activo ? '<span class="badge green">Activo</span>' : '<span class="badge orange">Inactivo</span>')}</td>
        <td data-label="Acciones">
          <div class="table-actions">
            <a class="btn-secondary" href="nuevo_usuario.html?id=${user.id}">Editar</a>
            ${user.eliminado
              ? `<button class="btn btnReactivateUser" data-id="${user.id}">Reactivar</button>`
              : ((user.id !== currentProfile?.id && user.uid !== currentProfile?.uid)
                  ? `<button class="btn-danger btnDeleteUser" data-id="${user.id}">Desactivar</button>`
                  : '')}
          </div>
        </td>
      </tr>
    `)
    .join('');
}

function applyFilters() {
  const text = qs('#filtroUsuario')?.value || '';
  const includeDeleted = qs('#verBajas')?.checked || false;
  const filtered = users.filter((item) => userMatchesFilter(item, text) && (includeDeleted ? true : !item.eliminado));
  renderTable(filtered);
}

async function handleDelete(userId) {
  const target = users.find((item) => item.id === userId);
  if (!target) return;

  if (target.id === currentProfile?.id || (target.uid && target.uid === currentProfile?.uid)) {
    showToast('No podés desactivar tu propio usuario.', 'error', 'Acción no permitida');
    return;
  }

  if (!window.confirm(`¿Querés desactivar a ${target.nombre || target.email}?`)) return;

  try {
    await markUserAsDeleted(currentProfile, target);
    showToast('El usuario quedó desactivado.', 'success', 'Usuario actualizado');
    await loadUsers();
  } catch (error) {
    console.error('[MiAlojamiento] No se pudo desactivar el usuario:', error);
    showToast('No pudimos desactivar el usuario. Intentá nuevamente.', 'error', 'No se pudo completar');
  }
}

async function handleReactivate(userId) {
  const target = users.find((item) => item.id === userId);
  if (!target) return;

  if (!window.confirm(`¿Querés reactivar a ${target.nombre || target.email}?`)) return;

  try {
    await reactivateUser(currentProfile, target);
    showToast('El usuario volvió a estar activo.', 'success', 'Usuario reactivado');
    await loadUsers();
  } catch (error) {
    console.error('[MiAlojamiento] No se pudo reactivar el usuario:', error);
    showToast('No pudimos reactivar el usuario. Intentá nuevamente.', 'error', 'No se pudo completar');
  }
}

function bindTableActions() {
  qs('#usuariosBody')?.addEventListener('click', async (event) => {
    const deleteButton = event.target.closest('.btnDeleteUser');
    if (deleteButton) {
      await handleDelete(deleteButton.dataset.id);
      return;
    }
    const reactivateButton = event.target.closest('.btnReactivateUser');
    if (reactivateButton) await handleReactivate(reactivateButton.dataset.id);
  });
}

async function loadUsers() {
  users = await listScopedUsers(currentProfile, { includeDeleted: true });
  applyFilters();
}

async function init() {
  primeSidebarFromCache('usuarios');
  currentProfile = await requireAuth({ roles: ['superadmin', 'admin'], pageKey: 'usuarios' });
  if (!currentProfile || !canManageUsers(currentProfile)) return;

  renderTopbar({
    title: 'Usuarios',
    subtitle: 'Administrá los accesos de tu equipo.',
    actionsHtml: `<a class="btn" href="nuevo_usuario.html">Nuevo usuario</a>`
  });

  bindCommonActions();
  bindTableActions();
  qs('#filtroUsuario')?.addEventListener('input', applyFilters);
  qs('#verBajas')?.addEventListener('change', applyFilters);

  try {
    await loadUsers();
  } catch (error) {
    console.error('[MiAlojamiento] No se pudieron cargar los usuarios:', error);
    showToast('No pudimos cargar los usuarios. Intentá nuevamente.', 'error', 'No se pudo cargar');
  }
}

init();
