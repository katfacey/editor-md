// Mermaid source is retained in the document. Interactive affordances belong
// to the editor; the same source exports as a portable fenced Markdown block.
let mermaidPromise,diagramSequence=0,hydrationSequence=0;
function mermaidEngine(){
  if(!mermaidPromise)mermaidPromise=import('/node_modules/mermaid/dist/mermaid.esm.min.mjs').then(m=>m.default).catch(error=>{mermaidPromise=null;throw new Error('The local diagram renderer is unavailable. Run npm install, then open the preview with npm start.')});
  return mermaidPromise;
}
async function renderDiagram(source){
  const engine=await mermaidEngine(),css=getComputedStyle(document.body),color=k=>css.getPropertyValue('--'+k).trim();
  engine.initialize({startOnLoad:false,securityLevel:'strict',suppressErrorRendering:true,theme:'base',
    themeVariables:{background:color('paper'),primaryColor:color('pale'),primaryTextColor:color('ink'),primaryBorderColor:color('green'),lineColor:color('muted'),textColor:color('ink'),fontFamily:'Segoe UI, sans-serif'},
    flowchart:{htmlLabels:false,useMaxWidth:true},maxTextSize:30000});
  return (await engine.render('editor-diagram-'+(++diagramSequence),source)).svg;
}
function graphMarkup(source){return '<figure class="diagram-block" contenteditable="false" data-mermaid="'+escapeHtml(source)+'"></figure><p><br></p>'}
async function hydrateDiagrams(force=false){
  for(const block of $$('#paper [data-mermaid]')){
    if(!force&&block.dataset.rendered===block.dataset.mermaid&&(block.querySelector('svg')||block.dataset.renderPending))continue;
    const source=block.dataset.mermaid;
    const ticket=String(++hydrationSequence);block.dataset.renderPending=ticket;
    block.dataset.rendered=source;
    block.innerHTML='<div class="graph-controls"><span>'+icon('chart')+' Diagram</span><button class="edit-graph">Edit graph</button><button class="graph-minus" aria-label="Zoom graph out">−</button><button class="graph-plus" aria-label="Zoom graph in">+</button><button class="graph-fit">Fit</button></div><div class="diagram-image">Rendering diagram…</div><div class="graph-status" aria-live="polite">Select a node or data mark to inspect it.</div>';
    block.querySelector('.edit-graph').onclick=()=>graphStudio(block);
    let scale=1;const zoom=()=>block.querySelector('svg')?.style.setProperty('width',scale*100+'%');
    block.querySelector('.graph-minus').onclick=()=>{scale=Math.max(.5,scale-.25);zoom()};
    block.querySelector('.graph-plus').onclick=()=>{scale=Math.min(3,scale+.25);zoom()};
    block.querySelector('.graph-fit').onclick=()=>{scale=1;zoom()};
    try{
      const svg=await renderDiagram(source);
      if(!block.isConnected||block.dataset.mermaid!==source||block.dataset.renderPending!==ticket)continue;
      delete block.dataset.renderPending;
      block.querySelector('.diagram-image').innerHTML=svg;
      const recovered=editableGraph(source);
      const rows=recovered&&recovered.type!=='flow'?parseGraphData(recovered.data,recovered.type):[];
      block.querySelectorAll('.node,.slice,.pieCircle,.line-plot-0 path,.bar-plot-0 rect').forEach((node,i)=>{
        node.setAttribute('tabindex','0');node.setAttribute('role','button');
        const label=node.textContent.trim()||node.querySelector('title')?.textContent||(rows[i]?rows[i].label+': '+rows[i].value:'Data series');
        node.setAttribute('aria-label','Inspect '+label);
        if(!node.querySelector('title')){const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=label;node.append(title)}
        const select=()=>{block.querySelectorAll('.inspected').forEach(n=>n.classList.remove('inspected'));node.classList.add('inspected');block.querySelector('.graph-status').textContent='Selected: '+label};
        node.onclick=select;node.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}};
      });
    }catch(error){if(block.dataset.renderPending!==ticket)continue;delete block.dataset.renderPending;block.querySelector('.diagram-image').textContent='Diagram could not render. Use Edit graph to check its Mermaid source.';block.querySelector('.graph-status').textContent=error.message.split('\n')[0];delete block.dataset.rendered}
  }
}
const graphSamples={
  bar:{title:'A week of focused writing',data:'Mon, 320\nTue, 480\nWed, 390\nThu, 610\nFri, 540'},
  line:{title:'A week of focused writing',data:'Mon, 320\nTue, 480\nWed, 390\nThu, 610\nFri, 540'},
  pie:{title:'Room for the work that matters',data:'Writing, 45\nResearch, 30\nReview, 25'},
  flow:{title:'From idea to finished page',data:'Capture an idea\nWrite a first draft\nReview and refine\nExport and share'}
};
function parseGraphData(text,type){
  const lines=text.split('\n').map(s=>s.trim()).filter(Boolean);
  if(!lines.length||lines.length>24)throw new Error('Use between 1 and 24 rows.');
  if(type==='flow')return lines;
  return lines.map((line,i)=>{const split=line.lastIndexOf(',');let label=line.slice(0,split).trim(),value=Number(line.slice(split+1).trim());if(split<1||!line.slice(split+1).trim()||!Number.isFinite(value))throw new Error('Row '+(i+1)+': use Label, number.');if(type==='pie'&&value<0)throw new Error('Pie values must be zero or greater.');return {label,value}});
}
function graphSource(type,title,data){
  const q=s=>JSON.stringify(s.replace(/[\r\n]/g,' ')),rows=parseGraphData(data,type);
  if(type==='flow')return 'flowchart LR\n'+rows.map((text,i)=>'  N'+i+'['+q(text)+']').join('\n')+'\n'+rows.slice(1).map((_,i)=>'  N'+i+' --> N'+(i+1)).join('\n');
  if(type==='pie'){if(rows.every(r=>r.value===0))throw new Error('A pie chart needs at least one positive value.');return 'pie showData\n  title '+title.replace(/[\r\n]/g,' ')+'\n'+rows.map(r=>'  '+q(r.label)+' : '+r.value).join('\n')}
  const minimum=Math.min(0,...rows.map(r=>r.value)),maximum=Math.max(1,...rows.map(r=>r.value));
  return 'xychart-beta\n  title '+q(title)+'\n  x-axis ['+rows.map(r=>q(r.label)).join(', ')+']\n  y-axis "Value" '+minimum+' --> '+maximum+'\n  '+(type==='line'?'line':'bar')+' ['+rows.map(r=>r.value).join(', ')+']';
}
function editableGraph(source){
  // Recover the form from the subset generated by this studio. More complex
  // Mermaid remains fully editable through the source view without loss.
  try{
    const text=source.trim();let type,title,data;
    if(text.startsWith('xychart-beta')){
      type=/\n\s*line /.test(text)?'line':'bar';
      title=JSON.parse(text.match(/\btitle (".*")/)[1]);
      const labels=JSON.parse('['+text.match(/x-axis \[(.*)\]/)[1]+']');
      const values=JSON.parse('['+text.match(/(?:bar|line) \[(.*)\]/)[1]+']');
      data=labels.map((label,i)=>label+', '+values[i]).join('\n');
    }else if(text.startsWith('pie showData')){
      type='pie';title=text.match(/\btitle (.*)/)[1];
      data=[...text.matchAll(/^\s*(".*") : (-?[\d.]+)$/gm)].map(m=>JSON.parse(m[1])+', '+m[2]).join('\n');
    }else if(text.startsWith('flowchart LR')){
      type='flow';title=graphSamples.flow.title;data=[...text.matchAll(/^\s*N\d+\[(".*")\]$/gm)].map(m=>JSON.parse(m[1])).join('\n');
    }
    return type&&graphSource(type,title,data).trim()===text?{type,title,data}:null;
  }catch{return null}
}
function graphStudio(existing=null){
  const originalSelection=selection?.cloneRange();
  openDialog(existing?'Edit graph':'Graph studio',`<div class="studio-menubar"><button id="graph-new">New</button><button id="graph-copy">Copy source</button><button id="graph-load-example">Load example</button><span></span><button id="graph-show-source">Show Mermaid source</button></div>
    <div class="studio-body"><aside class="graph-properties"><h3 class="section-label">GRAPH PROPERTIES</h3>
    <label>Graph type<select id="graph-type"><option value="bar">Bar chart</option><option value="line">Line chart</option><option value="pie">Pie chart</option><option value="flow">Flowchart</option><option value="source">Custom Mermaid</option></select></label>
    <label id="graph-title-label">Title<input id="graph-title" value="A week of focused writing"></label>
    <label id="graph-data-label">Data <small id="graph-data-hint">One label, value pair per line</small><textarea id="graph-data" spellcheck="false"></textarea></label>
    <div class="graph-format-note">Mermaid travels with your Markdown. Preview supports zoom and mark selection; interaction varies in other readers.</div>
    </aside><section class="studio-preview"><div class="studio-preview-head"><span>LIVE PREVIEW</span><div><button id="preview-minus" aria-label="Zoom preview out">−</button><button id="preview-fit">Fit</button><button id="preview-plus" aria-label="Zoom preview in">+</button></div></div><div id="graph-preview" class="graph-preview" aria-live="polite"></div><p id="graph-error" class="validation-error" role="alert"></p><label class="graph-source-editor" hidden>Mermaid source<textarea id="graph-source" spellcheck="false"></textarea></label></section></div>
    <div class="studio-footer"><span id="graph-syntax-state">Mermaid · stored as plain text</span><div><button id="cancel-graph">Cancel</button><button class="primary" id="insert-graph">${existing?'Update graph':'Insert graph'}</button></div></div>`);
  $('#dialog').classList.add('graph-studio');
  const recovered=existing?editableGraph(existing.dataset.mermaid):null;
  let isCustom=!!existing&&!recovered,request=0,validSource='',previewZoom=1,debounce;
  $('#graph-data').value=graphSamples.bar.data;
  if(recovered){$('#graph-type').value=recovered.type;$('#graph-title').value=recovered.title;$('#graph-data').value=recovered.data}
  else if(existing){$('#graph-type').value='source';$('#graph-source').value=existing.dataset.mermaid;$('.graph-source-editor').hidden=false}
  function updateFields(){const type=$('#graph-type').value,custom=type==='source';$('#graph-title-label').hidden=custom||type==='flow';$('#graph-data-label').hidden=custom;$('#graph-data-hint').textContent=type==='flow'?'One step per line':'One label, value pair per line';$('.graph-source-editor').hidden=!custom&&$('.graph-source-editor').hidden;$('#graph-show-source').textContent=$('.graph-source-editor').hidden?'Show Mermaid source':'Hide Mermaid source'}
  async function preview(){
    const id=++request;$('#insert-graph').disabled=true;$('#graph-error').textContent='';$('#graph-syntax-state').textContent='Rendering preview…';
    try{
      const source=isCustom?$('#graph-source').value:graphSource($('#graph-type').value,$('#graph-title').value,$('#graph-data').value);
      if(!isCustom)$('#graph-source').value=source;
      const svg=await renderDiagram(source);
      if(id!==request||!$('#graph-preview'))return;
      $('#graph-preview').innerHTML=svg;validSource=source;$('#insert-graph').disabled=false;$('#graph-syntax-state').textContent='✓ Valid Mermaid · portable Markdown source';
      $('#graph-preview svg').style.width=previewZoom*100+'%';
    }catch(error){if(id!==request||!$('#graph-error'))return;validSource='';$('#graph-error').textContent=error.message.slice(0,600);$('#graph-syntax-state').textContent='Check source before inserting'}
  }
  function schedule(){clearTimeout(debounce);request++;validSource='';$('#insert-graph').disabled=true;$('#graph-syntax-state').textContent='Changes pending…';debounce=setTimeout(preview,250)}
  $('#graph-type').onchange=()=>{const type=$('#graph-type').value;isCustom=type==='source';if(!isCustom){$('#graph-title').value=graphSamples[type].title;$('#graph-data').value=graphSamples[type].data}updateFields();preview()};
  $('#graph-data').oninput=$('#graph-title').oninput=()=>{isCustom=false;schedule()};
  $('#graph-source').oninput=()=>{isCustom=true;$('#graph-type').value='source';updateFields();schedule()};
  $('#graph-show-source').onclick=()=>{if($('#graph-type').value==='source')return;$('.graph-source-editor').hidden=!$('.graph-source-editor').hidden;updateFields()};
  $('#graph-new').onclick=()=>{$('#graph-type').value='bar';$('#graph-type').onchange()};
  $('#graph-load-example').onclick=()=>{$('#graph-type').value='flow';$('#graph-type').onchange()};
  $('#graph-copy').onclick=()=>navigator.clipboard.writeText($('#graph-source').value).then(()=>toast('Mermaid source copied')).catch(()=>toast('Select source and press Ctrl+C'));
  function zoomPreview(v){previewZoom=Math.min(3,Math.max(.5,v));$('#graph-preview svg')?.style.setProperty('width',previewZoom*100+'%')}
  $('#preview-minus').onclick=()=>zoomPreview(previewZoom-.25);$('#preview-plus').onclick=()=>zoomPreview(previewZoom+.25);$('#preview-fit').onclick=()=>zoomPreview(1);
  $('#cancel-graph').onclick=()=>{request++;clearTimeout(debounce);$('#dialog').close()};
  $('#dialog').addEventListener('close',()=>{request++;clearTimeout(debounce)},{once:true});
  $('#insert-graph').onclick=()=>{
    if(!validSource)return;
    // Close the modal before returning focus to contenteditable; a modal's
    // focus trap otherwise prevents the browser editing command from working.
    $('#dialog').close();
    if(existing){existing.dataset.mermaid=validSource;delete existing.dataset.rendered;save()}
    else if(mode==='source'){
      const input=$('#source'),start=input.selectionStart,end=input.selectionEnd;
      input.value=input.value.slice(0,start)+'\n```mermaid\n'+validSource+'\n```\n'+input.value.slice(end);input.oninput();
    }else{
      selection=originalSelection;insert(graphMarkup(validSource));
    }
    hydrateDiagrams();toast(existing?'Graph updated':'Graph inserted');
  };
  updateFields();preview();
}
officeActions.graphs=()=>graphStudio();
document.addEventListener('documentchange',()=>hydrateDiagrams());
document.addEventListener('appearancechange',()=>hydrateDiagrams(true));
hydrateDiagrams();
