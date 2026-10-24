(function(root){
  const roleNames={body:'Body',h1:'Heading 1',h2:'Heading 2',code:'Code blocks',quote:'Quotes',link:'Links'};
  const part=(font,size,light=null,dark=light)=>({font,size,light,dark});
  function desaturate(hex,amount){const rgb=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)),gray=(Math.max(...rgb)+Math.min(...rgb))/2;return '#'+rgb.map(value=>Math.round(value*(1-amount)+gray*amount).toString(16).padStart(2,'0')).join('');}
  const presets=[
    {id:'classic',name:'Classic',roles:{body:part('Georgia',12,'#253244','#e6edf7'),h1:part('Libre Baskerville',30,'#46576c','#df873a'),h2:{...part('',21,desaturate('#46576c',.3),desaturate('#df873a',.3)),lowerLight:desaturate('#46576c',.6),lowerDark:desaturate('#df873a',.6)},code:{...part('Consolas',10,'#0b121e','#e6edf7'),backgroundLight:'#f8e1cc',backgroundDark:'#0b121e'},quote:{...part('Libre Baskerville',12,'#46576c','#cbd5e1'),borderLight:'#0b121e',borderDark:'#df873a',backgroundLight:'#fff3e8',backgroundDark:'#151e2a'},link:part('',12,'#164475','#ff9a42')}},
    {id:'studio',name:'Studio',roles:{body:part('Segoe UI',11.5),h1:part('Segoe UI',30,'#234b78','#9ac3ff'),h2:part('',20),code:part('Consolas',10),quote:part('',11.5,'#475569','#bac8da'),link:part('',11.5,'#1c5da6','#a5caff')}},
    {id:'manuscript',name:'Manuscript',roles:{body:part('Georgia',12),h1:part('Georgia',30,'#783c4c','#edafbf'),h2:part('',21),code:part('Consolas',10),quote:part('',12,'#705542','#d9bda9'),link:part('',12,'#82344e','#f0b3c7')}}
  ];
  function normalize(value,{id=value?.id,name=value?.name}={}){
    if(typeof id!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(id)||typeof name!=='string'||!name.trim()||name.length>60)return null;
    const roles={};for(const role of Object.keys(roleNames)){
      const v=value?.roles?.[role],fallback=presets[0].roles[role];if(!v)return null;
      const font=typeof v.font==='string'&&v.font.length<=120&&!/[\x00-\x1f;{}<>\\"]/.test(v.font)?v.font:fallback.font;
      const size=Number(v.size);if(!Number.isFinite(size)||size<6||size>96)return null;
      if([v.light,v.dark].some(color=>color!==null&&!/^#[0-9a-f]{6}$/i.test(color||'')))return null;
      roles[role]={font:role==='body'&&!font?fallback.font:font,size,light:v.light,dark:v.dark};
      const surfaces=role==='code'?['backgroundLight','backgroundDark']:role==='quote'?['backgroundLight','backgroundDark','borderLight','borderDark']:role==='h2'?['lowerLight','lowerDark']:[];
      for(const key of surfaces){const color=v[key]??null;if(color!==null&&!/^#[0-9a-f]{6}$/i.test(color))return null;roles[role][key]=color;}
    }
    return {id,name:name.trim(),roles};
  }
  function resolve(theme,mode='light',{ink='var(--ink)',accent='var(--green)'}={}){
    const result={};for(const role of Object.keys(roleNames)){
      const parent=role==='h2'?result.h1:role==='link'?result.body:result.body;
      const p=theme.roles[role],suffix=mode==='dark'?'Dark':'Light';result[role]={font:p.font||parent?.font||'Georgia',size:p.size,color:p[mode]||(role==='link'?accent:parent?.color||ink),background:p['background'+suffix]||null,border:p['border'+suffix]||null};
      if(role==='h2')result[role].lowerColor=p['lower'+suffix]||result[role].color;
    }return result;
  }
  function css(theme,mode,selector=':is(#paper,#print-document)',colors){
    const roles=resolve(theme,mode,colors),font=role=>JSON.stringify(roles[role].font)+(role==='code'?',monospace':',Georgia,serif');
    const surface=role=>(roles[role].background?';background-color:'+roles[role].background:'')+(roles[role].border?';border-left-color:'+roles[role].border:'');
    return `${selector}{font-family:${font('body')};font-size:${roles.body.size}pt;color:${roles.body.color}}${selector} h1{font-family:${font('h1')};font-size:${roles.h1.size}pt;color:${roles.h1.color}}${selector} h2{font-family:${font('h2')};font-size:${roles.h2.size}pt;color:${roles.h2.color}}${selector} :is(h3,h4,h5,h6){font-family:${font('h2')};color:${roles.h2.lowerColor}}${selector} pre,${selector} code{font-family:${font('code')};font-size:${roles.code.size}pt;color:${roles.code.color}${surface('code')}}${selector} blockquote{font-family:${font('quote')};font-size:${roles.quote.size}pt;color:${roles.quote.color}${surface('quote')}}${selector} a{color:${roles.link.color}}`;
  }
  let selected='classic',custom=[];
  const catalog=()=>[...presets,...custom],current=()=>catalog().find(theme=>theme.id===selected)||presets[0];
  function read(){try{const stored=JSON.parse(localStorage.getItem('editor-md-document-themes-v1'));custom=Array.isArray(stored?.custom)?stored.custom.slice(0,50).map(theme=>normalize(theme)).filter(theme=>theme&&!presets.some(p=>p.id===theme.id)):[];selected=catalog().some(theme=>theme.id===stored?.selected)?stored.selected:'classic';}catch{}}
  function persist(){try{localStorage.setItem('editor-md-document-themes-v1',JSON.stringify({selected,custom}));}catch{toast('Could not store the document style. Free some workspace storage and try again.');}}
  function apply(){
    let style=$('#document-theme-rules');if(!style){style=document.createElement('style');style.id='document-theme-rules';document.head.append(style);}
    const theme=current();style.textContent=css(theme,document.body.classList.contains('dark')?'dark':'light')+'@media print{'+css(theme,'light',':is(#paper,#print-document)',{ink:'#28332f',accent:'#35644d'})+'.paper.print-document{color:'+resolve(theme,'light',{ink:'#28332f'}).body.color+'!important}.paper blockquote{color:'+resolve(theme,'light',{ink:'#28332f'}).quote.color+'!important}}';
    document.dispatchEvent(new Event('viewchange'));
  }
  function choose(id){if(!catalog().some(theme=>theme.id===id))return false;selected=id;persist();apply();return true;}
  function saveTheme(value,existingId){
    const id=existingId&&custom.some(theme=>theme.id===existingId)?existingId:'custom-'+crypto.randomUUID();
    const theme=normalize(value,{id,name:value.name});if(!theme)throw Error('Use a name, valid fonts and colors, and sizes from 6 to 96 pt.');
    if(catalog().some(other=>other.id!==id&&other.name.toLowerCase()===theme.name.toLowerCase()))throw Error('Choose a different name; that style name already exists.');
    if(!existingId&&custom.length>=50)throw Error('Up to 50 custom document styles can be saved.');
    const index=custom.findIndex(theme=>theme.id===id);if(index<0&&custom.length>=50)throw Error('Up to 50 custom document styles can be saved.');if(index<0)custom.push(theme);else custom[index]=theme;choose(id);return theme;
  }
  function removeCustom(id){if(!custom.some(theme=>theme.id===id))return false;custom=custom.filter(theme=>theme.id!==id);if(selected===id)selected='classic';persist();apply();return true;}
  function mount(container){
    container.innerHTML='<p class="settings-intro">Document styles control how Markdown looks here and in PDF/HTML. They do not change your .md file. Explicit formatting in a document takes priority.</p><label for="document-theme">Document style</label><select id="document-theme"></select><div class="document-style-sample"><h1>A place for ideas</h1><h2>Make every word count</h2><h3>A smaller detail</h3><p>Body text follows the style you choose. <a href="#">A useful link</a>.</p><blockquote>A little room to think.</blockquote><pre><code>let idea = "something good";</code></pre></div><details id="custom-theme-details"><summary>Customize or create a style</summary><form id="document-theme-form"><label for="document-theme-name">Style name</label><input id="document-theme-name" maxlength="60"><p class="format-note">Heading 2 can inherit Heading 1. H3–H6 inherit the Heading 2 font and can have separate colors. Other fonts inherit Body. Blank colors inherit their parent; links use the app accent.</p><div id="document-theme-fields"></div><p class="validation-error" id="document-theme-error" role="alert"></p><div class="dialog-actions"><button type="button" id="save-theme-copy">Save as new style</button><button class="primary" type="submit" id="save-document-theme">Save custom style</button></div></form></details>';
    const picker=container.querySelector('#document-theme'),sample=container.querySelector('.document-style-sample');let draft;
    function samplePaint(){
      const role=resolve(draft,document.body.classList.contains('dark')?'dark':'light');
      const set=(node,r)=>{node.style.fontFamily=role[r].font;node.style.color=role[r].color;node.style.fontSize=Math.min(r==='h1'?26:r==='h2'?19:15,role[r].size)+'px';};
      set(sample,'body');for(const [selector,r] of [['h1','h1'],['h2','h2'],['blockquote','quote'],['pre','code'],['a','link']])set(sample.querySelector(selector),r);
      const lower=sample.querySelector('h3');lower.style.fontFamily=role.h2.font;lower.style.color=role.h2.lowerColor;lower.style.fontSize='16px';
      for(const [selector,r] of [['blockquote','quote'],['pre','code']]){const node=sample.querySelector(selector);node.style.backgroundColor=role[r].background||'';node.style.borderLeftColor=role[r].border||'';}
    }
    function list(){picker.replaceChildren(...catalog().map(theme=>new Option(theme.name+(presets.includes(theme)?' · built in':''),theme.id)));picker.value=selected;}
    function colorFields(id){
      const fields=[['light','Light color'],['dark','Dark color'],...(id==='h2'?[['lowerLight','H3–H6 light color'],['lowerDark','H3–H6 dark color']]:[])];
      return fields.map(([key,label])=>'<label>'+label+'<div class="theme-color-row"><input data-theme-role="'+id+'" data-theme-property="'+key+'" placeholder="Inherit" aria-label="'+roleNames[id]+' '+label+'" maxlength="7"><input type="color" data-theme-swatch="'+id+'-'+key+'" aria-label="Choose '+roleNames[id]+' '+label+'"></div></label>').join('');
    }
    function load(){
      draft=structuredClone(current());$('#document-theme-name').value=presets.some(theme=>theme.id===draft.id)?draft.name+' custom':draft.name;
      $('#document-theme-fields').innerHTML=Object.entries(roleNames).map(([id,label])=>'<fieldset class="theme-role"><legend>'+label+'</legend><div class="theme-role-grid">'+(id!=='link'?'<label>Font<select data-theme-role="'+id+'" data-theme-property="font"></select></label><label>Size (pt)<input data-theme-role="'+id+'" data-theme-property="size" type="number" min="6" max="96" step="0.5"></label>':'')+colorFields(id)+'</div></fieldset>').join('');
      const fonts=[...new Set(['Georgia','Libre Baskerville','DM Sans','Segoe UI','Consolas',...FontManager.system,...FontManager.custom.map(font=>font.family)])].sort();
      $$('[data-theme-property]').forEach(field=>{const role=field.dataset.themeRole,key=field.dataset.themeProperty;
        if(key==='font'){field.append(new Option(role==='body'?'Georgia':'Inherit '+(role==='h2'?'Heading 1':'Body'),role==='body'?'Georgia':''));for(const name of [...new Set([...fonts,draft.roles[role].font])].filter(Boolean))field.add(new Option(name,name));}
        field.value=draft.roles[role][key]??'';
        field.oninput=()=>{let value=field.value;if(key==='size')value=Number(value);else if(['light','dark','lowerLight','lowerDark'].includes(key))value=value.trim()||null;draft.roles[role][key]=value;if(normalize(draft)){$('#document-theme-error').textContent='';samplePaint();}else $('#document-theme-error').textContent='Use six-digit colors such as #234b78, or leave colors blank to inherit.';};
      });
      $$('[data-theme-swatch]').forEach(field=>{const [role,mode]=field.dataset.themeSwatch.split('-');field.value=draft.roles[role][mode]||'#35644d';field.oninput=()=>{const target=$('[data-theme-role="'+role+'"][data-theme-property="'+mode+'"]');target.value=field.value;target.dispatchEvent(new Event('input'));};});
      $('#save-document-theme').textContent=presets.some(theme=>theme.id===draft.id)?'Save custom style':'Update custom style';samplePaint();
    }
    picker.onchange=()=>{choose(picker.value);load();};sample.querySelector('a').onclick=event=>event.preventDefault();
    const save=copy=>{try{draft.name=$('#document-theme-name').value;saveTheme(draft,copy?null:draft.id);list();load();$('#document-theme-error').textContent='Style saved. Your Markdown files are unchanged.';}catch(error){$('#document-theme-error').textContent=String(error.message||error);}};
    $('#document-theme-form').onsubmit=event=>{event.preventDefault();save(false);};$('#save-theme-copy').onclick=()=>save(true);
    const remove=document.createElement('button');remove.type='button';remove.id='delete-document-theme';remove.textContent='Delete custom style';remove.onclick=()=>{if(removeCustom(selected)){list();load();remove.disabled=true;}};container.querySelector('#document-theme-form').append(remove);
    const refreshRemove=()=>remove.disabled=presets.some(theme=>theme.id===selected);picker.addEventListener('change',refreshRemove);container.querySelector('#document-theme-form').addEventListener('submit',()=>queueMicrotask(refreshRemove));$('#save-theme-copy').addEventListener('click',()=>queueMicrotask(refreshRemove));refreshRemove();
    list();load();
  }
  function install(){read();apply();document.addEventListener('appearancechange',apply);window.addEventListener('storage',event=>{if(event.key==='editor-md-document-themes-v1'){read();apply();}});}
  const api={presets,normalize,resolve,css,install,choose,saveTheme,removeCustom,mount,apply,exportCss:()=>css(current(),'light','.document-theme-export',{ink:'#28332f',accent:'#35644d'}),get current(){return structuredClone(current());},get catalog(){return structuredClone(catalog());},get custom(){return structuredClone(custom);}};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.DocumentThemes=api;
})(globalThis);
