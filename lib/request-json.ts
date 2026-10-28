const MAX_JSON_BYTES=32*1024;
function fail(message:string,status:number):never{throw Object.assign(new Error(message),{status});}
/** Bound the raw input before validation so oversized arrays cannot exhaust validation memory. */
export async function readJsonBody(req:Request):Promise<unknown>{
 if(req.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')fail('Send JSON with Content-Type application/json.',415);
 if(Number(req.headers.get('content-length'))>MAX_JSON_BYTES)fail('Request is too large.',413);
 if(!req.body)fail('Send a valid JSON request.',400);
 const reader=req.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_JSON_BYTES){await reader.cancel();fail('Request is too large.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('Send a valid JSON request.',400);}
}
export function checkWriteOrigin(req:Request){
 if(req.headers.get('sec-fetch-site')==='cross-site')fail('Request origin does not match.',403);
 const origin=req.headers.get('origin');if(!origin)return;
 let same=false;try{same=new URL(origin).origin===new URL(req.url).origin;}catch{}
 if(!same)fail('Request origin does not match.',403);
}
