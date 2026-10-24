(function(root){
  const panels={files:'Files',outline:'Outline',bookmarks:'Bookmarks',search:'Search',details:'Details',footnotes:'Footnotes'};
  const defaults={left:['files','outline','bookmarks','search'],right:['details','footnotes'],active:{left:'files',right:'details'}};
  function normalize(value){
    const used=new Set(),result={left:[],right:[],active:{}};
    for(const side of ['left','right'])for(const id of Array.isArray(value?.[side])?value[side]:defaults[side])if(panels[id]&&!used.has(id)){result[side].push(id);used.add(id);}
    for(const id of Object.keys(panels))if(!used.has(id))result[defaults.left.includes(id)?'left':'right'].push(id);
    for(const side of ['left','right'])result.active[side]=result[side].includes(value?.active?.[side])?value.active[side]:result[side][0]||null;
    return result;
  }
  function move(value,id,side,index){
    const result=normalize(value);if(!panels[id]||!['left','right'].includes(side))return result;
    for(const dock of ['left','right']){result[dock]=result[dock].filter(item=>item!==id);if(result.active[dock]===id)result.active[dock]=result[dock][0]||null;}
    result[side].splice(Math.max(0,Math.min(result[side].length,Number(index)||0)),0,id);result.active[side]=id;
    return result;
  }
  const tabDefaults={shape:'square',boldActive:true};
  function tabs(value){return {shape:['rounded','angular','square','pill'].includes(value?.shape)?value.shape:tabDefaults.shape,boldActive:typeof value?.boldActive==='boolean'?value.boldActive:tabDefaults.boldActive};}
  function installDock(){
    let state=normalize(null);try{state=normalize(JSON.parse(localStorage.getItem('editor-md-panel-dock-v1')));}catch{}
    const hosts={left:$('#sidebar-content'),right:$('#inspector-content')},bars={left:$('.sidebar-tabs'),right:$('.inspector-tabs')},contents={},buttons={};let refreshing=false,queued=false;
    for(const [id,label] of Object.entries(panels)){
      const content=document.createElement('section');content.id='dock-panel-'+id;content.className='dock-panel';content.dataset.panelContent=id;content.setAttribute('role','tabpanel');contents[id]=content;
      let button=$('[data-side="'+id+'"],[data-inspect="'+id+'"]');
      if(!button){button=document.createElement('button');button.textContent=label;button.dataset.side=id;}
      button.id='dock-tab-'+id;button.dataset.dockPanel=id;button.draggable=false;button.setAttribute('role','tab');button.setAttribute('aria-controls',content.id);button.title=label+' · Drag to reorder or move to the other sidebar. Right-click for position options.';
      content.setAttribute('aria-labelledby',button.id);buttons[id]=button;
      let drag=null,suppressClick=0;
      button.onclick=()=>{if(Date.now()>suppressClick)select(id);};
      button.onpointerdown=event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY,id:event.pointerId,active:false,target:null};button.setPointerCapture(event.pointerId);};
      button.onpointermove=event=>{
        if(!drag)return;if(!drag.active&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<6)return;
        if(!drag.active){drag.active=true;drag.ghost=document.createElement('div');drag.ghost.className='panel-drag-label';drag.ghost.textContent=label;document.body.append(drag.ghost);document.body.classList.add('dragging-panel');}
        event.preventDefault();const scale=interfaceSettings.zoom/100;drag.ghost.style.left=(event.clientX+14)/scale+'px';drag.ghost.style.top=(event.clientY+12)/scale+'px';
        const hit=document.elementFromPoint(event.clientX,event.clientY),host=hit?.closest('#navigator,#inspector'),dock=host?.id==='navigator'?'left':host?.id==='inspector'?'right':null;
        $$('.dock-drop-target,.dock-drop-before').forEach(node=>node.classList.remove('dock-drop-target','dock-drop-before'));drag.target=null;
        if(dock){const tab=hit.closest('[data-dock-panel]');if(tab?.dataset.dockPanel===id)return;const ids=state[dock].filter(value=>value!==id);let index=ids.length;
          if(tab&&tab.dataset.dockPanel!==id){const rect=tab.getBoundingClientRect();index=ids.indexOf(tab.dataset.dockPanel)+(event.clientX>(rect.left+rect.right)/2?1:0);tab.classList.add('dock-drop-before');}
          bars[dock].classList.add('dock-drop-target');drag.target={dock,index};drag.ghost.textContent=label+' → '+dock+' sidebar';
        }
      };
      const endDrag=event=>{if(!drag)return;const finished=drag;drag=null;finished.ghost?.remove();document.body.classList.remove('dragging-panel');$$('.dock-drop-target,.dock-drop-before').forEach(node=>node.classList.remove('dock-drop-target','dock-drop-before'));if(button.hasPointerCapture(finished.id))button.releasePointerCapture(finished.id);if(finished.active){suppressClick=Date.now()+250;event?.preventDefault();if(finished.target)relocate(id,finished.target.dock,finished.target.index);}};
      button.onpointerup=endDrag;button.onpointercancel=()=>{if(drag)drag.target=null;endDrag();};button.onlostpointercapture=()=>{if(drag)drag.target=null;endDrag();};
      button.ondragstart=event=>{event.dataTransfer.setData('application/x-editor-md-panel',id);event.dataTransfer.effectAllowed='move';document.body.classList.add('dragging-panel');};
      button.ondragend=()=>{document.body.classList.remove('dragging-panel');$$('.dock-drop-before').forEach(node=>node.classList.remove('dock-drop-before'));};
      button.oncontextmenu=event=>{event.preventDefault();positionMenu(id,button);};
      button.onkeydown=event=>{
        if((event.shiftKey&&event.key==='F10')||event.key==='ContextMenu'){event.preventDefault();positionMenu(id,button);}
        if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const dock=location(id),list=state[dock],next=list[(list.indexOf(id)+(event.key==='ArrowRight'?1:list.length-1))%list.length];select(next);buttons[next].focus();}
      };
    }
    for(const dock of ['left','right']){
      bars[dock].setAttribute('role','tablist');bars[dock].setAttribute('aria-label',dock+' sidebar panels');bars[dock].dataset.dockSide=dock;
      bars[dock].ondragover=event=>{if([...event.dataTransfer.types].includes('application/x-editor-md-panel')){event.preventDefault();event.dataTransfer.dropEffect='move';$$('.dock-drop-before').forEach(node=>node.classList.remove('dock-drop-before'));event.target.closest('[data-dock-panel]')?.classList.add('dock-drop-before');}};
      bars[dock].ondrop=event=>{event.preventDefault();const id=event.dataTransfer.getData('application/x-editor-md-panel'),before=event.target.closest('[data-dock-panel]')?.dataset.dockPanel;let index=before?state[dock].filter(item=>item!==id).indexOf(before):state[dock].length;if(id===before)return;relocate(id,dock,index);document.body.classList.remove('dragging-panel');};
    }
    function persist(){try{localStorage.setItem('editor-md-panel-dock-v1',JSON.stringify(state));}catch{}}
    function location(id){return state.left.includes(id)?'left':'right';}
    function content(id){return contents[id];}
    function paint(){
      for(const dock of ['left','right']){
        bars[dock].replaceChildren(...state[dock].map(id=>buttons[id]));
        if(!state[dock].length){const hint=document.createElement('span');hint.className='dock-empty';hint.textContent='Drop a panel here';bars[dock].append(hint);}
        hosts[dock].replaceChildren(...state[dock].map(id=>contents[id]));
        for(const id of state[dock]){const selected=state.active[dock]===id;contents[id].hidden=!selected;buttons[id].classList.toggle('selected',selected);buttons[id].setAttribute('aria-selected',String(selected));buttons[id].tabIndex=selected?0:-1;}
      }
    }
    function select(id){
      if(!panels[id])return;const dock=location(id);state.active[dock]=id;
      if(defaults.left.includes(id))side=id;else inspection=id;
      $(dock==='left'?'#navigator':'#inspector').style.display='flex';paint();refresh();persist();
      if(id==='search')$('#project-query')?.focus();
    }
    function refresh(){
      if(refreshing)return;refreshing=true;const previousSide=side,previousInspection=inspection;
      try{for(const id of new Set(Object.values(state.active).filter(Boolean))){if(defaults.left.includes(id)){side=id;if(id==='search'&&!window.__TAURI__){contents[id].innerHTML='<p class="library-empty">Open the desktop app and a project folder to search Markdown files.</p>';}else renderSidebar();}else{inspection=id;renderInspector();}}}
      finally{side=previousSide;inspection=previousInspection;refreshing=false;}
    }
    function relocate(id,dock,index){state=move(state,id,dock,index);paint();refresh();persist();buttons[id]?.focus();}
    function reset(){state=normalize(null);side='files';inspection='details';paint();refresh();persist();}
    function positionMenu(id,button){
      const dock=location(id),index=state[dock].indexOf(id);
      openDialog(panels[id]+' panel position','<p>Move this tab within its sidebar, or send it to the other side.</p><div class="panel-position-actions"><button id="panel-move-before" '+(index===0?'disabled':'')+'>Move earlier</button><button id="panel-move-after" '+(index===state[dock].length-1?'disabled':'')+'>Move later</button><button id="panel-move-side">Move to '+(dock==='left'?'right':'left')+' sidebar</button></div>');
      const finish=(target,position)=>{$('#dialog').close();relocate(id,target,position);};
      $('#panel-move-before').onclick=()=>finish(dock,index-1);$('#panel-move-after').onclick=()=>finish(dock,index+1);$('#panel-move-side').onclick=()=>finish(dock==='left'?'right':'left',state[dock==='left'?'right':'left'].length);
    }
    const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refresh();});};
    document.addEventListener('documentchange',schedule);document.addEventListener('paginationchange',schedule);
    setInspection=id=>select(id);officeActions.outline=()=>select('outline');officeActions.bookmarks=()=>select('bookmarks');
    const api={content,select,relocate,reset,refresh,location,get state(){return structuredClone(state);},positionMenu};root.SidebarDock=api;
    paint();refresh();return api;
  }
  function installRibbon(){
    let collapsed=true;try{collapsed=localStorage.getItem('editor-md-ribbon-collapsed')!=='false';}catch{}
    const tabs=$('#document-tabs'),tabHome=document.createComment('Document tab home'),ribbonHome=document.createComment('Ribbon home');tabs.before(tabHome);$('#ribbon').before(ribbonHome);
    const brand=$('.brand');brand.setAttribute('role','button');brand.setAttribute('aria-label','Editor, MD menu');brand.setAttribute('aria-haspopup','true');brand.setAttribute('aria-expanded','false');
    const toggle=document.createElement('button');toggle.id='ribbon-toggle';toggle.setAttribute('aria-controls','ribbon');$('.title-actions').prepend(toggle);
    const compactTabs=document.createElement('div');compactTabs.className='compact-document-tabs';$('.title-actions').before(compactTabs);
    const menu=document.createElement('div');menu.id='md-menu';menu.className='md-menu';menu.hidden=true;menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Editor, MD commands');menu.innerHTML='<nav aria-label="Command categories">'+['File','Home','Insert','Layout','References','Review','View','Help'].map(name=>'<button data-menu-category="'+name+'">'+name+'</button>').join('')+'</nav><div class="md-menu-commands"></div>';document.body.append(menu);
    let current='File',placeholder=null;
    function reserveExpandedRibbon(){
      if(collapsed)return;
      const toolbar=$('#ribbon');placeholder=toolbar.cloneNode(true);
      placeholder.removeAttribute('id');placeholder.classList.add('ribbon-placeholder');placeholder.setAttribute('aria-hidden','true');placeholder.inert=true;
      for(const node of placeholder.querySelectorAll('[id]'))node.removeAttribute('id');
      // Preserve the expanded toolbar's exact footprint while its controls are in the popup.
      placeholder.style.height=toolbar.getBoundingClientRect().height/(interfaceSettings.zoom/100)+'px';
      ribbonHome.after(placeholder);
    }
    function compactHome(){
      const groups={};
      for(const group of $$('#ribbon>.ribbon-group')){const label=group.querySelector('.ribbon-label').textContent;groups[label]=group;group.dataset.menuGroup=label.toLowerCase();}
      const clipboard=groups.Clipboard,row=clipboard.querySelector('.ribbon-row');
      // Move the original controls, retaining their native/font/formatting handlers.
      const buttons=[...row.querySelectorAll('button')];row.replaceChildren(...buttons);
      for(const button of buttons){const label=button.getAttribute('aria-label');if(label){const span=document.createElement('span');span.textContent=label;button.append(span);}}
      const styles=groups.Styles,normal=styles.querySelector('[data-action="normal"]');
      const picker=document.createElement('select');picker.id='md-block-style';picker.setAttribute('aria-label','Block style');
      for(const [value,label] of [['normal','Normal'],['heading1','Heading 1'],['heading2','Heading 2']])picker.add(new Option(label,value));
      picker.onchange=()=>{action(picker.value);syncBlockStyle();};
      normal.replaceWith(picker);const headings=document.createElement('div');headings.className='md-heading-buttons';
      for(const [value,label] of [['heading1','H1'],['heading2','H2']]){const button=styles.querySelector('[data-action="'+value+'"]');button.textContent=label;button.setAttribute('aria-label',value==='heading1'?'Heading 1':'Heading 2');button.title=button.getAttribute('aria-label');headings.append(button);}
      styles.querySelector('.ribbon-row').append(headings);
      groups.Font.querySelector('.ribbon-label').textContent='Text';styles.querySelector('.ribbon-label').textContent='Block style';
      const quick=document.createElement('div');quick.className='ribbon-group';quick.dataset.menuGroup='quick';
      quick.innerHTML='<div class="ribbon-label">Insert &amp; review</div><div class="ribbon-row"></div>';
      quick.querySelector('.ribbon-row').append(...groups.Insert.querySelectorAll('button'),...groups.Review.querySelectorAll('button'));
      groups.Insert.replaceWith(quick);groups.Review.remove();syncBlockStyle();
    }
    function syncBlockStyle(){
      const picker=$('#md-block-style');if(!picker)return;
      const live=window.getSelection(),range=live.rangeCount&&$('#paper').contains(live.anchorNode)?live.getRangeAt(0):selection,node=range&&(range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement),block=node?.closest('h1,h2,p,pre,blockquote');
      picker.value=block?.tagName==='H1'?'heading1':block?.tagName==='H2'?'heading2':'normal';
    }
    function position(){
      if(menu.hidden)return;const scale=interfaceSettings.zoom/100,rect=brand.getBoundingClientRect();
      menu.style.maxHeight=Math.max(120,(innerHeight-rect.bottom-14)/scale)+'px';
      const width=menu.getBoundingClientRect().width;menu.style.left=Math.max(8,Math.min(rect.left,innerWidth-width-8))/scale+'px';menu.style.top=(rect.bottom+6)/scale+'px';
    }
    function setCollapsed(value){collapsed=!!value;close();document.body.classList.toggle('ribbon-collapsed',collapsed);if(collapsed)compactTabs.append(tabs);else tabHome.after(tabs);toggle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="'+(collapsed?'m5 9 7 7 7-7':'m5 15 7-7 7 7')+'"/></svg>';toggle.setAttribute('aria-expanded',String(!collapsed));toggle.title=collapsed?'Expand ribbon':'Minimize ribbon';toggle.setAttribute('aria-label',toggle.title);try{localStorage.setItem('editor-md-ribbon-collapsed',String(collapsed));}catch{}document.dispatchEvent(new Event('viewchange'));}
    function category(name){current=name;$$('#md-menu [data-menu-category]').forEach(button=>{button.classList.toggle('selected',button.dataset.menuCategory===name);button.setAttribute('aria-pressed',String(button.dataset.menuCategory===name));});
      $('#ribbon').classList.toggle('md-home-ribbon',name==='Home');
      if(name==='Help'){$('#ribbon').innerHTML='<div class="ribbon-group"><div class="ribbon-row"><button id="menu-markdown-guide">Markdown formatting guide</button><button id="menu-about-editor">About Editor, MD</button></div></div>';$('#menu-markdown-guide').onclick=()=>action('markdown-guide');$('#menu-about-editor').onclick=()=>$('#about').click();}
      else ribbon(name);
      $('.md-menu-commands').append($('#ribbon'));
      if(name==='Home')compactHome();position();
    }
    function close(){if(menu.hidden)return;menu.hidden=true;brand.setAttribute('aria-expanded','false');$('#ribbon').classList.remove('md-home-ribbon');ribbonHome.after($('#ribbon'));placeholder?.remove();placeholder=null;const selected=$('#ribbon-tabs .active')?.dataset.tab||'Home';ribbon(selected);}
    function open(){if(!menu.hidden){close();return;}selectionTools?.hide();reserveExpandedRibbon();menu.hidden=false;brand.setAttribute('aria-expanded','true');category(current);}
    brand.onclick=event=>{event.preventDefault();open();};brand.onkeydown=event=>{if(event.key===' '){event.preventDefault();open();}};
    toggle.onclick=()=>setCollapsed(!collapsed);
    $$('[data-menu-category]').forEach(button=>button.onclick=()=>category(button.dataset.menuCategory));
    menu.addEventListener('click',event=>{const button=event.target.closest('.md-menu-commands button');if(button&&!(current==='Home'&&button.closest('[data-menu-group="clipboard"],[data-menu-group="font"],[data-menu-group="paragraph"],[data-menu-group="styles"]')))close();});
    menu.querySelector('nav').addEventListener('keydown',event=>{const buttons=$$('#md-menu [data-menu-category]'),index=buttons.indexOf(event.target);if(index<0)return;let next;if(event.key==='ArrowDown')next=(index+1)%buttons.length;else if(event.key==='ArrowUp')next=(index+buttons.length-1)%buttons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else return;event.preventDefault();category(buttons[next].dataset.menuCategory);buttons[next].focus();});
    document.addEventListener('selectionchange',()=>{if(!menu.hidden&&current==='Home')syncBlockStyle();});
    window.addEventListener('resize',position);document.addEventListener('viewchange',position);
    new MutationObserver(position).observe(document.body,{attributes:true,attributeFilter:['style','class']});
    document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target)&&!brand.contains(event.target))close();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){close();brand.focus();}if((event.ctrlKey||event.metaKey)&&event.key==='F1'){event.preventDefault();setCollapsed(!collapsed);}});
    const observer=new MutationObserver(()=>{if($('#dialog').open)close();});observer.observe($('#dialog'),{attributes:true,attributeFilter:['open']});
    setCollapsed(collapsed);return {setCollapsed,open,close,category,get collapsed(){return collapsed;}};
  }
  const api={panels,defaults,normalize,move,tabs,tabDefaults,installDock,installRibbon};if(typeof module==='object'&&module.exports)module.exports=api;else root.WorkspaceLayout=api;
})(globalThis);
