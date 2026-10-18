// Office-style controls shared by the mock-up. The native app will replace
// browser editing commands with operations on a Rust document model.
Object.assign(paths, {
  alignRight: 'M3 5h18M9 10h12M3 15h18M9 20h12',
  chart: 'M3 3v18h18M7 16v-5m5 5V7m5 9V4',
  palette: 'M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4a4 4 0 0 0 4-4c0-3-4-6-9-6ZM7 8h.01M11 6h.01M16 8h.01M6 13h.01'
});
$('#appearance').innerHTML=icon('palette');
const appearanceDefaults={
  light:{main:'#eeefec',accent:'#35644d'},
  dark:{main:'#111e33',accent:'#f0a15a'}
};
let appearance=structuredClone(appearanceDefaults);
function readAppearance(){
  try {
    const value=JSON.parse(localStorage.getItem('editor-md-appearance-v1'));
    for(const mode of ['light','dark'])for(const key of ['main','accent'])
      if(/^#[0-9a-f]{6}$/i.test(value?.[mode]?.[key]))appearance[mode][key]=value[mode][key];
  }catch{}
}
readAppearance();
function mix(a,b,weight){
  const rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
  return '#'+rgb(a).map((n,i)=>Math.round(n*(1-weight)+rgb(b)[i]*weight).toString(16).padStart(2,'0')).join('');
}
function contrastInk(hex){
  const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*c[0]+.7152*c[1]+.0722*c[2]>.179?'#162032':'#ffffff';
}
function applyAppearance(){
  const dark=document.body.classList.contains('dark'),mode=dark?'dark':'light';
  const {main,accent}=appearance[mode];
  const tokens=dark?{
    bg:main,surface:mix(main,'#000000',.2),paper:mix(main,'#ffffff',.055),
    ink:'#e6edf7',muted:'#a2b1c6',line:mix(main,'#ffffff',.15),
    pale:mix(main,accent,.14),hover:mix(main,'#ffffff',.07)
  }:main===appearanceDefaults.light.main?{
    bg:main,surface:'#fafbf8',paper:'#fffefa',ink:'#28332f',muted:'#7b837c',line:'#dfe3dc',pale:accent==='#35644d'?'#e6ede3':mix(main,accent,.06),hover:'#e9ede6'
  }:{bg:main,surface:mix(main,'#ffffff',.75),paper:mix(main,'#ffffff',.95),ink:'#26332f',muted:'#65736c',line:mix(main,'#25372e',.15),pale:mix(main,accent,.09),hover:mix(main,'#25372e',.05)};
  tokens.green=accent;tokens['accent-ink']=contrastInk(accent);
  // Extreme color choices keep their hue but are moved into the mode's range.
  const mainInk=contrastInk(tokens.bg);
  if(dark&&mainInk!=='#ffffff')for(const key of ['bg','surface','paper'])tokens[key]=mix(tokens[key],'#07101d',.78);
  if(!dark&&mainInk==='#ffffff')for(const key of ['bg','surface','paper'])tokens[key]=mix(tokens[key],'#ffffff',.85);
  for(const [key,value] of Object.entries(tokens))document.body.style.setProperty('--'+key,value);
  document.dispatchEvent(new Event('appearancechange'));
}
function appearanceDialog(){
  const current=document.body.classList.contains('dark')?'dark':'light';
  openDialog('Appearance',`<p class="dialog-intro">Make this workspace your own. Each mode remembers its colors.</p>
    <div class="appearance-modes"><button data-edit-mode="light">☀ Light</button><button data-edit-mode="dark">☾ Dark</button></div>
    <div class="appearance-preview"><span class="preview-rail"></span><div><span class="preview-line"></span><span class="preview-line short"></span><span class="preview-accent">Editor, MD</span></div></div>
    <div class="field-grid"><label>Main color<input id="main-color" type="color"><input id="main-hex" aria-label="Main color hex" spellcheck="false" maxlength="7"></label><label>Accent color<input id="accent-color" type="color"><input id="accent-hex" aria-label="Accent color hex" spellcheck="false" maxlength="7"></label></div>
    <div class="dialog-actions"><button id="reset-colors">Restore this mode’s defaults</button><button class="primary" id="done-colors">Done</button></div>`);
  let editing=current;
  function paint(){
    $$('[data-edit-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.editMode===editing));
    $('#main-color').value=appearance[editing].main;$('#accent-color').value=appearance[editing].accent;
    $('#main-hex').value=appearance[editing].main;$('#accent-hex').value=appearance[editing].accent;
    const p=$('.appearance-preview');p.style.background=appearance[editing].main;
    p.style.setProperty('--preview-accent',appearance[editing].accent);
    $('.preview-accent').style.color=contrastInk(appearance[editing].accent);
  }
  function persist(){try{localStorage.setItem('editor-md-appearance-v1',JSON.stringify(appearance))}catch{}applyAppearance();paint()}
  $$('[data-edit-mode]').forEach(b=>b.onclick=()=>{editing=b.dataset.editMode;document.body.classList.toggle('dark',editing==='dark');$('#theme').innerHTML=icon(editing==='dark'?'sun':'moon');try{localStorage.setItem('editor-md-theme',editing)}catch{}applyAppearance();paint()});
  $('#main-color').oninput=e=>{appearance[editing].main=e.target.value;persist()};
  $('#accent-color').oninput=e=>{appearance[editing].accent=e.target.value;persist()};
  for(const key of ['main','accent']){
    const field=$('#'+key+'-hex');
    field.oninput=e=>{if(/^#[0-9a-f]{6}$/i.test(e.target.value)){appearance[editing][key]=e.target.value;persist()}};
    field.onchange=e=>{if(!/^#[0-9a-f]{6}$/i.test(e.target.value)){toast('Use a six-digit hex color, such as #f0a15a');paint()}};
  }
  $('#reset-colors').onclick=()=>{appearance[editing]=structuredClone(appearanceDefaults[editing]);persist()};
  $('#done-colors').onclick=()=>$('#dialog').close();paint();
}
document.addEventListener('themechange',applyAppearance);
window.addEventListener('storage',e=>{if(e.key==='editor-md-appearance-v1'){appearance=structuredClone(appearanceDefaults);readAppearance();applyAppearance()}});
$('#appearance').onclick=appearanceDialog;

let currentFontSize=12;
function normalizeFontSizes(){
  $$('#paper font[size="7"]').forEach(e=>{e.style.fontSize=currentFontSize+'pt';e.removeAttribute('size')});
}
function setFontSize(size){
  if(!Number.isFinite(size)||size<6||size>96){toast('Choose a font size from 6 to 96 pt');if($('#size'))$('#size').value=currentFontSize;return}
  currentFontSize=Math.round(size*2)/2;
  if($('#size'))$('#size').value=currentFontSize;
  format('fontSize','7');normalizeFontSizes();save();$('#source').value=markdown($('#paper').innerHTML);
}
$('#paper').addEventListener('input',normalizeFontSizes,true);
function fontColorDialog(){
  openDialog('Font color',`<p class="dialog-intro">Applies to selected text, or to the words you type next.</p>
    <div class="color-swatches">${['#28332f','#35644d','#b54a20','#2364aa','#913b7a','#d6a52c','#e6edf7','#f0a15a'].map(c=>`<button aria-label="Use ${c}" data-color="${c}" style="--swatch:${c}"></button>`).join('')}</div>
    <label for="text-color">Custom text color</label><input id="text-color" type="color" value="#35644d">
    <p class="format-note">PDF preserves text color. Markdown with HTML can preserve it in compatible readers; GitHub removes inline color styling.</p>
    <div class="dialog-actions"><button id="cancel-color">Cancel</button><button class="primary" id="apply-color">Apply color</button></div>`);
  let color=$('#text-color').value;
  $$('[data-color]').forEach(b=>b.onclick=()=>{color=b.dataset.color;$('#text-color').value=color});
  $('#text-color').oninput=e=>color=e.target.value;
  function apply(value){$('#dialog').close();format('foreColor',value);$('.font-color-icon')?.style.setProperty('--font-color',value)}
  $('#apply-color').onclick=()=>apply(color);
  $('#cancel-color').onclick=()=>$('#dialog').close();
}

const defaultPage={size:'Letter',orientation:'portrait',top:.67,bottom:.67,left:.79,right:.79};
const pageSizes={Letter:[8.5,11],A4:[8.2677,11.6929],Legal:[8.5,14]};
function applyPage(){
  const page={...defaultPage,...files[active].page};
  let [width,height]=pageSizes[page.size]||pageSizes.Letter;
  if(page.orientation==='landscape')[width,height]=[height,width];
  const scale=690/width;
  const paper=$('#paper');
  paper.style.setProperty('--page-top',page.top*scale+'px');paper.style.setProperty('--page-bottom',page.bottom*scale+'px');
  paper.style.setProperty('--page-left',page.left*scale+'px');paper.style.setProperty('--page-right',page.right*scale+'px');
  paper.style.setProperty('--page-height',height*scale+'px');
  let printStyle=$('#print-page-style');
  if(!printStyle){printStyle=document.createElement('style');printStyle.id='print-page-style';document.head.append(printStyle)}
  printStyle.textContent=`@page {size:${width}in ${height}in;margin:${page.top}in ${page.right}in ${page.bottom}in ${page.left}in;}`;
}
function pageDialog(){
  const p={...defaultPage,...files[active].page};
  openDialog('Page setup',`<p class="dialog-intro">Page layout for this document and its PDF export.</p><div class="page-setup-grid"><div>
    <div class="field-grid"><label>Paper size<select id="paper-size"><option>Letter</option><option>A4</option><option>Legal</option></select></label><label>Orientation<select id="page-orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label></div>
    <label for="margin-preset">Margins</label><select id="margin-preset"><option value="custom">Custom</option><option value="1">Normal · 1 inch</option><option value="0.5">Narrow · 0.5 inch</option><option value="1.25">Wide · 1.25 inch</option></select>
    <div class="field-grid">${['top','bottom','left','right'].map(k=>`<label>${k[0].toUpperCase()+k.slice(1)} (in)<input type="number" id="margin-${k}" min="0" max="3" step="0.05" value="${p[k]}"></label>`).join('')}</div>
    </div><div class="page-layout-preview"><div class="mini-page"><div></div></div><span id="page-dimensions"></span></div></div><p id="page-error" class="validation-error" role="alert"></p><div class="dialog-actions"><button id="cancel-page">Cancel</button><button class="primary" id="apply-page">Apply layout</button></div>`);
  $('#paper-size').value=p.size;$('#page-orientation').value=p.orientation;
  function values(){return {size:$('#paper-size').value,orientation:$('#page-orientation').value,...Object.fromEntries(['top','bottom','left','right'].map(k=>[k,Number($('#margin-'+k).value)]))}}
  function preview(){let v=values(),[w,h]=pageSizes[v.size];if(v.orientation==='landscape')[w,h]=[h,w];let m=$('.mini-page');m.style.aspectRatio=w+'/'+h;m.style.padding=`${v.top/h*100}% ${v.right/w*100}% ${v.bottom/h*100}% ${v.left/w*100}%`;$('#page-dimensions').textContent=w.toFixed(2)+' × '+h.toFixed(2)+' in';}
  $$('#dialog input,#dialog select:not(#margin-preset)').forEach(e=>e.oninput=()=>{$('#margin-preset').value='custom';preview()});
  $('#margin-preset').onchange=e=>{if(e.target.value!=='custom')['top','bottom','left','right'].forEach(k=>$('#margin-'+k).value=e.target.value);preview()};
  $('#apply-page').onclick=()=>{let v=values(),[w,h]=pageSizes[v.size];if(v.orientation==='landscape')[w,h]=[h,w];if(['top','bottom','left','right'].some(k=>!Number.isFinite(v[k])||v[k]<0||v[k]>3)||v.left+v.right>w-1||v.top+v.bottom>h-1){$('#page-error').textContent='Leave at least one inch of writing space and use margins from 0 to 3 inches.';return}files[active].page=v;applyPage();save();$('#dialog').close();toast('Page layout applied')};
  $('#cancel-page').onclick=()=>$('#dialog').close();preview();
}

function downloadFile(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportDialog(){
  openDialog('Export document',`<div class="export-choices"><button data-export="markdown">${icon('code')}<span><strong>Markdown (.md)</strong><small>Portable text and Mermaid source. Rich text uses inline HTML.</small></span></button><button data-export="html">${icon('file')}<span><strong>Styled document (.html)</strong><small>Preserves text styling and static graph artwork.</small></span></button><button data-export="pdf">${icon('print')}<span><strong>PDF / Print</strong><small>Uses the system print dialog. Choose Save as PDF.</small></span></button></div><p class="format-note">Text color and page margins are included in PDF. Graphs become static artwork. Screen theme colors do not change printed page colors.</p>`);
  $$('[data-export]').forEach(b=>b.onclick=()=>{const type=b.dataset.export;$('#dialog').close();if(type==='pdf'){applyPage();window.print();return}if(type==='markdown'){download();return}const html=$('#paper').cloneNode(true);html.querySelectorAll('.graph-controls').forEach(e=>e.remove());html.querySelectorAll('.diagram-image').forEach(e=>e.removeAttribute('style'));const p={...defaultPage,...files[active].page};downloadFile(files[active].name.replace(/\.md$/i,'')+'.html','<!doctype html><meta charset="utf-8"><title>'+escapeHtml(files[active].name)+'</title><style>body{background:white;color:#28332f;font:12pt/1.7 Georgia;max-width:8.5in;margin:auto;padding:'+p.top+'in '+p.right+'in '+p.bottom+'in '+p.left+'in}h1{font-size:30pt}blockquote{border-left:3px solid #777;padding-left:20px}svg{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #aaa;padding:8px}.graph-source{display:none}@media print{body{padding:0}}</style>'+html.innerHTML,'text/html');toast('Styled document exported')});
}
Object.assign(officeActions,{
  appearance:appearanceDialog,
  'font-smaller':()=>setFontSize(currentFontSize-1),
  'font-larger':()=>setFontSize(currentFontSize+1),
  'font-color':fontColorDialog,
  page:pageDialog,
  export:exportDialog,
  print:()=>{applyPage();window.print()}
});
$('#export').onclick=exportDialog;
document.addEventListener('documentchange',applyPage);
$('#dialog').addEventListener('close',()=>{$('#dialog').classList.remove('graph-studio')});
applyAppearance();applyPage();ribbon('Home');
