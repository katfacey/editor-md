// Integration checks run against the same embedded WebView and Rust file services.
async function runFeatureChecks(check,{invoke,projects}){
  const near=(a,b)=>Math.abs(a-b)<2,canvas=$('#canvas-scroll'),paper=$('#paper');
  const original={left:WorkspaceControls.widths.left,right:WorkspaceControls.widths.right,text:interfaceSettings.textSize};
  setDocumentLayout('page');setMode('write');zoom(100);setInterfaceZoom(100);ribbon('Home');
  for(const layout of ['page','web']){
    setDocumentLayout(layout);const normal=new WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true});canvas.dispatchEvent(normal);
    check(documentZoom===100&&!normal.defaultPrevented,layout+' ordinary wheel scrolling leaves document zoom unchanged');
    const wheel=new WheelEvent('wheel',{deltaY:-100,ctrlKey:true,bubbles:true,cancelable:true});canvas.dispatchEvent(wheel);
    check(documentZoom===105&&wheel.defaultPrevented,layout+' Ctrl+wheel zooms the document and prevents WebView page zoom');zoom(100);
  }
  setDocumentLayout('page');
  WorkspaceControls.resize('left',230);WorkspaceControls.resize('right',250);
  const widths=()=>['.navigator','#inspector'].map(selector=>$(selector).getBoundingClientRect().width);
  const baseline=widths();zoom(175);
  check(widths().every((width,i)=>near(width,baseline[i])),'Document zoom leaves both sidebar widths unchanged');zoom(100);
  $('#resize-left').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  check(near(widths()[0],baseline[0]+10)&&near(widths()[1],baseline[1]),'Left separator independently resizes with the keyboard');
  $('#resize-right').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
  check(near(widths()[1],baseline[1]+10),'Right separator independently resizes with the keyboard');
  setInterfaceZoom(125);const handle=$('#resize-left'),before=widths()[0],event=(type,x)=>new PointerEvent(type,{pointerId:1,button:0,clientX:x,bubbles:true});
  // Synthetic pointer events cannot acquire capture; physical drag is checked separately.
  const capture=handle.setPointerCapture;handle.setPointerCapture=()=>{};
  handle.dispatchEvent(event('pointerdown',300));handle.dispatchEvent(event('pointermove',350));handle.dispatchEvent(event('pointerup',350));handle.setPointerCapture=capture;
  check(near(widths()[0]-before,50),'Sidebar dragging compensates for UI zoom rather than document zoom');setInterfaceZoom(100);
  const textBefore=parseFloat(getComputedStyle($('#show-inspector')).fontSize),docBefore=getComputedStyle(paper).fontSize,sizeBefore=widths();
  appearanceDialog();$('#ui-text-larger').click();$('#ui-text-larger').click();
  check(interfaceSettings.textSize===original.text+2&&parseFloat(getComputedStyle($('#show-inspector')).fontSize)>textBefore,'Appearance up/down buttons resize UI text');
  check(getComputedStyle(paper).fontSize===docBefore&&documentZoom===100&&widths().every((value,i)=>near(value,sizeBefore[i])),'UI text sizing preserves document type, document zoom and sidebar widths');
  readInterfaceSettings();applyInterfaceSettings();check(interfaceSettings.textSize===original.text+2,'UI text size survives preference reload');
  $('#ui-text-smaller').click();$('#ui-text-smaller').click();$('#dialog').close();
  check(FontManager.system.includes('Arial')&&[...$('#font').options].some(o=>o.value==='Arial'),'Native system font families appear in the document dropdown');
  const family=await FontManager.importFont();
  check(family?.family==='Arial'&&FontManager.custom.some(f=>f.id===family.id)&&document.fonts.check('16px Arial'),'Custom font picker route loads validated native font bytes into the document renderer');
  const catalog=await invoke('list_fonts');check(catalog.custom.some(f=>f.id===family.id),'Imported font persists in portable app data for the next launch');
  const beforeFont=files[active],draft={id:crypto.randomUUID(),name:'Font control check.md',html:'<p>Font selection test</p>'};files.push(draft);openFile(files.indexOf(draft));
  const range=document.createRange();range.selectNodeContents($('#paper p'));selection=range;
  $('#font').value='Consolas';$('#font').dispatchEvent(new Event('change',{bubbles:true}));
  check(getComputedStyle($('#paper p').firstElementChild||$('#paper p')).fontFamily.includes('Consolas'),'Selecting an installed family applies it to the document selection');
  range.selectNodeContents($('#paper p'));selection=range;$('#font').value='__custom__';await $('#font').onchange();
  check(getComputedStyle($('#paper p').firstElementChild||$('#paper p')).fontFamily.includes('Arial'),'Choosing Custom in the font dropdown restores the selection and applies the imported font');
  const closing=closeDocument(draft);$('#native-discard,#close-discard')?.click();await closing;openFile(files.indexOf(beforeFont));
  let blocked=false;try{await invoke('read_custom_font',{id:'../workspace'});}catch{blocked=true;}check(blocked,'Custom font access rejects paths outside the font catalog');
  const source='[[Second]] and [[folder/Note#Heading|Display name]]\n\n`[[code]]`\n\n\\[[escaped]]';
  const rendered=renderMarkdown(source),template=document.createElement('template');template.innerHTML=rendered;
  check(template.content.querySelectorAll('a[data-wiki-link]').length===2&&template.content.querySelector('code').textContent==='[[code]]','Wiki links render with aliases while code and escaped examples remain text');
  check(markdown(rendered).includes('[[folder/Note#Heading|Display name]]'),'Wiki destinations, headings and aliases survive Markdown round trips');
  const text=document.createElement('p');text.textContent='Typed [[Second]]';WikiLinks.decorate(text);
  check(text.querySelector('a')?.title==='Double-click to open in a new tab','Typed wiki links receive the double-click tooltip');
  setInterfaceTextSize(original.text);WorkspaceControls.resize('left',original.left);WorkspaceControls.resize('right',original.right);
}
