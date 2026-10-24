const test=require('node:test'),assert=require('node:assert/strict'),WriteInput=require('../write-input.js');
test('inline shortcuts recognize complete Markdown and note links at the caret',()=>{
  for(const [text,type] of [['prefix **bold**','strong'],['*italic*','em'],['__bold__','strong'],['_italic_','em'],['~~old~~','strike'],['`x = 1`','code'],['***both***','strongEm'],['[[folder/Note#Part|A note]]','wiki'],['[label](https://example.com)','link']]){
    const token=WriteInput.inline(text);assert.equal(token?.type,type,text);assert.equal(text.slice(token.start,token.end),token.raw);
  }
});
test('incomplete, escaped, trailing and intraword shortcuts stay literal',()=>{
  for(const text of ['**unfinished','** spaces **','*outer **','*outer **inner*','_outer __','words_with_underscores','\\**literal**','\\[[Note]]','`unfinished','`**code**','`[[Note]]','**bold** afterwards','![picture](https://example.com/a.png)'])assert.equal(WriteInput.inline(text),null,text);
  assert.equal(WriteInput.inline('\\\\**bold**')?.type,'strong');
});
test('block prefixes trigger only at an empty paragraph start',()=>{
  assert.deepEqual(WriteInput.block('## '),{command:'formatBlock',value:'h2'});
  assert.equal(WriteInput.block('- ').command,'insertUnorderedList');assert.equal(WriteInput.block('1. ').command,'insertOrderedList');assert.equal(WriteInput.block('> ').value,'blockquote');
  for(const text of ['word # ','#Heading','####### ','- text','2. '])assert.equal(WriteInput.block(text),null);
});
test('links remain recognizable with Markdown formatting in their labels',()=>{
  for(const label of ['**Bold**','*Italic*','~~Strike~~','`Code`','***Both***','**Bold *nested italic***','<u>Underline</u>','<sup>Superscript</sup>','<sub>Subscript</sub>','<mark>Highlight</mark>']){
    const source='['+label+'](https://example.com/guide)';
    assert.equal(WriteInput.inline(source)?.type,'link',source);
  }
});
