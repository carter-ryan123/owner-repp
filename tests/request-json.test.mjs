import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../lib/request-json.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {readJsonBody,checkWriteOrigin}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const request=(body,headers={})=>new Request('https://example.test/api/profile',{method:'POST',body,headers:{'Content-Type':'application/json',...headers}});
test('bounded JSON accepts valid input and rejects malformed input and content types',async()=>{
 assert.deepEqual(await readJsonBody(request('{"name":"Student"}')), {name:'Student'});
 await assert.rejects(readJsonBody(request('{')),e=>e.status===400);
 await assert.rejects(readJsonBody(request('',{'Content-Type':'text/plain'})),e=>e.status===415);
 await assert.rejects(readJsonBody(request(new Uint8Array([0xff]))),e=>e.status===400);
});
test('size limits apply with and without Content-Length',async()=>{
 await assert.rejects(readJsonBody(request('"'+ 'a'.repeat(33000)+'"')),e=>e.status===413);
 await assert.rejects(readJsonBody(request('{}',{'Content-Length':'999999'})),e=>e.status===413);
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(20000));c.enqueue(new Uint8Array(20000));c.close();}});
 const r=new Request('https://example.test/api/profile',{method:'POST',body:stream,duplex:'half',headers:{'Content-Type':'application/json'}});
 await assert.rejects(readJsonBody(r),e=>e.status===413);
});
test('cross-origin and malformed-origin writes fail closed',()=>{
 checkWriteOrigin(request('{}',{'Origin':'https://example.test'}));checkWriteOrigin(request('{}'));
 for(const headers of [{'Origin':'https://untrusted.test'},{'Origin':'null'},{'Origin':'malformed'},{'Sec-Fetch-Site':'cross-site'}])assert.throws(()=>checkWriteOrigin(request('{}',headers)),e=>e.status===403);
});
