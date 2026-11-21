import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../login.html', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../js/auth.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/auth-flows.css', import.meta.url), 'utf8');

test('login offers a distinct recovery link and invited account activation', () => {
  assert.match(html, /data-auth-mode="reset">¿Olvidaste tu contraseña\?/);
  assert.match(html, /data-auth-mode="register">Activar cuenta/);
  assert.match(html, /data-auth-mode="login">Volver a ingresar/);
  assert.match(html, /id="authPaneTitle"/);
  assert.match(html, /id="authPaneDescription"/);
});

test('forms keep appropriate browser autocomplete semantics', () => {
  assert.match(html, /id="login_password"[^>]*autocomplete="current-password"/);
  assert.match(html, /id="register_password"[^>]*autocomplete="new-password"/);
  assert.match(html, /id="reset_email"[^>]*autocomplete="username"/);
});

test('password recovery does not depend on browser local storage', () => {
  assert.doesNotMatch(auth, /RESET_PENDING_STORAGE_KEY|rememberResetPendingEmail|readResetPendingEmail|clearResetPendingEmail/);
  assert.match(auth, /sendPasswordResetEmail\(auth, normalizedEmail\)/);
});

test('legacy reset state only activates already-linked Firebase identity', () => {
  assert.match(auth, /legacyUser\.uid === credential\.user\.uid/);
  assert.match(auth, /legacyUser\.estado_registro === REGISTRATION_STATES\.REQUIERE_RESET/);
  assert.match(auth, /await signOut\(auth\)\.catch\(\(\) => \{\}\)/);
});

test('mobile recovery form remains hidden while another mode is active', () => {
  assert.match(css, /\.auth-pane\[hidden\]/);
  assert.match(css, /display: none !important/);
});
