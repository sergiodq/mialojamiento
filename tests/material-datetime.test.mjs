import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { initMaterialDateTime } from '../js/material-datetime.js';
const pages=['login.html','dashboard.html','nueva_reserva.html','propiedades.html','unidades.html','usuarios.html','nuevo_usuario.html'];
function setup(html){
  const dom=new JSDOM('<!doctype html><html><body>'+html+'</body></html>',{url:'https://example.test/nueva_reserva.html',pretendToBeVisual:true});
  initMaterialDateTime(dom.window.document);
  return dom;
}
test('all seven pages have unified Material 3 CSS and date/time controls',async()=>{
  for(const page of pages){
    const html=await readFile(new URL('../'+page,import.meta.url),'utf8');
    assert.match(html,/css\/material-app\.css/,page);
    assert.match(html,/css\/material-datetime\.css/,page);
    assert.match(html,/js\/material-datetime\.js/,page);
    assert.ok(html.indexOf('css/material-app.css')>html.indexOf('css/material-selects.css'),page);
  }
});
test('date picker opens as a dialog and writes an ISO date into the native form field',()=>{
  const dom=setup('<form><label for="fecha">Check-in</label><input type="date" id="fecha" name="fecha" required value="2026-11-21"></form>');
  try{
    const doc=dom.window.document,input=doc.querySelector('#fecha');
    let changes=0;
    input.addEventListener('change',()=>changes++);
    const btn=doc.querySelector('.m3-datetime-trigger');
    assert.ok(btn);
    assert.match(btn.textContent,/21/);
    btn.click();
    const dialog=doc.querySelector('.m3-datetime-sheet');
    assert.equal(dialog.parentElement,doc.body);
    assert.equal(dialog.getAttribute('aria-modal'),'true');
    assert.equal(doc.querySelector('.m3-datetime-backdrop')?.parentElement,doc.body);
    doc.querySelector('[data-date="2026-11-24"]').click();
    assert.equal(input.value,'2026-11-24');
    assert.equal(new dom.window.FormData(doc.querySelector('form')).get('fecha'),'2026-11-24');
    assert.equal(changes,1);
    assert.equal(doc.querySelector('.m3-datetime-sheet'),null);
  }finally{dom.window.close();}
});
test('date picker honors min and max while allowing month and year changes',()=>{
  const dom=setup('<label for="date">Salida</label><input id="date" type="date" min="2026-11-20" max="2026-11-30">');
  try{
    const doc=dom.window.document;doc.querySelector('.m3-datetime-trigger').click();
    doc.querySelector('.m3-calendar-heading').click();
    assert.equal(doc.querySelectorAll('.m3-calendar-month').length,12);
    doc.querySelector('[aria-label="noviembre 2026"]')?.click();
    assert.equal(doc.querySelector('[data-date="2026-11-10"]').disabled,true);
    assert.equal(doc.querySelector('[data-date="2026-11-24"]').disabled,false);
  }finally{dom.window.close();}
});
test('time picker preserves HH:mm, handles increments, and fires change',()=>{
  const dom=setup('<label for="checkin">Check-in</label><input id="checkin" name="check_in" type="time" value="14:00">');
  try{
    const doc=dom.window.document,input=doc.querySelector('#checkin');
    let changes=0;input.addEventListener('change',()=>changes++);
    doc.querySelector('.m3-datetime-trigger').click();
    assert.equal(doc.querySelectorAll('.m3-time-number').length,2);
    const numbers=doc.querySelectorAll('.m3-time-number');
    numbers[0].value='15';
    numbers[1].value='35';
    doc.querySelector('.m3-picker-apply').click();
    assert.equal(input.value,'15:35');
    assert.equal(changes,1);
    assert.match(doc.querySelector('.m3-datetime-trigger').textContent,/15:35/);
  }finally{dom.window.close();}
});
test('disabled fields cannot open and native constraints still apply',()=>{
  const dom=setup('<input type="date" min="2026-11-20" max="2026-11-30"><input type="time" disabled>');
  try{
    const doc=dom.window.document;
    const date=doc.querySelector('input[type=date]');
    date.value='2026-11-15';
    assert.equal(date.checkValidity(),false);
    assert.equal(doc.querySelectorAll('.m3-datetime-trigger').length,2);
    doc.querySelectorAll('.m3-datetime-trigger')[1].click();
    assert.equal(doc.querySelector('.m3-datetime-sheet'),null);
  }finally{dom.window.close();}
});
test('global Material app styling covers cards, form controls, buttons, tables and navigation',async()=>{
  const css=await readFile(new URL('../css/material-app.css',import.meta.url),'utf8');
  for(const key of ['.card','.field','.btn','.table-wrap','.checkbox-chip','.toast','.m3-bottom-nav']){
    assert.ok(css.includes(key),key);
  }
  const calendarCss=await readFile(new URL('../css/material-datetime.css',import.meta.url),'utf8');
  assert.match(calendarCss,/z-index:12001/);
  assert.match(calendarCss,/@media \(max-width:839px\)/);
});
