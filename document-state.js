// Saved snapshots are separate from live buffers, so saving one tab cannot
// silently save or discard pending changes in another tab.
(function(root){
  class DocumentState{
    constructor(documents,write){this.documents=documents;this.write=write;this.saved=new Map(documents.map(document=>[document,structuredClone(document)]))}
    isDirty(document){return !!document&&(!this.saved.has(document)||JSON.stringify(document)!==JSON.stringify(this.saved.get(document)))}
    anyDirty(){return this.documents.some(document=>this.isDirty(document))}
    persist(targets){
      const next=new Map(this.saved);
      for(const document of targets)if(this.documents.includes(document))next.set(document,structuredClone(document));
      const serialized=JSON.stringify(this.documents.filter(document=>next.has(document)).map(document=>next.get(document)));
      this.write(serialized); // Commit snapshots only after storage succeeds.
      this.saved=next;return serialized;
    }
    discard(document){
      if(this.saved.has(document)){
        const snapshot=structuredClone(this.saved.get(document));
        for(const key of Object.keys(document))delete document[key];
        Object.assign(document,snapshot);
      }else{
        const index=this.documents.indexOf(document);if(index!==-1)this.documents.splice(index,1);
      }
    }
  }
  if(typeof module==='object'&&module.exports)module.exports=DocumentState;
  else root.DocumentState=DocumentState;
})(globalThis);
