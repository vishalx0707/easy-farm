const fs=require('fs');
const path=require('path');
// Copy only browser assets. Never expose local records or server source.
const dist=path.resolve(__dirname,'../dist');
if(dist!==path.join(path.resolve(__dirname,'..'),'dist'))throw Error('Unexpected output path');
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});
for(const name of ['index.html','app.html','app.css','app.js','landing.css','landing.js','film-script.html'])fs.copyFileSync(name,path.join('dist',name));
for(const name of ['assets','hero-footage'])fs.cpSync(name,path.join('dist',name),{recursive:true,filter:source=>{
 const relative=path.relative('.',source).replaceAll('\\','/');
 if(relative.startsWith('hero-footage/verified-4k'))return false;
 if(relative.startsWith('hero-footage/')&&relative!=='hero-footage/fresh-produce'&&!relative.startsWith('hero-footage/fresh-produce/'))return false;
 if(relative.startsWith('hero-footage/fresh-produce/')&&!relative.endsWith('.jpg'))return false;
 return !(/^assets\/[^/]+\.mp4$/.test(relative));
}});
console.log('Built browser assets in dist; original source footage retained locally.');
