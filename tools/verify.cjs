const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const decode=require('jsqr');
const fs=require('fs');
const assert=require('assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:3002';
const password='EasyFarmTest123!';
const results=[];
async function main(){
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const width of [1440,390,360]){
   const suffix=width+'-'+Date.now(),crop='QA portal peppers '+suffix;
   const errors=[];
   async function person(role,label){
    const context=await browser.newContext({viewport:{width,height:width===1440?950:844},isMobile:width<600,hasTouch:width<600});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    return {context,page,role,email:label+'-'+suffix+'@example.test',name:label==='grower'?'Maya Test':'Arjun Test',organization:label==='grower'?'QA Valley Farm '+width:'QA Fresh Market '+width};
   }
   const grower=await person('grower','grower'),buyer=await person('buyer','buyer');
   async function loaded(p){await p.locator('#content[aria-busy="false"]').waitFor();}
   async function go(person,view='overview',detail){await person.page.goto(base+'/'+person.role+'?view='+view+(detail?'&type='+detail.type+'&detail='+detail.id:''));await loaded(person.page);}
   async function register(person){
    const p=person.page;await p.goto(base+'/login?portal='+person.role+'&mode=signup');
    for(const [name,value]of Object.entries({name:person.name,organization:person.organization,location:'Nashik',email:person.email,password}))await p.locator('[name="'+name+'"]').fill(value);
    for(let attempt=0;attempt<3;attempt++){
     const [response]=await Promise.all([p.waitForResponse(r=>r.url().endsWith('/api/auth/sign-up/email')),p.locator('#auth-submit').click()]);
     if(response.status()!==429)break;
     await new Promise(resolve=>setTimeout(resolve,(Number(response.headers()['x-retry-after'])||10)*1000+150));
    }
    await p.waitForURL('**/'+person.role+'**');await loaded(p);
    assert.equal(await p.locator('body').getAttribute('data-portal'),person.role);
    assert.equal(await p.locator('[data-role]').count(),0);
    assert((await person.context.cookies()).some(cookie=>cookie.name.includes('session_token')&&cookie.httpOnly));
    assert(!(await p.evaluate(()=>document.cookie)).includes('session_token'));
   }
   async function click(p,action){await p.locator('[data-action="'+action+'"]').first().click();}
   async function save(p){await p.locator('#save-editor').click();await p.locator('#editor').waitFor({state:'hidden'});}
   async function state(person){const r=await person.context.request.get(base+'/api/state');assert.equal(r.status(),200);return r.json();}
   async function action(person,body){return person.context.request.post(base+'/api/action',{headers:{Origin:base},data:body});}
   async function noOverflow(p,label){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' document overflow at '+width);assert(await p.locator('#content').evaluate(el=>el.scrollWidth<=el.clientWidth+1),label+' content overflow at '+width);}
   await grower.page.goto(base+'/grower');await grower.page.waitForURL('**/login**');
   await register(grower);await register(buyer);
   await grower.page.screenshot({path:'design/qa-portal-grower-'+width+'.png'});await buyer.page.screenshot({path:'design/qa-portal-buyer-'+width+'.png'});
   await noOverflow(grower.page,'grower home');await noOverflow(buyer.page,'buyer home');
   const initial=await state(grower);assert.equal(initial.farms.filter(f=>f.owned).length,1);assert.equal(initial.offers.length,0);
   const farmId=initial.farms.find(f=>f.owned).id;
   const gp=grower.page,bp=buyer.page;
   await click(gp,'edit-lot');
   for(const [name,value]of Object.entries({crop,quantity:'100',price:'40',grade:'A',harvest:'2026-11-26',pickup:'Tomorrow 9–11 am',notes:'Isolated account test. Crates included.'}))await gp.locator('#fields [name="'+name+'"]').fill(value);
   await save(gp);await gp.getByRole('heading',{name:crop,exact:true}).waitFor();await click(gp,'quality');await gp.getByText('Sample check passed (simulated)',{exact:true}).waitFor();
   const lotId=new URL(gp.url()).searchParams.get('detail');
   await go(buyer,'catalogue');await bp.locator('[name="search"]').fill(crop);await bp.locator('#lot-grid .lot-card').waitFor();assert.equal(await bp.locator('#lot-grid .lot-card').count(),1);await noOverflow(bp,'buyer catalogue');
   await click(bp,'lot');await click(bp,'new-offer');await bp.locator('#fields [name="quantity"]').fill('25');await bp.locator('#fields [name="price"]').fill('35');await bp.locator('#fields [name="message"]').fill('Can you include crates?');await save(bp);
   const offerId=new URL(bp.url()).searchParams.get('detail');
   async function message(p,copy){await p.locator('#message-form [name="message"]').fill(copy);await p.locator('#message-form button').click();await p.getByText(copy,{exact:true}).waitFor();}
   await message(bp,'We will collect tomorrow.');
   await go(grower,'offers',{type:'offer',id:offerId});await gp.getByText('Can you include crates?',{exact:true}).waitFor();await message(gp,'Yes, crates are included.');
   await click(gp,'counter');await gp.locator('#fields [name="price"]').fill('38');await save(gp);
   await go(buyer,'offers',{type:'offer',id:offerId});await bp.getByText('Yes, crates are included.',{exact:true}).waitFor();await click(bp,'counter');await bp.locator('#fields [name="price"]').fill('37');await save(bp);
   await go(grower,'offers',{type:'offer',id:offerId});await click(gp,'accept');await gp.locator('.trace-panel').waitFor();const orderId=new URL(gp.url()).searchParams.get('detail');
   await gp.reload();await loaded(gp);await gp.getByText('₹925',{exact:true}).waitFor();await noOverflow(gp,'grower order');
   for(const step of ['Packed','Ready for pickup','Picked up','Delivered']){await click(gp,'status');await gp.locator('#milestone-note').filter({hasText:'Current status: '+step+'.'}).waitFor();}
   await go(buyer,'orders',{type:'order',id:orderId});await click(bp,'payment');await bp.getByText('Paid (simulated)',{exact:true}).waitFor();await bp.reload();await loaded(bp);await noOverflow(bp,'buyer order');
   const qr=await buyer.context.request.get(base+'/api/qr/'+orderId);assert.equal(qr.status(),200);const png=PNG.sync.read(await qr.body());const code=decode(new Uint8ClampedArray(png.data),png.width,png.height);assert(code);assert.equal(code.data,base+'/app.html?batch='+orderId);
   const outsider=await browser.newContext();const publicApi=outsider.request;
   assert.equal((await publicApi.get(base+'/api/state')).status(),401);
   const trace=await(await publicApi.get(base+'/api/trace/'+orderId)).json();assert.equal(trace.orders[0].payment,'Paid (simulated)');assert(!trace.orders[0].buyer);assert(!trace.orders[0].buyerName);assert.equal(trace.offers.length,0);
   const tracePage=await outsider.newPage();tracePage.on('pageerror',e=>errors.push(e.message));await tracePage.goto(code.data);await loaded(tracePage);assert.equal(await tracePage.locator('[data-action="payment"]').count(),0);
   for(const role of ['buyer','grower']){
    let response;
    for(let attempt=0;attempt<3;attempt++){
     response=await publicApi.post(base+'/api/auth/sign-up/email',{headers:{Origin:base},data:{email:'outsider-'+role+'-'+suffix+'@example.test',password,name:'Other Account',organization:'Other '+role,location:'Pune',role}});
     if(response.status()!==429)break;
     await new Promise(resolve=>setTimeout(resolve,(Number(response.headers()['x-retry-after'])||10)*1000+150));
    }
    assert.equal(response.status(),200);
    const view=await(await publicApi.get(base+'/api/state')).json();assert.equal(view.orders.length,0);assert.equal(view.offers.length,0);assert.equal(view.history.length,0);
    for(const body of [{action:'message',offer:offerId,message:'Not permitted',farm:farmId},{action:'payment',order:orderId},{action:'order-status',order:orderId,status:'Packed',farm:farmId},{action:'farm',id:farmId,name:'Changed',person:'Changed',location:'Changed',bio:''}]){assert.equal((await publicApi.post(base+'/api/action',{headers:{Origin:base},data:body})).status(),400);}
    await publicApi.post(base+'/api/auth/sign-out',{headers:{Origin:base},data:{}});
   }
   const spoof=await action(buyer,{role:'grower',action:'listing',farm:farmId,crop:'Forbidden',quantity:1,price:1,grade:'A',category:'Peppers',pickup:'Tomorrow'});assert.equal(spoof.status(),400);
   await buyer.context.request.post(base+'/api/auth/update-user',{headers:{Origin:base},data:{role:'grower'}});assert.equal((await state(buyer)).user.role,'buyer');
   await bp.goto(base+'/grower?view=listings');await loaded(bp);assert.equal(new URL(bp.url()).pathname,'/buyer');assert.equal(await bp.locator('[data-action="edit-lot"]').count(),0);
   const after=await state(grower);assert.equal(after.listings.find(l=>l.id===lotId).quantity,75);assert.equal(after.orders.find(o=>o.id===orderId).timeline.length,6);assert(!JSON.stringify(after).includes('password'));
   // Wrong passwords fail; a returning grower is routed to their own portal even
   // if they entered through the buyer sign-in screen.
   await gp.locator('#account-button').click();await gp.locator('#sign-out').click();await gp.waitForURL('**/login**');assert.equal((await grower.context.request.get(base+'/api/state')).status(),401);
   await gp.goto(base+'/login?portal=buyer');await gp.locator('[name="email"]').fill(grower.email);await gp.locator('[name="password"]').fill('WrongPassword123!');await gp.locator('#auth-submit').click();await gp.locator('#auth-error:not([hidden])').waitFor();
   await gp.locator('[name="password"]').fill(password);await gp.locator('#auth-submit').click();await gp.waitForURL('**/grower**');await loaded(gp);await gp.reload();await loaded(gp);
   if(width<600){for(const person of [grower,buyer]){
    await go(person);const nav=person.page.locator('#mobile-nav');
    for(const key of ['overview',person.role==='grower'?'listings':'catalogue','offers','orders','messages']){await nav.locator('[data-nav="'+key+'"]').click();assert.equal(await nav.locator('[aria-current="page"]').getAttribute('data-nav'),key);await noOverflow(person.page,person.role+' '+key);}
    await person.page.locator('[data-action="offer-detail"]').first().click();await person.page.locator('#message-form input').focus();await person.page.setViewportSize({width,height:440});await noOverflow(person.page,'keyboard');await person.page.setViewportSize({width,height:844});
   }}
   assert.deepEqual(errors,[]);results.push({width,lotId,offerId,orderId,portals:['buyer','grower'],qrDecoded:true,accountIsolation:true,spoofedRoleRejected:true,signOutAndSignIn:true,remainingKg:75,consoleErrors:errors});
   await outsider.close();await grower.context.close();await buyer.context.close();console.log('PASS '+width+'px authenticated trade and account isolation');
  }
  fs.writeFileSync('design/verification-results.json',JSON.stringify({server:base,results},null,2));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
