// The sales suite opens its IndexedDB copy asynchronously; navigation helpers wait until it is ready
// so tests can read stored records synchronously with LunivoSuiteStore.peek().
async function suiteReady(page) {
  try {
    await page.waitForFunction(() => !window.LunivoSuiteStore || !document.querySelector('#sales-module') ||
      ['ready', 'error', 'waiting'].includes(document.documentElement.dataset.suiteStorage), null, { timeout: 10000 });
  } catch (error) { if (!/closed|destroyed|navigat/i.test(error.message)) throw error; }
}
function waitForSuite(page) {
  if (page.__suiteReadyWrapped) return;
  page.__suiteReadyWrapped = true;
  for (const name of ['goto', 'reload']) {
    const original = page[name].bind(page);
    page[name] = async (...args) => {
      // Ordinary test navigation follows acknowledged business writes. reload()
      // deliberately does not wait, so interrupted-save recovery stays exercised.
      if (name === 'goto') try { await page.evaluate(async()=>{const store=window.LunivoSuiteStore,account=window.LunivoStore?.account?.();if(store)try{await store.saved('lunivo-suite-preview-v1:'+(account?'account:'+account:'local'));}catch{}}); } catch {}
      const response = await original(...args); await suiteReady(page); return response;
    };
  }
}
exports.suiteReady = suiteReady;
exports.waitForSuite = waitForSuite;
exports.installProfile = async page => { waitForSuite(page); return page.addInitScript(() => {
  if (!localStorage.getItem('lunivo-profiles-local-v1')) {
    localStorage.setItem('lunivo-profiles-local-v1', JSON.stringify([{ id: 'test-user', name: 'Usuario de pruebas', active: true }]));
    localStorage.setItem('lunivo-selected-profile-v1:local', 'test-user');
  }
}); };
