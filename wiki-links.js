(function(root){
  function parse(source){
    const match=String(source).match(/^\[\[([^\]\r\n]+)\]\]$/);if(!match)return null;
    const [destination,...alias]=match[1].split('|'),hash=destination.indexOf('#');
    const target=(hash<0?destination:destination.slice(0,hash)).trim(),heading=hash<0?'':destination.slice(hash+1).trim();
    if((!target&&!heading)||/[:\x00-\x1f]/.test(target)||/^[\\/]/.test(target))return null;
    return {source:String(source),target,heading,label:alias.length?alias.join('|').trim():destination.trim()};
  }
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function html(source){const link=parse(source);return link?'<a data-wiki-link="'+escape(link.target)+'" data-wiki-source="'+escape(source)+'" href="#" title="Double-click to open in a new tab" tabindex="0">'+escape(link.label)+'</a>':escape(source);}
  function decorate(container){
    const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())if(!walker.currentNode.parentElement?.closest('a,code,pre,script,style,[data-mermaid]')&&walker.currentNode.textContent.includes('[['))nodes.push(walker.currentNode);
    for(const node of nodes){
      const text=node.textContent,parts=[...text.matchAll(/(?<!\\)\[\[([^\]\r\n]+)\]\]/g)].filter(match=>parse(match[0]));if(!parts.length)continue;
      const selected=window.getSelection(),caret=selected?.isCollapsed&&selected.anchorNode===node?selected.anchorOffset:null;
      const fragment=document.createDocumentFragment();let offset=0,newCaret=null;
      const appendText=(start,end)=>{const item=document.createTextNode(text.slice(start,end));fragment.append(item);if(caret!==null&&caret>=start&&caret<=end)newCaret={node:item,offset:caret-start};};
      for(const match of parts){appendText(offset,match.index);const template=document.createElement('template');template.innerHTML=html(match[0]);const anchor=template.content.firstChild;fragment.append(anchor);offset=match.index+match[0].length;if(caret!==null&&caret>match.index&&caret<=offset)newCaret={after:anchor};}
      appendText(offset,text.length);node.replaceWith(fragment);
      if(newCaret){const range=document.createRange();if(newCaret.after)range.setStartAfter(newCaret.after);else range.setStart(newCaret.node,newCaret.offset);range.collapse(true);selected.removeAllRanges();selected.addRange(range);}
    }
    return container;
  }
  function install(){
    const render=renderMarkdown;renderMarkdown=source=>{const t=document.createElement('template');t.innerHTML=render(source);decorate(t.content);return t.innerHTML;};
    const convert=markdown;markdown=content=>{const t=document.createElement('template');t.innerHTML=content;t.content.querySelectorAll('a[data-wiki-source]').forEach(a=>a.replaceWith(document.createTextNode(a.dataset.wikiSource)));return convert(t.innerHTML);};
    $('#paper').addEventListener('input',()=>{decorate($('#paper'));save();});
    const click=event=>{if(event.target.closest('a[data-wiki-link]'))event.preventDefault();};$('#paper').addEventListener('click',click,true);
    $('#paper').addEventListener('dblclick',event=>{const anchor=event.target.closest('a[data-wiki-link]');if(anchor){event.preventDefault();event.stopImmediatePropagation();open(anchor);}},true);
    $('#paper').addEventListener('keydown',event=>{const anchor=event.target.closest('a[data-wiki-link]');if(anchor&&event.key==='Enter'){event.preventDefault();open(anchor);}},true);
  }
  let api=null;
  async function open(anchor){
    const link=parse(anchor.dataset.wikiSource);if(!link)return;
    try{
      if(!link.target){jump(link.heading);return;}
      if(api){const doc=await api.invoke('open_wiki_document',{id:files[active]?.id,target:link.target});api.adoptDocuments([doc]);}
      else{const name=link.target.replace(/\.(md|markdown|mdown)$/i,'').split('/').pop().toLowerCase(),matches=files.filter(file=>file.name.replace(/\.(md|markdown|mdown)$/i,'').toLowerCase()===name);if(matches.length!==1)throw Error('Open a project folder in the desktop app to resolve this link.');openFile(files.indexOf(matches[0]));}
      jump(link.heading);
    }catch(error){toast('Could not open [['+link.target+']]: '+String(error));}
  }
  function jump(heading){if(!heading)return;const wanted=heading.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');const element=$$('#paper h1,#paper h2,#paper h3,#paper h4,#paper h5,#paper h6').find(e=>e.textContent.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'')===wanted);element?.scrollIntoView({block:'start'});}
  const model={parse,html,decorate,install,connect:value=>api=value,open};
  if(typeof module==='object'&&module.exports)module.exports=model;else root.WikiLinks=model;
})(globalThis);
