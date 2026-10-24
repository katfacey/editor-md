// Workspace dimensions are CSS pixels; document magnification never changes them.
(function(){
  const workspace=$('.workspace'),panels={left:$('.navigator'),right:$('#inspector')};
  let widths={left:222,right:245};
  try{const stored=JSON.parse(localStorage.getItem('editor-md-sidebars-v1'));for(const side of ['left','right'])if(Number.isFinite(stored?.[side]))widths[side]=Math.max(160,Math.min(700,stored[side]));}catch{}
  const visible=element=>getComputedStyle(element).display!=='none';
  function maximum(side){
    const scale=interfaceSettings.zoom/100,other=side==='left'?'right':'left';
    return Math.max(160,Math.min(700,workspace.getBoundingClientRect().width/scale-(visible(panels[other])?panels[other].getBoundingClientRect().width/scale:0)-240-12));
  }
  function resize(side,value,persist=true){
    widths[side]=ViewSettings.sidebarWidth(value,maximum(side));
    panels[side].style.width=widths[side]+'px';
    const handle=$('#resize-'+side);handle.setAttribute('aria-valuenow',Math.round(widths[side]));handle.setAttribute('aria-valuemax',Math.round(maximum(side)));
    if(persist)try{localStorage.setItem('editor-md-sidebars-v1',JSON.stringify(widths));}catch{}
  }
  for(const side of ['left','right']){
    const handle=document.createElement('div');handle.id='resize-'+side;handle.className='sidebar-resizer';handle.tabIndex=0;
    handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label','Resize '+side+' sidebar');handle.setAttribute('aria-controls',side==='left'?'navigator':'inspector');handle.setAttribute('aria-valuemin','160');
    if(side==='left')panels.left.after(handle);else panels.right.before(handle);
    let drag=null;
    handle.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();drag={x:event.clientX,width:panels[side].getBoundingClientRect().width/(interfaceSettings.zoom/100),scale:interfaceSettings.zoom/100};handle.setPointerCapture(event.pointerId);document.body.classList.add('resizing-sidebar');};
    handle.onpointermove=event=>{if(drag)resize(side,drag.width+(event.clientX-drag.x)/drag.scale*(side==='left'?1:-1));};
    const end=()=>{drag=null;document.body.classList.remove('resizing-sidebar');};handle.onpointerup=end;handle.onpointercancel=end;handle.onlostpointercapture=end;
    handle.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;event.preventDefault();resize(side,event.key==='Home'?(side==='left'?222:245):widths[side]+(event.key==='ArrowRight'?1:-1)*(side==='left'?1:-1)*(event.shiftKey?40:10));};
    resize(side,widths[side],false);
    new ResizeObserver(()=>{handle.hidden=!visible(panels[side]);}).observe(panels[side]);
  }
  let reflow=false;
  new ResizeObserver(()=>{if(reflow)return;reflow=true;requestAnimationFrame(()=>{reflow=false;for(const side of ['left','right'])resize(side,widths[side],false);});}).observe(workspace);
  $('#canvas-scroll').addEventListener('wheel',event=>{
    if(!(event.ctrlKey||event.metaKey)||!event.deltaY||active<0)return;
    event.preventDefault();event.stopPropagation();
    const canvas=event.currentTarget,rect=canvas.getBoundingClientRect(),scale=interfaceSettings.zoom/100;
    const x=(event.clientX-rect.left)/scale,y=(event.clientY-rect.top)/scale,old=documentZoom;
    // Wheel steps share the quick-control range. Custom percentages remain unlimited.
    if(zoom(ViewSettings.toolbarZoom(old,event.deltaY<0?1:-1))){const ratio=documentZoom/old;canvas.scrollLeft=(canvas.scrollLeft+x)*ratio-x;canvas.scrollTop=(canvas.scrollTop+y)*ratio-y;}
  },{passive:false});
  window.WorkspaceControls={resize,widths};
})();

WikiLinks.install();FontManager.populate();
const imageTools=ImageTools.install();
const writeInput=WriteInput.install();
const selectionTools=SelectionTools.install();
window.SidebarDock=WorkspaceLayout.installDock();
window.RibbonUI=WorkspaceLayout.installRibbon();
DocumentThemes.install();
window.documentTabMenu=DocumentTabMenu.install();
