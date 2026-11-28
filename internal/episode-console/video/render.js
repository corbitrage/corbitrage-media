const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:540,height:960},deviceScaleFactor:2});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/scene.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(500);
const mode=process.argv[2];
if(mode==='stills'){for(const t of [3,10,14,21,32]){await p.evaluate(t=>render(t),t);await p.screenshot({path:`still_${t}.png`})}}
else{const fps=24,N=Math.round(36.1*fps);const fs=require('fs');fs.mkdirSync('frames',{recursive:true});
 for(let i=0;i<N;i++){await p.evaluate(t=>render(t),i/fps);await p.screenshot({path:`frames/f${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:92})}}
console.log('errors:',errs.length?errs:'none');await b.close()})();
