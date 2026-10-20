let footnoteDraft={file:null,text:'',edit:null,sign:false};
let footnoteSignature=false;
try{footnoteSignature=localStorage.getItem('editor-md-footnote-signature')==='on'}catch{}
function installFootnoteMarkdown(){
  const convert=markdown,render=renderMarkdown;
  markdown=html=>Footnotes.serialize(html,convert,document);
  renderMarkdown=source=>Footnotes.render(source,render);
}
function footnoteSource(){
  const file=files[active];if(!file)return '';
  return typeof file.sourceText==='string'?file.sourceText:markdown(file.html);
}
function footnoteModel(){return Footnotes.parse(footnoteSource())}
function refreshFootnoteNumbers(paper){
  const refs=[...paper.querySelectorAll('[data-footnote-ref]')],notes=[...paper.querySelectorAll('[data-footnote-id]')];
  const ids=[...new Set([...refs.map(node=>node.dataset.footnoteRef),...notes.map(node=>node.dataset.footnoteId)])];
  const numbers=new Map(ids.map((id,index)=>[id,index+1])),counts=new Map();
  refs.forEach(node=>{
    const id=node.dataset.footnoteRef,count=(counts.get(id)||0)+1;counts.set(id,count);
    node.id='editor-md-fn-'+encodeURIComponent(id)+'-ref-'+count;
    const link=node.querySelector('a');
    if(link){link.textContent=numbers.get(id);link.href='#editor-md-fn-'+encodeURIComponent(id);link.title='Footnote '+numbers.get(id);}
  });
  for(const id of ids){const note=notes.find(node=>node.dataset.footnoteId===id);if(note)note.parentElement.append(note);}
}
function currentFootnoteInitials(){return $('#profile').textContent.trim()||'KF'}
function showFootnotes(){
  setInspection('footnotes');$('#footnote-text')?.focus();
}
function applyFootnoteSource(source){
  if(active<0)return;
  const file=files[active],html=renderMarkdown(source);
  $('#paper').innerHTML=html;$('#source').value=source;
  file.html=html;
  if(typeof file.sourceText==='string'){file.sourceText=source;file.sourceHtml=html;}
  selection=null;save();renderSidebar();renderInspector();
}
function addFootnote(text){
  const id='note-'+crypto.randomUUID();let source;
  if(mode==='source'){
    source=Footnotes.insert($('#source').value,$('#source').selectionEnd,text,id);
  }else{
    const paper=$('#paper');
    const marker=document.createElement('span');marker.innerHTML=Footnotes.referenceHtml(id,1);
    const ref=marker.firstChild,range=selection?.cloneRange();
    if(range&&paper.contains(range.commonAncestorContainer)&&!range.endContainer.parentElement?.closest('[data-footnotes]')){
      range.collapse(false);range.insertNode(ref);
    }else{
      let last=paper.lastElementChild;
      if(last?.hasAttribute('data-footnotes'))last=last.previousElementSibling;
      if(!last||!last.matches('p,h1,h2,h3,h4,h5,h6,blockquote')){const paragraph=document.createElement('p');paper.insertBefore(paragraph,paper.querySelector('[data-footnotes]'));last=paragraph;}
      last.append(ref);
    }
    let notes=paper.querySelector('[data-footnotes]');
    if(!notes){notes=document.createElement('div');notes.dataset.footnotes='true';notes.innerHTML='<ol></ol>';paper.append(notes);}
    const note=document.createElement('li');note.dataset.footnoteId=id;note.dataset.footnoteSource=text;notes.querySelector('ol').append(note);
    source=Footnotes.normalize(markdown(paper.innerHTML));
  }
  applyFootnoteSource(source);
}
function footnoteQuote(note){
  const ref=note.references[0];if(!ref)return 'Document footnote';
  const source=footnoteSource(),start=source.lastIndexOf('\n',ref.start)+1;
  return source.slice(Math.max(start,ref.start-100),ref.start).replace(/\[\^[^\]]+\]/g,'').trim()||'Document reference';
}
function renderFootnoteInspector(){
  const file=files[active],model=footnoteModel(),container=$('#inspector-content');
  if(footnoteDraft.file!==file?.id)footnoteDraft={file:file?.id,text:'',edit:null,sign:footnoteSignature};
  const editing=footnoteDraft.edit,initials=currentFootnoteInitials();
  container.innerHTML=model.notes.map(note=>'<div class="comment footnote-card" data-footnote-card="'+escapeHtml(note.id)+'"><div class="comment-header"><span class="avatar">'+note.number+'</span>Footnote '+note.number+'</div><p class="quote">'+escapeHtml(footnoteQuote(note))+'</p><p class="footnote-text">'+escapeHtml(note.missing?'Footnote text is missing. Edit to add it.':note.text)+'</p><div class="footnote-actions"><button data-footnote-jump="'+escapeHtml(note.id)+'">Go to reference</button><button data-footnote-edit="'+escapeHtml(note.id)+'">Edit</button><button data-footnote-delete="'+escapeHtml(note.id)+'">Delete</button></div></div>').join('')+
    '<label class="section-label" for="footnote-text">'+(editing?'EDIT FOOTNOTE':'ADD A FOOTNOTE')+'</label><textarea class="comment-compose" id="footnote-text" placeholder="Add a footnote or annotation…"></textarea><label class="footnote-signature"><input id="footnote-signature" type="checkbox"> <span id="footnote-signature-label">Append my initials (-'+escapeHtml(initials)+')</span></label><p class="footnote-hint">Numbers follow the order of references in this document.</p><button class="primary comment-submit" id="post-footnote">'+(editing?'Save footnote':'Add footnote')+'</button>'+(editing?'<button id="cancel-footnote-edit">Cancel</button>':'');
  $('#footnote-text').value=footnoteDraft.text;
  $('#footnote-text').oninput=event=>footnoteDraft.text=event.target.value;
  $('#footnote-signature').checked=footnoteDraft.sign;
  $('#footnote-signature').onchange=event=>{
    footnoteDraft.sign=event.target.checked;footnoteSignature=event.target.checked;
    try{localStorage.setItem('editor-md-footnote-signature',footnoteSignature?'on':'off')}catch{}
  };
  $('#post-footnote').onclick=()=>{
    const text=$('#footnote-text').value.trim();if(!text){$('#footnote-text').focus();return;}
    const signed=Footnotes.signed(text,$('#footnote-signature').checked,currentFootnoteInitials()),edit=footnoteDraft.edit;
    footnoteDraft={file:file.id,text:'',edit:null,sign:footnoteSignature};
    if(edit)applyFootnoteSource(Footnotes.update(footnoteSource(),edit,signed));else addFootnote(signed);
    $('#footnote-text')?.focus();toast(edit?'Footnote updated':'Footnote added');
  };
  $('#cancel-footnote-edit')?.addEventListener('click',()=>{footnoteDraft={file:file.id,text:'',edit:null,sign:footnoteSignature};renderInspector();});
  $$('[data-footnote-delete]').forEach(button=>button.onclick=()=>{
    const id=button.dataset.footnoteDelete;
    if(footnoteDraft.edit===id)footnoteDraft={file:file.id,text:'',edit:null,sign:footnoteSignature};
    applyFootnoteSource(Footnotes.remove(footnoteSource(),id));toast('Footnote deleted; numbers updated');
  });
  $$('[data-footnote-edit]').forEach(button=>button.onclick=()=>{
    const note=model.notes.find(note=>note.id===button.dataset.footnoteEdit);
    // Existing signatures stay literal; editing never appends another by default.
    footnoteDraft={file:file.id,text:note.text,edit:note.id,sign:false};renderInspector();$('#footnote-text').focus();
  });
  $$('[data-footnote-jump]').forEach(button=>button.onclick=()=>{
    const id=button.dataset.footnoteJump;
    if(mode==='source'){
      const ref=footnoteModel().notes.find(note=>note.id===id)?.references[0];
      if(ref){$('#source').focus();$('#source').setSelectionRange(ref.start,ref.end);}
    }else{
      const ref=$$('#paper [data-footnote-ref]').find(node=>node.dataset.footnoteRef===id);
      ref?.scrollIntoView({behavior:'smooth',block:'center'});
    }
  });
}
installFootnoteMarkdown();
officeActions.footnote=showFootnotes;
document.addEventListener('documentchange',()=>{
  $('#footnote-count').textContent=active<0?'0':footnoteModel().notes.length;
  if(inspection==='footnotes')renderInspector();
});
// Clicking a superscript uses the same panel, including in the native WebView.
$('#paper').addEventListener('click',event=>{
  const ref=event.target.closest('[data-footnote-ref]');if(!ref)return;
  event.preventDefault();showFootnotes();
  $$('[data-footnote-card]').find(node=>node.dataset.footnoteCard===ref.dataset.footnoteRef)?.scrollIntoView({behavior:'smooth',block:'nearest'});
});
$('#footnote-count').textContent=active<0?'0':footnoteModel().notes.length;
