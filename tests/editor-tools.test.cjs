const test=require('node:test'),assert=require('node:assert/strict');
const {matches,replace,outline,diffSummary,tsvTable}=require('../editor-tools.js');
test('find honors case and whole-word boundaries without treating Markdown as a regex',()=>{
  const source='Link [link](#link) linker LINK';
  assert.deepEqual(matches(source,'link',{wholeWord:true}).map(item=>item.start),[0,6,13,26]);
  assert.deepEqual(matches(source,'LINK',{caseSensitive:true}).map(item=>item.start),[26]);
  assert.deepEqual(matches(source,'[link]'),[{start:5,end:11}]);
});
test('replacing one or all leaves all other Markdown bytes intact',()=>{
  const source='---\ntitle: Test\n---\n\n**alpha** and alpha\n[ref]: https://example.com';
  const first=matches(source,'alpha')[0];
  assert.equal(replace(source,'alpha','beta',{},first.start).source,'---\ntitle: Test\n---\n\n**beta** and alpha\n[ref]: https://example.com');
  assert.equal(replace(source,'alpha','beta').count,2);
  assert.equal(replace(source,'missing','beta').source,source);
});
test('outline keeps parent headings across skipped levels',()=>{
  assert.deepEqual(outline([{level:1,text:'A'},{level:3,text:'B'},{level:2,text:'C'},{level:1,text:'D'}]).map(item=>item.parent),[null,0,0,null]);
});
test('line comparison handles inserted and removed lines',()=>{
  const diff=diffSummary('A\nB\nC','A\nX\nC');
  assert.equal(diff.added,1);assert.equal(diff.removed,1);
  assert.deepEqual(diff.rows.filter(row=>row.kind!=='same').map(row=>row.text),['X','B']);
});
test('spreadsheet cells become a rectangular table while prose remains prose',()=>{
  assert.deepEqual(tsvTable('Name\tValue\nOne\t2'),[['Name','Value'],['One','2']]);
  assert.equal(tsvTable('one\ntwo'),null);
});
