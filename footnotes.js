// Footnote identities come from Markdown; displayed numbers follow reference order.
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Footnotes=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const key=value=>value.toLowerCase();
  const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  function linesOf(source){
    const lines=[];let start=0;
    for(const raw of source.match(/[^\n]*\n|[^\n]+$/g)||[]){lines.push({raw,text:raw.replace(/\r?\n$/,''),start,end:start+raw.length});start+=raw.length;}
    return lines;
  }
  function ignoredRanges(source){
    const ranges=[];let fence=null;
    for(const line of linesOf(source)){
      const match=line.text.match(/^ {0,3}(`{3,}|~{3,})/);
      if(fence){ranges.push([line.start,line.end]);if(match&&match[1][0]===fence[0]&&match[1].length>=fence.length&&/^\s*$/.test(line.text.slice(match[0].length)))fence=null;continue;}
      if(match){fence=match[1];ranges.push([line.start,line.end]);}
      else if(/^( {4}|\t)/.test(line.text))ranges.push([line.start,line.end]);
    }
    for(const match of source.matchAll(/<!--[\s\S]*?(?:-->|$)|<(pre|code|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi))ranges.push([match.index,match.index+match[0].length]);
    return ranges;
  }
  function references(source,ignored=[]){
    const refs=[];const ranges=[...ignored].sort((a,b)=>a[0]-b[0]);let range=0;
    for(let i=0;i<source.length;){
      while(range<ranges.length&&ranges[range][1]<=i)range++;
      if(range<ranges.length&&ranges[range][0]<=i){i=ranges[range][1];continue;}
      if(source[i]==='\\'){i+=2;continue;}
      if(source[i]==='`'){
        const run=source.slice(i).match(/^`+/)[0];let end=i+run.length,found=-1;
        while((end=source.indexOf(run,end))>=0){if(source[end-1]!=='`'&&source[end+run.length]!=='`'){found=end;break;}end+=run.length;}
        i=found<0?i+run.length:found+run.length;continue;
      }
      if(source[i]==='<'){const tag=source.slice(i).match(/^<\/?[a-zA-Z][^>]*>/);if(tag){i+=tag[0].length;continue;}}
      const match=source.slice(i).match(/^\[\^([^\]\s]+)\](?!:)/);
      if(match){refs.push({id:key(match[1]),label:match[1],start:i,end:i+match[0].length});i+=match[0].length;}else i++;
    }
    return refs;
  }
  function parse(source){
    const lines=linesOf(source),ignored=ignoredRanges(source),definitions=[];
    const excluded=offset=>ignored.some(([start,end])=>start<=offset&&offset<end);
    for(let i=0;i<lines.length;i++){
      const line=lines[i],match=line.text.match(/^ {0,3}\[\^([^\]\s]+)\]:[ \t]?(.*)$/);
      if(!match||excluded(line.start))continue;
      const body=[match[2]];let last=i;
      while(last+1<lines.length){
        const next=lines[last+1];
        if(/^( {4}|\t)/.test(next.text)){body.push(next.text.replace(/^( {4}|\t)/,''));last++;}
        else if(!next.text.trim()&&last+2<lines.length&&/^( {4}|\t)/.test(lines[last+2].text)){body.push('');last++;}
        else break;
      }
      const labelStart=line.start+line.text.indexOf('[^');
      definitions.push({id:key(match[1]),label:match[1],text:body.join('\n'),start:line.start,end:lines[last].end,labelStart,labelEnd:labelStart+match[1].length+3});
      i=last;
    }
    const refs=references(source,[...ignored,...definitions.map(note=>[note.start,note.end])]);
    const byId=new Map();definitions.forEach(note=>{if(!byId.has(note.id))byId.set(note.id,note);});
    const ids=[...new Set([...refs.map(ref=>ref.id),...definitions.map(note=>note.id)])];
    const notes=ids.map((id,index)=>({id,number:index+1,text:byId.get(id)?.text??'',missing:!byId.has(id),references:refs.filter(ref=>ref.id===id)}));
    return {source,definitions,refs,notes};
  }
  function replace(source,edits){
    for(const edit of [...edits].sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
    return source;
  }
  function normalize(source){
    const model=parse(source),numbers=new Map(model.notes.map(note=>[note.id,String(note.number)]));
    return replace(source,[...model.refs.map(ref=>({...ref,text:'[^'+numbers.get(ref.id)+']'})),...model.definitions.map(note=>({start:note.labelStart,end:note.labelEnd,text:'[^'+numbers.get(note.id)+']'}))]);
  }
  function definition(id,text){return '[^'+id+']: '+text.trim().split('\n').join('\n    ');}
  function append(source,id,text){return source.replace(/\s*$/,'')+'\n\n'+definition(id,text)+'\n';}
  function remove(source,id){
    id=key(id);const model=parse(source);
    return normalize(replace(source,[...model.refs.filter(ref=>ref.id===id).map(ref=>({...ref,text:''})),...model.definitions.filter(note=>note.id===id).map(note=>({...note,text:''}))]));
  }
  function update(source,id,text){
    const model=parse(source),notes=model.definitions.filter(note=>note.id===key(id));
    if(!notes.length)return normalize(append(source,id,text));
    return normalize(replace(source,notes.map((note,index)=>({...note,text:index===0?definition(note.label,text)+(source.slice(note.start,note.end).endsWith('\n')?'\n':''):''}))));
  }
  function insert(source,offset,text,id){
    const model=parse(source);id=id||'note-'+Math.random().toString(36).slice(2);
    if(model.notes.some(note=>note.id===key(id)))throw Error('Footnote identity already exists');
    offset=Math.max(0,Math.min(source.length,offset));
    return normalize(append(source.slice(0,offset)+'[^'+id+']'+source.slice(offset),id,text));
  }
  function signed(text,enabled,initials){return text.trim()+(enabled?' -'+initials:'');}
  function referenceHtml(id,number,occurrence=1){
    const target='editor-md-fn-'+encodeURIComponent(id),ref=target+'-ref-'+occurrence;
    return '<sup class="footnote-reference" data-footnote-ref="'+escape(id)+'" contenteditable="false" id="'+ref+'"><a href="#'+target+'" title="Footnote '+number+'">'+number+'</a></sup>';
  }
  function render(source,renderBody){
    const model=parse(source);if(!model.notes.length)return renderBody(source);
    const numbers=new Map(model.notes.map(note=>[note.id,note.number])),counts=new Map();
    const body=replace(source,[...model.definitions.map(note=>({...note,text:''})),...model.refs.map(ref=>{
      const count=(counts.get(ref.id)||0)+1;counts.set(ref.id,count);
      return {...ref,text:referenceHtml(ref.id,numbers.get(ref.id),count)};
    })]);
    const items=model.notes.map(note=>'<li id="editor-md-fn-'+encodeURIComponent(note.id)+'" data-footnote-id="'+escape(note.id)+'" data-footnote-source="'+escape(note.text)+'"'+(note.missing?' data-footnote-missing="true"':'')+'><div class="footnote-body">'+(note.missing?'<p>Footnote text is missing.</p>':renderBody(note.text))+'</div></li>').join('');
    return renderBody(body)+'<div class="document-footnotes" data-footnotes="true" contenteditable="false"><hr><p class="footnotes-heading">Footnotes</p><ol>'+items+'</ol></div>';
  }
  // DOM conversion keeps the original Markdown of each note, including formatting.
  function serialize(html,convert,document){
    const root=document.createElement('div');root.innerHTML=html;
    const notes=[...root.querySelectorAll('[data-footnote-id]')].map(node=>({id:node.dataset.footnoteId,text:node.dataset.footnoteSource||'',missing:node.hasAttribute('data-footnote-missing')}));
    const refs=[],nonce='EDITORFOOTNOTE'+Math.random().toString(36).slice(2).toUpperCase();
    root.querySelectorAll('[data-footnotes]').forEach(node=>node.remove());
    root.querySelectorAll('[data-footnote-ref]').forEach(node=>{const token=nonce+'REF'+refs.length+'TOKEN';refs.push({token,id:node.dataset.footnoteRef});node.replaceWith(document.createTextNode(token));});
    let source=convert(root.innerHTML);
    for(const ref of refs)source=source.replaceAll(ref.token,'[^'+ref.id+']');
    for(const note of notes)if(!note.missing)source=append(source,note.id,note.text);
    // Keep identities stable during ordinary typing. Add/delete explicitly
    // canonicalize labels, while renderers number references by their position.
    return source;
  }
  return {parse,normalize,remove,update,insert,append,signed,render,serialize,referenceHtml};
});
