// Installed families are supplied by Rust; imported fonts stay in portable app data.
const FontManager=(()=>{
  let native=null,system=[],custom=[],busy=false;
  const loaded=new Set();
  function populate(){
    const select=$('#font');if(!select)return;
    const current=select.value,selected=Array.from(select.options).find(option=>option.value===current);
    select.replaceChildren();
    const addGroup=(label,names)=>{const group=document.createElement('optgroup');group.label=label;for(const name of [...new Set(names)]){const option=document.createElement('option');option.value=name;option.textContent=name;group.append(option);}select.append(group);};
    addGroup('Editor fonts',['Libre Baskerville','Georgia','Segoe UI','Consolas']);
    if(system.length)addGroup('System fonts',system);
    if(custom.length)addGroup('Custom fonts',custom.map(font=>font.family));
    if(current&&![...select.options].some(option=>option.value===current))addGroup('Document font',[selected?.textContent||current]);
    const option=document.createElement('option');option.value='__custom__';option.textContent='Custom… Load font file';select.append(option);select.value=current||'Libre Baskerville';select.disabled=busy;
    let previous=select.value;const remember=()=>{if(select.value!=='__custom__')previous=select.value;};select.onpointerdown=remember;select.onfocus=remember;select.onkeydown=remember;
    select.onchange=async()=>{
      if(select.value!=='__custom__'){previous=select.value;format('fontName',select.value);return;}
      const file=files[active],range=selection?.cloneRange();select.value=previous;
      try{const font=await importFont();if(!font)return;if(file===files[active]&&range&&$('#paper').contains(range.commonAncestorContainer)){selection=range;format('fontName',font.family);}else toast('Loaded '+font.family+'; select text to apply it');populate();syncFontControls();}
      catch(error){toast('Could not load font: '+String(error));}
    };
  }
  async function load(font,bytes){
    if(loaded.has(font.id))return;
    const face=new FontFace(font.family,bytes,{weight:String(font.weight||400),style:font.style||'normal'});
    await face.load();document.fonts.add(face);loaded.add(font.id);
    if(!custom.some(value=>value.id===font.id))custom.push(font);
    document.dispatchEvent(new Event('viewchange'));
  }
  async function importFont(){
    busy=true;populate();
    try{
      if(native){const font=await native('import_custom_font');if(font)await load(font,await native('read_custom_font',{id:font.id}));return font;}
      return await new Promise((resolve,reject)=>{
        const input=document.createElement('input');input.type='file';input.accept='.ttf,.otf';
        input.oncancel=()=>resolve(null);input.onchange=async()=>{try{const file=input.files[0];if(!file)return resolve(null);if(file.size>32*1024*1024)throw Error('Choose a font smaller than 32 MiB');const font={id:crypto.randomUUID(),family:file.name.replace(/\.(ttf|otf)$/i,''),weight:400,style:'normal'};await load(font,await file.arrayBuffer());resolve(font);}catch(error){reject(error);}};input.click();
      });
    }finally{busy=false;populate();}
  }
  async function connect(invoke){
    native=invoke;const catalog=await invoke('list_fonts');system=catalog.system;
    for(const font of catalog.custom)try{await load(font,await invoke('read_custom_font',{id:font.id}));}catch(error){toast('Custom font unavailable: '+font.family);}
    populate();
  }
  return {populate,connect,importFont,get system(){return system},get custom(){return custom}};
})();
