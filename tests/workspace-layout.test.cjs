const test=require('node:test'),assert=require('node:assert/strict'),Layout=require('../workspace-layout.js');
test('sidebar preferences retain each panel once and repair malformed layouts',()=>{
  const value=Layout.normalize({left:['footnotes','files','files','unknown'],right:['outline'],active:{left:'missing',right:'outline'}});
  const all=[...value.left,...value.right];assert.equal(all.length,6);assert.equal(new Set(all).size,6);assert.equal(value.active.left,'footnotes');assert.equal(value.active.right,'outline');
});
test('moving a panel reorders tabs, crosses sides and activates its new position',()=>{
  const moved=Layout.move(Layout.defaults,'footnotes','left',1);assert.deepEqual(moved.left,['files','footnotes','outline','bookmarks','search']);assert.deepEqual(moved.right,['details']);assert.equal(moved.active.left,'footnotes');
  const reordered=Layout.move(moved,'files','left',3);assert.deepEqual(reordered.left,['footnotes','outline','bookmarks','files','search']);
});
test('a sidebar can be emptied and receive its panels again without losing them',()=>{
  let value=Layout.move(Layout.defaults,'footnotes','left',0);value=Layout.move(value,'details','left',0);assert.deepEqual(value.right,[]);assert.equal(value.active.right,null);
  value=Layout.normalize(JSON.parse(JSON.stringify(value)));value=Layout.move(value,'details','right',0);assert.equal(value.active.right,'details');assert.equal(value.left.length,5);
});
test('tab appearance settings constrain shape and retain the active-bold preference',()=>{
  assert.deepEqual(Layout.tabs({shape:'angular',boldActive:false}),{shape:'angular',boldActive:false});assert.deepEqual(Layout.tabs({shape:'url(bad)',boldActive:'yes'}),Layout.tabDefaults);
});
