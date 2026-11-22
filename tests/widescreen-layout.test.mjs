import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const pages=['login.html','dashboard.html','nueva_reserva.html','propiedades.html','unidades.html','usuarios.html','nuevo_usuario.html'];
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('one final responsive layer is loaded after each screen theme on all seven pages',async()=>{
 for(const page of pages){
  const html=await read(page);
  assert.equal((html.match(/css\/layout-responsive-2026\.css/g)||[]).length,1,page);
  assert.ok(html.indexOf('css/layout-responsive-2026.css')>html.indexOf('css/material-app.css'),page);
  if(page==='dashboard.html'){
    assert.equal((html.match(/css\/planning-wide\.css/g)||[]).length,1);
    assert.ok(html.indexOf('css/planning-wide.css')>html.indexOf('css/layout-responsive-2026.css'));
  }
 }
});

test('desktop tables preserve the 8 columns and actionable controls',async()=>{
 for(const page of ['propiedades.html','unidades.html','usuarios.html']){
  const dom=new JSDOM(await read(page));
  try {
   const headers=[...dom.window.document.querySelectorAll('table thead th')];
   assert.equal(headers.length,8,page);
   assert.equal(headers.at(-1)?.textContent.trim(),'Acciones',page);
   assert.ok(dom.window.document.querySelector('.table-wrap'),page);
  }finally{dom.window.close()}
 }
 const p=await read('js/propiedades.js');
 assert.match(p,/btnEditProperty/);
 assert.match(p,/btnPropertyState/);
 assert.match(p,/unidades\.html\?propiedad=/);
 const u=await read('js/unidades.js');
 assert.match(u,/btnEditUnit/);
 assert.match(u,/btnReactivateUnit/);
});

test('wide desktop table rules override fixed layout and vertically stacked actions',async()=>{
 const css=await read('css/layout-responsive-2026.css');
 assert.match(css,/@media \(min-width:1200px\)/);
 assert.match(css,/@media \(min-width:1440px\)/);
 assert.match(css,/table-layout:auto!important/);
 assert.match(css,/flex-wrap:nowrap!important/);
 assert.match(css,/min-width:260px!important/);
 assert.match(css,/@media \(min-width:840px\) and \(max-width:1199px\)/);
 assert.match(css,/@media \(max-width:839px\)/);
 assert.match(css,/body\.reservation-page/);
 assert.match(css,/body\.properties-page/);
 assert.match(css,/body\.users-page/);
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});

test('weekly and daily planner have one date-header row without removing the monthly grouping',async()=>{
 const source=await read('js/dashboard.js');
 assert.match(source,/const tableHeader = calendarView === 'month'/);
 assert.match(source,/rowspan="2"/);
 assert.ok(source.includes('${dayHeaders}'));
 assert.match(source,/planning-board-table is-/);
 const css=await read('css/planning-wide.css');
 assert.match(css,/table-layout:fixed!important/);
 assert.match(css,/planning-board-table\.is-week-view/);
 assert.match(css,/planning-day-header/);
 assert.match(css,/@media \(min-width:1200px\)/);
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});
