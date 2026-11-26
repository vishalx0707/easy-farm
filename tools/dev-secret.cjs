const fs=require('fs');
const {randomBytes}=require('node:crypto');
const file='.dev.vars';
const existing=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
if(!/^BETTER_AUTH_SECRET=.+$/m.test(existing)){
 fs.writeFileSync(file,existing+(existing&&!existing.endsWith('\n')?'\n':'')+'BETTER_AUTH_SECRET='+randomBytes(48).toString('base64url')+'\n');
 console.log('Configured an ignored local Cloudflare sign-in secret.');
}
