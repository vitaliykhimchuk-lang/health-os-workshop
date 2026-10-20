import {Inflate,strFromU8} from './fflate.mjs';
const u16=(v,n)=>v.getUint16(n,true),u32=(v,n)=>v.getUint32(n,true);
const u64=(v,n)=>{const x=Number(v.getBigUint64(n,true));if(!Number.isSafeInteger(x)||x<0)throw Error('ZIP содержит неподдерживаемый размер файла.');return x;};
async function read(file,start,length){if(start<0||length<0||start+length>file.size)throw Error('ZIP обрывается раньше конца файла. Заново сохраните полный архив в «Файлы».');const b=new Uint8Array(await file.slice(start,start+length).arrayBuffer());if(b.length!==length)throw Error('Не удалось прочитать полный ZIP с устройства.');return b;}
export async function zipEntries(file){
 const tail=await read(file,Math.max(0,file.size-65557),Math.min(file.size,65557));const t=new DataView(tail.buffer,tail.byteOffset,tail.byteLength);let end=-1;
 for(let i=tail.length-22;i>=0;i--)if(u32(t,i)===0x06054b50&&i+22+u16(t,i+20)===tail.length){end=i;break;}
 if(end<0)throw Error('Не найден конец ZIP. Возможно, архив скачан не полностью или выбран не ZIP.');
 if(u16(t,end+4)||u16(t,end+6))throw Error('Архив из нескольких ZIP-частей не поддерживается.');
 let count=u16(t,end+10),size=u32(t,end+12),offset=u32(t,end+16);
 if(count===65535||size===0xffffffff||offset===0xffffffff){const absolute=file.size-tail.length+end;const loc=await read(file,absolute-20,20);const v=new DataView(loc.buffer);if(u32(v,0)!==0x07064b50)throw Error('Не найден каталог большого ZIP64.');const z=await read(file,u64(v,8),56),d=new DataView(z.buffer);if(u32(d,0)!==0x06064b50)throw Error('Некорректный ZIP64.');count=u64(d,32);size=u64(d,40);offset=u64(d,48);}
 if(size>64*1024**2||count>300000)throw Error('В ZIP слишком много файлов. Выберите распакованный XML.');
 const bytes=await read(file,offset,size),v=new DataView(bytes.buffer),entries=[];
 for(let i=0,n=0;n<count;n++){if(i+46>size||u32(v,i)!==0x02014b50)throw Error('Повреждён каталог ZIP. Выберите распакованный XML.');let compressed=u32(v,i+20),original=u32(v,i+24),local=u32(v,i+42);const nameLength=u16(v,i+28),extraLength=u16(v,i+30),comment=u16(v,i+32);if(i+46+nameLength+extraLength+comment>size)throw Error('Оборван каталог ZIP.');const name=strFromU8(bytes.subarray(i+46,i+46+nameLength));
  for(let p=i+46+nameLength;p+4<=i+46+nameLength+extraLength;){const id=u16(v,p),len=u16(v,p+2);p+=4;if(id===1){let q=p;if(original===0xffffffff){original=u64(v,q);q+=8;}if(compressed===0xffffffff){compressed=u64(v,q);q+=8;}if(local===0xffffffff)local=u64(v,q);}p+=len;}
  entries.push({name,compressed,original,offset:local,method:u16(v,i+10),encrypted:!!(u16(v,i+8)&1)});i+=46+nameLength+extraLength+comment;
 }return entries;
}
export async function extractEntry(file,entry,ondata){
 if(entry.encrypted)throw Error('ZIP защищён паролем. Выберите распакованный XML.');if(![0,8].includes(entry.method))throw Error('Неподдерживаемое сжатие ZIP (метод '+entry.method+'). Распакуйте архив в «Файлах» и выберите XML.');
 const h=await read(file,entry.offset,30),v=new DataView(h.buffer);if(u32(v,0)!==0x04034b50)throw Error('Не найден файл внутри ZIP.');const start=entry.offset+30+u16(v,26)+u16(v,28);if(start+entry.compressed>file.size)throw Error('Файл внутри ZIP скачан не полностью.');
 const inflater=entry.method===8?new Inflate((chunk,final)=>ondata(chunk,final)):null;const reader=file.slice(start,start+entry.compressed).stream().getReader();
 try{for(;;){const {done,value}=await reader.read();if(done)break;if(inflater)inflater.push(value,false);else ondata(value,false);}if(inflater)inflater.push(new Uint8Array(),true);else ondata(new Uint8Array(),true);}finally{await reader.cancel();}
}
