const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../chart-model.js');

test('CSV import retains quoted labels, headers, zeroes, and multiple series',()=>{
  const m=M.parseData('Month,Sales,Costs\n"Jan, early",0,12\nFeb,25,18');
  assert.deepEqual(m.labels,['Jan, early','Feb']);assert.deepEqual(m.series,[{name:'Sales',values:[0,25]},{name:'Costs',values:[12,18]}]);
  assert.deepEqual(M.fromSource(M.toSource(m)),m);
});
test('tabular selections and Markdown table separators import correctly',()=>{
  const tsv=M.parseData('Day\tWords\nMon\t320\nTue\t480');
  const md=M.parseData('| Day | Words |\n| --- | ---: |\n| Mon | 320 |\n| Tue | 480 |');
  assert.deepEqual(tsv.labels,md.labels);assert.deepEqual(tsv.series,md.series);
});
test('chart types preserve the data; pie validation does not coerce negatives',()=>{
  const m=M.parseData('A,10\nB,-5');m.type='line';assert.match(M.toSource(m),/line \[10, -5\]/);
  m.type='pie';assert.throws(()=>M.toSource(m),/nonnegative/);assert.deepEqual(m.series[0].values,[10,-5]);
});
test('bad selections fail with row/column errors instead of inventing numbers',()=>{
  assert.throws(()=>M.parseData('Name,Value\nA,10\nB,unknown'),/Row 3, column 2/);
  assert.throws(()=>M.parseData('Name,Value\nA,10,12'),/Row 2 has 3 columns/);
  assert.throws(()=>M.parseData('Name,Value\n"A,10'),/closing quote/);
});
test('branching flowchart source round-trips node shapes, cycles, labels, and direction',()=>{
  const m=M.sampleFlow();m.direction='TB';m.nodes[1].shape='database';
  const source=M.toSource(m);assert.match(source,/flowchart TB/);assert.match(source,/\|"Yes"\|/);assert.match(source,/N3 -.->\|"Revise"\| N2/);assert.deepEqual(M.fromSource(source),m);
});
test('node deletion removes dangling connections and keeps remaining IDs stable',()=>{
  const m=M.sampleFlow();M.removeNode(m,'N3');assert.deepEqual(m.nodes.map(n=>n.id),['N1','N2','N4']);assert.equal(m.edges.length,1);M.validate(m);
});
test('custom source changes never get silently overwritten by metadata',()=>{
  const source=M.toSource(M.sampleFlow());assert.equal(M.fromSource(source.replace('N3 -->|"Yes"| N4','N3 -->|"No"| N4')),null);
});
test('blank and nonfinite cells are rejected; explicit header override is supported',()=>{
  assert.throws(()=>M.parseData('Label,Value\nA,'),/needs a number/);
  assert.throws(()=>M.parseData('Label,Value\nA,Infinity'),/needs a number/);
  const m=M.parseData('2025,2026\n10,20',{header:'yes'});assert.equal(m.series[0].name,'2026');assert.deepEqual(m.labels,['10']);
});
test('switching selected data to a flowchart uses its labels and values',()=>{
  const m=M.flowFromChart(M.parseData('Month,Sales\nJan,120\nFeb,160'));
  assert.deepEqual(m.nodes.map(n=>n.label),['Jan: Sales 120','Feb: Sales 160']);assert.equal(m.edges[0].to,'N2');assert.deepEqual(M.fromSource(M.toSource(m)),m);
});
