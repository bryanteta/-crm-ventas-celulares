// UI -> Android message protocol -> official Firestore emulator.
// Authentication is simulated here; production Firebase Auth requires the live project.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, collection, onSnapshot, setDoc, runTransaction, serverTimestamp, disableNetwork, enableNetwork } = require('firebase/firestore');

(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-lunivo', firestore: {
    host: '127.0.0.1', port: 8787, rules: fs.readFileSync('firestore.rules', 'utf8')
  } });
  await env.clearFirestore();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const allErrors = [];
  const clients = [];
  try {
    async function client(width, height) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      page.on('pageerror', error => allErrors.push(error.message));
      let uid = null, db, snapshot;
      let unsubscribers = [];
      let profileSnapshot;
      let deviceEnabled = true;
      const writeOperations = [];
      const activeWrites = new Set();
      async function emit(event) {
        if (!page.isClosed()) await page.evaluate(detail => dispatchEvent(new CustomEvent('lunivo-cloud', { detail })), event);
      }
      const state = () => ({ type: 'cloudState', configured: true, uid, email: uid ? `${uid}@example.test` : '' });
      async function startSession(email) {
        uid = email.split('@')[0];
        unsubscribers.forEach(stop => stop()); unsubscribers = [];
        db = env.authenticatedContext(uid).firestore();
        await emit(state());
        for (const target of ['followups','profiles']) unsubscribers.push(onSnapshot(collection(db, 'users', uid, target), { includeMetadataChanges: true }, result => {
          const event = { type: target === 'profiles' ? 'cloudProfilesSnapshot' : 'cloudSnapshot', uid, fromCache: result.metadata.fromCache,
            documents: result.docs.map(d => ({ ...d.data(), committed: !result.metadata.fromCache && !d.metadata.hasPendingWrites })) };
          if (target === 'profiles') profileSnapshot = event; else snapshot = event;
          emit(event).catch(() => {});
        }));
      }
      await page.exposeFunction('nativeMessage', async request => {
        if (request.type === 'cloudState') {
          await emit(state()); if (snapshot && snapshot.uid === uid) await emit(snapshot);
          if (profileSnapshot && profileSnapshot.uid === uid) await emit(profileSnapshot);
        } else if (request.type === 'cloudSignIn' || request.type === 'cloudRegister') {
          await startSession(request.email);
        } else if (request.type === 'cloudSignOut') {
          unsubscribers.forEach(stop => stop()); unsubscribers = []; uid = null; snapshot = null; profileSnapshot = null; await emit(state());
        } else if (request.type === 'cloudResetPassword') {
          await emit({ type: 'cloudMessage', message: 'Si el correo corresponde a una cuenta, recibirás instrucciones para recuperar el acceso.' });
        } else if (request.type === 'cloudFlush' || request.type === 'cloudProfilesFlush') {
          assert.equal(request.uid, uid);
          for (const op of request.operations) {
            if (activeWrites.has(op.revision)) continue;
            activeWrites.add(op.revision);
            const document = doc(db, 'users', uid, request.type === 'cloudProfilesFlush' ? 'profiles' : 'followups', Buffer.from(op.id).toString('base64url'));
            const value = { id: op.id, revision: op.revision, deleted: op.deleted, updatedAt: serverTimestamp() };
            if (!op.deleted) value.record = op.record;
            writeOperations.push({ type: request.type, id: op.id, revision: op.revision });
            const writing = op.importing ? runTransaction(db, async tx => {
              const old = await tx.get(document);
              if (old.exists()) return { ...old.data(), committed: true };
              tx.set(document, value);
            }) : setDoc(document, value);
            const writeUid = uid;
            writing.then(existing => {
              activeWrites.delete(op.revision);
              return emit({ type: request.type === 'cloudProfilesFlush' ? 'cloudProfilesAck' : 'cloudAck', uid: writeUid, id: op.id, revision: op.revision, ...(existing ? { existing } : {}) });
            }).catch(error => { if (!page.isClosed()) allErrors.push(error.message); });
          }
        } else {
          if (request.type === 'deviceReminders') deviceEnabled = request.enabled;
          await page.evaluate(response => window.CrmAndroid.onmessage({ data: JSON.stringify(response) }), {
            type: 'status', request: request.type, enabled: true, exact: true, deviceEnabled, scheduled: 0
          });
        }
      });
      await page.addInitScript(() => {
        window.CrmAndroid = { postMessage(raw) { window.nativeMessage(JSON.parse(raw)).catch(() => {}); } };
      });
      await page.goto('http://127.0.0.1:8000');
      const result = { page, context, writeOperations, stop: () => { unsubscribers.forEach(stop => stop()); unsubscribers = []; },
        offline: async enabled => {
          await (enabled ? disableNetwork(db) : enableNetwork(db));
          await page.evaluate(enabled => {
            Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => !enabled });
            dispatchEvent(new Event(enabled ? 'offline' : 'online'));
          }, enabled);
        } };
      clients.push(result); return result;
    }
    async function login(client, email, importing = false) {
      const p = client.page;
      await p.locator('nav a[href="#ajustes"]').click();
      await p.locator('#cloud-open').click();
      await p.locator('#account-email').fill(email);
      await p.locator('#account-password').fill('emulator-password');
      await p.locator('#account-import').setChecked(importing);
      await p.locator('#account-signin').click();
      await p.locator('#account-connected').waitFor();
      await p.locator('#account-close').click();
    }
    async function chooseUser(client, name = 'Asesor de pruebas') {
      const p = client.page;
      if (await p.evaluate(() => Boolean(LunivoProfileUI.current()))) return;
      await p.locator('nav a[href="#ajustes"]').click();
      if (!await p.locator('#profile-current option[value]:not([value=""])').count()) {
        await p.locator('#profile-name').fill(name);
        await p.locator('#profile-save').click();
      }
      const value = await p.locator('#profile-current option:not([value=""])').first().getAttribute('value');
      await p.locator('#profile-current').selectOption(value);
    }
    async function add(client, name) {
      const p = client.page;
      await chooseUser(client);
      await p.locator('nav a[href="#registro"]').click();
      for (const [field, value] of Object.entries({ client: name, phone: '71234567', model: 'Galaxy', when: '2030-12-01T10:00' })) {
        await p.locator(`#form [name=${field}]`).fill(value);
      }
      await p.locator('#form [type=submit]').click();
      await p.locator('#items .row').filter({ hasText: name }).waitFor();
    }
    const a = await client(412, 915), b = await client(840, 920);
    await add(a, 'Contacto anterior');
    await login(a, 'alice@example.test', true);
    await a.page.waitForFunction(() => LunivoStore.pending().length === 0);
    await login(b, 'alice@example.test');
    await b.page.locator('nav a[href="#listado"]').click();
    await b.page.locator('#items .row').filter({ hasText: 'Contacto anterior' }).waitFor();
    console.log('PASS: importación explícita y descarga en una segunda sesión de la misma cuenta');

    await b.offline(true);
    await b.page.locator('#items').getByRole('button', { name: 'Editar', exact: true }).click();
    await b.page.locator('#form [name=model]').fill('Editado sin conexión');
    await b.page.locator('#form [type=submit]').click();
    assert.equal(await b.page.evaluate(() => LunivoStore.pending().length), 1);
    await b.page.reload();
    await b.page.locator('#items .row').filter({ hasText: 'Editado sin conexión' }).waitFor();
    await b.offline(false);
    await b.page.waitForFunction(() => LunivoStore.pending().length === 0);
    await a.page.locator('nav a[href="#listado"]').click();
    await a.page.locator('#items .row').filter({ hasText: 'Editado sin conexión' }).waitFor();
    console.log('PASS: edición sin conexión, recarga y reenvío persistente al reconectar');

    await b.offline(true);
    a.page.once('dialog', d => d.accept());
    await a.page.locator('#items').getByRole('button', { name: 'Eliminar', exact: true }).click();
    await a.page.waitForFunction(() => LunivoStore.pending().length === 0);
    await b.offline(false);
    await b.page.waitForFunction(() => LunivoApp.records().length === 0);
    await add(a, 'Solo Alice');
    await b.page.waitForFunction(() => LunivoApp.records().some(r => r.client === 'Solo Alice'));
    console.log('PASS: una eliminación se propaga al reconectar sin resucitar el contacto');

    await a.page.locator('#items').getByRole('button', { name: 'Editar', exact: true }).click();
    await a.page.locator('#form [name=client]').fill('Borrador conservado');
    b.page.once('dialog', d => d.accept());
    await b.page.locator('#items').getByRole('button', { name: 'Eliminar', exact: true }).click();
    await a.page.getByRole('button', { name: 'Guardar como nuevo', exact: true }).waitFor();
    assert.equal(await a.page.locator('#form [name=client]').inputValue(), 'Borrador conservado');
    await a.page.locator('#form [type=submit]').click();
    await b.page.waitForFunction(() => LunivoApp.records().some(r => r.client === 'Borrador conservado'));
    console.log('PASS: una eliminación remota conserva el borrador y permite guardarlo con un nuevo identificador');

    await b.page.locator('nav a[href="#ajustes"]').click();
    await b.page.locator('#cloud-open').click();
    await b.page.locator('#account-reminders').uncheck();
    await b.page.locator('#account-signout').click();
    await b.page.locator('#account-form').waitFor();
    await b.page.locator('#account-close').click();
    await login(b, 'bob@example.test');
    assert.equal(await b.page.evaluate(() => LunivoApp.records().length), 0);
    assert.equal(await a.page.evaluate(() => LunivoApp.records()[0].client), 'Borrador conservado');
    await b.page.locator('#cloud-open').click();
    assert.equal(await b.page.locator('#account-reminders').isChecked(), false);
    await b.page.locator('#account-close').click();
    await b.page.setViewportSize({ width: 384, height: 832 });
    assert.equal(await b.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await add(b, 'Privado Bob');
    await b.page.waitForFunction(() => LunivoStore.pending().length === 0);
    await b.page.locator('nav a[href="#ajustes"]').click();
    await b.page.locator('#cloud-open').click();
    await b.page.evaluate(() => {
      window.originalRemove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    });
    await b.page.locator('#account-signout').click();
    await b.page.waitForFunction(() => LunivoApp.records().length === 0 && !LunivoSyncCanSave());
    assert.equal(await b.page.evaluate(() => JSON.parse(localStorage.getItem('lunivo-account-v1:bob')).records[0].client), 'Privado Bob');
    await b.page.evaluate(() => { Storage.prototype.removeItem = window.originalRemove; dispatchEvent(new Event('crm-native-refresh')); });
    await b.page.waitForFunction(() => LunivoStore.account() === null);
    // Profiles and authors cross the same real emulator boundary as followups.
    const c = await client(412, 915), d = await client(840, 920);
    await login(c, 'team@example.test');
    await chooseUser(c, 'Ana');
    await c.page.waitForFunction(() => LunivoProfiles.pending().length === 0);
    const anaId = await c.page.evaluate(() => LunivoProfileUI.current().id);
    await login(d, 'team@example.test');
    await d.page.waitForFunction(() => LunivoProfiles.records().some(p => p.name === 'Ana'));
    await d.page.locator('#profile-name').fill('Bruno'); await d.page.locator('#profile-save').click();
    await d.page.waitForFunction(() => LunivoProfiles.pending().length === 0);
    await c.page.waitForFunction(() => LunivoProfiles.records().some(p => p.name === 'Bruno'));
    const brunoId = await d.page.evaluate(() => LunivoProfiles.records().find(p => p.name === 'Bruno').id);
    await d.page.locator('#profile-current').selectOption(brunoId);
    assert.equal(await c.page.evaluate(() => LunivoProfileUI.current().id), anaId);
    await add(d, 'Creado por Bruno');
    await c.page.waitForFunction(() => LunivoApp.records().some(r => r.client === 'Creado por Bruno' && r.createdByName === 'Bruno'));
    const createdAt = await c.page.evaluate(() => LunivoApp.records()[0].createdAt);
    await c.page.locator('nav a[href="#listado"]').click();
    await c.page.locator('#items').getByRole('button', { name: 'Editar', exact: true }).click();
    await c.page.locator('#form [name=notes]').fill('Actualizado desde el teléfono de Ana');
    await c.page.locator('#form [type=submit]').click();
    await d.page.waitForFunction(() => LunivoApp.records()[0].notes === 'Actualizado desde el teléfono de Ana');
    assert.equal(await d.page.evaluate(() => LunivoApp.records()[0].createdById), brunoId);
    assert.equal(await d.page.evaluate(() => LunivoApp.records()[0].createdAt), createdAt);
    await c.page.locator('nav a[href="#ajustes"]').click();
    await c.page.getByRole('button', { name: 'Editar nombre de Bruno', exact: true }).click();
    await c.page.locator('#profile-name').fill('Bruno Martínez'); await c.page.locator('#profile-save').click();
    await d.page.waitForFunction(() => LunivoProfileUI.current()?.name === 'Bruno Martínez');
    assert.equal(await d.page.evaluate(() => LunivoApp.records()[0].createdByName), 'Bruno');
    await d.offline(true);
    await d.page.locator('nav a[href="#ajustes"]').click();
    await d.page.getByRole('button', { name: 'Editar nombre de Bruno Martínez', exact: true }).click();
    await d.page.locator('#profile-name').fill('Bruno López'); await d.page.locator('#profile-save').click();
    assert.equal(await d.page.evaluate(() => LunivoProfiles.pending().length), 1);
    await d.page.reload();
    await d.page.waitForFunction(() => LunivoProfileUI.current()?.name === 'Bruno López');
    await d.offline(false);
    await c.page.waitForFunction(() => LunivoProfiles.records().some(p => p.name === 'Bruno López'));
    await c.page.getByRole('button', { name: 'Desactivar a Bruno López', exact: true }).click();
    await d.page.waitForFunction(() => LunivoProfileUI.current() === null);
    assert.equal(await d.page.locator('#profile-current').inputValue(), '');
    assert.equal(await c.page.evaluate(() => LunivoProfileUI.current().id), anaId);
    await c.page.getByRole('button', { name: 'Reactivar a Bruno López', exact: true }).click();
    await d.page.waitForFunction(() => LunivoProfiles.records().some(p => p.name === 'Bruno López' && p.active));
    await d.page.locator('#profile-current').selectOption(brunoId);
    await add(d, 'Bruno después de renombrar');
    await c.page.waitForFunction(() => LunivoApp.records().some(r => r.client === 'Bruno después de renombrar' && r.createdByName === 'Bruno López'));
    await c.page.waitForFunction(() => LunivoStore.pending().length === 0 && LunivoProfiles.pending().length === 0);
    const beforeBurst = c.writeOperations.length;
    await c.page.evaluate(() => {
      for (let i = 0; i < 20; i++) {
        const rows = LunivoStore.records(); rows[0].notes = 'Edición rápida ' + i;
        LunivoStore.save(rows); dispatchEvent(new Event('lunivo-local-save'));
      }
    });
    await c.page.waitForFunction(() => LunivoStore.pending().length === 0);
    assert.equal(c.writeOperations.length - beforeBurst, 1, '20 rapid edits should submit only the final revision');
    await d.page.waitForFunction(() => LunivoApp.records().some(r => r.notes === 'Edición rápida 19'));
    await c.offline(true);
    const beforeOffline = c.writeOperations.length;
    await c.page.evaluate(() => {
      for (let i = 0; i < 30; i++) {
        const rows = LunivoStore.records(); rows[0].notes = 'Edición offline ' + i;
        LunivoStore.save(rows); dispatchEvent(new Event('lunivo-local-save'));
      }
      const id = LunivoProfileUI.current().id;
      for (let i = 0; i < 10; i++) {
        const profiles = LunivoProfiles.records().map(p => p.id === id ? { ...p, name: 'Ana ahorro ' + i } : p);
        LunivoProfiles.save(profiles); dispatchEvent(new Event('lunivo-profiles-save'));
      }
    });
    await c.page.reload();
    await c.page.waitForTimeout(1000);
    assert.equal(c.writeOperations.length, beforeOffline, 'offline edits and reload must not submit intermediate revisions');
    await c.offline(false);
    await c.page.waitForFunction(() => LunivoStore.pending().length === 0 && LunivoProfiles.pending().length === 0);
    assert.equal(c.writeOperations.length - beforeOffline, 2, '30 followup edits and 10 profile edits offline should submit only two final documents');
    await d.page.waitForFunction(() => LunivoApp.records().some(r => r.notes === 'Edición offline 29') && LunivoProfiles.records().some(p => p.name === 'Ana ahorro 9'));
    console.log('PASS ahorro medido en llamadas al SDK del emulador: 20 ediciones rápidas → 1 escritura; 30 ediciones de seguimiento + 10 de perfil offline y recarga → 2 escrituras al reconectar');
    // Only Lunivo is exposed; existing records from transitional releases remain editable.
    await add(c, 'Nuevo Lunivo');
    await c.page.waitForFunction(() => LunivoStore.pending().length === 0);
    const single = await c.page.evaluate(()=>LunivoApp.records().find(r=>r.client==='Nuevo Lunivo'));
    assert.equal(Object.hasOwn(single,'brand'),false);
    await d.page.waitForFunction(()=>LunivoApp.records().some(r=>r.client==='Nuevo Lunivo'));
    assert.equal(await d.page.locator('#items .row').filter({hasText:'Nuevo Lunivo'}).count(),1);
    await c.page.evaluate(()=>{
      const rows=LunivoStore.records();const base=rows.find(r=>r.client==='Nuevo Lunivo');
      LunivoStore.save([...rows,{...base,id:'transition-history',client:'Historial conservado',brand:'Split'}]);
      LunivoApp.reload();dispatchEvent(new Event('lunivo-local-save'));
    });
    await d.page.waitForFunction(()=>LunivoApp.records().some(r=>r.id==='transition-history'));
    const history=d.page.locator('#items .row').filter({hasText:'Historial conservado'});
    assert.equal(await history.count(),1);
    await history.getByRole('button',{name:'Editar',exact:true}).click();
    await d.page.locator('#form [name=notes]').fill('Historial editado sin perder metadatos');
    await d.page.locator('#form [type=submit]').click();
    await c.page.waitForFunction(()=>LunivoApp.records().some(r=>r.id==='transition-history'&&r.notes==='Historial editado sin perder metadatos'&&r.brand==='Split'));
    assert.equal(await c.page.locator('#form [name=brand],#brand-filter,[data-brand-target]').count(),0);
    assert.equal(await d.page.locator('#form [name=brand],#brand-filter,[data-brand-target]').count(),0);
    console.log('PASS solo Lunivo: registros nuevos compatibles sin campo de marca, historial de versiones intermedias visible y editable sin perder autor/metadatos, sincronización entre dos sesiones');
    await d.page.locator('nav a[href="#ajustes"]').click(); await d.page.locator('#cloud-open').click();
    await d.page.locator('#account-signout').click(); await d.page.locator('#account-form').waitFor(); await d.page.locator('#account-close').click();
    await login(d, 'other@example.test');
    await d.page.waitForFunction(() => LunivoProfiles.records().length === 0);
    assert.equal(await d.page.evaluate(() => LunivoProfileUI.current()), null);
    assert.equal(await d.page.evaluate(() => LunivoApp.records().length), 0);
    console.log('PASS: usuarios compartidos, selección independiente por teléfono, autor conservado al editar y renombrar, cambio de nombre offline con recarga, desactivar/reactivar remoto y aislamiento entre cuentas');
    assert.deepEqual(allErrors, []);
    console.log('PASS: aislamiento de cuentas y elección local del teléfono que recibe recordatorios');
    console.log('PASS: un fallo de almacenamiento al cerrar sesión oculta los datos privados y conserva la caché');
  } finally {
    for (const c of clients) c.stop();
    await browser.close();
    await env.cleanup();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
