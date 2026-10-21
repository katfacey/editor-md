(function(root){
  function fit(width,height,maxWidth,maxHeight=Infinity){
    const factor=Math.min(1,maxWidth/width,maxHeight/height);
    return {width:Math.max(1,Math.round(width*factor)),height:Math.max(1,Math.round(height*factor))};
  }
  function install(){
    const paper=$('#paper'),canvas=$('#canvas-scroll');let image=null,drag=null,queued=false;
    const overlay=document.createElement('div');overlay.className='image-selection';overlay.hidden=true;
    overlay.innerHTML='<div class="image-selection-toolbar"><button type="button" data-image-properties>Image…</button><button type="button" data-image-fit>Fit to page</button></div>'+['nw','ne','sw','se'].map(corner=>'<button type="button" class="image-handle '+corner+'" data-corner="'+corner+'" aria-label="Resize image '+corner+' corner"></button>').join('');document.body.append(overlay);
    function limits(){const g=PageLayout.geometry({...defaultPage,...files[active]?.page});return documentLayout==='page'?{width:g.width-g.left-g.right,height:g.bodyHeight}:{width:Math.max(1,paper.clientWidth-parseFloat(getComputedStyle(paper).paddingLeft)-parseFloat(getComputedStyle(paper).paddingRight)),height:Infinity};}
    function box(){const rect=image.getBoundingClientRect(),scale=(interfaceSettings.zoom/100)*(documentZoom/100);return {width:rect.width/scale,height:rect.height/scale};}
    function position(){queued=false;if(!image?.isConnected||mode==='source'||active<0){overlay.hidden=true;return;}const r=image.getBoundingClientRect(),c=canvas.getBoundingClientRect(),ui=interfaceSettings.zoom/100;overlay.hidden=r.bottom<c.top||r.top>c.bottom||r.right<c.left||r.left>c.right;if(overlay.hidden)return;Object.assign(overlay.style,{left:r.left/ui+'px',top:r.top/ui+'px',width:r.width/ui+'px',height:r.height/ui+'px',clipPath:'inset('+Math.max(-40,(c.top-r.top)/ui)+'px '+Math.max(-8,(r.right-c.right)/ui)+'px '+Math.max(-40,(r.bottom-c.bottom)/ui)+'px '+Math.max(-8,(c.left-r.left)/ui)+'px)'});overlay.classList.toggle('toolbar-below',r.top<c.top+40*ui);}
    function schedule(){if(!queued){queued=true;requestAnimationFrame(position);}}
    function select(target){image=target;position();}
    function commit(attributes){
      if(!image?.isConnected)return;
      const index=[...paper.querySelectorAll('img')].indexOf(image),copy=image.cloneNode(true);
      // A clone's parent lets the pagination cleaner restore view-only fitting.
      const holder=document.createElement('div');holder.append(copy);PageLayout.clean(holder);
      for(const [name,value] of Object.entries(attributes))value===null?copy.removeAttribute(name):copy.setAttribute(name,String(value));
      const align=copy.dataset.imageAlign||'inline',parent=image.parentElement,ownLine=parent?.tagName==='P'&&!parent.textContent.trim()&&parent.children.length===1;
      let markup=copy.outerHTML;const range=document.createRange();
      if(align!=='inline'||ownLine){const block=ownLine?parent.cloneNode(false):document.createElement('p');block.style.textAlign=align==='inline'?'':align;block.append(copy);markup=block.outerHTML;range.selectNode(ownLine?parent:image);}else range.selectNode(image);
      const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);paper.focus();
      document.execCommand('insertHTML',false,markup);save();select(paper.querySelectorAll('img')[index]);pagination.schedule();
    }
    function fitSelected(){if(!image)return;const size=fit(image.naturalWidth||box().width,image.naturalHeight||box().height,limits().width,limits().height);commit(size);}
    function properties(){
      if(!image)return;const target=image,current=box();
      openDialog('Image size and placement','<form id="image-properties"><div class="field-grid"><label>Width (px)<input id="image-width" type="number" min="1" max="100000" step="1" required></label><label>Height (px)<input id="image-height" type="number" min="1" max="100000" step="1" required></label></div><label class="image-aspect"><input id="image-aspect" type="checkbox" checked>Lock aspect ratio</label><label for="image-placement">Placement</label><select id="image-placement"><option value="inline">Inline with text</option><option value="left">Left · own line</option><option value="center">Center · own line</option><option value="right">Right · own line</option></select><p>Drag a corner handle to resize. Images fit the available writing area; screen zoom does not change their saved size.</p><p id="image-size-error" role="alert" class="validation-error"></p><div class="dialog-actions"><button type="button" id="image-fit">Fit to page</button><button type="button" id="image-cancel">Cancel</button><button type="submit" class="primary">Apply</button></div></form>');
      const width=$('#image-width'),height=$('#image-height'),ratio=current.width/current.height;width.value=Math.round(current.width);height.value=Math.round(current.height);$('#image-placement').value=image.dataset.imageAlign||'inline';
      width.oninput=()=>{if($('#image-aspect').checked&&Number(width.value)>0)height.value=Math.max(1,Math.round(Number(width.value)/ratio));};height.oninput=()=>{if($('#image-aspect').checked&&Number(height.value)>0)width.value=Math.max(1,Math.round(Number(height.value)*ratio));};
      $('#image-fit').onclick=()=>{const size=fit(Number(width.value)||current.width,Number(height.value)||current.height,limits().width,limits().height);width.value=size.width;height.value=size.height;};
      $('#image-cancel').onclick=()=>$('#dialog').close();
      $('#image-properties').onsubmit=event=>{event.preventDefault();if(image!==target||!target.isConnected)return $('#dialog').close();let w=Number(width.value),h=Number(height.value);if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w>100000||h>100000){$('#image-size-error').textContent='Enter dimensions between 1 and 100,000 pixels.';return;}const size=fit(w,h,limits().width,limits().height),placement=$('#image-placement').value;$('#dialog').close();commit({...size,'data-image-align':placement});};
    }
    paper.addEventListener('click',event=>{const target=event.target.closest('img');if(target&&!target.closest('[data-mermaid]'))select(target);else {image=null;overlay.hidden=true;}});
    paper.addEventListener('dblclick',event=>{const target=event.target.closest('img');if(target){event.preventDefault();select(target);properties();}});
    overlay.onpointerdown=event=>{const handle=event.target.closest('[data-corner]');if(!handle||!image)return;event.preventDefault();const current=box();drag={x:event.clientX,y:event.clientY,...current,corner:handle.dataset.corner,target:image,attributes:{width:image.getAttribute('width'),height:image.getAttribute('height')},scale:(interfaceSettings.zoom/100)*(documentZoom/100)};handle.setPointerCapture(event.pointerId);};
    overlay.onpointermove=event=>{if(!drag)return;const dx=(event.clientX-drag.x)/drag.scale*(drag.corner.includes('w')?-1:1),dy=(event.clientY-drag.y)/drag.scale*(drag.corner.includes('n')?-1:1),factor=Math.max(.01,Math.abs(dx)>=Math.abs(dy)?(drag.width+dx)/drag.width:(drag.height+dy)/drag.height),size=fit(drag.width*factor,drag.height*factor,limits().width,limits().height);image.setAttribute('width',size.width);image.setAttribute('height',size.height);schedule();};
    const end=cancel=>{if(!drag)return;const target=drag.target,size={width:target.getAttribute('width'),height:target.getAttribute('height')};for(const [key,value] of Object.entries(drag.attributes))value===null?target.removeAttribute(key):target.setAttribute(key,value);drag=null;if(!cancel)commit(size);else pagination.schedule();};
    overlay.onpointerup=()=>end(false);overlay.onpointercancel=()=>end(true);overlay.onlostpointercapture=()=>{if(drag)end(true);};
    overlay.querySelector('[data-image-properties]').onclick=properties;overlay.querySelector('[data-image-fit]').onclick=fitSelected;
    canvas.addEventListener('scroll',schedule);window.addEventListener('resize',schedule);for(const name of ['documentchange','paginationchange','viewchange'])document.addEventListener(name,schedule);
    return {select,properties,fitSelected,commit,limits,get selected(){return image}};
  }
  const api={fit,install};if(typeof module==='object'&&module.exports)module.exports=api;else root.ImageTools=api;
})(globalThis);
