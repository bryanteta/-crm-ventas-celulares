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
      window.nativeRequests = [];
      window.CrmAndroid = { postMessage(raw) {
        const request = JSON.parse(raw); window.nativeRequests.push(request);
        queueMicrotask(() => {
          if (request.type === 'cloudState') dispatchEvent(new CustomEvent('lunivo-cloud', {
            detail: { type: 'cloudState', configured: false, uid: null, email: '' }
          }));
          else this.onmessage({ data: JSON.stringify({ type: 'status', request: request.type, enabled: true, exact: true, scheduled: 0 }) });
        });
      } };
    });
    await page.clock.install({ time: new Date('2030-11-01T18:00:00Z') });
    await page.goto('http://127.0.0.1:8000');
    assert.equal(await page.locator('#cloud-panel').isVisible(), false);
    assert.equal(await page.locator('#notification-test').isVisible(), false);
    await page.locator('nav a[href="#ajustes"]').click();
    await page.locator('#ajustes').waitFor();
    assert.equal(await page.locator('#cloud-panel').isVisible(), true);
    await require('./settings-category.cjs').open(page,'notifications');await page.getByRole('button', { name: 'Enviar prueba', exact: true }).click();
    assert.ok(await page.evaluate(() => nativeRequests.some(r => r.type === 'test')));
    await require('./settings-category.cjs').open(page,'account');await page.locator('#cloud-open').click();
    await page.locator('#account-dialog').waitFor();
    await page.locator('#account-close').click();
    assert.equal(await page.locator('#primary-action').isVisible(), false);
    await page.locator('nav a[href="#dashboard"]').click();
    await page.locator('#overview').waitFor();
    assert.equal(await page.locator('#cloud-panel').isVisible(), false);
    assert.equal(await page.locator('#notification-panel').isVisible(), false);
    console.log('PASS: cuenta y prueba de notificaciones solo en Ajustes; inicio limpio');

    async function fill(name) {
      await page.locator('nav a[href="#registro"]').click();
      for (const [field, value] of Object.entries({ client: name, phone: '71234567', model: 'Galaxy', when: '2030-11-02T10:00' })) {
        await page.locator(`#form [name=${field}]`).fill(value);
      }
      await page.locator('#form [type=submit]').click();
      await page.locator('#listado').waitFor();
    }
    await fill('Aviso temporal');
    assert.equal(await page.locator('#notice').isVisible(), true);
    await page.clock.fastForward(6000);
    assert.equal(await page.locator('#notice').isVisible(), false);
    assert.equal(await page.locator('#items .row').count(), 1);

    await fill('Segundo aviso');
    await page.clock.fastForward(4000);
    await page.locator('nav a[href="#registro"]').click();
    await page.locator('#form [type=submit]').click();
    assert.equal(await page.locator('#notice').getAttribute('data-tone'), 'error');
    await page.clock.fastForward(2000);
    assert.equal(await page.locator('#notice').isVisible(), true, 'an older timer must not dismiss the new error');
    await page.clock.fastForward(9000);
    assert.equal(await page.locator('#notice').isVisible(), false);

    await page.locator('#form [type=submit]').click();
    await page.getByRole('button', { name: 'Cerrar aviso', exact: true }).click();
    assert.equal(await page.locator('#notice').isVisible(), false);
    assert.equal(await page.evaluate(() => LunivoApp.records().length), 2);
    assert.deepEqual(errors, []);
    console.log('PASS: avisos de éxito 5 s, errores 10 s, cierre manual, renovación del temporizador y datos intactos');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
