import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../js/app-helpers.js',import.meta.url),'utf8');
const firebaseStub='data:text/javascript;base64,'+Buffer.from([
'export const auth={currentUser:null},authReady=Promise.resolve(),db={};',
'export const collection=()=>{},doc=()=>{},getDoc=()=>{},getDocs=()=>{},',
'export const setDoc=()=>{},addDoc=()=>{},updateDoc=()=>{},deleteDoc=()=>{},',
'export const query=()=>{},where=()=>{},orderBy=()=>{},limit=()=>{},',
'export const serverTimestamp=()=>{},writeBatch=()=>{},runTransaction=()=>{},',
'export const onAuthStateChanged=()=>{},signOut=()=>{};'
].join('')).toString('base64');
const helpers=await import('data:text/javascript;base64,'+Buffer.from(code.replace("'./firebase-config.js'",JSON.stringify(firebaseStub))).toString('base64'));
const {validateReservationData}=helpers;
const today='2026-11-21';
const base={cliente:'Huésped',propiedad_id:'hotel1',unidad_key:'u1',fecha_inicio:'2026-11-24',fecha_fin:'2026-11-25',estado:'confirmada',huespedes:2,capacidad_unidad:3,total:50000};
const validate=(changes={},opts={})=>validateReservationData({...base,...changes},{dateToday:today,...opts});

test('nuevas reservas: no se permite ingreso anterior a hoy',()=>{
 assert.throws(()=>validate({fecha_inicio:'2026-11-20',fecha_fin:'2026-11-23'}),/anterior a hoy/);
 assert.doesNotThrow(()=>validate({fecha_inicio:today,fecha_fin:'2026-11-22'}));
});
test('reservas antiguas: se puede editar sin modificar las fechas históricas',()=>{
 const historical={fecha_inicio:'2026-10-01',fecha_fin:'2026-10-04'};
 assert.doesNotThrow(()=>validate(historical,{existingReservation:historical}));
 assert.throws(()=>validate({...historical,fecha_fin:'2026-10-05'},{existingReservation:historical}),/anterior a hoy/);
});
test('el check-out debe ser posterior, y las fechas deben existir en el calendario',()=>{
 assert.throws(()=>validate({fecha_fin:base.fecha_inicio}),/posterior/);
 assert.throws(()=>validate({fecha_inicio:'2026-02-30',fecha_fin:'2026-03-02'}),/fechas reales/);
 assert.throws(()=>validate({fecha_inicio:'2026-11-31',fecha_fin:'2026-12-04'}),/fechas reales/);
});
test('no se aceptan huéspedes fraccionarios, negativos ni ocupación superior al máximo',()=>{
 for(const num of [-1,0,1.5])assert.throws(()=>validate({huespedes:num}),/entera/);
 assert.throws(()=>validate({huespedes:4}),/supera/);
 assert.doesNotThrow(()=>validate({huespedes:3}));
});
test('rechaza importes inválidos, estados desconocidos y nuevas reservas canceladas',()=>{
 assert.throws(()=>validate({total:-1}),/negativo/);
 assert.throws(()=>validate({estado:'ficticia'}),/estado/);
 assert.throws(()=>validate({estado:'cancelada'}),/cancelada/);
 assert.doesNotThrow(()=>validate({estado:'cancelada'},{existingReservation:base}));
});
test('los formularios acotan las fechas mediante el mínimo y revisan inventario activo',async()=>{
 const source=await readFile(new URL('../js/nueva-reserva.js',import.meta.url),'utf8');
 assert.match(source,/arrival\.min = todayISO\(\)/);
 assert.match(source,/departure\.min = addDaysISO/);
 assert.match(source,/selectedProperty\.activo === false/);
 assert.match(source,/selectedUnit\.activa === false/);
});
test('las capacidades de habitaciones se validan como enteros positivos y no negativos',async()=>{
 const source=await readFile(new URL('../js/unidades.js',import.meta.url),'utf8');
 assert.match(source,/Number\.isInteger/);
 assert.match(source,/payload\.capacidad_adultos < 0/);
});
