/* Material 3 date and time controls. The original inputs remain canonical:
   scripts, Firebase payloads and native constraint validation use their values. */
const instances = new WeakMap();
const documents = new WeakSet();
const pad = n => String(n).padStart(2, '0');
const toISO = (y,m,d) => y + '-' + pad(m+1) + '-' + pad(d);
const fromISO = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? new Date(Number(s.slice(0,4)), Number(s.slice(5,7))-1, Number(s.slice(8,10))) : null;
const dateText = s => { const d=fromISO(s); return d ? new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',year:'numeric'}).format(d) : 'Elegir fecha'; };
const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const dayNames = ['L','M','M','J','V','S','D'];
const timeText = s => /^\d{2}:\d{2}/.test(s || '') ? s.slice(0,5) + ' hs' : 'Elegir horario';

function node(doc,tag,cls,text) {
  const el=doc.createElement(tag);
  if(cls)el.className=cls;
  if(text!==undefined)el.textContent=text;
  return el;
}
function enhance(input) {
  if(instances.has(input) || input.dataset.nativePicker!==undefined || input.disabled && input.type==='hidden')return;
  const type=input.type;
  if(type!=='date' && type!=='time')return;
  const doc=input.ownerDocument, win=doc.defaultView;
  const holder=node(doc,'div','m3-datetime-field');
  const trigger=node(doc,'button','m3-datetime-trigger');
  trigger.type='button';
  const value=node(doc,'span','m3-datetime-value');
  const symbol=node(doc,'span','m3-datetime-symbol',type==='date'?'▦':'◷');
  symbol.setAttribute('aria-hidden','true');
  trigger.append(value,symbol);
  const label=doc.querySelector('label[for="'+input.id+'"]');
  const labelText=label?.textContent.trim() || (type==='date'?'Fecha':'Horario');
  trigger.setAttribute('aria-label',labelText);
  trigger.setAttribute('aria-haspopup','dialog');
  trigger.setAttribute('aria-expanded','false');
  holder.append(trigger);
  input.after(holder);
  input.classList.add('m3-native-datetime');
  const state={input,type,doc,win,holder,trigger,value,labelText,open:false,month:new Date().getMonth(),year:new Date().getFullYear(),view:'days'};
  instances.set(input,state);
  const sync=()=>{
    const text=type==='date'?dateText(input.value):timeText(input.value);
    if(value.textContent!==text)value.textContent=text;
    trigger.disabled=input.disabled || input.readOnly;
    trigger.classList.toggle('is-empty',!input.value);
    if(input.checkValidity())trigger.classList.remove('is-invalid');
    trigger.setAttribute('aria-required',String(input.required));
  };
  const close=(restoreFocus=true)=>{
    if(!state.open)return;
    state.open=false;
    trigger.setAttribute('aria-expanded','false');
    holder.classList.remove('is-open');
    doc.body.classList.remove('m3-datetime-open');
    state.backdrop?.remove();
    state.sheet?.remove();
    if(restoreFocus && trigger.isConnected)trigger.focus();
  };
  const commit=val=>{
    input.value=val;
    input.dispatchEvent(new win.Event('input',{bubbles:true}));
    input.dispatchEvent(new win.Event('change',{bubbles:true}));
    sync();
    close();
  };
  const enabledDate=iso=>(!input.min||iso>=input.min) && (!input.max||iso<=input.max);
  function monthCalendar(){
    const grid=node(doc,'div','m3-calendar-grid');
    dayNames.forEach(x=>grid.append(node(doc,'span','m3-calendar-weekday',x)));
    const offset=(new Date(state.year,state.month,1).getDay()+6)%7;
    const count=new Date(state.year,state.month+1,0).getDate();
    const today=new Date(),todayISO=toISO(today.getFullYear(),today.getMonth(),today.getDate());
    for(let i=0;i<offset;i++)grid.append(node(doc,'span','m3-calendar-blank'));
    for(let day=1;day<=count;day++){
      const iso=toISO(state.year,state.month,day);
      const btn=node(doc,'button','m3-calendar-day',String(day));
      btn.type='button';
      btn.dataset.date=iso;
      btn.disabled=!enabledDate(iso);
      btn.setAttribute('aria-label',new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'long',year:'numeric'}).format(new Date(state.year,state.month,day)));
      if(iso===input.value){btn.classList.add('is-selected');btn.setAttribute('aria-current','date');}
      if(iso===todayISO)btn.classList.add('is-today');
      btn.addEventListener('click',()=>commit(iso));
      grid.append(btn);
    }
    return grid;
  }
  function renderDate(){
    const body=state.sheet.querySelector('.m3-picker-content');
    body.replaceChildren();
    const navigation=node(doc,'div','m3-calendar-navigation');
    const prev=node(doc,'button','m3-picker-icon','‹');
    const next=node(doc,'button','m3-picker-icon','›');
    [prev,next].forEach(b=>b.type='button');
    prev.setAttribute('aria-label','Mes anterior');
    next.setAttribute('aria-label','Mes siguiente');
    const heading=node(doc,'button','m3-calendar-heading',months[state.month]+' '+state.year);
    heading.type='button';
    heading.setAttribute('aria-label','Elegir mes y año');
    prev.addEventListener('click',()=>{const d=new Date(state.year,state.month-1,1);state.year=d.getFullYear();state.month=d.getMonth();renderDate()});
    next.addEventListener('click',()=>{const d=new Date(state.year,state.month+1,1);state.year=d.getFullYear();state.month=d.getMonth();renderDate()});
    heading.addEventListener('click',()=>{state.view=state.view==='months'?'days':'months';renderDate()});
    navigation.append(prev,heading,next);
    body.append(navigation);
    if(state.view==='months'){
      const yearNav=node(doc,'div','m3-calendar-year-nav');
      const minus=node(doc,'button','m3-picker-icon','−');
      const year=node(doc,'strong','',String(state.year));
      const plus=node(doc,'button','m3-picker-icon','+');
      minus.type=plus.type='button';
      minus.setAttribute('aria-label','Año anterior');
      plus.setAttribute('aria-label','Año siguiente');
      minus.addEventListener('click',()=>{state.year--;renderDate()});
      plus.addEventListener('click',()=>{state.year++;renderDate()});
      yearNav.append(minus,year,plus);
      body.append(yearNav);
      const monthGrid=node(doc,'div','m3-calendar-month-grid');
      months.forEach((m,index)=>{
        const b=node(doc,'button','m3-calendar-month',m.slice(0,3));
        b.type='button';b.setAttribute('aria-label',m+' '+state.year);
        if(index===state.month)b.classList.add('is-selected');
        b.addEventListener('click',()=>{state.month=index;state.view='days';renderDate()});
        monthGrid.append(b);
      });
      body.append(monthGrid);
    } else {
      body.append(monthCalendar());
    }
    const footer=node(doc,'div','m3-picker-footer');
    if(!input.required){
      const clear=node(doc,'button','m3-picker-text-button','Borrar');
      clear.type='button';clear.addEventListener('click',()=>commit(''));footer.append(clear);
    }
    const today=node(doc,'button','m3-picker-text-button','Hoy');
    today.type='button';
    const d=new Date(),iso=toISO(d.getFullYear(),d.getMonth(),d.getDate());
    today.disabled=!enabledDate(iso);
    today.addEventListener('click',()=>commit(iso));
    const cancel=node(doc,'button','m3-picker-text-button','Cancelar');
    cancel.type='button';cancel.addEventListener('click',()=>close());
    footer.append(today,cancel);body.append(footer);
  }
  function renderTime(){
    const body=state.sheet.querySelector('.m3-picker-content');
    body.replaceChildren();
    const parts=(input.value||'12:00').split(':');
    const columns=node(doc,'div','m3-time-columns');
    const numberControls=[];
    [0,1].forEach(index=>{
      const part=node(doc,'div','m3-time-part');
      const label=node(doc,'label','m3-time-label',index===0?'Hora':'Minutos');
      const number=node(doc,'input','m3-time-number');
      number.type='number';number.inputMode='numeric';number.min='0';number.max=index===0?'23':'59';number.step='1';
      number.value=String(Number(parts[index]||0));
      number.setAttribute('aria-label',label.textContent);
      label.append(number);
      const controls=node(doc,'div','m3-time-increments');
      const decrement=node(doc,'button','m3-time-step','−');
      const increment=node(doc,'button','m3-time-step','+');
      decrement.type=increment.type='button';
      decrement.setAttribute('aria-label','Restar '+(index===0?'hora':'minuto'));
      increment.setAttribute('aria-label','Sumar '+(index===0?'hora':'minuto'));
      const max=index===0?23:59;
      const move=delta=>{number.value=String((Number(number.value||0)+delta+max+1)%(max+1))};
      decrement.addEventListener('click',()=>move(-1));
      increment.addEventListener('click',()=>move(1));
      controls.append(decrement,increment);part.append(label,controls);columns.append(part);numberControls.push(number);
    });
    body.append(columns);
    const footer=node(doc,'div','m3-picker-footer');
    if(!input.required){
      const clear=node(doc,'button','m3-picker-text-button','Borrar');
      clear.type='button';clear.addEventListener('click',()=>commit(''));footer.append(clear);
    }
    const cancel=node(doc,'button','m3-picker-text-button','Cancelar');
    cancel.type='button';cancel.addEventListener('click',()=>close());
    const apply=node(doc,'button','m3-picker-apply','Aplicar');
    apply.type='button';
    const applyTime=()=>{
      const h=Number(numberControls[0].value),m=Number(numberControls[1].value);
      if(!Number.isInteger(h)||h<0||h>23||!Number.isInteger(m)||m<0||m>59){
        numberControls.find(el=>!el.validity.valid)?.focus();return;
      }
      const candidate=pad(h)+':'+pad(m);
      if(input.min && candidate<input.min || input.max && candidate>input.max){
        apply.textContent='Fuera de horario';return;
      }
      commit(candidate);
    };
    apply.addEventListener('click',applyTime);
    columns.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyTime()}});
    footer.append(cancel,apply);body.append(footer);
  }
  const open=()=>{
    if(trigger.disabled)return;
    doc.querySelectorAll('.m3-datetime-field.is-open .m3-datetime-trigger').forEach(b=>{if(b!==trigger)b.click()});
    doc.querySelectorAll('.m3-select-field.is-open .m3-select-trigger').forEach(b=>b.click());
    sync();
    const selected=fromISO(input.value)||new Date();
    state.year=selected.getFullYear();state.month=selected.getMonth();state.view='days';
    const backdrop=node(doc,'div','m3-datetime-backdrop');
    const sheet=node(doc,'section','m3-datetime-sheet');
    sheet.setAttribute('role','dialog');
    sheet.setAttribute('aria-modal','true');
    sheet.setAttribute('aria-label',type==='date'?'Seleccionar '+labelText:'Seleccionar '+labelText);
    const top=node(doc,'div','m3-picker-top');
    const title=node(doc,'strong','',labelText);
    const exit=node(doc,'button','m3-picker-close','×');
    exit.type='button';exit.setAttribute('aria-label','Cerrar calendario');
    exit.addEventListener('click',()=>close());
    top.append(title,exit);
    sheet.append(top,node(doc,'div','m3-picker-content'));
    doc.body.append(backdrop,sheet);
    state.backdrop=backdrop;state.sheet=sheet;
    state.open=true;holder.classList.add('is-open');doc.body.classList.add('m3-datetime-open');
    trigger.setAttribute('aria-expanded','true');
    backdrop.addEventListener('click',()=>close(false));
    if(type==='date')renderDate();else renderTime();
    sheet.querySelector('.m3-picker-close')?.focus();
  };
  trigger.addEventListener('click',()=>state.open?close():open());
  input.addEventListener('input',sync);input.addEventListener('change',sync);
  input.addEventListener('invalid',()=>{trigger.classList.add('is-invalid');trigger.focus()});
  input.form?.addEventListener('reset',()=>win.setTimeout(sync,0));
  state.close=close;state.sync=sync;
  sync();
}
export function initMaterialDateTime(doc=typeof document==='undefined'?null:document){
  if(!doc||documents.has(doc))return;
  documents.add(doc);
  const scan=root=>{
    if(root.matches?.('input[type="date"],input[type="time"]'))enhance(root);
    root.querySelectorAll?.('input[type="date"],input[type="time"]').forEach(enhance);
  };
  scan(doc);
  const observer=new doc.defaultView.MutationObserver(records=>{
    for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)scan(node);
  });
  observer.observe(doc.body,{subtree:true,childList:true});
  const onKey=e=>{
    if(e.key!=='Escape')return;
    const active=doc.querySelector('.m3-datetime-field.is-open .m3-datetime-trigger');
    if(active){e.preventDefault();e.stopPropagation();active.click()}
  };
  doc.addEventListener('keydown',onKey);
  doc.defaultView.addEventListener('pagehide',()=>{observer.disconnect();doc.removeEventListener('keydown',onKey)},{once:true});
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>initMaterialDateTime(document),{once:true});
  else initMaterialDateTime(document);
}
