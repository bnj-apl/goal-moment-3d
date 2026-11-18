export const VERSION = '1';
export const PUBLIC_BASE = 'https://bnj-apl.github.io/goal-moment-3d/studio/';
export const SOURCE = Object.freeze({id:'messi2015-v1',url:'media/match.mp4',fps:25,frames:1000,title:'梅西 · 诺坎普之夜',match:'巴塞罗那 × 拜仁慕尼黑',date:'2015.05.06'});
export const PRODUCTS = Object.freeze({
  c:{name:'挑射浮雕卡',english:'THE CHIP',image:'assets/chip.jpg',model:'models/chip.glb',size:'100 × 150 mm',note:'参考挑射动作的精修姿态'},
  d:{name:'举手欢呼摆件',english:'THE CELEBRATION',image:'assets/celebration.jpg',model:'models/celebration.glb',size:'280 × 220 mm 底座',note:'独立举手庆祝的设计姿态'},
  g:{name:'黑金典藏卡',english:'OBSIDIAN EDITION',image:'assets/gold.jpg',model:'models/gold.glb',size:'124 × 180 mm',note:'沿用后期球衣的典藏设计'}
});
export const FINISHES = Object.freeze({g:{name:'香槟金',color:'#d5b579'},s:{name:'霜银',color:'#c9d3de'}});
export function validateRecord(value) {
  if (!value || value.v!==VERSION || !Object.hasOwn(PRODUCTS,value.p) || !Object.hasOwn(FINISHES,value.f) || !Number.isInteger(value.n) || value.n<0 || value.n>=SOURCE.frames) throw new Error('收藏记录不完整，请重新抓取瞬间。');
  return {v:VERSION,p:value.p,n:value.n,f:value.f};
}
export function canonical(value) {const r=validateRecord(value);return [r.v,r.p,r.n,r.f].join('.');}
export async function digest(text) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).slice(0,6).map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function encodeRecord(value) {const body=canonical(value);return body+'.'+await digest(SOURCE.id+':'+body);}
export async function decodeRecord(encoded) {
  if(typeof encoded!=='string'||encoded.length>60)throw new Error('收藏链接无效。');
  const a=encoded.split('.');if(a.length!==5||!/^\d{1,3}$/.test(a[2]))throw new Error('收藏链接无效。');
  const r=validateRecord({v:a[0],p:a[1],n:Number(a[2]),f:a[3]});
  if(await encodeRecord(r)!==encoded)throw new Error('收藏链接已损坏，请重新复制完整链接。');
  return r;
}
export async function recordID(r){return 'M90-'+r.p.toUpperCase()+String(r.n).padStart(3,'0')+'-'+(await digest(SOURCE.id+':'+canonical(r))).toUpperCase();}
export async function recordURL(r,entry='qr',base=PUBLIC_BASE){const u=new URL(base);u.searchParams.set('m',await encodeRecord(r));u.searchParams.set('entry',entry);return u.href;}
export function clipWindow(frame){validateRecord({v:VERSION,p:'c',n:frame,f:'g'});return {start:Math.max(0,frame/SOURCE.fps-5),end:Math.min(SOURCE.frames/SOURCE.fps,frame/SOURCE.fps+5)};}
export function ndefURI(url){
  const u=new URL(url);if(u.protocol!=='https:')throw new Error('NFC 入口需要 HTTPS 地址。');
  const payload=new TextEncoder().encode(u.href.slice(8));
  if(payload.length+1>255)throw new Error('链接过长。');
  return new Uint8Array([0xd1,1,payload.length+1,0x55,4,...payload]);
}
