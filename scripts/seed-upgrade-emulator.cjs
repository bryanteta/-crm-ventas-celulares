// Destructive only to the synthetic fixture in a dedicated emulator; never a physical phone.
const { _android } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const devices = await _android.devices({ omitDriverInstall: true });
  const device = devices.find(d => d.serial() === (process.env.LUNIVO_ANDROID_SERIAL || 'emulator-5554'));
  assert.ok(device && device.serial().startsWith('emulator-'), 'A dedicated emulator is required');
  device.setDefaultTimeout(120000);
  try {
    const info = (await device.shell('cmd package list packages --show-versioncode com.crmcelulares.app')).toString();
    assert.match(info, /package:com\.crmcelulares\.app versionCode:5\b/, 'Install the original 0.4.0 APK first');
    const webView = await device.webView({ pkg: 'com.crmcelulares.app' });
    const page = await webView.page();
    await page.waitForFunction(() => !!window.LunivoApp && !!window.LunivoStore);
    const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../tests/fixtures/upgrade-records.json'), 'utf8'));
    await page.evaluate(records => {
      if (LunivoStore.account() !== null || LunivoApp.records().some(r => !r.id.startsWith('upgrade-'))) {
        throw new Error('Refusing to replace non-fixture app data');
      }
      LunivoStore.save(records);
      LunivoApp.reload();
    }, fixture);
    await page.reload();
    await page.waitForFunction(() => window.LunivoApp && LunivoApp.records().length === 3);
    assert.deepEqual(await page.evaluate(() => LunivoApp.records()), fixture);
    console.log('Original 0.4.0 APK seeded and reloaded: 3 synthetic records, all fields intact.');
  } finally {
    for (const d of devices) await d.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
