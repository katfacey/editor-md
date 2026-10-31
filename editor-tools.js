// Document tools shared by the browser preview and the portable desktop app.
(function(root){
  function matches(source,query,{caseSensitive=false,wholeWord=false}={}){
    if(!query)return [];
    const text=caseSensitive?source:source.toLocaleLowerCase();
    const needle=caseSensitive?query:query.toLocaleLowerCase();
    const found=[];let at=0;
    while((at=text.indexOf(needle,at))!==-1){
      const end=at+needle.length;
      if(!wholeWord||(!/[\p{L}\p{N}_]/u.test(source[at-1]||'')&&!/[\p{L}\p{N}_]/u.test(source[end]||'')))found.push({start:at,end});
      at=end;
    }
    return found;
  }
  function replace(source,query,value,options={},oneAt=null){
    const found=matches(source,query,options),chosen=oneAt===null?found:found.filter(match=>match.start===oneAt);
    for(let i=chosen.length-1;i>=0;i--)source=source.slice(0,chosen[i].start)+value+source.slice(chosen[i].end);
    return {source,count:chosen.length};
  }
  function tableCell(table,row,column){return table.rows[row]?.cells[column]||null;}
  function outline(headings){
    const result=[],stack=[];
    headings.forEach((heading,index)=>{
      const level=Math.max(1,Math.min(6,Number(heading.level)||1));
      while(stack.length&&stack.at(-1).level>=level)stack.pop();
      result.push({...heading,index,level,parent:stack.at(-1)?.index??null});
      stack.push({level,index});
    });
    return result;
  }
  function diffSummary(before,after,limit=1000){
    const a=before.split(/\r?\n/),b=after.split(/\r?\n/),truncated=a.length>limit||b.length>limit;
    const left=a.slice(0,limit),right=b.slice(0,limit),width=right.length+1;
    const matrix=new Uint16Array((left.length+1)*width);
    for(let i=left.length-1;i>=0;i--)for(let j=right.length-1;j>=0;j--)matrix[i*width+j]=left[i]===right[j]?1+matrix[(i+1)*width+j+1]:Math.max(matrix[(i+1)*width+j],matrix[i*width+j+1]);
    const rows=[];let i=0,j=0;
    while(i<left.length||j<right.length){
      if(i<left.length&&j<right.length&&left[i]===right[j]){rows.push({kind:'same',text:left[i++]});j++;}
      else if(j<right.length&&(i===left.length||matrix[i*width+j+1]>=matrix[(i+1)*width+j]))rows.push({kind:'added',text:right[j++]});
      else rows.push({kind:'removed',text:left[i++]});
    }
    return {rows,added:rows.filter(row=>row.kind==='added').length,removed:rows.filter(row=>row.kind==='removed').length,truncated};
  }
  function tsvTable(text){
    const lines=text.replace(/\r\n?/g,'\n').trimEnd().split('\n');
    if(lines.length<2||!lines.some(line=>line.includes('\t')))return null;
    const rows=lines.map(line=>line.split('\t'));
    const width=Math.max(...rows.map(row=>row.length));
    if(width<2||width>40||rows.length>1000)return null;
    return rows.map(row=>Array.from({length:width},(_,index)=>row[index]||''));
  }
  function editTable(table,operation,row,column){
    if(!table||!table.rows.length)return false;
    const width=table.rows[0].cells.length;
    if(operation==='row-after'){
      const section=table.rows[row]?.parentElement?.tagName==='THEAD'?(table.tBodies[0]||table.createTBody()):(table.rows[row]?.parentElement||table.tBodies[0]||table);
      const next=table.rows[row]?.nextElementSibling;
      const newRow=document.createElement('tr');
      for(let i=0;i<width;i++){const cell=document.createElement('td');cell.append(document.createElement('br'));newRow.append(cell);}
      section.insertBefore(newRow,next&&next.parentElement===section?next:null);
    }else if(operation==='row-before'){
      const reference=table.rows[row],newRow=document.createElement('tr');
      for(let i=0;i<width;i++){const cell=document.createElement(row===0?'th':'td');cell.append(document.createElement('br'));newRow.append(cell);}
      reference.parentElement.insertBefore(newRow,reference);
    }else if(operation==='row-delete'){
      if(table.rows.length<=1)return false;table.rows[row]?.remove();
    }else if(operation==='column-after'||operation==='column-before'){
      for(const tr of table.rows){const ref=tr.cells[column],cell=document.createElement(tr.parentElement.tagName==='THEAD'?'th':'td');cell.append(document.createElement('br'));
        tr.insertBefore(cell,operation==='column-before'?ref:ref?.nextSibling||null);}
    }else if(operation==='column-delete'){
      if(width<=1)return false;for(const tr of table.rows)tr.cells[column]?.remove();
    }else if(['left','center','right'].includes(operation)){
      for(const tr of table.rows)if(tr.cells[column]){tr.cells[column].setAttribute('align',operation);tr.cells[column].style.textAlign=operation;}
    }else return false;
    return true;
  }
  const api={matches,replace,editTable,tableCell,outline,diffSummary,tsvTable};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.EditorTools=api;
})(globalThis);
