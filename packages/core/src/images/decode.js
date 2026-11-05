import {PNG} from 'pngjs'
import jpeg from 'jpeg-js'
const MAX_BYTES=8388608,MAX_PIXELS=4000000
/** Decode supplied bytes only. No path/URL lookup, EXIF orientation, SVG, or network. */
export function decodeDesignImage(bytes){
 const input=Buffer.from(bytes)
 if(!input.length||input.length>MAX_BYTES)throw Error('Reference image must be PNG/JPEG up to8 MiB')
 if(input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
  if(input.length<33)throw Error('Truncated PNG')
  const width=input.readUInt32BE(16),height=input.readUInt32BE(20)
  if(width<8||height<8||width*height>MAX_PIXELS)throw Error('PNG dimensions exceed8..4000000 pixels')
  return PNG.sync.read(input,{checkCRC:true})
 }
 if(input[0]===255&&input[1]===216)return jpeg.decode(input,{useTArray:true,tolerantDecoding:false,maxResolutionInMP:4,maxMemoryUsageInMB:96})
 throw Error('Unsupported reference image; supply PNG or JPEG (SVG and remote URLs are not loaded)')
}

// Complete-frame APNG packaging. No URL/file access; frames are supplied PNGs.
// This encodes discrete states, not invented tweening or browser frame timing.
export function encodePreviewApng(frames,{duration=3000,maxBytes=2097152}={}){
 if(!Array.isArray(frames)||frames.length<2||frames.length>12)throw Error('APNG requires2..12 PNG frames')
 if(!Number.isInteger(duration)||duration<100||duration>3000||!Number.isInteger(maxBytes)||maxBytes<100||maxBytes>2097152)throw Error('APNG duration/byte budget exceeded')
 const crc=buffer=>{let value=0xffffffff;for(const byte of buffer){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0)}return(value^0xffffffff)>>>0}
 const chunk=(type,data)=>{const kind=Buffer.from(type),size=Buffer.alloc(4),checksum=Buffer.alloc(4);size.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([kind,data])));return Buffer.concat([size,kind,data,checksum])}
 let width,height,sequence=0,total=0;const parts=[Buffer.from([137,80,78,71,13,10,26,10])]
 const append=part=>{total+=part.length;if(total>maxBytes-8)throw Error('Animated preview exceeds2 MiB; reduce preview size or frames');parts.push(part)}
 frames.forEach((frame,index)=>{
  const decoded=decodeDesignImage(frame);if(index===0){width=decoded.width;height=decoded.height;if(width*height*frames.length>12000000)throw Error('APNG exceeds12000000 decoded pixels')}else if(decoded.width!==width||decoded.height!==height)throw Error('APNG frames must share dimensions')
  const png=PNG.sync.write({width,height,data:decoded.data},{colorType:6,inputColorType:6}),chunks=[]
  for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8),data=png.subarray(offset+8,offset+8+length);chunks.push({type,data});offset+=length+12}
  if(index===0){append(chunk('IHDR',chunks.find(c=>c.type==='IHDR').data));const control=Buffer.alloc(8);control.writeUInt32BE(frames.length);control.writeUInt32BE(0,4);append(chunk('acTL',control))}
  const control=Buffer.alloc(26);control.writeUInt32BE(sequence++);control.writeUInt32BE(width,4);control.writeUInt32BE(height,8);control.writeUInt16BE(duration,20);control.writeUInt16BE(frames.length*1000,22);control[24]=0;control[25]=0;append(chunk('fcTL',control))
  for(const {type,data}of chunks)if(type==='IDAT'){if(index===0)append(chunk('IDAT',data));else{const seq=Buffer.alloc(4);seq.writeUInt32BE(sequence++);append(chunk('fdAT',Buffer.concat([seq,data])))}}
 })
 append(chunk('IEND',Buffer.alloc(0)));return Buffer.concat(parts)
}
