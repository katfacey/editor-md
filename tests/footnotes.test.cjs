const test=require('node:test');
const assert=require('node:assert/strict');
const notes=require('../footnotes.js');

test('inserting between 3 and 4 renumbers both references and definitions in document order',()=>{
  const original='A[^1] B[^2] C[^3] D[^4]\n\n[^1]: One\n[^2]: Two\n[^3]: Three\n[^4]: Four\n';
  const source=notes.insert(original,original.indexOf(' D'),'Inserted','new');
  const model=notes.parse(source);
  assert.deepEqual(model.refs.map(ref=>ref.id),['1','2','3','4','5']);
  assert.deepEqual(model.notes.map(note=>note.text),['One','Two','Three','Inserted','Four']);
  assert.equal(model.notes[3].number,4);
});
test('deletion removes every matching reference and closes gaps without changing unrelated numbers in code',()=>{
  const original='A[^1] B[^2] C[^3] B again[^2]. `[^3]`\n\n[^1]: One\n[^2]: Two\n[^3]: Three\n';
  const source=notes.remove(original,'2'),model=notes.parse(source);
  assert.deepEqual(model.notes.map(note=>note.text),['One','Three']);
  assert.deepEqual(model.refs.map(ref=>ref.id),['1','2']);
  assert.ok(source.includes('`[^3]`'));
  assert.ok(!source.includes('Two'));
});
test('named and repeated references share a number; definitions do not dictate display order',()=>{
  const model=notes.parse('B[^later] A[^first] B[^later]\n\n[^first]: A\n[^later]: B');
  assert.deepEqual(model.notes.map(note=>[note.number,note.text,note.references.length]),[[1,'B',2],[2,'A',1]]);
  assert.equal(notes.normalize(notes.normalize(model.source)),notes.normalize(model.source));
});
test('footnote examples in fences, inline code, escaped text, HTML attributes, and comments stay literal',()=>{
  const source='```md\n[^fake]: Example\nText[^fake]\n```\n\n`[^code]` \\[^escaped] <!-- [^hidden] --> <span title="[^attribute]">Text</span>\n\nActual[^real]\n\n[^real]: Real note';
  assert.deepEqual(notes.parse(source).notes.map(note=>note.id),['real']);
  assert.ok(notes.normalize(source).includes('[^fake]: Example'));
});
test('multiline notes survive editing and deleting without eating the next paragraph',()=>{
  const source='Text[^abc]\n\n[^abc]: First line\n    Continuation\n\n    Second paragraph\n\nDocument ending.\n';
  assert.equal(notes.parse(source).notes[0].text,'First line\nContinuation\n\nSecond paragraph');
  const edited=notes.update(source,'abc','Edited\nSecond line');
  assert.equal(notes.parse(edited).notes[0].text,'Edited\nSecond line');
  assert.ok(edited.endsWith('Document ending.\n'));
  assert.ok(notes.remove(edited,'1').endsWith('Document ending.\n'));
});
test('optional initials are literal per-note text and do not change earlier signatures',()=>{
  assert.equal(notes.signed(' yada yada yada. ',true,'KF'),'yada yada yada. -KF');
  assert.equal(notes.signed('A note.',false,'KF'),'A note.');
  const source=notes.insert('Text',4,notes.signed('Old.',true,'KF'),'one');
  const result=notes.insert(source,0,notes.signed('New.',true,'AB'),'two');
  assert.deepEqual(notes.parse(result).notes.map(note=>note.text),['New. -AB','Old. -KF']);
});
test('rendering gives repeated references unique anchors and preserves note Markdown as escaped data',()=>{
  const html=notes.render('A[^x] B[^x]\n\n[^x]: **Bold** "quoted" <b>text</b>',text=>text);
  assert.ok(html.includes('id="editor-md-fn-x-ref-1"'));
  assert.ok(html.includes('id="editor-md-fn-x-ref-2"'));
  assert.ok(html.includes('data-footnote-source="**Bold** &quot;quoted&quot; &lt;b&gt;text&lt;/b&gt;"'));
});
test('missing definitions remain repairable and unreferenced notes are retained',()=>{
  const model=notes.parse('Text[^missing]\n\n[^unlinked]: Keep me');
  assert.equal(model.notes[0].missing,true);
  assert.equal(model.notes[1].text,'Keep me');
  const fixed=notes.parse(notes.update(model.source,'missing','Repaired'));
  assert.equal(fixed.notes[0].text,'Repaired');
  assert.equal(fixed.notes[1].text,'Keep me');
});
