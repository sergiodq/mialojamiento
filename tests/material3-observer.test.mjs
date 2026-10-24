import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

for (const id of ['emailLockHint', 'propiedadesSelectedHint']) {
  test(`Material UI settles after updating ${id} instead of freezing the page`, () => {
    // Use a separate process: an infinite MutationObserver microtask loop also
    // prevents ordinary test timeouts from executing in the affected process.
    const source = `
      import { JSDOM } from 'jsdom';
      const dom = new JSDOM('<body><small id="${id}">Original</small><div id="formFeedback"></div></body>', {url:'https://example.test/nuevo_usuario.html'});
      globalThis.window = dom.window;
      globalThis.document = dom.window.document;
      globalThis.MutationObserver = dom.window.MutationObserver;
      await new Promise(resolve => dom.window.addEventListener('load', resolve, {once:true}));
      await import('./js/material3-ui.js');
      document.querySelector('#formFeedback').textContent = 'Cambio de formulario';
      setTimeout(() => {
        document.getElementById('${id}').textContent = 'Actualización posterior';
        setTimeout(() => {
          console.log(JSON.stringify({hint:document.getElementById('${id}').textContent, ready:document.documentElement.classList.contains('m3-ready')}));
          dom.window.close();
        }, 20);
      }, 20);
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
      cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 5000
    });
    assert.equal(result.error?.code, undefined, 'The page event loop must remain responsive');
    assert.equal(result.status, 0, result.stderr);
    const actual = JSON.parse(result.stdout.trim());
    assert.equal(actual.ready, true);
    assert.equal(actual.hint, id === 'emailLockHint'
      ? 'El correo de este usuario no puede modificarse.'
      : 'Seleccioná una o varias propiedades para este usuario.');
  });
}
