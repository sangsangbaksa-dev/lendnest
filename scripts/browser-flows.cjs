const assert=require('node:assert/strict'),fs=require('node:fs');
module.exports=async function(page,base){
 await page.addInitScript(()=>localStorage.setItem('lendnest.licence',JSON.stringify({key:'LOCAL-TEST-0000',checked:Date.now()})));
 await page.goto(base+'/app/');
 await page.evaluate(()=>{
  const C=window.LN,s=C.newState(),p=C.addPerson(s,'Mina');
  s.settings.lang='en';
  s.entries=[C.makeEntry({title:'Today drill',personId:p.id,due:C.today()}),C.makeEntry({title:'Undated book',personId:p.id})];
  localStorage.setItem('lendnest.v1',JSON.stringify(s));
 });
 await page.reload();await page.waitForSelector('#f-due');
 assert.equal(await page.locator('.result-tools [role=status]').textContent(),'2 of 2 entries match');
 await page.selectOption('#f-due','today');
 assert.equal(await page.locator('.result-tools [role=status]').textContent(),'1 of 2 entries match');
 const dl=page.waitForEvent('download');await page.click('#export-results');
 const file=await dl, csv=fs.readFileSync(await file.path(),'utf8');
 assert.ok(csv.includes('Today drill'));assert.ok(!csv.includes('Undated book'));
 await page.click('#reset-filters');assert.equal(await page.locator('#f-due').inputValue(),'all');
 await page.selectOption('#f-due','none');
 assert.equal(await page.locator('.result-tools [role=status]').textContent(),'1 of 2 entries match');
 await page.screenshot({path:require('node:path').join(__dirname,'../artifacts/browser/filtered-results-mobile.png'),fullPage:true});
};
