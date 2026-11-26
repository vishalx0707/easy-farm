import domain from './marketplace-domain.cjs';
import QRCode from 'qrcode/lib/server.js';
import {resolveBackendRequestOrigin} from './origin.mjs';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function handleMarketplace(request,{auth,store,config={}}){
 const url=new URL(request.url);
 try{
  const originCheck=resolveBackendRequestOrigin(request,config);
  if(!originCheck.ok)return json({error:originCheck.error},originCheck.status);
  const effectiveOrigin=originCheck.origin;
  if(request.method==='GET'&&url.pathname==='/api/auth-config')return json(auth.publicConfig);
  // Legacy password/OAuth endpoints are deliberately not mounted.
  if(url.pathname.startsWith('/api/auth/')&&url.pathname!=='/api/auth/session')return json({error:'Use Google sign-in through Clerk.'},404);
  if(request.method==='GET'&&url.pathname.startsWith('/api/trace/'))return json(domain.traceState(await store.read(),decodeURIComponent(url.pathname.slice(11))));
  if(request.method==='GET'&&url.pathname.startsWith('/api/qr/')){
   const key=decodeURIComponent(url.pathname.slice(8));domain.traceState(await store.read(),key);
   const image=await QRCode.toBuffer(effectiveOrigin+'/app.html?batch='+encodeURIComponent(key),{margin:2,width:180});
   return new Response(image,{headers:{'Content-Type':'image/png','Cache-Control':'no-store'}});
  }
  if(!auth.configured)return json({error:'Sign-in is being configured. Try again shortly.'},503);
  const identity=await auth.identity(request,effectiveOrigin);
  if(!identity)return url.pathname==='/api/auth/session'?json({user:null}):json({error:'Sign in to continue.'},401);
  if(request.method==='GET'&&url.pathname==='/api/auth/session'){
   const {id,name,email,role,organization,location}=await store.user(identity);
   return json({user:{id,name,email,role,organization,location}});
  }
  if(request.method==='POST'&&['/api/profile','/api/action'].includes(url.pathname)){
   if(request.headers.get('Origin')!==effectiveOrigin||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Use the EasyFarm app on this server.'},403);
   let values;try{values=await request.json();}catch{return json({error:'Invalid request.'},400);}
   if(!values||typeof values!=='object'||Array.isArray(values))return json({error:'Invalid request.'},400);
   if(url.pathname==='/api/profile')return json(await store.complete(identity,values));
   return json(await store.change(values,identity));
  }
  if(request.method==='GET'&&url.pathname==='/api/state'){
   const user=await store.user(identity);
   if(!['buyer','grower'].includes(user.role))return json({error:'Complete your EasyFarm profile.',onboarding:true},409);
   return json(await store.state(identity));
  }
  return json({error:'Endpoint not found.'},404);
 }catch(error){
  if(!error.client)console.error(JSON.stringify({event:'marketplace_error',message:error.message}));
  return json({error:error.client?error.message:'Could not complete this request. Try again.'},error.client?400:500);
 }
}
