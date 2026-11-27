const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const decode=require('jsqr');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
(async()=>{
 const test=await require('./clerk-fixtures.cjs')({reactFixtures:true}),base=test.base;
 const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
 try{for(const width of [1440,390,360]){
  const errors=[],suffix=width+'-'+Date.now(),crop='Ruby bell peppers '+width;
  const person=async(role,label)=>{const context=await browser.newContext({viewport:{width,height:width===1440?950:844},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page,role,name:label,email:role+suffix+'@example.test',organization:(role==='grower'?'Valley Farm ':'Fresh Market ')+width};};
  const grower=await person('grower','Maya Test'),buyer=await person('buyer','Arjun Test');
  const loaded=async p=>{await p.locator('.app-shell').waitFor();await p.evaluate(()=>document.fonts.ready);assert(await p.evaluate(()=>document.fonts.check('14px Montreal')),'Montreal must load from local server');};
  const go=async(p,view='overview',type,id)=>{await p.page.goto(base+'/'+p.role+'?view='+view+(type?'&type='+type+'&detail='+id:''));await loaded(p.page);};
  const noOverflow=async(p,label)=>{assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' document overflow '+width);const el=p.locator('#content');if(await el.count())assert(await el.evaluate(e=>e.scrollWidth<=e.clientWidth+1),label+' content overflow '+width);};
  const state=async p=>{const r=await p.context.request.get(base+'/api/state');assert.equal(r.status(),200);return r.json();};
  const action=(p,data)=>p.context.request.post(base+'/api/action',{headers:{Origin:base},data});
  async function register(p){p.token=test.tokenFor(p);await p.context.setExtraHTTPHeaders({Authorization:'Bearer '+p.token});await p.page.goto(base+'/login?portal='+p.role);assert.equal(await p.page.locator('[name=organization]').count(),0);await p.page.evaluate(t=>localStorage.setItem('qa_clerk_token',t),p.token);await p.page.goto(base+'/login?portal='+p.role);await p.page.waitForURL('**/onboarding**');await p.page.locator('#profile-form').waitFor();await noOverflow(p.page,'setup');await p.page.screenshot({path:'design/qa-react-setup-'+p.role+'-'+width+'.png'});await p.page.locator('[name=organization]').fill(p.organization);await p.page.locator('[name=location]').fill('Nashik');await p.page.locator('#profile-submit').click();await p.page.waitForURL('**/'+p.role);await loaded(p.page);assert.equal(await p.page.locator('.app-shell').getAttribute('data-portal'),p.role);}
  await grower.page.goto(base+'/grower');await grower.page.waitForURL('**/login**');
  await register(grower);await register(buyer);
  for(const p of [grower,buyer]){await noOverflow(p.page,'home');const box=await p.page.locator('.app-shell').boundingBox();assert.equal(box.x,0);assert.equal(box.y,0);assert.equal(box.width,width);await p.page.screenshot({path:'design/qa-react-'+p.role+'-'+width+'.png'});if(width===1440){const a=await p.page.locator('#account-button').boundingBox();assert(a.y>500&&a.x<204,'account must be bottom-left');}}
  const gp=grower.page,bp=buyer.page,initial=await state(grower),farm=initial.farms.find(f=>f.owned).id;
  await gp.locator('[data-action=edit-lot]').click();await gp.getByRole('dialog').waitFor();
  for(const [name,value]of Object.entries({crop,quantity:'100',price:'40',grade:'A',harvest:'2026-11-27',pickup:'Tomorrow 9–11 am',notes:'Crates included. Isolated test.'}))await gp.locator('#fields [name='+name+']').fill(value);
  await noOverflow(gp,'listing form');if(width<600){await gp.setViewportSize({width,height:440});await gp.waitForFunction(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-height'))<450);const box=await gp.getByRole('dialog').boundingBox();assert(box.y>=0&&box.y+box.height<=441,'listing dialog must fit above keyboard');await gp.setViewportSize({width,height:844});}await gp.locator('#save-editor').click();await gp.getByRole('dialog').waitFor({state:'hidden'});await gp.getByRole('heading',{name:crop,exact:true}).waitFor();const lot=new URL(gp.url()).searchParams.get('detail');
  await gp.locator('[data-action=quality]').click();await gp.getByText('Sample check passed (simulated)',{exact:true}).waitFor();
  await go(buyer,'catalogue');await bp.locator('[name=search]').fill(crop);await bp.locator('#lot-grid .lot-card').waitFor();assert.equal(await bp.locator('#lot-grid .lot-card').count(),1);await noOverflow(bp,'catalogue');
  await bp.getByRole('button',{name:'Filters',exact:false}).click();await bp.locator('#filter-max').fill('39');await bp.getByRole('button',{name:'Show 0 lots'}).waitFor();await bp.locator('#filter-max').fill('45');await bp.getByRole('button',{name:'Show 1 lots'}).click();
  await bp.locator('[data-action=lot]').click();await bp.locator('[data-action=new-offer]').click();await bp.locator('#fields [name=quantity]').fill('25');await bp.locator('#fields [name=price]').fill('35');await bp.locator('.offer-total strong').filter({hasText:'₹875'}).waitFor();await bp.locator('#fields [name=quantity]').fill('30');await bp.locator('.offer-total strong').filter({hasText:'₹1,050'}).waitFor();await bp.locator('#fields [name=quantity]').fill('25');await bp.screenshot({path:'design/qa-refined-offer-'+width+'.png'});await bp.locator('#fields [name=message]').fill('Can you include crates?');await bp.locator('#save-editor').click();await bp.getByRole('dialog').waitFor({state:'hidden'});const offer=new URL(bp.url()).searchParams.get('detail');
  await gp.locator('#app-nav [data-nav=offers] small').waitFor({state:'attached',timeout:12000});assert.equal(await gp.locator('#app-nav [data-nav=offers] small').innerText(),'1','offer must reach grower UI without reloading');
  async function message(p,text){await p.locator('#message-form input').fill(text);await p.locator('#message-form button').click();await p.getByText(text,{exact:true}).waitFor();}
  await message(bp,'We will collect tomorrow.');await go(grower,'offers','offer',offer);await gp.getByText('Can you include crates?',{exact:true}).waitFor();await message(gp,'Yes, crates are included.');
  await gp.locator('[data-action=counter]').click();await gp.locator('#fields [name=price]').fill('38');await gp.locator('#save-editor').click();await gp.getByRole('dialog').waitFor({state:'hidden'});
  await go(buyer,'offers','offer',offer);await bp.getByText('Yes, crates are included.',{exact:true}).waitFor();await bp.locator('[data-action=counter]').click();await bp.locator('#fields [name=price]').fill('37');await bp.locator('#save-editor').click();await bp.getByRole('dialog').waitFor({state:'hidden'});
  await go(grower,'offers','offer',offer);await gp.locator('[data-action=accept]').click();await gp.locator('.trace-panel').waitFor();const order=new URL(gp.url()).searchParams.get('detail');await gp.reload();await loaded(gp);await gp.getByText('₹925',{exact:true}).waitFor();
  for(const step of ['Packed','Ready for pickup','Picked up','Delivered']){await gp.locator('[data-action=status]').click();await gp.locator('#milestone-note').filter({hasText:'Current status: '+step+'.'}).waitFor();}
  await go(buyer,'orders','order',order);await bp.locator('[data-action=payment]').click();await bp.getByText('Paid (simulated)',{exact:true}).first().waitFor();await bp.reload();await loaded(bp);await noOverflow(bp,'order');await bp.screenshot({path:'design/qa-react-order-'+width+'.png'});
  const qr=await buyer.context.request.get(base+'/api/qr/'+order);assert.equal(qr.status(),200);const png=PNG.sync.read(await qr.body()),code=decode(new Uint8ClampedArray(png.data),png.width,png.height);assert.equal(code.data,base+'/app.html?batch='+order);
  const outsider=await browser.newContext({viewport:{width,height:844}}),publicApi=outsider.request;assert.equal((await publicApi.get(base+'/api/state')).status(),401);const trace=await(await publicApi.get(base+'/api/trace/'+order)).json();assert.equal(trace.orders[0].payment,'Paid (simulated)');assert(!trace.orders[0].buyer);assert.equal(trace.offers.length,0);const tracePage=await outsider.newPage();tracePage.on('pageerror',e=>errors.push(e.message));await tracePage.goto(code.data);await tracePage.locator('.trace-panel').waitFor();assert.equal(await tracePage.locator('[data-action=payment]').count(),0);
  for(const role of ['buyer','grower']){const token=test.tokenFor({email:'other-'+role+suffix+'@example.test',name:'Other'});await outsider.setExtraHTTPHeaders({Authorization:'Bearer '+token});assert.equal((await publicApi.post(base+'/api/profile',{headers:{Origin:base},data:{role,organization:'Other',location:'Pune'}})).status(),200);const d=await(await publicApi.get(base+'/api/state')).json();assert.equal(d.offers.length,0);assert.equal(d.orders.length,0);assert.equal(d.history.length,0);for(const body of [{action:'message',offer,farm,message:'Forbidden'},{action:'payment',order},{action:'order-status',order,farm,status:'Packed'},{action:'farm',id:farm,name:'Changed',person:'Changed',location:'Changed'}])assert.equal((await publicApi.post(base+'/api/action',{headers:{Origin:base},data:body})).status(),400);test.revoke(token);}
  assert.equal((await action(buyer,{action:'listing',role:'grower',farm,crop:'Forbidden',quantity:1,price:1})).status(),400);
  assert.equal((await action(grower,{action:'listing',farm,crop:'Invalid',category:'Peppers',grade:'A',quantity:-1,price:1,pickup:'Tomorrow'})).status(),400);
  await go(buyer,'messages','offer',offer);const payload='<img src=x onerror=alert(1)>';await message(bp,payload);assert.equal(await bp.locator('.messages img').count(),0,'user messages must render as text');
  await bp.goto(base+'/grower?view=listings');await bp.waitForURL('**/buyer**');await loaded(bp);assert.equal(await bp.locator('[data-action=edit-lot]').count(),0);
  const after=await state(grower);assert.equal(after.listings.find(l=>l.id===lot).quantity,75);assert.equal(after.orders.find(o=>o.id===order).timeline.length,6);
  await go(buyer);
  await bp.getByRole('button',{name:/Change location/}).click();
  await bp.getByLabel('City or region').fill('Chevella, Telangana');
  await bp.getByRole('button',{name:'Save location'}).click();
  await bp.getByRole('button',{name:'Change location: Chevella, Telangana'}).waitFor();
  await bp.reload();await loaded(bp);
  await bp.getByRole('button',{name:'Change location: Chevella, Telangana'}).waitFor();
  assert.equal((await state(buyer)).user.location,'Chevella, Telangana');
  assert.equal(await bp.locator('.workspace-presence').count(),0);
  assert.equal(await bp.getByText('Sample charts · illustrative imagery',{exact:true}).count(),0);
  const instantCrop='Checkout tomatoes '+width;
  await go(grower,'listings');await gp.locator('[data-action=edit-lot]').click();
  for (const [name,value] of Object.entries({crop:instantCrop,quantity:'30',price:'34',pickup:'Farm gate, 8 am'})) {
    await gp.locator('#fields [name='+name+']').fill(value);
  }
  await gp.locator('#category').selectOption('Tomatoes');
  await gp.getByRole('checkbox',{name:/Allow checkout/}).check();
  await gp.locator('#save-editor').click();
  await gp.getByRole('heading',{name:instantCrop,exact:true}).waitFor();
  const directLot=new URL(gp.url()).searchParams.get('detail');
  await go(buyer,'market');
  await bp.getByRole('heading',{name:'Current market prices'}).waitFor();
  await bp.getByLabel('Find a vegetable or farm').fill(instantCrop);
  await bp.locator('.price-rows li').filter({hasText:instantCrop}).waitFor();
  await go(buyer,'catalogue');
  await bp.locator('[name=search]').fill(instantCrop);
  const directCard=bp.locator('.shop-card').filter({hasText:instantCrop});
  await directCard.getByRole('spinbutton').fill('5');
  await directCard.getByRole('button',{name:'Add to cart'}).click();
  await bp.locator('[name=search]').fill(crop);
  const requestCard=bp.locator('.shop-card').filter({hasText:crop});
  await requestCard.getByRole('spinbutton').fill('2');
  await requestCard.getByRole('button',{name:'Add to cart'}).click();
  await bp.reload();await loaded(bp);
  await bp.getByRole('button',{name:'Open cart, 2 items'}).click();
  await bp.getByRole('dialog',{name:'Your cart'}).waitFor();
  await bp.getByRole('spinbutton',{name:instantCrop+' quantity (kg)'}).fill('');
  assert(await bp.getByRole('button',{name:'Place orders & send requests'}).count()===0);
  await bp.getByRole('spinbutton',{name:instantCrop+' quantity (kg)'}).fill('5');
  await bp.locator('.cart-footer strong').filter({hasText:'₹250'}).waitFor();
  await noOverflow(bp,'cart');
  if(width<600){
    await bp.setViewportSize({width,height:440});
    await bp.waitForFunction(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-height'))<450);
    const box=await bp.getByRole('dialog',{name:'Your cart'}).boundingBox();
    assert(box.y>=0&&box.y+box.height<=441,'cart must fit above keyboard');
    await bp.setViewportSize({width,height:844});
  }
  await bp.screenshot({path:'design/qa-shopping-cart-'+width+'.png'});
  const requestSeen=bp.waitForRequest(req=>req.method()==='POST'&&req.url().endsWith('/api/action')&&req.postDataJSON().action==='checkout');
  await bp.getByRole('button',{name:'Place orders & send requests'}).click();
  const checkoutRequest=(await requestSeen).postDataJSON();
  await bp.waitForURL('**/buyer?view=orders');
  await bp.getByRole('button',{name:'Open cart, 0 items'}).waitFor();
  const replay=await action(buyer,checkoutRequest);assert.equal(replay.status(),200);
  const receipt=await replay.json();assert.equal(receipt.orders.length,1);assert.equal(receipt.offers.length,1);
  const trading=await state(grower);
  assert.equal(trading.listings.find(l=>l.id===directLot).quantity,25);
  assert.equal(trading.orders.filter(o=>o.listing===directLot).length,1);
  assert.equal(trading.orders.find(o=>o.id===receipt.orders[0]).total,170);
  assert.equal(trading.offers.find(o=>o.id===receipt.offers[0]).status,'Pending');
  assert.equal(trading.listings.find(l=>l.id===lot).quantity,75);
  const badBatch={...checkoutRequest,checkoutId:randomUUID(),items:[checkoutRequest.items[0],{listing:'peppers',quantity:1,price:37,pickup:'Friday, 8–10 am',direct:true}]};
  assert.equal((await action(buyer,badBatch)).status(),400);
  assert.equal((await state(grower)).listings.find(l=>l.id===directLot).quantity,25,'invalid batch must not change stock');
  await go(grower,'orders','order',receipt.orders[0]);
  await gp.getByRole('heading',{name:instantCrop,exact:true}).waitFor();
  console.log('PASS shopping '+width+'px: location, prices, cart persistence, instant order, grower request, replay and atomic checkout');
  await gp.locator('[data-account]:visible').click();await gp.locator('#sign-out').click();await gp.waitForURL('**/login');test.revoke(grower.token);assert.equal((await grower.context.request.get(base+'/api/state')).status(),401);
  grower.token=test.tokenFor(grower);await grower.context.setExtraHTTPHeaders({Authorization:'Bearer '+grower.token});await gp.evaluate(t=>localStorage.setItem('qa_clerk_token',t),grower.token);await gp.goto(base+'/login?portal=buyer');await gp.waitForURL('**/grower**');await loaded(gp);await gp.reload();await loaded(gp);
  if(width<600){for(const p of [grower,buyer]){await go(p);for(const key of ['overview',p.role==='grower'?'listings':'catalogue','offers','orders','messages']){await p.page.locator('#mobile-nav [data-nav='+key+']').click();await p.page.locator('#mobile-nav [data-nav='+key+'][aria-current=page]').waitFor();await noOverflow(p.page,p.role+' '+key);}await p.page.locator('[data-action=offer-detail]').first().click();await p.page.locator('#message-form input').focus();await p.page.setViewportSize({width,height:440});await noOverflow(p.page,'keyboard');assert((await p.page.locator('#mobile-nav').boundingBox()).y<440);await p.page.setViewportSize({width,height:844});}}
  assert.deepEqual(errors,[]);results.push({width,lot,offer,order,qrDecoded:true,accountIsolation:true,stock:75,fullScreen:true,errors,auth:'Compile-time Clerk React fixture provider and real backend SDK RSA signature verification; Google exchange checked separately'});await outsider.close();await grower.context.close();await buyer.context.close();console.log('PASS React '+width+'px complete trade, responsive UI, QR and account isolation');
 }
 await test.saveReload();fs.writeFileSync('design/verification-results.json',JSON.stringify({results},null,2));
 }finally{await browser.close();await test.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
