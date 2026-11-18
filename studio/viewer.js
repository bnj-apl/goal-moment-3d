import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {PRODUCTS,FINISHES} from './contract.js';

function dispose(root){const found=new Set();root.traverse(o=>{if(o.geometry)found.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){found.add(m);for(const v of Object.values(m))if(v?.isTexture)found.add(v);}});found.forEach(x=>x.dispose());}
export class MomentViewer {
 constructor(container,status){
  this.container=container;this.status=status;this.sequence=0;this.root=null;this.ready=false;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#141d26');
  this.camera=new THREE.PerspectiveCamera(34,1,.001,3000);
  this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
  this.renderer.domElement.setAttribute('aria-label','可拖动旋转的真实三维模型');container.append(this.renderer.domElement);
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);this.env=pmrem.fromScene(room,.04);this.scene.environment=this.env.texture;room.dispose();pmrem.dispose();this.scene.environmentIntensity=.8;
  this.hemi=new THREE.HemisphereLight(0xfff3e1,0x43526a,1.8);this.scene.add(this.hemi);
  this.key=new THREE.DirectionalLight(0xffead1,3.3);this.key.position.set(4,8,6);this.scene.add(this.key);
  this.fill=new THREE.DirectionalLight(0xc3d6ff,1.5);this.fill.position.set(-4,3,-3);this.scene.add(this.fill);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.08;this.controls.autoRotateSpeed=.7;this.controls.enablePan=false;
  new ResizeObserver(()=>this.resize()).observe(container);this.resize();
  this.visible=true;new IntersectionObserver(entries=>this.visible=entries[0].isIntersecting,{rootMargin:'120px'}).observe(container);
  let previous=0;this.renderer.setAnimationLoop(time=>{const dt=Math.min(.1,(time-previous)/1000);previous=time;if(this.visible&&!document.hidden&&this.ready){this.controls.update(dt);this.renderer.render(this.scene,this.camera)}});
  this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.ready=false;this.status('三维显示暂时中断，请重新载入。',true)});
 }
 resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);if(this.ready)this.view('reset');}
 cancel(){this.sequence++;this.abort?.abort();this.controls.autoRotate=false;}
 clear(){if(this.root){this.scene.remove(this.root);dispose(this.root);this.root=null;}this.ready=false;}
 async load(record,labelCanvas,isStadium=false){
  const n=++this.sequence;this.abort?.abort();this.abort=new AbortController();this.clear();this.stadium=isStadium;this.record=record;
  const url=isStadium?'models/stadium-v3.glb':PRODUCTS[record.p].model;
  this.status(isStadium?'载入诺坎普精细球场…':'载入三维周边…');
  const response=await fetch(url,{signal:this.abort.signal});if(!response.ok)throw new Error('模型读取失败，请重试。');
  const total=Number(response.headers.get('content-length')),reader=response.body.getReader(),chunks=[];let bytes=0;
  while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);bytes+=value.length;if(n!==this.sequence)return false;this.status((isStadium?'球场':'周边')+'载入中 · '+(total?Math.round(bytes/total*100)+'%':(bytes/1048576).toFixed(1)+' MB'));}
  const array=new Uint8Array(bytes);let offset=0;for(const c of chunks){array.set(c,offset);offset+=c.length}
  this.status('正在展开材质与几何…');const gltf=await new GLTFLoader().parseAsync(array.buffer,'');
  if(n!==this.sequence){dispose(gltf.scene);return false;}
  const asset=gltf.scene;asset.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(asset),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!isStadium){
   const labelTexture=new THREE.CanvasTexture(labelCanvas);labelTexture.colorSpace=THREE.SRGBColorSpace;labelTexture.anisotropy=this.renderer.capabilities.getMaxAnisotropy();
   const labelMat=new THREE.MeshStandardMaterial({map:labelTexture,roughness:.65,metalness:.05});
   const w=record.p==='d'?size.x*.42:size.x*.78,h=record.p==='d'?size.z*.65:size.y*.72;
   const plaque=new THREE.Mesh(new THREE.PlaneGeometry(w,h),labelMat);plaque.name='Moment90 personal frame and NFC passport';
   if(record.p==='d'){plaque.rotation.x=Math.PI/2;plaque.position.set(center.x,box.min.y-.00015,center.z)}else{plaque.rotation.y=Math.PI;plaque.position.set(center.x,center.y,box.min.z-.00015)}
   asset.add(plaque);
   if(record.f==='s')asset.traverse(o=>{if(o.isMesh){for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m&&/gold|champagne|foil|trim/i.test(m.name)){m.color.set('#bdcbdc');m.metalness=Math.max(m.metalness,.55);}}});
  }
  const root=new THREE.Group();root.name=isStadium?'Camp Nou V3':'Moment90 custom collectible';
  asset.position.sub(center);root.add(asset);if(!isStadium)root.scale.setScalar(2/Math.max(size.x,size.y,size.z));
  root.userData={assetVersion:'moment90-20261118-v1',sourceKind:isStadium?'existing-camp-nou-v3':'curated-pose-template-with-captured-frame',record:record||null};
  asset.userData={...asset.userData,...root.userData,unit:'metre'};
  this.root=root;this.scene.add(root);root.updateMatrixWorld(true);this.figureBox=new THREE.Box3();if(!isStadium)root.traverse(o=>{if(o.isMesh&&/card-player|diorama-player|Relief_Messi|Relief Messi/i.test(o.name))this.figureBox.expandByObject(o)});this.exportAsset=asset;this.modelSize=size;this.modelCenter=center;this.ready=true;this.controls.autoRotate=false;this.controls.enablePan=isStadium;
  this.camera.fov=isStadium?60:34;
  this.scene.background.set(isStadium?'#94aec5':'#141d26');this.scene.environmentIntensity=isStadium ? .38 : .6;this.hemi.intensity=isStadium?2.2:.65;this.key.intensity=isStadium?3:2;this.fill.intensity=isStadium ? .55 : .7;
  this.view(isStadium?'front':'reset');this.status(isStadium?'诺坎普 V3 已载入 · 拖动查看':'周边已合成 · 拖动旋转 / 双指缩放');return true;
 }
 view(kind){
  if(!this.root)return;this.controls.autoRotate=false;this.camera.up.set(0,1,0);
  if(this.stadium){
   // Use the authored V3 viewpoints, translated by the same centre as the model.
   const views={front:[[48,16,28],[0,8,-8]],back:[[2,24,-34],[0,17,-75]],detail:[[10,.65,9],[0,.12,0]],reset:[[300,270,330],[0,20,0]]};
   const [p,t]=views[kind]||views.reset;
   this.camera.position.fromArray(p).sub(this.modelCenter);this.controls.target.fromArray(t).sub(this.modelCenter);
   this.controls.minDistance=1;this.controls.maxDistance=900;this.camera.near=.1;this.camera.far=2000;
  }else{
   const r=Math.max(1,1/this.camera.aspect),views={front:[0,.05,4.2*r],back:[0,.05,-4.2*r],reset:[2.3*r,1.25*r,4*r]};
   if(kind==='back'&&this.record.p==='d'){this.camera.position.set(0,-4.6*r,.06);this.camera.up.set(0,0,1)}else this.camera.position.fromArray(views[kind]||views.reset);
   this.controls.target.set(0,0,0);this.controls.minDistance=.4;this.controls.maxDistance=10;this.camera.near=.05;this.camera.far=50;
   if(kind==='detail'&&!this.figureBox.isEmpty()){
    const c=this.figureBox.getCenter(new THREE.Vector3()),s=this.figureBox.getSize(new THREE.Vector3()),distance=Math.max(s.y,s.x/this.camera.aspect)/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2)))*1.12+s.z*.5;
    this.controls.target.copy(c);this.camera.position.copy(c).add(new THREE.Vector3(.12,0,1).normalize().multiplyScalar(distance));
   }
  }
  this.camera.updateProjectionMatrix();this.controls.update();this.renderer.render(this.scene,this.camera);
 }
 async export(record){
  if(!this.ready||this.stadium||JSON.stringify(record)!==JSON.stringify(this.record))throw new Error('请先载入这件三维周边。');
  const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
  // Export the authored metre-scale mesh, not the viewer's presentation scaling.
  const out=await new GLTFExporter().parseAsync(this.exportAsset,{binary:true,onlyVisible:true,maxTextureSize:2048});
  return new Blob([out],{type:'model/gltf-binary'});
 }
}
