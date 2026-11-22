import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('dashboard uses compact operational layout while retaining existing IDs and actions', async()=>{
  const html=await read('dashboard.html');
  const dom=new JSDOM(html);
  try{
    const doc=dom.window.document;
    const cards=[...doc.querySelectorAll('.dashboard-kpi-grid .dashboard-kpi-card')];
    assert.equal(cards.length,6);
    assert.deepEqual(cards.slice(0,4).map(c=>c.querySelector('.kpi-label')?.textContent.trim()),[
      'Unidades activas','Ocupadas hoy','Disponibles hoy','Reservas visibles'
    ]);
    assert.ok(doc.querySelector('.dashboard-workspace-card'));
    assert.ok(doc.querySelector('#quickNuevaReservaPlanning[hidden]'));
    for(const id of ['viewDayBtn','viewWeekBtn','viewMonthBtn','calendarMonthLabel','calendarPrev','calendarNext','calendarToday','filtroTexto','filtroPropiedad','filtroEstado','plannerFilters','plannerResume','planningBoard']){
      assert.ok(doc.getElementById(id),'missing '+id);
    }
    assert.equal(doc.querySelectorAll('.dashboard-view-switch button').length,3);
    assert.ok(html.indexOf('css/dashboard-operativo.css')>html.indexOf('css/material-app.css'));
  }finally{dom.window.close()}
});
test('calendar controls and view switching keep the existing booking logic',async()=>{
  const source=await read('js/dashboard.js');
  assert.match(source,/calendarView = isSmallMobile\(\) \? 'day' : 'week'/);
  assert.match(source,/qs\('#viewWeekBtn'\)\?\.addEventListener\('click'/);
  assert.match(source,/qs\('#viewMonthBtn'\)\?\.addEventListener\('click'/);
  assert.match(source,/qs\('#viewDayBtn'\)\?\.addEventListener\('click'/);
  assert.match(source,/qs\('#calendarToday'\)\?\.addEventListener\('click'/);
  assert.match(source,/canCreateReservations\(currentProfile\)/);
});
test('responsive design has independent tablet, desktop and phone layouts',async()=>{
  const css=await read('css/dashboard-operativo.css');
  assert.match(css,/@media \(min-width:1400px\)/);
  assert.match(css,/@media \(min-width:840px\) and \(max-width:1140px\)/);
  assert.match(css,/@media \(max-width:839px\)/);
  assert.match(css,/\.dashboard-view-switch[^{]*\{[\s\S]*?grid-template-columns:\s*repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(css,/\.dashboard-kpi-grid[^\{]*\{[\s\S]*?repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(css,/#plannerFilters\.is-collapsed \{display:none!important\}/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});
