const fs=require('fs');
const path=require('path');
// Vite compiles the React app; only public marketing/media files are copied.
const fixtures=process.argv.includes('--fixtures');
const dist=path.resolve(__dirname,fixtures?'../.easyfarm-react-test/dist':'../dist');
const vite=path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js');
const result=require('node:child_process').spawnSync(process.execPath,[vite,'build',...(fixtures?['--mode','fixtures']:[])],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
for(const name of ['index.html','landing.css','landing.js','film-script.html'])fs.copyFileSync(name,path.join(dist,name));
for(const name of ['assets','hero-footage'])fs.cpSync(name,path.join(dist,name),{recursive:true,filter:source=>{
 const relative=path.relative('.',source).replaceAll('\\','/');
 if(relative.startsWith('hero-footage/verified-4k'))return false;
 if(relative.startsWith('hero-footage/')&&relative!=='hero-footage/fresh-produce'&&!relative.startsWith('hero-footage/fresh-produce/'))return false;
 if(relative.startsWith('hero-footage/fresh-produce/')&&!relative.endsWith('.jpg'))return false;
 return !(/^assets\/[^/]+\.mp4$/.test(relative));
}});
console.log('Built browser assets in dist; original source footage retained locally.');
