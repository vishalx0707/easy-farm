// Isolated test server: real Clerk SDK signature validation with a generated test
// key and fake provider records. This module is never loaded by server.js/Worker.
const {generateKeyPairSync,sign,randomUUID}=require('node:crypto');
const fs=require('node:fs/promises');
const domain=require('../marketplace-domain.cjs');
module.exports=async function start(){
 const {createClerkClient}=await import('@clerk/backend');const {createAuth}=await import('../auth.mjs');const {handleMarketplace}=await import('../marketplace-service.mjs');
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const host='test-fixture.clerk.accounts.dev',pk='pk_test_'+Buffer.from(host+'$').toString('base64').replace(/=+$/,'');
 const config={CLERK_PUBLISHABLE_KEY:pk,CLERK_SECRET_KEY:'sk_test_fixture',CLERK_JWT_KEY:publicKey.export({type:'spki',format:'pem'})};
 const sdk=createClerkClient({publishableKey:pk,secretKey:config.CLERK_SECRET_KEY,jwtKey:config.CLERK_JWT_KEY});
 const people=new Map(),sessions=new Map();let db=structuredClone(domain.seed);db.profiles=[];
 const auth=createAuth(config,{authenticateRequest:async(request,options)=>sdk.authenticateRequest(request,{...options,jwtKey:config.CLERK_JWT_KEY}),users:{getUser:async id=>people.get(id)},sessions:{getSession:async id=>sessions.get(id)}});
 const store={read:()=>db,user:identity=>domain.portalUser(db,identity),complete:(identity,values)=>({role:domain.completeProfile(db,identity,values).role}),state:identity=>{const user=domain.portalUser(db,identity);domain.ensureFarm(db,user);return domain.visibleState(db,user);},change:(values,identity)=>({id:domain.apply(db,values,domain.portalUser(db,identity))})};
 const server=require('../server.js').createAppServer(async(req,res)=>{
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16000){res.writeHead(413).end();return;}}
  const request=new Request(base+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:raw}:{})});
  try{const result=await handleMarketplace(request,{auth,store});result.headers.forEach((v,k)=>res.setHeader(k,v));res.writeHead(result.status).end(Buffer.from(await result.arrayBuffer()));}
  catch{res.writeHead(500).end();}
 });
 let base;await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 function tokenFor(person,claims={}){
  const id=person.id||'user_'+randomUUID(),sid='sess_'+randomUUID();person.id=id;
  people.set(id,{id,firstName:person.name,lastName:'',primaryEmailAddressId:'email_'+id,emailAddresses:[{id:'email_'+id,emailAddress:person.email,verification:{status:'verified'}}],externalAccounts:[{provider:'oauth_google',providerUserId:'google_'+id}]});sessions.set(sid,{id:sid,userId:id,status:'active'});
  const now=Math.floor(Date.now()/1000);const header=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:'test',cat:'cl_B7d4PD111AAA'})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({v:2,sub:id,sid,iss:'https://'+host,azp:base,iat:now,nbf:now-1,exp:now+3600,...claims})).toString('base64url');const data=header+'.'+payload;
  return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url');
 }
 return {base,server,auth,store,config,tokenFor,revoke(token){const {sid}=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));sessions.get(sid).status='revoked';},async close(){await new Promise(resolve=>server.close(resolve));},async saveReload(){await fs.mkdir('.easyfarm-clerk-test',{recursive:true});const file='.easyfarm-clerk-test/roundtrip.json';await fs.writeFile(file,JSON.stringify(db));db=JSON.parse(await fs.readFile(file,'utf8'));}};
};
