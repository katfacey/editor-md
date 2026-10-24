// Screen pagination leaves document text nodes intact, preserving selections,
// undo, Markdown structure, footnote references, and graph event handlers.
(function(root){
  const GAP=24;
  const sizes={Letter:[8.5,11],A4:[8.2677,11.6929],Legal:[8.5,14]};
  function geometry(page={}){
    let [width,height]=sizes[page.size]||sizes.Letter;
    if(page.orientation==='landscape')[width,height]=[height,width];
    const margin=key=>Number.isFinite(page[key])?page[key]*96:96;
    const top=margin('top'),bottom=margin('bottom'),left=margin('left'),right=margin('right');
    return {width:width*96,height:height*96,top,bottom,left,right,bodyHeight:height*96-top-bottom,stride:height*96+GAP,gap:GAP};
  }
  function exclusionPath(g,count){
    const height=(count-1)*g.stride+g.bodyHeight,points=['0 0'];
    for(let index=0;index<count-1;index++){
      const end=index*g.stride+g.bodyHeight,next=(index+1)*g.stride;
      points.push('0 '+end+'px','100% '+end+'px','100% '+next+'px','0 '+next+'px');
    }
    points.push('0 '+height+'px','0 0');
    return {height,path:'polygon('+points.join(',')+')'};
  }
  function restoreViewStyle(element){
    const original=element.ownerDocument.createElement('span');
    original.setAttribute('style',element.getAttribute('data-editor-page-style')||'');
    const properties=(element.getAttribute('data-editor-page-properties')||'zoom,line-height').split(',');
    for(const property of properties){
      const value=original.style.getPropertyValue(property);
      if(value)element.style.setProperty(property,value,original.style.getPropertyPriority(property));else element.style.removeProperty(property);
    }
    if(!element.style.length)element.removeAttribute('style');
    element.removeAttribute('data-editor-page-style');element.removeAttribute('data-editor-page-properties');
  }
  function rememberViewStyle(element,property){
    if(!element.hasAttribute('data-editor-page-style'))element.setAttribute('data-editor-page-style',element.getAttribute('style')||'');
    const properties=new Set((element.getAttribute('data-editor-page-properties')||'').split(',').filter(Boolean));
    properties.add(property);element.setAttribute('data-editor-page-properties',[...properties].join(','));
  }
  function clean(node){
    node.querySelectorAll('[data-editor-inline-caret]').forEach(marker=>{
      const walker=document.createTreeWalker(marker,NodeFilter.SHOW_TEXT);while(walker.nextNode())walker.currentNode.textContent=walker.currentNode.textContent.replaceAll('\u200b','');
      marker.replaceWith(...marker.childNodes);
    });
    node.querySelectorAll('[data-editor-page-exclusion]').forEach(element=>element.remove());
    node.querySelectorAll('[data-editor-page-style]').forEach(restoreViewStyle);
    return node;
  }
  function cleanHtml(html){
    if(!html.includes('data-editor-page-')&&!html.includes('data-editor-inline-caret'))return html;
    const template=document.createElement('template');template.innerHTML=html;
    clean(template.content);return template.innerHTML;
  }
  function install({paper,stack,sheets,canvas,getPage,isPaged}){
    let pending=false,running=false,composing=false,pageCount=1,active=false,currentGeometry=geometry(),lastWidth=0;
    const observer=new MutationObserver(schedule);
    const observe=()=>observer.observe(paper,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','class','src','width','height']});
    function schedule(){
      if(pending)return;
      // Yield to painting and input even while images and fonts are settling.
      pending=true;setTimeout(()=>{pending=false;if(!composing)refresh();},16);
    }
    function resetFits(){
      paper.querySelectorAll('[data-editor-page-style]').forEach(restoreViewStyle);
    }
    function contentBottom(g){
      const first=[...paper.childNodes].find(node=>node.nodeType!==1||!node.hasAttribute('data-editor-page-exclusion'));
      if(!first)return g.top;
      const range=document.createRange();range.setStartBefore(first);range.setEnd(paper,paper.childNodes.length);
      const bounds=paper.getBoundingClientRect(),scale=bounds.width/g.width;
      let bottom=g.top;
      for(const rect of range.getClientRects())if(rect.width&&rect.height)bottom=Math.max(bottom,(rect.bottom-bounds.top)/scale);
      return bottom;
    }
    function setExclusion(g,count){
      const shape=exclusionPath(g,count);
      paper.style.setProperty('--page-exclusion-height',shape.height+'px');
      paper.style.setProperty('--page-exclusion-shape',shape.path);
    }
    function fitObjects(g){
      const scale=paper.getBoundingClientRect().width/g.width;
      // Very wide margins can leave less room than a large font's leading.
      // Reduce surplus leading in the view while retaining its point size.
      for(const element of paper.querySelectorAll('font,span[style],p[style],h1[style],h2[style],h3[style]')){
        if(element.hasAttribute('data-editor-page-exclusion'))continue;
        const style=getComputedStyle(element),lineHeight=parseFloat(style.lineHeight),fontSize=parseFloat(style.fontSize);
        if(lineHeight>g.bodyHeight-4&&fontSize<=g.bodyHeight-4){
          rememberViewStyle(element,'line-height');
          element.style.lineHeight=(g.bodyHeight-4)+'px';
        }
      }
      const objects=paper.querySelectorAll('tr,figure,.eyebrow,.byline,.doc-footer,img');
      for(const element of objects){
        if(element.matches('img')&&element.closest('figure'))continue;
        const style=getComputedStyle(element),rect=element.getBoundingClientRect(),height=rect.height/scale;
        const extent=height+(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0);
        const width=rect.width/scale+(parseFloat(style.marginLeft)||0)+(parseFloat(style.marginRight)||0);
        const ratio=Math.min(1,(g.bodyHeight-2)/extent,(g.width-g.left-g.right-2)/width);
        if(ratio<1&&ratio>0){
          rememberViewStyle(element,'zoom');
          element.style.zoom=String(ratio);
        }
      }
    }
    function refresh(){
      if(running)return;
      running=true;observer.disconnect();
      const scrollTop=canvas.scrollTop,scrollLeft=canvas.scrollLeft;
      try{
        resetFits();
        active=isPaged();stack.classList.toggle('paginated',active);
        if(!active){
          paper.querySelectorAll('[data-editor-page-exclusion]').forEach(element=>element.remove());
          paper.style.removeProperty('height');paper.style.removeProperty('mask-image');
          paper.style.removeProperty('--page-exclusion-height');paper.style.removeProperty('--page-exclusion-shape');
          sheets.replaceChildren();pageCount=1;
          // Scale the whole image box, preserving explicitly chosen proportions.
          // CSS max-width alone shrinks width while retaining a fixed height.
          const width=paper.clientWidth-parseFloat(getComputedStyle(paper).paddingLeft)-parseFloat(getComputedStyle(paper).paddingRight);
          const scale=paper.getBoundingClientRect().width/Math.max(1,paper.offsetWidth);
          for(const image of paper.querySelectorAll('img')){
            const extent=image.getBoundingClientRect().width/scale;
            if(extent>width&&width>0){rememberViewStyle(image,'zoom');image.style.zoom=String(width/extent);}
          }
          return;
        }
        const g=currentGeometry=geometry(getPage());
        stack.style.setProperty('--page-body-height',g.bodyHeight+'px');
        stack.style.setProperty('--page-stride',g.stride+'px');
        paper.querySelectorAll('[data-editor-page-exclusion]').forEach(element=>element.remove());
        fitObjects(g);
        let probe=Math.max(2,pageCount),needed=1;
        for(let attempt=0;attempt<12;attempt++){
          setExclusion(g,probe);
          needed=Math.max(1,Math.ceil((contentBottom(g)+g.bottom+g.gap-0.5)/g.stride));
          if(needed<=probe)break;
          // Account for the margins that will be introduced by further sheets.
          probe=Math.min(5000,Math.max(needed+1,Math.ceil(needed*g.height/g.bodyHeight)));
        }
        // Malformed HTML must never allocate an unbounded number of sheets.
        needed=Math.min(5000,needed);
        pageCount=needed;setExclusion(g,pageCount);
        paper.style.height=(pageCount*g.height+(pageCount-1)*g.gap)+'px';
        // Borders, highlights and selection backgrounds also stop at margins.
        paper.style.maskImage='repeating-linear-gradient(to bottom,transparent 0 '+g.top+'px,#000 '+g.top+'px '+(g.height-g.bottom)+'px,transparent '+(g.height-g.bottom)+'px '+g.stride+'px)';
        const fragment=document.createDocumentFragment();
        for(let index=0;index<pageCount;index++){
          const sheet=document.createElement('div');sheet.className='page-sheet';sheet.style.top=index*g.stride+'px';sheet.dataset.pageNumber=String(index+1);fragment.append(sheet);
        }
        sheets.replaceChildren(fragment);
      }finally{
        canvas.scrollTop=scrollTop;canvas.scrollLeft=scrollLeft;
        observer.takeRecords();observe();running=false;
        document.dispatchEvent(new Event('paginationchange'));
      }
    }
    observe();
    paper.addEventListener('compositionstart',()=>composing=true);
    paper.addEventListener('compositionend',()=>{composing=false;schedule();});
    paper.addEventListener('load',schedule,true);paper.addEventListener('error',schedule,true);
    document.addEventListener('documentchange',schedule);document.addEventListener('viewchange',schedule);
    document.fonts?.ready.then(schedule);
    new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width!==lastWidth){lastWidth=width;schedule();}}).observe(stack);
    return {refresh,schedule,get pageCount(){return pageCount},get active(){return active},get geometry(){return currentGeometry}};
  }
  const api={geometry,exclusionPath,clean,cleanHtml,install};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PageLayout=api;
})(globalThis);
