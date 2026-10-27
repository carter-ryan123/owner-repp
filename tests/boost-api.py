"""Local-only integration checks against a built worker on 127.0.0.1:8787.
Start it with --var PLATFORM_OWNER_EMAIL:seedy@sites.test after local migrations.
All fixtures are removed from the local database after the test.
"""
import urllib.request, urllib.error, json, uuid, sqlite3, pathlib, time
BASE='http://127.0.0.1:8787/api/'
tag='boost-qa-'+uuid.uuid4().hex[:8]
owner,seller,other=[tag+'-'+x for x in ['owner','seller','other']]
checks=0

def req(path,user=None,body=None,expected=200,method=None,origin=None):
 global checks
 headers={}
 if user:headers.update({'oai-authenticated-user-id':user,'oai-authenticated-user-email':'seedy@sites.test' if user==owner else user+'@example.test'})
 if body is not None:headers['Content-Type']='application/json'
 if origin:headers['Origin']=origin
 r=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method or ('POST' if body is not None else 'GET'))
 for attempt in range(5):
  try:
   with urllib.request.urlopen(r,timeout=15) as out:status=out.status;raw=out.read()
  except urllib.error.HTTPError as e:status=e.code;raw=e.read()
  if status==503 and b'worker restarted mid-request' in raw:
   time.sleep(.5);continue
  data=json.loads(raw);break
 else:raise AssertionError('Local worker kept restarting')
 assert status==expected,(path,status,data)
 checks+=1;return data

local=None
for p in pathlib.Path('.wrangler/state/v3/d1').rglob('*.sqlite'):
 c=sqlite3.connect(p)
 if c.execute("SELECT count(*) FROM sqlite_master WHERE name='subscriptions'").fetchone()[0]:local=c;break
 c.close()
assert local is not None,'Apply local migrations first.'
def sql(statement,args=()):
 local.execute(statement,args);local.commit()
try:
 assert req('me',owner)['isOwner'] is True
 assert req('me',seller)['isOwner'] is False
 req('owner/overview',expected=403);req('owner/overview',seller,expected=403)
 req('owner/complimentary',seller,{'userId':seller,'action':'grant'},expected=403)
 req('boosts',body={'listingIds':[]},expected=401)
 assert req('boosts')['billingReady'] is False
 for user in [owner,seller,other]:req('profile',user,{'name':'Local QA Member','school':'Local Boost Test School','city':'Austin, TX','zip':'78701','schoolType':'College / university'})
 ids=[]
 for n in range(4):
  ids.append(req('listings',seller,{'title':'Local QA find '+str(n),'description':'A temporary local test item for promotions.','category':'Textbooks','condition':'Good','mode':'sell','price':100+n,'image':''},expected=201)['id'])
 foreign=req('listings',other,{'title':'Other member item','description':'A temporary item owned by another member.','category':'Textbooks','condition':'Good','mode':'sell','price':100,'image':''},expected=201)['id']
 req('boosts',seller,{'listingIds':ids[:1]},expected=403)
 req('billing/checkout',seller,{},expected=503)
 req('billing/portal',seller,{},expected=400)
 req('billing/webhook',body={'id':'evt_unsigned'},expected=503)
 req('owner/complimentary',owner,{'userId':seller,'action':'grant'})
 state=req('boosts',seller);assert state['entitled'] and state['subscription']['source']=='complimentary'
 counts=req('owner/overview',owner)['counts'];assert counts['paid']==0 and counts['complimentary']>=1
 req('boosts',seller,{'listingIds':ids[:3]})
 req('boosts',seller,{'listingIds':ids},expected=400)
 req('boosts',seller,{'listingIds':[ids[0],ids[0]]},expected=400)
 req('boosts',seller,{'listingIds':[foreign]},expected=403)
 req('boosts',seller,{'listingIds':ids[:1]},expected=403,origin='https://untrusted.example')
 listing_rows=req('listings?school=Local%20Boost%20Test')['listings'];assert all(l['promoted']==1 for l in listing_rows if l['id'] in ids[:3])
 assert not req('listings?school=NoMatchingSchool')['listings']
 req('listings/'+ids[0],seller,{'status':'reserved'},method='PATCH')
 assert not any(l['id']==ids[0] for l in req('listings')['listings'])
 req('boosts',seller,{'listingIds':[ids[0]]},expected=403)
 sql('UPDATE subscriptions SET current_period_end=? WHERE user_id=?',(int(time.time()*1000)-1,seller))
 assert not req('boosts',seller)['entitled']
 assert all(l['promoted']==0 for l in req('listings')['listings'] if l['owner_id']==seller)
 req('owner/complimentary',owner,{'userId':seller,'action':'grant'})
 sql('UPDATE subscriptions SET risk_hold=1 WHERE user_id=?',(seller,))
 assert not req('boosts',seller)['entitled']
 req('boosts',seller,{'listingIds':ids[1:2]},expected=403)
 req('owner/clear-hold',seller,{'userId':seller},expected=403)
 req('owner/clear-hold',owner,{'userId':seller})
 assert req('boosts',seller)['entitled']
 req('owner/complimentary',owner,{'userId':seller,'action':'revoke'})
 assert not req('boosts',seller)['entitled']
 print(f'Passed {checks} local API checks: owner authorization, $5 plan state, checkout closure, complimentary grants, three-slot limits, listing ownership, origin rejection, expiry, payment holds, and revocation.')
finally:
 for table,col in [('featured_listings','user_id'),('subscriptions','user_id'),('billing_customers','user_id'),('checkout_intents','user_id'),('listings','owner_id'),('profiles','id')]:sql(f'DELETE FROM {table} WHERE {col} LIKE ?',(tag+'%',))
 local.close()
