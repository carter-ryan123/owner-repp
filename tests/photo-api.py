import urllib.request,urllib.error,json,base64
base='http://127.0.0.1:8787/api/'
def upload(data,name,expected):
 boundary='campus-loop-qa-boundary'
 body=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode()+data+f'\r\n--{boundary}--\r\n'.encode())
 r=urllib.request.Request(base+'upload',data=body,headers={'Content-Type':'multipart/form-data; boundary='+boundary,'oai-authenticated-user-id':'qa-seller','oai-authenticated-user-email':'qa-seller@example.test'})
 try:
  with urllib.request.urlopen(r) as s:status=s.status;d=json.loads(s.read())
 except urllib.error.HTTPError as e:status=e.code;d=json.loads(e.read())
 assert status==expected,(status,d)
 return d
upload(b'<svg>not permitted</svg>','fake.png',400)
png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6QAAAABJRU5ErkJggg==')
key=upload(png,'qa.png',201)['key']
with urllib.request.urlopen(base+'image/'+key.split('/')[1]) as r:assert r.headers.get('Content-Type')=='image/png' and r.read()==png
payload={'title':'QA Unauthorized Image','description':'This should reject image reuse by another user.','category':'Textbooks','condition':'Good','mode':'sell','price':100,'tradeFor':'','image':key}
r=urllib.request.Request(base+'listings',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','oai-authenticated-user-id':'qa-buyer','oai-authenticated-user-email':'qa-buyer@example.test'})
try:urllib.request.urlopen(r);raise Exception('Ownership check did not reject')
except urllib.error.HTTPError as e:assert e.code==400
print('Passed 4 photo checks: invalid file rejection, upload, image retrieval, and cross-user image ownership protection.')
