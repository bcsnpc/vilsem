import {it,expect} from 'vitest'
import {PNG} from 'pngjs'
import {inflateSync,crc32} from 'node:zlib'
import {encodePreviewApng} from '../packages/core/src/images/decode.js'
const frame=red=>PNG.sync.write({width:16,height:16,data:Buffer.from(Array.from({length:256},()=>[red,20,30,255]).flat())})
function chunks(png){const out=[];for(let offset=8;offset<png.length;){const size=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8),data=png.subarray(offset+8,offset+8+size);expect(png.readUInt32BE(offset+8+size)).toBe(crc32(Buffer.concat([Buffer.from(type),data])));out.push({type,data});offset+=size+12}return out}
it('encodes bounded complete-frame APNG with valid checksums, timing and frame sequences',()=>{
 const result=chunks(encodePreviewApng([frame(50),frame(200)],{duration:2000}));expect(result.map(c=>c.type)).toEqual(['IHDR','acTL','fcTL','IDAT','fcTL','fdAT','IEND']);expect(result[1].data.readUInt32BE(0)).toBe(2)
 const controls=result.filter(c=>c.type==='fcTL');expect(controls.map(c=>c.data.readUInt32BE(0))).toEqual([0,1]);expect(controls[0].data.readUInt16BE(20)/controls[0].data.readUInt16BE(22)).toBe(1);expect(result[5].data.readUInt32BE(0)).toBe(2)
 expect(inflateSync(result[3].data)).not.toEqual(inflateSync(result[5].data.subarray(4)));expect(PNG.sync.read(encodePreviewApng([frame(50),frame(200)])).data[0]).toBe(50)
})
it('refuses dimensions, duration, frame and byte budgets instead of emitting oversized animation',()=>{
 expect(()=>encodePreviewApng([frame(1)])).toThrow(/2..12/);expect(()=>encodePreviewApng([frame(1),frame(2)],{duration:3001})).toThrow(/budget/);expect(()=>encodePreviewApng([frame(1),frame(2)],{maxBytes:100})).toThrow(/2 MiB/)
 const other=PNG.sync.write({width:8,height:8,data:Buffer.alloc(8*8*4)});expect(()=>encodePreviewApng([frame(1),other])).toThrow(/dimensions/)
})
