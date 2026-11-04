exports.open = async card => {
  if (await card.evaluate(e => e.tagName === 'DETAILS' && !e.open)) {
    await card.locator(':scope > summary').click();
  }
};
