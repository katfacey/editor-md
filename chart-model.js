/* Pure diagram/data model. Kept independent of the prototype DOM so it can be
 * tested and used as a reference for the eventual Rust document model. */
const ChartModel=(()=>{
  const clone=value=>JSON.parse(JSON.stringify(value));
  const shapes={process:['[',']'],rounded:['(',')'],decision:['{','}'],terminal:['([','])'],database:['[(',')]'],subroutine:['[[',']]']};
  function number(value){
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    const text=String(value).trim().replace(/^[$€£¥]/,'').replaceAll(',','');
    return text!==''&&/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)&&Number.isFinite(Number(text))?Number(text):null;
  }
  function delimited(text,delimiter){
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else if(quoted||!cell.trim())quoted=!quoted;else cell+=c}
      else if(c===delimiter&&!quoted){row.push(cell.trim());cell=''}
      else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell=''}
      else cell+=c;
    }
    if(quoted)throw new Error('A quoted cell is missing its closing quote.');
    row.push(cell.trim());if(row.some(Boolean))rows.push(row);return rows;
  }
  function parseData(text,{header='auto'}={}){
    const lines=text.trim().split(/\r?\n/).filter(s=>s.trim());
    if(!lines.length)throw new Error('Select or paste a table with labels and at least one numeric column.');
    let rows;
    if(lines.some(line=>/^\s*\|?\s*:?-{3,}/.test(line)&&line.includes('|'))){
      rows=lines.filter(line=>!/^\s*\|?\s*:?-{3,}/.test(line)).map(line=>line.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim()));
    }else{
      const first=lines[0],delimiter=first.includes('\t')?'\t':first.includes(',')?',':first.includes(';')?';':first.includes('|')?'|':null;
      rows=delimiter?delimited(text,delimiter):lines.map(line=>line.trim().split(/\s+/));
      if(delimiter==='|')rows=rows.map(row=>{if(row[0]==='')row.shift();if(row.at(-1)==='')row.pop();return row});
    }
    const width=rows[0].length;
    if(width<2||width>9)throw new Error('Use one label column and between 1 and 8 numeric series. CSV, tabs, and Markdown tables are supported.');
    rows.forEach((row,i)=>{if(row.length!==width)throw new Error('Row '+(i+1)+' has '+row.length+' columns; expected '+width+'.')});
    const hasHeader=header==='yes'||(header==='auto'&&rows[0].slice(1).every(cell=>number(cell)===null));
    const headings=hasHeader?rows.shift():['Category',...Array.from({length:width-1},(_,i)=>'Series '+(i+1))];
    if(!rows.length)throw new Error('Add at least one data row below the headings.');
    const model={kind:'chart',type:'bar',title:'Chart from selected data',xLabel:headings[0]||'Category',yLabel:'Value',labels:[],series:headings.slice(1).map((name,i)=>({name:name||'Series '+(i+1),values:[]})),pieSeries:0};
    rows.forEach((row,r)=>{model.labels.push(row[0]);row.slice(1).forEach((cell,c)=>{const n=number(cell);if(n===null)throw new Error('Row '+(r+(hasHeader?2:1))+', column '+(c+2)+' needs a number.');model.series[c].values.push(n)})});
    validate(model);return model;
  }
  function sampleChart(){return {kind:'chart',type:'bar',title:'A week of focused writing',xLabel:'Day',yLabel:'Words',labels:['Mon','Tue','Wed','Thu','Fri'],series:[{name:'Words written',values:[320,480,390,610,540]}],pieSeries:0}}
  function sampleFlow(){return {kind:'flow',direction:'LR',nodes:[{id:'N1',label:'Start',shape:'terminal'},{id:'N2',label:'Write a draft',shape:'process'},{id:'N3',label:'Ready to share?',shape:'decision'},{id:'N4',label:'Publish',shape:'terminal'}],edges:[{id:'E1',from:'N1',to:'N2',label:'',style:'arrow'},{id:'E2',from:'N2',to:'N3',label:'',style:'arrow'},{id:'E3',from:'N3',to:'N4',label:'Yes',style:'arrow'},{id:'E4',from:'N3',to:'N2',label:'Revise',style:'dashed'}]}}
  function validate(model){
    if(model?.kind==='chart'){
      if(!['bar','line','pie'].includes(model.type))throw new Error('Choose a supported chart type.');
      if(!Array.isArray(model.labels)||!model.labels.length||model.labels.length>100||model.labels.some(s=>typeof s!=='string'||!s.trim()||s.length>200))throw new Error('Use between 1 and 100 rows, each with a label of 1–200 characters.');
      if(!Array.isArray(model.series)||!model.series.length||model.series.length>8)throw new Error('Use between 1 and 8 series.');
      for(const s of model.series){if(typeof s.name!=='string'||!s.name.trim())throw new Error('Give each series a name.');if(!Array.isArray(s.values)||s.values.length!==model.labels.length||s.values.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw new Error('Every data cell needs a finite number.')}
      if(model.type==='pie'){const values=model.series[model.pieSeries||0]?.values;if(!values||values.some(v=>v<0)||!values.some(v=>v>0))throw new Error('Pie charts need nonnegative values and at least one positive value. Choose another series or chart type.')}
      for(const k of ['title','xLabel','yLabel'])if(typeof model[k]!=='string'||model[k].length>200)throw new Error('Chart titles must be 200 characters or fewer.');
    }else if(model?.kind==='flow'){
      if(!['LR','RL','TB','BT'].includes(model.direction))throw new Error('Choose a flow direction.');
      if(!Array.isArray(model.nodes)||!model.nodes.length||model.nodes.length>100)throw new Error('Use between 1 and 100 nodes.');
      const ids=new Set();
      for(const node of model.nodes){if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(node.id)||ids.has(node.id))throw new Error('Node IDs must be unique letters/numbers.');ids.add(node.id);if(!shapes[node.shape]||typeof node.label!=='string'||!node.label.trim()||node.label.length>200)throw new Error('Give each node a label and shape. Labels can contain up to 200 characters.')}
      if(!Array.isArray(model.edges)||model.edges.length>200)throw new Error('Use no more than 200 connections.');
      for(const edge of model.edges){if(!ids.has(edge.from)||!ids.has(edge.to))throw new Error('Each connection must refer to existing nodes.');if(!['arrow','line','dashed'].includes(edge.style)||typeof edge.label!=='string'||edge.label.length>200)throw new Error('Choose a connection style and a label of 200 characters or fewer.')}
    }else throw new Error('Unknown graph model.');
    return model;
  }
  const quote=s=>JSON.stringify(String(s).replace(/[\r\n]/g,' ').replaceAll('"','#quot;').replaceAll('\\','#92;'));
  function toSource(model){
    validate(model);const comment='%% editor-md-v2 '+JSON.stringify(model);
    if(model.kind==='flow')return ['flowchart '+model.direction,comment,...model.nodes.map(node=>{const [a,b]=shapes[node.shape];return '  '+node.id+a+quote(node.label)+b}),...model.edges.map(edge=>'  '+edge.from+' '+(edge.style==='dashed'?'-.->':edge.style==='line'?'---':'-->')+(edge.label?'|'+quote(edge.label)+'|':'')+' '+edge.to)].join('\n');
    const series=model.series[model.pieSeries||0];
    if(model.type==='pie')return ['pie showData',comment,'  title '+model.title.replace(/[\r\n]/g,' '),...model.labels.map((label,i)=>'  '+quote(label)+' : '+series.values[i])].join('\n');
    const values=model.series.flatMap(s=>s.values),low=Math.min(0,...values),high=Math.max(1,...values);
    return ['xychart-beta',comment,'  title '+quote(model.title),'  x-axis '+quote(model.xLabel)+' ['+model.labels.map(quote).join(', ')+']','  y-axis '+quote(model.yLabel)+' '+low+' --> '+high,...model.series.map(s=>'  '+model.type+' ['+s.values.join(', ')+']')].join('\n');
  }
  function fromSource(source){
    try{
      const metadata=source.match(/^%% editor-md-v2 (.+)$/m);
      if(metadata){const model=JSON.parse(metadata[1]);validate(model);return toSource(model).trim()===source.trim()?model:null}
      // Keep the first prototype's generated charts editable in the new UI.
      if(source.startsWith('xychart-beta')){
        const model=sampleChart(),title=source.match(/\btitle (".*")/),labels=source.match(/x-axis \[(.*)\]/),values=source.match(/\n\s*(bar|line) \[(.*)\]/);
        if(!title||!labels||!values||source.split('\n').filter(s=>s.trim()).length!==5)return null;
        model.title=JSON.parse(title[1]);model.xLabel='Category';model.yLabel='Value';model.labels=JSON.parse('['+labels[1]+']');model.type=values[1];model.series=[{name:'Value',values:JSON.parse('['+values[2]+']')}];return validate(model);
      }
      if(source.startsWith('flowchart LR')){
        const lines=source.trim().split('\n'),nodes=[],edges=[];
        for(const line of lines.slice(1)){let m=line.match(/^\s*(N\d+)\[(".*")\]$/);if(m){nodes.push({id:m[1],label:JSON.parse(m[2]),shape:'process'});continue}m=line.match(/^\s*(N\d+) --> (N\d+)$/);if(!m)return null;edges.push({id:'E'+edges.length,from:m[1],to:m[2],label:'',style:'arrow'})}
        return validate({kind:'flow',direction:'LR',nodes,edges});
      }
    }catch{}
    return null;
  }
  function removeNode(model,id){model.nodes=model.nodes.filter(n=>n.id!==id);model.edges=model.edges.filter(e=>e.from!==id&&e.to!==id);return model}
  function flowFromChart(chart){
    validate({...chart,type:'bar'});
    const nodes=chart.labels.map((label,i)=>({id:'N'+(i+1),label:label+': '+chart.series.map(s=>s.name+' '+s.values[i]).join(', '),shape:i===0||i===chart.labels.length-1?'terminal':'process'}));
    return validate({kind:'flow',direction:'TB',nodes,edges:nodes.slice(1).map((node,i)=>({id:'E'+(i+1),from:nodes[i].id,to:node.id,label:'',style:'arrow'}))});
  }
  function csv(model){const cell=s=>'"'+String(s).replaceAll('"','""')+'"';return [[model.xLabel,...model.series.map(s=>s.name)],...model.labels.map((label,i)=>[label,...model.series.map(s=>s.values[i])])].map(row=>row.map(cell).join(',')).join('\n')}
  return {clone,shapes,parseData,sampleChart,sampleFlow,validate,toSource,fromSource,removeNode,flowFromChart,csv};
})();
if(typeof module!=='undefined')module.exports=ChartModel;
