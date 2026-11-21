import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

test('inactive or deleted authentication mirrors cannot authorize application roles', () => {
  assert.match(rules, /authMirror\(\)\.data\.get\('activo', true\) == true/);
  assert.match(rules, /authMirror\(\)\.data\.get\('eliminado', false\) == false/);
});

test('admin-managed user records must not grant superadmin', () => {
  for (const path of ['email_index', 'usuarios_auth', 'usuarios']) {
    const section = rules.split('match /' + path + '/')[1]?.split(/\n    match \/|\n  }\n}/)[0] || '';
    assert.match(section, /request\.resource\.data\.rol != 'superadmin'/, path);
  }
});

test('self-registration must preserve assigned properties', () => {
  assert.match(rules, /request\.resource\.data\.propiedad_ids == targetUserData\(request\.resource\.data\.usuario_id\)\.get\('propiedad_ids', \[\]\)/);
});

test('reservation updates validate both old and new company', () => {
  const section = rules.split('match /reservas/{reservationId}')[1].split('match /reserva_ocupacion')[0];
  assert.match(section, /resource\.data\.empresa_id == myCompany\(\)/);
  assert.match(section, /request\.resource\.data\.empresa_id == myCompany\(\)/);
});
