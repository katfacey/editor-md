// Shared validation and toolbar behavior. Custom document zoom has no fixed ceiling.
(function(root){
  const settings={
    documentZoom(value){const number=Number(value);return Number.isFinite(number)&&number>0&&number/100>0?number:null;},
    toolbarZoom(value,direction){return Math.max(25,Math.min(200,value+direction*5));},
    interfaceZoom(value){const number=Number(value);return Number.isFinite(number)&&number>=50&&number<=200?number:null;},
    initials(value){const text=String(value).trim().replace(/[\s\u0000-\u001f\u007f]/g,'').toUpperCase();return Array.from(text).length>=1&&Array.from(text).length<=4?text:null;}
  };
  if(typeof module==='object'&&module.exports)module.exports=settings;
  else root.ViewSettings=settings;
})(globalThis);
