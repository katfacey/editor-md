// Source is portable Mermaid; structured editor state is retained in a comment.
let mermaidPromise,diagramSequence=0,hydrationSequence=0;
function mermaidEngine(){
  if(!mermaidPromise)mermaidPromise=import('/node_modules/mermaid/dist/mermaid.esm.min.mjs').then(m=>m.default).catch(()=>{mermaidPromise=null;throw new Error('Local renderer unavailable. Run npm ci and restart the preview.')});
  return mermaidPromise;
}
async function renderDiagram(source){
  const engine=await mermaidEngine(),css=getComputedStyle(document.body),color=k=>css.getPropertyValue('--'+k).trim();
  engine.initialize({startOnLoad:false,securityLevel:'strict',suppressErrorRendering:true,theme:'base',
    themeVariables:{background:color('paper'),primaryColor:color('pale'),primaryTextColor:color('ink'),primaryBorderColor:color('green'),lineColor:color('muted'),textColor:color('ink'),fontFamily:'Segoe UI, sans-serif',xyChart:{plotColorPalette:[color('green'),'#5b8fca','#b27bcc','#51a59b','#d77580','#ad9554','#7286ba','#8ca878'].join(',')}},
    flowchart:{htmlLabels:false,useMaxWidth:true},maxTextSize:60000});
  return (await engine.render('editor-diagram-'+(++diagramSequence),source)).svg;
}
function graphMarkup(source){return '<figure class="diagram-block" contenteditable="false" data-mermaid="'+escapeHtml(source)+'"></figure><p><br></p>'}
async function hydrateDiagrams(force=false){
  for(const block of $$('#paper [data-mermaid]')){
    if(!force&&block.dataset.rendered===block.dataset.mermaid&&(block.querySelector('svg')||block.dataset.renderPending))continue;
    const source=block.dataset.mermaid,ticket=String(++hydrationSequence);block.dataset.renderPending=ticket;block.dataset.rendered=source;
    block.innerHTML='<div class="graph-controls"><span>'+icon('chart')+' Diagram</span><button class="edit-graph">Edit graph</button><button class="graph-minus" aria-label="Zoom graph out">−</button><button class="graph-plus" aria-label="Zoom graph in">+</button><button class="graph-fit">Fit</button></div><div class="diagram-image">Rendering diagram…</div><div class="graph-status" aria-live="polite">Select a node or data mark to inspect it.</div>';
    block.querySelector('.edit-graph').onclick=()=>graphStudio(block);
    let scale=1;const zoom=()=>block.querySelector('svg')?.style.setProperty('width',scale*100+'%');
    block.querySelector('.graph-minus').onclick=()=>{scale=Math.max(.5,scale-.25);zoom()};block.querySelector('.graph-plus').onclick=()=>{scale=Math.min(3,scale+.25);zoom()};block.querySelector('.graph-fit').onclick=()=>{scale=1;zoom()};
    try{
      const svg=await renderDiagram(source);if(!block.isConnected||block.dataset.mermaid!==source||block.dataset.renderPending!==ticket)continue;delete block.dataset.renderPending;
      block.querySelector('.diagram-image').innerHTML=svg;
      const model=ChartModel.fromSource(source);
      block.querySelectorAll('.node,.slice,.pieCircle,[class^="line-plot-"] path,[class^="bar-plot-"] rect').forEach((node,i)=>{
        let label=node.textContent.trim()||'Data series';
        if(model?.kind==='chart'){
          const plot=node.closest('[class^="bar-plot-"],[class^="line-plot-"]'),series=plot?Number(plot.getAttribute('class').match(/plot-(\d+)/)?.[1]||0):(model.pieSeries||0);
          const row=plot?[...plot.querySelectorAll('rect')].indexOf(node):i;
          label=row>=0&&model.labels[row]?model.labels[row]+' · '+model.series[series].name+': '+model.series[series].values[row]:model.series[series]?.name||label;
        }
        node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-label','Inspect '+label);
        const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=label;node.append(title);
        const select=()=>{block.querySelectorAll('.inspected').forEach(n=>n.classList.remove('inspected'));node.classList.add('inspected');block.querySelector('.graph-status').textContent='Selected: '+label};
        node.onclick=select;node.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}};
      });
    }catch(error){if(block.dataset.renderPending!==ticket)continue;delete block.dataset.renderPending;delete block.dataset.rendered;block.querySelector('.diagram-image').textContent='Could not render. Open Edit graph to check the source.';block.querySelector('.graph-status').textContent=error.message.split('\n')[0]}
  }
}
const diagramTemplates={
  sequence:'sequenceDiagram\n  participant W as Writer\n  participant E as Editor\n  W->>E: Share a draft\n  E-->>W: Send feedback\n  W->>E: Revise and publish',
  gantt:'gantt\n  title Publishing schedule\n  dateFormat YYYY-MM-DD\n  section Writing\n  First draft :a, 2026-10-18, 3d\n  Review :after a, 2d\n  Publish :milestone, 2026-10-23, 0d',
  mindmap:'mindmap\n  root((A good idea))\n    Research\n      Sources\n      Questions\n    Draft\n    Review',
  state:'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review\n  Review --> Draft: Changes needed\n  Review --> Published: Approved\n  Published --> [*]',
  class:'classDiagram\n  class Document {\n    +String title\n    +save()\n  }\n  class Section\n  Document "1" *-- "many" Section',
  er:'erDiagram\n  DOCUMENT ||--o{ SECTION : contains\n  DOCUMENT {\n    string title\n    string path\n  }\n  SECTION {\n    string heading\n  }'
};
const shapeNames={process:'Process ▭',rounded:'Rounded step',decision:'Decision ◇',terminal:'Start / end',database:'Database',subroutine:'Subprocess'};
const diagramNames={bar:'Bar chart',line:'Line chart',pie:'Pie chart',flow:'Flowchart',sequence:'Sequence diagram',gantt:'Gantt schedule',mindmap:'Mind map',state:'State diagram',class:'Class diagram',er:'Entity relationship',source:'Custom Mermaid'};
function graphStudio(existing=null,options={}){
  const originalRange=(options.range||selection)?.cloneRange(),sourcePosition=options.sourcePosition??$('#source').selectionEnd;
  let chart=ChartModel.sampleChart(),flow=ChartModel.sampleFlow(),type='bar',customSource='',selectedNode='N3',selectedEdge='E3',flowTab='nodes',importError='',showImport=!!options.data,showSource=false,previewZoom=1,validSource='',request=0,debounce;
  const model=existing?ChartModel.fromSource(existing.dataset.mermaid):null;
  if(model?.kind==='chart'){chart=model;type=model.type}else if(model?.kind==='flow'){flow=model;type='flow';selectedNode=flow.nodes[0].id;selectedEdge=flow.edges[0]?.id}else if(existing){type='source';customSource=existing.dataset.mermaid;showSource=true}
  if(options.data){try{chart=ChartModel.parseData(options.data)}catch(error){importError=error.message;chart.labels=[''];chart.series=[{name:'Value',values:[null]}]}}
  const past=[],future=[];let flowFromSelection=false;
  const snapshot=()=>JSON.stringify({chart,flow,type,customSource,selectedNode,selectedEdge,flowTab});
  const remember=()=>{past.push(snapshot());if(past.length>60)past.shift();future.length=0};
  function restore(serialized){({chart,flow,type,customSource,selectedNode,selectedEdge,flowTab}=JSON.parse(serialized));importError='';renderForm();schedule()}
  function change(mutate,redraw=false){remember();mutate();importError='';if(redraw)renderForm();schedule()}
  function nextId(prefix,items){let i=1;while(items.some(item=>item.id===prefix+i))i++;return prefix+i}
  const option=(value,label,current)=>'<option value="'+escapeHtml(value)+'" '+(value===current?'selected':'')+'>'+escapeHtml(label)+'</option>';
  openDialog(existing?'Edit graph':options.data?'Make chart from data':'Graph studio',`
    <div class="studio-menubar studio-commandbar"><button id="studio-undo" title="Undo graph edit">${icon('undo')} Undo</button><button id="studio-redo" title="Redo graph edit">${icon('redo')} Redo</button><button id="studio-import">${icon('table')} Import data</button><button id="studio-example">Load example</button><button id="studio-export">Save Mermaid</button><span></span><button id="graph-show-source">${icon('code')} Source</button></div>
    <div class="studio-body studio-v2"><aside class="graph-properties"><label for="graph-type">Diagram type</label><select id="graph-type">${Object.entries(diagramNames).map(([value,name])=>option(value,name,type)).join('')}</select><div id="graph-form"></div></aside><section class="studio-preview"><div class="studio-preview-head"><div><span>LIVE PREVIEW</span><small id="preview-help"></small></div><div><button id="preview-minus" aria-label="Zoom preview out">−</button><button id="preview-fit">Fit</button><button id="preview-plus" aria-label="Zoom preview in">+</button></div></div><div id="graph-preview" class="graph-preview"></div><div id="studio-legend"></div><p id="graph-error" class="validation-error" role="alert"></p><div class="graph-source-editor" hidden><label for="graph-source">Mermaid source</label><textarea id="graph-source" spellcheck="false"></textarea><button id="source-to-visual">Return to visual editor</button></div></section></div>
    <div class="studio-footer"><span id="graph-syntax-state" role="status" aria-live="polite"></span><div><button id="cancel-graph">Cancel</button><button class="primary" id="insert-graph" disabled>${existing?'Update graph':'Insert graph'}</button></div></div>`);
  $('#dialog').classList.add('graph-studio');
  const importMarkup=()=>`<details class="data-import" ${showImport?'open':''}><summary>Paste a table / CSV / TSV</summary><textarea id="import-data" aria-label="Data to import" placeholder="Month, Sales, Costs&#10;Jan, 120, 80&#10;Feb, 160, 95"></textarea><label>First row<select id="import-header"><option value="auto">Detect headings automatically</option><option value="yes">Use as headings</option><option value="no">Contains data</option></select></label><button class="primary" id="apply-import">Use this data</button><p id="import-error" class="validation-error" role="alert">${escapeHtml(importError)}</p></details>`;
  function wireImport(){
    if(!$('#apply-import'))return;
    if(options.data&&!$('#import-data').value)$('#import-data').value=options.data;
    $('#apply-import').onclick=()=>{try{const parsed=ChartModel.parseData($('#import-data').value,{header:$('#import-header').value});change(()=>{parsed.title=chart.title;chart=parsed;type=['bar','line','pie'].includes(type)?type:'bar';chart.type=type;showImport=false},true)}catch(error){$('#import-error').textContent=error.message}};
    $('.data-import').ontoggle=e=>showImport=e.target.open;
  }
  function renderForm(){
    $('#graph-type').value=type;$('#graph-show-source').classList.toggle('selected',showSource);const form=$('#graph-form');
    if(['bar','line','pie'].includes(type)){
      chart.type=type;
      form.innerHTML=`<label>Chart title<input id="graph-title" value="${escapeHtml(chart.title)}"></label><div class="field-grid axis-fields"><label>X axis<input id="chart-x" value="${escapeHtml(chart.xLabel)}"></label><label>Y axis<input id="chart-y" value="${escapeHtml(chart.yLabel)}"></label></div>${type==='pie'?'<label>Series to plot<select id="pie-series">'+chart.series.map((series,i)=>option(String(i),series.name,String(chart.pieSeries||0))).join('')+'</select></label>':''}<div class="form-section-title">Data <span>${chart.labels.length} rows · ${chart.series.length} series</span></div>
        <div class="chart-sheet"><table><thead><tr><th>Label</th>${chart.series.map((s,i)=>'<th><input data-series-name="'+i+'" aria-label="Series '+(i+1)+' name" value="'+escapeHtml(s.name)+'">'+(chart.series.length>1?'<button data-remove-series="'+i+'" aria-label="Remove series '+(i+1)+'">×</button>':'')+'</th>').join('')}<th></th></tr></thead><tbody>${chart.labels.map((label,r)=>'<tr><td><input aria-label="Row '+(r+1)+' label" data-row-label="'+r+'" value="'+escapeHtml(label)+'"></td>'+chart.series.map((series,c)=>'<td><input type="number" step="any" aria-label="Row '+(r+1)+', '+escapeHtml(series.name)+'" data-cell="'+r+','+c+'" value="'+(series.values[r]??'')+'"></td>').join('')+'<td><button data-remove-row="'+r+'" aria-label="Remove row '+(r+1)+'" '+(chart.labels.length===1?'disabled':'')+'>×</button></td></tr>').join('')}</tbody></table></div><div class="form-inline-actions"><button id="add-data-row" ${chart.labels.length>=100?'disabled':''}>+ Row</button><button id="add-data-series" ${chart.series.length>=8?'disabled':''}>+ Series</button></div>${importMarkup()}`;
      $('#graph-title').oninput=e=>change(()=>chart.title=e.target.value);$('#chart-x').oninput=e=>change(()=>chart.xLabel=e.target.value);$('#chart-y').oninput=e=>change(()=>chart.yLabel=e.target.value);
      if($('#pie-series'))$('#pie-series').onchange=e=>change(()=>chart.pieSeries=+e.target.value);
      $$('[data-row-label]').forEach(input=>input.oninput=()=>change(()=>chart.labels[+input.dataset.rowLabel]=input.value));
      $$('[data-cell]').forEach(input=>input.oninput=()=>change(()=>{const [r,c]=input.dataset.cell.split(',').map(Number);chart.series[c].values[r]=input.value===''?null:Number(input.value)}));
      $$('[data-series-name]').forEach(input=>input.oninput=()=>change(()=>chart.series[+input.dataset.seriesName].name=input.value));
      $$('[data-remove-row]').forEach(button=>button.onclick=()=>change(()=>{const r=+button.dataset.removeRow;chart.labels.splice(r,1);chart.series.forEach(s=>s.values.splice(r,1))},true));
      $$('[data-remove-series]').forEach(button=>button.onclick=()=>change(()=>{chart.series.splice(+button.dataset.removeSeries,1);chart.pieSeries=0},true));
      $('#add-data-row').onclick=()=>change(()=>{chart.labels.push('Row '+(chart.labels.length+1));chart.series.forEach(s=>s.values.push(0))},true);$('#add-data-series').onclick=()=>change(()=>chart.series.push({name:'Series '+(chart.series.length+1),values:chart.labels.map(()=>0)}),true);wireImport();
    }else if(type==='flow')renderFlowForm(form);
    else{showSource=true;form.innerHTML='<h3 class="form-section-title">Mermaid source editor</h3><p class="graph-format-note">'+(type==='source'?'Use any diagram type supported by Mermaid.':'A '+diagramNames[type].toLowerCase()+' template is ready to edit.')+' Charts and flowcharts also have visual editing tools.</p><button id="reset-template">Reload this template</button>'+importMarkup();$('#reset-template').onclick=()=>change(()=>customSource=diagramTemplates[type]||'flowchart LR\n  A["Start"] --> B["Finish"]');wireImport()}
    $('.graph-source-editor').hidden=!showSource;$('#preview-help').textContent=type==='flow'?'Click a node to edit its label, shape, or connections.':'Data and diagram changes update this preview.';$('#studio-undo').disabled=!past.length;$('#studio-redo').disabled=!future.length;
  }
  function renderFlowForm(form){
    if(!flow.nodes.some(n=>n.id===selectedNode))selectedNode=flow.nodes[0]?.id;if(!flow.edges.some(e=>e.id===selectedEdge))selectedEdge=flow.edges[0]?.id;
    const node=flow.nodes.find(n=>n.id===selectedNode),edge=flow.edges.find(e=>e.id===selectedEdge),nodeOptions=current=>flow.nodes.map(n=>option(n.id,n.label,current)).join('');
    form.innerHTML=`<label>Flow direction<select id="flow-direction">${[['LR','Left → right'],['TB','Top → bottom'],['RL','Right → left'],['BT','Bottom → top']].map(([v,l])=>option(v,l,flow.direction)).join('')}</select></label><div class="flow-tabs"><button id="flow-nodes" class="${flowTab==='nodes'?'selected':''}">Nodes (${flow.nodes.length})</button><button id="flow-connections" class="${flowTab==='edges'?'selected':''}">Connections (${flow.edges.length})</button></div>
      <div class="flow-object-list">${flowTab==='nodes'?flow.nodes.map(n=>'<button data-select-node="'+n.id+'" class="'+(n.id===selectedNode?'selected':'')+'"><span>'+(n.shape==='decision'?'◇':n.shape==='terminal'?'◉':'▭')+'</span><span>'+escapeHtml(n.label)+'</span></button>').join(''):flow.edges.map(e=>'<button data-select-edge="'+e.id+'" class="'+(e.id===selectedEdge?'selected':'')+'">'+escapeHtml(flow.nodes.find(n=>n.id===e.from)?.label||e.from)+' → '+escapeHtml(flow.nodes.find(n=>n.id===e.to)?.label||e.to)+(e.label?' · '+escapeHtml(e.label):'')+'</button>').join('')||'<p>No connections yet.</p>'}</div><div class="form-inline-actions"><button id="add-flow-node" ${flow.nodes.length>=100?'disabled':''}>+ Node</button><button id="add-flow-edge" ${flow.edges.length>=200?'disabled':''}>+ Connect</button></div><button class="branch-button" id="add-flow-branch" ${flow.nodes.length>97?'disabled':''}>◇ Decision + Yes / No branches</button>
      ${flowTab==='nodes'&&node?`<div class="form-section-title">Selected node <span>${node.id}</span></div><label>Label<input id="flow-node-label" value="${escapeHtml(node.label)}" maxlength="200"></label><label>Shape<select id="flow-node-shape">${Object.entries(shapeNames).map(([v,l])=>option(v,l,node.shape)).join('')}</select></label><button class="remove-object" id="delete-flow-node" ${flow.nodes.length===1?'disabled':''}>Delete node and its connections</button>`:edge?`<div class="form-section-title">Selected connection</div><label>From<select id="flow-edge-from">${nodeOptions(edge.from)}</select></label><label>To<select id="flow-edge-to">${nodeOptions(edge.to)}</select></label><label>Connection label<input id="flow-edge-label" value="${escapeHtml(edge.label)}" placeholder="Yes, No, Retry…" maxlength="200"></label><label>Line style<select id="flow-edge-style">${[['arrow','Arrow →'],['line','Plain line —'],['dashed','Dashed arrow ⇢']].map(([v,l])=>option(v,l,edge.style)).join('')}</select></label><button class="remove-object" id="delete-flow-edge">Delete connection</button>`:''}`;
    $('#flow-direction').onchange=e=>change(()=>flow.direction=e.target.value);$('#flow-nodes').onclick=()=>{flowTab='nodes';renderForm()};$('#flow-connections').onclick=()=>{flowTab='edges';renderForm()};
    $$('[data-select-node]').forEach(b=>b.onclick=()=>{selectedNode=b.dataset.selectNode;renderForm();markSelectedNode();$('#flow-node-label')?.scrollIntoView({block:'nearest'})});$$('[data-select-edge]').forEach(b=>b.onclick=()=>{selectedEdge=b.dataset.selectEdge;renderForm();$('#flow-edge-label')?.scrollIntoView({block:'nearest'})});
    $('#add-flow-node').onclick=()=>change(()=>{const id=nextId('N',flow.nodes);flow.nodes.push({id,label:'New step',shape:'process'});selectedNode=id;flowTab='nodes'},true);
    $('#add-flow-edge').onclick=()=>change(()=>{const id=nextId('E',flow.edges),from=selectedNode||flow.nodes[0].id,to=flow.nodes.find(n=>n.id!==from)?.id||from;flow.edges.push({id,from,to,label:'',style:'arrow'});selectedEdge=id;flowTab='edges'},true);
    $('#add-flow-branch').onclick=()=>change(()=>{const parent=selectedNode,decision=nextId('N',flow.nodes);flow.nodes.push({id:decision,label:'Decision?',shape:'decision'});for(const label of ['Yes','No']){const id=nextId('N',flow.nodes);flow.nodes.push({id,label:label+' path',shape:'process'});flow.edges.push({id:nextId('E',flow.edges),from:decision,to:id,label,style:'arrow'})}if(parent)flow.edges.push({id:nextId('E',flow.edges),from:parent,to:decision,label:'',style:'arrow'});selectedNode=decision;flowTab='nodes'},true);
    if($('#flow-node-label'))$('#flow-node-label').oninput=e=>change(()=>{node.label=e.target.value;const b=$('[data-select-node="'+node.id+'"] span:last-child');if(b)b.textContent=node.label});if($('#flow-node-shape'))$('#flow-node-shape').onchange=e=>change(()=>node.shape=e.target.value);if($('#delete-flow-node'))$('#delete-flow-node').onclick=()=>change(()=>ChartModel.removeNode(flow,node.id),true);
    for(const property of ['from','to','label','style'])if($('#flow-edge-'+property))$('#flow-edge-'+property)[property==='label'?'oninput':'onchange']=e=>change(()=>{edge[property]=e.target.value;const b=$('[data-select-edge="'+edge.id+'"]');if(b)b.textContent=flow.nodes.find(n=>n.id===edge.from).label+' → '+flow.nodes.find(n=>n.id===edge.to).label+(edge.label?' · '+edge.label:'')});if($('#delete-flow-edge'))$('#delete-flow-edge').onclick=()=>change(()=>flow.edges=flow.edges.filter(e=>e.id!==edge.id),true);
  }
  function markSelectedNode(){$$('#graph-preview .node').forEach(n=>n.classList.toggle('studio-node-selected',n.dataset.editorNode===selectedNode))}
  async function preview(){
    const id=++request;validSource='';$('#insert-graph').disabled=true;$('#graph-error').textContent='';$('#graph-syntax-state').textContent='Rendering preview…';
    try{
      if(importError)throw new Error(importError);
      const source=['bar','line','pie'].includes(type)?ChartModel.toSource(chart):type==='flow'?ChartModel.toSource(flow):customSource;if(!source.trim())throw new Error('Add Mermaid source to preview your diagram.');
      if(document.activeElement!==$('#graph-source'))$('#graph-source').value=source;
      const svg=await renderDiagram(source);if(id!==request||!$('#graph-preview')||!$('#dialog').open)return;
      $('#graph-preview').innerHTML=svg;$('#graph-preview svg').style.width=previewZoom*100+'%';validSource=source;$('#insert-graph').disabled=false;$('#graph-syntax-state').textContent='✓ Ready · editable Mermaid saved with the document';
      $('#studio-legend').innerHTML=['bar','line'].includes(type)?chart.series.map((s,i)=>'<span><i style="--series-color:'+['var(--green)','#5b8fca','#b27bcc','#51a59b','#d77580','#ad9554','#7286ba','#8ca878'][i]+'"></i>'+escapeHtml(s.name)+'</span>').join(''):'';
      if(type==='flow'){$$('#graph-preview .node').forEach(n=>{const id=n.id.match(/flowchart-([A-Za-z][A-Za-z0-9_]*)-\d+$/)?.[1];if(!flow.nodes.some(node=>node.id===id))return;n.dataset.editorNode=id;n.setAttribute('role','button');n.setAttribute('tabindex','0');n.setAttribute('aria-label','Edit node '+flow.nodes.find(node=>node.id===id).label);const choose=()=>{selectedNode=id;flowTab='nodes';renderForm();markSelectedNode();$('#flow-node-label')?.scrollIntoView({block:'nearest'})};n.onclick=choose;n.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}}});markSelectedNode()}
    }catch(error){if(id!==request||!$('#graph-error')||!$('#dialog').open)return;$('#graph-error').textContent=error.message.slice(0,700);$('#graph-syntax-state').textContent='Check the data or Mermaid source before inserting'}
    $('#studio-undo').disabled=!past.length;$('#studio-redo').disabled=!future.length;
  }
  function schedule(){clearTimeout(debounce);request++;validSource='';$('#insert-graph').disabled=true;$('#graph-syntax-state').textContent='Updating…';debounce=setTimeout(preview,180)}
  $('#graph-type').onchange=e=>{const next=e.target.value;try{const converted=next==='flow'&&options.data&&!flowFromSelection?ChartModel.flowFromChart(chart):null;change(()=>{type=next;if(['bar','line','pie'].includes(type))chart.type=type;else if(type==='flow'&&converted){flow=converted;flowFromSelection=true;selectedNode=flow.nodes[0].id}else if(type!=='flow'){customSource=diagramTemplates[type]||customSource||'flowchart LR\n  A["Start"] --> B["Finish"]';showSource=true}},true)}catch(error){$('#graph-error').textContent=error.message;$('#graph-type').value=type}};
  $('#graph-show-source').onclick=()=>{showSource=!showSource;$('.graph-source-editor').hidden=!showSource;$('#graph-show-source').classList.toggle('selected',showSource)};
  $('#graph-source').oninput=e=>change(()=>{customSource=e.target.value;type='source';$('#graph-type').value='source'},true);
  $('#source-to-visual').onclick=()=>{const recovered=ChartModel.fromSource($('#graph-source').value);if(!recovered){$('#graph-error').textContent='This custom Mermaid cannot be represented by the visual editor. Keep editing it here to preserve every detail.';return}change(()=>{if(recovered.kind==='flow'){flow=recovered;type='flow'}else{chart=recovered;type=chart.type}},true)};
  $('#studio-undo').onclick=()=>{if(past.length){future.push(snapshot());restore(past.pop())}};$('#studio-redo').onclick=()=>{if(future.length){past.push(snapshot());restore(future.pop())}};
  $('#studio-import').onclick=()=>{showImport=true;if(!['bar','line','pie'].includes(type)){type='bar';chart.type='bar'}renderForm();$('.data-import').open=true;$('#import-data').focus()};
  $('#studio-example').onclick=()=>change(()=>{if(type==='flow')flow=ChartModel.sampleFlow();else if(['bar','line','pie'].includes(type)){chart=ChartModel.sampleChart();chart.type=type}else customSource=diagramTemplates[type]||diagramTemplates.sequence},true);
  $('#studio-export').onclick=()=>{if(validSource)downloadFile('diagram.mmd',validSource,'text/plain');else toast('Fix diagram errors before saving its source')};
  const zoom=v=>{previewZoom=Math.min(3,Math.max(.5,v));$('#graph-preview svg')?.style.setProperty('width',previewZoom*100+'%')};$('#preview-minus').onclick=()=>zoom(previewZoom-.25);$('#preview-plus').onclick=()=>zoom(previewZoom+.25);$('#preview-fit').onclick=()=>zoom(1);
  $('#cancel-graph').onclick=()=>$('#dialog').close();$('#dialog').addEventListener('close',()=>{request++;clearTimeout(debounce)},{once:true});
  $('#insert-graph').onclick=()=>{
    if(!validSource)return;$('#dialog').close();
    if(existing){existing.dataset.mermaid=validSource;delete existing.dataset.rendered;save()}
    else if(mode==='source'){const input=$('#source'),start=options.preserveData?sourcePosition:input.selectionStart,end=options.preserveData?sourcePosition:input.selectionEnd;input.value=input.value.slice(0,start)+'\n```mermaid\n'+validSource+'\n```\n'+input.value.slice(end);input.oninput()}
    else{
      selection=originalRange;
      if(options.preserveData&&selection){const root=selection.endContainer.nodeType===3?selection.endContainer.parentElement:selection.endContainer;let block=root.closest('table,p,ul,ol,h1,h2,h3,div');if(block&&block!==$('#paper')&&$('#paper').contains(block)){while(block.parentElement!==$('#paper')&&block.parentElement&&block.parentElement!==$('#editing-surface'))block=block.parentElement;selection.setStartAfter(block);selection.collapse(true)}else selection.collapse(false)}
      insert(graphMarkup(validSource));
    }
    hydrateDiagrams();toast(existing?'Graph updated':'Graph inserted');
  };
  renderForm();preview();
}
function tableTextFromRange(range){
  const fragment=range.cloneContents();
  function text(node){
    if(node.nodeType===3)return node.textContent;
    if(node.nodeType!==1&&node.nodeType!==11)return '';
    if(node.nodeName==='BR')return '\n';
    if(node.nodeName==='TR')return [...node.children].filter(n=>['TD','TH'].includes(n.nodeName)).map(n=>n.textContent.trim()).join('\t')+'\n';
    const value=[...node.childNodes].map(text).join('');
    return ['P','DIV','LI','H1','H2','H3'].includes(node.nodeName)?value+'\n':value;
  }
  return text(fragment).trim();
}
function selectedChartData(){
  if(mode==='source'){const input=$('#source');return {data:input.value.slice(input.selectionStart,input.selectionEnd),sourcePosition:input.selectionEnd,preserveData:true}}
  const live=window.getSelection(),range=live.rangeCount&&$('#paper').contains(live.anchorNode)?live.getRangeAt(0).cloneRange():selection?.cloneRange();return {data:range?tableTextFromRange(range):'',range,preserveData:true};
}
function chartFromSelection(){const selected=selectedChartData();if(!selected.data.trim()){toast('Select a table, CSV, or tab-separated data first');return}graphStudio(null,selected)}
const chartContextMenu=document.createElement('div');chartContextMenu.className='editor-context-menu';chartContextMenu.hidden=true;chartContextMenu.setAttribute('role','menu');chartContextMenu.innerHTML='<button role="menuitem" id="context-chart">'+icon('chart')+' Make chart from data…</button>';document.body.append(chartContextMenu);
let contextSelection;
function closeChartMenu(){chartContextMenu.hidden=true}
function openChartMenu(event){
  if(event.shiftKey&&event.type==='contextmenu')return;contextSelection=selectedChartData();if(!contextSelection.data.trim())return;
  event.preventDefault();chartContextMenu.hidden=false;const rect=chartContextMenu.getBoundingClientRect(),paperRect=$('#paper').getBoundingClientRect();chartContextMenu.style.left=Math.max(8,Math.min(event.clientX||paperRect.left+30,innerWidth-rect.width-8))+'px';chartContextMenu.style.top=Math.max(8,Math.min(event.clientY||paperRect.top+30,innerHeight-rect.height-8))+'px';
}
$('#paper').addEventListener('contextmenu',openChartMenu);$('#source').addEventListener('contextmenu',openChartMenu);
$('#context-chart').onmousedown=e=>e.preventDefault();$('#context-chart').onclick=()=>{closeChartMenu();graphStudio(null,contextSelection)};
document.addEventListener('pointerdown',e=>{if(!chartContextMenu.contains(e.target))closeChartMenu()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeChartMenu();if((e.key==='F10'&&e.shiftKey)||e.key==='ContextMenu'){if($('#paper').contains(document.activeElement)||document.activeElement===$('#source')){openChartMenu(e);if(!chartContextMenu.hidden)$('#context-chart').focus()}}});
officeActions.graphs=()=>graphStudio();officeActions['chart-from-selection']=chartFromSelection;
document.addEventListener('documentchange',()=>hydrateDiagrams());document.addEventListener('appearancechange',()=>hydrateDiagrams(true));hydrateDiagrams();
