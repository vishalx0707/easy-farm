const {readFile,writeFile,rename,mkdir}=require('node:fs/promises');
const {join}=require('node:path');
const fs=require('node:fs');
const domain=require('./marketplace-domain.cjs');
for(const name of ['.dev.vars','.env.local']){
 const file=join(__dirname,name);
 if(fs.existsSync(file))for(const [key,value]of Object.entries(require('node:util').parseEnv(fs.readFileSync(file,'utf8'))))if(!process.env[key])process.env[key]=value;
}
const directory=process.env.EASYFARM_DATA_DIR||join(__dirname,'.easyfarm');
const file=join(directory,'market.json');
let queue=Promise.resolve();
const serialize=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
function legacyProfiles(){
 const path=join(directory,'accounts.sqlite');if(!fs.existsSync(path))return [];
 const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(path,{readOnly:true});
 try{return db.prepare('SELECT u.id,u.name,u.email,u.role,u.organization,u.location,a.accountId AS googleSubject FROM user u JOIN account a ON a.userId=u.id WHERE a.providerId=\'google\' AND u.emailVerified=1').all().filter(p=>['buyer','grower'].includes(p.role)&&p.organization).map(p=>({...p,clerkId:null}));}
 catch{return [];}finally{db.close();}
}
async function read(){
 let db;try{db=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;db=structuredClone(domain.seed);}
 db.history||=(db.ledger||[]).map(({order,event,at,details})=>({order,event,at,details}));delete db.ledger;
 db.profiles||=[];
 for(const profile of legacyProfiles())if(!db.profiles.some(p=>p.id===profile.id))db.profiles.push(profile);
 return db;
}
async function save(db){await mkdir(directory,{recursive:true});await writeFile(file+'.tmp',JSON.stringify(db,null,2));await rename(file+'.tmp',file);}
const store={
 read,
 user:identity=>serialize(async()=>{const db=await read();const user=domain.portalUser(db,identity);if(user.role!=='pending')await save(db);return user;}),
 complete:(identity,values)=>serialize(async()=>{const db=await read();const user=domain.completeProfile(db,identity,values);await save(db);return {role:user.role};}),
 state:identity=>serialize(async()=>{const db=await read(),user=domain.portalUser(db,identity);if(domain.ensureFarm(db,user))await save(db);return domain.visibleState(db,user);}),
 change:(values,identity)=>serialize(async()=>{const db=await read(),user=domain.portalUser(db,identity);const result=domain.actionResult(db,values,user);await save(db);return result;})
};
let authPromise;
module.exports=async function api(request,response){
 try{
  authPromise||=import('./auth.mjs').then(({createAuth})=>createAuth(process.env));const auth=await authPromise;
  const origin='http://'+request.headers.host;
  let size=0;const chunks=[];
  for await(const chunk of request){size+=chunk.length;if(size>16000){response.writeHead(413,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Request is too large.'}));return;}chunks.push(chunk);}
  const headers=new Headers();for(const [name,value]of Object.entries(request.headers)){if(Array.isArray(value))value.forEach(v=>headers.append(name,v));else if(value!==undefined)headers.set(name,value);}
  const webRequest=new Request(origin+request.url,{method:request.method,headers,...(!['GET','HEAD'].includes(request.method)?{body:Buffer.concat(chunks)}:{})});
  const {handleMarketplace}=await import('./marketplace-service.mjs');const result=await handleMarketplace(webRequest,{auth,store});
  result.headers.forEach((value,name)=>response.setHeader(name,value));response.writeHead(result.status);response.end(Buffer.from(await result.arrayBuffer()));
 }catch(error){console.error(JSON.stringify({event:'request_error',message:error.message}));response.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:'The marketplace is temporarily unavailable.'}));}
};
