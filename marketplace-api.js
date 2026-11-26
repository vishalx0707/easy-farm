const {readFile,writeFile,rename,mkdir}=require('node:fs/promises');
const {join}=require('node:path');
const {randomBytes}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const domain=require('./marketplace-domain.cjs');
// Node and Wrangler share the ignored local environment file. Never log values.
const localEnvPath=join(__dirname,'.dev.vars');
if(require('node:fs').existsSync(localEnvPath)){
  const values=require('node:util').parseEnv(require('node:fs').readFileSync(localEnvPath,'utf8'));
  for(const key of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET'])if(!process.env[key] && values[key])process.env[key]=values[key];
}
const directory=process.env.EASYFARM_DATA_DIR||join(__dirname,'.easyfarm');
const file=join(directory,'market.json');
let queue=Promise.resolve();
const serialize=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
async function read(){
  try{const db=JSON.parse(await readFile(file,'utf8'));db.history||=(db.ledger||[]).map(({order,event,at,details})=>({order,event,at,details}));delete db.ledger;return db;}
  catch(error){if(error.code!=='ENOENT')throw error;return structuredClone(domain.seed);}
}
async function save(db){await mkdir(directory,{recursive:true});await writeFile(file+'.tmp',JSON.stringify(db,null,2));await rename(file+'.tmp',file);}
const store={
  read,
  state:user=>serialize(async()=>{const db=await read();if(domain.ensureFarm(db,user))await save(db);return domain.visibleState(db,user);}),
  change:(data,user)=>serialize(async()=>{const db=await read();const id=domain.apply(db,data,user);await save(db);return {id};})
};
let initialized;
async function initialize(){
  await mkdir(directory,{recursive:true});
  let secret=process.env.BETTER_AUTH_SECRET;
  if(!secret){
    const path=join(directory,'auth-secret');
    try{secret=await readFile(path,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;secret=randomBytes(48).toString('base64url');await writeFile(path,secret,{flag:'wx'});}
  }
  const database=new DatabaseSync(join(directory,'accounts.sqlite'));
  database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  const {createAuth}=await import('./auth.mjs');
  const {getMigrations}=await import('better-auth/db/migration');
  const migrationAuth=createAuth(database,{origin:'http://localhost',secret});
  const {runMigrations}=await getMigrations(migrationAuth.options);await runMigrations();
  return {database,secret,createAuth,origins:new Map()};
}
module.exports=async function api(request,response){
  try{
    initialized||=initialize();const context=await initialized;
    const origin='http://'+request.headers.host;
    const googleClientId=process.env.GOOGLE_CLIENT_ID,googleClientSecret=process.env.GOOGLE_CLIENT_SECRET;
    if(!context.origins.has(origin))context.origins.set(origin,context.createAuth(context.database,{origin,secret:context.secret,googleClientId,googleClientSecret}));
    let size=0;const chunks=[];
    for await(const chunk of request){size+=chunk.length;if(size>16000){response.writeHead(413,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Request is too large.'}));return;}chunks.push(chunk);}
    const headers=new Headers();for(const [name,value] of Object.entries(request.headers)){if(Array.isArray(value))value.forEach(v=>headers.append(name,v));else if(value!==undefined)headers.set(name,value);}
    // This server binds to loopback, so trust the socket rather than client IP headers.
    headers.set('cf-connecting-ip',request.socket.remoteAddress||'127.0.0.1');
    const webRequest=new Request(origin+request.url,{method:request.method,headers,...(!['GET','HEAD'].includes(request.method)?{body:Buffer.concat(chunks)}:{})});
    const {handleMarketplace}=await import('./marketplace-service.mjs');
    const result=await handleMarketplace(webRequest,{auth:context.origins.get(origin),store,googleConfigured:Boolean(googleClientId && googleClientSecret)});
    result.headers.forEach((value,name)=>{if(name!=='set-cookie')response.setHeader(name,value);});
    const cookies=result.headers.getSetCookie();if(cookies.length)response.setHeader('Set-Cookie',cookies);
    response.writeHead(result.status);response.end(Buffer.from(await result.arrayBuffer()));
  }catch(error){console.error(error);response.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:'Sign-in is temporarily unavailable. Try again.'}));}
};
