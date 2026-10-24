// Complete Markdown delimiters become rich text in Write/Split. Source stays literal.
(function(root){
  function escaped(text,index){let count=0;while(index>0&&text[--index]==='\\')count++;return count%2===1;}
  function inline(text){
    const patterns=[
      ['wiki',/\[\[[^\]\n]+\]\]$/],
      ['link',/(?<!!)\[[^\]\n]+\]\((?:https?:\/\/|#|[^\s():]+\.md)[^\s]*\)$/],
      ['strongEm',/\*\*\*(?=\S)([^*\n]*[^*\s])\*\*\*$/],
      ['strong',/\*\*(?=\S)([^\n]+?\S|[^*\s])\*\*$/],
      ['strong',/__(?=\S)([^_\n]*[^_\s])__$/],
      ['strike',/~~(?=\S)([^~\n]*[^~\s])~~$/],
      ['code',/`([^`\n]+)`$/],
      ['em',/\*(?=\S)([^*\n]*[^*\s])\*$/],
      ['em',/_(?=\S)([^_\n]*[^_\s])_$/]
    ];
    const tail=text.slice(-12000),base=text.length-tail.length;
    for(const [type,pattern] of patterns){
      const match=tail.match(pattern);if(!match)continue;
      const start=base+match.index,raw=match[0],previous=text[start-1]||'';
      if(escaped(text,start))continue;
      if(type!=='code'&&[...text.slice(0,start).matchAll(/`/g)].filter(match=>!escaped(text,match.index)).length%2)continue;
      if(raw[0]==='*'&&previous==='*'||raw[0]==='_'&&/[\p{L}\p{N}_]/u.test(previous)||raw[0]==='`'&&previous==='`')continue;
      if(type==='strong'&&raw.startsWith('**')&&((match[1].match(/\*/g)||[]).length%2))continue;
      return {type,start,end:text.length,raw};
    }
    return null;
  }
  function block(text){
    if(/^(#{1,6}) $/.test(text))return {command:'formatBlock',value:'h'+text.trim().length};
    if(/^[-*+] $/.test(text))return {command:'insertUnorderedList'};
    if(/^1[.)] $/.test(text))return {command:'insertOrderedList'};
    if(text==='> ')return {command:'formatBlock',value:'blockquote'};
    return null;
  }
  function textRange(block,start,end){
    const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT),range=document.createRange();let offset=0,found=false;
    while(walker.nextNode()){
      const node=walker.currentNode,next=offset+node.length;
      if(!found&&start<=next){range.setStart(node,Math.max(0,start-offset));found=true;}
      if(found&&end<=next){range.setEnd(node,Math.max(0,end-offset));return range;}
      offset=next;
    }
    return null;
  }
  function install(){
    const paper=$('#paper');let converting=false,composing=false,generation=0;
    const protectedSelector='code,pre,a,[data-mermaid],[data-footnote-ref],[data-footnotes],[contenteditable="false"]';
    function fragment(text){
      if(!/\*|_|~~|`|\[|^#{1,6} |^[-+>] /m.test(text))return null;
      const template=document.createElement('template');template.innerHTML=renderMarkdown(escapeHtml(text));
      if(!template.content.querySelector('strong,b,em,i,del,s,strike,code,a,h1,h2,h3,h4,h5,h6,ul,ol,blockquote'))return null;
      return template.content.childElementCount===1&&template.content.firstElementChild.tagName==='P'?template.content.firstElementChild.innerHTML:template.innerHTML;
    }
    function convert(event={}){
      if(converting||composing||event.isComposing||mode==='source'||active<0||/historyUndo|historyRedo/.test(event.inputType||''))return false;
      const selected=window.getSelection();if(!selected.rangeCount||!selected.isCollapsed)return false;
      const caret=selected.getRangeAt(0),element=caret.startContainer.nodeType===1?caret.startContainer:caret.startContainer.parentElement;
      if(!paper.contains(element)||element.closest(protectedSelector))return false;
      const parent=element.closest('p,li,h1,h2,h3,h4,h5,h6,td,th,div')||paper;
      if(parent!==paper&&!paper.contains(parent))return false;
      const before=document.createRange();before.selectNodeContents(parent);before.setEnd(caret.startContainer,caret.startOffset);
      const text=before.toString().replaceAll('\u00a0',' '),data=typeof event.data==='string'?event.data.replaceAll('\u00a0',' '):'';
      const bulk=data.length>1&&text.endsWith(data)?fragment(data):null;
      const token=bulk?{type:'bulk',start:text.length-data.length,raw:data}:inline(text),prefix=block(text);
      if(!token&&!prefix)return false;
      const range=textRange(parent,token?.start||0,text.length);if(!range)return false;
      const blocked=token?.type==='link'?protectedSelector.replace('code,',''):protectedSelector;
      if(range.cloneContents().querySelector(blocked+',br,img,p,div,li,h1,h2,h3,h4,h5,h6'))return false;
      if(token?.type==='wiki'&&!WikiLinks.parse(token.raw))return false;
      converting=true;
      try{
        selected.removeAllRanges();selected.addRange(range);
        if(prefix&&!token){
          document.execCommand('delete');document.execCommand(prefix.command,false,prefix.value);
        }else{
          let html;
          if(token.type==='bulk')html=bulk;
          else if(token.type==='wiki')html=WikiLinks.html(token.raw);
          else if(['strong','strongEm','em','strike','code'].includes(token.type)){
            // Keep formatting already inside a completed pair of delimiters.
            // Clean only the cloned fragment; the live edit remains undoable.
            const delimiter=token.type==='strongEm'?3:['strong','strike'].includes(token.type)?2:1;
            const copy=range.cloneContents(),inside=textRange(copy,delimiter,copy.textContent.length-delimiter)?.cloneContents();
            if(!inside)return false;PageLayout.clean(inside);
            const template=document.createElement('template');template.content.append(inside);
            const tag={strong:'strong',strongEm:'strong',em:'em',strike:'strike',code:'code'}[token.type];
            const body=token.type==='code'?escapeHtml(template.content.textContent):template.innerHTML;
            html='<'+tag+'>'+(token.type==='strongEm'?'<em>'+body+'</em>':body)+'</'+tag+'>';
          }
          else if(token.type==='link'){
            const template=document.createElement('template');template.innerHTML=renderMarkdown(token.raw);
            const link=template.content.querySelector('a[href]');
            if(!link)return false;
            // The label may already contain live formatting whose Markdown
            // delimiters were consumed before the closing link was typed.
            const copy=range.cloneContents(),end=token.raw.lastIndexOf('](');
            const label=textRange(copy,1,end)?.cloneContents();
            if(!label)return false;PageLayout.clean(label);
            const holder=document.createElement('template');holder.content.append(label);
            link.innerHTML=holder.innerHTML;
            html=link.outerHTML;
          }else {
            const template=document.createElement('template');template.innerHTML=renderMarkdown(token.raw.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'));
            html=template.content.firstElementChild?.tagName==='P'?template.content.firstElementChild.innerHTML:template.innerHTML;
          }
          document.execCommand('insertHTML',false,html+'<span data-editor-inline-caret="true">&#8203;</span>');
          // Subsequent typing belongs outside a completed inline format/link.
          const current=selected.rangeCount&&selected.getRangeAt(0);
          if(current){const marker=(current.startContainer.nodeType===1?current.startContainer:current.startContainer.parentElement).closest('[data-editor-inline-caret]');
            if(marker){const next=document.createRange();next.selectNodeContents(marker);next.collapse(false);selected.removeAllRanges();selected.addRange(next);}
            for(const command of ['bold','italic','strikeThrough'])if(document.queryCommandState(command))document.execCommand(command,false,null);}
        }
        selection=selected.rangeCount?selected.getRangeAt(0).cloneRange():null;
        save();$('#source').value=typeof files[active]?.sourceText==='string'?files[active].sourceText:markdown(paper.innerHTML);
        return true;
      }finally{converting=false;}
    }
    function schedule(event={}){
      if(converting)return;
      const ticket=++generation,file=files[active],input={inputType:event.inputType,isComposing:event.isComposing,data:event.data};
      // WebView rejects a nested execCommand while an editing transaction is
      // dispatching input. Run after that transaction, still before painting.
      queueMicrotask(()=>{if(ticket===generation&&file===files[active])convert(input);});
    }
    paper.addEventListener('compositionstart',()=>composing=true);
    paper.addEventListener('compositionend',()=>{composing=false;schedule();});
    paper.addEventListener('input',schedule,true);
    paper.addEventListener('paste',event=>{
      const selected=window.getSelection(),range=selected.rangeCount?selected.getRangeAt(0):null;
      const element=range&&(range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement);
      if(mode==='source'||active<0||!range||!paper.contains(element)||element.closest(protectedSelector))return;
      const html=fragment(event.clipboardData?.getData('text/plain')||'');if(!html)return;
      event.preventDefault();event.stopImmediatePropagation();selection=range.cloneRange();
      converting=true;try{format('insertHTML',html+'<span data-editor-inline-caret="true">&#8203;</span>');}finally{converting=false;}
    },true);
    return {convert};
  }
  const api={inline,block,textRange,install};if(typeof module==='object'&&module.exports)module.exports=api;else root.WriteInput=api;
})(globalThis);
