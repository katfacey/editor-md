// Contextual Markdown tools. The saved range always belongs to the active document.
(function(root){
  let host=null;
  function destination(value){
    const text=String(value||'').trim();
    if(!text||/[\x00-\x1f<>"\\]/.test(text))return null;
    if(text.startsWith('[[')&&root.WikiLinks?.parse(text))return {kind:'wiki',value:text};
    if(/^https?:\/\//i.test(text)){try{const url=new URL(text);return url.hostname?{kind:'web',value:url.href}:null;}catch{return null;}}
    if(text.startsWith('#')&&text.length>1)return {kind:'heading',value:text};
    if(!/^[\/]|:/.test(text)&&/\.(md|markdown|mdown)(?:#.*)?$/i.test(text))return {kind:'note',value:text};
    return null;
  }
  function repairEscapedHeadingLinks(source){
    return String(source).replace(/\[([^\]\r\n]+)\]\\\((\\?#[\p{L}\p{N}_%.-]+)\)/gu,(whole,label,fragment)=>
      /\\[*_~`]/.test(label)?'['+label.replace(/\\([*_~`])/g,'$1')+']('+fragment.replace(/^\\/,'')+')':whole);
  }
  function headingTarget(paper,href){
    let id;try{id=decodeURIComponent(href.slice(1));}catch{return null;}
    const slug=text=>text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'');
    const headings=[...paper.querySelectorAll('h1,h2,h3,h4,h5,h6')];
    return headings.find(node=>node.id===id)||headings.find(node=>slug(node.textContent)===slug(id))||null;
  }
  function install(){
    const paper=$('#paper'),bar=document.createElement('div');
    const linkTip=document.createElement('div');linkTip.id='editor-link-tip';linkTip.className='editor-link-tip';linkTip.setAttribute('role','tooltip');linkTip.hidden=true;document.body.append(linkTip);
    let hoveredLink=null;
    function showLinkTip(anchor){
      if(!anchor||mode==='source'||active<0){linkTip.hidden=true;hoveredLink=null;return;}
      hoveredLink=anchor;
      linkTip.textContent=anchor.getAttribute('href')?.startsWith('#')&&!anchor.hasAttribute('data-wiki-link')?'Double-click to jump to heading':'Double-click to open in a new tab';
      linkTip.hidden=false;
      const rect=anchor.getBoundingClientRect(),scale=(typeof interfaceSettings==='object'?interfaceSettings.zoom:100)/100;
      const width=linkTip.getBoundingClientRect().width,height=linkTip.getBoundingClientRect().height;
      linkTip.style.left=Math.max(8,Math.min(innerWidth-width-8,rect.left))/scale+'px';
      linkTip.style.top=(rect.bottom+height+8<innerHeight?rect.bottom+7:rect.top-height-7)/scale+'px';
    }
    paper.addEventListener('pointerover',event=>showLinkTip(event.target.closest('a[href]')));
    paper.addEventListener('pointerout',event=>{if(hoveredLink&&!hoveredLink.contains(event.relatedTarget))showLinkTip(null);});
    paper.addEventListener('focusin',event=>showLinkTip(event.target.closest('a[href]')));
    paper.addEventListener('focusout',event=>{if(hoveredLink&&!hoveredLink.contains(event.relatedTarget))showLinkTip(null);});
    $('#canvas-scroll').addEventListener('scroll',()=>showLinkTip(null),{passive:true});
    document.addEventListener('viewchange',()=>showLinkTip(null));
    bar.id='selection-tools';bar.className='selection-tools';bar.hidden=true;bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Selected text formatting');
    const button=(id,label,html)=>'<button type="button" data-selection-tool="'+id+'" title="'+label+'" aria-label="'+label+'">'+html+'</button>';
    bar.innerHTML=button('bold','Bold (**text**)','<b>B</b>')+button('italic','Italic (*text*)','<i>I</i>')+button('underline','Underline (HTML)','<u>U</u>')+button('strikeThrough','Strikethrough (~~text~~)','<s>S</s>')+'<span class="selection-divider"></span>'+button('inline-code','Inline code (`text`)',icon('code'))+button('link','Insert or edit link',icon('link'))+button('hiliteColor','Highlight (HTML)','<span class="highlight-icon">'+icon('highlighter')+'</span>')+button('footnote','Add footnote','†')+'<span class="selection-divider"></span>'+button('more','More formatting','⋯')+'<div id="selection-more" class="selection-more" hidden>'+button('subscript','Subscript (HTML)','x<sub>2</sub> Subscript')+button('superscript','Superscript (HTML)','x<sup>2</sup> Superscript')+button('removeFormat','Clear formatting','Clear formatting')+'</div>';
    document.body.append(bar);
    let range=null,fileId=null,timer,dragging=false,suppressed=false;
    function valid(r){return r&&!r.collapsed&&paper.contains(r.startContainer)&&paper.contains(r.endContainer)&&r.toString().replaceAll('\u200b','').trim()&&!r.cloneContents().querySelector('[contenteditable="false"],[data-footnotes]');}
    function hide(){bar.hidden=true;$('#selection-more').hidden=true;}
    function restore(){if(fileId!==files[active]?.id||!valid(range))return false;paper.focus({preventScroll:true});const s=window.getSelection();s.removeAllRanges();s.addRange(range.cloneRange());selection=range.cloneRange();return true;}
    function update(){
      if(dragging||suppressed||active<0||mode==='source'||$('#dialog').open||$('#md-menu')?.hidden===false||(!paper.contains(document.activeElement)&&document.activeElement!==paper&&!bar.contains(document.activeElement))){hide();return;}
      const s=window.getSelection(),r=s.rangeCount?s.getRangeAt(0):null;
      if(!valid(r)){if(!bar.contains(document.activeElement))hide();return;}
      range=r.cloneRange();selection=range.cloneRange();fileId=files[active].id;
      const rect=r.getBoundingClientRect(),canvas=$('#canvas-scroll').getBoundingClientRect();
      if(rect.bottom<canvas.top||rect.top>canvas.bottom){hide();return;}
      bar.hidden=false;
      const scale=(typeof interfaceSettings==='object'?interfaceSettings.zoom:100)/100,width=bar.getBoundingClientRect().width,height=bar.getBoundingClientRect().height;
      const x=Math.max(8,Math.min(innerWidth-width-8,(rect.left+rect.right-width)/2)),y=rect.top-height-9>=canvas.top?rect.top-height-9:Math.min(innerHeight-height-8,rect.bottom+9);
      bar.style.left=x/scale+'px';bar.style.top=y/scale+'px';
      for(const id of ['bold','italic','underline','strikeThrough','subscript','superscript'])bar.querySelector('[data-selection-tool="'+id+'"]').setAttribute('aria-pressed',String(document.queryCommandState(id)));
    }
    function schedule(){clearTimeout(timer);timer=setTimeout(update,120);}
    bar.addEventListener('pointerdown',event=>{if(event.target.closest('button'))event.preventDefault();});
    bar.addEventListener('click',event=>{
      const id=event.target.closest('[data-selection-tool]')?.dataset.selectionTool;if(!id)return;
      if(id==='more'){$('#selection-more').hidden=!$('#selection-more').hidden;return;}
      if(!restore()){hide();return;}
      if(id==='inline-code'){
        const start=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement,code=start.closest('code');
        if(code&&!code.closest('pre')){const selected=window.getSelection();const r=document.createRange();r.selectNode(code);selected.removeAllRanges();selected.addRange(r);selection=r;format('insertHTML',escapeHtml(code.textContent));}
        else format('insertHTML','<code>'+escapeHtml(range.toString())+'</code>');
      }else action(id);
      $('#selection-more').hidden=true;if(id==='link'||id==='footnote')hide();else schedule();
    });
    document.addEventListener('selectionchange',schedule);
    paper.addEventListener('input',()=>{hide();schedule();});
    paper.addEventListener('pointerdown',()=>{dragging=true;suppressed=false;hide();});
    document.addEventListener('pointerup',()=>{dragging=false;schedule();});
    document.addEventListener('pointerdown',event=>{if(!paper.contains(event.target)&&!bar.contains(event.target)){hide();}});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!bar.hidden){suppressed=true;hide();paper.focus({preventScroll:true});}});
    for(const name of ['viewchange','documentchange'])document.addEventListener(name,()=>{suppressed=false;schedule();});
    $('#canvas-scroll').addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
    $('#dialog').addEventListener('close',schedule);

    function linkDialog(){
      const saved=selection?.cloneRange(),id=files[active]?.id;
      const node=saved&&(saved.startContainer.nodeType===1?saved.startContainer:saved.startContainer.parentElement),anchor=node?.closest('a');
      let target=saved;
      if(anchor&&paper.contains(anchor)){target=document.createRange();target.selectNode(anchor);}
      const label=anchor?.textContent||saved?.toString()||'',url=anchor?.dataset.wikiSource||anchor?.getAttribute('href')||'';
      hide();
      openDialog(anchor?'Edit link':'Insert link','<form id="selection-link-form"><label for="link-text">Text</label><input id="link-text" autocomplete="off"><label for="link-url">Destination</label><input id="link-url" placeholder="https://example.com or [[Note]]" autocomplete="off" required><p class="format-note">Use a web address, [[note]], relative Markdown file, or #heading. Double-click a note link to open its tab.</p><p id="link-error" class="validation-error" role="alert"></p><div class="dialog-actions"><button type="button" id="cancel-link">Cancel</button><button type="submit" class="primary" id="add-link">'+(anchor?'Update link':'Insert link')+'</button></div></form>');
      $('#link-text').value=label;$('#link-url').value=url;
      $('#cancel-link').onclick=()=>{$('#dialog').close();if(saved&&files[active]?.id===id){paper.focus({preventScroll:true});const s=window.getSelection();s.removeAllRanges();s.addRange(saved);selection=saved;}};
      $('#selection-link-form').onsubmit=event=>{
        event.preventDefault();const dest=destination($('#link-url').value),text=$('#link-text').value.trim();
        if(!dest){$('#link-error').textContent='Enter an http(s) address, [[note]], relative .md file, or #heading.';return;}
        if(files[active]?.id!==id){$('#link-error').textContent='Return to the original document before inserting this link.';return;}
        let html;
        if(dest.kind==='wiki'){
          const parsed=WikiLinks.parse(dest.value),raw='[['+parsed.target+(parsed.heading?'#'+parsed.heading:'')+(text&&text!==parsed.label?'|'+text:dest.value.includes('|')?'|'+parsed.label:'')+']]';
          if(!WikiLinks.parse(raw)){$('#link-error').textContent='For a note link, use a label without closing square brackets.';return;}html=WikiLinks.html(raw);
        }else html='<a href="'+escapeHtml(dest.value)+'">'+escapeHtml(text||dest.value)+'</a>';
        $('#dialog').close();selection=target;format('insertHTML',html);hide();
      };
      $('#link-url').focus();$('#link-url').select();
    }
    officeActions.link=linkDialog;
    paper.addEventListener('click',event=>{const a=event.target.closest('a[href]');if(!a||a.hasAttribute('data-wiki-link'))return;const href=a.getAttribute('href');if(/^https?:/i.test(href)){event.preventDefault();if(event.ctrlKey||event.metaKey)openWeb(href);}else if(href.startsWith('#')){event.preventDefault();if(event.ctrlKey||event.metaKey)jumpToHeading(href);}},true);
    paper.addEventListener('dblclick',event=>{
      const a=event.target.closest('a[href]');if(!a||a.hasAttribute('data-wiki-link'))return;
      const href=a.getAttribute('href');
      if(/^https?:/i.test(href)){event.preventDefault();event.stopImmediatePropagation();openWeb(href);}
      else if(href.startsWith('#')){event.preventDefault();event.stopImmediatePropagation();jumpToHeading(href);}
    },true);
    function jumpToHeading(href){const target=headingTarget(paper,href);if(target)target.scrollIntoView({block:'start'});else toast('Heading not found in this document: '+href);}
    async function openWeb(target){try{if(host)await host.invoke('open_web_link',{target});else window.open(target,'_blank','noopener,noreferrer');}catch(error){toast('Could not open link: '+String(error));}}
    return {update,hide,restore,linkDialog,element:bar};
  }
  const api={destination,repairEscapedHeadingLinks,headingTarget,install,connect:value=>host=value};if(typeof module==='object'&&module.exports)module.exports=api;else root.SelectionTools=api;
})(globalThis);
