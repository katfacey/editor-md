const test=require('node:test'),assert=require('node:assert/strict'),{fit}=require('../image-tools.js');
test('large images fit both writing-area dimensions while preserving aspect ratio',()=>{
  assert.deepEqual(fit(4096,3072,624,864),{width:624,height:468});assert.deepEqual(fit(1000,4000,624,864),{width:216,height:864});
  assert.deepEqual(fit(400,200,624,864),{width:400,height:200});assert.deepEqual(fit(1200,800,600),{width:600,height:400});
});
