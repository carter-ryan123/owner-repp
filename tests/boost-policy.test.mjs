import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
async function moduleAt(file){const source=await readFile(new URL(file,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
const {BOOST_PLAN,hasBoostAccess,isExpectedBoostPrice,subscriptionPeriodEnd,orderFinds}=await moduleAt('../lib/boost-policy.ts');
const {verifyStripeSignature}=await moduleAt('../lib/stripe-signature.ts');
test('access requires an active unexpired membership without a payment hold',()=>{
 const active={status:'active',current_period_end:2000,risk_hold:0};
 assert.equal(hasBoostAccess(active,1000),true);
 for(const status of ['canceled','past_due','incomplete','unpaid','paused','trialing'])assert.equal(hasBoostAccess({...active,status},1000),false);
 assert.equal(hasBoostAccess(active,2000),false);assert.equal(hasBoostAccess({...active,risk_hold:1},1000),false);assert.equal(hasBoostAccess(null),false);
});
test('only the agreed $5 USD monthly price is accepted',()=>{
 const price={active:true,currency:'usd',unit_amount:500,recurring:{interval:'month',interval_count:1,usage_type:'licensed'}};
 assert.equal(BOOST_PLAN.maxFeaturedListings,3);assert.equal(isExpectedBoostPrice(price),true);
 for(const changes of [{unit_amount:501},{currency:'eur'},{active:false},{recurring:{interval:'year',interval_count:1}},{recurring:{interval:'month',interval_count:2}},{recurring:{interval:'month',interval_count:1,usage_type:'metered'}}])assert.equal(isExpectedBoostPrice({...price,...changes}),false);
 assert.equal(subscriptionPeriodEnd({items:{data:[{current_period_end:1234}]}}),1234000);
});
test('promotion affects Recommended while explicit price and newest sorts work',()=>{
 const items=[{id:'new',promoted:0,price:100,created_at:300},{id:'promoted',promoted:1,price:200,created_at:100},{id:'middle',promoted:0,price:300,created_at:200}];
 assert.deepEqual(orderFinds(items,'recommended').map(x=>x.id),['promoted','new','middle']);
 assert.deepEqual(orderFinds(items,'newest').map(x=>x.id),['new','middle','promoted']);
 assert.deepEqual(orderFinds(items,'low').map(x=>x.id),['new','promoted','middle']);
 assert.deepEqual(orderFinds(items,'high').map(x=>x.id),['middle','promoted','new']);
 assert.deepEqual(orderFinds(items.filter(x=>x.price<200),'recommended').map(x=>x.id),['new']);
 assert.equal(items[0].id,'new');
});
test('webhook HMAC rejects tampering, stale events, malformed headers, and wrong secrets',async()=>{
 const body='{"id":"evt_local_test"}',secret='local_signature_fixture',now=1800000000;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const raw=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(now+'.'+body));const hex=Buffer.from(raw).toString('hex');const header=`t=${now},v1=${hex}`;
 assert.equal(await verifyStripeSignature(body,header,secret,now),true);
 assert.equal(await verifyStripeSignature(body,`t=${now},v1=${'0'.repeat(64)},v1=${hex}`,secret,now),true);
 assert.equal(await verifyStripeSignature(body+' ',header,secret,now),false);
 assert.equal(await verifyStripeSignature(body,header,secret,now+301),false);
 assert.equal(await verifyStripeSignature(body,header,'wrong',now),false);
 for(const h of [null,'','t=bad,v1=123',`t=${now},v1=bad`])assert.equal(await verifyStripeSignature(body,h,secret,now),false);
});
