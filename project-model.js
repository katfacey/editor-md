(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ProjectModel=api;})(globalThis,function(){
  function relative(value){return typeof value==='string'&&!!value&&!/^[\s]*[\/#]|:|[\u0000-\u001f]/.test(value)&&!value.startsWith('\\');}
  function relativePath(root,path){
    const base=root.replaceAll('\\','/').replace(/\/$/,''),value=path.replaceAll('\\','/');
    return value.toLowerCase().startsWith(base.toLowerCase()+'/')?value.slice(base.length+1):null;
  }
  function tree(entries){
    const root={path:'',children:[]},nodes=new Map([['',root]]);
    for(const entry of [...entries].sort((a,b)=>a.path.split('/').length-b.path.split('/').length)){
      const node={...entry,children:[]};nodes.set(entry.path,node);
      const parent=entry.path.includes('/')?entry.path.slice(0,entry.path.lastIndexOf('/')):'';
      (nodes.get(parent)||root).children.push(node);
    }
    function sort(node){node.children.sort((a,b)=>(a.kind==='folder'?0:1)-(b.kind==='folder'?0:1)||a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));node.children.forEach(sort);}
    sort(root);return root.children;
  }
  function cleanAssets(root){
    root.querySelectorAll('img[data-local-src]').forEach(image=>{
      image.setAttribute('src',image.dataset.localSrc);image.removeAttribute('data-local-src');image.removeAttribute('data-local-error');
      image.classList.remove('attachment-error');if(!image.className)image.removeAttribute('class');
    });return root;
  }
  return {relative,relativePath,tree,cleanAssets};
});
