import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { initMaterialSelects, formatSelectDisplayLabel } from '../js/material-selects.js';

const settle=()=>new Promise(resolve=>setTimeout(resolve,15));
function setup(html) {
  const dom=new JSDOM('<!doctype html><html><body>'+html+'</body></html>',{url:'https://example.test/',pretendToBeVisual:true});
  dom.window.HTMLElement.prototype.scrollIntoView=function(){};
  initMaterialSelects(dom.window.document);
  return dom;
}
test('Material select displays modern options and preserves native selected value and change events',async()=>{
  const dom=setup('<form id="form"><label for="alojamiento">Alojamiento</label><select id="alojamiento" name="propiedad_id" required><option value="">Elegir</option><option value="hotel">Hotel</option><option value="caba">Cabaña</option></select></form>');
  try{
    const doc=dom.window.document;
    const select=doc.querySelector('#alojamiento');
    let changes=0;
    select.addEventListener('change',()=>changes++);
    const trigger=doc.querySelector('.m3-select-trigger');
    assert.ok(trigger);
    assert.match(trigger.textContent,/Elegir/);
    trigger.click();
    assert.equal(trigger.getAttribute('aria-expanded'),'true');
    const opts=[...doc.querySelectorAll('.m3-select-option')];
    assert.equal(opts.length,3);
    opts[2].click();
    assert.equal(select.value,'caba');
    assert.equal(new dom.window.FormData(doc.querySelector('#form')).get('propiedad_id'),'caba');
    assert.equal(changes,1);
    assert.match(trigger.textContent,/Cabaña/);
    assert.equal(trigger.getAttribute('aria-expanded'),'false');
  }finally{dom.window.close();}
});
test('AJAX populated selects receive a fresh list and support native disabled state',async()=>{
  const dom=setup('<label for="unidad">Habitación</label><select id="unidad"></select>');
  try{
    const doc=dom.window.document,select=doc.querySelector('#unidad');
    select.innerHTML='<option value="">Seleccionar unidad</option><option value="1">101</option>';
    await settle();
    const trigger=doc.querySelector('.m3-select-trigger');
    trigger.click();
    assert.equal(doc.querySelectorAll('.m3-select-option').length,2);
    doc.querySelectorAll('.m3-select-option')[1].click();
    assert.equal(select.value,'1');
    select.disabled=true;
    await settle();
    assert.equal(trigger.disabled,true);
  }finally{dom.window.close();}
});
test('keyboard arrows and Escape are supported without changing selection',()=>{
  const dom=setup('<label for="rol">Rol</label><select id="rol"><option value="admin">Admin</option><option value="soporte">Soporte</option></select>');
  try{
    const doc=dom.window.document,select=doc.querySelector('select');
    const trigger=doc.querySelector('.m3-select-trigger');
    trigger.click();
    const first=doc.querySelector('.m3-select-option');
    first.focus();
    first.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
    assert.equal(doc.activeElement.textContent,'Soporte');
    doc.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    assert.equal(trigger.getAttribute('aria-expanded'),'false');
    assert.equal(select.value,'admin');
  }finally{dom.window.close();}
});
test('multi-select elements are left native to preserve existing assignment workflow',()=>{
  const dom=setup('<select id="ids" multiple><option value="1">Uno</option></select><select id="simple"><option>Simple</option></select>');
  try{
    const doc=dom.window.document;
    assert.equal(doc.querySelector('#ids').classList.contains('m3-native-select'),false);
    assert.equal(doc.querySelector('#simple').classList.contains('m3-native-select'),true);
  }finally{dom.window.close();}
});
test('all pages include the common select control stylesheet and script',async()=>{
  for(const page of ['dashboard.html','login.html','nueva_reserva.html','nuevo_usuario.html','propiedades.html','unidades.html','usuarios.html']){
    const html=await readFile(new URL('../'+page,import.meta.url),'utf8');
    assert.match(html,/css\/material-selects\.css/);
    assert.match(html,/js\/material-selects\.js/);
  }
});

test('option sheet is portaled to body above the backdrop and remains interactive',()=>{
  const dom=setup('<section class="card" style="transform:translateZ(0);overflow:hidden"><label for="x">Alojamiento</label><select id="x"><option value="a">Cabaña</option><option value="b">Hotel</option></select></section>');
  try{
    const doc=dom.window.document;
    const panel=doc.querySelector('.m3-select-panel');
    const backdrop=doc.querySelector('.m3-select-backdrop');
    assert.equal(panel.parentElement,doc.body);
    assert.equal(panel.hidden,true);
    doc.querySelector('.m3-select-trigger').click();
    assert.equal(panel.hidden,false);
    assert.equal(backdrop.hidden,false);
    assert.equal(doc.body.classList.contains('m3-select-is-open'),true);
    doc.querySelectorAll('.m3-select-option')[1].click();
    assert.equal(doc.querySelector('#x').value,'b');
    assert.equal(panel.hidden,true);
    assert.equal(backdrop.hidden,true);
  }finally{dom.window.close();}
});
test('clicking outside closes the mobile sheet without modifying the select',()=>{
  const dom=setup('<label for="x">Propiedad</label><select id="x"><option value="1">Uno</option><option value="2">Dos</option></select>');
  try{
    const doc=dom.window.document;
    doc.querySelector('.m3-select-trigger').click();
    doc.querySelector('.m3-select-backdrop').click();
    assert.equal(doc.querySelector('.m3-select-panel').hidden,true);
    assert.equal(doc.querySelector('select').value,'1');
  }finally{dom.window.close();}
});

test('visible state labels use sentence case while preserving Firestore values',()=>{
  const dom=setup('<label for="estado">Estado</label><select id="estado" name="estado"><option value="">Todos</option><option value="pendiente">pendiente</option><option value="pendiente de pago">pendiente de pago</option><option value="confirmada">confirmada</option><option value="bloqueada">bloqueada</option><option value="mantenimiento">mantenimiento</option><option value="cancelada">cancelada</option></select>');
  try{
    const doc=dom.window.document;
    const select=doc.querySelector('#estado');
    doc.querySelector('.m3-select-trigger').click();
    const labels=[...doc.querySelectorAll('.m3-select-option')].map(el=>el.querySelector('span')?.textContent);
    assert.deepEqual(labels,['Todos','Pendiente','Pendiente de pago','Confirmada','Bloqueada','Mantenimiento','Cancelada']);
    doc.querySelectorAll('.m3-select-option')[2].click();
    assert.equal(select.value,'pendiente de pago');
    assert.equal(select.options[2].textContent,'pendiente de pago');
    assert.equal(doc.querySelector('.m3-select-value').textContent,'Pendiente de pago');
  }finally{dom.window.close()}
});

test('proper names, acronyms and accents retain their original spelling',()=>{
  assert.equal(formatSelectDisplayLabel('cabaña'),'Cabaña');
  assert.equal(formatSelectDisplayLabel('  san martín de los andes '),'San martín de los andes');
  assert.equal(formatSelectDisplayLabel('Buenos Aires'),'Buenos Aires');
  assert.equal(formatSelectDisplayLabel('CABANA · Cabaña'),'CABANA · Cabaña');
  assert.equal(formatSelectDisplayLabel('SAP B1'),'SAP B1');
  assert.equal(formatSelectDisplayLabel(''), '');
});
