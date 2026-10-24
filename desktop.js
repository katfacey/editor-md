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
  const queues=new Map(),autosaveTimers=new Map();
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
    if(projects?.state.external.has(file.id)&&!saveAs){
      if(projects.state.external.get(file.id).kind==='missing'&&!quiet)saveAs=true;
      else{if(!quiet)projects.reviewExternal(file);return false;}
    }
    if(files[active]===file)captureDocument();
    const snapshot=structuredClone(file);
    try{
      const result=await invoke('save_document',{id:file.id,name:file.name,source:sourceOf(snapshot),page:pageOf(snapshot),expectedRevision:file.nativeRevision||null,saveAs});
      if(!result)return false;
      const location={name:result.name,nativePath:result.path,nativeRevision:result.revision};
      Object.assign(file,location);Object.assign(snapshot,location);
      documentState.saved.set(file,snapshot);
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
        if(file.nativePath&&documentState.isDirty(file)&&!projects?.state.external.has(file.id)){
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
      group.innerHTML='<div class="ribbon-row"><button class="large-tool" id="native-open">'+icon('folder')+'<span>Open…</span></button><button class="large-tool" id="native-save-as">'+icon('save')+'<span>Save as…</span></button></div><div class="ribbon-label">Local files</div>';
      $('#ribbon').prepend(group);$('#native-open').onclick=nativeOpen;$('#native-save-as').onclick=()=>nativeSave(files[active],{saveAs:true});$('#native-save-as').disabled=active<0;
    }
  };
  $('#about').onclick=()=>openDialog('Editor, MD — Beta','<p><strong>A healthy place for your words.</strong></p><p>Version '+escapeHtml(appVersion)+' · Windows desktop app built with Rust and Tauri.</p><p>File → Open (Ctrl+O), Save (Ctrl+S), or Save as (Ctrl+Shift+S). Switch Write / Split / Source above the document. Export offers Markdown, HTML, and system Print / PDF.</p><p>Developed with assistance from OpenAI Codex. AI assisted with interface design, code, documentation, and testing. This beta still requires human review and feedback.</p><p>Advanced Writer features and the designed MCP agent interface remain planned work.</p>');
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
  $('#dialog').addEventListener('close',()=>{if(incomingPending||incomingDocuments.length)receiveExternalOpen()});
  document.addEventListener('click',event=>{if(event.target.closest('[data-use-template],#save-template'))queueCheckpoint();});
  try{
    const boot=await invoke('bootstrap');dataDirectory=boot.dataDirectory;appVersion=boot.version;
    try{await FontManager.connect(invoke);}catch(error){toast('System font list unavailable: '+String(error));}
    WikiLinks.connect({invoke,adoptDocuments});
    SelectionTools.connect({invoke});
    const stored=boot.workspace;
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
