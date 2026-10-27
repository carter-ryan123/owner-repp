export async function verifyStripeSignature(body:string,header:string|null,secret:string,nowSeconds=Math.floor(Date.now()/1000)):Promise<boolean>{
  if(!header||!secret)return false;
  const parts=header.split(',').map(p=>p.trim().split('='));
  const timestamp=parts.find(p=>p[0]==='t')?.[1];
  if(!timestamp||!/^\d+$/.test(timestamp)||Math.abs(nowSeconds-Number(timestamp))>300)return false;
  const signatures=parts.filter(p=>p[0]==='v1'&&/^[a-f0-9]{64}$/i.test(p[1]||'')).map(p=>p[1]);
  if(!signatures.length)return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const payload=new TextEncoder().encode(timestamp+'.'+body);
  for(const signature of signatures){
    const bytes=Uint8Array.from(signature.match(/../g)!.map(s=>parseInt(s,16)));
    if(await crypto.subtle.verify('HMAC',key,bytes,payload))return true;
  }
  return false;
}
