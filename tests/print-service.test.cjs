const test=require('node:test'),assert=require('node:assert/strict'),{create}=require('../print-service.js');
test('print calls the captured system function once after preparation',async()=>{
  const events=[],printer=create({prepare:async()=>events.push('ready'),print:()=>events.push('system')});
  assert.equal(await printer.request(),true);assert.deepEqual(events,['ready','system']);assert.equal(printer.busy,false);
});
test('duplicate clicks are ignored while assets and fonts are preparing',async()=>{
  let release,calls=0;const printer=create({prepare:()=>new Promise(resolve=>release=resolve),print:()=>calls++});
  const first=printer.request();assert.equal(await printer.request(),false);release(true);await first;assert.equal(calls,1);
});
test('cancelled preparation does not print; an error is visible and a retry works',async()=>{
  let calls=0,attempt=0;const errors=[],printer=create({prepare:()=>{attempt++;if(attempt===1)return false;if(attempt===2)throw Error('Image unavailable');},print:()=>calls++,onError:error=>errors.push(error.message)});
  assert.equal(await printer.request(),false);assert.equal(await printer.request(),false);assert.equal(await printer.request(),true);
  assert.deepEqual(errors,['Image unavailable']);assert.equal(calls,1);
});
