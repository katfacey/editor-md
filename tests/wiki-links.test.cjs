const test=require('node:test'),assert=require('node:assert/strict'),WikiLinks=require('../wiki-links.js');
test('wiki links retain target, alias, heading and original Markdown',()=>{
  assert.deepEqual(WikiLinks.parse('[[folder/Note#First heading|Readable label]]'),{source:'[[folder/Note#First heading|Readable label]]',target:'folder/Note',heading:'First heading',label:'Readable label'});
  assert.equal(WikiLinks.parse('[[#Heading]]').heading,'Heading');
  for(const source of ['[[]]','[[https://example.com]]','[[C:/secret]]','[[/outside]]','[[line\nbreak]]'])assert.equal(WikiLinks.parse(source),null);
});
test('wiki label and destination cannot inject markup',()=>{
  const html=WikiLinks.html('[[Note|<img onerror="bad">]]');assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(html.includes('Double-click to open in a new tab'));
});
