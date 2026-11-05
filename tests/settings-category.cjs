exports.open = async (page, category) => {
  if (!await page.locator('#ajustes').isVisible()) await page.goto('http://127.0.0.1:8000/#ajustes');
  await page.locator('[data-settings-tab="'+category+'"]').click();
};
