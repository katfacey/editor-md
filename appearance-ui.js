// Organize existing appearance controls without losing their live bindings.
(function(){
  let tabSettings=WorkspaceLayout.tabs(null);try{tabSettings=WorkspaceLayout.tabs(JSON.parse(localStorage.getItem('editor-md-document-tabs-v1')));}catch{}
  function applyTabs(){document.body.dataset.documentTabShape=tabSettings.shape;document.body.classList.toggle('bold-active-tab',tabSettings.boldActive);}
  function saveTabs(){try{localStorage.setItem('editor-md-document-tabs-v1',JSON.stringify(tabSettings));}catch{}applyTabs();}
  applyTabs();
  const legacyAppearance=appearanceDialog;
  appearanceDialog=function(initial='colors'){
    legacyAppearance();const dialog=$('#dialog'),content=$('#dialog-content');dialog.classList.add('appearance-dialog');
    const intro=content.querySelector('.dialog-intro'),footer=content.querySelector('.dialog-actions'),status=$('#appearance-reset-status');
    const existing={colors:[content.querySelector('.appearance-modes'),content.querySelector('.appearance-preview'),content.querySelector('.field-grid')],interface:[content.querySelector('.interface-settings')],background:[content.querySelector('.mascot-settings')]};
    const categories={colors:'Colors',interface:'Interface',background:'Background',tabs:'Document tabs',styles:'Document styles',workspace:'Workspace'};
    const shell=document.createElement('div');shell.className='appearance-shell';shell.innerHTML='<nav class="settings-categories" role="tablist" aria-label="Appearance categories" aria-orientation="vertical">'+Object.entries(categories).map(([id,name])=>'<button role="tab" id="settings-tab-'+id+'" data-settings-category="'+id+'" aria-controls="settings-panel-'+id+'">'+name+'</button>').join('')+'</nav><div class="settings-pages"></div>';
    for(const [id,name] of Object.entries(categories)){const section=document.createElement('section');section.id='settings-panel-'+id;section.className='settings-page';section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby','settings-tab-'+id);section.hidden=true;section.append(...(existing[id]||[]));shell.querySelector('.settings-pages').append(section);}
    content.replaceChildren(intro,shell,status,footer);intro.textContent='Personalize the workspace and the way your Markdown is displayed.';
    $('#settings-panel-tabs').innerHTML='<p class="settings-intro">Shared by light and dark mode. Only the document you are working on receives the active treatment.</p><label class="settings-check"><input id="bold-active-tab" type="checkbox">Bold the active document tab name</label><label for="document-tab-shape">Tab shape</label><select id="document-tab-shape"><option value="square">Square</option><option value="rounded">Curved</option><option value="angular">Angular</option><option value="pill">Pill</option></select><div class="document-tabs tab-style-preview" aria-label="Document tab preview"><div class="document-tab selected"><button class="document-tab-open"><span>Home.md</span></button><span class="tab-close">×</span></div><div class="document-tab"><button class="document-tab-open"><span>Notes.md</span></button><span class="tab-close">×</span></div></div>';
    function paintTabs(){$('#bold-active-tab').checked=tabSettings.boldActive;$('#document-tab-shape').value=tabSettings.shape;}
    $('#bold-active-tab').onchange=event=>{tabSettings.boldActive=event.target.checked;saveTabs();};$('#document-tab-shape').onchange=event=>{tabSettings.shape=event.target.value;saveTabs();};paintTabs();
    DocumentThemes.mount($('#settings-panel-styles'));
    $('#settings-panel-workspace').innerHTML='<p class="settings-intro">Keep the full ribbon or use a quiet header with the MD logo, document tabs, and an expand chevron. Click the logo to open the vertical command menu.</p><label class="settings-check"><input type="checkbox" id="compact-ribbon-setting">Minimize the ribbon</label><h3>Sidebar panels</h3><p>Drag Files, Outline, Bookmarks, Search, Details, or Footnotes to reorder them or move them between sides. Right-click a panel tab (or press Shift+F10) for position options.</p><button id="reset-panel-layout">Restore default sidebar tabs</button>';
    $('#compact-ribbon-setting').checked=RibbonUI.collapsed;$('#compact-ribbon-setting').onchange=event=>RibbonUI.setCollapsed(event.target.checked);$('#reset-panel-layout').onclick=()=>{SidebarDock.reset();status.textContent='Sidebar tabs restored: Files, Outline, Bookmarks and Search on the left; Details and Footnotes on the right.';};
    let category='colors';
    const categoryHint=()=>status.textContent='Changes are saved automatically. Restore defaults affects '+categories[category]+' only.';
    shell.addEventListener('input',categoryHint);shell.addEventListener('change',categoryHint);shell.addEventListener('click',event=>{if(['reset-ui-zoom','reset-ui-text','ui-text-smaller','ui-text-larger'].includes(event.target.closest('button')?.id))categoryHint();});
    function select(id){category=categories[id]?id:'colors';$$('[data-settings-category]').forEach(button=>{const selected=button.dataset.settingsCategory===category;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});$$('.settings-page').forEach(section=>section.hidden=section.id!=='settings-panel-'+category);status.textContent='Changes are saved automatically. Restore defaults affects this category only.';}
    $$('[data-settings-category]').forEach(button=>{button.onclick=()=>select(button.dataset.settingsCategory);button.onkeydown=event=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();const ids=Object.keys(categories),index=ids.indexOf(category),id=event.key==='Home'?ids[0]:event.key==='End'?ids.at(-1):ids[(index+(event.key==='ArrowDown'?1:ids.length-1))%ids.length];select(id);$('#settings-tab-'+id).focus();};});
    $('#reset-appearance').onclick=()=>{
      if(category==='colors'){const mode=$('[data-edit-mode].selected').dataset.editMode;appearance[mode]=structuredClone(appearanceDefaults[mode]);$('#main-color').value=appearance[mode].main;$('#main-color').dispatchEvent(new Event('input'));}
      if(category==='interface'){setInterfaceZoom(100);setInterfaceTextSize(13);}
      if(category==='background'){mascotSettings={...mascotDefaults};saveMascotSettings();}
      if(category==='tabs'){tabSettings={...WorkspaceLayout.tabDefaults};saveTabs();paintTabs();}
      if(category==='styles'){DocumentThemes.choose('classic');DocumentThemes.mount($('#settings-panel-styles'));}
      if(category==='workspace'){RibbonUI.setCollapsed(true);SidebarDock.reset();$('#compact-ribbon-setting').checked=true;}
      status.textContent=categories[category]+' defaults restored.'+(category==='interface'?' Your initials are unchanged.':'')+(category==='styles'?' Saved custom styles are kept.':'');
    };
    select(initial);window.AppearanceUI.selectCategory=select;
  };
  $('#appearance').onclick=()=>appearanceDialog();officeActions.appearance=()=>appearanceDialog();officeActions['document-styles']=()=>appearanceDialog('styles');
  $('#dialog').addEventListener('close',()=>$('#dialog').classList.remove('appearance-dialog','markdown-guide-dialog'));
  function markdownGuide(){
    const tick=String.fromCharCode(96),fence=tick.repeat(3);
    const examples=[
      ['Bold','**bold text**','<strong>bold text</strong>'],['Italic','*italic text* or _italic text_','<em>italic text</em>'],['Bold + italic','***both together***','<strong><em>both together</em></strong>'],['Strikethrough','~~removed text~~','<s>removed text</s>'],['Inline code',tick+'let x = 1'+tick,'<code>let x = 1</code>'],
      ['Headings','# Heading 1\n## Heading 2\n### Heading 3','<h2>Heading 1</h2><h3>Heading 2</h3><strong>Heading 3</strong>'],['Quote','> A quoted thought.','<blockquote>A quoted thought.</blockquote>'],['Bullet list','- First item\n- Second item','<ul><li>First item</li><li>Second item</li></ul>'],['Numbered list','1. First item\n2. Second item','<ol><li>First item</li><li>Second item</li></ol>'],['Task list','- [ ] To do\n- [x] Done','☐ To do<br>☑ Done'],
      ['Code block',fence+'rust\nfn main() {}\n'+fence,'<pre><code>fn main() {}</code></pre>'],['Web link','[Example](https://example.com)','<span class="guide-link">Example</span>'],['Note link','[[Note]]\n[[folder/Note#Heading|Label]]','<span class="guide-link">Note</span><br><span class="guide-link">Label</span> · double-click opens its tab'],['Image','![Description](attachments/picture.png)','An image with alternative text'],['Table','| Name | Value |\n| --- | --- |\n| A | 1 |','<table><tr><th>Name</th><th>Value</th></tr><tr><td>A</td><td>1</td></tr></table>'],['Footnote','A note[^1].\n\n[^1]: More detail.','A note<sup>1</sup>.<br><small>1. More detail.</small>'],['Divider','---','<hr>'],['Literal symbols','\\*not italic\\*','*not italic*']
    ];
    openDialog('Markdown formatting guide','<p>In Write or Split, completed inline Markdown renders as you type. Heading, list and quote prefixes convert after a space. Source always shows the literal Markdown.</p><div class="markdown-guide-examples">'+examples.map(([title,source,result])=>'<section><h3>'+title+'</h3><pre><code>'+escapeHtml(source)+'</code></pre><div class="guide-result">'+result+'</div></section>').join('')+'</div><p><strong>Editor extensions:</strong> underline, text color, highlight, subscript, superscript and image sizing use inline HTML. Footnotes, tables, task lists and wiki links need a compatible reader. Use Insert → Graph studio for Mermaid diagrams.</p><p>Document styles only change the app and PDF/HTML appearance. Your Markdown remains portable. This guide does not change the open document.</p><div class="dialog-actions"><button class="primary" id="close-markdown-guide">Done</button></div>');
    $('#dialog').classList.add('markdown-guide-dialog');$('#close-markdown-guide').onclick=()=>$('#dialog').close();
  }
  officeActions['markdown-guide']=markdownGuide;
  officeActions.code=()=>{
    if(mode==='source'){const source=$('#source'),text=source.value.slice(source.selectionStart,source.selectionEnd)||'// Code goes here',fence=String.fromCharCode(96).repeat(Math.max(3,...[...text.matchAll(/`+/g)].map(match=>match[0].length+1)));source.setRangeText('\n'+fence+'\n'+text+'\n'+fence+'\n',source.selectionStart,source.selectionEnd,'end');source.dispatchEvent(new Event('input',{bubbles:true}));return;}
    insert('<pre><code>'+escapeHtml(selection?.toString().replaceAll('\u200b','')||'// Code goes here')+'</code></pre><p><br></p>');
  };
  document.addEventListener('keydown',event=>{if(event.key==='F1'&&!event.ctrlKey&&!event.metaKey&&!$('#dialog').open){event.preventDefault();markdownGuide();}});
  window.AppearanceUI={get tabs(){return {...tabSettings};},setTabs:value=>{tabSettings=WorkspaceLayout.tabs(value);saveTabs();},selectCategory:()=>{}};
})();
