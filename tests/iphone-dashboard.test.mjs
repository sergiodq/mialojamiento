import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const read=async(name)=>readFile(new URL('../'+name,import.meta.url),'utf8');
test('dashboard loads iPhone CSS after all existing theme styles',async()=>{
 const html=await read('dashboard.html');
 assert.ok(html.indexOf('css/iphone-dashboard.css')>html.indexOf('css/material-selects.css'));
 assert.equal((html.match(/iphone-dashboard\.css/g)||[]).length,1);
 const dom=new JSDOM(html);
 try{
  const doc=dom.window.document;
  assert.ok(doc.querySelector('.planner-period-controls #calendarMonthLabel'));
  assert.ok(doc.querySelector('#quickNuevaReservaPlanning[hidden]'));
  assert.deepEqual([...doc.querySelectorAll('.dashboard-view-switch button')].map(el=>el.textContent),['Mes','Semana','Día']);
 }finally{dom.window.close();}
});
test('iPhone 12 rules keep all three tabs in one row and prevent calendar date squashing',async()=>{
 const css=await read('css/iphone-dashboard.css');
 assert.match(css,/@media \(max-width:839px\)/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
 assert.match(css,/\.planner-period-controls #calendarMonthLabel/);
 assert.match(css,/overflow-wrap:normal!important/);
 assert.match(css,/white-space:nowrap!important/);
 assert.match(css,/\.m3-account-button/);
 assert.match(css,/\.m3-fab/);
 assert.match(css,/display:none!important/);
});
test('dashboard starts in daily view on compact devices and leaves role checks in place',async()=>{
 const source=await read('js/dashboard.js');
 assert.match(source,/calendarView = isSmallMobile\(\) \? 'day' : 'week'/);
 assert.match(source,/qs\('#quickNuevaReservaPlanning'\)/);
 assert.match(source,/canCreateReservations\(currentProfile\)/);
 assert.match(source,/aria-pressed/);
 assert.match(source,/Disponible en este período/);
});
test('iPhone CSS has matched braces',async()=>{
 const css=await read('css/iphone-dashboard.css');
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});
