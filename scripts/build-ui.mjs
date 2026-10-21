import {build} from 'esbuild';
import {mkdir,copyFile,readFile,writeFile,cp} from 'node:fs/promises';
const {version}=JSON.parse(await readFile('package.json','utf8'));
await mkdir('dist/vendor',{recursive:true});
for(const file of ['index.html','styles.css','office.css','editing.css','project.css','project-model.js','project-ui.js','view-settings.js','footnotes.js','footnotes-ui.js','document-state.js','workspace-ui.js','app.js','office.js','chart-model.js','graph-studio.js','desktop.js']){
  let source=await readFile(file,'utf8');
  if(file==='styles.css') source=source.replace(/^@import[^;]+;\s*/,"@import url('assets/fonts/fonts.css');\n");
  if(file==='index.html')source=source.replace('</body>','<script src="vendor/markdown.js"></script><script src="desktop.js"></script></body>').replace('DESIGN PREVIEW','BETA '+version).replace('A little clarity goes a long way.','Beta '+version);
  if(file==='graph-studio.js')source=source.replace('/node_modules/mermaid/dist/mermaid.esm.min.mjs','./vendor/mermaid.mjs');
  await writeFile('dist/'+file,source);
}
await cp('assets','dist/assets',{recursive:true});
await build({entryPoints:['node_modules/mermaid/dist/mermaid.esm.min.mjs'],outfile:'dist/vendor/mermaid.mjs',bundle:true,format:'esm',minify:true,target:'es2022',legalComments:'eof'});
await build({stdin:{contents:"import {marked} from 'marked'; import TurndownService from 'turndown'; import {gfm} from 'turndown-plugin-gfm'; window.EditorMarkdown={marked,TurndownService,gfm};",resolveDir:process.cwd()},outfile:'dist/vendor/markdown.js',bundle:true,format:'iife',minify:true,target:'es2022',legalComments:'eof'});
console.log('Offline desktop assets built in dist/.');
