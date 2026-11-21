import { before, beforeEach, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import * as firestore from 'firebase/firestore';
import { doc, setDoc, updateDoc, getDoc, getDocs, collection, query, where, deleteDoc, writeBatch, setLogLevel } from 'firebase/firestore';

// Permission-denied is expected in negative cases; failed assertions still surface.
setLogLevel('silent');

let env;
const profile = (uid, rol, empresa_id = 'a', extra = {}) => ({
  uid, nombre:uid, email:`${uid}@example.com`, email_normalizado:`${uid}@example.com`,
  rol, empresa_id, propiedad_id:'pa', propiedad_ids:['pa'], activo:true, eliminado:false,
  estado_registro:'activo', ...extra
});
const property = empresa_id => ({empresa_id,nombre:'Hotel',codigo:'H',activo:true});
const reservation = (empresa_id = 'a', propiedad_id = 'pa') => ({
  empresa_id, propiedad_id, cliente:'Cliente', unidad_id:'u1', unidad:'101', unidad_key:'u1',
  fecha_inicio:'2026-11-22',fecha_fin:'2026-11-23',estado:'confirmada',huespedes:1,total:100,
  observaciones:'',capacidad_unidad:2
});
const dbFor = uid => env.authenticatedContext(uid,{email:`${uid}@example.com`}).firestore();
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Ejecutar con npm run test:rules; nunca usar producción.');
  const [host,port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  env = await initializeTestEnvironment({projectId:'demo-mialojamiento',firestore:{host,port:Number(port),rules:await readFile('firestore.rules','utf8')}});
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const p of [profile('root','superadmin',''),profile('admin','admin'),profile('support','soporte',''),profile('desk','recepcion'),profile('inactive','admin','a',{activo:false}),profile('deleted','recepcion','a',{eliminado:true})]) {
      await setDoc(doc(db,'usuarios',p.uid),p);
      await setDoc(doc(db,'usuarios_auth',p.uid),{...p,usuario_id:p.uid});
    }
    await setDoc(doc(db,'propiedades','pa'),property('a'));
    await setDoc(doc(db,'propiedades','pb'),property('b'));
    await setDoc(doc(db,'propiedades','pa','unidades','u1'),{codigo:'101',nombre:'101',capacidad_max:2,capacidad_adultos:2,capacidad_ninos:0,activa:true});
    await setDoc(doc(db,'reservas','ra'),reservation());
    await setDoc(doc(db,'reservas','rb'),reservation('b','pb'));
    await setDoc(doc(db,'reserva_ocupacion','pa__u1__2026-11-22'),{reserva_id:'ra',propiedad_id:'pa',unidad_key:'u1',fecha:'2026-11-22',estado:'confirmada'});
  });
});
after(async () => { await env?.cleanup(); });

test('support can query business data globally but cannot enumerate identity mirrors',async()=>{
  const db=dbFor('support');
  for (const path of ['usuarios','propiedades','reservas']) await assertSucceeds(getDocs(collection(db,path)));
  await assertSucceeds(getDocs(collection(db,'propiedades','pa','unidades')));
  await assertFails(getDocs(collection(db,'usuarios_auth')));
});
test('support edits only allowlisted fields, rejecting mixed and destructive writes',async()=>{
  const db=dbFor('support');
  await assertSucceeds(updateDoc(doc(db,'reservas','rb'),{observaciones:'Revisado'}));
  await assertSucceeds(updateDoc(doc(db,'propiedades','pb'),{telefono:'123',email_contacto:'hotel@example.com',observaciones_internas:'Nota'}));
  for (const patch of [{observaciones:'Nota',total:0},{estado:'cancelada'},{empresa_id:'a'},{fecha_fin:'2026-11-24'},{observaciones:123}]) await assertFails(updateDoc(doc(db,'reservas','rb'),patch));
  await assertFails(updateDoc(doc(db,'usuarios','desk'),{nombre:'Otro'}));
  await assertFails(setDoc(doc(db,'reservas','new'),reservation()));
  await assertFails(deleteDoc(doc(db,'reservas','ra')));
  await assertFails(deleteDoc(doc(db,'reserva_ocupacion','pa__u1__2026-11-22')));
});
test('admin cannot promote any identity or tamper with canonical or mirror global roles',async()=>{
  const db=dbFor('admin');
  for (const rol of ['superadmin','soporte']) {
    await assertFails(updateDoc(doc(db,'usuarios','admin'),{rol}));
    await assertFails(updateDoc(doc(db,'usuarios_auth','admin'),{rol}));
    await assertFails(setDoc(doc(db,'usuarios','new'),profile('new',rol)));
  }
  await assertFails(updateDoc(doc(db,'usuarios','root'),{nombre:'Ataque',empresa_id:'a'}));
  await assertFails(updateDoc(doc(db,'usuarios_auth','root'),{rol:'admin',empresa_id:'a'}));
});
test('admin remains scoped on both existing and resulting company and property',async()=>{
  const db=dbFor('admin');
  await assertSucceeds(getDocs(query(collection(db,'reservas'),where('empresa_id','==','a'))));
  await assertFails(getDocs(collection(db,'reservas')));
  await assertFails(setDoc(doc(db,'propiedades','foreign'),property('b')));
  await assertFails(setDoc(doc(db,'usuarios','foreign'),profile('foreign','admin','b')));
  await assertFails(updateDoc(doc(db,'propiedades','pa'),{empresa_id:'b'}));
  await assertFails(updateDoc(doc(db,'reservas','rb'),{empresa_id:'a',propiedad_id:'pa'}));
  await assertFails(updateDoc(doc(db,'reservas','ra'),{propiedad_id:'pb'}));
  await assertSucceeds(updateDoc(doc(db,'reservas','ra'),{observaciones:'OK'}));
});
test('disabled users cannot access business data even with stale active mirrors',async()=>{
  await env.withSecurityRulesDisabled(async context=>{
    await updateDoc(doc(context.firestore(),'usuarios_auth','inactive'),{activo:true});
    await updateDoc(doc(context.firestore(),'usuarios_auth','deleted'),{eliminado:false});
  });
  for (const uid of ['inactive','deleted']) {
    const db=dbFor(uid);
    await assertFails(getDoc(doc(db,'propiedades','pa')));
    await assertFails(updateDoc(doc(db,'usuarios',uid),{activo:true,eliminado:false}));
    await assertFails(updateDoc(doc(db,'usuarios_auth',uid),{activo:true,eliminado:false}));
  }
});
test('self repair cannot expand assigned properties, bind another UID or change identity email',async()=>{
  const db=dbFor('desk');
  await assertFails(updateDoc(doc(db,'usuarios','desk'),{propiedad_ids:['pa','pb']}));
  await assertFails(updateDoc(doc(db,'usuarios_auth','desk'),{propiedad_ids:['pa','pb']}));
  await assertFails(updateDoc(doc(db,'usuarios','desk'),{uid:'other'}));
  await assertFails(updateDoc(doc(db,'usuarios','desk'),{email_normalizado:'other@example.com'}));
  await assertSucceeds(updateDoc(doc(db,'usuarios','desk'),{estado_registro:'activo'}));
});
test('superadmin has global functional control but active superadmins cannot be demoted or disabled',async()=>{
  const db=dbFor('root');
  await assertSucceeds(getDocs(collection(db,'usuarios')));
  await assertSucceeds(setDoc(doc(db,'usuarios','new'),profile('new','soporte','')));
  await assertSucceeds(setDoc(doc(db,'reservas','new'),reservation('b','pb')));
  await assertFails(updateDoc(doc(db,'usuarios','root'),{rol:'admin'}));
  await assertFails(updateDoc(doc(db,'usuarios','root'),{activo:false}));
  await assertFails(updateDoc(doc(db,'usuarios','root'),{uid:'replacement'}));
});
test('business records are never physically deleted, including units and by superadmin',async()=>{
  const db=dbFor('root');
  for (const path of [['usuarios','desk'],['propiedades','pa'],['propiedades','pa','unidades','u1'],['reservas','ra']]) await assertFails(deleteDoc(doc(db,...path)));
  await assertSucceeds(updateDoc(doc(db,'propiedades','pa','unidades','u1'),{activa:false}));
});
test('occupancy locks cannot be deleted or stolen while reservation stays active',async()=>{
  const db=dbFor('desk');
  await assertFails(deleteDoc(doc(db,'reserva_ocupacion','pa__u1__2026-11-22')));
  await assertFails(updateDoc(doc(db,'reserva_ocupacion','pa__u1__2026-11-22'),{reserva_id:'rb'}));
  const batch=writeBatch(db);
  batch.update(doc(db,'reservas','ra'),{estado:'cancelada'});
  batch.delete(doc(db,'reserva_ocupacion','pa__u1__2026-11-22'));
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(db,'reservas','ra')));
});
test('invited user can bind own UID and create matching identity docs without changing scope',async()=>{
  const pending=profile('invite','recepcion','a',{uid:'',estado_registro:'pendiente_auth'});
  await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'usuarios','invited'),pending));
  const db=dbFor('invite');
  await assertSucceeds(getDoc(doc(db,'usuarios','invited')));
  await assertSucceeds(updateDoc(doc(db,'usuarios','invited'),{uid:'invite',estado_registro:'activo',email_normalizado:'invite@example.com'}));
  const data={...pending,uid:'invite',estado_registro:'activo',usuario_id:'invited'};
  await assertSucceeds(setDoc(doc(db,'usuarios_auth','invite'),data));
  await assertFails(setDoc(doc(db,'usuarios_auth','invite'),{...data,rol:'superadmin'}));
});

test('admin can create and edit local users and synchronize matching identity documents',async()=>{
  const db=dbFor('admin');
  const p=profile('newdesk','recepcion');
  await assertSucceeds(setDoc(doc(db,'usuarios','newdesk'),p));
  await assertSucceeds(updateDoc(doc(db,'usuarios','desk'),{nombre:'Recepción actualizada'}));
  await assertSucceeds(setDoc(doc(db,'usuarios_auth','newdesk'),{...p,usuario_id:'newdesk'}));
  await assertSucceeds(setDoc(doc(db,'email_index',p.email),{...p,usuario_id:'newdesk'}));
  await assertSucceeds(updateDoc(doc(db,'usuarios','newdesk'),{activo:false,eliminado:true}));
  await assertSucceeds(updateDoc(doc(db,'usuarios_auth','newdesk'),{activo:false,eliminado:true}));
});
test('reception queries reservations within both its company and assigned property',async()=>{
  const db=dbFor('desk');
  await assertSucceeds(getDocs(query(collection(db,'reservas'),where('propiedad_id','==','pa'),where('empresa_id','==','a'))));
  await assertFails(getDoc(doc(db,'reservas','rb')));
});

async function realHelpers(db, uid) {
  globalThis.__rulesSdk = {...firestore,db,auth:{currentUser:{uid}},authReady:Promise.resolve(),onAuthStateChanged:()=>{},signOut:async()=>{}};
  const sdk = 'export const {' + ['auth','authReady','db','collection','doc','getDoc','getDocs','setDoc','addDoc','updateDoc','deleteDoc','query','where','orderBy','limit','serverTimestamp','writeBatch','runTransaction','onAuthStateChanged','signOut'].join(',') + '}=globalThis.__rulesSdk;';
  const uri = s => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
  const source = (await readFile('js/app-helpers.js','utf8')).replace("'./firebase-config.js'",JSON.stringify(uri(sdk+`\n// ${uid}`)));
  return import(uri(source));
}
test('real reservation helpers create, reschedule and cancel atomically without deleting history',async()=>{
  const db=dbFor('desk');
  const helpers=await realHelpers(db,'desk');
  const id=await helpers.saveReservationWithLocks({...reservation(),fecha_inicio:'2026-11-24',fecha_fin:'2026-11-25'});
  await assertSucceeds(getDoc(doc(db,'reserva_ocupacion','pa__u1__2026-11-24')));
  await helpers.saveReservationWithLocks({...reservation(),fecha_inicio:'2026-11-25',fecha_fin:'2026-11-26'},id);
  await helpers.deleteReservationWithLocks(id);
  const saved=await getDoc(doc(db,'reservas',id));
  if(!saved.exists() || saved.data().estado !== 'cancelada') throw new Error('La cancelación debe conservar el documento.');
});
test('real discovery and repair preserve legacy property assignment without requiring an index',async()=>{
  const pending=profile('legacy','recepcion');
  delete pending.uid;
  delete pending.propiedad_ids;
  delete pending.email_normalizado;
  delete pending.eliminado;
  pending.estado_registro='pendiente_auth';
  await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'usuarios','legacy-id'),pending));
  const db=dbFor('legacy');
  const helpers=await realHelpers(db,'legacy');
  const candidate=await helpers.findUserCandidateByEmail('legacy@example.com');
  if(candidate?.id !== 'legacy-id') throw new Error('El invitado debe descubrir su perfil sin conocer el ID.');
  const resolved=await helpers.resolveProfileFromAuthenticatedUser({uid:'legacy',email:'legacy@example.com'});
  if(resolved?.id !== 'legacy-id') throw new Error('El invitado legacy debe activar su perfil.');
  const p=(await getDoc(doc(db,'usuarios','legacy-id'))).data();
  if(p.uid !== 'legacy' || p.propiedad_id !== 'pa' || p.propiedad_ids !== undefined) throw new Error('La reparación no debe reescribir asignaciones.');
  await assertSucceeds(getDoc(doc(db,'propiedades','pa')));
});
test('existing UID and email mappings cannot be redirected to another canonical profile',async()=>{
  const db=dbFor('admin');
  const duplicate=profile('desk','admin');
  await assertSucceeds(setDoc(doc(db,'usuarios','duplicate'),duplicate));
  await assertFails(setDoc(doc(db,'usuarios_auth','desk'),{...duplicate,usuario_id:'duplicate'}));
});
test('twenty property assignments can be administered without exceeding rule evaluation limits',async()=>{
  const db=dbFor('admin');
  const propiedad_ids=['pa',...Array.from({length:19},(_,i)=>`p${i}`)];
  await assertSucceeds(updateDoc(doc(db,'usuarios','desk'),{propiedad_ids}));
  await assertSucceeds(updateDoc(doc(db,'usuarios_auth','desk'),{propiedad_ids}));
});
test('invited superadmin can activate its preassigned role without creating another account',async()=>{
  await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'usuarios','invited-root'),profile('newroot','superadmin','',{uid:'',estado_registro:'pendiente_auth'})));
  const db=dbFor('newroot');
  await assertSucceeds(updateDoc(doc(db,'usuarios','invited-root'),{uid:'newroot',estado_registro:'activo'}));
});
