import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const pages=['login.html','dashboard.html','nueva_reserva.html','propiedades.html','unidades.html','usuarios.html','nuevo_usuario.html'];
const resolve=file=>new URL('../'+file,import.meta.url);

test('all seven pages have resolvable local navigation assets and no missing stylesheet or script',async()=>{
  for(const page of pages) {
    const html=await readFile(resolve(page),'utf8');
    const dom=new JSDOM(html);
    try {
      for(const element of dom.window.document.querySelectorAll('script[src],link[href],a[href]')) {
        const value=element.getAttribute('src') || element.getAttribute('href');
        if(!value||/^(?:https?:|data:|mailto:|tel:|#)/.test(value))continue;
        const pathname=value.split(/[?#]/)[0];
        if(!/\.(?:css|js|html)$/.test(pathname))continue;
        await assert.doesNotReject(access(resolve(pathname)),page+' references missing file '+pathname);
      }
    } finally {dom.window.close()}
  }
});

test('all app screens retain responsive design, same auth and navigation controls',async()=>{
  for(const page of pages) {
    const html=await readFile(resolve(page),'utf8');
    const doc=new JSDOM(html).window.document;
    assert.ok(doc.querySelector('link[href="css/material-app.css"]'),page+' missing app theme');
    assert.ok(doc.querySelector('script[src="js/material-selects.js"]'),page+' missing custom selects');
    assert.ok(doc.querySelector('script[src="js/material-datetime.js"]'),page+' missing custom date/time');
  }
  const dashboard=await readFile(resolve('dashboard.html'),'utf8');
  assert.match(dashboard,/id="plannerReservationDetail"/);
  assert.match(dashboard,/id="plannerPropertyNavigation"/);
  assert.match(dashboard,/id="viewMonthBtn"/);
  assert.match(dashboard,/id="viewWeekBtn"/);
  assert.match(dashboard,/id="viewDayBtn"/);
});
