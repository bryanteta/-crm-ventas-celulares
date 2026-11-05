(()=>{'use strict';const store=window.LunivoStore,form=document.querySelector('#form'),items=document.querySelector('#items'),notice=document.querySelector('#notice');let editingId=null;let lastView=null;let noticeTimer;let records=[],recordsLoadFailed=false;try{const data=store.records();if(!Array.isArray(data))throw Error('Invalid records');records=data.filter(r=>r&&['id','client','phone','model','channel','payment','event','when','state'].every(k=>typeof r[k]==='string')&&Number.isFinite(instant(r.when).getTime())).map(r=>({...r,contactProfile:typeof r.contactProfile==='string'?r.contactProfile:'',notes:typeof r.notes==='string'?r.notes:''}));if(records.length!==data.length)throw Error('Invalid record');}catch(e){records=[];recordsLoadFailed=true;}const save=()=>{if(recordsLoadFailed){show('No se pudieron leer los seguimientos. No se guardarán cambios sobre datos dañados. No borres los datos de la app.','error');return false;}if(window.LunivoSyncCanSave&&!window.LunivoSyncCanSave()){show('No se pudo abrir el espacio de esta cuenta. Vuelve a iniciar sesión antes de guardar.','error');return false;}try{store.save(records);syncNativeReminders();window.dispatchEvent(new Event('lunivo-local-save'));return true;}catch(e){show('No se pudieron guardar los datos. Libera espacio o permite el almacenamiento y vuelve a intentar.','error');return false;}},show=(message,tone='success')=>{clearTimeout(noticeTimer);notice.dataset.tone=tone;notice.querySelector('.notice-message').textContent=message;notice.classList.remove('hidden');noticeTimer=setTimeout(()=>notice.classList.add('hidden'),tone==='error'?10000:5000)},dateText=s=>new Intl.DateTimeFormat('es-SV',{timeZone:'America/El_Salvador',dateStyle:'medium',timeStyle:'short'}).format(instant(s)),day=s=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/El_Salvador',year:'numeric',month:'2-digit',day:'2-digit'}).format(instant(s)),today=()=>day(new Date().toISOString()),validPhone=s=>Boolean(normalizePhone(s)),node=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text||'';if(cls)el.className=cls;return el};let alerted=new Set();

// datetime-local values are wall-clock times in El Salvador, regardless of browser timezone.
function instant(value){return new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)?value+'-06:00':value)}
function normalizePhone(value){if(!/^[+\d\s().-]+$/.test(value))return '';const digits=value.replace(/\D/g,'');if(digits.length===8)return '503'+digits;if(/^503\d{8}$/.test(digits))return digits;if((value.startsWith('+')||/^[1-9]\d{10,14}$/.test(digits))&&/^[1-9]\d{7,14}$/.test(digits))return digits;return ''}
function isSocial(channel){return ['Facebook','Instagram','TikTok'].includes(channel)}
function profileLink(channel,value){const hosts={Facebook:'facebook.com',Instagram:'instagram.com',TikTok:'tiktok.com'},host=hosts[channel];if(!host||!value)return '';if(/^(?:https?:|(?:www\.|m\.)?(?:facebook|instagram|tiktok)\.com[/?])/i.test(value)){try{const url=new URL(/^https?:/i.test(value)?value:'https://'+value);return url.protocol==='https:'&&[host,'www.'+host,...(channel==='Facebook'?['m.facebook.com']:[])].includes(url.hostname)&&!url.username&&!url.password?url.href:''}catch{return ''}}const username=value.replace(/^@/,'');return /^[a-zA-Z0-9._]+$/.test(username)?'https://www.'+host+'/'+(channel==='TikTok'?'@':'')+encodeURIComponent(username):''}
function syncChannel(){const social=isSocial(form.elements.channel.value);document.querySelector('#profile-field').hidden=!social;form.elements.contactProfile.disabled=!social;form.elements.contactProfile.required=false;form.elements.phone.required=!social;document.querySelector('#phone-label').textContent=social?'Número de contacto (opcional)':'Número de contacto *'}
form.addEventListener('invalid',event=>{show('Revisa el campo '+(event.target.closest('label')?.childNodes[0]?.textContent.trim()||'marcado')+'. '+event.target.validationMessage,'error')},true);form.addEventListener('input',()=>{if(notice.dataset.tone==='error')notice.classList.add('hidden')});form.elements.channel.addEventListener('change',syncChannel);form.addEventListener('reset',()=>setTimeout(syncChannel,0));syncChannel();

function render(){const now=Date.now(),active=records.filter(r=>r.state!=='Completado');document.querySelector('#nclients').textContent=new Set(records.map(r=>normalizePhone(r.phone)||r.channel+':'+(r.contactProfile||r.client).toLowerCase())).size;document.querySelector('#npending').textContent=active.length;document.querySelector('#ntoday').textContent=active.filter(r=>day(r.when)===today()).length;document.querySelector('#nlate').textContent=active.filter(r=>instant(r.when).getTime()<now).length;renderOverview();renderCalendar();items.replaceChildren();const q=document.querySelector('#search').value.trim().toLowerCase(),filter=document.querySelector('#filter').value;const visible=records.filter(r=>(filter==='Todos'||r.state===filter)&&(r.client.toLowerCase().includes(q)||r.model.toLowerCase().includes(q)||(r.contactProfile||'').toLowerCase().includes(q)||r.phone.includes(q))).sort((a,b)=>instant(a.when)-instant(b.when));document.querySelector('#result-count').textContent=visible.length+' de '+records.length+' seguimientos';if(!visible.length){items.append(node('p',records.length?'No hay seguimientos que coincidan. Prueba otra búsqueda o estado.':'Tu agenda está vacía. Crea tu primer seguimiento con el botón Nuevo seguimiento.','empty'));return;}visible.forEach(r=>items.append(createRow(r)))}
// Keep stored payment values compatible with existing records and published Firebase rules.
function paymentLabel(value){return ({Cuotas:'Tasa cero','Por definir':'No definido'})[value]||value}
function createRow(r){const now=Date.now();const row=node('article','','row'),content=node('div'),heading=node('b',r.client+' · '+r.model),info=node('p',r.event+' · '+r.channel+' · '+paymentLabel(r.payment),'muted'),when=node('p','📅 '+dateText(r.when),'muted'),notes=node('p',r.notes,'muted'),late=r.state!=='Completado'&&instant(r.when).getTime()<now,status=node('span',late?'Vencido':r.state,'status'+(late?' late':r.state==='Completado'?' done':'')),actions=node('div','','actions'),select=document.createElement('select');['Pendiente','En proceso','Completado'].forEach(s=>{const opt=node('option',s);opt.value=s;select.append(opt)});select.value=r.state;select.setAttribute('aria-label','Estado de '+r.client);select.addEventListener('change',()=>{const previous=r.state;r.state=select.value;if(!save())r.state=previous;render()});actions.append(select);if(r.channel==='WhatsApp'){const phone=normalizePhone(r.phone);if(phone){const link=node('a','Abrir WhatsApp','btn');link.href='https://wa.me/'+phone;link.target='_blank';link.rel='noopener noreferrer';actions.append(link)}}if(r.contactProfile){const href=profileLink(r.channel,r.contactProfile);if(href){const link=node('a','Abrir '+r.channel,'btn');link.href=href;link.target='_blank';link.rel='noopener noreferrer';actions.append(link)}}const edit=node('button','Editar','secondary');edit.type='button';edit.addEventListener('click',()=>{editingId=r.id;form.reset();for(const [name,value] of Object.entries(r)){const field=form.elements.namedItem(name);if(field)field.value=value}syncChannel();document.querySelector('#form-title').textContent='Editar seguimiento';form.querySelector('[type=submit]').textContent='Guardar cambios';document.querySelector('#cancel-edit').hidden=false;location.hash='#registro';route();window.LunivoProfileUI.render();form.elements.client.focus()});actions.append(edit);const del=node('button','Eliminar','danger');del.type='button';del.addEventListener('click',()=>{if(confirm('¿Eliminar el seguimiento de '+r.client+'?')){const previous=records;records=records.filter(x=>x.id!==r.id);if(!save())records=previous;else if(editingId===r.id)window.LunivoApp.reload();render()}});actions.append(del);content.append(heading,info);content.append(node('p',r.createdByName?'Registrado por: '+r.createdByName:'Sin usuario registrado','record-creator'));if(r.phone)content.append(node('p','Tel. '+r.phone,'muted'));if(r.contactProfile)content.append(node('p',r.channel+': '+r.contactProfile,'muted'));content.append(when,status);if(r.notes)content.append(notes);row.dataset.recordId=r.id;row.append(content,actions);return row}

form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form),r=Object.fromEntries(fd.entries());for(const k of Object.keys(r))r[k]=String(r[k]).trim();if(!r.client||!r.model||(!isSocial(r.channel)&&!validPhone(r.phone))||(r.phone&&!validPhone(r.phone))||!Number.isFinite(instant(r.when).getTime())){show('Completa nombre, modelo y fecha. Si agregas un teléfono, debe ser válido; es obligatorio para WhatsApp, llamadas y contactos presenciales.','error');return}if(r.contactProfile&&/^(?:[a-z]+:|www\.|(?:facebook|instagram|tiktok)\.com[/?])/i.test(r.contactProfile)&&!profileLink(r.channel,r.contactProfile)){show('Usa un enlace HTTPS del perfil en la red social seleccionada.','error');return}r.phone=normalizePhone(r.phone)?'+'+normalizePhone(r.phone):'';r.contactProfile=isSocial(r.channel)?r.contactProfile:'';const creator=window.LunivoProfileUI.current();if(!editingId&&!creator){show('Agrega y selecciona tu usuario en Ajustes antes de crear un seguimiento.','error');location.hash='#ajustes';route();return}if(editingId){const original=records.find(x=>x.id===editingId);for(const key of ['createdById','createdByName','createdAt','brand'])if(original&&Object.hasOwn(original,key))r[key]=original[key];}else{r.createdById=creator.id;r.createdByName=creator.name;r.createdAt=new Date().toISOString();}r.id=editingId||(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random());const previous=records;records=editingId?records.map(x=>x.id===editingId?r:x):[...records,r];if(!save()){records=previous;return}resetEditor();document.querySelector('#search').value='';document.querySelector('#filter').value='Todos';render();show('Seguimiento guardado correctamente.');location.hash='#listado';route()});
document.querySelector('#search').addEventListener('input',render);document.querySelector('#filter').addEventListener('change',render);
function resetEditor(){editingId=null;form.reset();syncChannel();document.querySelector('#form-title').textContent='Registrar consulta o seguimiento';form.querySelector('[type=submit]').textContent='Guardar seguimiento';document.querySelector('#cancel-edit').hidden=true;window.LunivoProfileUI.render()}
document.querySelector('#clear-followup').addEventListener('click',()=>{resetEditor();route();form.elements.client.focus()});
document.querySelector('#cancel-edit').addEventListener('click',()=>{resetEditor();location.hash='#listado'});
function route(){if(location.hash.startsWith('#ventas')){for(const selector of ['#registro','.cards','#overview','#ajustes','#listado','#agenda'])document.querySelector(selector).hidden=true;document.querySelector('#primary-action').hidden=true;return;}const view=['#registro','#listado','#agenda','#ajustes'].includes(location.hash)?location.hash:'#dashboard';
for(const [selector,target] of [['#registro','#registro'],['.cards','#dashboard'],['#overview','#dashboard'],['#ajustes','#ajustes'],['#listado','#listado'],['#agenda','#agenda']])document.querySelector(selector).hidden=view!==target;
const titles={'#ajustes':['Ajustes','Tu cuenta, sincronización y recordatorios, en un solo lugar.'],'#dashboard':['Resumen de Lunivo','Tus citas y prioridades, en un solo lugar.'],'#listado':['Seguimientos','Gestiona clientes, actualiza estados y reprograma contactos.'],'#agenda':['Agenda','Organiza tus contactos con el calendario mensual.'],'#registro':[editingId?'Editar seguimiento':'Nuevo seguimiento','Registra el próximo contacto con tu cliente.']};
document.querySelector('#primary-action').hidden=(view==='#registro'||view==='#ajustes');document.querySelector('#view-title').textContent=titles[view][0];document.querySelector('#view-description').textContent=titles[view][1];document.querySelectorAll('nav a').forEach(a=>{const active=a.hash===view;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});document.querySelector('#view-title').focus({preventScroll:true});window.LunivoProfileUI.render();if(lastView!==view){window.scrollTo({top:0,behavior:'instant'});lastView=view;}}
let selectedDate=today(),monthCursor=new Date(today()+'T12:00');monthCursor.setDate(1);
const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
function renderOverview(){const active=records.filter(r=>r.state!=='Completado').sort((a,b)=>instant(a.when)-instant(b.when));
const groups=[['#today-items',active.filter(r=>day(r.when)===today()),'No tienes citas pendientes para hoy.'],['#priority-items',active.filter(r=>instant(r.when)<new Date()),'Estás al día. No hay seguimientos vencidos.'],['#upcoming-items',active.filter(r=>day(r.when)>today()),'No hay próximas citas. Programa un seguimiento para empezar.']];
for(const [selector,list,empty] of groups){const target=document.querySelector(selector);target.replaceChildren();if(!list.length)target.append(node('p',empty,'empty'));list.slice(0,5).forEach(r=>{const entry=node('article','','summary-entry');entry.append(node('b',r.client+' · '+r.model),node('p',dateText(r.when)+' · '+r.event,'muted'),node('p',r.createdByName?'Registrado por: '+r.createdByName:'Sin usuario registrado','record-creator'));const link=node('a','Ver en agenda');link.href='#agenda';link.addEventListener('click',()=>{selectedDate=day(r.when);monthCursor=new Date(day(r.when)+'T12:00');monthCursor.setDate(1);renderCalendar()});entry.append(link);target.append(entry)});if(list.length>5){const link=node('a','Ver los '+list.length+' seguimientos','text-link');link.href='#listado';target.append(link)}}}
function renderCalendar(){const year=monthCursor.getFullYear(),month=monthCursor.getMonth(),grid=document.querySelector('#calendar-days');grid.replaceChildren();document.querySelector('#month-title').textContent=new Intl.DateTimeFormat('es-SV',{month:'long',year:'numeric'}).format(monthCursor);
const offset=(new Date(year,month,1).getDay()+6)%7;for(let i=0;i<offset;i++)grid.append(node('span'));
for(let n=1;n<=new Date(year,month+1,0).getDate();n++){const key=dateKey(new Date(year,month,n)),entries=records.filter(r=>day(r.when)===key),button=node('button',String(n),'calendar-day'+(key===today()?' today':'')+(key===selectedDate?' selected':'')+(entries.some(r=>r.state!=='Completado')?' has-pending':''));button.type='button';button.setAttribute('aria-label',key+', '+entries.length+' contactos');button.setAttribute('aria-pressed',String(key===selectedDate));if(key===today())button.setAttribute('aria-current','date');if(entries.length)button.append(node('small',String(entries.length)));button.addEventListener('click',()=>{selectedDate=key;renderCalendar()});grid.append(button)}
document.querySelector('#selected-day').textContent=new Intl.DateTimeFormat('es-SV',{dateStyle:'full'}).format(new Date(selectedDate+'T12:00'));const target=document.querySelector('#day-items'),entries=records.filter(r=>day(r.when)===selectedDate).sort((a,b)=>instant(a.when)-instant(b.when));target.replaceChildren();if(!entries.length)target.append(node('p','No hay contactos programados para este día.','empty'));entries.forEach(r=>target.append(createRow(r)));}
for(const [id,step] of [['#prev-month',-1],['#next-month',1]])document.querySelector(id).addEventListener('click',()=>{monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth()+step,1);selectedDate=dateKey(monthCursor);renderCalendar()});
document.querySelector('#calendar-today').addEventListener('click',()=>{selectedDate=today();monthCursor=new Date(today()+'T12:00');monthCursor.setDate(1);renderCalendar()});
document.querySelector('#add-for-day').addEventListener('click',()=>{resetEditor();form.elements.when.value=selectedDate+'T09:00';location.hash='#registro';route();form.elements.client.focus()});
window.addEventListener('hashchange',route);document.querySelectorAll('a[href="#registro"]').forEach(a=>a.addEventListener('click',()=>{if(a.getAttribute('href')!=='#registro')return;if(editingId)resetEditor();location.hash='#registro';route()}));route();
// Android owns durable alarms; the browser keeps its existing in-page reminders.
const androidBridge = window.CrmAndroid;
const notificationPanel = document.querySelector('#notification-panel');
let notificationSyncFailed = false;
let nativeStatus = null;

function updateNotificationUI() {
  notificationPanel.hidden = !androidBridge || location.hash !== '#ajustes';
  if (!androidBridge) return;
  const enabled = Boolean(nativeStatus?.enabled) && nativeStatus?.deviceEnabled !== false;
  notificationPanel.classList.toggle('is-enabled', enabled && !notificationSyncFailed);
  document.querySelector('#notification-title').textContent = notificationSyncFailed
    ? 'Revisa la programación de tus avisos'
    : enabled ? 'Tus recordatorios están activos' : 'Que no se te pase un contacto';
  document.querySelector('#notification-status').textContent = notificationSyncFailed
    ? 'El seguimiento se guardó, pero no se pudieron actualizar los avisos. Toca Reintentar.'
    : nativeStatus?.deviceEnabled === false ? 'Los avisos están pausados en este teléfono. Puedes activarlos aquí.'
    : !enabled ? 'Permite las notificaciones para recibir avisos con la app cerrada.'
    : nativeStatus.exact ? 'Recibirás el aviso a la hora de tu cita, incluso con la app cerrada.'
    : 'Los avisos están activos. Permite Hora exacta para evitar retrasos de Android.';
  document.querySelector('#notification-count').textContent = enabled && !notificationSyncFailed
    ? `${nativeStatus.scheduled} recordatorio(s) programado(s) · Solo en este teléfono` : '';
  document.querySelector('#notification-enable').textContent = notificationSyncFailed ? 'Reintentar' : enabled ? 'Ajustes' : 'Activar';
  document.querySelector('#notification-test').hidden = !enabled || notificationSyncFailed;
  document.querySelector('#notification-exact').hidden = !enabled || nativeStatus.exact || notificationSyncFailed;
  document.querySelector('#reminder-hint').textContent = enabled && !notificationSyncFailed
    ? 'Android te avisará aunque cierres la app. Revisa los permisos de Hora exacta en Ajustes.'
    : 'Activa los recordatorios desde Ajustes para recibir avisos con la app cerrada.';
}

function sendNative(type, data = {}) {
  if (!androidBridge) return;
  try {
    androidBridge.postMessage(JSON.stringify({ type, ...data }));
  } catch {
    notificationSyncFailed = true;
    updateNotificationUI();
  }
}

function syncNativeReminders(force = false) {
  if(recordsLoadFailed&&!force){notificationSyncFailed=true;updateNotificationUI();return;}
  sendNative('sync', { records: records.map(r => ({
    id: r.id, client: r.client, model: r.model, event: r.event,
    state: r.state, at: instant(r.when).getTime()
  })) });
}

if (androidBridge) {
  androidBridge.onmessage = event => {
    try {
      const response = JSON.parse(event.data);
      if (response.type === 'documentStatus') {
        window.dispatchEvent(new CustomEvent('lunivo-document-status', { detail: response }));
        return;
      }
      if (response.type === 'launchSoundStatus') {
        window.dispatchEvent(new CustomEvent('lunivo-launch-sound-status', { detail: response }));
        return;
      }
      if (response.type === 'status') {
        nativeStatus = response;
        if (response.request === 'sync') notificationSyncFailed = false;
        window.dispatchEvent(new CustomEvent('lunivo-reminder-status', { detail: response }));
      } else if (response.type === 'error') {
        notificationSyncFailed = true;
      }
    } catch { notificationSyncFailed = true; }
    updateNotificationUI();
  };
}
document.querySelector('#notification-enable').addEventListener('click', () => {
  if (notificationSyncFailed) syncNativeReminders();
  else if (nativeStatus?.deviceEnabled === false) sendNative('deviceReminders', { enabled: true });
  else sendNative(nativeStatus?.enabled ? 'settings' : 'permission');
});
document.querySelector('#notification-exact').addEventListener('click', () => sendNative('precision'));
document.querySelector('#notification-test').addEventListener('click', () => sendNative('test'));
window.addEventListener('crm-native-refresh', syncNativeReminders);
window.addEventListener('hashchange', updateNotificationUI);
window.addEventListener('crm-open-followup', event => {
  const record = records.find(r => r.id === event.detail);
  if (!record) {
    location.hash = '#listado';
    route();
    show('Este seguimiento ya no está disponible.');
    return;
  }
  selectedDate = day(record.when);
  monthCursor = new Date(selectedDate + 'T12:00');
  monthCursor.setDate(1);
  renderCalendar();
  location.hash = '#agenda';
  route();
  requestAnimationFrame(() => {
    const target = [...document.querySelectorAll('#day-items .row')].find(row => row.dataset.recordId === record.id);
    if (target) {
      target.classList.add('focused-record');
      target.scrollIntoView({ block: 'center' });
    }
  });
});
document.querySelector('#welcome-date').textContent = new Intl.DateTimeFormat('es-SV', {
  timeZone: 'America/El_Salvador', weekday: 'long', day: 'numeric', month: 'short'
}).format(new Date());
updateNotificationUI();
document.querySelector('#settings-browser-hint').hidden = Boolean(androidBridge);
document.querySelector('#notice-dismiss').addEventListener('click', () => { clearTimeout(noticeTimer); notice.classList.add('hidden'); });

window.LunivoApp = {
  notice: show,
  editingRecord: () => editingId ? records.find(r => r.id === editingId) : null,
  hideRecords() { records = []; recordsLoadFailed=true; resetEditor(); render(); syncNativeReminders(true); },
  records: () => JSON.parse(JSON.stringify(records)),
  reload(accountChanged = false) {
    try {
      const data = store.records();
      if (!Array.isArray(data)) throw new Error('Invalid storage');
      const loaded = data.filter(r => r && ['id','client','phone','model','channel','payment','event','when','state'].every(k => typeof r[k] === 'string') && Number.isFinite(instant(r.when).getTime()))
        .map(r => ({ ...r, contactProfile: typeof r.contactProfile === 'string' ? r.contactProfile : '', notes: typeof r.notes === 'string' ? r.notes : '' }));
      if(loaded.length!==data.length)throw new Error('Invalid record');
      records=loaded;recordsLoadFailed=false;
      if (!accountChanged && editingId && !records.some(record => record.id === editingId)) {
        // Preserve the user's draft if the other phone removes the original row.
        editingId = null;
        document.querySelector('#form-title').textContent = 'Guardar una nueva copia';
        form.querySelector('[type=submit]').textContent = 'Guardar como nuevo';
        if (location.hash === '#registro') document.querySelector('#view-title').textContent = 'Nuevo seguimiento';
        show('El seguimiento ya no está disponible. Conservamos tu borrador; puedes guardarlo como uno nuevo.', 'error');
      }
      if (accountChanged) {
        resetEditor();
        document.querySelector('#search').value = '';
        document.querySelector('#filter').value = 'Todos';
        alerted.clear();
        location.hash = location.hash === '#ajustes' ? '#ajustes' : '#dashboard';
        route();
      }
      render();
      syncNativeReminders();
    } catch {
      recordsLoadFailed=true;
      show('No se pudieron cargar los datos de esta cuenta. Vuelve a intentarlo sin borrar los datos de la app.', 'error');
      throw new Error('Local account storage unavailable');
    }
  }
};

function remind(){const due=records.filter(r=>r.state!=='Completado'&&instant(r.when).getTime()<=Date.now()&&!alerted.has(r.id));if(due.length){due.forEach(r=>alerted.add(r.id));show('🔔 Tienes '+due.length+' seguimiento(s) pendiente(s). Revisa tu agenda.')}}render();syncNativeReminders();if(recordsLoadFailed)show('No se pudieron leer los seguimientos. Conservamos el almacenamiento anterior; no borres los datos de la app.','error');remind();setInterval(()=>{render();remind()},60000);
window.LunivoProfileUI.render();
})();
