(function(root){
  let native=null,busy=false;
  function connect(value){const previous=native;native=value;return previous;}
  async function saveOne(file,saveAs=false){
    if(!file||!openDocuments.includes(file))return false;captureDocument();
    if(native)return native.save(file,{saveAs});
    try{documentState.persist([file]);updateSaveState();toast('Saved '+file.name+' in this browser');return true;}catch{toast('Could not save '+file.name+'. Export a copy to keep your work.');return false;}
  }
  async function saveAll(){
    captureDocument();for(const file of [...openDocuments])if(documentState.isDirty(file)&&!await saveOne(file))return false;
    toast('All open documents saved');return true;
  }
  async function closeMany(targets){
    for(const file of targets){
      if(!openDocuments.includes(file))continue;
      const result=closeDocument(file);if(result?.then)await result;else if($('#dialog').open)await new Promise(resolve=>$('#dialog').addEventListener('close',resolve,{once:true}));
      if(openDocuments.includes(file))return false;
    }return true;
  }
  function install(){
    const menu=document.createElement('div');menu.id='document-tab-menu';menu.className='document-context-menu';menu.hidden=true;menu.setAttribute('role','menu');document.body.append(menu);let target=null;
    const hide=()=>{menu.hidden=true;};
    function show(file,x,y){
      if(busy||$('#dialog').open||!file)return;RibbonUI.close();selectionTools.hide();target=file;captureDocument();
      const index=openDocuments.indexOf(file);
      const item=(id,label,disabled=false)=>'<button role="menuitem" data-tab-command="'+id+'" '+(disabled?'disabled':'')+'>'+label+'</button>';
      menu.innerHTML='<div class="document-context-title">'+escapeHtml(file.name)+'</div>'+item('save','Save')+item('save-as','Save as…')+item('save-all','Save all')+'<hr>'+item('close','Close')+item('others','Close all others',openDocuments.length<2)+item('left','Close tabs to the left',index<1)+item('right','Close tabs to the right',index>=openDocuments.length-1)+item('all','Close all');
      menu.hidden=false;const scale=interfaceSettings.zoom/100,rect=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(x,innerWidth-rect.width-8))/scale+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-rect.height-8))/scale+'px';menu.querySelector('button').focus();
    }
    $('#document-tabs').addEventListener('contextmenu',event=>{const tab=event.target.closest('[data-tab-document]');if(!tab)return;event.preventDefault();show(files.find(file=>file.id===tab.dataset.tabDocument),event.clientX,event.clientY);});
    $('#document-tabs').addEventListener('keydown',event=>{if(!(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'))return;const tab=event.target.closest('[data-tab-document]');if(!tab)return;event.preventDefault();const rect=tab.getBoundingClientRect();show(files.find(file=>file.id===tab.dataset.tabDocument),rect.left,rect.bottom);});
    menu.addEventListener('click',async event=>{
      const command=event.target.closest('[data-tab-command]')?.dataset.tabCommand;if(!command||busy)return;const file=target;hide();busy=true;
      try{
        if(command==='save')await saveOne(file);else if(command==='save-as')await saveOne(file,true);else if(command==='save-all')await saveAll();
        else{
          const all=[...openDocuments],index=all.indexOf(file),targets=command==='all'?all:command==='others'?all.filter(value=>value!==file):command==='left'?all.slice(0,index):command==='right'?all.slice(index+1):[file];
          if(await closeMany(targets)&&command!=='all'&&openDocuments.includes(file))openFile(files.indexOf(file));
        }
      }finally{busy=false;}
    });
    document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))hide();});
    document.addEventListener('keydown',event=>{if(menu.hidden)return;if(event.key==='Escape'){hide();$('[data-tab-document="'+target?.id+'"] .document-tab-open')?.focus();}if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();const options=[...menu.querySelectorAll('button:not(:disabled)')],index=options.indexOf(document.activeElement);options[event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:options.length-1))%options.length].focus();}});
    window.addEventListener('resize',hide);document.addEventListener('documentchange',hide);
    return {show,hide,saveOne,saveAll,closeMany};
  }
  const api={connect,install,saveOne,saveAll,closeMany};if(typeof module==='object'&&module.exports)module.exports=api;else root.DocumentTabMenu=api;
})(globalThis);
