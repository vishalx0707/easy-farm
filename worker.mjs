import { DurableObject } from 'cloudflare:workers';
import domain from './marketplace-domain.cjs';
import QRCode from 'qrcode/lib/server.js';

const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});

// One coordination object per marketplace. Inventory and orders for this demo
// are a single transaction boundary; additional markets get separate objects.
export class Marketplace extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);
    this.sql=ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS market (id INTEGER PRIMARY KEY, document TEXT NOT NULL)');
  }
  read(){
    const rows=this.sql.exec('SELECT document FROM market WHERE id=1').toArray();
    return rows.length?JSON.parse(rows[0].document):structuredClone(domain.seed);
  }
  change(data){
    // No asynchronous gap between reading inventory, applying terms and saving.
    const db=this.read();
    const id=domain.apply(db,data);
    this.sql.exec('INSERT INTO market (id,document) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document',JSON.stringify(db));
    return {id};
  }
  execute(data){
    try{return {status:200,body:this.change(data)};}
    catch(error){if(error.client)return {status:400,body:{error:error.message}};throw error;}
  }
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/')){
      if(url.pathname==='/')url.pathname='/index.html';
      if(url.pathname==='/film-script')url.pathname='/film-script.html';
      return env.ASSETS.fetch(new Request(url,request));
    }
    const market=env.MARKETPLACE.getByName('easyfarm-demo');
    try{
      if(request.method==='GET'&&url.pathname==='/api/state')return json(await market.read());
      if(request.method==='GET'&&url.pathname.startsWith('/api/qr/')){
        const id=decodeURIComponent(url.pathname.slice(8));
        const db=await market.read();
        if(!db.orders.some(order=>order.id===id))return json({error:'Order was not found.'},404);
        const target=url.origin+'/app.html?batch='+encodeURIComponent(id);
        const buffer=await QRCode.toBuffer(target,{margin:2,width:180});
        return new Response(buffer,{headers:{'Content-Type':'image/png','Cache-Control':'no-store'}});
      }
      if(request.method!=='POST'||url.pathname!=='/api/action')return json({error:'Endpoint not found.'},404);
      if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Use the EasyFarm app on this server.'},403);
      const reader=request.body?.getReader();
      if(!reader)return json({error:'Invalid request.'},400);
      let size=0;const chunks=[];
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12000){await reader.cancel();return json({error:'Request is too large.'},413);}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{return json({error:'Invalid request.'},400);}
      if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Invalid request.'},400);
      // RPC errors retain their message but not custom properties. Prefix domain
      // validation errors in the object boundary instead of exposing internals.
      const result=await market.execute(data);
      return json(result.body,result.status);
    }catch(error){console.error(JSON.stringify({event:'marketplace_error',message:error.message}));return json({error:'Could not save the change. Try again.'},500);}
  }
};
