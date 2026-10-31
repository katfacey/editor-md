// The packaged app's native integration. Browser design previews do not load this file.
// Rust owns disk access and file dialogs; the approved interface stays shared.
(async function(){
  if(!window.__TAURI__)return;
  const {invoke}=window.__TAURI__.core;
  // Capture the actual WebView method before installing the application's wrapper.
  const systemPrint=window.print.bind(window);
  const app=$('.app');app.inert=true;
  const {marked,TurndownService,gfm}=window.EditorMarkdown;
  const fence=String.fromCharCode(96).repeat(3);
  const converter=new TurndownService({headingStyle:'atx',codeBlockStyle:'fenced',bulletListMarker:'-'});
  converter.use(gfm);
  converter.addRule('editorStrikethrough',{filter:['del','s','strike'],replacement:content=>'~~'+content+'~~'});
  marked.use({extensions:[{name:'wikiLink',level:'inline',start:source=>source.indexOf('[['),tokenizer(source){const match=source.match(/^\[\[[^\]\r\n]+\]\]/);if(match&&WikiLinks.parse(match[0]))return {type:'wikiLink',raw:match[0]};},renderer:token=>WikiLinks.html(token.raw)}]});
  converter.addRule('wikiLinks',{filter:node=>node.hasAttribute('data-wiki-source'),replacement:(_,node)=>node.getAttribute('data-wiki-source')});
  converter.addRule('sizedImages',{filter:node=>node.nodeName==='IMG'&&(node.hasAttribute('width')||node.hasAttribute('height')||node.hasAttribute('data-image-align')),replacement:(_,node)=>'\n\n'+node.outerHTML+'\n\n'});
  converter.addRule('mermaid',{filter:node=>node.hasAttribute('data-mermaid'),replacement:(_,node)=>'\n\n'+fence+'mermaid\n'+node.getAttribute('data-mermaid')+'\n'+fence+'\n\n'});
  converter.addRule('richCharacters',{filter:node=>['SUB','SUP','U','MARK','FONT'].includes(node.nodeName)||(['SPAN','P','DIV','H1','H2','H3','H4','H5','H6'].includes(node.nodeName)&&!!node.getAttribute('style')),replacement:(_,node)=>'\n'.repeat(['P','DIV','H1','H2','H3','H4','H5','H6'].includes(node.nodeName)?2:0)+node.outerHTML});
  markdown=html=>{const t=document.createElement('template');t.innerHTML=PageLayout.cleanHtml(html);ProjectModel.cleanAssets(t.content);return converter.turndown(t.innerHTML);};
  renderMarkdown=source=>{
    const template=document.createElement('template');
    template.innerHTML=marked.parse(SelectionTools.repairEscapedHeadingLinks(source),{gfm:true});
    template.content.querySelectorAll('pre>code.language-mermaid').forEach(code=>{
      const figure=document.createElement('figure');figure.className='diagram-block';figure.contentEditable='false';
      figure.dataset.mermaid=code.textContent.replace(/\n$/,'');code.parentElement.replaceWith(figure);
    });
    return sanitize(template.innerHTML);
  };
  installFootnoteMarkdown();
  const queues=new Map(),autosaveTimers=new Map(),restorePending=new Set();
  let localHistory={};
  let closedDocuments=[],viewStates={},outlineCollapsed={};
  function recordVersion(file,source,force=false){
    if(!file||typeof source!=='string'||source.length>2000000)return;
    const entries=localHistory[file.id]||[],last=entries.at(-1);
    if(last?.source===source||(!force&&last&&Date.now()-last.at<300000))return;
    entries.push({at:Date.now(),source});localHistory[file.id]=entries.slice(-20);
    queueCheckpoint();
  }
  let workspaceQueue=Promise.resolve(),checkpointTimer,ready=false,closePending=false,dataDirectory='',appVersion='';
  let incomingRequests=Promise.resolve(),incomingPending=false,incomingDocuments=[],incomingErrors=[];
  let projects=null;
  const pageOf=file=>({...defaultPage,...file.page});
  const sourceOf=file=>typeof file.sourceText==='string'?file.sourceText:markdown(file.html);
  const cleanHtml=()=>{
    refreshFootnoteNumbers($('#paper'));
    const copy=$('#paper').cloneNode(true);
    PageLayout.clean(copy);
    ProjectModel.cleanAssets(copy);
    copy.querySelectorAll('[data-mermaid]').forEach(block=>{
      block.innerHTML='';
      for(const attr of [...block.attributes])if(attr.name.startsWith('data-render'))block.removeAttribute(attr.name);
    });
    return copy.innerHTML;
  };
  captureDocument=()=>{
    if(active<0)return;
    const file=files[active],html=cleanHtml();
    if(file.sourceHtml!==html){
      // Keep the exact pre-edit Markdown available even when visual editing
      // requires a fresh HTML-to-Markdown conversion.
      if(typeof file.sourceText==='string')recordVersion(file,file.sourceText,false);
      file.sourceText=markdown(html);file.sourceHtml=html;
    }
    file.html=html;
  };
  const designOpen=openFile;
  function caretOffset(root){
    const selected=window.getSelection();if(!selected?.rangeCount||!root.contains(selected.anchorNode))return null;
    const range=document.createRange();range.selectNodeContents(root);range.setEnd(selected.anchorNode,selected.anchorOffset);return range.toString().length;
  }
  function restoreCaret(root,offset){
    if(!Number.isInteger(offset))return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let remaining=offset,node;
    while((node=walker.nextNode())){if(remaining<=node.length){const range=document.createRange(),selected=window.getSelection();range.setStart(node,remaining);range.collapse(true);selected.removeAllRanges();selected.addRange(range);return;}remaining-=node.length;}
  }
  function rememberView(){
    const file=files[active];if(!file)return;
    viewStates[file.id]={scroll:$('#canvas-scroll').scrollTop,sourceStart:$('#source').selectionStart,sourceEnd:$('#source').selectionEnd,caret:caretOffset($('#paper'))};
  }
  openFile=(index,options={})=>{
    if(files[active]&&files[active]!==files[index])rememberView();
    designOpen(index,options);
    if(files[active])$('#source').value=sourceOf(files[active]);
    const state=viewStates[files[active]?.id];
    if(state)requestAnimationFrame(()=>{if(files[active]?.id!==files[index]?.id)return;$('#canvas-scroll').scrollTop=Math.max(0,state.scroll||0);$('#source').setSelectionRange(state.sourceStart||0,state.sourceEnd||0);if(mode!=='source')restoreCaret($('#paper'),state.caret);});
    queueCheckpoint();
  };
  const designMode=setMode;
  setMode=value=>{
    const file=files[active];if(!file)return;
    captureDocument();const source=sourceOf(file);
    designMode(value);$('#source').value=source;
  };
  function snapshotWorkspace(){
    return {version:1,files:structuredClone(files),saved:[...documentState.saved.values()].map(v=>structuredClone(v)),
      openDocuments:openDocuments.map(f=>f.id),active:files[active]?.id||null,templates:structuredClone(templates),recent:structuredClone(recentDocuments),history:structuredClone(localHistory),restorePending:[...restorePending],closedDocuments:closedDocuments.slice(0,10),viewStates:structuredClone(viewStates),outlineCollapsed:structuredClone(outlineCollapsed)};
  }
  async function checkpoint(){
    if(!ready)return;
    clearTimeout(checkpointTimer);
    const workspace=snapshotWorkspace();
    workspaceQueue=workspaceQueue.catch(()=>{}).then(()=>invoke('save_workspace',{workspace}));
    return workspaceQueue;
  }
  function queueCheckpoint(){
    if(!ready)return;
    clearTimeout(checkpointTimer);
    checkpointTimer=setTimeout(()=>checkpoint().catch(error=>showError('Recovery could not be saved',error)),500);
  }
  function showError(title,error){
    if($('#dialog').open){
      let notice=$('#native-operation-error');
      if(!notice){notice=document.createElement('p');notice.id='native-operation-error';notice.className='validation-error';notice.setAttribute('role','alert');$('#dialog-content').append(notice);}
      notice.textContent=title+': '+String(error);return;
    }
    openDialog(title,'<p role="alert">'+escapeHtml(String(error))+'</p><p>Your buffer is still open. Try Save as to keep a separate copy.</p><button class="primary" id="native-error-ok">OK</button>');
    $('#native-error-ok').onclick=()=>$('#dialog').close();
  }
  updateSaveState=()=>{
    const file=files[active],dirty=documentState.isDirty(file);
    $('#save-state').textContent=!file?'No document open':restorePending.has(file.id)?'● Restored version · save to apply':dirty?(file.nativePath?'● Unsaved changes':'● Unsaved draft'):'✓ Saved to disk';
    $('#save-state').classList.toggle('unsaved',dirty);updateTabSaveMarkers();
    $('.window-title').textContent=file?file.name+' — Editor, MD':'Editor, MD — Beta';
    if(file)$('#breadcrumb').title=file.nativePath||'Unsaved draft';
    return dirty;
  };
  async function performSave(file,{saveAs=false,quiet=false}={}){
    if(!files.includes(file))return false;
    if(projects?.state.external.has(file.id)&&!saveAs){
      if(projects.state.external.get(file.id).kind==='missing'&&!quiet)saveAs=true;
      else{if(!quiet)projects.reviewExternal(file);return false;}
    }
    if(files[active]===file)captureDocument();
    const snapshot=structuredClone(file);
    const previous=documentState.saved.get(file);
    try{
      const result=await invoke('save_document',{id:file.id,name:file.name,source:sourceOf(snapshot),page:pageOf(snapshot),expectedRevision:file.nativeRevision||null,saveAs});
      if(!result)return false;
      const location={name:result.name,nativePath:result.path,nativeRevision:result.revision};
      Object.assign(file,location);Object.assign(snapshot,location);
      if(previous&&!quiet)recordVersion(file,sourceOf(previous),true);
      recordVersion(file,sourceOf(snapshot),!quiet);
      documentState.saved.set(file,snapshot);
      restorePending.delete(file.id);
      projects?.state.external.delete(file.id);
      updateSaveState();renderTabs();renderSidebar();touchRecent(file,'edited');
      document.dispatchEvent(new Event('documentchange'));
      await checkpoint();
      if(!quiet)toast('Saved '+result.name);
      return true;
    }catch(error){showError('Could not save '+file.name,error);return false;}
  }
  function nativeSave(file=files[active],options={}){
    if(!file)return Promise.resolve(false);
    clearTimeout(autosaveTimers.get(file.id));
    const task=(queues.get(file.id)||Promise.resolve()).catch(()=>{}).then(()=>performSave(file,options));
    queues.set(file.id,task);
    task.finally(()=>{if(queues.get(file.id)===task)queues.delete(file.id)});
    return task;
  }
  DocumentTabMenu.connect({save:nativeSave});
  save=({manual=false,all=false}={})=>{
    if(!ready)return false;
    captureDocument();recordDocumentEdit(files[active]);updateSaveState();updateStats();
    document.dispatchEvent(new Event('documentchange'));queueCheckpoint();
    if(manual){nativeSave();return false;}
    if(autosaveEnabled){
      for(const file of all?files:files[active]?[files[active]]:[]){
        if(file.nativePath&&documentState.isDirty(file)&&!restorePending.has(file.id)&&!projects?.state.external.has(file.id)){
          clearTimeout(autosaveTimers.get(file.id));
          autosaveTimers.set(file.id,setTimeout(()=>nativeSave(file,{quiet:true}),900));
        }
      }
    }
    return false;
  };
  $('#source').oninput=()=>{
    if(active<0)return;
    const file=files[active],source=$('#source').value;
    $('#paper').innerHTML=renderMarkdown(source);
    file.html=cleanHtml();file.sourceHtml=file.html;file.sourceText=source;
    save();renderSidebar();
  };
  function fileFromDisk(doc){
    const html=renderMarkdown(doc.source);
    return {id:doc.id,name:doc.name,html,sourceHtml:html,sourceText:doc.source,page:doc.page,nativePath:doc.path,nativeRevision:doc.revision};
  }
  function adoptDocuments(docs){
      captureDocument();
      for(const doc of docs){
        const existing=files.find(file=>file.id===doc.id||file.nativePath===doc.path);
        if(existing&&documentState.isDirty(existing)){openFile(files.indexOf(existing));toast('Kept the open unsaved buffer');continue;}
        const value=fileFromDisk(doc),file=existing||value;
        if(existing)Object.assign(existing,value);else files.push(file);
        documentState.saved.set(file,structuredClone(file));openFile(files.indexOf(file));
      }
  }
  async function nativeOpen(){
    try{
      const docs=await invoke('open_documents');
      adoptDocuments(docs);
      await checkpoint();
    }catch(error){showError('Could not open Markdown',error);}
  }
  function receiveExternalOpen(){
    incomingPending=true;
    if(!ready||$('#dialog').open||closePending)return incomingRequests;
    incomingRequests=incomingRequests.catch(()=>{}).then(async()=>{
      if($('#dialog').open||closePending)return;
      incomingPending=false;
      const batch=await invoke('take_pending_documents');
      incomingDocuments.push(...batch.documents);incomingErrors.push(...batch.errors);
      if($('#dialog').open||closePending){incomingPending=true;return;}
      adoptDocuments(incomingDocuments.splice(0));await checkpoint();
      if(incomingErrors.length)showError('Some files could not be opened',incomingErrors.splice(0).join('\n'));
    }).catch(error=>showError('Could not open Explorer files',error));
    return incomingRequests;
  }
  function askToSave(file,quitting=false){
    return new Promise(resolve=>{
      openDialog(quitting?'Save changes before exiting?':'Save changes?',
        '<p class="close-document-name">'+escapeHtml(quitting?'There are unsaved documents.':file.name)+'</p><p>'+ (quitting?'Save all pending changes before closing Editor, MD?':'Save your changes before closing this tab?')+'</p><p class="format-note">Don’t save restores saved files and discards never-saved drafts.</p><div class="dialog-actions close-save-actions"><button id="native-discard">Don’t save</button><span></span><button id="native-cancel">Cancel</button><button class="primary" id="native-save">'+(quitting?'Save all':'Save')+'</button></div>');
      const dialog=$('#dialog');
      const onClose=()=>resolve('cancel');dialog.addEventListener('close',onClose,{once:true});
      const finish=value=>{dialog.removeEventListener('close',onClose);dialog.close();resolve(value)};
      $('#native-discard').onclick=()=>finish('discard');$('#native-cancel').onclick=()=>finish('cancel');$('#native-save').onclick=()=>finish('save');$('#native-cancel').focus();
    });
  }
  function emptyEditor(){
    active=-1;$('#paper').innerHTML='';$('#source').value='';$('#breadcrumb').textContent='No document open';selection=null;
    syncDocumentControls();renderTabs();renderSidebar();updateStats();updateSaveState();
  }
  closeDocument=async file=>{
    if(!file||!openDocuments.includes(file))return;
    if(files[active]===file)rememberView();
    if(projects&&file.nativePath)await projects.checkExternal();
    const current=files[active],wasActive=current===file,position=openDocuments.indexOf(file);
    captureDocument();clearTimeout(autosaveTimers.get(file.id));
    if(queues.has(file.id))await queues.get(file.id);
    if(documentState.isDirty(file)){
      const choice=await askToSave(file);
      if(choice==='cancel')return;
      if(choice==='save'){if(!await nativeSave(file))return;}
      else{
        documentState.discard(file);
        restorePending.delete(file.id);
        if(!files.includes(file))recentDocuments=recentDocuments.filter(entry=>entry.id!==file.id);
      }
    }
    openDocuments=openDocuments.filter(value=>value!==file);
    if(files.includes(file))closedDocuments=[file.id,...closedDocuments.filter(id=>id!==file.id)].slice(0,10);
    if(wasActive||!files.includes(current)){
      const next=openDocuments[Math.min(position,openDocuments.length-1)];
      if(next)openFile(files.indexOf(next),{capture:false});else emptyEditor();
    }else{active=files.indexOf(current);renderTabs();renderSidebar();updateSaveState();}
    await checkpoint();
  };
  function reopenClosed(){
    while(closedDocuments.length){const id=closedDocuments.shift(),file=files.find(value=>value.id===id);if(file&&!openDocuments.includes(file)){openFile(files.indexOf(file));queueCheckpoint();toast('Reopened '+file.name);return;}}
    toast('No recently closed document to reopen');
  }
  async function closeWindow(){
    if(closePending||!ready)return;closePending=true;
    try{
      rememberView();
      captureDocument();
      for(const timer of autosaveTimers.values())clearTimeout(timer);
      await Promise.all([...queues.values()]);
      if(projects)await projects.checkExternal();
      const dirty=files.filter(file=>documentState.isDirty(file));
      if(dirty.length){
        const choice=await askToSave(null,true);
        if(choice==='cancel')return;
        if(choice==='save'){
          for(const file of dirty)if(!await nativeSave(file))return;
        }else{
          for(const file of dirty)documentState.discard(file);
          openDocuments=openDocuments.filter(file=>files.includes(file));
        }
      }
      await checkpoint();await invoke('finish_close');
    }catch(error){showError('Could not close safely',error);}
    finally{closePending=false;}
  }
  download=async()=>{
    if(active<0)return;captureDocument();
    try{const path=await invoke('export_document',{name:files[active].name,content:sourceOf(files[active]),format:'md',page:pageOf(files[active])});if(path)toast('Markdown copy exported');}
    catch(error){showError('Export failed',error);}
  };
  downloadFile=async(name,content,type)=>{
    try{const path=await invoke('export_document',{name,content,format:type.includes('html')?'html':'md',page:null});if(path)toast('Document exported');}
    catch(error){showError('Export failed',error);}
  };
  let printForTest=null;
  const printer=PrintService.create({
    prepare:async()=>{
      const file=files[active];if(!file){toast('Open a document before printing');return false;}
      if($('#dialog').open){toast('Close the open dialog before printing');return false;}
      applyPage();await document.fonts.ready;await hydrateDiagrams();
      if(files[active]!==file)throw Error('The active document changed. Try printing again.');
      PrintService.snapshot($('#paper'));
      return true;
    },
    print:()=>printForTest?printForTest():systemPrint(),
    onError:error=>{PrintService.clearSnapshot();showError('Could not print',error);}
  });
  window.print=()=>printer.request();
  function currentSource(){captureDocument();return files[active]?sourceOf(files[active]):'';}
  function applySource(source){
    $('#source').value=source;$('#source').dispatchEvent(new Event('input',{bubbles:true}));
    applyPage();updateStats();
  }
  function findReplace(){
    if(active<0)return toast('Open a document first');
    openDialog('Find and replace',`<p class="dialog-intro">Search this document’s Markdown text. Replacements preserve all untouched source.</p><label for="document-find">Find</label><input id="document-find" autocomplete="off"><label for="document-replace">Replace with</label><input id="document-replace" autocomplete="off"><div class="tool-options"><label><input id="find-case" type="checkbox"> Match case</label><label><input id="find-word" type="checkbox"> Whole word</label></div><p id="find-count" role="status" aria-live="polite">Enter text to search.</p><div class="dialog-actions"><button id="find-next">Find next</button><button id="replace-one">Replace next</button><button class="primary" id="replace-all">Replace all</button></div>`);
    const input=$('#document-find'),replacement=$('#document-replace'),count=$('#find-count');let cursor=0;
    const options=()=>({caseSensitive:$('#find-case').checked,wholeWord:$('#find-word').checked});
    const refresh=()=>{const found=EditorTools.matches(currentSource(),input.value,options());count.textContent=input.value?found.length+' match'+(found.length===1?'':'es'):'Enter text to search.';return found;};
    for(const id of ['document-find','find-case','find-word'])$('#'+id).addEventListener('input',()=>{cursor=0;refresh()});
    $('#find-next').onclick=()=>{const found=refresh();if(!found.length)return;const target=found.find(match=>match.start>=cursor)||found[0];cursor=target.end;$('#dialog').close();setMode('source');$('#source').focus();$('#source').setSelectionRange(target.start,target.end);};
    $('#replace-one').onclick=()=>{const source=currentSource(),found=refresh(),target=found.find(match=>match.start>=cursor)||found[0];if(!target)return;recordVersion(files[active],source,true);const result=EditorTools.replace(source,input.value,replacement.value,options(),target.start);applySource(result.source);cursor=target.start+replacement.value.length;refresh();};
    $('#replace-all').onclick=()=>{const source=currentSource(),result=EditorTools.replace(source,input.value,replacement.value,options());if(!result.count)return;recordVersion(files[active],source,true);applySource(result.source);count.textContent='Replaced '+result.count+' match'+(result.count===1?'':'es')+'.';toast('Replaced '+result.count+' matches');};
    input.focus();
  }
  function tableEditor(){
    if(active<0)return toast('Open a document first');
    const selected=selection?.startContainer||window.getSelection()?.anchorNode,element=selected?.nodeType===1?selected:selected?.parentElement;
    const cell=element?.closest('td,th'),table=cell?.closest('table');
    if(!table||!$('#paper').contains(table))return toast('Place the cursor in a table cell first');
    const row=[...table.rows].indexOf(cell.parentElement),column=[...cell.parentElement.cells].indexOf(cell);
    openDialog('Edit table',`<p class="dialog-intro">Editing row ${row+1}, column ${column+1}. Use Tab and Shift+Tab to move between cells.</p><div class="table-edit-grid"><button data-table-edit="row-before">Insert row above</button><button data-table-edit="row-after">Insert row below</button><button data-table-edit="row-delete">Delete row</button><button data-table-edit="column-before">Insert column left</button><button data-table-edit="column-after">Insert column right</button><button data-table-edit="column-delete">Delete column</button></div><label for="table-alignment">Column alignment</label><select id="table-alignment"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select><button id="apply-table-alignment">Apply alignment</button>`);
    const edit=operation=>{if(!EditorTools.editTable(table,operation,row,column))return toast('A table needs at least one row and one column');save();$('#source').value=sourceOf(files[active]);$('#dialog').close();toast('Table updated')};
    $$('[data-table-edit]').forEach(button=>button.onclick=()=>edit(button.dataset.tableEdit));
    $('#apply-table-alignment').onclick=()=>edit($('#table-alignment').value);
  }
  function installTableQuickActions(){
    const overlay=document.createElement('div');overlay.id='table-insert-overlay';overlay.hidden=true;
    overlay.innerHTML='<div class="table-insert-line"></div><button type="button" class="table-insert-plus" aria-label="Insert table row or column" title="Insert table row or column">+</button>';
    document.body.append(overlay);const line=overlay.querySelector('.table-insert-line'),plus=overlay.querySelector('button');let context=null;
    function hide(){overlay.hidden=true;context=null;}
    function hover(table,x,y){
      if(active<0||mode==='source'||$('#dialog').open||!table||!$('#paper').contains(table)){hide();return null;}
      const rect=table.getBoundingClientRect(),canvas=$('#canvas-scroll').getBoundingClientRect(),scale=interfaceSettings.zoom/100;
      if(x<rect.left-10||x>rect.right+10||y<rect.top-10||y>rect.bottom+10||y<canvas.top||y>canvas.bottom){hide();return null;}
      let rowCandidate=null,columnCandidate=null;
      for(let row=0;row<table.rows.length;row++){
        const boundary=table.rows[row].getBoundingClientRect().bottom,distance=Math.abs(y-boundary);
        if(distance<=15&&(!rowCandidate||distance<rowCandidate.distance))rowCandidate={kind:'row',index:row,boundary,distance};
      }
      for(let column=0;column<table.rows[0].cells.length;column++){
        const boundary=table.rows[0].cells[column].getBoundingClientRect().left,distance=Math.abs(x-boundary);
        if(distance<=8&&(!columnCandidate||distance<columnCandidate.distance))columnCandidate={kind:'column',index:column,boundary,distance};
      }
      // Row boundaries take priority where the two guides cross.
      const candidate=rowCandidate||columnCandidate;
      if(!candidate){hide();return null;}
      context={table,...candidate};overlay.hidden=false;overlay.classList.toggle('table-insert-row',candidate.kind==='row');overlay.classList.toggle('table-insert-column',candidate.kind==='column');
      const left=Math.max(canvas.left+2,rect.left),right=Math.min(canvas.right-2,rect.right),top=Math.max(canvas.top+2,rect.top),bottom=Math.min(canvas.bottom-2,rect.bottom);
      if(candidate.kind==='row'){
        if(candidate.boundary<canvas.top||candidate.boundary>canvas.bottom){hide();return null;}
        line.style.left=left/scale+'px';line.style.top=candidate.boundary/scale+'px';line.style.width=(right-left)/scale+'px';line.style.height='2px';
        plus.style.left=Math.max(canvas.left+12,Math.min(left-9,canvas.right-12))/scale+'px';plus.style.top=candidate.boundary/scale+'px';
        plus.setAttribute('aria-label','Add a table row below row '+(candidate.index+1));plus.title='Add row below';
      }else{
        if(candidate.boundary<canvas.left||candidate.boundary>canvas.right){hide();return null;}
        line.style.left=candidate.boundary/scale+'px';line.style.top=top/scale+'px';line.style.width='2px';line.style.height=(bottom-top)/scale+'px';
        plus.style.left=candidate.boundary/scale+'px';plus.style.top=Math.max(canvas.top+12,Math.min(top-9,canvas.bottom-12))/scale+'px';
        plus.setAttribute('aria-label','Add a table column to the left of column '+(candidate.index+1));plus.title='Add column to the left';
      }
      return context;
    }
    document.addEventListener('pointermove',event=>{
      if(overlay.contains(event.target))return;
      const table=event.target.closest?.('table');hover(table,event.clientX,event.clientY);
    },true);
    plus.onpointerdown=event=>event.preventDefault();
    plus.onclick=()=>{if(!context)return;const {table,kind,index}=context;
      if(EditorTools.editTable(table,kind==='row'?'row-after':'column-before',kind==='row'?index:0,kind==='column'?index:0)){
        hide();save();toast(kind==='row'?'Row added below':'Column added to the left');
      }
    };
    $('#canvas-scroll').addEventListener('scroll',hide,{passive:true});document.addEventListener('viewchange',hide);$('#paper').addEventListener('input',hide);return {hover,hide,element:overlay};
  }
  function showTablePicker(){
    if(active<0)return toast('Open a document first');
    $('#table-picker')?.remove();const saved=selection?.cloneRange(),trigger=$('#ribbon [data-action="table"]'),rect=trigger?.getBoundingClientRect();
    RibbonUI.close();const popup=document.createElement('div');popup.id='table-picker';popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Insert table');
    popup.innerHTML='<strong>Insert table</strong><div id="table-picker-grid" role="grid" aria-label="Choose rows and columns">'+Array.from({length:8},(_,r)=>Array.from({length:10},(_,c)=>`<button type="button" data-rows="${r+1}" data-columns="${c+1}" aria-label="${r+1} row${r?'s':''} by ${c+1} column${c?'s':''}"></button>`).join('')).join('')+'</div><span id="table-picker-size" role="status">Choose up to 8 rows × 10 columns</span>';
    document.body.append(popup);const scale=interfaceSettings.zoom/100,space=popup.getBoundingClientRect();
    const left=Math.max(8,Math.min(rect?.left||innerWidth/2-space.width/2,innerWidth-space.width-8)),top=rect&&rect.bottom+space.height+6<innerHeight?rect.bottom+6:Math.max(8,(rect?.top||innerHeight/2)-space.height-6);
    popup.style.left=left/scale+'px';popup.style.top=top/scale+'px';
    const cells=[...popup.querySelectorAll('[data-rows]')],preview=cell=>{const rows=Number(cell.dataset.rows),columns=Number(cell.dataset.columns);cells.forEach(item=>item.classList.toggle('selected',Number(item.dataset.rows)<=rows&&Number(item.dataset.columns)<=columns));$('#table-picker-size').textContent=rows+' row'+(rows===1?'':'s')+' × '+columns+' column'+(columns===1?'':'s');};
    const hide=()=>{popup.remove();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',keys,true);};
    const outside=event=>{if(!popup.contains(event.target))hide();};
    const keys=event=>{if(event.key==='Escape'){event.preventDefault();hide();trigger?.focus();return;}
      const moves={ArrowLeft:-1,ArrowRight:1,ArrowUp:-10,ArrowDown:10},step=moves[event.key];if(step&&popup.contains(document.activeElement)){event.preventDefault();const index=cells.indexOf(document.activeElement);cells[Math.max(0,Math.min(cells.length-1,index+step))]?.focus();}};
    cells.forEach(cell=>{cell.onpointerenter=()=>preview(cell);cell.onfocus=()=>preview(cell);cell.onclick=()=>{
      const rows=Number(cell.dataset.rows),columns=Number(cell.dataset.columns);
      const head='<tr>'+Array.from({length:columns},(_,i)=>'<th>Column '+(i+1)+'</th>').join('')+'</tr>';
      const body=Array.from({length:rows-1},()=>'<tr>'+Array.from({length:columns},()=>'<td><br></td>').join('')+'</tr>').join('');
      hide();if(saved)selection=saved;insert('<table><thead>'+head+'</thead><tbody>'+body+'</tbody></table><p><br></p>');
    };});
    document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',keys,true);cells[0].focus();
    return popup;
  }
  function showHistory(){
    if(active<0)return toast('Open a document first');
    const file=files[active],entries=localHistory[file.id]||[];
    openDialog('Local version history',`<p class="dialog-intro">Compare a version with the current document before restoring it. Restored text remains unsaved until you choose Save.</p><div class="history-list">${entries.length?entries.map((entry,index)=>`<div class="history-entry"><span>${escapeHtml(new Date(entry.at).toLocaleString())} · ${entry.source.length.toLocaleString()} characters</span><button data-history-compare="${index}">Compare</button><button data-history-restore="${index}">Restore</button></div>`).reverse().join(''):'<p>No saved versions yet. Save this document to start its history.</p>'}</div>`);
    const restore=index=>{const source=entries[index]?.source;if(source===undefined)return;recordVersion(file,currentSource(),true);restorePending.add(file.id);clearTimeout(autosaveTimers.get(file.id));applySource(source);updateSaveState();$('#dialog').close();toast('Version restored; save to apply it to disk');};
    $$('[data-history-restore]').forEach(button=>button.onclick=()=>restore(Number(button.dataset.historyRestore)));
    $$('[data-history-compare]').forEach(button=>button.onclick=()=>{
      const index=Number(button.dataset.historyCompare),entry=entries[index];if(!entry)return;
      const diff=EditorTools.diffSummary(entry.source,currentSource());
      $('#dialog').close();
      openDialog('Compare versions',`<p class="dialog-intro">${escapeHtml(new Date(entry.at).toLocaleString())} → current document · ${diff.added} added, ${diff.removed} removed line${diff.added+diff.removed===1?'':'s'}${diff.truncated?' · showing the first 1,000 lines of each version':''}</p><div class="history-diff" role="region" aria-label="Markdown line comparison">${diff.rows.map(row=>`<div class="diff-${row.kind}"><span>${row.kind==='added'?'+':row.kind==='removed'?'−':' '}</span>${escapeHtml(row.text)||'&nbsp;'}</div>`).join('')}</div><div class="dialog-actions"><button id="history-back">Back to history</button><button class="primary" id="history-restore-selected">Restore this version</button></div>`);
      $('#history-back').onclick=()=>{$('#dialog').close();showHistory();};$('#history-restore-selected').onclick=()=>restore(index);
    });
  }
  function renderOutline(){
    const container=window.SidebarDock?.content('outline')||$('#sidebar-content'),file=files[active];if(!container)return;
    if(!file){container.innerHTML='<p class="library-empty">Open a document for its outline.</p>';return;}
    const headings=[...$('#paper').querySelectorAll('h1,h2,h3,h4,h5,h6')],items=EditorTools.outline(headings.map(node=>({level:Number(node.tagName[1]),text:node.textContent.trim()})));
    const collapsed=new Set(outlineCollapsed[file.id]||[]);
    const visible=item=>{let parent=item.parent;while(parent!==null){if(collapsed.has(parent))return false;parent=items[parent].parent;}return true;};
    container.innerHTML='<div class="tree-heading">DOCUMENT OUTLINE <span>'+items.length+'</span></div>'+(items.length?items.filter(visible).map(item=>{
      const children=items.some(child=>child.parent===item.index),open=!collapsed.has(item.index);
      return `<div class="outline-tree-row" style="--outline-depth:${item.level-1}">${children?`<button class="outline-fold" data-outline-fold="${item.index}" aria-label="${open?'Collapse':'Expand'} ${escapeHtml(item.text)}" aria-expanded="${open}">${open?'⌄':'›'}</button>`:'<span class="outline-fold-space"></span>'}<button class="outline-jump" data-outline-jump="${item.index}" title="${escapeHtml(item.text)}">${escapeHtml(item.text||'Untitled heading')}</button></div>`;
    }).join(''):'<p class="library-empty">Add a heading to build an outline.</p>');
    container.querySelectorAll('[data-outline-fold]').forEach(button=>button.onclick=()=>{const index=Number(button.dataset.outlineFold);collapsed.has(index)?collapsed.delete(index):collapsed.add(index);outlineCollapsed[file.id]=[...collapsed];renderOutline();queueCheckpoint();});
    container.querySelectorAll('[data-outline-jump]').forEach(button=>button.onclick=()=>{if(mode==='source')setMode('write');headings[Number(button.dataset.outlineJump)]?.scrollIntoView({block:'start',behavior:'smooth'});button.classList.add('current');});
    updateOutlineCurrent();
  }
  function updateOutlineCurrent(){
    const container=window.SidebarDock?.content('outline')||$('#sidebar-content');if(!container||side!=='outline')return;
    const headings=[...$('#paper').querySelectorAll('h1,h2,h3,h4,h5,h6')],top=$('#canvas-scroll').getBoundingClientRect().top+100;
    let current=0;headings.forEach((heading,index)=>{if(heading.getBoundingClientRect().top<=top)current=index;});
    container.querySelectorAll('[data-outline-jump]').forEach(button=>{const selected=Number(button.dataset.outlineJump)===current;button.classList.toggle('current',selected);if(selected)button.setAttribute('aria-current','location');else button.removeAttribute('aria-current');});
  }
  function commandPalette(){
    const commands=[
      ['New document','Create a new Markdown tab',()=>newDoc()],['Open files','Choose Markdown files from disk',nativeOpen],['Save','Save the current document',()=>nativeSave()],['Save as','Save to another location',()=>nativeSave(files[active],{saveAs:true})],
      ['Reopen closed tab','Restore the most recently closed document',reopenClosed],['Find and replace','Search the active Markdown source',findReplace],['Document outline','Navigate headings and fold outline branches',()=>{side='outline';SidebarDock.select('outline');renderOutline();}],
      ['Check links','Find unresolved local links',checkLinks],['Version history','Compare or restore a previous version',showHistory],['Edit table','Change rows, columns and alignment',tableEditor],
      ['Page setup','Paper size and margins',()=>action('page')],['Print or PDF','Open the print dialog',()=>window.print()],['Insert link','Link selected text',()=>action('link')],['Insert image','Add a local image',()=>action('image')],
      ['Paste as plain text','Paste clipboard text without formatting',pastePlainText],['Copy as Markdown','Copy the selected text as Markdown',copyAsMarkdown],
      ['Write view','Formatted editing',()=>setMode('write')],['Split view','Write and source together',()=>setMode('split')],['Source view','Edit exact Markdown',()=>setMode('source')],['Appearance','Colors and interface settings',()=>action('appearance')]
    ];
    openDialog('Commands','<label for="command-query">Search commands</label><input id="command-query" type="search" autocomplete="off" placeholder="Type a command…" aria-controls="command-results"><div id="command-results" role="listbox"></div>');
    const query=$('#command-query'),results=$('#command-results');let shown=[];
    function render(){const words=query.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);shown=commands.filter(([name,description])=>words.every(word=>(name+' '+description).toLocaleLowerCase().includes(word)));
      results.innerHTML=shown.map(([name,description],index)=>`<button class="result command-result" data-command="${index}" role="option"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(description)}</small></button>`).join('')||'<p>No matching commands.</p>';
      results.querySelectorAll('[data-command]').forEach(button=>button.onclick=()=>{const command=shown[Number(button.dataset.command)];$('#dialog').close();command?.[2]();});}
    query.oninput=render;query.onkeydown=event=>{if(event.key==='Enter'&&shown.length){event.preventDefault();$('#dialog').close();shown[0][2]();}else if(event.key==='ArrowDown'){event.preventDefault();results.querySelector('button')?.focus();}};
    results.onkeydown=event=>{if(!['ArrowDown','ArrowUp'].includes(event.key))return;event.preventDefault();const buttons=[...results.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);buttons[(index+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();};
    render();query.focus();
  }
  function checkLinks(){
    if(active<0)return toast('Open a document first');
    const file=files[active],project=projects?.state.project;
    const current=project&&file.nativePath?ProjectModel.relativePath(project.root,file.nativePath):null;
    const entries=new Set((project?.entries||[]).filter(entry=>entry.kind!=='folder').map(entry=>entry.path.replaceAll('\\','/').toLocaleLowerCase()));
    const normalize=target=>{
      try{target=decodeURIComponent(target.split(/[?#]/)[0]);}catch{return null;}
      const parts=(current?.includes('/')?current.slice(0,current.lastIndexOf('/')).split('/'):[]).filter(Boolean);
      for(const part of target.replaceAll('\\','/').split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)return null;parts.pop();}else parts.push(part);}
      return parts.join('/').toLocaleLowerCase();
    };
    const findings=[];let checked=0,external=0,unverified=0;
    for(const element of $('#paper').querySelectorAll('a[href],img[src]')){
      const wiki=element.getAttribute('data-wiki-source'),target=wiki?WikiLinks.parse(wiki)?.target:element.getAttribute(element.tagName==='IMG'?'data-local-src':'href')||element.getAttribute('src');
      if(!target)continue;
      if(/^(?:https?:|data:|blob:)/i.test(target)){external++;continue;}
      if(wiki){
        if(!project){unverified++;continue;}
        const base=target.split('#')[0].replace(/\.(md|markdown|mdown)$/i,'').toLocaleLowerCase();
        const matches=project.entries.filter(entry=>entry.kind==='markdown'&&entry.path.replace(/\.(md|markdown|mdown)$/i,'').toLocaleLowerCase().endsWith('/'+base)||entry.kind==='markdown'&&entry.path.replace(/\.(md|markdown|mdown)$/i,'').toLocaleLowerCase()===base);
        checked++;if(matches.length!==1)findings.push({target:wiki,reason:matches.length?'Ambiguous note':'Note not found'});continue;
      }
      if(target.startsWith('#')){checked++;if(!SelectionTools.headingTarget($('#paper'),target))findings.push({target,reason:'Heading not found'});continue;}
      if(!ProjectModel.relative(target)){findings.push({target,reason:'Unsupported local destination'});continue;}
      if(!project||current===null){unverified++;continue;}
      const path=normalize(target);checked++;if(!path||!entries.has(path))findings.push({target,reason:path?'File not found in project':'Path escapes the project'});
    }
    openDialog('Check document links',`<p class="dialog-intro">Checked ${checked} local destination${checked===1?'':'s'} in ${escapeHtml(file.name)}. ${external} web or embedded link${external===1?'':'s'} skipped.${unverified?' '+unverified+' local link'+(unverified===1?'':'s')+' need an open project folder to verify.':''}</p><div class="link-check-results">${findings.length?findings.map(item=>`<p class="link-issue"><strong>${escapeHtml(item.reason)}</strong><code>${escapeHtml(item.target)}</code></p>`).join(''):'<p>No broken local destinations found among the checked links.</p>'}</div>`);
  }
  async function pastePlainText(){
    if(active<0||mode==='source')return toast('Place the cursor in Write or Split first');
    try{const value=await navigator.clipboard.readText();format('insertText',value);}catch(error){showError('Could not read clipboard',error);}
  }
  async function copyAsMarkdown(){
    const selected=window.getSelection();let value='';
    if(mode==='source'&&document.activeElement===$('#source'))value=$('#source').value.slice($('#source').selectionStart,$('#source').selectionEnd);
    else if(selected?.rangeCount&&$('#paper').contains(selected.anchorNode)){const holder=document.createElement('div');holder.append(selected.getRangeAt(0).cloneContents());value=markdown(holder.innerHTML);}
    if(!value)return toast('Select text to copy first');
    try{await navigator.clipboard.writeText(value);toast('Copied selection as Markdown');}catch(error){showError('Could not write clipboard',error);}
  }
  document.addEventListener('paste',event=>{
    if(active<0||mode==='source'||$('#dialog').open)return;
    const selected=window.getSelection();if(!selected?.rangeCount||!$('#paper').contains(selected.anchorNode))return;
    const plain=event.clipboardData?.getData('text/plain')||'',html=event.clipboardData?.getData('text/html')||'';
    if(/^https?:\/\/\S+$/i.test(plain)&&!selected.isCollapsed){event.preventDefault();event.stopImmediatePropagation();format('createLink',plain);return;}
    const rows=EditorTools.tsvTable(plain);
    if(rows){event.preventDefault();event.stopImmediatePropagation();const markup='<table><thead><tr>'+rows[0].map(cell=>'<th>'+escapeHtml(cell)+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(1).map(row=>'<tr>'+row.map(cell=>'<td>'+escapeHtml(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';format('insertHTML',markup);return;}
    if(html&&html.length<2000000&&/<(?:p|div|strong|em|h[1-6]|ul|ol|table|blockquote|a)\b/i.test(html)){
      event.preventDefault();event.stopImmediatePropagation();const fragment=document.createElement('template');fragment.innerHTML=html;
      fragment.content.querySelectorAll('script,style,iframe,object,embed,svg,form').forEach(node=>node.remove());
      const converted=converter.turndown(fragment.innerHTML);
      format('insertHTML',renderMarkdown(converted));
    }
  },true);
  Object.assign(officeActions,{
    'save-now':()=>nativeSave(),
    'find-replace':findReplace,
    'table-edit':tableEditor,
    table:showTablePicker,
    history:showHistory,
    'check-links':checkLinks,
    commands:commandPalette,
    'reopen-tab':reopenClosed,
    storage:()=>openDialog('Workspace data','<p>Documents are saved as local UTF-8 Markdown files. Templates, recovery buffers, and settings stay in this data folder:</p><p style="overflow-wrap:anywhere">'+escapeHtml(dataDirectory)+'</p><p>Keep EditorMD-data beside the executable when moving the portable app. Unsaved recovery buffers do not overwrite your Markdown files.</p>'),
    print:()=>{applyPage();window.print();}
  });
  const designRibbon=ribbon;
  ribbon=tab=>{
    designRibbon(tab);
    if(tab==='File'){
      const group=document.createElement('div');group.className='ribbon-group';
      group.innerHTML='<div class="ribbon-row"><button class="large-tool" id="native-open">'+icon('folder')+'<span>Open…</span></button><button class="large-tool" id="native-save-as">'+icon('save')+'<span>Save as…</span></button></div><div class="ribbon-label">Local files</div>';
      $('#ribbon').prepend(group);$('#native-open').onclick=nativeOpen;$('#native-save-as').onclick=()=>nativeSave(files[active],{saveAs:true});$('#native-save-as').disabled=active<0;
    }
    if(['Home','Insert','Review','File','View'].includes(tab)){
      const actions=tab==='Insert'?[['table-edit','Edit table','table']]:tab==='File'?[['history','Version history','clock'],['reopen-tab','Reopen tab','file']]:tab==='View'?[['commands','Commands','search']]:tab==='Review'?[['check-links','Check links','link']]:[['find-replace','Find / Replace','search']];
      const buttons=actions.map(([action,label,glyph])=>{const button=document.createElement('button');button.className='large-tool';button.dataset.editorAction=action;button.title=label;button.innerHTML=icon(glyph)+'<span>'+label+'</span>';button.onmousedown=event=>event.preventDefault();button.onclick=()=>officeActions[action]();return button});
      if(tab==='Home')$('#ribbon .ribbon-group:last-child .ribbon-row').append(...buttons);
      else{const group=document.createElement('div');group.className='ribbon-group';group.innerHTML='<div class="ribbon-row"></div><div class="ribbon-label">Document tools</div>';group.querySelector('.ribbon-row').append(...buttons);$('#ribbon').append(group);}
    }
  };
  $('#about').onclick=()=>openDialog('Editor, MD — Beta','<p><strong>A healthy place for your words.</strong></p><p>Version '+escapeHtml(appVersion)+' · Windows desktop app built with Rust and Tauri.</p><p>File → Open (Ctrl+O), Save (Ctrl+S), or Save as (Ctrl+Shift+S). Switch Write / Split / Source above the document. Export offers Markdown, HTML, and system Print / PDF.</p><p>Developed with assistance from OpenAI Codex. AI assisted with interface design, code, documentation, and testing. This beta still requires human review and feedback.</p><p>Advanced Writer features and the designed MCP agent interface remain planned work.</p>');
  document.addEventListener('keydown',event=>{
    if(!(event.ctrlKey||event.metaKey))return;
    const key=event.key.toLowerCase();
    if(!['o','s','n','w','p','h','t'].includes(key))return;
    if(key==='t'&&!event.shiftKey)return;
    event.preventDefault();event.stopImmediatePropagation();
    if($('#dialog').open)return;
    if(key==='o')nativeOpen();
    else if(key==='s')nativeSave(files[active],{saveAs:event.shiftKey});
    else if(key==='n')newDoc();
    else if(key==='w')closeDocument(files[active]);
    else if(key==='p'){if(event.shiftKey)commandPalette();else{applyPage();window.print();}}
    else if(key==='h')findReplace();
    else if(key==='t'&&event.shiftKey)reopenClosed();
  },true);
  document.addEventListener('documentchange',queueCheckpoint);
  $('#dialog').addEventListener('close',queueCheckpoint);
  $('#dialog').addEventListener('close',()=>{if(incomingPending||incomingDocuments.length)receiveExternalOpen()});
  document.addEventListener('click',event=>{if(event.target.closest('[data-use-template],#save-template'))queueCheckpoint();});
  try{
    const boot=await invoke('bootstrap');dataDirectory=boot.dataDirectory;appVersion=boot.version;
    try{await FontManager.connect(invoke);}catch(error){toast('System font list unavailable: '+String(error));}
    WikiLinks.connect({invoke,adoptDocuments});
    SelectionTools.connect({invoke});
    const stored=boot.workspace;
    localHistory=stored?.history&&typeof stored.history==='object'?Object.fromEntries(Object.entries(stored.history).map(([id,entries])=>[id,Array.isArray(entries)?entries.filter(entry=>typeof entry.source==='string'&&Number.isFinite(entry.at)).slice(-20):[]])):{};
    for(const id of Array.isArray(stored?.restorePending)?stored.restorePending:[])if(typeof id==='string')restorePending.add(id);
    files=Array.isArray(stored?.files)?stored.files.filter(file=>typeof file.id==='string'&&typeof file.name==='string'&&typeof file.html==='string'):[];
    files.forEach(file=>{file.html=sanitize(file.html);WikiLinks.repairStored(file);file.sourceHtml=file.html;file.sourceText=sourceOf(file);});
    documentState=new DocumentState(files,()=>{});documentState.saved.clear();
    for(const snapshot of stored?.saved||[]){
      const file=files.find(file=>file.id===snapshot.id);
      if(file)documentState.saved.set(file,WikiLinks.repairStored(structuredClone(snapshot)));
    }
    for(const doc of boot.disks){
      const file=files.find(file=>file.id===doc.id),saved=file&&documentState.saved.get(file);
      if(file&&saved&&JSON.stringify(file)===JSON.stringify(saved)){
        Object.assign(file,fileFromDisk(doc));documentState.saved.set(file,structuredClone(file));
      }
    }
    // Missing native paths become recoverable drafts rather than write targets.
    const openedIds=new Set(boot.disks.map(doc=>doc.id));
    files.forEach(file=>{if(file.nativePath&&!openedIds.has(file.id)){delete file.nativePath;delete file.nativeRevision;documentState.saved.delete(file);}});
    templates=Array.isArray(stored?.templates)?stored.templates.filter(value=>typeof value.id==='string'&&typeof value.name==='string'&&typeof value.html==='string'):[];
    templates.forEach(template=>template.html=sanitize(template.html));
    recentDocuments=Array.isArray(stored?.recent)?stored.recent:[];
    viewStates=stored?.viewStates&&typeof stored.viewStates==='object'?stored.viewStates:{};
    outlineCollapsed=stored?.outlineCollapsed&&typeof stored.outlineCollapsed==='object'?stored.outlineCollapsed:{};
    closedDocuments=Array.isArray(stored?.closedDocuments)?stored.closedDocuments.filter(id=>typeof id==='string').slice(0,10):[];
    openDocuments=files.filter(file=>(stored?.openDocuments||[]).includes(file.id));
    active=-1;ready=true;
    adoptDocuments(boot.launch);
    const first=boot.launch.length?files[active]:openDocuments.find(file=>file.id===stored?.active)||openDocuments[0];
    if(first)openFile(files.indexOf(first),{capture:false});else emptyEditor();
    observedDocuments.clear();files.forEach(file=>observedDocuments.set(file,JSON.stringify(file)));
    $('.prototype').textContent=(boot.version.includes('dev')?'PREVIEW ':'BETA ')+boot.version;$('.workspace-bottom small').textContent='Local files · portable workspace';
    ribbon('Home');app.inert=false;
    await window.__TAURI__.event.listen('native-close-requested',closeWindow);
    await window.__TAURI__.event.listen('native-open-requested',receiveExternalOpen);
    projects=await installProjectUI({invoke,listen:window.__TAURI__.event.listen,adoptDocuments,fileFromDisk,queueCheckpoint,nativeSave,showError,queues,autosaveTimers,sourceOf});
    const tableQuick=installTableQuickActions();
    const previousSidebar=renderSidebar;
    renderSidebar=()=>side==='outline'?renderOutline():previousSidebar();
    $('#canvas-scroll').addEventListener('scroll',updateOutlineCurrent,{passive:true});
    SidebarDock.refresh();
    await invoke('desktop_ready');
    await projects.checkExternal();
    if(boot.warnings.length)showError('Some files need attention',boot.warnings.join('\n'));
    await checkpoint();
    if(boot.smokeTest){
      try{
        autosaveEnabled=false;
        const results=[];
        const check=(condition,label)=>{if(!condition)throw Error(label);results.push(label);};
        check(document.body.classList.contains('dark')&&appearance.dark.main==='#0b121e'&&appearance.dark.accent==='#df873a','A fresh workspace defaults to the requested navy and orange dark theme');
        check(RibbonUI.collapsed&&$('#profile').textContent==='MD','A fresh workspace starts with a collapsed ribbon and MD initials');
        check(['appearance','theme','profile'].every(id=>getComputedStyle($('#'+id)).display!=='none'&&$('#'+id).getBoundingClientRect().width>0),'Appearance, theme and profile controls remain visible in the default compact header');
        let printCalls=0,printCopy=null;
        printForTest=()=>{printCalls++;printCopy=$('#print-document');};
        const printMode=mode,printZoom=documentZoom;
        setMode('source');zoom(175);
        ribbon('File');$('#ribbon [data-action="print"]').click();
        const untilPrint=async count=>{const deadline=Date.now()+6000;while(printCalls<count){if(Date.now()>deadline)throw Error('Print action did not reach the system print method');await new Promise(resolve=>setTimeout(resolve,30));}};
        await untilPrint(1);
        check(printCopy?.textContent.includes('Native smoke test')&&!printCopy.style.height&&!printCopy.style.maskImage,'Print uses a clean document snapshot without screen pagination or zoom');
        check(mode==='source'&&documentZoom===175,'Printing preserves Source mode and document zoom');
        window.dispatchEvent(new Event('afterprint'));
        check(!$('#print-document')&&!document.body.classList.contains('printing-document'),'Closing or cancelling print clears the temporary snapshot');
        exportDialog();$('[data-export="pdf"]').click();await untilPrint(2);
        check(!$('#dialog').open&&printCalls===2,'Export PDF closes its menu and calls the preserved system print method once');
        window.dispatchEvent(new Event('afterprint'));
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'p',ctrlKey:true,bubbles:true,cancelable:true}));await untilPrint(3);
        check(printCalls===3,'Ctrl+P uses the same working print path');
        window.dispatchEvent(new Event('afterprint'));printForTest=null;
        setMode(printMode);zoom(printZoom);ribbon('Home');
        const file=files[active],source=sourceOf(file);
        check(!!file.nativePath,'Native file opened');
        zoom(200);$('#zoom-in').click();
        check(documentZoom===200&&$('#zoom-in').disabled,'Quick document zoom stops at 200%');
        customZoomDialog();$('#custom-zoom').value='800';$('#custom-zoom-form button[type=submit]').click();
        check(documentZoom===800&&$('#zoom-label').textContent==='800%','Custom document zoom accepts 800%');
        check(!zoom(0)&&documentZoom===800,'Invalid custom zoom leaves the previous view intact');
        setInterfaceZoom(125);setProfileInitials('xy');
        appearanceDialog('interface');
        check($('#ui-zoom-number').value==='125'&&$('#profile-initials').value==='XY','Appearance shares interface zoom and editable initials');
        check(Math.abs($('.app').getBoundingClientRect().height-innerHeight)<3,'UI scaling fits the application to the window');
        check($('#dialog').getBoundingClientRect().height<=innerHeight,'Appearance remains accessible after UI scaling');
        $('#dialog').close();theme();
        check(interfaceSettings.zoom===125&&$('#profile').textContent==='XY'&&documentZoom===800,'Theme changes preserve UI preferences and independent document zoom');
        readInterfaceSettings();applyInterfaceSettings();
        check(interfaceSettings.zoom===125&&interfaceSettings.initials==='XY','Interface preferences persist');
        $('#profile').click();$('#profile-initials').value='ab';$('#profile-form button[type=submit]').click();
        check($('#profile').textContent==='AB','Avatar initials can be edited directly');
        setInterfaceZoom(100);setProfileInitials('KF');zoom(100);
        const paginationDetails=await runPaginationChecks(check);
        await runFeatureChecks(check,{invoke,projects});
        await runEditingChecks(check,{invoke});
        await runCustomizationChecks(check,{invoke,projects});
        RibbonUI.setCollapsed(false);action('focus');
        check(RibbonUI.focused&&RibbonUI.collapsed&&getComputedStyle($('#navigator')).display==='none'&&getComputedStyle($('#inspector')).display==='none','Focus mode collapses the ribbon and hides both sidebars, including the docked right panel');
        $('#paper').focus();check(getComputedStyle($('#paper')).outlineStyle==='none','Focused document page has no orange outline');
        action('focus');check(!RibbonUI.focused&&RibbonUI.collapsed&&getComputedStyle($('#inspector')).display!=='none','Leaving Focus restores both sidebars while keeping the compact header');
        RibbonUI.setCollapsed(false);
        openFile(files.indexOf(file));
        // Actual second process, including relative paths, spaces, Unicode, and a duplicate.
        openDialog('Single-instance test','<p>Incoming files wait until this dialog closes.</p>');
        await invoke('smoke_launch_secondary');
        check(!openDocuments.some(doc=>doc.name==='Explorer one.md'),'Explorer requests wait while a dialog is open');
        $('#dialog').close();await receiveExternalOpen();await incomingRequests;
        check(openDocuments.filter(doc=>doc.name==='Explorer one.md').length===1&&openDocuments.filter(doc=>doc.name==='Explorer 二.md').length===1,'A second process opens two unique tabs in the existing window');
        for(const forwarded of openDocuments.slice().filter(document=>document!==file))await closeDocument(forwarded);
        openFile(files.indexOf(file));
        setMode('source');setMode('write');setMode('split');setMode('write');
        check(sourceOf(file)===source,'Mode switches preserve exact Markdown');
        check($('#paper table')?.rows.length===2,'GFM table rendered');
        findReplace();$('#document-find').value='Native smoke test';$('#document-find').dispatchEvent(new Event('input'));
        check($('#find-count').textContent.includes('1 match'),'Document Find counts text in the active Markdown source');
        $('#document-replace').value='Native local test';$('#replace-one').click();
        check(sourceOf(file).includes('Native local test')&&!sourceOf(file).includes('Native smoke test'),'Replace Next changes only the selected Markdown match');
        $('#dialog').close();applySource(source);setMode('write');
        const smokeCell=$('#paper table td');if(smokeCell){const range=document.createRange(),selected=window.getSelection();range.selectNodeContents(smokeCell);range.collapse(true);selected.removeAllRanges();selected.addRange(range);selection=range.cloneRange();tableEditor();$('#dialog [data-table-edit="row-after"]').click();check($('#paper table').rows.length===3,'Table editor adds a row at the selected cell');applySource(source);setMode('write');}
        const quickTable=$('#paper table');if(quickTable){const rect=quickTable.getBoundingClientRect(),beforeRows=quickTable.rows.length,beforeColumns=quickTable.rows[0].cells.length;
          const rowEdge=quickTable.rows[0].getBoundingClientRect().bottom,columnCrossing=quickTable.rows[0].cells[1].getBoundingClientRect().left;
          tableQuick.hover(quickTable,columnCrossing,rowEdge+12);
          check(!tableQuick.element.hidden&&tableQuick.element.classList.contains('table-insert-row'),'Row guide remains easy to select near a column crossing');
          tableQuick.hover(quickTable,rect.left+rect.width/2,rowEdge);
          check(!tableQuick.element.hidden&&tableQuick.element.classList.contains('table-insert-row'),'Hovering a row separator highlights it and shows a plus');
          check(getComputedStyle(tableQuick.element.querySelector('.table-insert-line')).backgroundColor===getComputedStyle(document.body).getPropertyValue('--green').trim()||getComputedStyle(tableQuick.element.querySelector('.table-insert-line')).backgroundColor===getComputedStyle($('.primary')).backgroundColor,'Table insertion guide follows the active theme accent');
          tableQuick.element.querySelector('button').click();
          check($('#paper table')?.rows[1]?.getBoundingClientRect().height>=40,'Inserted empty table row retains a usable height');
          const columnEdge=quickTable.rows[0].cells[1].getBoundingClientRect().left;tableQuick.hover(quickTable,columnEdge,quickTable.rows[0].getBoundingClientRect().top+12);
          check(!tableQuick.element.hidden&&tableQuick.element.classList.contains('table-insert-column'),'Hovering a column separator highlights it and shows a plus');tableQuick.element.querySelector('button').click();
          check(quickTable.rows.length===beforeRows+1&&quickTable.rows[0].cells.length===beforeColumns+1,'Separator pluses add one row below and one column to the left');applySource(source);setMode('write');}
        const insertRange=document.createRange(),insertSelection=window.getSelection();insertRange.selectNodeContents($('#paper'));insertRange.collapse(false);insertSelection.removeAllRanges();insertSelection.addRange(insertRange);selection=insertRange.cloneRange();
        action('table');check($$('#table-picker-grid [data-rows]').length===80,'Home Table opens an 8 by 10 size picker');$('#table-picker-grid [data-rows="4"][data-columns="5"]').click();
        const inserted=$$('#paper table').at(-1);check(inserted?.rows.length===4&&inserted.rows[0].cells.length===5,'Choosing a grid size inserts exactly that many rows and columns');applySource(source);setMode('write');
        recordVersion(file,source,true);showHistory();check($('[data-history-compare]')!==null,'Local version history lists an exact saved source');
        $('[data-history-compare]').click();check($('#dialog-title').textContent==='Compare versions'&&$('#history-back'),'Version history opens a non-destructive line comparison');$('#history-back').click();$('#dialog').close();
        commandPalette();$('#command-query').value='check links';$('#command-query').dispatchEvent(new Event('input'));check($$('#command-results [data-command]').length===1,'Command palette searches action names and descriptions');$('#dialog').close();
        applySource(source+'\n## Second section\n### Nested section\n[missing](#no-such-heading)\n');setMode('write');side='outline';renderOutline();
        check($$('[data-outline-jump]').length>=3&&$('[data-outline-fold]'),'Document outline nests headings and exposes fold controls');
        $('[data-outline-fold]').click();check($$('[data-outline-jump]').length<$$('#paper h1,#paper h2,#paper h3').length,'Outline branches collapse without changing document text');
        checkLinks();check($('#dialog-content').textContent.includes('Heading not found'),'Link checker identifies a broken heading destination');$('#dialog').close();
        side='files';applySource(source);setMode('write');
        const clipboard=new DataTransfer();clipboard.setData('text/plain','Name\tValue\nOne\t2');
        const end=document.createRange();end.selectNodeContents($('#paper'));end.collapse(false);const pasted=window.getSelection();pasted.removeAllRanges();pasted.addRange(end);selection=end.cloneRange();
        $('#paper').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:clipboard}));
        check($$('#paper table').length===2,'Spreadsheet clipboard cells paste as an editable Markdown table');applySource(source);
        setMode('source');$('#source').setSelectionRange(3,3);documentState.saved.set(file,structuredClone(file));await closeDocument(file);reopenClosed();
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        check(openDocuments.includes(file)&&$('#source').selectionStart===3,'Reopen closed tab restores the document and its source caret');setMode('write');
        const svg=await renderDiagram('flowchart LR\n A[Open] --> B[Save]');
        check(svg.includes('<svg'),'Offline Mermaid renderer works');
        const noteSource='Alpha beta gamma delta epsilon.\n',noteHtml=renderMarkdown(noteSource);
        const annotated={id:crypto.randomUUID(),name:'Footnotes smoke.md',html:noteHtml,sourceHtml:noteHtml,sourceText:noteSource};
        files.push(annotated);openFile(files.indexOf(annotated));setMode('source');showFootnotes();
        const postNote=(word,text,sign=false)=>{
          const offset=$('#source').value.indexOf(word)+word.length;$('#source').setSelectionRange(offset,offset);
          $('#footnote-text').value=text;$('#footnote-signature').checked=sign;$('#post-footnote').click();
        };
        postNote('Alpha','First **bold** note.\nSecond line.',true);
        postNote('beta','Second note.');postNote('gamma','Third note.');postNote('epsilon','Last note.');
        check(footnoteModel().notes.length===4&&footnoteModel().notes[0].text==='First **bold** note.\nSecond line. -KF'&&footnoteModel().notes[1].text==='Second note.','Footnotes use optional current initials and retain multiline Markdown');
        setMode('write');
        const walker=document.createTreeWalker($('#paper'),NodeFilter.SHOW_TEXT);let textNode;
        while(walker.nextNode())if(walker.currentNode.textContent.includes('delta')){textNode=walker.currentNode;break;}
        const range=document.createRange();range.setStart(textNode,textNode.textContent.indexOf('delta')+5);range.collapse(true);selection=range;
        $('#footnote-text').value='Inserted between three and four.';$('#footnote-signature').checked=false;$('#post-footnote').click();
        check(footnoteModel().notes[3].text==='Inserted between three and four.'&&footnoteModel().notes[4].text==='Last note.'&&$$('#paper [data-footnote-ref]').map(node=>node.textContent).join(',')==='1,2,3,4,5','Inserting in Write between footnotes 3 and 4 shifts the old 4 to 5');
        $('[data-footnote-delete="2"]').click();
        check(footnoteModel().notes.length===4&&$$('#paper [data-footnote-ref]').map(node=>node.textContent).join(',')==='1,2,3,4'&&!sourceOf(annotated).includes('Second note.'),'Deleting a footnote removes its reference and closes the numbering gap');
        $('[data-footnote-edit="4"]').click();$('#footnote-text').value='Edited last note.';$('#post-footnote').click();
        check(footnoteModel().notes[3].text==='Edited last note.','Existing footnotes can be edited in the same inspector');
        const annotatedSource=sourceOf(annotated);setMode('source');setMode('write');
        check(sourceOf(annotated)===annotatedSource&&$('#paper .footnote-body strong')?.textContent==='bold','Footnotes survive Write and Source round trips with formatting');
        const rendered=renderMarkdown(annotatedSource),roundTrip=markdown(rendered);
        check(Footnotes.parse(roundTrip).notes.map(note=>note.text).join('|')===footnoteModel().notes.map(note=>note.text).join('|')&&$$('#paper [data-footnotes] li').length===4,'Markdown reload retains footnote text and print-ready definitions');
        const namedSource=annotatedSource.replaceAll('[^1]','[^named]');
        annotated.sourceText=namedSource;annotated.html=renderMarkdown(namedSource);annotated.sourceHtml=annotated.html;$('#paper').innerHTML=annotated.html;
        $('#paper p').append(document.createTextNode(' Another word.'));save();
        check(footnoteModel().notes[0].id==='named'&&$('#paper [data-footnote-ref]').dataset.footnoteRef==='named'&&$('[data-footnote-edit="named"]'),'Named footnote identities stay consistent while typing in Write');
        openFile(files.indexOf(file));check($('#footnote-count').textContent==='0','Footnotes stay separate between documents');
        openFile(files.indexOf(annotated));check($('#footnote-count').textContent==='4','Returning to a document restores its footnotes');
        const discardNotes=closeDocument(annotated);$('#native-discard').click();await discardNotes;setInspection('details');
        file.sourceText=source+'\n\nSaved by Rust with a footnote[^1].\n\n[^1]: Saved with the document. -KF\n';file.html=renderMarkdown(file.sourceText);file.sourceHtml=file.html;$('#paper').innerHTML=file.html;
        check(await nativeSave(file,{quiet:true}),'Native save completed');
        check(!documentState.isDirty(file),'Saved snapshot committed after disk write');
        const draft={id:crypto.randomUUID(),name:'Unsaved smoke.md',html:'<p>Keep draft</p>',sourceHtml:'<p>Keep draft</p>',sourceText:'Keep draft'};
        files.push(draft);openFile(files.indexOf(draft));
        file.sourceText+='\nInactive tab save.\n';file.html=renderMarkdown(file.sourceText);file.sourceHtml=file.html;
        check(await nativeSave(file,{quiet:true}),'Inactive tab saved');
        check(documentState.isDirty(draft),'Saving one file leaves another draft unsaved');
        const cancelClose=closeDocument(draft);$('#native-cancel').click();await cancelClose;
        check(openDocuments.includes(draft)&&files[active]===draft,'Cancel keeps an unsaved tab open');
        const discardClose=closeDocument(draft);$('#native-discard').click();await discardClose;
        check(!files.includes(draft)&&files[active]===file,'Discard removes draft and displays the remaining file');
        const savedSource=documentState.saved.get(file).sourceText;
        const diskSource=await invoke('smoke_external_change');
        check(diskSource.includes('[^1]: Saved with the document. -KF'),'Native disk save includes portable Markdown footnotes');
        file.sourceText+='\nUnsaved after external change.\n';file.html=renderMarkdown(file.sourceText);file.sourceHtml=file.html;$('#paper').innerHTML=file.html;
        check(!await nativeSave(file,{quiet:true}),'External change blocks a stale save');
        check(documentState.isDirty(file)&&documentState.saved.get(file).sourceText===savedSource,'Failed save preserves the buffer and saved snapshot');
        $('#native-error-ok')?.click();await checkpoint();
        await projects.smokeTest(check);
        await invoke('smoke_result',{result:{ok:true,checks:results,pagination:paginationDetails}});
      }catch(error){await invoke('smoke_result',{result:{ok:false,error:String(error)}});}
    }
  }catch(error){
    app.inert=false;showError('Could not load the desktop workspace',error);
    await invoke('smoke_result',{result:{ok:false,error:String(error)}}).catch(()=>{});
  }
})();
