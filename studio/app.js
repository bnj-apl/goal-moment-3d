import {VERSION,SOURCE,PRODUCTS,FINISHES,PUBLIC_BASE,validateRecord,encodeRecord,decodeRecord,recordID,recordURL,clipWindow,ndefURI} from './contract.js';
import {MomentViewer} from './viewer.js';
const $=id=>document.getElementById(id),source=$('source'),replay=$('replay');
let selected='c',finish='g',captured=null,record=null,frameCanvas=null,labelCanvas=null,cardCanvas=null,viewer=null,mode='product',busy=false,qrSVG='',shareURL='',toastTimer=0,restoring=false;
const storageKey='moment90-collection-v1',frameCache=new Map();
const state={captureCount:0,generatedCount:0,modelReady:false,recordID:null,frame:null,mode,source:SOURCE.id};
window.__moment90Studio={snapshot:()=>({...state}),version:'1.0'};
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000)}
function errorText(e){return e?.name==='AbortError'?'操作已取消。':e?.message||'操作未完成，请重试。'}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function pad(n){return String(n).padStart(2,'0')}
function stamp(t){return pad(Math.floor(t/60))+':'+pad(Math.floor(t)%60)+'.'+pad(Math.round((t%1)*100)%100)}
function waitEvent(target,event,timeout=30000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(new Error('素材载入超时，请检查网络后重试。')),timeout);const ok=()=>done(),bad=()=>done(new Error('视频暂时无法读取。'));function done(e){clearTimeout(timer);target.removeEventListener(event,ok);target.removeEventListener('error',bad);e?reject(e):resolve()}target.addEventListener(event,ok,{once:true});target.addEventListener('error',bad,{once:true})})}
async function ready(v){if(v.readyState<1)await waitEvent(v,'loadedmetadata');if(!Number.isFinite(v.duration)||v.duration<39.9)throw new Error('比赛片段不完整，暂不能生成绑定记录。')}
async function seek(v,t){await ready(v);v.pause();const target=Math.min(v.duration-.04,Math.max(0,t));if(v.readyState>=2&&Math.abs(v.currentTime-target)<.0001)return;const p=waitEvent(v,'seeked');v.currentTime=target;await p;if(v.readyState<2)await waitEvent(v,'loadeddata')}
async function frameAt(n,v=source){
 if(frameCache.has(n))return frameCache.get(n);
 await seek(v,n/SOURCE.fps);const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);if(!c.width||!c.height)throw new Error('当前画面还未载入。');if(frameCache.size>=8)frameCache.delete(frameCache.keys().next().value);frameCache.set(n,c);return c;
}
function updateTime(){const t=source.currentTime;$('source-time').textContent=stamp(t)}
source.addEventListener('timeupdate',updateTime);source.addEventListener('seeked',updateTime);source.addEventListener('error',()=>$('capture-status').textContent='原片暂时未能载入，请刷新后重试。');
document.querySelectorAll('[data-seek]').forEach(b=>b.onclick=async()=>{try{await seek(source,Number(b.dataset.seek));$('capture-status').textContent='已定位到 '+Number(b.dataset.seek).toFixed(2)+' 秒，可捕捉这一帧。'}catch(e){$('capture-status').textContent=errorText(e)}});
for(const [id,delta] of [['frame-back',-1],['frame-next',1]])$(id).onclick=async()=>{try{await seek(source,Math.round(source.currentTime*25+delta)/25)}catch(e){toast(errorText(e))}};
$('capture').onclick=async()=>{
 if(busy)return;busy=true;$('capture').disabled=true;
 try{
  await ready(source);source.pause();const n=Math.min(999,Math.max(0,Math.round(source.currentTime*25)));const canvas=await frameAt(n);
  captured={n};frameCanvas=canvas;$('capture-image').src=canvas.toDataURL('image/jpeg',.92);$('capture-empty').hidden=true;$('capture-stamp').textContent=(n/25).toFixed(2)+' s';$('frame-number').textContent='FRAME '+String(n).padStart(4,'0');$('generate').disabled=false;$('capture-status').textContent='已捕捉 '+(n/25).toFixed(2)+' 秒的真实画面。';$('generation-status').textContent='画面已准备好，选择喜欢的周边款式。';state.captureCount++;state.frame=n;
  $('flash').classList.remove('flash');void $('flash').offsetWidth;$('flash').classList.add('flash');$('step2').classList.add('active');$('design').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){$('capture-status').textContent=errorText(e)}finally{busy=false;$('capture').disabled=false}
};
document.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>{if(busy)return;selected=b.dataset.product;document.querySelectorAll('[data-product]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b))});if(captured)$('generation-status').textContent='已选 '+PRODUCTS[selected].name+'，点击生成应用到新周边。'});
document.querySelectorAll('[data-finish]').forEach(b=>b.onclick=()=>{if(busy)return;finish=b.dataset.finish;document.querySelectorAll('[data-finish]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b))})});
function makeQR(url){const code=window.qrcode(0,'M');code.addData(url);code.make();return code.createSvgTag({cellSize:4,margin:16,scalable:true})}
function qrCanvas(url){const code=window.qrcode(0,'M');code.addData(url);code.make();const modules=code.getModuleCount(),cell=8,margin=4,c=document.createElement('canvas');c.width=c.height=(modules+margin*2)*cell;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#000';for(let y=0;y<modules;y++)for(let x=0;x<modules;x++)if(code.isDark(y,x))ctx.fillRect((x+margin)*cell,(y+margin)*cell,cell,cell);return c}
async function imageOf(url){const im=new Image();im.src=url;await im.decode();return im}
function cover(ctx,image,x,y,w,h){const ratio=Math.max(w/image.width,h/image.height),iw=image.width*ratio,ih=image.height*ratio;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(image,x+(w-iw)/2,y+(h-ih)/2,iw,ih);ctx.restore()}
async function makeCanvases(r,frame,id,url){
 const qr=makeQR(url),qim=qrCanvas(url),hero=await imageOf(PRODUCTS[r.p].image),gold=FINISHES[r.f].color;
 const c=document.createElement('canvas');c.width=1200;c.height=1680;const ctx=c.getContext('2d');ctx.fillStyle='#0c1520';ctx.fillRect(0,0,c.width,c.height);
 ctx.strokeStyle=gold;ctx.lineWidth=2;ctx.strokeRect(35,35,1130,1610);ctx.fillStyle=gold;ctx.font='24px Arial';ctx.fillText('M O M E N T 9 0',77,98);ctx.textAlign='right';ctx.font='19px Arial';ctx.fillText('THE MOMENT COLLECTION',1120,98);ctx.textAlign='left';
 ctx.fillStyle='#f4f0e8';ctx.font='500 69px "Songti SC",serif';ctx.fillText('这一刻，值得收藏。',75,210);ctx.font='20px Arial';ctx.fillStyle='#a4b1bf';ctx.fillText('MESSI · CAMP NOU · 06 MAY 2015',78,262);
 cover(ctx,frame,75,310,1050,590);ctx.fillStyle='#d8c9b1';ctx.font='19px monospace';ctx.fillText('CAPTURE '+(r.n/25).toFixed(2)+'s / FRAME '+r.n,77,940);ctx.textAlign='right';ctx.fillText('BARCELONA × BAYERN',1123,940);ctx.textAlign='left';
 cover(ctx,hero,75,995,390,475);ctx.fillStyle=gold;ctx.font='20px Arial';ctx.fillText(PRODUCTS[r.p].english,510,1040);ctx.fillStyle='#f1eee5';ctx.font='40px "PingFang SC",sans-serif';ctx.fillText(PRODUCTS[r.p].name,510,1110);ctx.font='20px Arial';ctx.fillStyle='#b1bfcc';ctx.fillText('扫描，回到你的比赛瞬间。',510,1163);ctx.fillStyle='#fff';ctx.fillRect(510,1205,218,218);ctx.drawImage(qim,510,1205,218,218);ctx.font='17px monospace';ctx.fillStyle=gold;ctx.fillText(id,510,1471);
 ctx.fillStyle='#8596a8';ctx.font='18px Arial';ctx.fillText('真实截帧 / 精修三维模板 / 专属回看入口',77,1557);ctx.font='14px Arial';ctx.fillText('数字纪念卡 · 模板人物姿态不等于任意原片帧的自动三维重建',77,1602);
 const label=document.createElement('canvas');label.width=900;label.height=1150;const l=label.getContext('2d');l.fillStyle='#101925';l.fillRect(0,0,900,1150);l.strokeStyle=gold;l.lineWidth=3;l.strokeRect(18,18,864,1114);l.fillStyle=gold;l.font='37px Arial';l.fillText('MOMENT90',48,88);l.font='21px Arial';l.fillText('YOUR MOMENT PASSPORT',48,130);cover(l,frame,48,169,804,452);l.font='23px monospace';l.fillStyle='#e6dfd0';l.fillText((r.n/25).toFixed(2)+'s / FRAME '+r.n,48,671);l.fillStyle='#fff';l.fillRect(48,715,260,260);l.drawImage(qim,48,715,260,260);l.fillStyle=gold;l.font='28px Arial';l.fillText('TOUCH / SCAN',355,790);l.fillStyle='#bac6d1';l.font='24px Arial';l.fillText('RELIVE THE MOMENT',355,837);l.font='18px monospace';l.fillText(id,48,1030);l.font='18px Arial';l.fillText('CAMP NOU · 2015.05.06',48,1080);
 return {card:c,label,qr};
}
function viewerStatus(text,isError=false){$('viewer-status').textContent=text;if(isError){$('model-error-text').textContent=text;$('model-error').hidden=false;$('model-loading').hidden=true}else{$('model-loading').textContent=text}}
function getViewer(){if(!viewer)viewer=new MomentViewer($('viewport'),viewerStatus);return viewer}
async function showMode(next){
 if(!record&&next!=='stadium')return;mode=next;state.mode=next;state.modelReady=false;source.pause();replay.pause();$('model-error').hidden=true;$('model-loading').hidden=true;
 document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===next);b.setAttribute('aria-pressed',String(b.dataset.mode===next))});
 $('result-stage').classList.toggle('is-video',next==='original'||next==='film');$('viewport').hidden=next==='original'||next==='film';replay.hidden=!$('viewport').hidden;document.querySelector('.viewer-buttons').hidden=$('viewport').hidden;$('download-model').disabled=true;$('view-orbit').setAttribute('aria-pressed','false');
 if(next==='original'||next==='film'){
  viewer?.cancel();if(viewer)viewer.visible=false;
  const isOriginal=next==='original';$('viewer-label').textContent=isOriginal?'ORIGINAL MATCH / YOUR MOMENT':'3D CINEMATIC / GENERATED FILM';$('viewer-size').textContent=isOriginal?(record.n/25).toFixed(2)+' s 抓取点':'真人游戏风格';$('viewer-status').textContent=isOriginal?'已绑定抓取点前后片段 · 点击播放':'已有三维风格电影 · 点击播放';$('mode-note').textContent=isOriginal?'从抓取点前 5 秒开始回看；可以拖动播放器查看完整比赛片段。':'沿用 LibTV 已生成的电影化画面，包含进球与独立举手庆祝；与原片非逐帧同步。';
  replay.src=isOriginal?SOURCE.url:'media/cinematic.mp4';replay.load();
  if(isOriginal){try{await seek(replay,clipWindow(record.n).start)}catch(e){toast(errorText(e))}}
  return;
 }
 $('model-loading').hidden=false;const isStadium=next==='stadium';$('viewer-label').textContent=isStadium?'CAMP NOU / TURF & LIGHT V3':'MOMENT90 / '+PRODUCTS[record.p].english;$('viewer-size').textContent=isStadium?'原场馆几何':PRODUCTS[record.p].size;
 $('view-front').textContent=isStadium?'场内':'正面';$('view-back').textContent=isStadium?'看台':'背面铭牌';$('view-reset').textContent=isStadium?'鸟瞰':'复位';
 $('mode-note').textContent=isStadium?'沿用诺坎普草坪光影 V3。场馆几何保持，贴图压缩以方便网页加载；不是 2015 年实测球场。':'可拖动旋转。背面铭牌包含本次截帧、编号和二维码；人物使用已精修的模板姿态。';
 try{const v=getViewer();v.visible=true;v.resize();if(await v.load(record,labelCanvas,isStadium)){$('model-loading').hidden=true;$('download-model').disabled=isStadium;state.modelReady=!isStadium;}}
 catch(e){if(e.name!=='AbortError'){viewerStatus(errorText(e),true);state.modelReady=false}}
}
function storeRecord(r){let list=[];try{list=JSON.parse(localStorage.getItem(storageKey)||'[]');if(!Array.isArray(list))list=[]}catch{}const key=JSON.stringify(r);list=list.filter(x=>JSON.stringify(x)!==key);list.unshift(r);try{localStorage.setItem(storageKey,JSON.stringify(list.slice(0,24)))}catch{toast('浏览器暂不能保存收藏，请保留专属链接。')}renderShelf()}
async function renderShelf(){
 let rows=[];try{rows=JSON.parse(localStorage.getItem(storageKey)||'[]');if(!Array.isArray(rows))rows=[]}catch{}
 const container=$('collection');container.replaceChildren();
 for(const raw of rows.slice(0,24)){
  let r;try{r=validateRecord(raw)}catch{continue}const id=await recordID(r),item=document.createElement('article');item.className='collection-item';
  const im=document.createElement('img');im.src=PRODUCTS[r.p].image;im.alt=PRODUCTS[r.p].name;const info=document.createElement('div'),title=document.createElement('h3');title.textContent=PRODUCTS[r.p].name;const infoText=document.createElement('p');infoText.textContent=(r.n/25).toFixed(2)+' 秒 · '+FINISHES[r.f].name;const serial=document.createElement('p');serial.className='mono';serial.textContent=id;const b=document.createElement('button');b.textContent='打开这件收藏 ↗';b.onclick=()=>restore(r,true);info.append(title,infoText,serial,b);item.append(im,info);container.append(item);
 }
 if(!container.children.length){const p=document.createElement('p');p.className='empty-shelf';p.textContent='第一件收藏品，从上方的一次捕捉开始。';container.append(p)}
}
async function showRecord(r,canvas,scroll=true,initialMode='product'){
 record=validateRecord(r);const id=await recordID(record);shareURL=await recordURL(record,'nfc');const qrURL=await recordURL(record,'qr');
 const made=await makeCanvases(record,canvas,id,qrURL);cardCanvas=made.card;labelCanvas=made.label;qrSVG=made.qr;
 state.recordID=id;state.frame=record.n;state.record=record;$('passport').hidden=false;$('result-title').textContent=PRODUCTS[record.p].name;$('record-id').textContent=id;$('qr-label').textContent=id;$('qr').innerHTML=qrSVG;$('phone-link').href=await recordURL(record,'link');$('step3').classList.add('active');
 const local=new URL(location.href);local.searchParams.set('m',await encodeRecord(record));local.searchParams.delete('entry');history.replaceState({},'',local);storeRecord(record);
 if(scroll)$('passport').scrollIntoView({behavior:'smooth',block:'start'});await showMode(initialMode);
}
$('generate').onclick=async()=>{
 if(!captured||busy)return;busy=true;$('generate').disabled=true;$('capture').disabled=true;$('generation-status').textContent='正在合成纪念卡、铭牌与专属入口…';
 try{const r={v:VERSION,p:selected,n:captured.n,f:finish};await showRecord(r,frameCanvas,true);state.generatedCount++;$('generation-status').textContent=state.modelReady?'纪念卡、三维周边与专属回看入口已生成。':'卡面与入口已生成；三维载入遇到问题，可在下方重试。'}catch(e){$('generation-status').textContent=errorText(e)}finally{busy=false;$('generate').disabled=false;$('capture').disabled=false}
};
async function restore(r,scroll=false){if(restoring||busy)return;restoring=true;try{$('passport').hidden=false;$('viewer-status').textContent='正在恢复这件收藏品的原始画面…';const canvas=await frameAt(r.n);await showRecord(r,canvas,scroll,'original')}catch(e){toast(errorText(e));$('viewer-status').textContent=errorText(e);$('passport').hidden=true;$('capture-status').textContent='恢复未完成：'+errorText(e)+' 可以重新抓取，或刷新链接重试。';document.body.classList.remove('arrival')}finally{restoring=false}}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>showMode(b.dataset.mode));
$('retry-model').onclick=()=>showMode(mode);
for(const [id,name] of [['view-front','front'],['view-back','back'],['view-reset','reset']])$(id).onclick=()=>{viewer?.view(name);$('view-orbit').setAttribute('aria-pressed','false')};
$('view-orbit').onclick=()=>{if(!viewer?.ready)return;viewer.controls.autoRotate=!viewer.controls.autoRotate;$('view-orbit').setAttribute('aria-pressed',String(viewer.controls.autoRotate))};
$('open-stadium').onclick=async()=>{
 if(busy)return;
 if(!record){try{await showRecord({v:VERSION,p:'c',n:451,f:'g'},await frameAt(451),true,'stadium')}catch(e){toast(errorText(e))}}
 else{$('passport').scrollIntoView({behavior:'smooth'});await showMode('stadium')}
};
$('download-card').onclick=()=>{if(cardCanvas)cardCanvas.toBlob(b=>b&&download(b,state.recordID+'-纪念卡.png'),'image/png')};
$('download-model').onclick=async()=>{if(!record)return;const r={...record},id=await recordID(r);$('download-model').disabled=true;toast('正在导出含专属铭牌的三维模型…');try{download(await viewer.export(r),id+'.glb');toast('专属三维模型已导出。')}catch(e){toast(errorText(e))}finally{$('download-model').disabled=mode!=='product'||!viewer?.ready}};
$('download-record').onclick=async()=>{if(!record)return;const info={id:await recordID(record),recipe:record,url:await recordURL(record),nfcURL:shareURL,source:{...SOURCE,url:new URL(SOURCE.url,PUBLIC_BASE).href},captureTime:record.n/25,clip:clipWindow(record.n),model:{preset:PRODUCTS[record.p],method:'curated-pose-template-plus-captured-frame-and-unique-passport',fileIncludesPersonalizedPlaque:true},stadium:'existing-camp-nou-turf-light-v3',physicalNFCTested:false,liveBroadcastConnected:false};download(new Blob([JSON.stringify(info,null,2)],{type:'application/json'}),state.recordID+'-绑定记录.json')};
$('copy-link').onclick=async()=>{if(!shareURL)return;try{await navigator.clipboard.writeText(shareURL);$('share-status').textContent='专属 NFC 链接已复制。';toast('已复制当前收藏品的 NFC 链接。')}catch{$('share-status').textContent=shareURL}};
$('download-qr').onclick=()=>{if(qrSVG)download(new Blob([qrSVG],{type:'image/svg+xml'}),state.recordID+'-二维码.svg')};
$('download-ndef').onclick=()=>{if(shareURL){download(new Blob([ndefURI(shareURL)],{type:'application/octet-stream'}),state.recordID+'.ndef');toast('NDEF 数据已导出，仍需写入实体 NFC 标签。')}};
$('download-label').onclick=()=>{
 if(!record||!qrSVG)return;const w=window.open('','_blank');if(!w){toast('请允许弹出打印标签窗口。');return}w.document.open();w.document.write('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Moment90 专属标签</title><style>body{font:12px sans-serif;color:#111;padding:25px}.label{width:55mm;border:1px dashed #888;padding:5mm;box-sizing:border-box;text-align:center}svg{width:34mm;height:34mm;display:block;margin:3mm auto}small{font:8px monospace;word-break:break-all}button{margin:20px 0;padding:10px 20px}@media print{body{padding:0}button,.hint{display:none}.label{break-inside:avoid}}</style><div class="label"><b>MOMENT90</b>'+qrSVG+'<small>'+state.recordID+'</small><p>轻触 / 扫码 · 重回比赛瞬间</p></div><button onclick="window.print()">打印标签</button><p class="hint">按 100% 原尺寸打印，不要缩放；先扫码验证后再贴到周边上。</p></html>');w.document.close();
};
const film=$('film-dialog');$('film-button').onclick=()=>{source.pause();replay.pause();film.showModal()};$('close-film').onclick=()=>film.close();film.addEventListener('close',()=>film.querySelector('video').pause());
renderShelf();
const query=new URLSearchParams(location.search);if(query.has('m')){try{const r=await decodeRecord(query.get('m'));document.body.classList.add('arrival');document.querySelectorAll('a[href="#studio"]').forEach(a=>a.href='./#studio');await restore(r,false)}catch(e){toast(errorText(e));$('capture-status').textContent='收藏链接无法恢复，请从这段比赛重新抓取。'}}
