// Preserve the host's original print function. Tauri's Windows print method
// evaluates window.print(), so sending this wrapper back through Rust recurses.
(function(root){
  function create({print,prepare=async()=>true,onError=()=>{}}){
    let busy=false;
    return {async request(){
      if(busy)return false;
      busy=true;
      try{if(await prepare()===false)return false;await print();return true;}
      catch(error){onError(error);return false;}
      finally{busy=false;}
    },get busy(){return busy}};
  }
  function snapshot(paper){
    clearSnapshot();
    const copy=PageLayout.clean(paper.cloneNode(true));
    copy.id='print-document';copy.className='paper print-document';
    copy.removeAttribute('style');copy.removeAttribute('contenteditable');
    copy.removeAttribute('aria-label');
    copy.querySelectorAll('.graph-controls,.graph-status,[data-editor-page-exclusion]').forEach(node=>node.remove());
    copy.querySelectorAll('img[width][height]').forEach(image=>{
      const width=Number(image.getAttribute('width')),height=Number(image.getAttribute('height'));
      if(width>0&&height>0)image.style.aspectRatio=width+'/'+height;
    });
    document.body.append(copy);document.body.classList.add('printing-document');
    return copy;
  }
  function clearSnapshot(){
    document.getElementById('print-document')?.remove();
    document.body.classList.remove('printing-document');
  }
  const api={create,snapshot,clearSnapshot};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.PrintService=api;window.addEventListener('afterprint',clearSnapshot);}
})(globalThis);
