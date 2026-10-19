// The packaged app's native integration. Browser design previews do not load this file.
// Rust owns disk access and file dialogs; the approved interface stays shared.
(async function(){
  if(!window.__TAURI__)return;
  const {invoke}=window.__TAURI__.core;
  const app=$('.app');app.inert=true;
  const {marked,TurndownService,gfm}=window.EditorMarkdown;
  const fence=String.fromCharCode(96).repeat(3);
  const converter=new TurndownService({headingStyle:'atx',codeBlockStyle:'fenced',bulletListMarker:'-'});
  converter.use(gfm);
  converter.addRule('mermaid',{filter:node=>node.hasAttribute('data-mermaid'),replacement:(_,node)=>'\n\n'+fence+'mermaid\n'+node.getAttribute('data-mermaid')+'\n'+fence+'\n\n'});
  converter.addRule('richCharacters',{filter:node=>['SUB','SUP','U','MARK','FONT'].includes(node.nodeName)||(['SPAN','P','DIV','H1','H2','H3','H4','H5','H6'].includes(node.nodeName)&&!!node.getAttribute('style')),replacement:(_,node)=>'\n'.repeat(['P','DIV','H1','H2','H3','H4','H5','H6'].includes(node.nodeName)?2:0)+node.outerHTML});
  markdown=html=>converter.turndown(html);
  renderMarkdown=source=>{
    const template=document.createElement('template');
    template.innerHTML=marked.parse(source,{gfm:true});
    template.content.querySelectorAll('pre>code.language-mermaid').forEach(code=>{
      const figure=document.createElement('figure');figure.className='diagram-block';figure.contentEditable='false';
      figure.dataset.mermaid=code.textContent.replace(/\n$/,'');code.parentElement.replaceWith(figure);
    });
    return sanitize(template.innerHTML);
  };
  const queues=new Map(),autosaveTimers=new Map();
  let workspaceQueue=Promise.resolve(),checkpointTimer,ready=false,closePending=false,dataDirectory='';
  const pageOf=file=>({...defaultPage,...file.page});
  const sourceOf=file=>typeof file.sourceText==='string'?file.sourceText:markdown(file.html);
  const cleanHtml=()=>{
    const copy=$('#paper').cloneNode(true);
    copy.querySelectorAll('[data-mermaid]').forEach(block=>{
      block.innerHTML='';
      for(const attr of [...block.attributes])if(attr.name.startsWith('data-render'))block.removeAttribute(attr.name);
    });
    return copy.innerHTML;
  };
  captureDocument=()=>{
    if(active<0)return;
    const file=files[active],html=cleanHtml();
    if(file.sourceHtml!==html){file.sourceText=markdown(html);file.sourceHtml=html;}
    file.html=html;
  };
  const designOpen=openFile;
  openFile=(index,options={})=>{
    designOpen(index,options);
    if(files[active])$('#source').value=sourceOf(files[active]);
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
      openDocuments:openDocuments.map(f=>f.id),active:files[active]?.id||null,templates:structuredClone(templates),recent:structuredClone(recentDocuments)};
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
    $('#save-state').textContent=!file?'No document open':dirty?(file.nativePath?'● Unsaved changes':'● Unsaved draft'):'✓ Saved to disk';
    $('#save-state').classList.toggle('unsaved',dirty);updateTabSaveMarkers();
    $('.window-title').textContent=file?file.name+' — Editor, MD':'Editor, MD — Beta';
    if(file)$('#breadcrumb').title=file.nativePath||'Unsaved draft';
    return dirty;
  };
  async function performSave(file,{saveAs=false,quiet=false}={}){
    if(!files.includes(file))return false;
    if(files[active]===file)captureDocument();
    const snapshot=structuredClone(file);
    try{
      const result=await invoke('save_document',{id:file.id,name:file.name,source:sourceOf(snapshot),page:pageOf(snapshot),expectedRevision:file.nativeRevision||null,saveAs});
      if(!result)return false;
      const location={name:result.name,nativePath:result.path,nativeRevision:result.revision};
      Object.assign(file,location);Object.assign(snapshot,location);
      documentState.saved.set(file,snapshot);
      updateSaveState();renderTabs();renderSidebar();touchRecent(file,'edited');
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
  save=({manual=false,all=false}={})=>{
    if(!ready)return false;
    captureDocument();recordDocumentEdit(files[active]);updateSaveState();updateStats();
    document.dispatchEvent(new Event('documentchange'));queueCheckpoint();
    if(manual){nativeSave();return false;}
    if(autosaveEnabled){
      for(const file of all?files:files[active]?[files[active]]:[]){
        if(file.nativePath&&documentState.isDirty(file)){
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
  async function nativeOpen(){
    try{
      const docs=await invoke('open_documents');
      for(const doc of docs){
        const existing=files.find(file=>file.id===doc.id||file.nativePath===doc.path);
        if(existing&&documentState.isDirty(existing)){openFile(files.indexOf(existing));toast('Kept the open unsaved buffer');continue;}
        const value=fileFromDisk(doc),file=existing||value;
        if(existing)Object.assign(existing,value);else files.push(file);
        documentState.saved.set(file,structuredClone(file));openFile(files.indexOf(file));
      }
      await checkpoint();
    }catch(error){showError('Could not open Markdown',error);}
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
    const current=files[active],wasActive=current===file,position=openDocuments.indexOf(file);
    captureDocument();clearTimeout(autosaveTimers.get(file.id));
    if(queues.has(file.id))await queues.get(file.id);
    if(documentState.isDirty(file)){
      const choice=await askToSave(file);
      if(choice==='cancel')return;
      if(choice==='save'){if(!await nativeSave(file))return;}
      else{
        documentState.discard(file);
        if(!files.includes(file))recentDocuments=recentDocuments.filter(entry=>entry.id!==file.id);
      }
    }
    openDocuments=openDocuments.filter(value=>value!==file);
    if(wasActive||!files.includes(current)){
      const next=openDocuments[Math.min(position,openDocuments.length-1)];
      if(next)openFile(files.indexOf(next),{capture:false});else emptyEditor();
    }else{active=files.indexOf(current);renderTabs();renderSidebar();updateSaveState();}
    await checkpoint();
  };
  async function closeWindow(){
    if(closePending||!ready)return;closePending=true;
    try{
      captureDocument();
      for(const timer of autosaveTimers.values())clearTimeout(timer);
      await Promise.all([...queues.values()]);
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
  window.print=()=>invoke('print_document').catch(error=>showError('Could not print',error));
  Object.assign(officeActions,{
    'save-now':()=>nativeSave(),
    storage:()=>openDialog('Workspace data','<p>Documents are saved as local UTF-8 Markdown files. Templates, recovery buffers, and settings stay in this data folder:</p><p style="overflow-wrap:anywhere">'+escapeHtml(dataDirectory)+'</p><p>Keep EditorMD-data beside the executable when moving the portable app. Unsaved recovery buffers do not overwrite your Markdown files.</p>'),
    print:()=>{applyPage();window.print();}
  });
  const designRibbon=ribbon;
  ribbon=tab=>{
    designRibbon(tab);
    if(tab==='File'){
      const group=document.createElement('div');group.className='ribbon-group';
      group.innerHTML='<div class="ribbon-row"><button class="large-tool" id="native-open">'+icon('folder')+'<span>Open…</span></button><button class="large-tool" id="native-save-as">'+icon('download')+'<span>Save as…</span></button></div><div class="ribbon-label">Local files</div>';
      $('#ribbon').prepend(group);$('#native-open').onclick=nativeOpen;$('#native-save-as').onclick=()=>nativeSave(files[active],{saveAs:true});$('#native-save-as').disabled=active<0;
    }
  };
  $('#about').onclick=()=>openDialog('Editor, MD — Beta','<p><strong>A healthy place for your words.</strong></p><p>Version 0.1.0-beta.1 · Windows desktop app built with Rust and Tauri.</p><p>File → Open (Ctrl+O), Save (Ctrl+S), or Save as (Ctrl+Shift+S). Switch Write / Split / Source above the document. Export offers Markdown, HTML, and system Print / PDF.</p><p>Developed with assistance from OpenAI Codex. AI assisted with interface design, code, documentation, and testing. This beta still requires human review and feedback.</p><p>Advanced Writer features and the designed MCP agent interface remain planned work.</p>');
  document.addEventListener('keydown',event=>{
    if(!(event.ctrlKey||event.metaKey))return;
    const key=event.key.toLowerCase();
    if(!['o','s','n','w','p'].includes(key))return;
    event.preventDefault();event.stopImmediatePropagation();
    if($('#dialog').open)return;
    if(key==='o')nativeOpen();
    else if(key==='s')nativeSave(files[active],{saveAs:event.shiftKey});
    else if(key==='n')newDoc();
    else if(key==='w')closeDocument(files[active]);
    else if(key==='p'){applyPage();window.print();}
  },true);
  document.addEventListener('documentchange',queueCheckpoint);
  $('#dialog').addEventListener('close',queueCheckpoint);
  document.addEventListener('click',event=>{if(event.target.closest('[data-use-template],#save-template'))queueCheckpoint();});
  try{
    const boot=await invoke('bootstrap');dataDirectory=boot.dataDirectory;
    const stored=boot.workspace;
    files=Array.isArray(stored?.files)?stored.files.filter(file=>typeof file.id==='string'&&typeof file.name==='string'&&typeof file.html==='string'):[];
    files.forEach(file=>{file.html=sanitize(file.html);file.sourceHtml=file.html;file.sourceText=sourceOf(file);});
    documentState=new DocumentState(files,()=>{});documentState.saved.clear();
    for(const snapshot of stored?.saved||[]){
      const file=files.find(file=>file.id===snapshot.id);
      if(file)documentState.saved.set(file,structuredClone(snapshot));
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
    openDocuments=files.filter(file=>(stored?.openDocuments||[]).includes(file.id));
    for(const doc of boot.launch){
      const file=fileFromDisk(doc);files.push(file);openDocuments.push(file);documentState.saved.set(file,structuredClone(file));
    }
    comments=[];active=-1;ready=true;
    const first=openDocuments.find(file=>file.id===stored?.active)||openDocuments[0];
    if(first)openFile(files.indexOf(first),{capture:false});else emptyEditor();
    observedDocuments.clear();files.forEach(file=>observedDocuments.set(file,JSON.stringify(file)));
    $('.prototype').textContent='BETA 0.1.0';$('.workspace-bottom small').textContent='Local files · portable workspace';
    ribbon('Home');app.inert=false;
    await window.__TAURI__.event.listen('native-close-requested',closeWindow);
    await invoke('desktop_ready');
    if(boot.warnings.length)showError('Some files need attention',boot.warnings.join('\n'));
    await checkpoint();
    if(boot.smokeTest){
      try{
        autosaveEnabled=false;
        const results=[];
        const check=(condition,label)=>{if(!condition)throw Error(label);results.push(label);};
        const file=files[active],source=sourceOf(file);
        check(!!file.nativePath,'Native file opened');
        setMode('source');setMode('write');setMode('split');setMode('write');
        check(sourceOf(file)===source,'Mode switches preserve exact Markdown');
        check($('#paper table')?.rows.length===2,'GFM table rendered');
        const svg=await renderDiagram('flowchart LR\n A[Open] --> B[Save]');
        check(svg.includes('<svg'),'Offline Mermaid renderer works');
        file.sourceText=source+'\n\nSaved by Rust.\n';file.html=renderMarkdown(file.sourceText);file.sourceHtml=file.html;$('#paper').innerHTML=file.html;
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
        await invoke('smoke_external_change');
        file.sourceText+='\nUnsaved after external change.\n';file.html=renderMarkdown(file.sourceText);file.sourceHtml=file.html;$('#paper').innerHTML=file.html;
        check(!await nativeSave(file,{quiet:true}),'External change blocks a stale save');
        check(documentState.isDirty(file)&&documentState.saved.get(file).sourceText===savedSource,'Failed save preserves the buffer and saved snapshot');
        $('#native-error-ok')?.click();await checkpoint();
        await invoke('smoke_result',{result:{ok:true,checks:results}});
      }catch(error){await invoke('smoke_result',{result:{ok:false,error:String(error)}});}
    }
  }catch(error){
    app.inert=false;showError('Could not load the desktop workspace',error);
    await invoke('smoke_result',{result:{ok:false,error:String(error)}}).catch(()=>{});
  }
})();
