const test=require('node:test'),assert=require('node:assert/strict'),Themes=require('../document-themes.js');
test('three presets resolve all semantic document roles in both modes',()=>{
  assert.equal(Themes.presets.length,3);for(const theme of Themes.presets){assert.ok(Themes.normalize(theme));for(const mode of ['light','dark']){const resolved=Themes.resolve(theme,mode);assert.ok(resolved.body.font);assert.equal(resolved.h2.font,resolved.h1.font);assert.ok(resolved.code.font);assert.ok(resolved.link.color);}}
});
test('heading fonts and colors cascade while body and code stay independent',()=>{
  const theme=structuredClone(Themes.presets[1]);theme.roles.h1.font='Arial';theme.roles.h1.light='#123456';const value=Themes.resolve(theme,'light');assert.equal(value.h2.font,'Arial');assert.equal(value.h2.color,'#123456');assert.equal(value.body.font,'Segoe UI');assert.equal(value.code.font,'Consolas');
});
test('custom themes validate point sizes, colors, names and CSS font inputs',()=>{
  const theme=structuredClone(Themes.presets[0]);theme.roles.body.size=0;assert.equal(Themes.normalize(theme),null);theme.roles.body.size=12;theme.roles.h1.light='url(bad)';assert.equal(Themes.normalize(theme),null);theme.roles.h1.light=null;theme.roles.h1.font='x; color:red';assert.equal(Themes.normalize(theme).roles.h1.font,'Libre Baskerville');assert.equal(Themes.normalize(theme,{id:'../outside',name:'No'}),null);
});
test('export styling resolves light colors and uses the same font and heading cascade',()=>{
  const css=Themes.css(Themes.presets[1],'light','.document-theme-export',{ink:'#28332f',accent:'#35644d'});assert.ok(css.includes('font-family:"Segoe UI"'));assert.ok(css.includes('#234b78'));assert.ok(css.includes('.document-theme-export h2'));assert.ok(!css.includes('#9ac3ff'));
});
test('Classic pairs orange headings and links with navy code in dark mode and reverses the palette for light output',()=>{
  const classic=Themes.presets[0],dark=Themes.resolve(classic,'dark'),light=Themes.resolve(classic,'light');
  assert.equal(dark.h1.color,'#df873a');assert.equal(dark.h2.color,'#c68953');assert.equal(dark.h2.lowerColor,'#ae8a6c');assert.equal(dark.link.color,'#ff9a42');assert.equal(dark.quote.border,'#df873a');assert.equal(dark.code.background,'#0b121e');
  assert.equal(light.h1.color,'#46576c');assert.equal(light.h2.color,'#4c5866');assert.equal(light.h2.lowerColor,'#515861');assert.equal(light.link.color,'#164475');assert.equal(light.quote.border,'#0b121e');assert.equal(light.code.background,'#f8e1cc');
  const output=Themes.css(classic,'light','.document-theme-export');assert.ok(output.includes('background-color:#f8e1cc'));assert.ok(output.includes('border-left-color:#0b121e'));assert.ok(!output.includes('#ff9a42'));
});
test('lower-heading colors persist in custom copies and older styles retain H2 inheritance',()=>{
  const copy=structuredClone(Themes.presets[0]),normalized=Themes.normalize(copy,{id:'custom-headings',name:'Headings'});
  assert.equal(normalized.roles.h2.lowerDark,'#ae8a6c');assert.ok(Themes.css(normalized,'dark').includes(':is(h3,h4,h5,h6){font-family:"Libre Baskerville",Georgia,serif;color:#ae8a6c}'));
  delete copy.roles.h2.lowerLight;delete copy.roles.h2.lowerDark;const legacy=Themes.normalize(copy);assert.equal(Themes.resolve(legacy,'dark').h2.lowerColor,Themes.resolve(legacy,'dark').h2.color);
  copy.roles.h2.lowerDark='url(unsafe)';assert.equal(Themes.normalize(copy),null);
});
test('custom copies retain Classic surface colors and reject unsafe surface values',()=>{
  const copy=structuredClone(Themes.presets[0]),custom=Themes.normalize(copy,{id:'custom-copy',name:'My Classic'});
  assert.equal(custom.roles.code.backgroundDark,'#0b121e');assert.equal(custom.roles.quote.borderDark,'#df873a');
  copy.roles.code.backgroundDark='url(https://example.com/image)';assert.equal(Themes.normalize(copy),null);
});
