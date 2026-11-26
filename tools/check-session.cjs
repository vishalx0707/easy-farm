const {request}=require('playwright');
const fs=require('fs');
const assert=require('assert/strict');
const base=process.argv[3]||'http://127.0.0.1:3002';
const file='.easyfarm-auth-test/restart-'+new URL(base).port+'.json';
(async()=>{
 if(process.argv[2]==='prepare'){
  const context=await request.newContext({extraHTTPHeaders:{Origin:base}});
  await context.get(base+'/api/auth/ok');
  const cookie=await require('./auth-fixture.cjs')(base,{email:'restart-'+Date.now()+'@example.test',name:'Restart Tester'});
  const {url,...storedCookie}=cookie;
  const signed=await request.newContext({storageState:{cookies:[{...storedCookie,domain:new URL(base).hostname,path:'/',expires:-1,secure:false}],origins:[]},extraHTTPHeaders:{Origin:base}});
  // APIRequestContext accepts cookies via storageState; browser cookie URLs
  // are converted to the serialized cookie shape here.
  await context.dispose();
  const result=await signed.post(base+'/api/profile',{data:{role:'grower',organization:'Restart QA Farm',location:'Pune'}});
  assert.equal(result.status(),200);
  const state=await(await signed.get(base+'/api/state')).json();
  fs.mkdirSync('.easyfarm-auth-test',{recursive:true});
  fs.writeFileSync(file,JSON.stringify({storage:await signed.storageState(),user:state.user.id,farm:state.farms.find(f=>f.owned).id}));
  await signed.dispose();console.log('Prepared isolated session restart check for '+base);
 }else{
  const fixture=JSON.parse(fs.readFileSync(file,'utf8'));
  const context=await request.newContext({storageState:fixture.storage,extraHTTPHeaders:{Origin:base}});
  const response=await context.get(base+'/api/state');assert.equal(response.status(),200);
  const state=await response.json();assert.equal(state.user.id,fixture.user);assert.equal(state.farms.find(f=>f.owned).id,fixture.farm);
  const forged=await context.post(base+'/api/action',{headers:{Origin:'https://unrelated.example'},data:{action:'farm',name:'Forbidden'}});assert.equal(forged.status(),403);
  assert.equal((await context.post(base+'/api/auth/sign-out',{data:{}})).status(),200);
  const replay=await request.newContext({storageState:fixture.storage});assert.equal((await replay.get(base+'/api/state')).status(),401);
  await replay.dispose();await context.dispose();console.log('PASS session and farm persisted across restart; CSRF rejected; signed-out cookie replay rejected for '+base);
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
