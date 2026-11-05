// Browser checks for the responsive UI and the origin-scoped Android message protocol.
// Real alarm/notification behavior is covered separately by Android Robolectric tests.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
    await require('./profile-fixture.cjs').installProfile(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.nativeMessages = [];
      window.failNextSync = false;
      const status = { type: 'status', enabled: false, exact: false, scheduled: 0 };
      window.CrmAndroid = { postMessage(raw) {
        const request = JSON.parse(raw);
        window.nativeMessages.push(request);
        if (request.type === 'sync' && window.failNextSync) {
          window.failNextSync = false;
          queueMicrotask(() => this.onmessage({ data: JSON.stringify({ type: 'error' }) }));
          return;
        }
        if (request.type === 'permission') status.enabled = true;
        if (request.type === 'precision') status.exact = true;
        if (request.type === 'sync') status.scheduled = request.records.filter(r => r.state !== 'Completado').length;
        queueMicrotask(() => this.onmessage({ data: JSON.stringify({ ...status, request: request.type }) }));
      } };
    });
    await page.goto('http://127.0.0.1:8000');
    await page.locator('nav a[href="#ajustes"]').click();await require('./settings-category.cjs').open(page,'notifications');
    await page.locator('#notification-enable').click();
    await page.getByRole('button', { name: 'Hora exacta', exact: true }).click();
    await page.getByRole('button', { name: 'Enviar prueba', exact: true }).click();
    assert.equal(await page.locator('#notification-exact').isVisible(), false);
    assert.ok((await page.evaluate(() => nativeMessages.map(r => r.type))).includes('test'));

    await page.locator('nav a[href="#registro"]').click();
    for (const [name, value] of Object.entries({ client: 'Cliente Samsung', phone: '71234567', model: 'Galaxy', when: '2030-12-01T10:00' })) {
      await page.locator(`#form [name=${name}]`).fill(value);
    }
    // Folding, unfolding, rotation and split-screen must retain the same document and draft.
    for (const [width, height] of [[412,915], [384,832], [440,956], [840,920], [960,840], [915,412], [600,800]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.locator('#form [name=client]').inputValue(), 'Cliente Samsung');
      for (const view of ['#dashboard', '#ajustes', '#agenda', '#listado', '#registro']) {
        await page.locator(`nav a[href="${view}"]`).click();
        await page.locator(view === '#dashboard' ? '#overview' : view).waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px ${view}`);
        if (view === '#agenda' && width >= 760) {
          const calendar = await page.locator('.calendar-pane').boundingBox();
          const detail = await page.locator('.day-pane').boundingBox();
          assert.ok(detail.x > calendar.x + calendar.width, 'unfolded calendar and details must be side by side');
        }
      }
      if (width < 600) {
        const nav = await page.locator('nav').boundingBox();
        assert.ok(nav.y + nav.height <= height + 1, 'bottom navigation must stay within the viewport');
      }
      console.log(`PASS Samsung viewport ${width}×${height}: vistas, navegación, agenda adaptable y borrador`);
    }
    await page.locator('#form [type=submit]').click();
    await page.locator('#items .row').waitFor();
    const lastSync = await page.evaluate(() => nativeMessages.filter(r => r.type === 'sync').at(-1));
    assert.equal(lastSync.records.length, 1);
    assert.equal(lastSync.records[0].at, new Date('2030-12-01T10:00:00-06:00').getTime());
    const id = lastSync.records[0].id;
    await page.evaluate(id => dispatchEvent(new CustomEvent('crm-open-followup', { detail: id })), id);
    await page.locator('#day-items .focused-record').waitFor();
    assert.match(await page.locator('#day-items').textContent(), /Cliente Samsung/);

    // An Android scheduling error must retain the saved contact and expose a retry.
    await page.locator('nav a[href="#listado"]').click();
    await page.evaluate(() => { window.failNextSync = true; });
    await page.locator('#items').getByRole('combobox').selectOption('Completado');
    await page.locator('nav a[href="#ajustes"]').click();await require('./settings-category.cjs').open(page,'notifications');
    await page.getByRole('button', { name: 'Reintentar', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('crm-telefonos-seguimientos-v1'))[0].state), 'Completado');
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    assert.match(await page.locator('#notification-count').textContent(), /^0 recordatorio/);

    // A failed CRM write must never overwrite the native alarm mirror.
    await page.locator('nav a[href="#registro"]').click();
    for (const [name, value] of Object.entries({ client: 'No guardar', phone: '71234567', model: 'Equipo', when: '2030-12-02T10:00' })) {
      await page.locator(`#form [name=${name}]`).fill(value);
    }
    const before = await page.evaluate(() => nativeMessages.filter(r => r.type === 'sync').length);
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
    await page.locator('#form [type=submit]').click();
    assert.match(await page.locator('#notice').textContent(), /No se pudieron guardar/);
    assert.equal(await page.evaluate(() => nativeMessages.filter(r => r.type === 'sync').length), before);
    assert.deepEqual(errors, []);
    console.log('PASS Android bridge: permisos, precisión, prueba, fecha SV, abrir cita, reintento y consistencia ante fallo de almacenamiento');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
