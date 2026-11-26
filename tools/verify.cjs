const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const decode=require('jsqr');
const fs=require('fs');
const assert=require('assert/strict');
const base=process.env.TEST_URL || 'http://127.0.0.1:3001';
async function main(){
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const results=[];
 try {
 for(const width of [1440,390,360]){
  const ctx=await browser.newContext({viewport:{width,height:width===1440?1000:844},isMobile:width<600,hasTouch:width<600});
  const p=await ctx.newPage(); const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  const crop='QA harvest '+width+' '+Date.now();
  async function loaded(){await p.locator('#content[aria-busy="false"]').waitFor();}
  async function go(role,view='overview'){await p.goto(base+'/app.html?role='+role+'&view='+view);await loaded();}
  async function click(action){await p.locator('[data-action="'+action+'"]').first().click();}
  async function save(){await p.locator('#save-editor').click();await p.locator('#editor').waitFor({state:'hidden'});}
  async function noOverflow(label){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' overflow at '+width);}
  await go('grower'); await noOverflow('overview');
  await p.screenshot({path:'design/qa-grower-'+width+'.png',fullPage:true});
  await click('edit-lot');
  for(const [name,value] of Object.entries({crop,quantity:'100',price:'40',grade:'A',harvest:'2026-11-26',pickup:'Tomorrow 9–11 am',notes:'Isolated browser QA lot. Crates included.'}))await p.locator('#fields [name="'+name+'"]').fill(value);
  await noOverflow('listing form');
  await p.locator('#fields [name="notes"]').focus();
  await save(); await p.getByRole('heading',{name:crop,exact:true}).waitFor();
  await click('quality'); await p.getByText('Sample check passed (simulated)',{exact:true}).waitFor();
  const lotId=new URL(p.url()).searchParams.get('detail');
  await go('buyer','catalogue');
  await p.locator('[name="search"]').fill(crop);
  await p.locator('#lot-grid .lot-card').waitFor(); assert.equal(await p.locator('#lot-grid .lot-card').count(),1);
  await noOverflow('catalogue filters');await click('lot');await noOverflow('lot details');await click('new-offer');
  await p.locator('#fields [name="quantity"]').fill('25');await p.locator('#fields [name="price"]').fill('35');
  await p.locator('#fields [name="message"]').fill('Can you pack in reusable crates?');await save();
  const offerId=new URL(p.url()).searchParams.get('detail');
  await p.locator('#message-form [name="message"]').fill('We can collect tomorrow morning.');await p.locator('#message-form button').click();
  await p.getByText('Message sent.',{exact:true}).waitFor();
  await p.goto(base+'/app.html?role=grower&view=offers&type=offer&detail='+offerId);await loaded();
  await p.getByText('Can you pack in reusable crates?',{exact:true}).waitFor();
  await p.locator('#message-form [name="message"]').fill('Yes, crates are included.');await p.locator('#message-form button').click();await p.getByText('Message sent.',{exact:true}).waitFor();
  await click('counter');await p.locator('#fields [name="price"]').fill('38');await save();
  await p.goto(base+'/app.html?role=buyer&view=offers&type=offer&detail='+offerId);await loaded();
  await p.getByText('Yes, crates are included.',{exact:true}).waitFor();await click('counter');await p.locator('#fields [name="price"]').fill('37');await save();
  await p.goto(base+'/app.html?role=grower&view=offers&type=offer&detail='+offerId);await loaded();await click('accept');
  await p.locator('.trace-panel').waitFor();const orderId=new URL(p.url()).searchParams.get('detail');
  await p.reload();await loaded();await p.getByText('₹925',{exact:true}).waitFor();await noOverflow('order');
  for(const step of ['Packed','Ready for pickup','Picked up','Delivered']){await click('status');await p.locator('#milestone-note').filter({hasText:'Current status: '+step+'.'}).waitFor();}
  await p.evaluate(()=>scrollTo(0,0));
  await p.screenshot({path:'design/qa-order-'+width+'.png',fullPage:true});
  await p.goto(base+'/app.html?role=buyer&view=orders&type=order&detail='+orderId);await loaded();await click('payment');await p.getByText('Paid (simulated)',{exact:true}).waitFor();
  await p.reload();await loaded();await p.getByText('Paid (simulated)',{exact:true}).waitFor();
  const qr=await p.request.get(base+'/api/qr/'+orderId);assert.equal(qr.status(),200);
  const png=PNG.sync.read(await qr.body()); const code=decode(new Uint8ClampedArray(png.data),png.width,png.height);assert(code);assert.equal(code.data,base+'/app.html?batch='+orderId);
  await p.goto(code.data);await loaded();await p.getByText('Paid (simulated)',{exact:true}).waitFor();assert.equal(await p.locator('[data-action="payment"]').count(),0);await noOverflow('QR record');
  const db=await (await p.request.get(base+'/api/state')).json();
  assert.equal(db.listings.find(l=>l.id===lotId).quantity,75);assert.equal(db.orders.find(o=>o.id===orderId).timeline.length,6);assert(!('ledger' in db));
  await go('buyer');await noOverflow('buyer overview');await p.screenshot({path:'design/qa-buyer-'+width+'.png',fullPage:true});
  await go('grower','market');await noOverflow('market');
  await go('grower','history');await noOverflow('trade history');
  if(width<600){await p.locator('#mobile-nav [data-nav="offers"]').click();await p.getByRole('heading',{name:'Incoming offers',exact:true}).waitFor();assert.equal(await p.locator('#mobile-nav [aria-current="page"]').getAttribute('data-nav'),'offers');
   await p.locator('[data-action="offer-detail"]').first().click();await p.locator('#message-form input').focus();await p.setViewportSize({width,height:440});await noOverflow('keyboard viewport');assert(await p.locator('#message-form input').isVisible());await p.setViewportSize({width,height:844});}
  assert.deepEqual(errors,[]); results.push({width,lotId,offerId,orderId,qrDecoded:true,payment:'Paid (simulated)',delivery:'Delivered',remainingKg:75,consoleErrors:errors});
  await ctx.close(); console.log('PASS '+width+'px complete trade');
 }
 fs.writeFileSync('design/verification-results.json',JSON.stringify(results,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
