import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createAuth} from '../auth.mjs';
import {getMigrations} from 'better-auth/db/migration';
import {handleMarketplace} from '../marketplace-service.mjs';
import {serializeSignedCookie} from 'better-call';

const origin='http://localhost:3000';
const database=new DatabaseSync(':memory:');
const auth=createAuth(database,{origin,secret:'isolated-test-secret-not-used-by-app-123456789',googleClientId:'test-client.apps.googleusercontent.com',googleClientSecret:'test-client-secret'});
await (await getMigrations(auth.options)).runMigrations();
const post=(path,body)=>new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','cf-connecting-ip':'127.0.0.1'},body:JSON.stringify(body)});
for(const path of ['/api/auth/sign-in/email','/api/auth/sign-up/email']){
 const response=await auth.handler(post(path,{email:'disabled@example.test',password:'NotARealPassword123!',name:'Disabled'}));
 assert(response.status>=400,path+' must be disabled');
}
const response=await auth.handler(post('/api/auth/sign-in/social',{provider:'google',callbackURL:'/login?portal=grower&finish=1',newUserCallbackURL:'/login?portal=grower&finish=1',errorCallbackURL:'/login?portal=grower&error=google',disableRedirect:true}));
assert.equal(response.status,200);const result=await response.json();const target=new URL(result.url);
assert.equal(target.hostname,'accounts.google.com');assert.equal(target.searchParams.get('client_id'),'test-client.apps.googleusercontent.com');assert.equal(target.searchParams.get('redirect_uri'),origin+'/api/auth/callback/google');assert(target.searchParams.get('state'));assert.equal(target.searchParams.get('prompt'),'select_account');
assert(response.headers.getSetCookie().some(value=>value.includes('HttpOnly')));
const invalid=await auth.handler(new Request(origin+'/api/auth/callback/google?code=untrusted&state=invalid'));
assert.equal(invalid.status,302);assert(!invalid.headers.getSetCookie().some(value=>value.includes('session_token=')));
const unavailable=await handleMarketplace(post('/api/auth/sign-in/social',{provider:'google'}),{auth,store:{},googleConfigured:false});assert.equal(unavailable.status,503);
const context=await auth.$context;
const user=await context.internalAdapter.createUser({name:'Test Google User',email:'google-fixture@example.test',emailVerified:true});
assert.equal(user.role,'pending');
const session=await context.internalAdapter.createSession(user.id);
const signed=await serializeSignedCookie(context.authCookies.sessionToken.name,session.token,auth.options.secret);
const cookie=signed.split(';')[0];
const profile=role=>{const request=post('/api/profile',{role,organization:'OAuth Test Farm',location:'Pune'});request.headers.set('Cookie',cookie);return handleMarketplace(request,{auth,store:{}});};
const pendingRequest=new Request(origin+'/api/state',{headers:{Cookie:cookie}});
assert.equal((await handleMarketplace(pendingRequest,{auth,store:{}})).status,409);
assert.equal((await profile('admin')).status,400);
const completed=await profile('grower');assert.equal(completed.status,200);assert.equal((await completed.json()).role,'grower');
assert.equal((await profile('buyer')).status,409);
const returning=await auth.api.getSession({headers:new Headers({Cookie:cookie})});assert.equal(returning.user.role,'grower');assert.equal(returning.user.organization,'OAuth Test Farm');
database.close();console.log('PASS Google OAuth authorization redirect, state cookie, callback URI, invalid-state rejection, disabled password endpoints and missing-credentials response. No real Google exchange performed.');
console.log('PASS Google session fixture requires profile completion, rejects invalid roles and prevents changing a completed account’s portal.');
