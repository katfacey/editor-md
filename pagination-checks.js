// Runs only on --smoke-test or from the explicit browser test harness.
async function runPaginationChecks(check){
  await document.fonts?.ready;
  const previous={layout:documentLayout,mode,zoom:documentZoom,ui:interfaceSettings.zoom,autosave:autosaveEnabled};
  autosaveEnabled=false;zoom(100);setInterfaceZoom(100);
  const source='# Pagination check\n\nShort text.\n',html=renderMarkdown(source);
  const draft={id:crypto.randomUUID(),name:'Pagination smoke.md',html,sourceHtml:html,sourceText:source};
  files.push(draft);openFile(files.indexOf(draft));setMode('write');setDocumentLayout('page');
  const paper=$('#paper'),canvas=$('#canvas-scroll'),sourceEditor=$('#source');
  const near=(value,expected)=>Math.abs(value-expected)<2;
  const settle=async()=>{await Promise.resolve();pagination.refresh();await Promise.resolve();};
  const sheets=()=>$$('#page-sheets .page-sheet');
  const noInnerScroll=node=>!['auto','scroll'].includes(getComputedStyle(node).overflowY)&&node.scrollHeight<=node.clientHeight+2;
  const setSource=async text=>{setMode('source');sourceEditor.value=text;sourceEditor.dispatchEvent(new Event('input',{bubbles:true}));setMode('write');await settle();};
  const sheetGeometry=()=>{
    const g=pagination.geometry,scale=paper.getBoundingClientRect().width/g.width,rects=sheets().map(sheet=>sheet.getBoundingClientRect());
    return rects.length===pagination.pageCount&&rects.every((r,i)=>near(r.width/scale,g.width)&&near(r.height/scale,g.height)&&(!i||near((r.top-rects[i-1].bottom)/scale,g.gap)));
  };
  function inkBounds(){
    const g=pagination.geometry,root=paper.getBoundingClientRect(),scale=root.width/g.width,walker=document.createTreeWalker(paper,NodeFilter.SHOW_TEXT);
    let checked=0,violations=0;
    while(walker.nextNode()){
      const text=walker.currentNode;
      if(!text.textContent.trim()||text.parentElement.closest('[data-editor-page-exclusion],[data-mermaid]'))continue;
      const range=document.createRange();range.selectNodeContents(text);
      for(const rect of range.getClientRects()){
        if(!rect.width||!rect.height)continue;
        checked++;
        const top=(rect.top-root.top)/scale,bottom=(rect.bottom-root.top)/scale,left=(rect.left-root.left)/scale,right=(rect.right-root.left)/scale;
        const page=Math.floor((top+0.1)/g.stride),start=page*g.stride;
        if(top<start+g.top-2||bottom>start+g.height-g.bottom+2||left<g.left-2||right>g.width-g.right+2||page>=pagination.pageCount)violations++;
      }
    }
    return {checked,violations};
  }
  const details={};
  try{
    await settle();
    check(pagination.pageCount===1&&sheetGeometry()&&near(sheets()[0].getBoundingClientRect().height,1056),'A short document occupies one exact 8.5 by 11 inch Letter sheet');
    check(['Top','Bottom','Left','Right'].every(edge=>getComputedStyle(paper)['padding'+edge]==='96px'),'Letter retains one-inch margins');
    pageDialog();$('#paper-size').value='Legal';$('#apply-page').click();await settle();
    check(sheetGeometry()&&near(sheets()[0].getBoundingClientRect().height,1344),'Legal changes the actual sheet to 8.5 by 14 inches');
    pageDialog();$('#page-orientation').value='landscape';$('#apply-page').click();await settle();
    check(sheetGeometry()&&near(sheets()[0].getBoundingClientRect().width,1344)&&near(sheets()[0].getBoundingClientRect().height,816),'Landscape swaps physical sheet dimensions');
    pageDialog();$('#paper-size').value='A4';$('#page-orientation').value='portrait';$('#margin-left').value='0.75';$('#margin-right').value='1.25';$('#apply-page').click();await settle();
    check(sheetGeometry()&&near(sheets()[0].getBoundingClientRect().height,11.6929*96)&&getComputedStyle(paper).paddingLeft==='72px'&&getComputedStyle(paper).paddingRight==='120px','A4 sheets and custom margins use the selected dimensions');
    const savedPage=JSON.stringify(draft.page);
    setDocumentLayout('web');await settle();
    check(!pagination.active&&!sheets().length&&!paper.querySelector('[data-editor-page-exclusion]'),'Web view removes sheet geometry and pagination helpers');
    setDocumentLayout('page');await settle();
    check(JSON.stringify(draft.page)===savedPage&&sheetGeometry(),'Returning from Web restores the selected paper and margins');
    pageDialog();$('#paper-size').value='Letter';$('#margin-preset').value='1';$('#margin-preset').dispatchEvent(new Event('change'));$('#apply-page').click();await settle();
    check(near(sheets()[0].getBoundingClientRect().height,1056)&&$('#print-page-style').textContent.includes('size:8.5in 11in'),'Returning to Letter restores screen and print dimensions');
    const lorem='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ';
    const paragraphs=Array.from({length:220},(_,index)=>'Paragraph '+index+'. '+lorem.repeat(3));
    const longSource='# Long document\n\n'+paragraphs.join('\n\n')+'\n\nEND OF LONG DOCUMENT.\n';
    await setSource(longSource);
    details.words=longSource.trim().split(/\s+/).length;details.letterPages=pagination.pageCount;
    let ink=inkBounds();details.measuredLines=ink.checked;
    check(details.words>20000&&pagination.pageCount>25&&sheetGeometry(),'Over 20,000 words flow through separate, exact Letter sheets ('+details.words+' words, '+pagination.pageCount+' sheets, geometry='+sheetGeometry()+')');
    check(ink.checked>1000&&ink.violations===0,'Every measured text line stays inside its sheet margins');
    check(noInnerScroll(paper)&&canvas.scrollHeight>canvas.clientHeight&&near(paper.getBoundingClientRect().height,pagination.pageCount*1056+(pagination.pageCount-1)*24),'Page stack has fixed sheet heights, visible gaps and one outer scrollbar');
    canvas.scrollTop=canvas.scrollHeight;
    paper.querySelector('p:last-child').scrollIntoView({block:'center'});
    const last=paper.querySelector('p:last-child').getBoundingClientRect(),viewport=canvas.getBoundingClientRect();
    check(canvas.scrollTop>0&&paper.scrollTop===0&&last.bottom<=viewport.bottom+2&&last.top>=viewport.top,'The outer scrollbar reaches the final paragraph on the last sheet ('+JSON.stringify({scroll:canvas.scrollTop,paperScroll:paper.scrollTop,lastTop:last.top,lastBottom:last.bottom,viewTop:viewport.top,viewBottom:viewport.bottom,height:canvas.scrollHeight,client:canvas.clientHeight})+')');
    canvas.scrollTop=0;
    const exactSource=draft.sourceText,exactHtml=PageLayout.cleanHtml(paper.innerHTML),node=paper.querySelector('p').firstChild;
    pagination.refresh();
    check(paper.querySelector('p').firstChild===node&&PageLayout.cleanHtml(paper.innerHTML)===exactHtml,'Repagination preserves existing text nodes and document structure');
    setDocumentLayout('web');await settle();setDocumentLayout('page');await settle();setMode('split');await settle();setMode('source');await settle();setMode('write');await settle();
    check(draft.sourceText===exactSource&&sheetGeometry()&&inkBounds().violations===0,'Page, Web, Split and Source round trips preserve all text and restore discrete sheets');
    for(const view of ['source','split','write']){
      setMode(view);await settle();
      check((view==='source'||noInnerScroll(paper))&&(view==='write'||noInnerScroll(sourceEditor))&&canvas.scrollHeight>canvas.clientHeight,'Page '+view+' keeps document scrolling on the outer canvas');
    }
    zoom(150);setInterfaceZoom(125);await settle();
    check(sheetGeometry()&&near(sheets()[0].getBoundingClientRect().width,816*1.5*1.25)&&inkBounds().violations===0,'Document and UI zoom scale all sheets and gaps consistently');
    zoom(100);setInterfaceZoom(100);await settle();
    const sheetColor=getComputedStyle(sheets()[0]).backgroundColor;
    theme();await settle();
    check(sheetGeometry()&&inkBounds().violations===0&&getComputedStyle(sheets()[0]).backgroundColor!==sheetColor,'Light and dark themes retain exact opaque sheets and readable page gaps');
    theme();await settle();
    check(getComputedStyle(sheets()[0]).backgroundColor===sheetColor,'Returning to the original theme restores its sheet color');
    const pageBefore=structuredClone(draft.page);
    pageDialog();$('#paper-size').value='A4';$('#margin-top').value='0.75';$('#margin-bottom').value='1.25';$('#apply-page').click();await settle();
    check(sheetGeometry()&&inkBounds().violations===0&&pagination.pageCount>25,'Long documents repaginate within A4 and asymmetric margins');
    pageDialog();$('#paper-size').value='Legal';$('#page-orientation').value='landscape';$('#apply-page').click();await settle();
    check(sheetGeometry()&&inkBounds().violations===0,'Long documents repaginate within landscape Legal sheets');
    pageDialog();$('#paper-size').value='A4';for(const edge of ['top','bottom','left','right'])$('#margin-'+edge).value='3';$('#apply-page').click();await settle();
    check(sheetGeometry()&&inkBounds().violations===0,'Long documents retain discrete sheets with the widest supported margins');
    draft.page=pageBefore;applyPage();await settle();
    await setSource('# A single spanning paragraph\n\n'+lorem.repeat(140)+'\n');
    check(pagination.pageCount>5&&sheetGeometry()&&inkBounds().violations===0&&paper.querySelectorAll('p').length===1,'A single very long paragraph flows over multiple sheets without splitting document markup');
    const table='| Name | Value |\n| --- | --- |\n'+Array.from({length:100},(_,i)=>'| Row '+i+' | '+lorem.slice(0,90)+' |').join('\n');
    const mixed='# Mixed formatting\n\n'+lorem.repeat(14)+'\n\n## Heading\n\n'+table+'\n\n> '+lorem.repeat(16)+'\n\n- First item\n- Second **bold** item\n\n'+String.fromCharCode(96).repeat(3)+'text\n'+Array.from({length:90},(_,i)=>'Code line '+i+' '+lorem.slice(0,75)).join('\n')+'\n'+String.fromCharCode(96).repeat(3)+'\n\nText with a footnote[^1] and <sup>superscript</sup>.\n\n[^1]: '+lorem.repeat(8)+' -KF\n';
    await setSource(mixed);
    check(sheetGeometry()&&inkBounds().violations===0&&$('#paper table')?.rows.length===101&&$('#paper [data-footnote-ref]'),'Tables, long blockquotes, lists, code, superscript and footnotes respect sheet margins');
    check([...paper.querySelectorAll('li')].every(item=>getComputedStyle(item).listStylePosition==='inside'),'List bullets and footnote numbers stay in the text flow instead of drifting to the far edge');
    const g=pagination.geometry,bounds=paper.getBoundingClientRect();
    check([...paper.querySelectorAll('tr')].every(row=>{const r=row.getBoundingClientRect(),top=r.top-bounds.top,start=Math.floor((top+.1)/g.stride)*g.stride;return top>=start+g.top-2&&r.bottom-bounds.top<=start+g.height-g.bottom+2}),'Table rows continue across sheets without being cut at a page boundary');
    const selected=paper.querySelector('p').firstChild,range=document.createRange();
    paper.focus();range.setStart(selected,10);range.collapse(true);const selection=document.getSelection();selection.removeAllRanges();selection.addRange(range);
    document.execCommand('insertText',false,'PAGINATION_EDIT');await settle();
    check(paper.textContent.includes('PAGINATION_EDIT')&&inkBounds().violations===0,'Typing into a paginated paragraph edits and reflows the original document');
    document.execCommand('undo');await settle();
    check(!paper.textContent.includes('PAGINATION_EDIT')&&inkBounds().violations===0,'Native undo still works after repagination');
    document.execCommand('redo');await settle();
    check(paper.textContent.includes('PAGINATION_EDIT'),'Native redo still works after repagination');
    const styleRange=document.createRange();styleRange.selectNodeContents(paper.querySelector('p'));styleRange.setEnd(styleRange.startContainer.firstChild,20);
    selection.removeAllRanges();selection.addRange(styleRange);
    document.execCommand('foreColor',false,'#bd4a42');await settle();
    check(!!paper.querySelector('font[color],span[style*=color]')&&inkBounds().violations===0,'Font color survives pagination and reflows within margins');
    const clean=PageLayout.clean(paper.cloneNode(true));
    check(!clean.querySelector('[data-editor-page-exclusion],[data-editor-page-style]')&&!markdown(paper.innerHTML).includes('data-editor-page-'),'Screen pagination helpers never enter saved Markdown or exported HTML');
    const fence=String.fromCharCode(96).repeat(3),pixel='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKf0AAAAASUVORK5CYII=';
    await setSource('# Objects on pages\n\n'+lorem.repeat(15)+'\n\n'+fence+'mermaid\nflowchart LR\n  A[Open] --> B[Edit] --> C[Save]\n'+fence+'\n\n<img src="data:image/png;base64,'+pixel+'" width="240" height="1200" alt="Tall pagination test image">\n\nLast object paragraph.\n');
    await hydrateDiagrams(true);await settle();
    const graph=paper.querySelector('[data-mermaid]'),image=paper.querySelector('img');
    check(!!graph?.querySelector('svg')&&sheetGeometry()&&inkBounds().violations===0,'Offline Mermaid graphs render on discrete sheets');
    const graphMarkup=graph.dataset.mermaid;graph.querySelector('.graph-plus').click();await settle();
    check(graph.dataset.mermaid===graphMarkup&&!!graph.querySelector('.edit-graph')&&sheetGeometry(),'Graph controls remain connected after pagination and graph zoom');
    const imageRect=image.getBoundingClientRect(),imagePage=Math.floor((imageRect.top-paper.getBoundingClientRect().top+.1)/pagination.geometry.stride),imageBottom=paper.getBoundingClientRect().top+imagePage*pagination.geometry.stride+pagination.geometry.height-pagination.geometry.bottom;
    check(imageRect.height<=pagination.geometry.bodyHeight+2&&imageRect.bottom<=imageBottom+2&&image.hasAttribute('data-editor-page-style'),'Oversized images fit inside a sheet without clipping or changing the stored image size');
    const savedImage=PageLayout.clean(paper.cloneNode(true)).querySelector('img');
    check(savedImage.getAttribute('height')==='1200'&&!savedImage.hasAttribute('style')&&!savedImage.hasAttribute('data-editor-page-style'),'Image fitting is a view preference and does not enter saved content');
    await setSource('<p><span style="font-size:96pt">Large type must still fit the selected sheet.</span></p>');
    pageDialog();$('#paper-size').value='A4';$('#page-orientation').value='landscape';for(const edge of ['top','bottom','left','right'])$('#margin-'+edge).value='3';$('#apply-page').click();await settle();
    check(sheetGeometry()&&inkBounds().violations===0&&getComputedStyle(paper.querySelector('p span[style]')).fontSize==='128px','96-point text fits narrow landscape content areas without changing its point size');
    const largeText=paper.querySelector('p span[style]');largeText.style.color='rgb(189, 74, 66)';await settle();
    check(largeText.style.color==='rgb(189, 74, 66)'&&PageLayout.clean(paper.cloneNode(true)).querySelector('p span[style]').style.color==='rgb(189, 74, 66)','Reformatting fitted text preserves new user styling through repagination and export');
    draft.page=pageBefore;applyPage();await settle();
    await setSource('# Short again\n\nOnly one sheet.\n');
    check(pagination.pageCount===1&&sheetGeometry()&&near(paper.getBoundingClientRect().height,1056),'Deleting long content removes surplus sheets and returns to exact Letter size');
    for(const layout of ['web','page'])for(const view of ['write','source','split']){
      setDocumentLayout(layout);setMode(view);await settle();
      check((view==='source'||noInnerScroll(paper))&&(view==='write'||noInnerScroll(sourceEditor)),layout+' '+view+' has no inner document scrollbar after shrinking');
    }
    return details;
  }finally{
    zoom(previous.zoom);setInterfaceZoom(previous.ui);setMode(previous.mode);setDocumentLayout(previous.layout);
    const closing=closeDocument(draft);
    $('#native-discard,#close-discard')?.click();await closing;
    autosaveEnabled=previous.autosave;
  }
}
