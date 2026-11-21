import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pages = ['login.html','dashboard.html','nueva_reserva.html','usuarios.html','nuevo_usuario.html','propiedades.html','unidades.html'];
const css = await readFile(new URL('../css/responsive-final.css', import.meta.url),'utf8');

test('final responsive styles load after the existing visual layers on every screen', async () => {
  for (const path of pages) {
    const html = await readFile(new URL('../'+path,import.meta.url),'utf8');
    const oldTheme = html.indexOf('css/ux-vibrante.css');
    const newTheme = html.indexOf('css/responsive-final.css');
    assert.ok(oldTheme > 0, path+' has theme');
    assert.ok(newTheme > oldTheme, path+' final styles load last');
    assert.equal(html.match(/css\/responsive-final\.css/g)?.length,1,path+' has one final layer');
  }
});

test('desktop, horizontal tablet, and phone widths have independent navigation configurations', () => {
  assert.match(css, /@media \(min-width:1200px\)/);
  assert.match(css, /@media \(min-width:840px\) and \(max-width:1199px\)/);
  assert.match(css, /@media \(max-width:839px\)/);
  assert.match(css, /@media \(max-width:420px\)/);
  assert.match(css, /margin:0!important;width:100%!important/);
  assert.match(css, /inset:auto 0 0 0!important/);
});

test('booking, users, accommodation and unit screens are covered by responsive rules', () => {
  for(const selector of ['body.reservation-page','body.properties-page','body.units-page','body.dashboard-page','body.login-page']){
    assert.ok(css.includes(selector),'missing '+selector);
  }
  assert.match(css, /reservation-primary-card/);
  assert.match(css, /reservation-step\[hidden\]/);
});

test('responsive stylesheet has balanced rule braces',() => {
  const opens=[...css].filter(x=>x==='{').length;
  const closes=[...css].filter(x=>x==='}').length;
  assert.equal(opens,closes);
});
