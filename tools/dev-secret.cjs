const fs=require('fs');
const file='.dev.vars';
const existing=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
const values=require('node:util').parseEnv(existing);
if(!(values.CLERK_PUBLISHABLE_KEY||values.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)||!values.CLERK_SECRET_KEY){
 console.error('Configure Clerk keys in the ignored .dev.vars file. Run clerk env pull --file .dev.vars after linking this project.');process.exitCode=1;
}
