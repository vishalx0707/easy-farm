const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const options=convertV4MiniflareOptions({name:'easyfarm-worker-test',modules:true,scriptPath:'.wrangler/test-bundle/worker.js',compatibilityDate:'2026-11-26',compatibilityFlags:['nodejs_compat'],durableObjects:{MARKETPLACE:{className:'Marketplace',useSQLite:true}}});
options.resourcePersistencePath=require('node:path').resolve('.wrangler/worker-fixtures');
(async()=>{
 let mf=new Miniflare(options);const name='qa-'+randomUUID();
 try{
  let ns=await mf.getDurableObjectNamespace('MARKETPLACE');let market=ns.getByName(name);
  const grower={clerkId:'user_qa_grower',name:'QA Grower',email:'grower@example.test',googleSubject:'qa-grower'};
  const buyer={clerkId:'user_qa_buyer',name:'QA Buyer',email:'buyer@example.test',googleSubject:'qa-buyer'};
  await market.complete(grower,{role:'grower',organization:'Worker QA Farm',location:'Pune'});await market.complete(buyer,{role:'buyer',organization:'Worker QA Business',location:'Pune'});
  const farm=(await market.state(grower)).farms.find(f=>f.owned).id;
  const {id:listing}=await market.change({action:'listing',farm,crop:'Worker QA peppers',quantity:100,price:40,category:'Peppers',grade:'A',pickup:'Tomorrow',harvest:'2026-11-27',notes:'QA'},grower);
  const {id:offer}=await market.change({action:'offer',listing,quantity:25,price:37,pickup:'Tomorrow'},buyer);
  await market.change({action:'message',offer,message:'Confirmed',farm},grower);
  const {id:order}=await market.change({action:'accept',offer,farm},grower);
  await assert.rejects(()=>market.change({action:'accept',offer,farm},grower));
  assert.equal((await market.state(grower)).listings.find(l=>l.id===listing).quantity,75);
  await market.change({action:'payment',order},buyer);
  for(const status of ['Packed','Ready for pickup','Picked up','Delivered'])await market.change({action:'order-status',order,farm,status},grower);
  let state=await market.state(buyer);assert.equal(state.orders[0].payment,'Paid (simulated)');assert.equal(state.orders[0].status,'Delivered');
  await assert.rejects(()=>market.complete(buyer,{role:'grower',organization:'No',location:'No'}));
  await assert.rejects(()=>market.change({action:'listing',farm,crop:'Forbidden',quantity:1,price:1},buyer));
  await mf.dispose();mf=new Miniflare(options);ns=await mf.getDurableObjectNamespace('MARKETPLACE');market=ns.getByName(name);
  state=await market.state(buyer);assert.equal(state.orders[0].id,order);assert.equal(state.orders[0].payment,'Paid (simulated)');assert.equal(state.orders[0].status,'Delivered');
  assert.equal(state.offers.find(o=>o.id===offer).messages[0].body,'Confirmed');
  const trace=await(await market.fetch('http://worker.test/api/trace/'+order)).json();
  assert.equal(trace.orders[0].status,'Delivered');assert.equal(trace.orders[0].payment,'Paid (simulated)');assert(!trace.orders[0].buyer);assert.equal(trace.offers.length,0);
  const image=await market.fetch('http://worker.test/api/qr/'+order);assert.equal(image.status,200);
  const {PNG}=require('pngjs'),decode=require('jsqr');const png=PNG.sync.read(Buffer.from(await image.arrayBuffer()));
  assert.equal(decode(new Uint8ClampedArray(png.data),png.width,png.height).data,'http://worker.test/app.html?batch='+order);
  const outsider={clerkId:'user_other',name:'Other',email:'other@example.test',googleSubject:'qa-other'};await market.complete(outsider,{role:'buyer',organization:'Other',location:'Pune'});assert.equal((await market.state(outsider)).orders.length,0);
  console.log('PASS actual Cloudflare Worker/SQLite runtime: profiles, trade, messages, single stock reservation, payment, delivery, ownership checks and persistence after runtime restart. Internal RPC uses fixture identities; Google exchange is separate.');
 }finally{await mf.dispose();}
})().catch(error=>{console.error(error);process.exitCode=1;});
