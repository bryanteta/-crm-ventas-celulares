(() => {
  'use strict';
  const store = window.LunivoStore;
  const profiles = window.LunivoProfiles;
  const bridge = window.CrmAndroid;
  const dialog = document.querySelector('#account-dialog');
  const panel = document.querySelector('#cloud-panel');
  const message = document.querySelector('#account-message');
  const signInForm = document.querySelector('#account-form');
  const connected = document.querySelector('#account-connected');
  let state = { configured: false, uid: null, email: '' };
  let busy = false;
  let imports = [];
  let profileImports = [];
  let problem = '';
  let serverSeen = false;
  let profilesServerSeen = false;
  let info = '';
  let flushTimer;
  const submitted = new Map();
  const operationKey = (type, op) => `${type}:${op.id}`;
  window.LunivoSyncCanSave = () => !bridge || state.uid === store.account() && state.uid === profiles.account();

  function send(type, fields = {}) {
    if (!bridge) return;
    try { bridge.postMessage(JSON.stringify({ type, ...fields })); }
    catch { submitted.clear(); fail('No se pudo comunicar con la sincronización. Tus cambios siguen en el teléfono.'); }
  }
  function fail(text) {
    busy = false;
    problem = text;
    message.textContent = text;
    render();
  }
  function pendingCount() {
    try { return store.pending().length + profiles.pending().length; }
    catch { return -1; }
  }
  function render() {
    panel.hidden = !bridge || location.hash !== '#ajustes';
    const pending = pendingCount();
    document.querySelector('#cloud-title').textContent = state.uid ? state.email : 'Tus clientes, en tus dos teléfonos';
    document.querySelector('#cloud-open').textContent = state.uid ? 'Mi cuenta' : 'Vincular dispositivos';
    document.querySelector('#cloud-status').textContent = problem || (state.uid
      ? pending > 0 ? `${pending} cambio(s) en este teléfono, pendientes de confirmar en la nube.`
      : !navigator.onLine || !serverSeen || !profilesServerSeen ? 'Datos disponibles en este teléfono. Esperando conexión con la nube.'
      : 'Datos sincronizados con tu cuenta.'
      : state.configured ? 'Inicia sesión con el mismo correo en tus dispositivos.'
      : 'La vinculación todavía no está disponible en esta versión. Tus datos siguen en el teléfono.');
    signInForm.hidden = Boolean(state.uid);
    connected.hidden = !state.uid;
    document.querySelector('#account-email-current').textContent = state.email;
    for (const id of ['account-signin','account-register','account-reset']) {
      document.getElementById(id).disabled = busy || !state.configured;
    }
    document.querySelector('#account-sync').disabled = busy;
    document.querySelector('#account-signout').disabled = busy;
    if (!state.configured) message.textContent = 'La sincronización todavía no está disponible en esta versión. Puedes seguir usando Lunivo en este teléfono.';
    else if (info && !problem) message.textContent = info;
    else if (!problem && !busy) message.textContent = state.uid
      ? document.querySelector('#cloud-status').textContent
      : 'Usa el mismo correo en ambos teléfonos. Cada cuenta tiene su propio espacio.';
  }
  function scheduleFlush() {
    if (flushTimer !== undefined) return;
    flushTimer = setTimeout(flush, 600);
  }
  function flush() {
    clearTimeout(flushTimer);
    flushTimer = undefined;
    if (!state.uid || store.account() !== state.uid || profiles.account() !== state.uid) return;
    // Keep only the latest local edit while offline. Wait for both listeners to reach the server.
    if (!navigator.onLine || !serverSeen || !profilesServerSeen) { render(); return; }
    try {
      for (const [source, type] of [[store, 'cloudFlush'], [profiles, 'cloudProfilesFlush']]) {
        const pending = source.pending();
        const pendingKeys = new Set(pending.map(op => operationKey(type, op)));
        for (const key of submitted.keys()) if (key.startsWith(type + ':') && !pendingKeys.has(key)) submitted.delete(key);
        const operations = pending.filter(op => submitted.get(operationKey(type, op)) !== op.revision).slice(0, 100);
        if (operations.length) {
          for (const op of operations) submitted.set(operationKey(type, op), op.revision);
          send(type, { uid: state.uid, operations });
        }
      }
    } catch { submitted.clear(); fail('No se pudieron leer los cambios pendientes. No borres los datos de la app.'); }
    render();
  }
  function requestState() {
    if (bridge) send('cloudState');
    scheduleFlush();
  }
  function authenticate(type) {
    if (busy || !signInForm.reportValidity() || !state.configured) return;
    imports = document.querySelector('#account-import').checked && !store.account()
      ? window.LunivoApp.records() : [];
    profileImports = document.querySelector('#account-import').checked && !store.account() ? profiles.records() : [];
    busy = true;
    problem = '';
    info = '';
    message.textContent = 'Conectando con tu cuenta…';
    const password = document.querySelector('#account-password').value;
    document.querySelector('#account-password').value = '';
    send(type, { email: document.querySelector('#account-email').value.trim(), password });
    render();
  }
  document.querySelector('#cloud-open').addEventListener('click', () => { dialog.showModal(); requestState(); });
  document.querySelector('#account-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { document.querySelector('#account-password').value = ''; });
  signInForm.addEventListener('submit', event => { event.preventDefault(); authenticate('cloudSignIn'); });
  document.querySelector('#account-signin').addEventListener('click', () => authenticate('cloudSignIn'));
  document.querySelector('#account-register').addEventListener('click', () => authenticate('cloudRegister'));
  document.querySelector('#account-reset').addEventListener('click', () => {
    const email = document.querySelector('#account-email');
    if (!email.reportValidity() || !state.configured) return;
    send('cloudResetPassword', { email: email.value.trim() });
  });
  document.querySelector('#account-sync').addEventListener('click', () => { problem = ''; submitted.clear(); requestState(); });
  document.querySelector('#account-signout').addEventListener('click', () => {
    if (pendingCount() && !confirm('Hay cambios pendientes. Quedarán en este teléfono hasta que vuelvas a iniciar sesión con esta cuenta. ¿Cerrar sesión?')) return;
    busy = true;
    send('cloudSignOut');
    render();
  });
  document.querySelector('#account-reminders').addEventListener('change', event => {
    send('deviceReminders', { enabled: event.target.checked });
  });
  window.addEventListener('lunivo-reminder-status', event => {
    document.querySelector('#account-reminders').checked = event.detail.deviceEnabled !== false;
  });
  window.addEventListener('lunivo-cloud', event => {
    const response = event.detail;
    try {
      if (response.type === 'cloudState') {
        const previousUid = state.uid;
        state = response;
        const changed = store.account() !== (state.uid || null) || profiles.account() !== (state.uid || null);
        if (changed) {
          clearTimeout(flushTimer);
          flushTimer = undefined;
          submitted.clear();
          profiles.switchAccount(state.uid || null, state.uid ? profileImports : []);
          store.switchAccount(state.uid || null, state.uid ? imports : []);
          imports = [];
          profileImports = [];
          serverSeen = false;
          profilesServerSeen = false;
          window.LunivoApp.reload(true);
        } else if (previousUid !== state.uid) {
          window.LunivoApp.reload();
        }
        if (previousUid !== state.uid) {
          serverSeen = false;
          profilesServerSeen = false;
          busy = false;
          document.querySelector('#account-import').checked = false;
        }
        scheduleFlush();
      } else if (response.type === 'cloudProfilesSnapshot' && response.uid === state.uid) {
        if (profiles.merge(response.uid, response.documents, response.fromCache)) {
          profilesServerSeen = !response.fromCache;
          if (profilesServerSeen && serverSeen) { problem = ''; scheduleFlush(); }
          window.LunivoProfileUI.render();
        }
      } else if (response.type === 'cloudProfilesAck' && response.uid === state.uid) {
        profiles.acknowledge(response.uid, response.id, response.revision);
        if (response.existing) profiles.merge(state.uid, [response.existing], true);
        window.LunivoProfileUI.render();
        scheduleFlush();
      } else if (response.type === 'cloudSnapshot' && response.uid === state.uid) {
        const previousRecords = JSON.stringify(store.records());
        if (store.merge(response.uid, response.documents, response.fromCache)) {
          if (previousRecords !== JSON.stringify(store.records())) window.LunivoApp.reload();
          serverSeen = !response.fromCache;
          if (serverSeen && profilesServerSeen) { problem = ''; scheduleFlush(); }
        }
      } else if (response.type === 'cloudAck' && response.uid === state.uid) {
        store.acknowledge(response.uid, response.id, response.revision);
        if (response.existing) {
          store.merge(state.uid, [response.existing], true);
          window.LunivoApp.reload();
        }
        scheduleFlush();
      } else if (response.type === 'cloudError') {
        submitted.clear();
        clearTimeout(flushTimer);
        flushTimer = undefined;
        imports = [];
        profileImports = [];
        fail(response.message);
      } else if (response.type === 'cloudMessage') {
        info = response.message;
      }
    } catch {
      if (response.type === 'cloudState' && (store.account() !== (response.uid || null) || profiles.account() !== (response.uid || null))) {
        window.LunivoApp.hideRecords();
      }
      fail('No se pudieron actualizar los datos de esta cuenta. Los cambios locales se conservan; vuelve a intentarlo.');
    }
    render();
    window.LunivoProfileUI.render();
  });
  window.addEventListener('lunivo-local-save', scheduleFlush);
  window.addEventListener('lunivo-profiles-save', scheduleFlush);
  window.addEventListener('hashchange', render);
  window.addEventListener('online', requestState);
  window.addEventListener('offline', render);
  window.addEventListener('crm-native-refresh', requestState);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); else requestState(); });
  render();
  requestState();
})();
