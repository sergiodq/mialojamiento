import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initMaterial3UI } from '../js/material3-ui.js';

const sidebar = (reserve=true) => `<aside id="sidebar"><div class="nav-group">
  <a class="nav-link" href="dashboard.html"><span class="nav-icon">⌂</span><span>Dashboard</span></a>
  <a class="nav-link" href="usuarios.html"><span class="nav-icon">U</span><span>Usuarios</span></a>
  <a class="nav-link" href="propiedades.html"><span class="nav-icon">P</span><span>Propiedades</span></a>
  ${reserve?'<a class="nav-link" href="nueva_reserva.html"><span class="nav-icon">R</span><span>Nueva reserva</span></a>':''}
  </div><div class="sidebar-user">Usuario de prueba</div><button id="btnLogoutSidebar">Salir</button></aside>`;
const settle=()=>new Promise(resolve=>setTimeout(resolve,25));
async function setup() {
  const dom=new JSDOM(`<!doctype html><html><head></head><body>${sidebar()}<main><button id="contentAction">Acción</button></main></body></html>`,{url:'https://example.test/dashboard.html',pretendToBeVisual:true});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,MutationObserver:dom.window.MutationObserver});
  Object.defineProperty(dom.window,'innerWidth',{value:390,writable:true});
  dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  initMaterial3UI();
  await settle();
  return dom;
}
function cleanup(dom){dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.MutationObserver;}

test('adaptive navigation derives authorized destinations from actual sidebar markup with icons',async()=>{
  const dom=await setup();
  try{
    assert.deepEqual([...document.querySelectorAll('.m3-bottom-nav a')].map(a=>a.textContent.trim()),['Usuarios','Inicio','Reservas','Propiedades']);
    assert.equal(document.querySelector('.m3-fab')?.getAttribute('href'),'nueva_reserva.html');
    assert.equal(document.querySelector('.m3-bottom-nav button'),null);
    assert.equal(document.querySelector('.m3-drawer-link'),null);
    assert.ok(document.querySelector('.m3-account-button'));
    assert.equal(document.querySelector('.nav-icon svg')?.getAttribute('aria-hidden'),'true');
  }finally{cleanup(dom);}
});
test('drawer contains keyboard focus and restores it on Escape',async()=>{
  const dom=await setup();
  try{
    const more=document.querySelector('.m3-account-button');
    more.focus();more.click();
    const drawer=document.querySelector('.m3-drawer');
    assert.equal(drawer.getAttribute('role'),'dialog');
    assert.equal(more.getAttribute('aria-expanded'),'true');
    assert.equal(document.activeElement,drawer.querySelector('[data-m3-close]'));
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
    assert.equal(document.activeElement,drawer.querySelector('.m3-drawer-logout'));
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert.equal(more.getAttribute('aria-expanded'),'false');
    assert.equal(document.activeElement,more);
    assert.equal(drawer.getAttribute('aria-hidden'),'true');
  }finally{cleanup(dom);}
});
test('updated authorized sidebar removes stale creation actions without duplicate navigation',async()=>{
  const dom=await setup();
  try{
    document.querySelector('#sidebar').outerHTML=sidebar(false);
    await settle();
    assert.equal(document.querySelectorAll('.m3-bottom-nav').length,1);
    assert.equal(document.querySelector('.m3-fab'),null);
    assert.deepEqual([...document.querySelectorAll('.m3-bottom-nav a')].map(a=>a.textContent.trim()),['Usuarios','Inicio','Reservas','Propiedades']);
    assert.equal(document.querySelectorAll('.m3-drawer').length,1);
    initMaterial3UI();
    await settle();
    assert.equal(document.querySelectorAll('.m3-bottom-nav').length,1);
  }finally{cleanup(dom);}
});
test('resizing to expanded desktop closes the modal drawer and unlocks scrolling',async()=>{
  const dom=await setup();
  try{
    document.querySelector('.m3-account-button').click();
    window.innerWidth=1280;
    window.dispatchEvent(new dom.window.Event('resize'));
    assert.equal(document.body.classList.contains('m3-drawer-open'),false);
  }finally{cleanup(dom);}
});
test('replacing sidebar contents with the same profile restores vector icons without duplicating chrome',async()=>{
  const dom=await setup();
  try{
    const template=document.createElement('div');template.innerHTML=sidebar();
    document.querySelector('#sidebar').innerHTML=template.firstElementChild.innerHTML;
    await settle();
    assert.equal(document.querySelectorAll('#sidebar .nav-icon svg').length,4);
    assert.equal(document.querySelectorAll('.m3-bottom-nav').length,1);
  }finally{cleanup(dom);}
});

test('account button is restored after topbar is rebuilt, without adding Más to navigation',async()=>{
  const dom=await setup();
  try{
    document.querySelector('main').insertAdjacentHTML('beforebegin','<header id="topbar"></header>');
    await settle();
    const account=document.querySelector('.m3-account-button');
    assert.ok(account);
    const header=document.querySelector('#topbar');
    header.appendChild(account);
    header.innerHTML='<strong>Nuevo encabezado</strong>';
    await settle();
    assert.equal(header.querySelectorAll('.m3-account-button').length,1);
    assert.equal(document.querySelectorAll('.m3-bottom-nav .m3-bottom-nav-item').length,4);
    assert.equal(document.querySelector('.m3-bottom-nav button'),null);
  }finally{cleanup(dom);}
});
