// Exercise secondary actions through the same disclosures shown to the user.
exports.click = async locator => {
 for(let i=0;i<5;i++){
  const closed=locator.locator('xpath=ancestor::details[not(@open)]').first();
  if(!await closed.count())break;
  await closed.locator(':scope > summary').click();
 }
 await locator.click();
};
