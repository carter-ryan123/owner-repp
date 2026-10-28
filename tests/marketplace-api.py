import urllib.request, urllib.error, json, uuid
base='http://127.0.0.1:8787/api/'
checks=0

def req(path,user=None,body=None,method=None,expected=200,origin=None):
 global checks
 headers={}
 if user:headers.update({'oai-authenticated-user-id':'qa-'+user,'oai-authenticated-user-email':'qa-'+user+'@example.test'})
 if body is not None:headers['Content-Type']='application/json'
 if origin:headers['Origin']=origin
 r=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method or ('POST' if body is not None else 'GET'))
 for attempt in range(3):
  try:
   with urllib.request.urlopen(r,timeout=15) as out:status=out.status;response=out.read()
  except urllib.error.HTTPError as e:status=e.code;response=e.read()
  if status==503 and b'worker restarted mid-request' in response:continue
  data=json.loads(response);break
 else:raise AssertionError('Local worker kept restarting')
 assert status==expected,(path,status,data)
 checks+=1;return data
req('profile',body={'name':'No Auth'},expected=401)
for person in ['seller','buyer','outsider']:
 req('profile',person,{'name':'QA '+person,'school':'QA School','city':'Austin, TX','zip':'78701','schoolType':'High school'})
req('profile','seller',{'name':'Bad','school':'QA School','city':'Austin','zip':'bad','schoolType':'High school'},expected=400)
listing={'title':'QA Test Biology Book','description':'A temporary test listing for the local preview only.','category':'Textbooks','condition':'Good','mode':'both','price':2000,'tradeFor':'Math textbook','image':''}
id=req('listings','seller',listing,expected=201)['id']
assert any(l['id']==id for l in req('listings?school=QA%20School&area=78701')['listings'])
assert not req('listings?school=NoMatchSchool')['listings']
req('listings/'+id,'buyer',{'status':'sold'},method='PATCH',expected=404)
req('favorites','buyer',{'id':id,'saved':True})
assert id in req('favorites','buyer')['ids']
assert id not in req('favorites','outsider')['ids']
req('conversations','seller',{'listingId':id,'body':'Testing own listing.'},expected=400)
c=req('conversations','buyer',{'listingId':id,'body':'Purchase inquiry: Is this available?'},expected=201)['id']
assert req('conversations/'+c,'seller')['messages'][0]['body'].startswith('Purchase')
req('conversations/'+c,'outsider',expected=404)
req('conversations/'+c,'outsider',{'body':'Not permitted'},expected=404)
req('conversations/'+c,'seller',{'body':'Yes, meet at the public library.'},expected=201)
assert len(req('conversations/'+c,'buyer')['messages'])==2
req('profile','seller',{'name':'QA Seller','school':'QA School','city':'Austin, TX','zip':'78701','schoolType':'High school'},origin='https://untrusted.example',expected=403)
req('listings/'+id,'seller',{'status':'sold'},method='PATCH')
assert not any(l['id']==id for l in req('listings')['listings'])
assert any(l['id']==id for l in req('listings?mine=1','seller')['listings'])
req('listings/'+id,'seller',{'status':'available'},method='PATCH')
req('favorites','buyer',{'id':id,'saved':False})
assert id not in req('favorites','buyer')['ids']
print(f'Passed {checks} API checks: profile validation, listing creation, local filtering, ownership, saved items, buyer/seller messaging, participant privacy, CSRF rejection, and listing status.')
