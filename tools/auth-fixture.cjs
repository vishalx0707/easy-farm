// Test-only session fixture. This runs from the CLI against an isolated SQLite
// file; no HTTP endpoint or runtime authentication bypass is installed.
const fs=require('fs');
const path=require('path');
module.exports=async function fixture(base,person){
 const directory=path.resolve(process.env.EASYFARM_TEST_DATA_DIR||'.easyfarm-auth-test');
 if(!path.basename(directory).startsWith('.easyfarm-')||!path.basename(directory).includes('test'))throw Error('Use an isolated test database directory.');
 if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Session fixtures only support local test servers.');
 const {DatabaseSync}=require('node:sqlite');
 const database=new DatabaseSync(path.join(directory,'accounts.sqlite'));
 const secret=process.env.BETTER_AUTH_SECRET||fs.readFileSync(path.join(directory,'auth-secret'),'utf8');
 const {createAuth}=await import('../auth.mjs');
 const {serializeSignedCookie}=await import('better-call');
 const auth=createAuth(database,{origin:base,secret});const context=await auth.$context;
 let user=await context.adapter.findOne({model:'user',where:[{field:'email',value:person.email}]});
 if(!user){
  user=await context.internalAdapter.createUser({name:person.name,email:person.email,emailVerified:true});
  await context.internalAdapter.createAccount({providerId:'google',accountId:'qa-'+user.id,userId:user.id});
 }
 const session=await context.internalAdapter.createSession(user.id);
 const cookie=await serializeSignedCookie(context.authCookies.sessionToken.name,session.token,secret);
 database.close();
 return {name:context.authCookies.sessionToken.name,value:cookie.split(';')[0].slice(cookie.indexOf('=')+1),url:base,httpOnly:true,sameSite:'Lax'};
};
