import {
  requireAuth,
  canManageUsers,
  listScopedUsers,
  markUserAsDeleted,
  reactivateUser,
  renderTopbar,
  renderStatusBadge,
  userMatchesFilter,
  qs,
  showToast,
  formatDateTime
} from './app-helpers.js';
import { logoutUser } from './auth.js';

let currentProfile = null;
let users = [];

function bindCommonActions() {
  qs('#btnLogoutSidebar')?.addEventListener('click', logoutUser);
}

function renderTable(filtered = users) {
  const tbody = qs('#usuariosBody');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="table-empty">No hay usuarios para mostrar.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((user) => `
      <tr>
        <td>
          <strong>${user.nombre || '—'}</strong><br>
          <small class="muted">${user.id}</small>
        </td>
        <td>${user.email}</td>
        <td>${user.rol}</td>
        <td>${user.empresa_id || '—'}</td>
        <td>${user.propiedad_ids?.length ? user.propiedad_ids.join(', ') : '—'}</td>
        <td>${user.estado_registro}</td>
        <td>${user.eliminado ? '<span class="badge red">Baja lógica</span>' : (user.activo ? '<span class="badge green">Activo</span>' : '<span class="badge orange">Inactivo</span>')}</td>
        <td>
          <div class="table-actions">
            <a class="btn-secondary" href="nuevo_usuario.html?id=${user.id}">Editar</a>
            ${user.eliminado
              ? `<button class="btn btnReactivateUser" data-id="${user.id}">Reactivar</button>`
              : ((user.id !== currentProfile?.id && user.uid !== currentProfile?.uid)
                  ? `<button class="btn-danger btnDeleteUser" data-id="${user.id}">Dar de baja</button>`
                  : '')}
          </div>
        </td>
      </tr>
    `)
    .join('');

  qs('.muted-users-foot')?.remove();
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
    showToast('El superusuario no puede darse de baja a sí mismo.', 'error', 'Acción no permitida');
    return;
  }

  if (!window.confirm(`Se dará de baja lógicamente a ${target.nombre || target.email}. ¿Continuar?`)) {
    return;
  }

  try {
    await markUserAsDeleted(currentProfile, target);
    showToast('Usuario dado de baja. El registro se conserva para poder reactivarlo.', 'success', 'Baja lógica');
    await loadUsers();
  } catch (error) {
    showToast(error.message || 'No se pudo dar de baja el usuario.', 'error', 'Error');
  }
}

async function handleReactivate(userId) {
  const target = users.find((item) => item.id === userId);
  if (!target) return;

  if (!window.confirm(`Se reactivará a ${target.nombre || target.email}. ¿Continuar?`)) {
    return;
  }

  try {
    await reactivateUser(currentProfile, target);
    showToast('Usuario reactivado correctamente.', 'success', 'Reactivación');
    await loadUsers();
  } catch (error) {
    showToast(error.message || 'No se pudo reactivar el usuario.', 'error', 'Error');
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
    if (reactivateButton) {
      await handleReactivate(reactivateButton.dataset.id);
    }
  });
}

async function loadUsers() {
  users = await listScopedUsers(currentProfile, { includeDeleted: true });
  applyFilters();
}

async function init() {
  currentProfile = await requireAuth({ roles: ['superadmin', 'admin'], pageKey: 'usuarios' });
  if (!currentProfile || !canManageUsers(currentProfile)) return;

  renderTopbar({
    title: 'Usuarios',
    subtitle: 'Alta, edición, baja lógica y reactivación automática por email reutilizado.',
    actionsHtml: `<a class="btn" href="nuevo_usuario.html">Nuevo usuario</a>`
  });

  bindCommonActions();
  bindTableActions();

  qs('#filtroUsuario')?.addEventListener('input', applyFilters);
  qs('#verBajas')?.addEventListener('change', applyFilters);

  try {
    await loadUsers();
  } catch (error) {
    showToast(error.message || 'No se pudieron cargar los usuarios.', 'error', 'Error');
  }
}

init();
