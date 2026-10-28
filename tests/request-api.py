"""Local-only regression checks; run marketplace-api.py first to create QA fixtures."""
import urllib.request, urllib.error, json, pathlib, sqlite3, time
base='http://127.0.0.1:8787/api/'
checks=0
headers={'oai-authenticated-user-id':'qa-seller','oai-authenticated-user-email':'qa-seller@example.test','Content-Type':'application/json'}
def raw(path,body,expected,extra={}):
 global checks
 r=urllib.request.Request(base+path,data=body,headers={**headers,**extra},method='POST')
 for attempt in range(3):
  try:
   with urllib.request.urlopen(r,timeout=15) as out:status=out.status;response=out.read()
  except urllib.error.HTTPError as e:status=e.code;response=e.read()
  if status==503 and b'worker restarted mid-request' in response:continue
  data=json.loads(response);break
 else:raise AssertionError('Local worker kept restarting')
 assert status==expected,(path,status,data)
 checks+=1;return data
raw('profile',b'{',400)
raw('profile',b'{}',415,{'Content-Type':'text/plain'})
raw('profile',b'"'+b'a'*33000+b'"',413)
raw('profile',b'{}',403,{'Origin':'null'})
raw('profile',b'{}',403,{'Origin':'invalid'})
raw('profile',b'{}',403,{'Sec-Fetch-Site':'cross-site'})
raw('upload',b'{}',415)
local=None
for p in pathlib.Path('.wrangler/state/v3/d1').rglob('*.sqlite'):
 c=sqlite3.connect(p)
 if c.execute("SELECT count(*) FROM sqlite_master WHERE name='conversations'").fetchone()[0]:local=c;break
 c.close()
cid=local.execute("SELECT id FROM conversations WHERE seller_id='qa-seller' LIMIT 1").fetchone()[0]
now=int(time.time()*1000)+10000
rows=[('request-qa-'+str(i),cid,'qa-seller','Long-history fixture '+str(i),now+i) for i in range(1002)]
local.executemany('INSERT INTO messages (id,conversation_id,sender_id,body,created_at) VALUES (?,?,?,?,?)',rows);local.commit()
try:
 r=urllib.request.Request(base+'conversations/'+cid,headers=headers)
 with urllib.request.urlopen(r,timeout=15) as out:messages=json.loads(out.read())['messages']
 assert len(messages)==1000
 assert messages[-1]['id']=='request-qa-1001'
 assert not any(m['id']=='request-qa-0' for m in messages)
 checks+=1
finally:
 local.execute("DELETE FROM messages WHERE id LIKE 'request-qa-%'");local.commit();local.close()
print(f'Passed {checks} request and long-conversation regression checks.')
