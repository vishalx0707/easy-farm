import {DurableObject} from 'cloudflare:workers';
import {SqliteDialect} from 'kysely';
import {getMigrations} from 'better-auth/db/migration';
import {createAuth} from './auth.mjs';
import {handleMarketplace} from './marketplace-service.mjs';
import domain from './marketplace-domain.cjs';

// Kysely's synchronous SQLite statement interface backed by Durable Object SQL.
function durableSqlite(sql){
  return {close(){},prepare(query){
    return {
      reader:/^\s*(select|pragma|with)\b|\breturning\b/i.test(query),
      all(parameters=[]){return sql.exec(query,...parameters).toArray();},
      run(parameters=[]){const cursor=sql.exec(query,...parameters);cursor.toArray();return {changes:cursor.rowsWritten};}
    };
  }};
}
export class Marketplace extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);this.sql=ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS market (id INTEGER PRIMARY KEY, document TEXT NOT NULL)');
    this.database={dialect:new SqliteDialect({database:durableSqlite(this.sql)}),type:'sqlite',transaction:false};
    this.authByOrigin=new Map();
    this.ready=ctx.blockConcurrencyWhile(async()=>{
      if(!env.BETTER_AUTH_SECRET)return;
      const auth=createAuth(this.database,{origin:'http://localhost',secret:env.BETTER_AUTH_SECRET});
      const {runMigrations}=await getMigrations(auth.options);await runMigrations();
    });
  }
  read(){const rows=this.sql.exec('SELECT document FROM market WHERE id=1').toArray();return rows.length?JSON.parse(rows[0].document):structuredClone(domain.seed);}
  save(db){this.sql.exec('INSERT INTO market (id,document) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document',JSON.stringify(db));}
  state(user){const db=this.read();if(domain.ensureFarm(db,user))this.save(db);return domain.visibleState(db,user);}
  change(data,user){const db=this.read();const id=domain.apply(db,data,user);this.save(db);return {id};}
  async fetch(request){
    await this.ready;
    if(!this.env.BETTER_AUTH_SECRET)return Response.json({error:'Sign-in is being configured. Try again shortly.'},{status:503});
    const url=new URL(request.url);
    if(!this.authByOrigin.has(url.origin))this.authByOrigin.set(url.origin,createAuth(this.database,{origin:url.origin,secret:this.env.BETTER_AUTH_SECRET,googleClientId:this.env.GOOGLE_CLIENT_ID,googleClientSecret:this.env.GOOGLE_CLIENT_SECRET}));
    // Bound every request before either the auth library or marketplace parses it.
    if(request.body){const reader=request.body.getReader();let size=0;const chunks=[];
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();return Response.json({error:'Request is too large.'},{status:413});}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
      request=new Request(request,{body:bytes});
    }
    return handleMarketplace(request,{auth:this.authByOrigin.get(url.origin),store:this,googleConfigured:Boolean(this.env.GOOGLE_CLIENT_ID && this.env.GOOGLE_CLIENT_SECRET)});
  }
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/'))return env.MARKETPLACE.getByName('easyfarm-demo').fetch(request);
    if(url.pathname==='/')url.pathname='/index.html';
    if(url.pathname==='/film-script')url.pathname='/film-script.html';
    if(url.pathname==='/login')url.pathname='/login.html';
    if(['/buyer','/grower'].includes(url.pathname))url.pathname='/app.html';
    return env.ASSETS.fetch(new Request(url,request));
  }
};
