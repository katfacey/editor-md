// Development-only: vendor the fonts used by the approved design for offline builds.
import {mkdir,writeFile} from 'node:fs/promises';
const directory='assets/fonts';
await mkdir(directory,{recursive:true});
const response=await fetch('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;450;500;550;600;650;700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap',{headers:{'User-Agent':'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36'}});
if(!response.ok)throw Error('Could not download font stylesheet');
let css=await response.text();
const urls=[...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(match=>match[1]))];
for(let i=0;i<urls.length;i++){
  const response=await fetch(urls[i]);if(!response.ok)throw Error('Could not download font');
  const name='font-'+i+'.woff2';await writeFile(directory+'/'+name,Buffer.from(await response.arrayBuffer()));
  css=css.replaceAll(urls[i],name);
}
await writeFile(directory+'/fonts.css',css);
for(const family of ['dmsans','librebaskerville']){
  const response=await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/'+family+'/OFL.txt');
  if(!response.ok)throw Error('Could not download font license');
  await writeFile(directory+'/'+family+'-OFL.txt',await response.text());
}
console.log('Vendored '+urls.length+' font files and their OFL licenses.');
