let documentState,openDocuments=[],templates=[],recentDocuments=[];
const librarySectionsOpen=new Set(),observedDocuments=new Map();
function initializeWorkspace(){
  let assignedIds=false;const seenIds=new Set();
  files.forEach(file=>{if(!/^[a-zA-Z0-9-]{1,80}$/.test(file.id||'')||seenIds.has(file.id)){file.id=crypto.randomUUID();assignedIds=true}seenIds.add(file.id)});
  // One-time browser-storage migration gives recent entries stable identities.
  if(assignedIds)try{localStorage.setItem('editor-md-documents',JSON.stringify(files))}catch{}
  files.forEach(file=>file.html=sanitize(file.html));
  documentState=new DocumentState(files,value=>localStorage.setItem('editor-md-documents',value));
  openDocuments=files.slice();
  files.forEach(file=>observedDocuments.set(file,JSON.stringify(file)));
  try{const stored=JSON.parse(localStorage.getItem('editor-md-templates'));if(Array.isArray(stored))templates=stored.filter(t=>/^[a-zA-Z0-9-]{1,80}$/.test(t.id||'')&&typeof t.name==='string'&&typeof t.html==='string').map(t=>({...t,html:sanitize(t.html)}))}catch{}
  try{const stored=JSON.parse(localStorage.getItem('editor-md-recent'));if(Array.isArray(stored))recentDocuments=stored.filter(entry=>typeof entry.id==='string'&&files.some(file=>file.id===entry.id))}catch{}
  $('#empty-create').onclick=()=>newDoc();
}
function updateTabSaveMarkers(){
  $$('#document-tabs [data-tab-document]').forEach(tab=>{
    const file=files.find(file=>file.id===tab.dataset.tabDocument),dirty=documentState.isDirty(file);
    tab.classList.toggle('dirty',dirty);
    tab.querySelector('.document-tab-open').title=file.name+(dirty?' · Unsaved changes':'');
    tab.querySelector('.tab-dirty').hidden=!dirty;
    tab.querySelector('.tab-close').title='Close '+file.name+(dirty?' · Unsaved changes':'');
  });
}
function renderTabs(){
  $('#document-tabs').innerHTML=openDocuments.map(file=>`<div class="document-tab ${files[active]===file?'selected':''}" data-tab-document="${file.id}"><button class="document-tab-open" data-file="${files.indexOf(file)}" ${files[active]===file?'aria-current="page"':''}>${icon('file')}<span>${escapeHtml(file.name)}</span><small class="tab-dirty" aria-label="Unsaved changes" hidden>●</small></button><button class="tab-close" data-close-document="${file.id}" aria-label="Close ${escapeHtml(file.name)}">×</button></div>`).join('')+'<button class="add-tab" aria-label="New document">+</button>';
  $$('#document-tabs [data-file]').forEach(button=>button.onclick=()=>openFile(+button.dataset.file));
  $$('[data-close-document]').forEach(button=>{button.onmousedown=event=>event.preventDefault();button.onclick=()=>closeDocument(files.find(file=>file.id===button.dataset.closeDocument))});
  $('.add-tab').onclick=()=>newDoc();updateTabSaveMarkers();$('#document-tabs .selected')?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function syncDocumentControls(){
  const empty=active<0;
  $('.document-area').classList.toggle('no-document',empty);$('#empty-document').hidden=!empty;
  $('.health').hidden=empty;
  $('#paper').contentEditable=String(!empty);$('#source').disabled=empty;$('#export').disabled=empty;
  $$('#ribbon [data-action]').forEach(button=>button.disabled=empty&&!['new','theme','appearance','focus','panel','storage'].includes(button.dataset.action));
  $$('#ribbon select').forEach(select=>select.disabled=empty);
}
function openFile(index,{capture=true,activity='opened'}={}){
  if(!files[index])return;
  if(capture&&active>=0)save();
  active=index;const file=files[active];if(!openDocuments.includes(file))openDocuments.push(file);
  $('#paper').innerHTML=sanitize(file.html);$('#source').value=markdown(file.html);$('#breadcrumb').textContent=file.name;selection=null;
  syncDocumentControls();renderTabs();touchRecent(file,activity);renderSidebar();updateStats();updateSaveState();
  document.dispatchEvent(new Event('documentchange'));
}
function closeDocument(file){
  if(!file||!openDocuments.includes(file))return;
  captureDocument();updateSaveState();
  const finish=discard=>{
    const current=files[active],wasActive=current===file,position=openDocuments.indexOf(file),wasDraft=!documentState.saved.has(file);
    if(discard){documentState.discard(file);if(wasDraft){observedDocuments.delete(file);recentDocuments=recentDocuments.filter(entry=>entry.id!==file.id);persistRecent()}else observedDocuments.set(file,JSON.stringify(file))}
    openDocuments=openDocuments.filter(document=>document!==file);
    if(wasActive){
      active=-1;
      const next=openDocuments[Math.min(position,openDocuments.length-1)];
      if(next)openFile(files.indexOf(next),{capture:false});
      else{
        $('#paper').innerHTML='';$('#source').value='';$('#breadcrumb').textContent='No document open';selection=null;
        syncDocumentControls();renderTabs();renderSidebar();updateStats();updateSaveState();document.dispatchEvent(new Event('documentchange'));
      }
    }else{active=files.indexOf(current);renderTabs();renderSidebar();updateSaveState()}
    $('#document-tabs .selected .document-tab-open,#document-tabs .add-tab')?.focus();
  };
  if(!documentState.isDirty(file)){finish(false);return}
  openDialog('Save changes?',`<p class="close-document-name">${escapeHtml(file.name)}</p><p>Save your changes before closing this tab?</p><p class="format-note">${documentState.saved.has(file)?'Don’t save restores the last saved version.':'This new document has not been saved. Don’t save discards the draft.'}</p><p class="validation-error" id="close-save-error" role="alert"></p><div class="dialog-actions close-save-actions"><button id="close-discard">Don’t save</button><span></span><button id="close-cancel" autofocus>Cancel</button><button class="primary" id="close-save">Save</button></div>`);
  $('#close-cancel').onclick=()=>$('#dialog').close();
  $('#close-discard').onclick=()=>{$('#dialog').close();finish(true)};
  $('#close-save').onclick=()=>{
    try{documentState.persist([file]);updateSaveState();$('#dialog').close();finish(false)}
    catch{$('#close-save-error').textContent='Could not save in this browser. The tab is still open. Cancel and export a copy to keep your work.'}
  };
  $('#close-cancel').focus();
}
function newDoc(template=null){
  if(!template||typeof template.html!=='string')template=null;
  const base=template?template.name+' draft':'Untitled';let suggested=base+'.md',suffix=2;
  while(files.some(file=>file.name.toLowerCase()===suggested.toLowerCase()))suggested=base+' ('+(suffix++)+').md';
  openDialog(template?'New document from template':'A fresh page',`<label for="new-name">Document name</label><input id="new-name" maxlength="200" value="${escapeHtml(suggested)}"><p class="validation-error" id="new-document-error" role="alert"></p><button class="primary" id="create-document">Create document</button>`);
  $('#create-document').onclick=()=>{
    let name=$('#new-name').value.trim()||'Untitled.md';if(!/\.md$/i.test(name))name+='.md';
    if(files.some(file=>file.name.toLowerCase()===name.toLowerCase())){$('#new-document-error').textContent='A document with that name already exists. Choose a different name.';return}
    if(active>=0)save();
    const file={id:crypto.randomUUID(),name,html:template?sanitize(template.html):'<h1>Untitled</h1><p>Every good idea starts somewhere.</p>'};
    if(template?.page)file.page=structuredClone(template.page);
    files.push(file);observedDocuments.set(file,JSON.stringify(file));$('#dialog').close();openFile(files.length-1,{capture:false,activity:'created'});
    if(autosaveEnabled)save();
  };
}
function saveAsTemplate(){
  if(active<0)return toast('Open a document to save as a template');
  captureDocument();updateSaveState();const file=files[active],snapshot={html:file.html,page:structuredClone({...defaultPage,...file.page})};
  openDialog('Save as template',`<p class="dialog-intro">Keep a reusable copy of this document’s content, formatting, and page setup.</p><label for="template-name">Template name</label><input id="template-name" maxlength="80" value="${escapeHtml(file.name.replace(/\.md$/i,''))}"><label for="template-description">Description (optional)</label><input id="template-description" maxlength="160" placeholder="For reports, meeting notes, or your next draft"><p id="template-error" class="validation-error" role="alert"></p><div class="dialog-actions"><button id="cancel-template">Cancel</button><button class="primary" id="save-template">Save template</button></div>`);
  $('#cancel-template').onclick=()=>$('#dialog').close();
  $('#save-template').onclick=()=>{
    const name=$('#template-name').value.trim();
    if(!name){$('#template-error').textContent='Give the template a name.';return}
    if(templates.some(template=>template.name.toLowerCase()===name.toLowerCase())){$('#template-error').textContent='A template with that name already exists. Choose a different name.';return}
    const entry={id:crypto.randomUUID(),name,description:$('#template-description').value.trim(),...snapshot,created_at:new Date().toISOString()};
    try{localStorage.setItem('editor-md-templates',JSON.stringify([...templates,entry]));templates.push(entry);$('#dialog').close();showLibrary('templates');toast('Template saved')}
    catch{$('#template-error').textContent='Could not save the template in this browser. Your document is still open.'}
  };
}
function persistRecent(){try{localStorage.setItem('editor-md-recent',JSON.stringify(recentDocuments))}catch{}}
function touchRecent(file,event){
  if(!file||!/\.md$/i.test(file.name))return;
  const now=new Date().toISOString(),previous=recentDocuments.find(entry=>entry.id===file.id)||{};
  recentDocuments=[{...previous,id:file.id,name:file.name,[event+'_at']:now,last_event:event,last_at:now},...recentDocuments.filter(entry=>entry.id!==file.id)].slice(0,50);persistRecent();
}
function recordDocumentEdit(file){
  if(!file)return;const signature=JSON.stringify(file);
  if(observedDocuments.get(file)!==signature){observedDocuments.set(file,signature);touchRecent(file,'edited');if(side==='files'&&librarySectionsOpen.has('archive'))renderSidebar()}
}
function showLibrary(section){side='files';librarySectionsOpen.add(section);$$('[data-side]').forEach(button=>button.classList.toggle('selected',button.dataset.side==='files'));renderSidebar();$('[data-library="'+section+'"]').scrollIntoView({block:'nearest'})}
function recentTime(value){const time=new Date(value);return Number.isNaN(time.getTime())?'':time.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function librarySections(){
  const recent=recentDocuments.filter(entry=>files.some(file=>file.id===entry.id));
  const heading=(key,label,count)=>`<button class="tree-folder library-heading" data-library="${key}" aria-expanded="${librarySectionsOpen.has(key)}">${librarySectionsOpen.has(key)?'⌄':'›'} ${icon('folder')} ${label}<span class="library-count">${count}</span></button>`;
  return '<div class="library-sections">'+heading('templates','Templates',templates.length)+(librarySectionsOpen.has('templates')?'<div class="library-items">'+(templates.map(template=>`<button class="library-item" data-use-template="${template.id}" title="Create a document from ${escapeHtml(template.name)}">${icon('file')}<span>${escapeHtml(template.name)}<small>${escapeHtml(template.description||'Use template')}</small></span></button>`).join('')||'<p class="library-empty">Save reusable documents with File → Save as template.</p>')+'</div>':'')+heading('archive','Archive',recent.length)+(librarySectionsOpen.has('archive')?'<div class="library-items"><p class="archive-description">Recently created, edited, and opened .md files</p>'+(recent.map(entry=>`<button class="library-item" data-recent="${entry.id}" title="${escapeHtml(entry.name)} · ${recentTime(entry.last_at)}">${icon('clock')}<span>${escapeHtml(entry.name)}<small>${({opened:'Opened',edited:'Edited',created:'Created'})[entry.last_event]||'Opened'} · ${recentTime(entry.last_at)}</small></span></button>`).join('')||'<p class="library-empty">Your recent Markdown documents will appear here.</p>')+'</div>':'')+'</div>';
}
function bindLibrarySections(){
  $$('[data-library]').forEach(button=>button.onclick=()=>{const key=button.dataset.library;if(librarySectionsOpen.has(key))librarySectionsOpen.delete(key);else librarySectionsOpen.add(key);renderSidebar()});
  $$('[data-use-template]').forEach(button=>button.onclick=()=>newDoc(templates.find(template=>template.id===button.dataset.useTemplate)));
  $$('[data-recent]').forEach(button=>button.onclick=()=>{const index=files.findIndex(file=>file.id===button.dataset.recent);if(index>=0)openFile(index)});
}
