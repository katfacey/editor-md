// Desktop-only project actions use the same document buffers and save queue.
async function installProjectUI(api){
  const {invoke,listen,adoptDocuments,fileFromDisk,queueCheckpoint,nativeSave,showError,queues,autosaveTimers,sourceOf}=api;
  const state={project:null,error:'',query:'',caseSensitive:false,search:null,searching:false,searchToken:0,expanded:new Set(),external:new Map(),checking:false,pending:false,assets:new Map(),assetErrors:[],watchError:'',watchEvents:0};
  const convert=markdown;markdown=html=>{const root=document.createElement('div');root.innerHTML=html;ProjectModel.cleanAssets(root);return convert(root.innerHTML);};
  let refreshTimer,searchTimer,assetRun=0;
  const banner=document.createElement('div');banner.id='external-status';banner.hidden=true;banner.setAttribute('role','status');$('.canvas-top').after(banner);
  const assetStatus=document.createElement('div');assetStatus.id='attachment-status';assetStatus.hidden=true;banner.after(assetStatus);
  const projectBar=document.createElement('div');projectBar.className='project-bar';projectBar.innerHTML='<button id="open-project" title="Open project folder">'+icon('folder')+'<span id="project-name">Open project folder</span></button><button id="project-refresh" aria-label="Refresh project">↻</button><button id="close-project" aria-label="Close project folder">×</button>';
  $('.workspace-name').after(projectBar);
  const searchTab=document.createElement('button');searchTab.dataset.side='search';searchTab.textContent='Search';$('.sidebar-tabs').append(searchTab);
  searchTab.onclick=()=>showSearch();
  function updateProjectBar(){
    $('#project-name').textContent=state.project?.name||'Open project folder';$('#open-project').title=state.project?.root||'Open project folder';
    $('#close-project').hidden=!state.project;$('#project-refresh').hidden=!state.project;
  }
  async function openProject(){
    try{const project=await invoke('open_project');if(!project)return;state.searchToken++;state.searching=false;state.project=project;state.error='';state.search=null;state.expanded=new Set();side='files';selectSide();updateProjectBar();renderSidebar();queueCheckpoint();clearAssets();hydrateAssets();toast('Opened '+project.name);}
    catch(error){showError('Could not open project',error);}
  }
  $('#open-project').onclick=openProject;
  $('#project-refresh').onclick=()=>refreshFiles(true);
  $('#close-project').onclick=async()=>{try{await invoke('close_project');state.searchToken++;state.searching=false;state.project=null;state.search=null;state.error='';updateProjectBar();renderSidebar();clearAssets();hydrateAssets();toast('Project closed; document tabs stay open');}catch(error){showError('Could not close project',error);}};
  function selectSide(){$$('[data-side]').forEach(button=>button.classList.toggle('selected',button.dataset.side===side));}
  const originalSidebar=renderSidebar;
  renderSidebar=()=>{
    if(side==='search'){renderSearch();return;}
    if(side!=='files'||!state.project){originalSidebar();return;}
    const selected=files[active]?.nativePath&&ProjectModel.relativePath(state.project.root,files[active].nativePath);
    function rows(nodes,depth=0){return nodes.map(node=>node.kind==='folder'?'<button class="project-tree-folder" data-project-folder="'+escapeHtml(node.path)+'" style="--tree-depth:'+depth+'" aria-expanded="'+state.expanded.has(node.path)+'">'+(state.expanded.has(node.path)?'⌄':'›')+' '+icon('folder')+'<span>'+escapeHtml(node.name)+'</span></button>'+(state.expanded.has(node.path)?rows(node.children,depth+1):''):'<button class="project-file '+(selected?.toLowerCase()===node.path.toLowerCase()?'selected':'')+'" data-project-file="'+escapeHtml(node.path)+'" style="--tree-depth:'+depth+'" title="'+escapeHtml(node.path)+'">'+icon(node.kind==='image'?'image':'file')+'<span>'+escapeHtml(node.name)+'</span></button>').join('');}
    $('#sidebar-content').innerHTML='<div class="tree-heading">PROJECT FILES <span>'+state.project.entries.filter(entry=>entry.kind!=='folder').length+'</span></div>'+projectNotices()+rows(ProjectModel.tree(state.project.entries))+(state.project.entries.length?'':'<p class="library-empty">This folder is empty.</p>')+librarySections();
    $$('[data-project-folder]').forEach(button=>button.onclick=()=>{const path=button.dataset.projectFolder;state.expanded.has(path)?state.expanded.delete(path):state.expanded.add(path);renderSidebar();});
    $$('[data-project-file]').forEach(button=>button.onclick=()=>openProjectEntry(button.dataset.projectFile));bindLibrarySections();
  };
  function projectNotices(){
    return (state.error?'<p class="project-notice" role="alert">'+escapeHtml(state.error)+'</p>':'')+(state.watchError?'<p class="project-notice">Some folders could not be monitored. Refresh or refocus the app to check changes.</p>':'')+(state.project?.truncated?'<p class="project-notice">Showing the first 10,000 entries.</p>':'')+(state.project?.warnings.length?'<p class="project-notice">'+state.project.warnings.length+' entries could not be read.</p>':'');
  }
  async function openProjectEntry(path,hit=null){
    const entry=state.project?.entries.find(entry=>entry.path===path);if(!entry)return;
    try{
      if(entry.kind!=='markdown'){await invoke('open_attachment',{id:null,target:path});return;}
      const doc=await invoke('open_project_document',{path});adoptDocuments([doc]);
      if(hit&&!hit.filename){setMode('source');$('#source').focus();$('#source').setSelectionRange(hit.start,hit.end);$('#source').scrollTop=Math.max(0,(hit.line-4)*23);}
      await hydrateAssets();queueCheckpoint();
    }catch(error){showError('Could not open '+entry.name,error);}
  }
  function showSearch(){side='search';selectSide();renderSidebar();$('#project-query')?.focus();}
  function renderSearch(){
    const container=$('#sidebar-content');
    container.innerHTML='<label class="section-label" for="project-query">SEARCH PROJECT</label><input id="project-query" type="search" placeholder="Words or filename…" autocomplete="off"><label class="project-match-case"><input type="checkbox" id="project-match-case"> Match case</label><p id="project-search-summary" aria-live="polite"></p><div id="project-search-results"></div>';
    $('#project-query').value=state.query;$('#project-match-case').checked=state.caseSensitive;
    $('#project-query').oninput=event=>{state.query=event.target.value;clearTimeout(searchTimer);state.searchToken++;searchTimer=setTimeout(runSearch,200);};
    $('#project-match-case').onchange=event=>{state.caseSensitive=event.target.checked;runSearch();};renderSearchResults();
  }
  function renderSearchResults(){
    const results=$('#project-search-results'),summary=$('#project-search-summary');if(!results)return;
    if(!state.project){summary.textContent='Open a project folder to search all its files.';results.innerHTML='<button class="primary" id="search-open-project">Open project folder</button>';$('#search-open-project').onclick=openProject;return;}
    summary.textContent=state.searching?'Searching…':state.searchError|| (state.search?(state.search.hits.length+' results · '+state.search.searched+' Markdown files searched'+(state.search.truncated?' · results limited':'')+(state.search.warnings.length?' · '+state.search.warnings.length+' files skipped':'')):'Search includes unopened files and unsaved document edits.');
    results.innerHTML=state.search?.hits.map((hit,index)=>'<button class="project-search-hit" data-search-hit="'+index+'"><strong>'+escapeHtml(hit.path)+'</strong><small>'+ (hit.filename?'Filename':'Line '+hit.line)+'</small><span>'+escapeHtml(hit.excerpt)+'</span></button>').join('')||'';
    $$('[data-search-hit]').forEach(button=>button.onclick=()=>{const hit=state.search.hits[+button.dataset.searchHit];openProjectEntry(hit.path,hit);});
  }
  async function runSearch(){
    if(!state.project)return;captureDocument();const token=++state.searchToken,query=state.query;
    if(!query.trim()){state.search=null;state.searchError='';state.searching=false;renderSearchResults();return;}
    state.searching=true;state.searchError='';renderSearchResults();
    const buffers=files.filter(file=>file.nativePath&&documentState.isDirty(file)&&ProjectModel.relativePath(state.project.root,file.nativePath)!==null).map(file=>({path:ProjectModel.relativePath(state.project.root,file.nativePath),source:sourceOf(file)}));
    try{const result=await invoke('search_project',{query,caseSensitive:state.caseSensitive,buffers});if(token!==state.searchToken)return;state.search=result;}
    catch(error){if(token!==state.searchToken)return;state.search=null;state.searchError=String(error);}
    finally{if(token===state.searchToken){state.searching=false;renderSearchResults();}}
  }
  function renderExternal(){
    updateSaveState();
    const file=files[active],change=file&&state.external.get(file.id);banner.hidden=!change;
    if(!change){banner.innerHTML='';return;}
    banner.innerHTML='<span>'+escapeHtml(change.kind==='missing'?'This file was moved or deleted outside Editor, MD. Its open text is preserved.':change.kind==='error'?'This file could not be checked. Your open text is preserved.':'This file changed outside Editor, MD. Your unsaved edits are preserved.')+'</span><button id="review-external">Review</button><button id="external-save-as">Save as…</button>';
    $('#review-external').onclick=()=>reviewExternal(file);$('#external-save-as').onclick=()=>nativeSave(file,{saveAs:true});
  }
  function replaceFromDisk(file,doc){
    const isActive=files[active]===file,scroll=$('#canvas-scroll').scrollTop,sourceScroll=$('#source').scrollTop,start=$('#source').selectionStart,end=$('#source').selectionEnd;
    Object.assign(file,fileFromDisk(doc));documentState.saved.set(file,structuredClone(file));state.external.delete(file.id);
    if(isActive){openFile(files.indexOf(file),{capture:false});$('#canvas-scroll').scrollTop=scroll;$('#source').scrollTop=sourceScroll;$('#source').setSelectionRange(start,end);}
    else{renderTabs();renderSidebar();}
    queueCheckpoint();renderExternal();
  }
  async function reloadLatest(file){
    try{const doc=await invoke('reload_document',{id:file.id});replaceFromDisk(file,doc);$('#dialog').close();toast('Loaded the latest disk version');}
    catch(error){showError('Could not reload file',error);}
  }
  function reviewExternal(file){
    const change=state.external.get(file.id);if(!change)return;
    openDialog('File changed outside Editor, MD','<p>'+escapeHtml(file.name)+'</p><div class="external-compare"><label>Your open text<textarea readonly id="external-local"></textarea></label><label>Disk version<textarea readonly id="external-disk"></textarea></label></div><p>Keep editing preserves your open text. Save as keeps a separate copy. Reload replaces your open text with the latest file on disk.</p><div class="dialog-actions"><button id="external-keep">Keep editing</button><button id="external-copy">Save as…</button>'+(change.kind==='modified'?'<button id="external-reload">Reload disk version'+(documentState.isDirty(file)?' (discard my edits)':'')+'</button>':'')+'</div>');
    $('#external-local').value=sourceOf(file);$('#external-disk').value=change.document?.source||change.error||'File is unavailable.';
    $('#external-keep').onclick=()=>$('#dialog').close();$('#external-copy').onclick=()=>{$('#dialog').close();nativeSave(file,{saveAs:true});};$('#external-reload')?.addEventListener('click',()=>reloadLatest(file));
  }
  function checkExternal(){
    if(state.checkPromise){state.pending=true;return state.checkPromise;}
    state.checkPromise=performExternalCheck().finally(()=>{state.checkPromise=null;});return state.checkPromise;
  }
  async function performExternalCheck(){
    if(state.checking){state.pending=true;return;}state.checking=true;
    try{
      captureDocument();const checks=files.filter(file=>file.nativePath&&file.nativeRevision&&!queues.has(file.id)).map(file=>({id:file.id,revision:file.nativeRevision}));
      const changes=await invoke('check_documents',{checks});captureDocument();
      for(const change of changes){
        const file=files.find(file=>file.id===change.id);if(!file||file.nativeRevision!==change.baseline||queues.has(file.id))continue;
        clearTimeout(autosaveTimers.get(file.id));
        const previous=state.external.get(file.id),wasCleanBeforeMissing=previous?.savedBeforeMissing&&JSON.stringify(previous.savedBeforeMissing)===JSON.stringify(file);
        if(change.kind==='modified'&&(!documentState.isDirty(file)||wasCleanBeforeMissing)){replaceFromDisk(file,change.document);}
        else{
          if(change.kind==='missing'){
            change.savedBeforeMissing=previous?.savedBeforeMissing||documentState.saved.get(file);
            documentState.saved.delete(file);queueCheckpoint();
          }else if(previous?.savedBeforeMissing)change.savedBeforeMissing=previous.savedBeforeMissing;
          state.external.set(file.id,change);
        }
      }
      const changedIds=new Set(changes.map(change=>change.id));
      for(const check of checks)if(!changedIds.has(check.id)){
        const previous=state.external.get(check.id),file=files.find(file=>file.id===check.id);
        if(previous?.savedBeforeMissing&&file)documentState.saved.set(file,previous.savedBeforeMissing);
        state.external.delete(check.id);
      }
      renderExternal();
    }catch(error){state.watchError=String(error);}
    finally{state.checking=false;if(state.pending){state.pending=false;scheduleRefresh();}}
  }
  async function refreshFiles(manual=false){
    if(state.project){const root=state.project.root;try{const project=await invoke('refresh_project',{restart:manual});if(state.project?.root===root&&project?.root===root){state.project=project;state.error='';}}catch(error){if(state.project?.root===root)state.error=String(error);}if(side==='files')renderSidebar();}
    await checkExternal();clearAssets();await hydrateAssets();if(side==='search'&&state.query.trim())runSearch();if(manual)toast('Checked project files and open documents');
  }
  function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refreshFiles(),450);}
  function clearAssets(){for(const value of state.assets.values())value.then(url=>URL.revokeObjectURL(url)).catch(()=>{});state.assets.clear();assetRun++;}
  async function hydrateAssets(){
    const file=files[active];if(state.assetDocument!==file?.id){clearAssets();state.assetDocument=file?.id;}
    const run=++assetRun;state.assetErrors=[];
    if(!file?.nativePath){assetStatus.hidden=true;return;}
    await Promise.all($$('#paper img').map(async image=>{
      const target=image.dataset.localSrc||image.getAttribute('src');if(!ProjectModel.relative(target))return;
      image.dataset.localSrc=target;const key=file.id+'|'+file.nativePath+'|'+target;
      try{
        if(!state.assets.has(key))state.assets.set(key,invoke('read_attachment',{id:file.id,target}).then(bytes=>{const extension=target.split(/[?#]/)[0].split('.').pop().toLowerCase();return URL.createObjectURL(new Blob([bytes],{type:{png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'}[extension]||'application/octet-stream'}));}));
        const url=await state.assets.get(key);if(run!==assetRun||!image.isConnected||files[active]!==file)return;
        image.src=url;image.classList.remove('attachment-error');image.removeAttribute('data-local-error');await image.decode();
      }catch(error){if(run!==assetRun||!image.isConnected)return;image.classList.add('attachment-error');image.dataset.localError=String(error);state.assetErrors.push(target+': '+String(error));}
    }));
    if(run!==assetRun)return;assetStatus.hidden=!state.assetErrors.length;assetStatus.innerHTML=state.assetErrors.length+' image(s) could not load. <button id="attachment-details">Details</button>';
    $('#attachment-details')?.addEventListener('click',()=>openDialog('Images unavailable','<p>'+escapeHtml(state.assetErrors.join('\n'))+'</p><p>Relative images must be inside the project folder, or beside an individually opened document.</p>'));
  }
  async function embedExportImages(content){
    const template=document.createElement('template');template.innerHTML=content;
    await Promise.all([...template.content.querySelectorAll('img')].map(async image=>{
      const target=image.dataset.localSrc||image.getAttribute('src');if(!ProjectModel.relative(target)&&!image.src.startsWith('blob:'))return;
      const file=files[active];if(!file?.nativePath)return;
      const bytes=ProjectModel.relative(target)?await invoke('read_attachment',{id:file.id,target}):await (await fetch(image.src)).arrayBuffer();
      const data=new Uint8Array(bytes);let binary='';for(let offset=0;offset<data.length;offset+=16384)binary+=String.fromCharCode(...data.subarray(offset,offset+16384));
      const ext=(target||'').split(/[?#]/)[0].split('.').pop().toLowerCase();image.src='data:'+({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp'}[ext]||'image/png')+';base64,'+btoa(binary);
      image.removeAttribute('data-local-src');image.removeAttribute('data-local-error');
    }));
    return '<!doctype html>'+template.innerHTML;
  }
  const print=window.print;window.print=async()=>{await hydrateAssets();if(state.assetErrors.length){openDialog('Some images are unavailable','<p>'+escapeHtml(state.assetErrors.join('\n'))+'</p><button class="primary" id="print-anyway">Print without these images</button>');$('#print-anyway').onclick=()=>{$('#dialog').close();print();};return;}return print();};
  const download=downloadFile;downloadFile=async(name,content,type)=>{try{if(type.includes('html'))content=await embedExportImages(content);return await download(name,content,type);}catch(error){showError('Could not export attachment images',error);}};
  async function relativeLink(event){
    const link=event.target.closest('a'),target=link?.getAttribute('href');if(!link||!ProjectModel.relative(target))return;
    if(!event.ctrlKey&&!event.metaKey)return;
    event.preventDefault();event.stopImmediatePropagation();const file=files[active];if(!file?.nativePath)return toast('Save this document before opening relative links');
    try{if(/\.(md|markdown|mdown)(?:#.*)?$/i.test(target)){const doc=await invoke('open_relative_document',{id:file.id,target});adoptDocuments([doc]);}else await invoke('open_attachment',{id:file.id,target});}
    catch(error){showError('Could not open linked file',error);}
  }
  $('#paper').addEventListener('click',relativeLink,true);
  const originalFind=$('#find').onclick;
  $('#find').onclick=()=>state.project?showSearch():originalFind();
  const designRibbon=ribbon;ribbon=tab=>{
    designRibbon(tab);if(tab==='File'){
      const button=document.createElement('button');button.className='large-tool';button.id='ribbon-open-project';button.innerHTML=icon('folder')+'Open project';button.onclick=openProject;$('#ribbon .ribbon-row').append(button);
    }else if(tab==='Insert'){
      const button=document.createElement('button');button.className='large-tool';button.id='insert-local-attachment';button.innerHTML=icon('folder')+'Attachment';button.onclick=()=>insertAttachment(false);button.disabled=active<0;$('#ribbon .ribbon-row').append(button);
    }
  };
  async function insertAttachment(imageOnly){
    const file=files[active];if(!file)return;
    if(!file.nativePath){toast('Save this document before adding a relative attachment');return;}
    const caret=$('#source').selectionEnd;
    try{
      const result=await invoke('insert_attachment',{id:file.id,imageOnly});if(!result)return;
      if(files[active]!==file){toast('Attachment added to its folder. Return to '+file.name+' to insert it.');return;}
      if(mode==='source'){
        const source=$('#source'),label=result.name.replaceAll('\\','\\\\').replaceAll('[','\\[').replaceAll(']','\\]');
        const text=(result.image?'!':'')+'['+label+']('+result.target+')';source.setRangeText(text,caret,caret,'end');source.dispatchEvent(new Event('input',{bubbles:true}));
      }else insert(result.image?'<img src="'+escapeHtml(result.target)+'" alt="'+escapeHtml(result.name)+'">':'<a href="'+escapeHtml(result.target)+'">'+escapeHtml(result.name)+'</a>');
      await refreshFiles();toast('Inserted '+result.name);
    }catch(error){showError('Could not insert attachment',error);}
  }
  officeActions.image=()=>insertAttachment(true);
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='f'&&!$('#dialog').open){event.preventDefault();event.stopImmediatePropagation();showSearch();}},true);
  document.addEventListener('documentchange',()=>{renderExternal();hydrateAssets();if(side==='search'&&state.query.trim()){clearTimeout(searchTimer);searchTimer=setTimeout(runSearch,300);}});
  window.addEventListener('focus',scheduleRefresh);
  await listen('native-files-changed',()=>{state.watchEvents++;scheduleRefresh();});
  await listen('native-watch-error',event=>{state.watchError=String(event.payload);if(side==='files')renderSidebar();});
  await listen('native-watch-ready',()=>{state.watchError='';if(side==='files')renderSidebar();});
  try{state.project=await invoke('restore_project');}catch(error){state.error=String(error);toast('The previous project folder is unavailable; your document tabs are preserved');}
  updateProjectBar();renderSidebar();renderExternal();await hydrateAssets();
  async function smokeTest(check){
    const until=async(condition)=>{const deadline=Date.now()+6000;while(!condition()){if(Date.now()>deadline)throw Error('Timed out waiting for project watcher');await new Promise(resolve=>setTimeout(resolve,50));}};
    state.project=await invoke('smoke_project',{action:'setup'});state.expanded.add('notes');side='files';selectSide();updateProjectBar();renderSidebar();
    check(!!$('[data-project-file="notes/second.md"]')&&state.project.entries.some(entry=>entry.path==='assets/pixel.png'),'Project tree shows unopened nested Markdown and attachment files');
    showSearch();state.query='needle';$('#project-query').value=state.query;await runSearch();
    check(state.search.hits.filter(hit=>!hit.filename).length===2&&state.search.searched===2&&$$('[data-search-hit]').length===2,'Project search shows results from unopened Markdown files');
    const hit=state.search.hits[0];await openProjectEntry(hit.path,hit);
    check(mode==='source'&&$('#source').value.slice($('#source').selectionStart,$('#source').selectionEnd)==='needle','Search navigation opens Source with the actual matching text selected');
    await openProjectEntry('notes/first.md');const first=files[active],original=sourceOf(first);await hydrateAssets();captureDocument();
    check($('#paper img')?.naturalWidth===1&&!documentState.isDirty(first),'Relative image loads through native file access without dirtying the document');
    setMode('source');setMode('write');captureDocument();
    check(sourceOf(first)===original&&!sourceOf(first).includes('blob:'),'Write and Source preserve original relative image paths');
    const html=await embedExportImages('<html><body>'+$('#paper').innerHTML+'</body></html>');
    check(html.includes('data:image/png;base64,')&&!html.includes('data-local-src='),'HTML export embeds relative images for use outside the app');
    const second=await invoke('open_relative_document',{id:first.id,target:'second.md'});adoptDocuments([second]);
    check(files[active].name==='second.md','Relative Markdown links open another document tab');
    let blocked=false;try{await invoke('read_attachment',{id:first.id,target:'../../workspace.json'});}catch{blocked=true;}
    check(blocked,'Relative attachment resolution cannot escape the selected project');
    openFile(files.indexOf(first));setMode('source');$('#source').value=original+'\nUnsaved live query.\n';$('#source').dispatchEvent(new Event('input',{bubbles:true}));
    state.query='live query';await runSearch();check(state.search.hits.length===1,'Project search uses pending edits from open buffers');
    const pending=sourceOf(first),events=state.watchEvents;await invoke('smoke_project',{action:'modify'});
    await until(()=>state.watchEvents>events&&state.external.get(first.id)?.kind==='modified');
    check(sourceOf(first)===pending&&documentState.isDirty(first)&&!$('#external-status').hidden,'Native file watcher preserves dirty buffers and shows an external-change notice');
    reviewExternal(first);check($('#external-local').value===pending&&$('#external-disk').value.includes('Changed externally'),'External-change review shows both versions');$('#external-keep').click();
    check(!await nativeSave(first,{quiet:true})&&sourceOf(first)===pending,'Autosave cannot overwrite a detected external change');
    reviewExternal(first);$('#external-reload').click();await until(()=>!state.external.has(first.id)&&sourceOf(first).includes('Changed externally'));
    check(!documentState.isDirty(first),'Explicit reload adopts the latest disk revision');
    await invoke('smoke_project',{action:'modify-again'});await until(()=>sourceOf(first).includes('Changed again'));
    check(!documentState.isDirty(first),'Clean open documents automatically reload external edits');
    const kept=sourceOf(first);await invoke('smoke_project',{action:'delete'});await until(()=>state.external.get(first.id)?.kind==='missing');
    check(sourceOf(first)===kept&&openDocuments.includes(first)&&documentState.isDirty(first),'Externally deleted documents keep their open text and require saving before close');
    const closeMissing=closeDocument(first);await until(()=>!!$('#native-cancel'));$('#native-cancel').click();await closeMissing;
    check(openDocuments.includes(first)&&sourceOf(first)===kept,'Cancel preserves an externally deleted document when closing its tab');
    await refreshFiles();check(!state.project.entries.some(entry=>entry.path==='notes/first.md'),'Project tree refreshes after external deletion');
    const tabs=openDocuments.length;await invoke('close_project');state.project=null;updateProjectBar();renderSidebar();
    check(openDocuments.length===tabs&&sourceOf(first)===kept,'Closing a project leaves document buffers open');
  }
  return {state,refreshFiles,checkExternal,hydrateAssets,openProjectEntry,runSearch,replaceFromDisk,reviewExternal,clearAssets,smokeTest};
}
