// End-to-end editing checks run inside the actual packaged Windows WebView.
async function runEditingChecks(check,{invoke}){
  const paper=$('#paper'),original=files[active],oldMode=mode;
  const draft={id:crypto.randomUUID(),name:'Write input checks.md',html:'<p><br></p>',sourceText:'',sourceHtml:'<p><br></p>'};
  files.push(draft);openFile(files.indexOf(draft));setMode('write');
  function select(node,start=0,end=node.textContent.length){
    const range=document.createRange();if(node.nodeType===3){range.setStart(node,start);range.setEnd(node,end);}else range.selectNodeContents(node);
    paper.focus({preventScroll:true});const s=window.getSelection();s.removeAllRanges();s.addRange(range);selection=range.cloneRange();return range;
  }
  function reset(html='<p><br></p>'){
    paper.innerHTML=html;save();const r=select(paper.firstElementChild);r.collapse(false);window.getSelection().removeAllRanges();window.getSelection().addRange(r);selection=r;
  }
  async function type(text){for(const char of text){document.execCommand('insertText',false,char);await Promise.resolve();}}
  try{
    for(const [source,selector,label] of [['**bold words**','strong,b','bold'],['*italic words*','em,i','italic'],['__bold__','strong,b','underscore bold'],['_italic_','em,i','underscore italic'],['~~old text~~','del,s,strike','strikethrough'],['`let x = 1`','code','inline code'],['[a reference](https://example.com)','a[href="https://example.com"]','Markdown links']]){
      reset();await type(source);check(!!paper.querySelector(selector),'Typing completed '+label+' syntax renders immediately in Write');
      const rendered=paper.querySelector(selector);await type(' after');check(!rendered.textContent.includes('after'),'Typing after '+label+' remains outside its formatting');
    }
    for(const [label,selector] of [['**Bold**','strong,b'],['*Italic*','em,i'],['~~Strike~~','del,s,strike'],['`Code`','code'],['***Both***','strong em,strong i,b em,b i,em strong,em b,i strong,i b'],['**Bold *nested italic***','strong em,strong i,b em,b i']]){
      const source='['+label+'](https://example.com/guide)';
      reset();await type(source);
      const link=paper.querySelector('a[href="https://example.com/guide"]');
      check(!!link&&!!link.querySelector(selector),'Typing '+source+' keeps the formatting inside a clickable link; actual '+paper.innerHTML);
      check(draft.sourceText.includes('(https://example.com/guide)'),'Formatted link survives Markdown serialization: '+label);
      reset();$('#source').value=source;$('#source').dispatchEvent(new Event('input',{bubbles:true}));
      check(!!paper.querySelector('a[href="https://example.com/guide"] '+selector),'Source-to-Write renders linked '+label);
    }
    for(const [tag,text] of [['u','Underline'],['sup','Superscript'],['sub','Subscript'],['mark','Highlight']]){
      const source='[<'+tag+'>'+text+'</'+tag+'>](https://example.com/guide)';
      reset('<p>[<'+tag+'>'+text+'</'+tag+'></p>');await type('](https://example.com/guide)');
      check(!!paper.querySelector('a[href="https://example.com/guide"] '+tag),'Existing '+tag+' formatting remains within the completed link');
      reset();$('#source').value=source;$('#source').dispatchEvent(new Event('input',{bubbles:true}));
      check(!!paper.querySelector('a[href="https://example.com/guide"] '+tag),'Source-to-Write renders linked '+tag+' text');
    }
    reset('<p><a href="https://example.com/guide"><strong>Hover link</strong></a></p>');
    const hoverTarget=paper.querySelector('a strong');hoverTarget.dispatchEvent(new PointerEvent('pointerover',{bubbles:true}));
    check(!$('#editor-link-tip').hidden&&$('#editor-link-tip').textContent.includes('Double-click to open'),'Hovering formatted link text shows its opening hint');
    hoverTarget.dispatchEvent(new PointerEvent('pointerout',{bubbles:true}));
    check($('#editor-link-tip').hidden,'Link opening hint closes after pointer leaves');
    for(const linkLine of ['1. [**The Fireworks Festival**](#scene-1-the-fireworks-festival)',String.raw`1. [\*\*The Fireworks Festival\*\*]\(#scene-1-the-fireworks-festival)`]){
      reset(renderMarkdown('# Scene 1: The Fireworks Festival\n\n'+linkLine));
      const heading=paper.querySelector('h1'),strong=paper.querySelector('li a strong');let jumped=0;
      check(!!heading&&!!strong&&strong.closest('a')?.getAttribute('href')==='#scene-1-the-fireworks-festival','Festival list entry renders a bold clickable heading link');
      const scroll=heading.scrollIntoView;heading.scrollIntoView=()=>jumped++;
      try{const click=new MouseEvent('click',{bubbles:true,cancelable:true});strong.dispatchEvent(click);
        check(click.defaultPrevented,'First click on a heading link stays inside the editor');
        strong.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));
        check(jumped===1,'Double-clicking the bold Festival link jumps to its heading');
      }finally{heading.scrollIntoView=scroll;}
    }
    reset();await type('[[Second]]');check(paper.querySelector('a[data-wiki-link="Second"]')?.textContent==='Second'&&!paper.textContent.includes('[['),'Typing [[Note]] creates a rendered note link immediately');
    check(draft.sourceText.includes('[[Second]]'),'Live wiki links keep their original Markdown destination');
    check(!draft.sourceText.includes('\u200b')&&!draft.html.includes('data-editor-inline-caret'),'Saved Markdown and document snapshots exclude caret helper markup');
    reset();await type('*outer **inner** text*');check(paper.querySelector('em strong,em b,i strong,i b')?.textContent==='inner'&&!draft.sourceText.includes('\u200b'),'Nested inline Markdown retains inner formatting without leaking caret helpers');
    reset();document.execCommand('insertText',false,'**Bulk bold** and [[Second]]');await Promise.resolve();check(!!paper.querySelector('strong,b')&&!!paper.querySelector('a[data-wiki-link]'),'Bulk text input renders all Markdown constructs together');
    reset();const clipboard=new DataTransfer();clipboard.setData('text/plain','**Pasted bold** and [[Second]]');paper.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:clipboard}));await Promise.resolve();check(!!paper.querySelector('strong,b')&&!!paper.querySelector('a[data-wiki-link]'),'Pasted Markdown renders both inline formatting and note links');
    reset('<p><span>[[Sec</span>ond]</p>');await type(']');check(paper.querySelector('a[data-wiki-link="Second"]')?.textContent==='Second','Wiki recognition handles delimiters split across styled text nodes');
    reset();await type('[[folder/Note#Heading|Readable label]]');check(paper.querySelector('a')?.textContent==='Readable label'&&draft.sourceText.includes('[[folder/Note#Heading|Readable label]]'),'Live note links preserve folder, heading and alias');
    reset();await type('\\**literal**');check(!paper.querySelector('strong,b')&&paper.textContent==='\\**literal**','Escaped Markdown delimiters remain literal in Write');
    reset('<pre><code>Example: </code></pre>');const code=paper.querySelector('code');const codeEnd=select(code);codeEnd.collapse(false);await type('**literal** [[Second]]');check(code.textContent==='Example: **literal** [[Second]]'&&!code.querySelector('a,strong,b'),'Code blocks keep Markdown and wiki examples literal');
    reset();await type('# ');check(!!paper.querySelector('h1'),'Heading prefix followed by a space creates a heading');
    reset();await type('- ');check(!!paper.querySelector('ul li'),'Bullet prefix followed by a space creates a list');
    reset();await type('1. ');check(!!paper.querySelector('ol li'),'Number prefix followed by a space creates a list');
    reset();await type('> ');check(!!paper.querySelector('blockquote'),'Quote prefix followed by a space creates a quote');
    reset();await type('**undo test**');check(!!paper.querySelector('strong,b'),'Undo fixture has converted bold syntax');
    document.execCommand('undo');check(!paper.querySelector('strong,b')&&paper.textContent.includes('undo test'),'Undo reverses automatic formatting without losing its text');
    document.execCommand('redo');check(!!paper.querySelector('strong,b'),'Redo restores automatic formatting');
    reset('<p>Selected words stay here.</p>');select(paper.firstChild.firstChild,0,14);selectionTools.update();
    check(!selectionTools.element.hidden&&selectionTools.element.querySelectorAll(':scope > button').length===9,'Selected text shows the compact nine-control Markdown toolbar');
    $('[data-selection-tool="bold"]').click();check(paper.querySelector('b,strong')?.textContent==='Selected words','Floating Bold applies to the remembered selection');
    select(paper.querySelector('b,strong').firstChild);selectionTools.update();$('[data-selection-tool="link"]').click();
    check($('#dialog').open&&$('#link-text').value==='Selected words','Link popup starts with the selected text');
    $('#link-url').value='javascript:alert(1)';$('#selection-link-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    check($('#dialog').open&&!!$('#link-error').textContent,'Link popup rejects executable destinations and retains the selection');
    $('#cancel-link').click();check(window.getSelection().toString()==='Selected words','Cancelling the link popup restores the text selection');
    action('link');$('#link-url').value='https://example.com/guide';$('#selection-link-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    check(paper.querySelector('a[href="https://example.com/guide"]')?.textContent==='Selected words'&&draft.sourceText.includes('https://example.com/guide'),'Link popup inserts the destination at the original selection and serializes it');
    reset('<p>Our note</p>');select(paper.firstChild.firstChild);action('link');$('#link-url').value='[[Second]]';$('#selection-link-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    check(paper.querySelector('a[data-wiki-link="Second"]')?.textContent==='Our note'&&draft.sourceText.includes('[[Second|Our note]]'),'Link popup can create an aliased internal note link');
    for(const [command,selector] of [['underline','u'],['strikeThrough','strike,s,del'],['inline-code','code'],['hiliteColor','span[style],font[style]']]){
      reset('<p>Format me</p>');select(paper.firstChild.firstChild);selectionTools.update();$('[data-selection-tool="'+command+'"]').click();check(!!paper.querySelector(selector),'Floating '+command+' formats the selected text');
      if(command==='underline')check(draft.sourceText.includes('<u>'),'Underline saves as inline HTML');
      if(command==='strikeThrough')check(draft.sourceText.includes('~~Format me~~'),'Strikethrough saves with portable double-tilde Markdown');
    }
    reset('<p>More tools</p>');select(paper.firstChild.firstChild);selectionTools.update();$('[data-selection-tool="more"]').click();check(!$('#selection-more').hidden,'More formatting opens the Markdown extensions menu');
    $('[data-selection-tool="superscript"]').click();check(paper.querySelector('sup')?.textContent==='More tools','Superscript is available in the compact More menu');
    select(paper.querySelector('sup').firstChild);selectionTools.update();setMode('source');selectionTools.update();check(selectionTools.element.hidden,'Source mode hides the floating rich-text toolbar');
    $('#source').value='**literal in source** [[Second]]';$('#source').dispatchEvent(new Event('input',{bubbles:true}));check($('#source').value==='**literal in source** [[Second]]','Source editing retains literal Markdown syntax');
    setMode('write');check(!!paper.querySelector('strong')&&!!paper.querySelector('a[data-wiki-link]'),'Source-to-Write renders bold and note links');
    const recovery={id:'repair-check',html:'<p>Recovered [[Second]]</p>',sourceHtml:'<p>Recovered [[Second]]</p>',sourceText:'Recovered [[Second]]'};
    WikiLinks.repairStored(recovery);check(recovery.html.includes('data-wiki-link')&&recovery.sourceHtml===recovery.html&&recovery.sourceText==='Recovered [[Second]]','Recovery repairs old literal wiki links while preserving source and clean snapshot equality');
    const escaped={html:'<p>[[escaped]] <code>[[code]]</code></p>',sourceText:'\\[[escaped]] `[[code]]`'};WikiLinks.repairStored(escaped);check(!escaped.html.includes('data-wiki-link'),'Recovery preserves deliberately escaped and code wiki examples');
    await invoke('open_web_link',{target:'https://example.com'});let blocked=false;try{await invoke('open_web_link',{target:'file:///C:/bad.exe'});}catch{blocked=true;}check(blocked,'Native web-link command accepts HTTP(S) and rejects executable or file destinations');
  }finally{
    if($('#dialog').open)$('#dialog').close();selectionTools.hide();
    const closing=closeDocument(draft);$('#native-discard,#close-discard')?.click();await closing;
    openFile(files.indexOf(original));setMode(oldMode);
  }
}
