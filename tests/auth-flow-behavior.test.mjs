import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sdk = [
  'export const auth = {}, db = {};',
  "export const signInWithEmailAndPassword = async (_, email) => ({ user: { uid: globalThis.__authMock.uid, getIdToken: async () => '' } });",
  'export const sendPasswordResetEmail = async (_, email) => { globalThis.__authMock.sent.push(email); };',
  "export const createUserWithEmailAndPassword = async () => { throw new Error('not used'); };",
  'export const signOut = async () => { globalThis.__authMock.signedOut++; };',
  'export const deleteUser = async () => {};',
  'export const doc = (...args) => args;',
  'export const updateDoc = async (...args) => { globalThis.__authMock.updates.push(args); };',
  'export const serverTimestamp = () => null;'
].join('\n');

const helpers = [
  "export const REGISTRATION_STATES = { ACTIVO: 'activo', PENDIENTE_AUTH: 'pendiente_auth', REQUIERE_RESET: 'requiere_reset' };",
  'export const getCurrentProfileWithRetry = async () => globalThis.__authMock.profiles.shift() || null;',
  'export const findUserCandidateByEmail = async () => globalThis.__authMock.legacy;',
  "export const normalizeEmail = value => String(value || '').trim().toLowerCase();",
  'export const upsertUserSupportDocs = async (...args) => { globalThis.__authMock.support.push(args); };',
  'export const getEmailIndex = async () => null, getUserById = async () => null;',
  'export const showToast = () => {}, setFeedback = () => {}, setButtonLoading = () => {};',
  'export const qs = () => null, qsa = () => [], clearCachedChromeProfile = () => {};'
].join('\n');

const asDataUri = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const source = readFileSync(new URL('../js/auth.js', import.meta.url), 'utf8')
  .replace("'./firebase-config.js'", JSON.stringify(asDataUri(sdk)))
  .replace("'./app-helpers.js'", JSON.stringify(asDataUri(helpers)));
const { loginUser, sendReset } = await import(asDataUri(source));

function resetMock(override = {}) {
  globalThis.__authMock = {
    uid: 'uid-1', sent: [], signedOut: 0, updates: [], support: [], profiles: [],
    legacy: null, ...override
  };
}

test('password reset normalizes email and needs no local browser state', async () => {
  resetMock();
  await sendReset('  USER@EXAMPLE.COM ');
  assert.deepEqual(globalThis.__authMock.sent, ['user@example.com']);
});

test('valid Firebase sign-in gives access to an active profile', async () => {
  resetMock({ profiles: [{ id: 'p1', rol: 'admin', activo: true }] });
  const result = await loginUser(' USER@example.com ', 'test-password');
  assert.equal(result.profile.id, 'p1');
  assert.equal(globalThis.__authMock.signedOut, 0);
});

test('legacy reset state can be activated only by its linked Firebase UID', async () => {
  resetMock({
    profiles: [null, { id: 'p1', rol: 'recepcion', activo: true }],
    legacy: { id: 'p1', uid: 'uid-1', email: 'user@example.com',
      activo: true, eliminado: false, estado_registro: 'requiere_reset' }
  });
  await loginUser('USER@example.com', 'test-password');
  assert.equal(globalThis.__authMock.updates.length, 1);
  assert.equal(globalThis.__authMock.support.length, 1);
  assert.equal(globalThis.__authMock.signedOut, 0);
});

test('unknown or differently linked profile signs out instead of granting access', async () => {
  resetMock({
    legacy: { id: 'p1', uid: 'uid-other', email: 'user@example.com',
      activo: true, eliminado: false, estado_registro: 'requiere_reset' }
  });
  await assert.rejects(loginUser('user@example.com', 'test-password'), /administrador/);
  assert.equal(globalThis.__authMock.updates.length, 0);
  assert.ok(globalThis.__authMock.signedOut >= 1);
});
