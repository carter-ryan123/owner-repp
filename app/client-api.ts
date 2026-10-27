export async function clientApi(path:string,body?:unknown,method?:string):Promise<any>{
 const response=await fetch('/api/'+path,{method:method||(body?'POST':'GET'),headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
 const data:any=await response.json();if(!response.ok)throw new Error(data.error||'Please try again.');return data;
}
