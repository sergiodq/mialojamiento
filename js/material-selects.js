/* Selects Material 3 para todos los formularios.
 * El <select> original conserva validación, eventos, nombre y valor.
 * No se reemplazan selects multiple: su interfaz es distinta. */
const INSTANCES = new WeakMap();
const DOCS = new WeakMap();
const idFor = select => 'm3-options-' + (select.id || ('select-' + Math.random().toString(36).slice(2)));
const canEnhance = select => select instanceof select.ownerDocument.defaultView.HTMLSelectElement &&
  !select.multiple && Number(select.size || 0) <= 1 && !select.hasAttribute('data-native-select');

// Estilo visual: capitalizar solo la primera letra de etiquetas escritas en minúscula.
// No alteramos valores internos ni nombres propios/acrónimos ya capitalizados.
export function formatSelectDisplayLabel(value) {
  const label = String(value ?? '').trim();
  return label.replace(/\p{L}/u, letter => letter.toLocaleUpperCase('es-AR'));
}
function activeLabel(select) {
  const option = select.options[select.selectedIndex] || null;
  return option ? formatSelectDisplayLabel(option.textContent) : 'Seleccionar...';
}
function optionData(select) {
  return [...select.options].map((option, index) => ({
    index, value: option.value, label: formatSelectDisplayLabel(option.textContent),
    disabled: option.disabled || option.closest('optgroup')?.disabled,
    selected: option.selected
  }));
}
function build(select) {
  if (!canEnhance(select) || INSTANCES.has(select)) return;
  const doc = select.ownerDocument;
  const host = doc.createElement('div');
  host.className = 'm3-select-field';
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'm3-select-trigger';
  button.setAttribute('aria-haspopup','listbox');
  button.setAttribute('aria-expanded','false');
  button.setAttribute('aria-controls', idFor(select));
  const label = doc.querySelector('label[for="'+select.id+'"]');
  button.setAttribute('aria-label', label?.textContent.trim() || select.getAttribute('aria-label') || select.name || 'Seleccionar opción');
  const valueSpan = doc.createElement('span');
  valueSpan.className = 'm3-select-value';
  const chevron = doc.createElement('span');
  chevron.className = 'm3-select-chevron';
  chevron.setAttribute('aria-hidden','true');
  chevron.textContent = '⌄';
  button.append(valueSpan,chevron);
  const panel = doc.createElement('div');
  panel.className = 'm3-select-panel';
  panel.hidden = true;
  panel.setAttribute('role','listbox');
  panel.id = button.getAttribute('aria-controls');
  const header = doc.createElement('div');
  header.className = 'm3-select-panel-heading';
  const headingText=doc.createElement('strong');
  headingText.textContent = label?.textContent.trim() || 'Elegí una opción';
  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'm3-select-close';
  close.setAttribute('aria-label','Cerrar opciones');
  close.textContent='×';
  header.append(headingText,close);
  const options = doc.createElement('div');
  options.className = 'm3-select-options';
  panel.append(header,options);
  host.append(button);
  // El panel va directo al body para evitar stacking contexts de cards,
  // transforms y contenedores con overflow (Safari / Chrome móvil).
  doc.body.appendChild(panel);
  select.insertAdjacentElement('afterend',host);
  select.classList.add('m3-native-select');
  const state={select,host,button,panel,options,valueSpan,close,open:false};
  INSTANCES.set(select,state);
  function sync() {
    const current = activeLabel(select);
    if(valueSpan.textContent !== current) valueSpan.textContent=current;
    const disabled=select.disabled;
    if(button.disabled!==disabled) button.disabled=disabled;
    button.setAttribute('aria-required',String(select.required));
    button.classList.toggle('is-placeholder', !select.value);
    if (select.checkValidity()) button.classList.remove('is-invalid');
    if(state.open) renderOptions();
  }
  function renderOptions() {
    const entries=optionData(select);
    options.replaceChildren();
    for(const opt of entries) {
      const item=doc.createElement('button');
      item.type='button';
      item.className='m3-select-option';
      item.setAttribute('role','option');
      item.dataset.index=String(opt.index);
      item.setAttribute('aria-selected',String(opt.selected));
      item.tabIndex=opt.selected && !opt.disabled?0:-1;
      item.disabled=Boolean(opt.disabled);
      const text=doc.createElement('span');
      text.textContent=opt.label || 'Seleccionar...';
      item.append(text);
      if(opt.selected) {
        const check=doc.createElement('span');
        check.className='m3-select-check';
        check.setAttribute('aria-hidden','true');
        check.textContent='✓';
        item.append(check);
      }
      options.appendChild(item);
    }
  }
  function positionPanel() {
    if (!state.open) return;
    const rect=button.getBoundingClientRect();
    const viewWidth=doc.defaultView.innerWidth || doc.documentElement.clientWidth;
    const left=Math.max(8,Math.min(rect.left,viewWidth-rect.width-8));
    panel.style.setProperty('--m3-menu-left',left+'px');
    panel.style.setProperty('--m3-menu-top',Math.max(8,rect.bottom+7)+'px');
    panel.style.setProperty('--m3-menu-width',Math.min(rect.width,viewWidth-16)+'px');
  }
  function closePanel(focus=true) {
    if(!state.open)return;
    state.open=false;
    panel.hidden=true;
    host.classList.remove('is-open');
    button.setAttribute('aria-expanded','false');
    doc.querySelector('.m3-select-backdrop')?.setAttribute('hidden','');
    doc.body.classList.remove('m3-select-is-open');
    if(focus && button.isConnected)button.focus();
  }
  function openPanel() {
    if(select.disabled)return;
    const anyOpen=doc.querySelector('.m3-select-field.is-open');
    if(anyOpen && anyOpen!==host) INSTANCES.get(anyOpen.previousElementSibling)?.close?.(false);
    // El trigger sigue en el formulario; el panel flota por encima del overlay.
    if(panel.parentElement!==doc.body)doc.body.appendChild(panel);
    sync();
    renderOptions();
    panel.hidden=false;
    state.open=true;
    positionPanel();
    host.classList.add('is-open');
    doc.body.classList.add('m3-select-is-open');
    button.setAttribute('aria-expanded','true');
    const backdrop=doc.querySelector('.m3-select-backdrop');
    if(backdrop)backdrop.hidden=false;
    const chosen=options.querySelector('[aria-selected="true"]:not(:disabled)') ||
      options.querySelector('.m3-select-option:not(:disabled)');
    chosen?.focus();
    chosen?.scrollIntoView?.({block:'nearest'});
  }
  button.addEventListener('click',()=>state.open?closePanel():openPanel());
  close.addEventListener('click',()=>closePanel());
  options.addEventListener('click',event=>{
    const option=event.target.closest('.m3-select-option');
    if(!option || option.disabled)return;
    select.selectedIndex=Number(option.dataset.index);
    select.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));
    select.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));
    closePanel();
    sync();
  });
  options.addEventListener('keydown',event=>{
    const items=[...options.querySelectorAll('.m3-select-option:not(:disabled)')];
    const pos=items.indexOf(doc.activeElement);
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();
      const target=event.key==='Home'?0:event.key==='End'?items.length-1:
        Math.max(0,Math.min(items.length-1,pos+(event.key==='ArrowDown'?1:-1)));
      items[target]?.focus();
    } else if(event.key==='Escape'){
      event.preventDefault();closePanel();
    } else if(event.key==='Tab'){
      closePanel(false);
    }
  });
  button.addEventListener('keydown',event=>{
    if(['ArrowDown','ArrowUp','Enter',' '].includes(event.key)){
      event.preventDefault();openPanel();
    }
  });
  select.addEventListener('change',sync);
  select.addEventListener('input',sync);
  select.addEventListener('invalid',()=>{
    button.classList.add('is-invalid');
    // El select nativo sigue participando en la validación del formulario.
    if(doc.activeElement!==button)button.focus();
  });
  // Los scripts existentes pueden actualizar options/disabled después de cargar.
  const optionsObserver=new doc.defaultView.MutationObserver(sync);
  optionsObserver.observe(select,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','required','selected','label']});
  state.sync=sync;
  state.close=closePanel;
  state.position=positionPanel;
  state.disconnect=()=>optionsObserver.disconnect();
  sync();
}
export function initMaterialSelects(doc=typeof document==='undefined'?null:document) {
  if(!doc || DOCS.has(doc))return;
  const state={};
  DOCS.set(doc,state);
  const backdrop=doc.createElement('div');
  backdrop.className='m3-select-backdrop';
  backdrop.hidden=true;
  doc.body.appendChild(backdrop);
  const closeOpenSelect=(focus=true)=>{
    doc.querySelectorAll('.m3-select-field.is-open').forEach(host=>{
      const select=host.previousElementSibling;
      INSTANCES.get(select)?.close?.(focus);
    });
  };
  backdrop.addEventListener('click',()=>closeOpenSelect(false));
  const scan=root=>{
    if(root?.matches?.('select'))build(root);
    root?.querySelectorAll?.('select').forEach(build);
  };
  scan(doc);
  const observer=new doc.defaultView.MutationObserver(mutations=>{
    for(const mutation of mutations) {
      for(const node of mutation.addedNodes)if(node.nodeType===1)scan(node);
    }
  });
  observer.observe(doc.body,{subtree:true,childList:true});
  const onEscape=event=>{
    if(event.key!=='Escape')return;
    const host=doc.querySelector('.m3-select-field.is-open');
    if(host){event.preventDefault();event.stopPropagation();closeOpenSelect();}
  };
  doc.addEventListener('keydown',onEscape);
  const reposition=()=>doc.querySelectorAll('.m3-select-field.is-open').forEach(host=>{
    INSTANCES.get(host.previousElementSibling)?.position?.();
  });
  doc.defaultView.addEventListener('resize',reposition);
  doc.defaultView.addEventListener('scroll',reposition,true);
  doc.defaultView.addEventListener('pagehide',()=>{
    observer.disconnect();
    closeOpenSelect(false);
    doc.removeEventListener('keydown',onEscape);
    doc.defaultView.removeEventListener('resize',reposition);
    doc.defaultView.removeEventListener('scroll',reposition,true);
  },{once:true});
}

if(typeof document!=='undefined') {
  if(document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded',()=>initMaterialSelects(document),{once:true});
  } else {
    initMaterialSelects(document);
  }
}
