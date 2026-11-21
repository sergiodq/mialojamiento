import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

let sequence=0;
async function mount(url='https://example.test/nueva_reserva.html',small=true) {
  const html=await readFile(new URL('../nueva_reserva.html',import.meta.url),'utf8');
  const dom=new JSDOM(html,{url,pretendToBeVisual:true});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document});
  let compact=small;
  dom.window.matchMedia=()=>({get matches(){return compact;}});
  const moduleUrl=new URL('../js/reservation-wizard.js',import.meta.url);
  await import(moduleUrl.href+'?case='+sequence++);
  return {dom,setSmall(v){compact=v;dom.window.dispatchEvent(new dom.window.Event('resize'));}};
}

test('mobile new reservation advances through three steps after validating dates and guests',async()=>{
  const {dom}=await mount();
  try {
    const doc=dom.window.document;
    const panels=[...doc.querySelectorAll('[data-reservation-step]')];
    const next=doc.querySelector('#reservationWizardNext');
    const back=doc.querySelector('#reservationWizardBack');
    const submit=doc.querySelector('#reservaForm button[type=submit]');
    assert.equal(panels[0].hidden,false);
    assert.equal(panels[1].hidden,true);
    assert.equal(submit.hidden,true);
    doc.querySelector('#propiedad_id').innerHTML='<option value="pa">Hotel</option>';
    doc.querySelector('#fecha_inicio').value='2026-11-24';
    doc.querySelector('#fecha_fin').value='2026-11-25';
    next.click();
    assert.equal(panels[0].hidden,true);
    assert.equal(panels[1].hidden,false);
    assert.equal(back.hidden,false);
    doc.querySelector('#cliente').value='Huésped de prueba';
    doc.querySelector('[name=usar_unidad_manual]').checked=true;
    doc.querySelector('#unidad_manual').value='Habitación 1';
    next.click();
    assert.equal(panels[2].hidden,false);
    assert.equal(submit.hidden,false);
    assert.equal(next.hidden,true);
    back.click();
    assert.equal(panels[1].hidden,false);
  } finally {dom.window.close();}
});

test('existing booking shows all fields and no wizard navigation',async()=>{
  const {dom}=await mount('https://example.test/nueva_reserva.html?id=123');
  try {
    const doc=dom.window.document;
    assert.equal([...doc.querySelectorAll('[data-reservation-step]')].every(x=>!x.hidden),true);
    assert.equal(doc.querySelector('#reservationWizardNext').hidden,true);
    assert.equal(doc.querySelector('#reservaForm button[type=submit]').hidden,false);
  } finally {dom.window.close();}
});

test('resizing to desktop restores all booking sections',async()=>{
  const {dom,setSmall}=await mount();
  try {
    setSmall(false);
    assert.equal([...dom.window.document.querySelectorAll('[data-reservation-step]')].every(x=>!x.hidden),true);
    assert.equal(dom.window.document.querySelector('#reservationWizardNext').hidden,true);
  } finally {dom.window.close();}
});

test('every visible page loads the new theme after Material 3',async()=>{
  const pages=['login.html','dashboard.html','nueva_reserva.html','propiedades.html','unidades.html','usuarios.html','nuevo_usuario.html'];
  for(const name of pages){
    const html=await readFile(new URL('../'+name,import.meta.url),'utf8');
    assert.ok(html.indexOf('css/material3.css')<html.indexOf('css/ux-vibrante.css'),name);
    assert.match(html,/css\/ux-vibrante\.css/,name);
  }
});
