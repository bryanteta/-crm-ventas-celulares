'use strict';
// Public UI regressions exercise the automatic catalog. Admin edits are tested
// separately against the real Worker so a live shop edit cannot change fixtures.
const installed=new WeakSet();
async function withoutCustomizations(page){if(installed.has(page))return;installed.add(page);await page.route('**/customizations.json',r=>r.fulfill({json:{version:1,revision:0,updatedAt:null,overrides:{}}}));}
module.exports={withoutCustomizations};
