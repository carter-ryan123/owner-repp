import { env } from 'cloudflare:workers';
import { BOOST_PLAN, hasBoostAccess, isExpectedBoostPrice, subscriptionPeriodEnd } from './boost-policy';
import { verifyStripeSignature } from './stripe-signature';
import type { ChatGPTUser } from '../app/chatgpt-auth';
const SITE='https://campus-loop-exchange.milkyhawk20.chatgpt.site';
const API_VERSION='2026-08-26.dahlia';
export function isPlatformOwner(user:ChatGPTUser|null) {
  return !!user && !!env.PLATFORM_OWNER_EMAIL && user.email.trim().toLowerCase()===env.PLATFORM_OWNER_EMAIL.trim().toLowerCase();
}
function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
const db=()=>{if(!env.DB)fail('The marketplace database is unavailable.',503);return env.DB!;};
async function one(sql:string,...args:unknown[]){return db().prepare(sql).bind(...args).first<any>();}
async function many(sql:string,...args:unknown[]){return (await db().prepare(sql).bind(...args).all<any>()).results;}
async function run(sql:string,...args:unknown[]){return db().prepare(sql).bind(...args).run();}
export function billingSetup(){return {
  apiKey:!!env.STRIPE_API_KEY,webhook:!!env.STRIPE_WEBHOOK_SECRET,price:!!env.STRIPE_BOOST_PRICE_ID,
  account:!!env.STRIPE_PLATFORM_ACCOUNT_ID,enabled:env.STRIPE_CHECKOUT_ENABLED==='true',
};}
export function billingReady(){return Object.values(billingSetup()).every(Boolean);}
async function stripe(path:string,method='GET',body?:URLSearchParams,idempotencyKey?:string):Promise<any>{
  if(!env.STRIPE_API_KEY)fail('Stripe billing is not connected yet.',503);
  const headers:Record<string,string>={Authorization:'Bearer '+env.STRIPE_API_KEY,'Stripe-Version':API_VERSION};
  if(body)headers['Content-Type']='application/x-www-form-urlencoded';
  if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
  let response:Response;
  try{response=await fetch('https://api.stripe.com'+path,{method,headers,body,signal:AbortSignal.timeout(18000)});}catch{fail('Stripe did not confirm this request. Try again to safely resume the same checkout.',503);}
  const data:any=await response.json().catch(()=>null);
  if(!response.ok)fail(response.status===409?'Checkout is already being prepared. Please try again.':'Stripe could not complete this request. Contact Campus Loop support.',response.status===409?409:502);
  return data;
}
async function verifiedAccount(){
  const account=await stripe('/v1/account');
  if(!env.STRIPE_PLATFORM_ACCOUNT_ID||account.id!==env.STRIPE_PLATFORM_ACCOUNT_ID)fail('The Stripe account has not been verified for Campus Loop.',503);
  if(!account.charges_enabled)fail('Stripe account activation is still required.',503);
}
export async function boostState(userId?:string){
  const subscription=userId?await one('SELECT status,source,current_period_end,cancel_at_period_end,risk_hold FROM subscriptions WHERE user_id=?',userId):null;
  return {plan:BOOST_PLAN,billingReady:billingReady(),subscription,entitled:hasBoostAccess(subscription),featuredIds:userId?(await many('SELECT listing_id FROM featured_listings WHERE user_id=?',userId)).map(r=>r.listing_id):[],hasBillingAccount:userId?!!await one('SELECT user_id FROM billing_customers WHERE user_id=?',userId):false};
}
export async function saveFeatured(userId:string,ids:string[]){
  if(ids.length>BOOST_PLAN.maxFeaturedListings||new Set(ids).size!==ids.length)fail('Choose up to three different listings.');
  const s=await one('SELECT * FROM subscriptions WHERE user_id=?',userId);
  if(!hasBoostAccess(s))fail('An active Loop Plus plan is required to promote listings.',403);
  for(const id of ids){if(!/^[a-f0-9-]{36}$/i.test(id)||!await one("SELECT id FROM listings WHERE id=? AND owner_id=? AND status='available'",id,userId))fail('Choose available listings that belong to you.',403);}
  await db().batch([db().prepare('DELETE FROM featured_listings WHERE user_id=?').bind(userId),...ids.map(id=>db().prepare('INSERT INTO featured_listings (user_id,listing_id,created_at) VALUES (?,?,?)').bind(userId,id,Date.now()))]);
}
async function customerFor(user:ChatGPTUser){
  let customer=await one('SELECT stripe_customer_id FROM billing_customers WHERE user_id=?',user.userId);
  if(customer)return customer.stripe_customer_id as string;
  const b=new URLSearchParams({email:user.email,'metadata[campus_loop_user_id]':user.userId});
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user.userId));
  const key=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');
  const c=await stripe('/v1/customers','POST',b,'campus-loop-customer-'+key);
  await run('INSERT OR IGNORE INTO billing_customers (user_id,stripe_customer_id) VALUES (?,?)',user.userId,c.id);
  return (await one('SELECT stripe_customer_id FROM billing_customers WHERE user_id=?',user.userId)).stripe_customer_id as string;
}
export async function createBoostCheckout(user:ChatGPTUser){
  if(!billingReady())fail('Subscriptions are not open yet. No payment has been taken.',503);
  if(!await one('SELECT id FROM profiles WHERE id=?',user.userId))fail('Add your school profile before subscribing.');
  await verifiedAccount();
  const price=await stripe('/v1/prices/'+encodeURIComponent(env.STRIPE_BOOST_PRICE_ID!));
  if(!isExpectedBoostPrice(price))fail('The subscription price must be exactly $5 USD per month.',503);
  const state=await boostState(user.userId);
  if(state.entitled)fail('Your Loop Plus plan is already active. Manage your membership instead.',409);
  const customer=await customerFor(user);
  const existing=await stripe('/v1/subscriptions?'+new URLSearchParams({customer,status:'all',limit:'100'}));
  if(existing.data?.some((s:any)=>!['canceled','incomplete_expired'].includes(s.status)&&s.items?.data?.some((i:any)=>i.price?.id===env.STRIPE_BOOST_PRICE_ID)))fail('A subscription already exists. Open billing to manage it.',409);
  const now=Date.now();
  const expires=Math.floor(now/1000)*1000+60*60*1000;
  await run("INSERT INTO checkout_intents (user_id,id,expires_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET id=excluded.id,session_id='',url='',expires_at=excluded.expires_at WHERE checkout_intents.expires_at<?",user.userId,crypto.randomUUID(),expires,now);
  const intent=await one('SELECT * FROM checkout_intents WHERE user_id=?',user.userId);
  if(intent.url)return {url:intent.url};
  const tag=Array.from(intent.id.replaceAll('-','').slice(0,8)).map((s:any)=>String.fromCharCode(97+parseInt(s,16))).join('');
  const b=new URLSearchParams({mode:'subscription',customer,'line_items[0][price]':env.STRIPE_BOOST_PRICE_ID!,'line_items[0][quantity]':'1',client_reference_id:user.userId,'metadata[campus_loop_user_id]':user.userId,'subscription_data[metadata][campus_loop_user_id]':user.userId,'subscription_data[metadata][plan]':BOOST_PLAN.id,success_url:SITE+'/?view=boost&checkout=returned',cancel_url:SITE+'/?view=boost&checkout=canceled',expires_at:String(Math.floor(intent.expires_at/1000)),integration_identifier:'campus_loop_plus_'+tag});
  const session=await stripe('/v1/checkout/sessions','POST',b,'campus-loop-plus-'+intent.id);
  const redirect=new URL(session.url);
  if(redirect.protocol!=='https:'||redirect.hostname!=='checkout.stripe.com')fail('Stripe returned an invalid checkout link.',502);
  await run('UPDATE checkout_intents SET session_id=?,url=? WHERE user_id=? AND id=?',session.id,session.url,user.userId,intent.id);
  return {url:session.url};
}
export async function createBillingPortal(userId:string){
  const c=await one('SELECT stripe_customer_id FROM billing_customers WHERE user_id=?',userId);
  if(!c)fail('No Stripe subscription is linked to your account yet.');
  const session=await stripe('/v1/billing_portal/sessions','POST',new URLSearchParams({customer:c.stripe_customer_id,return_url:SITE+'/?view=boost'}));
  const redirect=new URL(session.url);if(redirect.protocol!=='https:'||redirect.hostname!=='billing.stripe.com')fail('Stripe returned an invalid billing link.',502);
  return {url:session.url};
}
async function syncSubscription(id:string){
  const subscription=await stripe('/v1/subscriptions/'+encodeURIComponent(id));
  const customer=typeof subscription.customer==='string'?subscription.customer:subscription.customer?.id;
  const mapping=await one('SELECT user_id FROM billing_customers WHERE stripe_customer_id=?',customer||'');
  if(!mapping)return;
  const valid=subscription.items?.data?.some((i:any)=>i.price?.id===env.STRIPE_BOOST_PRICE_ID&&isExpectedBoostPrice({...i.price,active:true}));
  if(!valid){await run("UPDATE subscriptions SET status='inactive',current_period_end=0,updated_at=? WHERE user_id=? AND stripe_subscription_id=?",Date.now(),mapping.user_id,subscription.id);return;}
  const end=subscriptionPeriodEnd(subscription);
  await run("INSERT INTO subscriptions (user_id,stripe_subscription_id,status,source,current_period_end,cancel_at_period_end,risk_hold,updated_at) VALUES (?,?,?,'stripe',?,?,0,?) ON CONFLICT(user_id) DO UPDATE SET stripe_subscription_id=excluded.stripe_subscription_id,status=excluded.status,source='stripe',current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=excluded.updated_at",mapping.user_id,subscription.id,subscription.status,end,subscription.cancel_at_period_end?1:0,Date.now());
}
export async function handleBillingWebhook(req:Request){
  if(!env.STRIPE_WEBHOOK_SECRET)fail('Billing webhook setup is incomplete.',503);
  if(Number(req.headers.get('content-length'))>1048576)fail('Request too large.',413);
  const body=await req.text();if(body.length>1048576)fail('Request too large.',413);
  if(!await verifyStripeSignature(body,req.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))fail('Invalid webhook signature.',400);
  let e:any;try{e=JSON.parse(body)}catch{fail('Invalid event.',400);}
  if(typeof e.id!=='string'||!e.id.startsWith('evt_')||typeof e.type!=='string'||!e.data?.object)fail('Invalid event.',400);
  if(await one('SELECT id FROM billing_events WHERE id=?',e.id))return {received:true,duplicate:true};
  if(e.account&&e.account!==env.STRIPE_PLATFORM_ACCOUNT_ID)fail('Unexpected Stripe account.',400);
  const keyMode=env.STRIPE_API_KEY?.match(/^[sr]k_(test|live)_/)?.[1];
  if(!keyMode||typeof e.livemode!=='boolean'||e.livemode!==(keyMode==='live'))fail('Billing environment does not match.',400);
  const obj=e.data.object;
  let subscriptionId:string|undefined;
  if(e.type.startsWith('customer.subscription.'))subscriptionId=obj.id;
  else if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(e.type))subscriptionId=typeof obj.subscription==='string'?obj.subscription:obj.subscription?.id;
  else if(['invoice.paid','invoice.payment_failed','invoice.payment_action_required'].includes(e.type))subscriptionId=obj.parent?.subscription_details?.subscription||obj.subscription;
  if(subscriptionId){if(!/^sub_[a-zA-Z0-9]+$/.test(subscriptionId))fail('Invalid subscription.',400);await syncSubscription(subscriptionId);}
  if(['charge.refunded','charge.dispute.created','radar.early_fraud_warning.created'].includes(e.type)){
    const charge=e.type==='charge.refunded'?obj:await stripe('/v1/charges/'+encodeURIComponent(typeof obj.charge==='string'?obj.charge:obj.charge?.id||''));
    const customer=typeof charge.customer==='string'?charge.customer:charge.customer?.id;
    if(customer)await run("UPDATE subscriptions SET risk_hold=1,updated_at=? WHERE user_id IN (SELECT user_id FROM billing_customers WHERE stripe_customer_id=?)",Date.now(),customer);
  }
  await run('INSERT OR IGNORE INTO billing_events (id,type,processed_at) VALUES (?,?,?)',e.id,e.type,Date.now());
  return {received:true};
}
export async function ownerOverview(){
  const now=Date.now();
  const [profiles,listings,paid,comp,flagged,people]=await Promise.all([
    one('SELECT COUNT(*) count FROM profiles'),one("SELECT COUNT(*) total,SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) available FROM listings"),
    one("SELECT COUNT(*) count FROM subscriptions WHERE source='stripe' AND status='active' AND current_period_end>? AND risk_hold=0",now),
    one("SELECT COUNT(*) count FROM subscriptions WHERE source='complimentary' AND status='active' AND current_period_end>?",now),
    many('SELECT s.user_id,p.name,p.school FROM subscriptions s LEFT JOIN profiles p ON p.id=s.user_id WHERE risk_hold=1'),
    many('SELECT id,name,school FROM profiles ORDER BY name LIMIT 200')
  ]);
  return {plan:BOOST_PLAN,setup:billingSetup(),billingReady:billingReady(),ownerEmail:env.PLATFORM_OWNER_EMAIL,counts:{members:profiles.count,listings:listings.total,available:listings.available||0,paid:paid.count,complimentary:comp.count},flagged,people};
}
export async function grantComplimentary(userId:string){
  if(!await one('SELECT id FROM profiles WHERE id=?',userId))fail('Choose a member with a school profile.');
  const current=await one('SELECT * FROM subscriptions WHERE user_id=?',userId);
  if(current?.source==='stripe'&&!['canceled','incomplete_expired'].includes(current.status))fail('Manage this paid subscription in Stripe instead.');
  const end=Date.now()+30*24*60*60*1000;
  await run("INSERT INTO subscriptions (user_id,status,source,current_period_end,updated_at) VALUES (?,'active','complimentary',?,?) ON CONFLICT(user_id) DO UPDATE SET stripe_subscription_id='',status='active',source='complimentary',current_period_end=excluded.current_period_end,cancel_at_period_end=0,risk_hold=0,updated_at=excluded.updated_at",userId,end,Date.now());
}
export async function revokeComplimentary(userId:string){await run("UPDATE subscriptions SET status='canceled',updated_at=? WHERE user_id=? AND source='complimentary'",Date.now(),userId);}
export async function clearBillingHold(userId:string){await run('UPDATE subscriptions SET risk_hold=0,updated_at=? WHERE user_id=?',Date.now(),userId);}
