import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyMessage, buildMobileNavModel, isMobileNavItemActive } from '../js/material3-ui.js';

test('friendlyMessage hides Firebase and Firestore implementation details', () => {
  assert.equal(
    friendlyMessage('La cuenta existe en Authentication, pero no tiene un perfil válido o activo en Firestore.'),
    'No pudimos acceder a tu cuenta. Contactá al administrador.'
  );
});

test('friendlyMessage keeps actionable business messages readable', () => {
  assert.equal(friendlyMessage('Ese correo ya existe en Authentication.'), 'Ya existe una cuenta con este correo.');
  assert.equal(friendlyMessage('pendiente_auth'), 'Tu cuenta todavía no está habilitada.');
});

test('buildMobileNavModel only exposes actions already allowed by desktop navigation', () => {
  const adminLinks = [
    { label: 'Dashboard', href: 'dashboard.html' },
    { label: 'Usuarios', href: 'usuarios.html' },
    { label: 'Propiedades', href: 'propiedades.html' },
    { label: 'Nueva reserva', href: 'nueva_reserva.html' }
  ];
  const model = buildMobileNavModel(adminLinks, 'dashboard.html');
  assert.deepEqual(model.primary.map(item => item.label), ['Inicio', 'Reservas', 'Propiedades']);
  assert.equal(model.fab?.href, 'nueva_reserva.html');
  assert.deepEqual(model.secondary.map(item => item.label), ['Usuarios']);
});

test('buildMobileNavModel does not invent admin links for reception', () => {
  const receptionLinks = [
    { label: 'Dashboard', href: 'dashboard.html' },
    { label: 'Nueva reserva', href: 'nueva_reserva.html' }
  ];
  const model = buildMobileNavModel(receptionLinks, 'dashboard.html');
  assert.deepEqual(model.primary.map(item => item.label), ['Inicio', 'Reservas']);
  assert.equal(model.fab?.href, 'nueva_reserva.html');
  assert.deepEqual(model.secondary, []);
});

test('dashboard reservation target keeps its planning hash distinct from Inicio', () => {
  const model = buildMobileNavModel([
    { label: 'Dashboard', href: 'dashboard.html' },
    { label: 'Nueva reserva', href: 'nueva_reserva.html' }
  ], 'dashboard.html');
  assert.equal(model.primary.find(item => item.label === 'Inicio').href, 'dashboard.html');
  assert.equal(model.primary.find(item => item.label === 'Reservas').href, 'dashboard.html#planningBoard');
});

test('only one dashboard destination is active at a time', () => {
  const inicio = { label: 'Inicio', href: 'dashboard.html' };
  const reservas = { label: 'Reservas', href: 'dashboard.html#planningBoard' };
  assert.equal(isMobileNavItemActive(inicio, 'dashboard.html', ''), true);
  assert.equal(isMobileNavItemActive(reservas, 'dashboard.html', ''), false);
  assert.equal(isMobileNavItemActive(inicio, 'dashboard.html', '#planningBoard'), false);
  assert.equal(isMobileNavItemActive(reservas, 'dashboard.html', '#planningBoard'), true);
});
