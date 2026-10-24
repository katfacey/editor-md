const test=require('node:test'),assert=require('node:assert/strict');
globalThis.WikiLinks=require('../wiki-links.js');const Tools=require('../selection-tools.js');
test('link destinations support web, notes and headings',()=>{
  for(const [value,kind] of [['https://example.com','web'],['[[A note|Label]]','wiki'],['folder/My Note.md#Part','note'],['#section','heading']])assert.equal(Tools.destination(value)?.kind,kind,value);
});
test('link destinations reject scripts, executable files and control characters',()=>{
  for(const value of ['javascript:alert(1)','file:///C:/test.exe','C:/test.md','run.exe','https://example.com\n<script>','[[https://example.com]]',''])assert.equal(Tools.destination(value),null,value);
});
test('overescaped formatted heading links recover their intended Markdown',()=>{
  const exact=String.raw`1. [\*\*The Fireworks Festival\*\*]\(#scene-1-the-fireworks-festival)`;
  assert.equal(Tools.repairEscapedHeadingLinks(exact),'1. [**The Fireworks Festival**](#scene-1-the-fireworks-festival)');
  assert.equal(Tools.repairEscapedHeadingLinks('1. [**The Fireworks Festival**](#scene-1-the-fireworks-festival)'),'1. [**The Fireworks Festival**](#scene-1-the-fireworks-festival)');
  assert.equal(Tools.repairEscapedHeadingLinks(String.raw`An intentionally escaped \[plain](#scene)`),String.raw`An intentionally escaped \[plain](#scene)`);
});
