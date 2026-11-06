exports.options = async page => {
  const section = page.locator('#provider-more-filters');
  if (!await section.evaluate(e => e.open)) await section.locator(':scope > summary').click();
};
exports.load = async page => {
  await exports.options(page);
  const section = page.locator('#provider-sources');
  if (!await section.evaluate(e => e.open)) await section.locator('summary').click();
  await page.locator('#catalog-load').click();
};
exports.localInventory = async page => {
  await page.getByRole('link', { name: 'Inventario', exact: true }).click();
  await page.locator('#registered-inventory-link').click();
  await page.locator('#sales-inventory').waitFor();
};
