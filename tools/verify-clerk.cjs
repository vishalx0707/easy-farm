const assert=require('node:assert/strict');
(async()=>{
 const test=await require('./clerk-fixtures.cjs')();
 try{
  const person={name:'Token Test',email:'token-test@example.test'};
  const good=test.tokenFor(person);
  const get=async token=>{const response=await fetch(test.base+'/api/state',{headers:{Authorization:'Bearer '+token}});return response.status;};
  assert.equal(await get(good),409); // authenticated, not yet assigned a portal
  assert.equal(await get('untrusted'),401);
  assert.equal(await get(test.tokenFor(person,{exp:Math.floor(Date.now()/1000)-60})),401);
  assert.equal(await get(test.tokenFor(person,{azp:'https://unrelated.example'})),401);
  assert.equal(await get(good.slice(0,-20)+'forgedsignature'),401);
  const post=(path,data,token=good)=>fetch(test.base+path,{method:'POST',headers:{Authorization:'Bearer '+token,Origin:test.base,'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await post('/api/profile',{role:'admin',organization:'Test',location:'Pune'})).status,400);
  const values={role:'grower',organization:'Signature Test Farm',location:'Pune'};
  const attempts=await Promise.all([post('/api/profile',values),post('/api/profile',{...values,role:'buyer'})]);
  assert.equal(attempts.filter(r=>r.status===200).length,1);assert.equal(attempts.filter(r=>r.status===400).length,1);
  assert.equal(await get(good),200);
  const before=await(await fetch(test.base+'/api/state',{headers:{Authorization:'Bearer '+good}})).json();
  await test.saveReload();const after=await(await fetch(test.base+'/api/state',{headers:{Authorization:'Bearer '+good}})).json();assert.deepEqual(after,before);
  const csrf=await fetch(test.base+'/api/profile',{method:'POST',headers:{Authorization:'Bearer '+good,Origin:'https://unrelated.example','Content-Type':'application/json'},body:JSON.stringify(values)});assert.equal(csrf.status,403);
  for(const path of ['/api/auth/sign-in/email','/api/auth/sign-up/email','/api/auth/sign-in/social'])assert.equal((await post(path,{})).status,404);
  test.revoke(good);assert.equal(await get(good),401);
  const domain=require('../marketplace-domain.cjs');
  const legacy={profiles:[{id:'old-user',role:'grower',organization:'Legacy Farm',email:'same@example.test',googleSubject:'google-old',clerkId:null}]};
  assert.equal(domain.portalUser(legacy,{clerkId:'new-clerk',name:'Legacy',email:'same@example.test',googleSubject:'different-google'}).role,'pending');
  assert.equal(domain.portalUser(legacy,{clerkId:'new-clerk',name:'Legacy',email:'same@example.test',googleSubject:'google-old'}).id,'old-user');
  console.log('PASS Clerk SDK rejects invalid/forged/expired/wrong-origin/revoked tokens; atomic portal completion; private-data persistence; CSRF; disabled legacy auth; verified Google subject migration.');
 }finally{await test.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
