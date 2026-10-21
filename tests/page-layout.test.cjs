const test=require('node:test');
const assert=require('node:assert/strict');
const {geometry,exclusionPath}=require('../page-layout.js');
test('default Letter geometry reserves one-inch margins on an exact physical sheet',()=>{
  const page=geometry();
  assert.deepEqual([page.width,page.height,page.bodyHeight,page.left,page.right],[816,1056,864,96,96]);
  assert.equal(page.stride-page.height,24);
});
test('landscape Legal uses the selected physical size and asymmetric margins',()=>{
  const page=geometry({size:'Legal',orientation:'landscape',top:.75,bottom:1.25,left:.5,right:1.5});
  assert.deepEqual([page.width,page.height,page.bodyHeight,page.left,page.right],[1344,816,624,48,144]);
});
test('A4 retains millimeter precision through the CSS inch conversion',()=>{
  const page=geometry({size:'A4'});
  assert.ok(Math.abs(page.width/96-8.2677)<1e-9);
  assert.ok(Math.abs(page.height/96-11.6929)<1e-9);
});
test('page exclusions reserve the full bottom margin, sheet gap and next top margin',()=>{
  const page=geometry(),shape=exclusionPath(page,3);
  assert.ok(shape.path.includes('100% 864px,100% 1080px'));
  assert.ok(shape.path.includes('100% 1944px,100% 2160px'));
  assert.equal(shape.height,3024);
  assert.ok(shape.height+page.top+page.bottom===3*page.height+2*page.gap);
});
