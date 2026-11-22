import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {initMaterialSelects} from '../js/material-selects.js';
import {initMaterialDateTime} from '../js/material-datetime.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const pages=['login.html','dashboard.html','nueva_reserva.html','propiedades.html','unidades.html','usuarios.html','nuevo_usuario.html'];

test('all pages load final iPhone responsive fixes after previous style layers',async()=>{
  for(const page of pages) {
    const html=await read(page);
    const doc=new JSDOM(html).window.document;
    const styles=[...doc.querySelectorAll('link[rel="stylesheet"]')].map(el=>el.getAttribute('href'));
    assert.equal(styles.at(-1),'css/mobile-audit.css',page);
    assert.ok(doc.querySelector('meta[name="viewport"]'),page);
  }
  const css=await read('css/mobile-audit.css');
  assert.match(css,/@media \(max-width:839px\)/);
  assert.match(css,/@media \(max-width:360px\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/\.mobile-reservation-open/);
  assert.match(css,/\.m3-bottom-nav/);
  assert.match(css,/\.m3-select-panel/);
  assert.match(css,/\.m3-datetime-sheet/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});

test('mobile wizard does not jump to hidden native select when selecting accommodation',async()=>{
  const dom=new JSDOM(await read('nueva_reserva.html'),{
    url:'https://example.test/nueva_reserva.html',pretendToBeVisual:true,runScripts:'outside-only'
  });
  try {
    const {document:doc}=dom.window;
    dom.window.matchMedia=()=>({matches:true,addEventListener(){}});
    dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
    initMaterialSelects(doc);
    initMaterialDateTime(doc);
    dom.window.eval(await read('js/reservation-wizard.js'));
    assert.equal(doc.querySelector('[data-reservation-step="1"]').hidden,true);
    const next=doc.querySelector('#reservationWizardNext');
    next.click();
    assert.equal(doc.querySelector('[data-reservation-step="1"]').hidden,true);
    const trigger=doc.querySelector('#propiedad_id + .m3-select-field .m3-select-trigger');
    assert.ok(trigger);
    assert.equal(doc.activeElement,trigger);
    assert.equal(trigger.getAttribute('aria-invalid'),'true');
    const select=doc.querySelector('#propiedad_id');
    select.appendChild(new dom.window.Option('Cabaña','prop-1'));
    select.value='prop-1';
    select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
    assert.equal(trigger.hasAttribute('aria-invalid'),false);
    // Unas fechas válidas permiten pasar al siguiente paso.
    const today=new Date();
    const iso=(y,m,d)=>[y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
    const start=iso(today.getFullYear(),today.getMonth()+1,today.getDate());
    const endDate=new Date(today.getFullYear(),today.getMonth(),today.getDate()+1);
    const end=iso(endDate.getFullYear(),endDate.getMonth()+1,endDate.getDate());
    for(const [name,val] of [['fecha_inicio',start],['fecha_fin',end]]){
      const input=doc.querySelector('[name="'+name+'"]');
      input.value=val;input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
    }
    next.click();
    assert.equal(doc.querySelector('[data-reservation-step="1"]').hidden,false);
    assert.equal(doc.querySelector('[data-reservation-step="0"]').hidden,true);
    assert.equal(doc.querySelector('#reservationWizardBack').hidden,false);
  } finally {dom.window.close()}
});

test('mobile validation of missing date focuses Material date trigger',async()=>{
  const dom=new JSDOM(await read('nueva_reserva.html'),{
    url:'https://example.test/nueva_reserva.html',pretendToBeVisual:true,runScripts:'outside-only'
  });
  try {
    const doc=dom.window.document;
    dom.window.matchMedia=()=>({matches:true,addEventListener(){}});
    dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
    initMaterialSelects(doc);initMaterialDateTime(doc);
    const select=doc.querySelector('#propiedad_id');
    select.appendChild(new dom.window.Option('Cabaña','prop-1'));select.value='prop-1';
    dom.window.eval(await read('js/reservation-wizard.js'));
    doc.querySelector('#reservationWizardNext').click();
    const trigger=doc.querySelector('#fecha_inicio + .m3-datetime-field .m3-datetime-trigger');
    assert.equal(doc.activeElement,trigger);
    assert.equal(trigger.getAttribute('aria-invalid'),'true');
    assert.equal(doc.querySelector('[data-reservation-step="1"]').hidden,true);
  }finally{dom.window.close()}
});
