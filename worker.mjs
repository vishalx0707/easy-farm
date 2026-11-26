import {DurableObject} from 'cloudflare:workers';
import {createAuth} from './auth.mjs';
import {handleMarketplace} from './marketplace-service.mjs';
import domain from './marketplace-domain.cjs';

export class Marketplace extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS market (id INTEGER PRIMARY KEY, document TEXT NOT NULL)');this.auth=createAuth(env);}
 read(){
  const rows=this.sql.exec('SELECT document FROM market WHERE id=1').toArray();const db=rows.length?JSON.parse(rows[0].document):structuredClone(domain.seed);db.profiles||=[];
  if(this.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='user'").toArray().length){
   const profiles=this.sql.exec("SELECT u.id,u.name,u.email,u.role,u.organization,u.location,a.accountId AS googleSubject FROM user u JOIN account a ON a.userId=u.id WHERE a.providerId='google' AND u.emailVerified=1").toArray();
   for(const profile of profiles)if(['buyer','grower'].includes(profile.role)&&profile.organization&&!db.profiles.some(p=>p.id===profile.id))db.profiles.push({...profile,clerkId:null});
  }
  return db;
 }
 save(db){this.sql.exec('INSERT INTO market (id,document) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document',JSON.stringify(db));}
 user(identity){const db=this.read(),user=domain.portalUser(db,identity);if(user.role!=='pending')this.save(db);return user;}
 complete(identity,values){const db=this.read(),user=domain.completeProfile(db,identity,values);this.save(db);return {role:user.role};}
 state(identity){const db=this.read(),user=domain.portalUser(db,identity);if(domain.ensureFarm(db,user))this.save(db);return domain.visibleState(db,user);}
 change(values,identity){const db=this.read(),user=domain.portalUser(db,identity);const id=domain.apply(db,values,user);this.save(db);return {id};}
 async fetch(request){
  if(request.body){const reader=request.body.getReader();let size=0;const chunks=[];
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();return Response.json({error:'Request is too large.'},{status:413});}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}request=new Request(request,{body:bytes});
  }
  return handleMarketplace(request,{auth:this.auth,store:this});
 }
}
export default{async fetch(request,env){
 const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return env.MARKETPLACE.getByName('easyfarm-demo').fetch(request);
 if(url.pathname==='/')url.pathname='/index.html';if(url.pathname==='/film-script')url.pathname='/film-script.html';
 if(url.pathname==='/login')url.pathname='/login.html';if(['/buyer','/grower'].includes(url.pathname))url.pathname='/app.html';
 return env.ASSETS.fetch(new Request(url,request));
}};
