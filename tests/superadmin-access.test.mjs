import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

// Replace only the remote Firebase SDK boundary. Exercise the actual exported
// permission functions and form payload builder without network or live writes.
const sdk = 'export const auth={},authReady=Promise.resolve(),db={}; export const collection=()=>{},doc=()=>{},getDoc=()=>{},getDocs=()=>{},setDoc=()=>{},addDoc=()=>{},updateDoc=()=>{},deleteDoc=()=>{},query=()=>{},where=()=>{},orderBy=()=>{},limit=()=>{},serverTimestamp=()=>null,writeBatch=()=>{},runTransaction=()=>{},onAuthStateChanged=()=>{},signOut=()=>{};';
const source = (await readFile(new URL('../js/app-helpers.js', import.meta.url),'utf8'))
  .replace("'./firebase-config.js'", JSON.stringify(`data:text/javascript;base64,${Buffer.from(sdk).toString('base64')}`));
const helpers = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const owner = {id:'owner',uid:'owner-uid',rol:'superadmin',empresa_id:'a'};
const admin = {id:'admin',uid:'admin-uid',rol:'admin',empresa_id:'a'};
const reception = {id:'reception',uid:'reception-uid',rol:'recepcion',empresa_id:'a',propiedad_ids:['pa']};

test('superadmin can open property and unit management and sees its navigation link',()=>{
  assert.equal(helpers.canManageProperties(owner),true);
  assert.ok(helpers.getNavItems(owner).some(x=>x.href==='propiedades.html'));
  assert.equal(helpers.canAccessProperty(owner,{id:'pb',empresa_id:'b'}),true);
});
test('admin remains confined to own company',()=>{
  assert.equal(helpers.canManageProperties(admin),true);
  assert.equal(helpers.canAccessProperty(admin,{id:'pa',empresa_id:'a'}),true);
  assert.equal(helpers.canAccessProperty(admin,{id:'pb',empresa_id:'b'}),false);
});
test('reception cannot manage inventory and only accesses assigned property',()=>{
  assert.equal(helpers.canManageProperties(reception),false);
  assert.equal(helpers.canAccessProperty(reception,{id:'pa',empresa_id:'a'}),true);
  assert.equal(helpers.canAccessProperty(reception,{id:'pa2',empresa_id:'a'}),false);
});

function build(actor,target,role){
  const dom=new JSDOM('<form><input name="nombre" value="Test"><input name="email" value="test@example.com"><input name="rol"><input name="empresa_id" value="a"><select name="propiedad_ids" multiple></select></form>');
  const form=dom.window.document.querySelector('form');
  form.querySelector('[name=rol]').value=role;
  try {return helpers.buildUserPayloadFromForm(form,actor,target);} finally {dom.window.close();}
}
test('superadmin cannot demote its own profile',()=>{
  assert.throws(()=>build(owner,owner,'admin'),/propio rol/i);
  assert.throws(()=>build(owner,{...owner,id:'legacy',uid:owner.uid},'recepcion'),/propio rol/i);
});
test('superadmin can edit itself without changing role',()=>{
  assert.equal(build(owner,owner,'superadmin').rol,'superadmin');
});
test('superadmin can adjust another user role',()=>{
  assert.equal(build(owner,admin,'recepcion').rol,'recepcion');
});
test('admin cannot promote itself or another user to superadmin',()=>{
  assert.throws(()=>build(admin,admin,'superadmin'),/superadmin/i);
  assert.throws(()=>build(admin,null,'superadmin'),/superadmin/i);
});
test('admin cannot edit superadmin or another company profile',()=>{
  assert.throws(()=>build(admin,owner,'admin'),/permisos/i);
  assert.throws(()=>build(admin,{...reception,empresa_id:'b'},'recepcion'),/permisos/i);
});
