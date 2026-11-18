import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeRecord,decodeRecord,recordID,recordURL,ndefURI,clipWindow,validateRecord} from '../contract.js';
const sample={v:'1',p:'c',n:451,f:'g'};
test('a shared URL restores the same moment without device storage',async()=>{
 const url=new URL(await recordURL(sample));
 const restored=await decodeRecord(url.searchParams.get('m'));
 assert.deepEqual(restored,sample);
 assert.equal(await recordID(restored),await recordID(sample));
 for(const entry of ['nfc','qr','link'])assert.deepEqual(await decodeRecord(new URL(await recordURL(sample,entry)).searchParams.get('m')),sample);
});
test('frame, product and finish each change the bound collectible',async()=>{
 const records=[sample,{...sample,n:452},{...sample,p:'d'},{...sample,f:'s'}];
 assert.equal(new Set(await Promise.all(records.map(recordID))).size,4);
});
test('damaged and unsupported links cannot silently open another moment',async()=>{
 const code=await encodeRecord(sample);
 for(const bad of [code.replace('.451.','.452.'),code.replace(/^1/,'2'),code+'.x',code.replace('.c.','.unknown.'),'javascript:alert(1)'])await assert.rejects(()=>decodeRecord(bad));
 for(const n of [-1,1000,4.5,NaN,'451'])assert.throws(()=>validateRecord({...sample,n}));
});
test('NFC export is a single HTTPS URI record containing the exact dedicated URL',async()=>{
 const url=await recordURL(sample,'nfc'),bytes=ndefURI(url);
 assert.deepEqual([...bytes.slice(0,2)],[0xd1,1]);assert.equal(bytes[3],0x55);assert.equal(bytes[4],4);
 assert.equal(bytes[2],bytes.length-4);
 assert.equal('https://'+new TextDecoder().decode(bytes.slice(5)),url);
 assert.ok(bytes.length+5<=144,'Fits a common 144-byte NDEF user memory with TLV overhead');
 assert.throws(()=>ndefURI('http://example.com'));
});
test('replay windows stay inside the actual source at both edges',()=>{
 assert.deepEqual(clipWindow(0),{start:0,end:5});
 assert.deepEqual(clipWindow(451),{start:13.04,end:23.04});
 assert.deepEqual(clipWindow(999),{start:34.96,end:40});
});
