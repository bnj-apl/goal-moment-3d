import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const moments = {
  chip: { name:'射门瞬间', series:'THE CHIP / 立体球星卡', title:'把一脚挑射，定格成一张卡。', description:'人物、足球与看台分层呈现。从正面看一瞬间，从侧面看它的深度。', size:'100 × 150 mm', format:'立体球星卡', caption:'01 / THE CHIP', model:'assets/card-shot.glb', qr:'assets/experience-qr.png', poster:'renders/hero-card.png', real:'media/shot-real.mp4', game:'media/game-moment.mp4', realPoster:'media/real-shot.jpg', gamePoster:'media/game-shot.jpg' },
  celebration: { name:'进球庆祝', series:'THE CELEBRATION / 诺坎普场景摆件', title:'让欢呼，留在自己的球场。', description:'约18厘米梅西与微缩看台组成一座桌面场景。人物采用英雄比例，保留庆祝的姿态与空间层次。', size:'280 × 220 mm 底座', format:'球场 + 球星摆件', caption:'02 / THE CELEBRATION', model:'assets/diorama-celebration.glb', qr:'assets/celebration-qr.png', poster:'renders/hero-diorama.png', real:'media/celebration-real.mp4', game:'media/celebration-game.mp4', realPoster:'media/real-celebration.jpg', gamePoster:'media/game-celebration.jpg' }
};
let selected = new URLSearchParams(location.search).get('moment') === 'celebration' ? 'celebration' : 'chip';
let contract = null, publicURL = null, publicVerified = false, captureURL = null, localVideoURL = null, localVideoName = null, filmReady=false, filmChecking=false;
const diagnostics = { version:'product-experience-01', modelStatus:'poster', modelCount:0, selected, modelLoads:0, modelDisposals:0, captureCount:0, publicVerified:false };
window.__moment90 = { getSnapshot: () => ({...diagnostics, camera:camera?.position.toArray() || null, modelTriangles, renderInfo:renderer?{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}:null, game:gameSnapshot()}) };

function setPoster(src, alt) {
  const img = $('product-poster');
  $('poster-unavailable').hidden = true; img.hidden = false; img.src = src; img.alt = alt;
}
$('product-poster').addEventListener('error', () => { $('product-poster').hidden=true; $('poster-unavailable').hidden=false; });
$('retry-poster').addEventListener('click', () => setPoster(moments[selected].poster+'?reload='+Date.now(), moments[selected].name+'收藏品效果图'));
$('experience-qr').addEventListener('error', () => { $('experience-qr').hidden=true; $('qr-pending').hidden=false; });
document.querySelectorAll('.pair-picture img').forEach(img => img.addEventListener('error', () => {img.hidden=true;}));

function applyMoment(id, updateURL=true) {
  selected = id; diagnostics.selected = id; const m = moments[id];
  releaseLocalVideo();
  $('real-video-title').textContent='真实比赛参考';$('real-video').setAttribute('aria-label','真实比赛参考视频');
  $('replay-description').innerHTML='同一个瞬间，两种观看方式。<br>左侧是比赛影像，右侧是三维游戏渲染。';
  document.querySelectorAll('[data-moment]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.moment===id)));
  [['product-series',m.series],['product-name',m.title],['product-description',m.description],['product-size',m.size],['product-format',m.format],['stage-caption',m.caption],['real-scene-label',m.name],['game-scene-label',m.name]].forEach(([id,text])=>$(id).textContent=text);
  setPoster(m.poster,m.name+'三维收藏品渲染效果');
  for (const kind of ['real','game']) {
    const v=$(kind+'-video');v.pause();v.src=m[kind];v.poster=m[kind+'Poster'];v.load();
    $(kind+'-media-status').classList.remove('is-error');
    $(kind+'-media-status').textContent=kind==='real'?(id==='celebration'?'真实转播节选 · 三段庆祝画面剪辑':'原比赛片段 · 来源信息见页面下方'):(id==='celebration'?'设计庆祝姿态 · 与真实叠抱动作不同':'参考动作复原 · 尚非写实或 4DGS 成片');
  }
  if(updateURL){const url=new URL(location.href);url.searchParams.set('moment',id);history.replaceState({},'',url);}
  refreshShare();
  if (modelRequested) loadModel(); else showPoster();
}
document.querySelectorAll('[data-moment]').forEach(button=>button.addEventListener('click',()=>applyMoment(button.dataset.moment)));
window.addEventListener('popstate',()=>applyMoment(new URLSearchParams(location.search).get('moment')==='celebration'?'celebration':'chip',false));

function releaseLocalVideo(){
  if(localVideoURL){$('real-video').pause();URL.revokeObjectURL(localVideoURL);localVideoURL=null;}
  localVideoName=null;diagnostics.localVideo=null;$('local-video-file').value='';$('restore-reference').hidden=true;
}
$('local-video-file').addEventListener('change',()=>{
  const file=$('local-video-file').files[0];if(!file)return;
  if(file.type&&!file.type.startsWith('video/')){$('real-media-status').textContent='请选择一段可播放的视频。';return;}
  releaseLocalVideo();localVideoURL=URL.createObjectURL(file);localVideoName=file.name;
  const v=$('real-video');v.pause();v.src=localVideoURL;v.removeAttribute('poster');v.setAttribute('aria-label','我的本地视频');v.load();
  $('real-video-title').textContent='我的视频';$('real-scene-label').textContent='本地读取';$('restore-reference').hidden=false;
  $('real-media-status').classList.remove('is-error');$('real-media-status').textContent=file.name+' · 仅在当前浏览器读取，未上传';
  $('replay-description').textContent='左侧是你选择的本地视频，右侧保留精选游戏样片。新的定格参考仍需后续建模，未生成对应的3D收藏品。';
  diagnostics.localVideo={name:file.name,bytes:file.size,storage:'browser-local',uploaded:false};
});
$('restore-reference').addEventListener('click',()=>applyMoment(selected));

for(const kind of ['real','game']){
  const video=$(kind+'-video');
  video.addEventListener('error',()=>{const label=$(kind+'-media-status');label.textContent='这段视频暂时未能读取。请重试，或切换另一个瞬间。';label.classList.add('is-error');});
  video.addEventListener('play',()=>{const other=$(kind==='real'?'game-video':'real-video');other.pause();});
}
async function checkFilmAvailability(){
  if(filmChecking)return;filmChecking=true;
  try{const response=await fetch(contract?.product_film||'media/product-film.mp4',{method:'HEAD',cache:'no-store'});filmReady=response.ok&&Number(response.headers.get('content-length')||0)>1024;diagnostics.productFilm=filmReady?'ready':'pending';}
  catch(error){filmReady=false;diagnostics.productFilm='unavailable';}
  filmChecking=false;$('open-film').disabled=!filmReady;$('open-film').innerHTML=filmReady?'观看产品短片 <span class="play-icon">▶</span>':'产品短片制作中';$('open-film').title=filmReady?'观看产品展示短片':'产品短片正在制作，完成后此处可观看';
}
setInterval(()=>{if(!filmReady&&!document.hidden)checkFilmAvailability();},30000);
function openFilm(kind){
  if(kind==='product'&&!filmReady)return;
  $('real-video').pause();$('game-video').pause();
  $('dialog-title').textContent=kind==='comparison'?'真实影像 × 游戏渲染':'Moment90 产品短片';
  const v=$('dialog-video');v.pause();v.src=kind==='comparison'?(contract?.comparison||'media/comparison.mp4'):(contract?.product_film||'media/product-film.mp4');
  v.poster=kind==='comparison'?'media/game-shot.jpg':'renders/pair.png';
  $('dialog-status').textContent=kind==='comparison'?'真实影像与三维渲染的参考对照，不代表逐像素或完整动作一致。':'从精彩瞬间，到数字收藏品与触碰回放。';
  $('film-dialog').showModal();v.load();
}
$('open-film').addEventListener('click',()=>openFilm('product'));
$('compare-film').addEventListener('click',()=>openFilm('comparison'));
function closeFilm(){ $('dialog-video').pause(); $('film-dialog').close(); }
$('close-dialog').addEventListener('click',closeFilm);
$('film-dialog').addEventListener('cancel',()=>$('dialog-video').pause());
$('film-dialog').addEventListener('close',()=>$('dialog-video').pause());
$('film-dialog').addEventListener('click',event=>{if(event.target===$('film-dialog')){const r=$('film-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeFilm();}});
$('dialog-video').addEventListener('error',()=>{$('dialog-status').textContent='短片暂时未能读取。可以关闭窗口，继续查看产品与瞬间回放。';});

document.querySelectorAll('[data-capture]').forEach(button=>button.addEventListener('click',async()=>{
  const kind=button.dataset.capture,video=$(kind+'-video'),status=$(kind+'-media-status'),capturedMoment=selected;
  const capturedFile=kind==='real'?localVideoName:null,capturedKind=capturedFile?'local':kind,capturedTime=video.currentTime;
  if(video.readyState<2||!video.videoWidth){status.textContent='先播放视频或拖到目标画面，再点击“定格这一帧”。';video.load();return;}
  video.pause();
  const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
  try {
    canvas.getContext('2d').drawImage(video,0,0);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('frame export unavailable')),'image/png'));
    if(captureURL)URL.revokeObjectURL(captureURL);captureURL=URL.createObjectURL(blob);
    $('capture-preview').src=captureURL;$('capture-result').hidden=false;
    const stamp=capturedTime.toFixed(2);
    $('capture-title').textContent=(capturedFile?'我的视频定格':moments[capturedMoment].name)+' · '+stamp+' 秒';
    $('capture-description').textContent=(capturedFile?'本地视频：'+capturedFile:kind==='real'?'真实比赛参考':'3D游戏渲染')+' / '+video.videoWidth+' × '+video.videoHeight+' / 已从当前播放画面截取，可作为下一轮建模参考。';
    $('download-capture').href=captureURL;$('download-capture').download='Moment90-'+(capturedFile?'my-frame':capturedMoment)+'-'+capturedKind+'-'+stamp.replace('.','_')+'s.png';
    status.textContent='定格已保存。可下载 PNG，或回看已精修的精选模型。';status.classList.remove('is-error');
    diagnostics.captureCount++;diagnostics.lastCapture={kind:capturedKind,moment:capturedFile?null:capturedMoment,sourceFile:capturedFile,time:capturedTime,width:canvas.width,height:canvas.height,bytes:blob.size};
    $('capture-result').scrollIntoView({behavior:'smooth',block:'nearest'});
  } catch(error){status.textContent='此视频当前无法导出画面，请换用本地素材后重试。';status.classList.add('is-error');}
}));

function momentURL(entry='share'){
  if(!publicURL)return null;
  const url=new URL(publicURL);url.searchParams.set('moment',selected);url.searchParams.set('entry',entry);return url.href;
}
function refreshShare(){
  const qr=moments[selected].qr; if($('experience-qr').getAttribute('src')!==qr){$('experience-qr').hidden=false;$('qr-pending').hidden=true;$('experience-qr').src=qr;}
  $('copy-link').disabled=!publicVerified;$('open-phone-link').hidden=!publicVerified;
  if(publicVerified){$('share-status').textContent='扫码打开“'+moments[selected].name+'”，或复制当前瞬间链接。';$('open-phone-link').href=momentURL('link');}
  else{$('share-status').textContent='手机入口尚未完成上线验证；当前可先使用本机预览。';}
}
$('copy-link').addEventListener('click',async()=>{
  if(!publicVerified)return;
  const url=momentURL();
  try{await navigator.clipboard.writeText(url);$('share-status').textContent='已复制“'+moments[selected].name+'”的体验链接。';}
  catch(error){$('share-status').textContent='请长按“打开手机入口”复制链接。';}
});
const entry=new URLSearchParams(location.search).get('entry');diagnostics.entry=entry||'direct';
if(['nfc','qr','share','link'].includes(entry)){$('entry-notice').hidden=false;$('entry-notice').textContent='已打开这件收藏品关联的瞬间。选择回放，重新感受这一刻。';}

// A single product asset is kept alive; an interrupted load is disposed before replacement.
let renderer=null,scene=null,camera=null,controls=null,modelGroup=null,environment=null,productVisible=true;
let modelRequested=false,modelGeneration=0,modelAbort=null,modelTriangles=0,frameHandle=null;
const wrap=$('model-wrap'),status=$('model-status');
function disposeObject(root){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)[].concat(object.material).forEach(m=>{materials.add(m);Object.values(m).forEach(value=>{if(value?.isTexture)textures.add(value);});});});
  geometries.forEach(x=>x.dispose());textures.forEach(x=>{x.dispose();if(x.source?.data?.close)x.source.data.close();});materials.forEach(x=>x.dispose());
}
function removeProduct(){if(modelGroup){scene.remove(modelGroup);disposeObject(modelGroup);modelGroup=null;diagnostics.modelDisposals++;}diagnostics.modelCount=0;modelTriangles=0;}
function studioEnvironment(){
  const room=new THREE.Scene();room.background=new THREE.Color(.5,.54,.61);
  const sides=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshBasicMaterial({color:0x929aaa,side:THREE.BackSide}));room.add(sides);
  [[-4,2,0,0,Math.PI/2,0,3.5],[4,1,1,0,-Math.PI/2,0,2],[0,4,0,Math.PI/2,0,0,3]].forEach(v=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(3,4),new THREE.MeshBasicMaterial({color:new THREE.Color().setScalar(v[6]),side:THREE.DoubleSide}));mesh.position.fromArray(v);mesh.rotation.set(v[3],v[4],v[5]);room.add(mesh);});
  const pmrem=new THREE.PMREMGenerator(renderer),result=pmrem.fromScene(room,.03);pmrem.dispose();disposeObject(room);return result;
}
function initialiseViewer(){
  if(renderer)return true;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});}
  catch(error){renderer=null;showModelError('这台设备暂时无法显示三维模型。可先看产品效果图。');return false;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;renderer.setClearColor(0x101b28,0);renderer.domElement.setAttribute('aria-label','可拖动旋转的收藏品三维视图');wrap.appendChild(renderer.domElement);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(37,1,.01,50);camera.position.set(2.1,.8,3.1);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;controls.minDistance=1.2;controls.maxDistance=7;controls.autoRotateSpeed=.7;controls.maxPolarAngle=Math.PI*.88;
  scene.add(new THREE.HemisphereLight(0xddeaff,0x394451,1.8));const key=new THREE.DirectionalLight(0xffedcf,2.5);key.position.set(-3,5,4);scene.add(key);const fill=new THREE.DirectionalLight(0xb7d5ff,1.6);fill.position.set(3,1,-2);scene.add(fill);
  environment=studioEnvironment();scene.environment=environment.texture;
  const resize=()=>{const width=wrap.clientWidth,height=wrap.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(wrap);resize();
  new IntersectionObserver(entries=>{productVisible=entries[0].isIntersecting;},{rootMargin:'100px'}).observe(wrap);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();diagnostics.modelStatus='context-lost';showModelError('三维显示已暂停，请重新载入，或先看效果图。');});
  let priorFrame=performance.now();const draw=now=>{frameHandle=requestAnimationFrame(draw);const delta=Math.min(1,Math.max(0,(now-priorFrame)/1000));priorFrame=now;if(productVisible&&!document.hidden&&diagnostics.modelStatus==='loaded'){controls.update(delta);renderer.render(scene,camera);}};frameHandle=requestAnimationFrame(draw);return true;
}
function fitView(type='angle'){
  if(!camera||!controls)return;
  const ratio=Math.max(1,1/camera.aspect),points={front:[0,.12,3.25],angle:[2.1,1.05,3.15],reset:[2.1,1.05,3.15]};
  camera.position.fromArray(points[type]||points.angle).multiplyScalar(ratio);controls.target.set(0,0,0);controls.update();renderer.render(scene,camera);
}
function enableViewButtons(on){['view-front','view-angle','view-reset','auto-rotate','view-fullscreen'].forEach(id=>$(id).disabled=!on);}
function showModelError(message){
  diagnostics.modelStatus='error';status.hidden=false;status.textContent=message;$('model-recovery').hidden=false;$('model-overlay').hidden=true;enableViewButtons(false);wrap.classList.remove('model-active');if(renderer)renderer.domElement.hidden=true;
}
function showPoster(){
  modelGeneration++;modelAbort?.abort();removeProduct();modelRequested=false;diagnostics.modelStatus='poster';wrap.classList.remove('model-active');if(renderer)renderer.domElement.hidden=true;
  status.hidden=true;$('model-recovery').hidden=true;$('model-overlay').hidden=false;enableViewButtons(false);
}
async function loadModel(){
  modelRequested=true;delete diagnostics.modelError;const generation=++modelGeneration;modelAbort?.abort();modelAbort=new AbortController();removeProduct();
  $('model-overlay').hidden=true;$('model-recovery').hidden=true;status.hidden=false;status.textContent='正在载入收藏品…';diagnostics.modelStatus='loading';enableViewButtons(false);
  if(!initialiseViewer())return;
  renderer.domElement.hidden=true;wrap.classList.remove('model-active');
  try{
    const response=await fetch(moments[selected].model,{signal:modelAbort.signal});
    if(!response.ok)throw new Error('model HTTP '+response.status);
    const total=Number(response.headers.get('content-length')||0),reader=response.body?.getReader();let buffer;
    if(reader){const chunks=[];let loaded=0;while(true){const part=await reader.read();if(part.done)break;chunks.push(part.value);loaded+=part.value.length;if(generation!==modelGeneration)return;status.textContent=total?'正在载入收藏品… '+Math.min(99,Math.round(loaded/total*100))+'%':'正在载入收藏品… '+(loaded/1048576).toFixed(1)+' MB';}const merged=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.length;}buffer=merged.buffer;}else buffer=await response.arrayBuffer();
    if(generation!==modelGeneration)return;
    status.textContent='正在展开三维细节…';
    const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;const resolved=new URL(url,location.href);if(resolved.origin!==location.origin)throw new Error('External texture resource not permitted');return url;});
    const gltf=await new Promise((resolve,reject)=>new GLTFLoader(manager).parse(buffer,new URL('.',location.href).href,resolve,reject));
    if(generation!==modelGeneration){disposeObject(gltf.scene);return;}
    const model=gltf.scene,box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),longest=Math.max(size.x,size.y,size.z);
    if(!Number.isFinite(longest)||longest<=0){disposeObject(model);throw new Error('Invalid product bounds');}
    modelGroup=new THREE.Group();model.position.sub(center);modelGroup.add(model);modelGroup.scale.setScalar(1.85/longest);scene.add(modelGroup);
    model.traverse(object=>{if(object.isMesh){const g=object.geometry;modelTriangles+=(g.index?g.index.count:g.attributes.position.count)/3;}});
    diagnostics.modelStatus='loaded';diagnostics.modelCount=1;diagnostics.modelLoads++;diagnostics.modelBounds=size.toArray();diagnostics.modelPath=moments[selected].model;diagnostics.threeRevision=THREE.REVISION;
    renderer.domElement.hidden=false;wrap.classList.add('model-active');status.textContent='已载入 · 拖动旋转 / 双指缩放';enableViewButtons(true);controls.autoRotate=false;$('auto-rotate').setAttribute('aria-pressed','false');fitView('angle');
  }catch(error){if(error.name==='AbortError'||generation!==modelGeneration)return;showModelError('收藏品暂时未能载入。可以重试，或先看效果图。');diagnostics.modelError=String(error);}
}
$('load-model').addEventListener('click',loadModel);$('retry-model').addEventListener('click',loadModel);$('show-poster').addEventListener('click',showPoster);
$('view-front').addEventListener('click',()=>fitView('front'));$('view-angle').addEventListener('click',()=>fitView('angle'));$('view-reset').addEventListener('click',()=>{controls.autoRotate=false;$('auto-rotate').setAttribute('aria-pressed','false');fitView('reset');});
$('auto-rotate').addEventListener('click',()=>{controls.autoRotate=!controls.autoRotate;$('auto-rotate').setAttribute('aria-pressed',String(controls.autoRotate));});
const viewerDialog=$('viewer-dialog'),viewerStage=$('product-stage'),viewerHome=document.createComment('Product viewer home');
viewerStage.before(viewerHome);let viewerScrollStyle='';
function restoreViewer(){
  if(!viewerStage.classList.contains('viewer-expanded'))return;
  viewerHome.after(viewerStage);viewerStage.classList.remove('viewer-expanded');$('view-fullscreen').textContent='放大查看 ↗';document.body.style.overflow=viewerScrollStyle;
  requestAnimationFrame(()=>{if(diagnostics.modelStatus==='loaded')fitView('angle');});
}
$('view-fullscreen').addEventListener('click',()=>{
  if(viewerDialog.open){viewerDialog.close();restoreViewer();return;}
  viewerScrollStyle=document.body.style.overflow;document.body.style.overflow='hidden';viewerDialog.appendChild(viewerStage);viewerStage.classList.add('viewer-expanded');$('view-fullscreen').textContent='退出放大 ↙';viewerDialog.showModal();
  requestAnimationFrame(()=>{if(diagnostics.modelStatus==='loaded')fitView('angle');});
});
viewerDialog.addEventListener('close',restoreViewer);

// A small, parameter-driven 3D shooting exercise. All outcomes are computed from the ball path.
let game=null,gameVisible=true;
const gameParams=()=>({aim:Number($('aim-x').value),height:Number($('aim-height').value),power:Number($('power').value)});
function gameSnapshot(){return game?{ready:true,phase:game.phase,shots:game.shots,goals:game.goals,result:game.result,params:gameParams(),ball:game.ball.position.toArray(),lastCrossing:game.lastCrossing}: {ready:false};}
function launchVelocity(params){
  const nominalTime=12/14;
  return new THREE.Vector3(params.aim/nominalTime,(params.height-.11+4.905*nominalTime*nominalTime)/nominalTime,-(5+params.power*.16));
}
function simulateStep(pos,vel,dt){
  vel.y-=9.81*dt;vel.multiplyScalar(Math.exp(-.025*dt));pos.addScaledVector(vel,dt);
  if(pos.y<.11){pos.y=.11;if(vel.y<-.6)vel.y=-vel.y*.35;else vel.y=0;const speed=Math.hypot(vel.x,vel.z);if(speed>0){const factor=Math.max(0,1-5.5*dt/speed);vel.x*=factor;vel.z*=factor;}}
}
function updateInputLabels(){
  const p=gameParams();$('aim-x-label').textContent=Math.abs(p.aim)<.05?'正中':(p.aim<0?'左 ':'右 ')+Math.abs(p.aim).toFixed(1)+' m';$('aim-height-label').textContent=p.height.toFixed(1)+' m';$('power-label').textContent=p.power+'%';if(game&&game.phase!=='flying')previewShot();
}
function previewShot(){
  const pos=new THREE.Vector3(0,.11,12),vel=launchVelocity(gameParams()),points=[pos.clone()];for(let i=0;i<270;i++){simulateStep(pos,vel,1/90);if(i%6===0)points.push(pos.clone());if(pos.z<-1.5||pos.y===.11&&vel.length()<.3)break;}
  game.trajectory.geometry.dispose();game.trajectory.geometry=new THREE.BufferGeometry().setFromPoints(points);game.trajectory.computeLineDistances();game.trajectory.visible=true;
  if(game.phase==='ready'){$('game-result').hidden=false;$('game-result').dataset.result='ready';$('game-result').textContent='调整球路，再按“射门”。也可拖动球门附近的落点。';}
}
function addLine(scene,points,color=0xcbd5cd,opacity=.65){
  const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const object=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity}));scene.add(object);return object;
}
function makeBall(){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#f2f1e9';c.fillRect(0,0,512,256);c.fillStyle='#182633';c.strokeStyle='#8b9694';c.lineWidth=1;
  for(let row=0;row<3;row++)for(let col=0;col<6;col++){const x=col*86+(row%2?43:0),y=43+row*85;c.beginPath();for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;const px=x+23*Math.cos(a),py=y+23*Math.sin(a);i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.fill();c.stroke();}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return new THREE.Mesh(new THREE.SphereGeometry(.11,28,18),new THREE.MeshStandardMaterial({map:texture,roughness:.65}));
}
function initialiseGame(){
  if(game)return;
  const container=$('game-wrap');let render;
  try{render=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});}catch(error){$('game-start').hidden=true;$('game-error').hidden=false;return;}
  render.setPixelRatio(Math.min(devicePixelRatio||1,1.5));render.outputColorSpace=THREE.SRGBColorSpace;render.toneMapping=THREE.ACESFilmicToneMapping;render.toneMappingExposure=1.1;render.setClearColor(0x12252c);container.appendChild(render.domElement);render.domElement.setAttribute('aria-label','射门互动球场，可拖动调整方向');
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x12252c,28,70);const camera=new THREE.PerspectiveCamera(43,1,.1,100);camera.position.set(9,7,23);camera.lookAt(0,.9,5);
  scene.add(new THREE.HemisphereLight(0xe0edff,0x203e2a,2.5));const light=new THREE.DirectionalLight(0xffe5bd,3);light.position.set(-6,14,9);scene.add(light);
  for(let i=0;i<10;i++){const stripe=new THREE.Mesh(new THREE.PlaneGeometry(36,4),new THREE.MeshStandardMaterial({color:i%2?0x244c38:0x2a5740,roughness:1}));stripe.rotation.x=-Math.PI/2;stripe.position.set(0,0,i*4-14);scene.add(stripe);}
  addLine(scene,[[-18,.013,0],[18,.013,0]]);addLine(scene,[[-10,.013,0],[-10,.013,16.5],[10,.013,16.5],[10,.013,0]]);addLine(scene,[[-5.5,.014,0],[-5.5,.014,5.5],[5.5,.014,5.5],[5.5,.014,0]]);
  const white=new THREE.MeshStandardMaterial({color:0xf4f2e6,roughness:.4});
  function bar(a,b){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),delta=vb.clone().sub(va),mesh=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,delta.length(),12),white);mesh.position.copy(va).add(vb).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());scene.add(mesh);}
  bar([-3.66,0,0],[-3.66,2.44,0]);bar([3.66,0,0],[3.66,2.44,0]);bar([-3.66,2.44,0],[3.66,2.44,0]);
  const netPoints=[];function segment(a,b){netPoints.push(...a,...b);}for(let x=-3.66;x<3.67;x+=.25){segment([x,.04,-1.6],[x,2.44,-1.6]);segment([x,2.44,-1.6],[x,2.44,0]);}for(let y=0;y<2.45;y+=.24){segment([-3.66,y,-1.6],[3.66,y,-1.6]);segment([-3.66,y,0],[-3.66,y,-1.6]);segment([3.66,y,0],[3.66,y,-1.6]);}const netGeo=new THREE.BufferGeometry();netGeo.setAttribute('position',new THREE.Float32BufferAttribute(netPoints,3));scene.add(new THREE.LineSegments(netGeo,new THREE.LineBasicMaterial({color:0x9badab,transparent:true,opacity:.34})));
  const ball=makeBall();ball.position.set(0,.11,12);scene.add(ball);const shadow=new THREE.Mesh(new THREE.CircleGeometry(.22,28),new THREE.MeshBasicMaterial({color:0x07130d,transparent:true,opacity:.45,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.set(0,.015,12);scene.add(shadow);
  const trajectory=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xe2c07c,dashSize:.19,gapSize:.15,transparent:true,opacity:.85}));scene.add(trajectory);
  game={renderer:render,scene,camera,ball,shadow,trajectory,velocity:new THREE.Vector3(),phase:'ready',shots:0,goals:0,result:null,elapsed:0,lastCrossing:null,previous:ball.position.clone()};
  const resize=()=>{const width=container.clientWidth,height=container.clientHeight;render.setSize(width,height,false);camera.aspect=width/height;camera.position.set(width/height<1.35?8:9,width/height<1.35?10:7,width/height<1.35?28:23);camera.lookAt(0,1,5);camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(container);resize();new IntersectionObserver(entries=>{gameVisible=entries[0].isIntersecting;},{rootMargin:'100px'}).observe(container);
  const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),0),hit=new THREE.Vector3();let dragging=false;
  const setAim=event=>{if(game.phase==='flying')return;const rect=render.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);if(ray.ray.intersectPlane(plane,hit)){$('aim-x').value=clamp(hit.x,-5,5).toFixed(1);$('aim-height').value=clamp(hit.y,.3,4.5).toFixed(1);updateInputLabels();}};
  render.domElement.addEventListener('pointerdown',event=>{dragging=true;render.domElement.setPointerCapture(event.pointerId);setAim(event);});render.domElement.addEventListener('pointermove',event=>{if(dragging)setAim(event);});render.domElement.addEventListener('pointerup',()=>dragging=false);render.domElement.addEventListener('pointercancel',()=>dragging=false);
  $('game-start').hidden=true;$('game-score').hidden=false;['aim-x','aim-height','power','shoot','reset-game'].forEach(id=>$(id).disabled=false);previewShot();let last=performance.now();
  const animate=now=>{requestAnimationFrame(animate);let dt=Math.min(.035,(now-last)/1000);last=now;if(document.hidden)return;if(game.phase==='flying'){while(dt>0){const step=Math.min(1/120,dt);stepGame(step);dt-=step;}}if(gameVisible)render.render(scene,camera);};requestAnimationFrame(animate);
}
function finishShot(result,message){
  game.result=result;game.phase='result';if(result==='goal'){game.goals++;$('goal-count').textContent=game.goals;}$('game-result').hidden=false;$('game-result').dataset.result=result;$('game-result').textContent=message+' 调整参数可以再试一次。';
  ['aim-x','aim-height','power','shoot','reset-game'].forEach(id=>$(id).disabled=false);$('shoot').innerHTML='再射一次 <span>↗</span>';
}
function stepGame(dt){
  game.previous.copy(game.ball.position);simulateStep(game.ball.position,game.velocity,dt);game.elapsed+=dt;game.ball.rotation.x+=game.velocity.z*dt/.11;game.ball.rotation.z-=game.velocity.x*dt/.11;game.shadow.position.set(game.ball.position.x,.015,game.ball.position.z);game.shadow.scale.setScalar(1+game.ball.position.y*.12);game.shadow.material.opacity=.45/(1+game.ball.position.y*.2);
  if(game.previous.z>-.11&&game.ball.position.z<=-.11){
    const ratio=(game.previous.z+.11)/(game.previous.z-game.ball.position.z);const crossing=game.previous.clone().lerp(game.ball.position,ratio);game.lastCrossing={x:crossing.x,y:crossing.y,z:crossing.z,time:game.elapsed};
    if(Math.abs(crossing.x)<=3.55&&crossing.y>=.109&&crossing.y<=2.33){finishShot('goal','进球！球完整穿过了门线。');}
    else if(Math.abs(Math.abs(crossing.x)-3.66)<.17&&crossing.y<2.61||Math.abs(crossing.y-2.44)<.17&&Math.abs(crossing.x)<3.83){finishShot('post','击中门框。再调一点方向或弧度。');}
    else if(Math.abs(crossing.x)>3.55){finishShot('wide','球偏出了球门。');}
    else{finishShot('high','球高过了横梁。');}
  }else if(game.elapsed>5||game.ball.position.y<=.111&&game.velocity.length()<.25){finishShot('short','球停在门前，试试增加力度。');}
}
function shoot(){
  if(!game||game.phase==='flying')return;
  game.ball.position.set(0,.11,12);game.ball.rotation.set(0,0,0);game.velocity.copy(launchVelocity(gameParams()));game.phase='flying';game.result=null;game.lastCrossing=null;game.elapsed=0;game.shots++;$('shot-count').textContent=game.shots;
  game.trajectory.visible=false;$('game-result').hidden=true;['aim-x','aim-height','power','shoot'].forEach(id=>$(id).disabled=true);
}
function resetGame(){
  if(!game)return;game.phase='ready';game.result=null;game.lastCrossing=null;game.elapsed=0;game.velocity.set(0,0,0);game.ball.position.set(0,.11,12);game.ball.rotation.set(0,0,0);game.shadow.position.set(0,.015,12);game.shadow.scale.setScalar(1);game.shadow.material.opacity=.45;$('shoot').innerHTML='射门 <span>↗</span>';['aim-x','aim-height','power','shoot'].forEach(id=>$(id).disabled=false);previewShot();
}
$('start-game').addEventListener('click',initialiseGame);$('shoot').addEventListener('click',shoot);$('reset-game').addEventListener('click',resetGame);
['aim-x','aim-height','power'].forEach(id=>$(id).addEventListener('input',()=>{if(game?.phase==='result')resetGame();updateInputLabels();}));
applyMoment(selected,false);updateInputLabels();refreshShare();
if(['nfc','qr'].includes(entry)){requestAnimationFrame(()=>requestAnimationFrame(()=>{document.querySelector('.replay-grid').scrollIntoView({behavior:'instant',block:'start'});diagnostics.arrival='replay';}));}
else diagnostics.arrival='product';
fetch('product-contract.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('contract unavailable');return response.json();}).then(data=>{
  contract=data;
  (data.moments||[]).forEach(m=>{if(moments[m.id]){for(const key of ['model','real','game'])if(m[key])moments[m.id][key]=m[key];if(m.render)moments[m.id].poster=m.render;}});
  const proposed=data.experience?.public_url||data.experience_url;
  if(proposed){try{const url=new URL(proposed);if(['https:','http:'].includes(url.protocol)&&!['localhost','127.0.0.1','::1'].includes(url.hostname)){publicURL=url.href;publicVerified=data.experience?.verified===true;}}catch(error){}}
  diagnostics.publicVerified=publicVerified;if(data.qr_image)moments.chip.qr=data.qr_image;
  refreshShare();checkFilmAvailability();
}).catch(()=>{refreshShare();checkFilmAvailability();});
