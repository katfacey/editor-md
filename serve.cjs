const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const port=Number(process.env.EDITOR_MD_PORT||4173);
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.md':'text/plain'};
http.createServer((req,res)=>{let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end();return}if(name==='/')name='/compare.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Not found');return}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data)})}).listen(port,'127.0.0.1',()=>console.log('Editor, MD preview: http://127.0.0.1:'+port));
