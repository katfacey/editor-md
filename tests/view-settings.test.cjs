const test=require('node:test');
const assert=require('node:assert/strict');
const settings=require('../view-settings.js');
test('custom document zoom accepts large and fractional percentages without the toolbar ceiling',()=>{
  assert.equal(settings.documentZoom('1600'),1600);
  assert.equal(settings.documentZoom('12.5'),12.5);
  for(const value of [0,-5,'',NaN,Infinity,'not a number'])assert.equal(settings.documentZoom(value),null);
});
test('toolbar steps remain within 25–200 percent even after a custom zoom',()=>{
  assert.equal(settings.toolbarZoom(195,1),200);
  assert.equal(settings.toolbarZoom(200,1),200);
  assert.equal(settings.toolbarZoom(1600,-1),200);
  assert.equal(settings.toolbarZoom(25,-1),25);
});
test('UI zoom validates separately from document zoom',()=>{
  assert.equal(settings.interfaceZoom('125'),125);
  assert.equal(settings.interfaceZoom(1600),null);
  assert.equal(settings.interfaceZoom(49),null);
});
test('initials normalize spaces and case, support Unicode, and reject empty or oversized labels',()=>{
  assert.equal(settings.initials(' a b '),'AB');
  assert.equal(settings.initials('Éd'),'ÉD');
  assert.equal(settings.initials(''),null);
  assert.equal(settings.initials('ABCDE'),null);
});
