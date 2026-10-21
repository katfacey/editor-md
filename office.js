// Office-style controls shared by the mock-up. The native app will replace
// browser editing commands with operations on a Rust document model.
Object.assign(paths, {
  alignRight: 'M3 5h18M9 10h12M3 15h18M9 20h12',
  chart: 'M3 3v18h18M7 16v-5m5 5V7m5 9V4',
  highlighter: 'm14 3 7 7-9 9-7-7ZM5 12l-2 5 4 4 5-2M2 22h9',
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
const mascotDefaults={visible:true,opacity:20};
let mascotSettings={...mascotDefaults};
function readMascotSettings(){
  mascotSettings={...mascotDefaults};
  try{
    const value=JSON.parse(localStorage.getItem('editor-md-mascot-v1'));
    if(typeof value?.visible==='boolean')mascotSettings.visible=value.visible;
    if(typeof value?.opacity==='number'&&Number.isFinite(value.opacity))mascotSettings.opacity=Math.min(100,Math.max(0,Math.round(value.opacity)));
  }catch{}
}
function applyMascot(){
  document.body.classList.toggle('show-mascot',mascotSettings.visible);
  document.body.style.setProperty('--mascot-opacity',String(mascotSettings.opacity/100));
  const toggle=$('#show-mascot'),slider=$('#mascot-opacity'),output=$('#mascot-opacity-value');
  if(toggle)toggle.checked=mascotSettings.visible;
  if(slider){slider.value=mascotSettings.opacity;slider.disabled=!mascotSettings.visible;slider.setAttribute('aria-valuetext',mascotSettings.opacity+'%')}
  if(output)output.textContent=mascotSettings.opacity+'%';
}
function saveMascotSettings(){
  try{localStorage.setItem('editor-md-mascot-v1',JSON.stringify(mascotSettings))}catch{}
  applyMascot();
}
readMascotSettings();applyMascot();
const interfaceDefaults={zoom:100,initials:'KF'};
let interfaceSettings={...interfaceDefaults};
function readInterfaceSettings(){
  interfaceSettings={...interfaceDefaults};
  try{
    const value=JSON.parse(localStorage.getItem('editor-md-interface-v1'));
    if(value&&ViewSettings.interfaceZoom(value.zoom)!==null)interfaceSettings.zoom=Number(value.zoom);
    if(value&&ViewSettings.initials(value.initials??'')!==null)interfaceSettings.initials=ViewSettings.initials(value.initials);
  }catch{}
}
function applyInterfaceSettings(){
  document.body.style.setProperty('--ui-scale',String(interfaceSettings.zoom/100));
  $('#profile').textContent=interfaceSettings.initials;
  $('#profile').setAttribute('aria-label','Edit your initials ('+interfaceSettings.initials+')');
  const range=$('#ui-zoom'),number=$('#ui-zoom-number'),output=$('#ui-zoom-value'),initials=$('#profile-initials');
  if(range)range.value=interfaceSettings.zoom;
  if(number)number.value=interfaceSettings.zoom;
  if(output)output.textContent=interfaceSettings.zoom+'%';
  if(initials)initials.value=interfaceSettings.initials;
  if($('#footnote-signature-label'))$('#footnote-signature-label').textContent='Append my initials (-'+interfaceSettings.initials+')';
}
function saveInterfaceSettings(){
  try{localStorage.setItem('editor-md-interface-v1',JSON.stringify(interfaceSettings))}catch{}
  applyInterfaceSettings();
}
function setInterfaceZoom(value){
  const zoom=ViewSettings.interfaceZoom(value);if(zoom===null)return false;
  interfaceSettings.zoom=zoom;saveInterfaceSettings();return true;
}
function setProfileInitials(value){
  const initials=ViewSettings.initials(value);if(initials===null)return false;
  interfaceSettings.initials=initials;saveInterfaceSettings();return true;
}
function profileDialog(){
  openDialog('Your initials','<form id="profile-form"><label for="profile-initials">Initials (1–4 characters)</label><input id="profile-initials" maxlength="8" autocomplete="off"><p>Shown in the top-right corner. This preference is shared by light and dark mode.</p><p id="profile-error" class="validation-error" role="alert"></p><div class="dialog-actions"><button id="cancel-profile" type="button">Cancel</button><button class="primary" type="submit">Save initials</button></div></form>');
  applyInterfaceSettings();
  $('#profile-form').onsubmit=event=>{event.preventDefault();if(!setProfileInitials($('#profile-initials').value)){$('#profile-error').textContent='Enter 1–4 non-space characters.';return}$('#dialog').close()};
  $('#cancel-profile').onclick=()=>$('#dialog').close();$('#profile-initials').focus();$('#profile-initials').select();
}
readInterfaceSettings();applyInterfaceSettings();$('#profile').onclick=profileDialog;
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
    <fieldset class="interface-settings"><legend>Interface · shared across modes</legend>
      <div class="mascot-opacity-heading"><label for="ui-zoom">UI zoom</label><output id="ui-zoom-value" for="ui-zoom">100%</output></div>
      <div class="interface-zoom-row"><input id="ui-zoom" type="range" min="50" max="200" step="5" value="100"><input id="ui-zoom-number" aria-label="UI zoom percentage" type="number" min="50" max="200" step="any" value="100"><button id="reset-ui-zoom" type="button">100%</button></div>
      <p>Resize toolbars, panels, and dialogs in both modes. Document zoom and printed page size stay separate.</p>
      <label for="profile-initials">Your initials (1–4 characters)</label><input id="profile-initials" maxlength="8" autocomplete="off">
      <p id="interface-error" class="validation-error" role="alert"></p>
    </fieldset>
    <fieldset class="mascot-settings"><legend>App background</legend>
      <label class="mascot-toggle" for="show-mascot"><input id="show-mascot" type="checkbox">Show mascot</label>
      <div class="mascot-opacity-heading"><label for="mascot-opacity">Opacity</label><output id="mascot-opacity-value" for="mascot-opacity">20%</output></div>
      <input id="mascot-opacity" type="range" min="0" max="100" step="1" value="20" aria-describedby="mascot-help">
      <p id="mascot-help">One background fits the entire app as the window resizes. Shared by light and dark mode; document pages cover it.</p>
    </fieldset>
    <p class="appearance-reset-status" id="appearance-reset-status" role="status" aria-live="polite" aria-atomic="true"></p>
    <div class="dialog-actions"><button id="reset-appearance" aria-describedby="appearance-reset-status">Restore defaults</button><button class="primary" id="done-colors">Done</button></div>`);
  let editing=current;
  function resetHint(){
    $('#appearance-reset-status').textContent='Restores this mode’s colors, shared mascot (shown at 20%), and UI zoom (100%). Your initials stay unchanged.';
  }
  function paint(){
    resetHint();
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
  $('#reset-appearance').onclick=()=>{
    const defaults=appearanceDefaults[editing];
    const unchanged=appearance[editing].main===defaults.main&&appearance[editing].accent===defaults.accent&&mascotSettings.visible===mascotDefaults.visible&&mascotSettings.opacity===mascotDefaults.opacity&&interfaceSettings.zoom===interfaceDefaults.zoom;
    appearance[editing]=structuredClone(defaults);
    mascotSettings={...mascotDefaults};
    interfaceSettings.zoom=interfaceDefaults.zoom;
    persist();saveMascotSettings();saveInterfaceSettings();
    const mode=editing==='dark'?'Dark':'Light';
    $('#appearance-reset-status').textContent=unchanged
      ?mode+' mode is already at its defaults: mascot shown at 20%, UI zoom at 100%.'
      :mode+' mode colors restored. Shared mascot shown at 20%, UI zoom reset to 100%.';
  };
  $('#show-mascot').onchange=e=>{mascotSettings.visible=e.target.checked;saveMascotSettings();resetHint()};
  $('#mascot-opacity').oninput=e=>{mascotSettings.opacity=Number(e.target.value);saveMascotSettings();resetHint()};
  $('#ui-zoom').oninput=event=>{setInterfaceZoom(event.target.value);resetHint()};
  $('#ui-zoom-number').onchange=event=>{if(!setInterfaceZoom(event.target.value)){$('#interface-error').textContent='UI zoom must be between 50% and 200%.';applyInterfaceSettings()}else $('#interface-error').textContent='';resetHint()};
  $('#reset-ui-zoom').onclick=()=>{setInterfaceZoom(100);resetHint()};
  $('#profile-initials').onchange=event=>{if(!setProfileInitials(event.target.value)){$('#interface-error').textContent='Enter 1–4 non-space characters for your initials.';applyInterfaceSettings()}else $('#interface-error').textContent=''};
  applyMascot();applyInterfaceSettings();
  $('#done-colors').onclick=()=>$('#dialog').close();paint();
}
document.addEventListener('themechange',applyAppearance);
window.addEventListener('storage',e=>{
  if(e.key==='editor-md-appearance-v1'){appearance=structuredClone(appearanceDefaults);readAppearance();applyAppearance()}
  if(e.key==='editor-md-mascot-v1'||e.key===null){readMascotSettings();applyMascot()}
  if(e.key==='editor-md-interface-v1'||e.key===null){readInterfaceSettings();applyInterfaceSettings()}
});
$('#appearance').onclick=appearanceDialog;

let currentFontSize=12;
let changingFontSize=false;
function sizeOption(value,label=String(value)){
  const field=$('#size');if(!field)return;
  if(![...field.options].some(o=>o.value===String(value))){const option=new Option(label,String(value));option.dataset.selection='true';field.add(option)}
  field.value=String(value);
}
function selectedTextElements(range){
  const elements=new Set();
  if(range.collapsed){const node=range.startContainer;elements.add(node.nodeType===3?node.parentElement:node);return [...elements]}
  const walker=document.createTreeWalker($('#paper'),NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode;
    if(!node.textContent.trim()||node.parentElement.closest('[contenteditable="false"]')||!range.intersectsNode(node))continue;
    if(node===range.startContainer&&range.startOffset===node.length)continue;
    if(node===range.endContainer&&range.endOffset===0)continue;
    elements.add(node.parentElement);
  }
  return [...elements];
}
function syncFontControls(){
  if(changingFontSize)return;
  const live=window.getSelection();
  const range=live.rangeCount&&$('#paper').contains(live.anchorNode)?live.getRangeAt(0):selection;
  if(!range||!$('#paper').contains(range.commonAncestorContainer)){sizeOption(currentFontSize);return}
  const elements=selectedTextElements(range);
  const sizeElement=element=>{for(let node=element;node&&node!==$('#paper');node=node.parentElement){if(node.style.fontSize||node.getAttribute('size'))return node;if(['SUB','SUP'].includes(node.tagName))return node.parentElement}return element};
  const sizes=new Set(elements.map(e=>Math.round(parseFloat(getComputedStyle(sizeElement(e)).fontSize)*.75*100)/100));
  if(sizes.size===1){currentFontSize=[...sizes][0];sizeOption(currentFontSize)}else if(sizes.size>1)sizeOption('','Mixed');
  const family=$('#font');if(family&&elements.length){const families=new Set(elements.map(e=>getComputedStyle(e).fontFamily.split(',')[0].replaceAll(/['"]/g,'').trim()));if(families.size===1){const name=[...families][0];if(![...family.options].some(o=>o.value===name))family.add(new Option(name,name));family.value=name}else{if(![...family.options].some(o=>o.value===''))family.add(new Option('Mixed',''));family.value=''}}
  if(live.rangeCount&&$('#paper').contains(live.anchorNode))for(const command of ['bold','italic','underline','strikeThrough','subscript','superscript']){
    const button=$('[data-action="'+command+'"]');if(button){const active=document.queryCommandState(command);button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active))}
  }
}
document.addEventListener('selectionchange',syncFontControls);
document.addEventListener('documentchange',()=>queueMicrotask(syncFontControls));
function normalizeFontSizes(){
  $$('#paper font[size="7"]').forEach(e=>{e.style.fontSize=currentFontSize+'pt';e.removeAttribute('size')});
}
function setFontSize(size){
  if(!Number.isFinite(size)||size<6||size>96){toast('Choose a font size from 6 to 96 pt');sizeOption(currentFontSize);return}
  if(mode==='source'){toast('Switch to Write or Split to format text');syncFontControls();return}
  changingFontSize=true;
  try{currentFontSize=Math.round(size*100)/100;sizeOption(currentFontSize);format('fontSize','7');normalizeFontSizes();save();$('#source').value=markdown($('#paper').innerHTML)}finally{changingFontSize=false;syncFontControls()}
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

const defaultPage={size:'Letter',orientation:'portrait',top:1,bottom:1,left:1,right:1};
const pageSizes={Letter:[8.5,11],A4:[8.2677,11.6929],Legal:[8.5,14]};
function applyPage(){
  if(active<0)return;
  const page={...defaultPage,...files[active].page};
  let [width,height]=pageSizes[page.size]||pageSizes.Letter;
  if(page.orientation==='landscape')[width,height]=[height,width];
  // CSS uses 96 pixels per inch, so paper, type and margins share one scale.
  const scale=96;
  const paper=$('#paper');
  paper.style.setProperty('--page-width',width*scale+'px');
  paper.style.setProperty('--page-top',page.top*scale+'px');paper.style.setProperty('--page-bottom',page.bottom*scale+'px');
  paper.style.setProperty('--page-left',page.left*scale+'px');paper.style.setProperty('--page-right',page.right*scale+'px');
  paper.style.setProperty('--page-height',height*scale+'px');
  $('.page-caption').textContent=page.size+' · '+Number(width.toFixed(2))+' × '+Number(height.toFixed(2))+' in';
  let printStyle=$('#print-page-style');
  if(!printStyle){printStyle=document.createElement('style');printStyle.id='print-page-style';document.head.append(printStyle)}
  printStyle.textContent=`@page {size:${width}in ${height}in;margin:${page.top}in ${page.right}in ${page.bottom}in ${page.left}in;}`;
  scheduleSourceSize();
}
// Textareas do not grow with their contents by default. Keep Source/Split on
// the same outer scrollbar, including after wrapping, zooming or changing tabs.
let sourceSizePending=false;
function scheduleSourceSize(){
  if(sourceSizePending)return;
  sourceSizePending=true;
  queueMicrotask(()=>{
    sourceSizePending=false;
    const source=$('#source');
    if(!source.getClientRects().length)return;
    const canvas=$('#canvas-scroll'),top=canvas.scrollTop,left=canvas.scrollLeft;
    source.style.height='0px';
    const style=getComputedStyle(source);
    source.style.height=(source.scrollHeight+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth))+'px';
    source.scrollTop=0;source.scrollLeft=0;
    canvas.scrollTop=top;canvas.scrollLeft=left;
  });
}
let sourceWidth=0;
new ResizeObserver(entries=>{
  const width=entries[0].contentRect.width;
  if(width!==sourceWidth){sourceWidth=width;scheduleSourceSize();}
}).observe($('#source'));
$('#source').addEventListener('input',scheduleSourceSize);
document.addEventListener('viewchange',scheduleSourceSize);
function pageDialog(){
  const p={...defaultPage,...files[active].page};
  openDialog('Page setup',`<p class="dialog-intro">Page layout for this document and its PDF export.</p><div class="page-setup-grid"><div>
    <div class="field-grid"><label>Paper size<select id="paper-size"><option>Letter</option><option>A4</option><option>Legal</option></select></label><label>Orientation<select id="page-orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label></div>
    <label for="margin-preset">Margins</label><select id="margin-preset"><option value="custom">Custom</option><option value="1">Normal · 1 inch</option><option value="0.5">Narrow · 0.5 inch</option><option value="1.25">Wide · 1.25 inch</option></select>
    <div class="field-grid">${['top','bottom','left','right'].map(k=>`<label>${k[0].toUpperCase()+k.slice(1)} (in)<input type="number" id="margin-${k}" min="0" max="3" step="0.05" value="${p[k]}"></label>`).join('')}</div>
    </div><div class="page-layout-preview"><div class="mini-page"><div></div></div><span id="page-dimensions"></span></div></div><p id="page-error" class="validation-error" role="alert"></p><div class="dialog-actions"><button id="cancel-page">Cancel</button><button class="primary" id="apply-page">Apply layout</button></div>`);
  $('#paper-size').value=p.size;$('#page-orientation').value=p.orientation;
  if(['top','bottom','left','right'].every(k=>p[k]===p.top)&&[0.5,1,1.25].includes(p.top))$('#margin-preset').value=String(p.top);
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
// Layout is a viewing preference; page metadata still controls print/export.
let documentLayout='page';
try{if(localStorage.getItem('editor-md-document-layout')==='web')documentLayout='web'}catch{}
function syncLayoutControls(){
  $$('[data-document-layout]').forEach(button=>{
    const selected=button.dataset.documentLayout===documentLayout;
    button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
  });
}
function setDocumentLayout(layout){
  documentLayout=layout==='web'?'web':'page';
  $('.document-area').classList.toggle('web-layout',documentLayout==='web');
  applyPage();
  try{localStorage.setItem('editor-md-document-layout',documentLayout)}catch{}
  syncLayoutControls();
}
$$('[data-document-layout]').forEach(button=>{
  button.onmousedown=e=>e.preventDefault();
  button.onclick=()=>setDocumentLayout(button.dataset.documentLayout);
});
Object.assign(officeActions,{
  'save-template':saveAsTemplate,
  appearance:appearanceDialog,
  'font-smaller':()=>setFontSize(currentFontSize-1),
  'font-larger':()=>setFontSize(currentFontSize+1),
  'font-color':fontColorDialog,
  page:pageDialog,
  export:exportDialog,
  print:()=>{applyPage();window.print()},
  'save-now':()=>{if(save({manual:true}))toast('Saved in this browser');else toast('Save failed; export a copy to keep your work')}
});
function mountAutosaveControl(){
  const section=document.createElement('div');section.className='ribbon-group autosave-group';
  section.innerHTML='<label class="autosave-control"><input type="checkbox" role="switch" id="autosave-toggle" aria-label="Autosave file"><span>Autosave file<small id="autosave-description"></small></span><span class="autosave-track" aria-hidden="true"></span></label><div class="ribbon-label">Saving</div>';
  $('#ribbon').append(section);
  const field=$('#autosave-toggle');field.checked=autosaveEnabled;
  const describe=()=>$('#autosave-description').textContent=autosaveEnabled?'On · save edits automatically':'Off · use Save now or Ctrl+S';describe();
  field.onchange=()=>{autosaveEnabled=field.checked;try{localStorage.setItem('editor-md-autosave',autosaveEnabled?'on':'off')}catch{}if(autosaveEnabled)save({all:true});else updateSaveState();describe();toast(autosaveEnabled?'Autosave enabled':'Autosave off. Use Save now or Ctrl+S.')};
}
window.addEventListener('beforeunload',e=>{if(documentState.anyDirty()){e.preventDefault();e.returnValue=''}});
$('#export').onclick=exportDialog;
document.addEventListener('documentchange',applyPage);
$('#dialog').addEventListener('close',()=>{$('#dialog').classList.remove('graph-studio')});
applyAppearance();applyPage();setDocumentLayout(documentLayout);ribbon('Home');updateSaveState();
