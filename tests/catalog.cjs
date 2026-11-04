exports.load = async page => {
  const section = page.locator('#provider-sources');
  if (!await section.evaluate(e => e.open)) await section.locator('summary').click();
  await page.locator('#catalog-load').click();
};
