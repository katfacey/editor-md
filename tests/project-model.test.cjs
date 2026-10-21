const test=require('node:test'),assert=require('node:assert/strict'),model=require('../project-model.js');
test('relative attachment URLs distinguish local files from schemes and absolute paths',()=>{
  for(const value of ['images/a.png','../assets/a%20b.png','./note.md#heading'])assert.equal(model.relative(value),true);
  for(const value of ['https://example.com/a.png','javascript:alert(1)','file:///C:/a.png','//host/a.png','\\server\\a.png','#heading','data:image/png;base64,x','a\nb.png'])assert.equal(model.relative(value),false);
});
test('project membership handles Windows paths without matching neighboring folders',()=>{
  assert.equal(model.relativePath('C:\\Notes','c:\\notes\\Sub\\One.md'),'Sub/One.md');
  assert.equal(model.relativePath('C:\\Notes','C:\\Notes-old\\One.md'),null);
});
test('tree construction preserves nested folders and sorts folders before files',()=>{
  const tree=model.tree([{path:'z.md',name:'z.md',kind:'markdown'},{path:'Folder/note.md',name:'note.md',kind:'markdown'},{path:'Folder',name:'Folder',kind:'folder'},{path:'a.pdf',name:'a.pdf',kind:'attachment'}]);
  assert.equal(tree[0].name,'Folder');assert.equal(tree[0].children[0].path,'Folder/note.md');assert.equal(tree[1].name,'a.pdf');
});
