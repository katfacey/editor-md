const test=require('node:test');
const assert=require('node:assert/strict');
const DocumentState=require('../document-state.js');

test('saving one dirty document keeps other unsaved buffers out of storage',()=>{
  const files=[{name:'One.md',html:'Original one'},{name:'Two.md',html:'Original two'}];let stored;
  const state=new DocumentState(files,value=>stored=JSON.parse(value));
  files[0].html='Changed one';files[1].html='Changed two';state.persist([files[0]]);
  assert.equal(stored[0].html,'Changed one');assert.equal(stored[1].html,'Original two');
  assert.equal(state.isDirty(files[0]),false);assert.equal(state.isDirty(files[1]),true);assert.equal(state.anyDirty(),true);
});
test('failed persistence keeps the saved snapshot and live edits for a retry',()=>{
  const files=[{name:'Draft.md',html:'Original'}];let fail=true;
  const state=new DocumentState(files,()=>{if(fail)throw Error('Storage full')});
  files[0].html='Do not lose this';assert.throws(()=>state.persist(files),/Storage full/);
  assert.equal(state.saved.get(files[0]).html,'Original');assert.equal(files[0].html,'Do not lose this');assert.equal(state.anyDirty(),true);
  fail=false;state.persist(files);assert.equal(state.anyDirty(),false);
});
test('discard restores content and page setup while preserving the document identity',()=>{
  const original={name:'Saved.md',html:'Saved content',page:{size:'Letter',top:1}};
  const files=[structuredClone(original),{name:'Other.md',html:'Other'}],identity=files[0];
  const state=new DocumentState(files,()=>{});files[0].html='Unsaved';files[0].page.top=.5;files[0].extra='temporary';files[1].html='Keep this pending';
  state.discard(files[0]);assert.equal(files[0],identity);assert.deepEqual(files[0],original);
  assert.equal(state.isDirty(files[0]),false);assert.equal(state.isDirty(files[1]),true);
});
test('unsaved new drafts are excluded from unrelated saves and removed by discard',()=>{
  const files=[{name:'Saved.md',html:'Original'}];let stored;
  const state=new DocumentState(files,value=>stored=JSON.parse(value));
  const draft={name:'Draft.md',html:'Not saved'};files.push(draft);
  assert.equal(state.isDirty(draft),true);state.persist([files[0]]);assert.equal(stored.length,1);
  state.discard(draft);assert.equal(files.length,1);assert.equal(state.anyDirty(),false);
});
test('a saved new document becomes a durable snapshot and can be restored later',()=>{
  const files=[],state=new DocumentState(files,()=>{}),draft={name:'New.md',html:'First save'};files.push(draft);
  state.persist([draft]);draft.html='Later changes';state.discard(draft);
  assert.equal(files.length,1);assert.equal(draft.html,'First save');assert.equal(state.anyDirty(),false);
});
