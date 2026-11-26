import domain from './marketplace-domain.cjs';
import QRCode from 'qrcode/lib/server.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function handleMarketplace(request, { auth, store }) {
  const url=new URL(request.url);
  try {
    if(url.pathname.startsWith('/api/auth/')) return await auth.handler(request);
    if(request.method==='GET' && url.pathname.startsWith('/api/trace/'))return json(domain.traceState(await store.read(),decodeURIComponent(url.pathname.slice(11))));
    if(request.method==='GET' && url.pathname.startsWith('/api/qr/')) {
      const key=decodeURIComponent(url.pathname.slice(8));domain.traceState(await store.read(),key);
      const image=await QRCode.toBuffer(url.origin+'/app.html?batch='+encodeURIComponent(key),{margin:2,width:180});
      return new Response(image,{headers:{'Content-Type':'image/png','Cache-Control':'no-store'}});
    }
    const session=await auth.api.getSession({headers:request.headers});
    if(!session?.user) return json({error:'Sign in to continue.'},401);
    if(request.method==='GET' && url.pathname==='/api/state')return json(await store.state(session.user));
    if(request.method!=='POST' || url.pathname!=='/api/action')return json({error:'Endpoint not found.'},404);
    if(request.headers.get('Origin')!==url.origin || !request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Use the EasyFarm app on this server.'},403);
    let data;try{data=await request.json();}catch{return json({error:'Invalid request.'},400);}
    if(!data || typeof data!=='object' || Array.isArray(data))return json({error:'Invalid request.'},400);
    return json(await store.change(data,session.user));
  } catch(error) {
    if(!error.client)console.error(JSON.stringify({event:'marketplace_error',message:error.message}));
    return json({error:error.client?error.message:'Could not complete this request. Try again.'},error.client?400:500);
  }
}
