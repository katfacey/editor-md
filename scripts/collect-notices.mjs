import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const entries=['Editor, MD — third-party notices\n\nThe project uses the following third-party components. Their licenses apply to those components, independently of the application code and artwork.\n'];
async function addPackage(name,version,license,directory,source=''){
  entries.push('\n'+'='.repeat(72)+'\n'+name+' '+version+'\nDeclared license: '+(license||'See license text')+'\n');
  if(source)entries.push('Source: '+source+'\n');
  const names=await readdir(directory);
  let found=false;
  for(const name of names.filter(name=>/^(license|licence|copying|notice)([._-]|$)/i.test(name))){
    const filename=path.join(directory,name);
    if((await stat(filename)).isFile()){entries.push('\n--- '+name+' ---\n'+await readFile(filename,'utf8'));found=true;}
  }
  if(!found){
    const overrides={'alloc-stdlib':'alloc-stdlib','selectors':'selectors','webview2-com':'webview2-rs','webview2-com-sys':'webview2-rs','webview2-com-macros':'webview2-rs'};
    if(!overrides[name])throw Error('Missing license text for '+name);
    entries.push(await readFile('third-party/licenses/'+overrides[name]+'.txt','utf8'));
  }
}
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
for(const [key,value] of Object.entries(lock.packages)){
  if(!key||value.dev)continue;
  const packageJson=JSON.parse(await readFile(path.join(key,'package.json'),'utf8'));
  await addPackage(packageJson.name,packageJson.version,packageJson.license,key,'https://www.npmjs.com/package/'+packageJson.name+'/v/'+packageJson.version);
}
const metadata=JSON.parse(execFileSync('cargo',['metadata','--manifest-path','src-tauri/Cargo.toml','--format-version','1','--locked','--offline','--filter-platform','x86_64-pc-windows-msvc'],{encoding:'utf8',maxBuffer:20*1024*1024,windowsHide:true}));
for(const pkg of metadata.packages.filter(pkg=>pkg.source))await addPackage(pkg.name,pkg.version,pkg.license,path.dirname(pkg.manifest_path),'https://crates.io/crates/'+pkg.name+'/'+pkg.version);
for(const name of ['dmsans','librebaskerville'])entries.push('\n'+'='.repeat(72)+'\n'+name+' font license\n'+await readFile('assets/fonts/'+name+'-OFL.txt','utf8'));
await writeFile('THIRD_PARTY_NOTICES.txt',entries.join('\n'));
console.log('Wrote third-party license notices.');
