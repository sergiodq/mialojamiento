import {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  deleteUser,
  doc,
  updateDoc,
  serverTimestamp
} from './firebase-config.js';
import {
  REGISTRATION_STATES,
  getCurrentProfileWithRetry,
  getEmailIndex,
  getUserById,
  findUserCandidateByEmail,
  normalizeEmail,
  showToast,
  setFeedback,
  setButtonLoading,
  upsertUserSupportDocs,
  qs,
  qsa,
  clearCachedChromeProfile
} from './app-helpers.js';

const RESET_PENDING_STORAGE_KEY = 'mialojamiento_reset_pending_email';

function rememberResetPendingEmail(email) {
  try {
    localStorage.setItem(RESET_PENDING_STORAGE_KEY, normalizeEmail(email));
  } catch {}
}

function readResetPendingEmail() {
  try {
    return localStorage.getItem(RESET_PENDING_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function clearResetPendingEmail() {
  try {
    localStorage.removeItem(RESET_PENDING_STORAGE_KEY);
  } catch {}
}

function userFacingAuthError(error, fallback = 'No pudimos completar la operación. Intentá nuevamente.') {
  console.error('[MiAlojamiento] Error de autenticación:', error);

  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'El correo o la contraseña no son correctos.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con este correo.';
    case 'auth/invalid-email':
      return 'Ingresá un correo válido.';
    case 'auth/weak-password':
      return 'Elegí una contraseña más segura, de al menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Hiciste varios intentos seguidos. Esperá un momento y probá nuevamente.';
    case 'auth/network-request-failed':
      return 'No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.';
    default:
      return error?.code ? fallback : (error?.message || fallback);
  }
}

async function settleSessionAfterLogin(user) {
  if (!user) return;

  try {
    await user.getIdToken(true);
  } catch {
    // no-op
  }

  await new Promise((resolve) => setTimeout(resolve, 280));
}

export async function loginUser(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
  await settleSessionAfterLogin(credential.user);
  let profile = await getCurrentProfileWithRetry({ attempts: 4, delayMs: 260 });

  if (!profile) {
    const legacyUser = await findUserCandidateByEmail(normalizedEmail);

    if (legacyUser?.activo && !legacyUser.eliminado && legacyUser.estado_registro === REGISTRATION_STATES.REQUIERE_RESET) {
      const resetPendingEmail = readResetPendingEmail();

      if (resetPendingEmail === normalizedEmail) {
        await updateDoc(doc(db, 'usuarios', legacyUser.id), {
          uid: legacyUser.uid || credential.user.uid,
          email: normalizedEmail,
          email_normalizado: normalizedEmail,
          estado_registro: REGISTRATION_STATES.ACTIVO,
          activo: true,
          eliminado: false,
          updated_at: serverTimestamp(),
          actualizado_por: credential.user.uid
        });

        await upsertUserSupportDocs(legacyUser.id, {
          ...legacyUser,
          uid: legacyUser.uid || credential.user.uid,
          email: normalizedEmail,
          email_normalizado: normalizedEmail,
          estado_registro: REGISTRATION_STATES.ACTIVO,
          activo: true,
          eliminado: false,
          propiedad_id: legacyUser.propiedad_id || '',
          propiedad_ids: legacyUser.propiedad_ids || []
        }, { previousEmail: legacyUser.email || normalizedEmail });

        clearResetPendingEmail();
        await settleSessionAfterLogin(credential.user);
        profile = await getCurrentProfileWithRetry({ attempts: 4, delayMs: 260 });
      } else {
        await signOut(auth);
        throw new Error('Esta cuenta fue reactivada. Usá “Olvidé mi clave” para crear una contraseña nueva antes de ingresar.');
      }
    }
  }

  if (!profile) {
    await signOut(auth);
    throw new Error('No pudimos acceder a tu cuenta. Contactá al administrador.');
  }

  clearResetPendingEmail();
  return { credential, profile };
}

async function rollbackCreatedAuthUser(credential) {
  if (!credential?.user) return;
  try {
    await deleteUser(credential.user);
  } catch {
    try {
      await signOut(auth);
    } catch {
      // no-op
    }
  }
}

export async function registerPendingUser({ nombre, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  let emailIndex = await getEmailIndex(normalizedEmail);
  let userProfile = emailIndex?.usuario_id ? await getUserById(emailIndex.usuario_id) : null;

  if (userProfile && (!userProfile.activo || userProfile.eliminado)) {
    throw new Error('Ese usuario está dado de baja. Pedile a un administrador que lo reactive.');
  }

  if (userProfile && userProfile.uid && [REGISTRATION_STATES.ACTIVO, REGISTRATION_STATES.REQUIERE_RESET].includes(userProfile.estado_registro)) {
    throw new Error('Ese correo ya tiene una cuenta. Probá ingresar o recuperar la contraseña.');
  }

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
  } catch (error) {
    if (error?.code === 'auth/email-already-in-use') {
      const existingUser = userProfile || await findUserCandidateByEmail(normalizedEmail);
      if (existingUser?.activo && !existingUser.eliminado && existingUser.uid) {
        throw new Error('Ese correo ya tiene una cuenta. Entrá por “Ingresar” o usá “Olvidé mi clave”.');
      }
      throw new Error('Ya existe una cuenta con este correo. Probá ingresar o recuperar la contraseña.');
    }
    throw error;
  }

  try {
    if (!userProfile) {
      userProfile = await findUserCandidateByEmail(normalizedEmail, { preferPending: true });
    }

    if (!userProfile) {
      await rollbackCreatedAuthUser(credential);
      throw new Error('No encontramos un usuario habilitado con ese correo. Contactá al administrador.');
    }

    if (!userProfile.activo || userProfile.eliminado) {
      await rollbackCreatedAuthUser(credential);
      throw new Error('Tu usuario está dado de baja. Contactá al administrador.');
    }

    if (userProfile.uid && userProfile.uid !== credential.user.uid) {
      await rollbackCreatedAuthUser(credential);
      throw new Error('Ese correo ya está vinculado a otra cuenta. Probá ingresar o recuperar la contraseña.');
    }

    await updateDoc(doc(db, 'usuarios', userProfile.id), {
      nombre: nombre?.trim() || userProfile.nombre,
      email: normalizedEmail,
      email_normalizado: normalizedEmail,
      uid: credential.user.uid,
      estado_registro: REGISTRATION_STATES.ACTIVO,
      activo: true,
      eliminado: false,
      propiedad_id: userProfile.propiedad_id || '',
      propiedad_ids: userProfile.propiedad_ids || [],
      updated_at: serverTimestamp(),
      actualizado_por: credential.user.uid
    });

    await upsertUserSupportDocs(userProfile.id, {
      ...userProfile,
      nombre: nombre?.trim() || userProfile.nombre,
      email: normalizedEmail,
      email_normalizado: normalizedEmail,
      uid: credential.user.uid,
      activo: true,
      eliminado: false,
      estado_registro: REGISTRATION_STATES.ACTIVO,
      propiedad_id: userProfile.propiedad_id || '',
      propiedad_ids: userProfile.propiedad_ids || []
    }, { previousEmail: userProfile.email || normalizedEmail });

    return credential;
  } catch (error) {
    await rollbackCreatedAuthUser(credential);
    throw error;
  }
}

export async function sendReset(email) {
  const normalizedEmail = normalizeEmail(email);
  await sendPasswordResetEmail(auth, normalizedEmail);
  rememberResetPendingEmail(normalizedEmail);
}

export async function logoutUser() {
  clearCachedChromeProfile();
  await signOut(auth);
  window.location.href = 'login.html';
}

function activateTab(mode) {
  qsa('.auth-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });

  qsa('.auth-pane').forEach((panel) => {
    panel.hidden = panel.dataset.mode !== mode;
  });
}

function readQueryMode() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  if (['login', 'register', 'reset'].includes(mode)) return mode;
  return 'login';
}

function renderServerMessage() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  const box = qs('#authMessage');
  if (!box) return;

  if (error === 'sin-perfil') {
    setFeedback(box, 'No pudimos acceder a tu cuenta. Contactá al administrador.', 'error');
  } else {
    box.innerHTML = '';
  }
}

export function initLoginPage() {
  const initialMode = readQueryMode();
  activateTab(initialMode);
  renderServerMessage();

  qsa('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.mode));
  });

  const loginForm = qs('#loginForm');
  const registerForm = qs('#registerForm');
  const resetForm = qs('#resetForm');

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = qs('#loginFeedback');
    setFeedback(feedback, '');
    const email = qs('[name="login_email"]', loginForm)?.value || '';
    const password = qs('[name="login_password"]', loginForm)?.value || '';
    const submit = qs('button[type="submit"]', loginForm);

    try {
      setButtonLoading(submit, true, 'Ingresando...');
      await loginUser(email, password);
      window.location.href = 'dashboard.html';
    } catch (error) {
      setFeedback(feedback, userFacingAuthError(error, 'No pudimos iniciar sesión. Intentá nuevamente.'), 'error');
    } finally {
      setButtonLoading(submit, false);
    }
  });

  registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = qs('#registerFeedback');
    setFeedback(feedback, '');
    const nombre = qs('[name="register_nombre"]', registerForm)?.value || '';
    const email = qs('[name="register_email"]', registerForm)?.value || '';
    const password = qs('[name="register_password"]', registerForm)?.value || '';
    const confirm = qs('[name="register_password_confirm"]', registerForm)?.value || '';
    const submit = qs('button[type="submit"]', registerForm);

    try {
      if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
      if (password !== confirm) throw new Error('Las contraseñas no coinciden.');
      setButtonLoading(submit, true, 'Registrando...');
      await registerPendingUser({ nombre, email, password });
      showToast('Tu cuenta está lista. Ya podés ingresar.', 'success', 'Registro completo');
      window.location.href = 'dashboard.html';
    } catch (error) {
      setFeedback(feedback, userFacingAuthError(error, 'No pudimos completar el registro. Intentá nuevamente.'), 'error');
    } finally {
      setButtonLoading(submit, false);
    }
  });

  resetForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = qs('#resetFeedback');
    setFeedback(feedback, '');
    const email = qs('[name="reset_email"]', resetForm)?.value || '';
    const submit = qs('button[type="submit"]', resetForm);

    try {
      setButtonLoading(submit, true, 'Enviando...');
      await sendReset(email);
      setFeedback(feedback, 'Te enviamos un enlace para cambiar tu contraseña. Revisá también la carpeta de spam.', 'success');
    } catch (error) {
      setFeedback(feedback, userFacingAuthError(error, 'No pudimos enviar el correo. Intentá nuevamente.'), 'error');
    } finally {
      setButtonLoading(submit, false);
    }
  });

  const footerHint = qs('#authFooterHint');
  if (footerHint) footerHint.innerHTML = '';
}
