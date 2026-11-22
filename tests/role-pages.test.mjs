import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
Error.stackTraceLimit = 0;

const uri = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const support = {id:'support',uid:'support',nombre:'<img src=x onerror=alert(1)>Soporte',email:'support@example.com',email_normalizado:'support@example.com',rol:'soporte',empresa_id:'',propiedad_ids:[],activo:true,eliminado:false,estado_registro:'activo'};
const property = {id:'pa',nombre:'<img src=x onerror=alert(1)>Hotel',codigo:'H',empresa_id:'a',activo:true};
const unit = {id:'u1',nombre:'<img src=x onerror=alert(1)>101',codigo:'101',capacidad_max:2,activa:true};
const isoLocal = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const today = new Date();
const nextDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()+1);
const reservation = {id:'ra',cliente:'Cliente',propiedad_id:'pa',empresa_id:'a',fecha_inicio:isoLocal(today),fecha_fin:isoLocal(nextDay),unidad_id:'u1',estado:'confirmada',huespedes:1,total:100,observaciones:'Nota'};

let pageCounter = 0;
async function openPage(htmlName, scriptName, search='', actor=support, {inactive=false,mobile=false}={}) {
  const dom = new JSDOM(await readFile(new URL(`../${htmlName}`,import.meta.url),'utf8'),{url:`https://example.test/${htmlName}${search}`});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,sessionStorage:dom.window.sessionStorage});
  dom.window.scrollTo=()=>{};
  dom.window.matchMedia=()=>({matches:mobile,addEventListener(){}});
  const pageProperty = {...property,activo:!inactive};
  const pageUnit = {...unit,activa:!inactive};
  globalThis.__rolePage={actor,writes:[],get(path){
    if(path===`usuarios_auth/${actor.uid}`) return {...actor,usuario_id:actor.id};
    if(path===`email_index/${actor.email}`) return {...actor,usuario_id:actor.id};
    if(path===`usuarios/${actor.id}`) return actor;
    return {'propiedades/pa':pageProperty,'propiedades/pa/unidades/u1':pageUnit,'reservas/ra':reservation}[path];
  },list(path){
    return {'usuarios':[support],propiedades:[pageProperty],reservas:[reservation],'propiedades/pa/unidades':[pageUnit]}[path] || [];
  }};
  const sdk=uri(`
    // Unique module boundary per page avoids sharing captured state between sessions: ${pageCounter++}
    export const auth={currentUser:{uid:globalThis.__rolePage.actor.uid,email:globalThis.__rolePage.actor.email}},authReady=Promise.resolve(),db={};
    export const collection=(_, ...parts)=>parts.join('/'),doc=collection,query=(p)=>p,where=()=>{},orderBy=()=>{},limit=()=>{};
    export const getDoc=async p=>({id:p.split('/').at(-1),exists:()=>!!globalThis.__rolePage.get(p),data:()=>globalThis.__rolePage.get(p)});
    export const getDocs=async p=>({docs:globalThis.__rolePage.list(p).map(d=>({id:d.id,data:()=>d}))});
    export const updateDoc=async (p,data)=>globalThis.__rolePage.writes.push({path:p,data});
    export const setDoc=()=>{},addDoc=()=>{},deleteDoc=()=>{},serverTimestamp=()=>null,writeBatch=()=>({set(){},delete(){},commit:async()=>{}}),runTransaction=()=>{},onAuthStateChanged=()=>{},signOut=async()=>{};
  `);
  const helpers=uri((await readFile(new URL('../js/app-helpers.js',import.meta.url),'utf8')).replace("'./firebase-config.js'",JSON.stringify(sdk)));
  const source=(await readFile(new URL(`../js/${scriptName}`,import.meta.url),'utf8'))
    .replace("'./firebase-config.js'",JSON.stringify(sdk))
    .replace("'./app-helpers.js'",JSON.stringify(helpers))
    .replace("'./auth.js'",JSON.stringify(uri('export const logoutUser=()=>{};')));
  await import(uri(source));
  await new Promise(resolve=>setTimeout(resolve,40));
  return dom;
}
test('support can consult users without any account management actions',async()=>{
  const dom=await openPage('usuarios.html','usuarios.js');
  try {
    assert.match(document.querySelector('#usuariosBody').textContent,/Soporte/);
    assert.equal(document.querySelector('#usuariosBody img'),null);
    assert.equal(document.querySelector('a[href="nuevo_usuario.html"]'),null);
    assert.equal(document.querySelector('#usuariosBody a,#usuariosBody button'),null);
  } finally {dom.window.close();}
});
test('support can edit only contact and notes on an existing property',async()=>{
  const dom=await openPage('propiedades.html','propiedades.js');
  try {
    assert.match(document.querySelector('#propiedadesBody').textContent,/Hotel/);
    assert.equal(document.querySelector('#propiedadesBody img'),null);
    assert.equal(document.querySelector('#propiedadForm button[type=submit]').disabled,true);
    document.querySelector('.btnEditProperty').click();
    await new Promise(resolve=>setTimeout(resolve,10));
    const form=document.querySelector('#propiedadForm');
    assert.equal(form.querySelector('[name=nombre]').disabled,true);
    assert.equal(form.querySelector('[name=telefono]').disabled,false);
    form.querySelector('[name=telefono]').value='456';
    form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
    await new Promise(resolve=>setTimeout(resolve,10));
    assert.deepEqual(globalThis.__rolePage.writes,[{path:'propiedades/pa',data:{telefono:'456',email_contacto:'',observaciones_internas:'',updated_at:null,actualizado_por:'support'}}]);
  } finally {dom.window.close();}
});
test('support can consult units but cannot create, edit or deactivate them',async()=>{
  const dom=await openPage('unidades.html','unidades.js','?propiedad=pa');
  try {
    assert.match(document.querySelector('#unidadesBody').textContent,/101/);
    assert.equal(document.querySelector('#unidadesBody img'),null);
    assert.equal(document.querySelector('.btnEditUnit,.btnDeleteUnit'),null);
    assert.equal(document.querySelector('#unidadForm').hidden,true);
  } finally {dom.window.close();}
});
test('support edits reservation notes without submitting operational fields or touching locks',async()=>{
  const dom=await openPage('nueva_reserva.html','nueva-reserva.js','?id=ra');
  try {
    const form=document.querySelector('#reservaForm');
    assert.equal(form.querySelector('[name=cliente]').disabled,true);
    assert.equal(form.querySelector('[name=observaciones]').disabled,false);
    form.querySelector('[name=observaciones]').value='Revisado';
    form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
    await new Promise(resolve=>setTimeout(resolve,10));
    assert.deepEqual(globalThis.__rolePage.writes,[{path:'reservas/ra',data:{observaciones:'Revisado',updated_at:null,actualizado_por:'support'}}]);
  } finally {dom.window.close();}
});
test('support dashboard offers consultation without creation or cancellation actions',async()=>{
  const dom=await openPage('dashboard.html','dashboard.js');
  try {
    assert.equal(document.querySelector('#regularDashboardSection').hidden,false);
    assert.equal(document.querySelector('#quickNuevaReserva').hidden,true);
    assert.equal(document.querySelector('.btnDeleteReservation'),null);
    assert.match(document.querySelector('#planningBoard').textContent,/Cliente/);
  } finally {dom.window.close();}
});
test('superadmin dashboard includes the planner and reservation creation',async()=>{
  const dom=await openPage('dashboard.html','dashboard.js','',{...support,rol:'superadmin'});
  try {
    assert.equal(document.querySelector('#regularDashboardSection').hidden,false);
    assert.equal(document.querySelector('#quickNuevaReserva').hidden,false);
    assert.match(document.querySelector('#planningBoard').textContent,/Cliente/);
    assert.ok(document.querySelector('.btnDeleteReservation'));
  } finally {dom.window.close();}
});
test('global support consultation includes reservations from inactive inventory',async()=>{
  const dom=await openPage('dashboard.html','dashboard.js','',support,{inactive:true});
  try {
    assert.match(document.querySelector('#planningBoard').textContent,/Cliente/);
  } finally {dom.window.close();}
});


test('property management starts with list and opens creation or selected editing explicitly',async()=>{
  const dom=await openPage('propiedades.html','propiedades.js','',{...support,rol:'superadmin'});
  try{
    const doc=dom.window.document;
    assert.equal(doc.querySelector('#propertyEditor').hidden,true);
    assert.equal(doc.querySelector('#propertyList').hidden,false);
    doc.querySelector('#btnNuevaPropiedad').click();
    assert.equal(doc.querySelector('#propertyEditor').hidden,false);
    assert.equal(doc.querySelector('#propertyList').hidden,true);
    assert.match(doc.querySelector('#propertyFormTitle').textContent,/Nuevo alojamiento/);
    doc.querySelector('#btnCancelarEdicionPropiedad').click();
    assert.equal(doc.querySelector('#propertyEditor').hidden,true);
    doc.querySelector('.btnEditProperty').click();
    await new Promise(resolve=>setTimeout(resolve,15));
    assert.match(doc.querySelector('#propertyFormTitle').textContent,/Editar alojamiento/);
    assert.match(doc.querySelector('#propertyEditorContext').textContent,/Hotel/);
  }finally{dom.window.close();}
});

test('deactivating a property only changes active state, and can be reverted',async()=>{
  const dom=await openPage('propiedades.html','propiedades.js','',{...support,rol:'superadmin'});
  try{
    dom.window.confirm=()=>true;
    document.querySelector('.btnPropertyState').click();
    await new Promise(resolve=>setTimeout(resolve,25));
    assert.equal(globalThis.__rolePage.writes.length,1);
    assert.equal(globalThis.__rolePage.writes[0].path,'propiedades/pa');
    assert.equal(globalThis.__rolePage.writes[0].data.activo,false);
  }finally{dom.window.close();}
});

test('unit management opens the form only when requested and labels deactivation clearly',async()=>{
  const dom=await openPage('unidades.html','unidades.js','?propiedad=pa',{...support,rol:'superadmin'});
  try{
    const doc=dom.window.document;
    assert.equal(doc.querySelector('#unitEditor').hidden,true);
    assert.equal(doc.querySelector('#unitList').hidden,false);
    assert.match(doc.querySelector('#unitPropertyContext').textContent,/Hotel/);
    assert.match(doc.querySelector('.btnDeleteUnit').textContent,/Desactivar/);
    doc.querySelector('#btnNuevaUnidad').click();
    assert.equal(doc.querySelector('#unitEditor').hidden,false);
    assert.match(doc.querySelector('#unitFormTitle').textContent,/Nueva habitación/);
    doc.querySelector('#btnCancelarEdicionUnidad').click();
    assert.equal(doc.querySelector('#unitEditor').hidden,true);
    doc.querySelector('.btnEditUnit').click();
    await new Promise(resolve=>setTimeout(resolve,10));
    assert.match(doc.querySelector('#unitFormTitle').textContent,/Editar habitación/);
  }finally{dom.window.close();}
});

test('support cannot create, deactivate or reactivate properties or units',async()=>{
  const p=await openPage('propiedades.html','propiedades.js');
  try{
    assert.equal(document.querySelector('#btnNuevaPropiedad').hidden,true);
    assert.equal(document.querySelector('.btnPropertyState'),null);
  }finally{p.window.close();}
  const u=await openPage('unidades.html','unidades.js','?propiedad=pa');
  try{
    assert.equal(document.querySelector('#btnNuevaUnidad').hidden,true);
    assert.equal(document.querySelector('.btnDeleteUnit,.btnReactivateUnit'),null);
  }finally{u.window.close();}
});

test('one-day calendar reservations open readable details and close with Escape',async()=>{
  const dom=await openPage('dashboard.html','dashboard.js','',{...support,rol:'superadmin'});
  try{
    const doc=dom.window.document;
    const open=doc.querySelector('.planning-booking-open');
    assert.ok(open,'missing reservation detail button');
    assert.equal(open.textContent.includes('Cliente'),true);
    assert.equal(doc.querySelector('.planning-reservation-meta-grid'),null,'full details should not overflow the calendar cell');
    open.click();
    const modal=doc.querySelector('#plannerReservationDetail');
    assert.equal(modal.hidden,false);
    assert.match(modal.textContent,/Cliente/);
    assert.match(modal.textContent,/Check-in/);
    assert.match(modal.textContent,/Check-out/);
    assert.ok(modal.querySelector('[data-cancel-detail-reservation]'));
    doc.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert.equal(modal.hidden,true);
    assert.equal(doc.activeElement,open);
  }finally{dom.window.close()}
});
test('support reservation detail is read-only and does not expose cancellation',async()=>{
  const dom=await openPage('dashboard.html','dashboard.js');
  try{
    const doc=dom.window.document;
    doc.querySelector('.planning-booking-open').click();
    const modal=doc.querySelector('#plannerReservationDetail');
    assert.equal(modal.hidden,false);
    assert.equal(modal.querySelector('[data-cancel-detail-reservation]'),null);
    assert.equal(modal.querySelector('a[href="nueva_reserva.html?id=ra"]').textContent,'Ver / notas');
    assert.equal(modal.querySelector('img'),null);
    modal.querySelector('[data-close-reservation-detail]').click();
    assert.equal(modal.hidden,true);
  }finally{dom.window.close()}
});

test('iPhone-sized dashboard shows one property and tappable reservation details',async()=>{
  const dom=await openPage('dashboard.html','dashboard.js','',{...support,rol:'superadmin'},{mobile:true});
  try{
    const doc=dom.window.document;
    assert.ok(doc.querySelector('.mobile-planner-stack'));
    assert.equal(doc.querySelectorAll('.mobile-property-card').length,1);
    assert.equal(doc.querySelector('.planning-board-table'),null);
    const action=doc.querySelector('.mobile-reservation-open[data-reservation-detail="ra"]');
    assert.ok(action,'reservation should be a tappable detail button on phones');
    assert.equal(action.getAttribute('aria-label').includes('Cliente'),true);
    action.click();
    assert.equal(doc.querySelector('#plannerReservationDetail').hidden,false);
    assert.match(doc.querySelector('#plannerReservationDetail').textContent,/Check-in/);
    doc.querySelector('.planner-reservation-detail-close').click();
    assert.equal(doc.querySelector('#plannerReservationDetail').hidden,true);
  }finally{dom.window.close()}
});
test('mobile support keeps reservation consultation without cancellation',async()=>{
  const dom=await openPage('dashboard.html','dashboard.js','',support,{mobile:true});
  try{
    const doc=dom.window.document;
    const action=doc.querySelector('.mobile-reservation-open');
    assert.ok(action);
    action.click();
    assert.equal(doc.querySelector('#plannerReservationDetail').hidden,false);
    assert.equal(doc.querySelector('#plannerReservationDetail [data-cancel-detail-reservation]'),null);
    assert.equal(doc.querySelector('#plannerReservationDetail a[href="nueva_reserva.html?id=ra"]').textContent,'Ver / notas');
  }finally{dom.window.close()}
});
