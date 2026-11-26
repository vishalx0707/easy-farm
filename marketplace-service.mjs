import domain from './marketplace-domain.cjs';
import QRCode from 'qrcode/lib/server.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function handleMarketplace(request, { auth, store, googleConfigured = false }) {
  const url=new URL(request.url);
  try {
    if(request.method==='GET' && url.pathname==='/api/auth-config')return json({google:googleConfigured});
    if(url.pathname.startsWith('/api/auth/')) {
      if(url.pathname==='/api/auth/sign-in/social' && !googleConfigured)return json({message:'Google sign-in is not configured yet. The site owner needs to connect Google OAuth.'},503);
      const result=await auth.handler(request);
      const headers=new Headers(result.headers);headers.set('Cache-Control','no-store');
      return new Response(result.body,{status:result.status,headers});
    }
    if(request.method==='GET' && url.pathname.startsWith('/api/trace/'))return json(domain.traceState(await store.read(),decodeURIComponent(url.pathname.slice(11))));
    if(request.method==='GET' && url.pathname.startsWith('/api/qr/')) {
      const key=decodeURIComponent(url.pathname.slice(8));domain.traceState(await store.read(),key);
      const image=await QRCode.toBuffer(url.origin+'/app.html?batch='+encodeURIComponent(key),{margin:2,width:180});
      return new Response(image,{headers:{'Content-Type':'image/png','Cache-Control':'no-store'}});
    }
    const session=await auth.api.getSession({headers:request.headers});
    if(!session?.user) return json({error:'Sign in to continue.'},401);
    if(url.pathname==='/api/profile' && request.method==='POST') {
      if(request.headers.get('Origin')!==url.origin || !request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Use the EasyFarm app on this server.'},403);
      let body;try{body=await request.json();}catch{return json({error:'Invalid request.'},400);}
      if(!body || typeof body!=='object' || !['buyer','grower'].includes(body.role) || typeof body.organization!=='string' || !body.organization.trim() || body.organization.length>100 || typeof body.location!=='string' || !body.location.trim() || body.location.length>100)return json({error:'Choose a portal and enter a farm or business name and location (maximum 100 characters).'},400);
      if(['buyer','grower'].includes(session.user.role))return json({error:'This account already has a portal.'},409);
      const context=await auth.$context;
      const count=await context.adapter.updateMany({model:'user',where:[{field:'id',value:session.user.id},{field:'role',value:'pending'}],update:{role:body.role,organization:body.organization.trim(),location:body.location.trim(),updatedAt:new Date()}});
      if(count!==1)return json({error:'This account already has a portal. Refresh to continue.'},409);
      return json({role:body.role});
    }
    if(!['buyer','grower'].includes(session.user.role))return json({error:'Complete your EasyFarm profile.',onboarding:true},409);
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
