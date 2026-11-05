import json,urllib.request,urllib.error,hashlib
from pathlib import Path
cfg=json.loads((Path.home()/'.config/netlify/config.json').read_text());auth=cfg['users'][cfg['userId']]['auth'];TOKEN=auth if isinstance(auth,str) else auth['token']
SITE='aa62f324-b880-47d6-85b8-4ba0700ff5bf';ACCOUNT='69800888d1a3d0483003ae9e'
ROOT=Path(__file__).resolve().parents[1];STATE=ROOT/'.netlify/arcade-quest-release';STATE.mkdir(parents=True,exist_ok=True)
def api(p,method='GET',body=None,binary=None):
 h={'Authorization':'Bearer '+TOKEN};data=None
 if body is not None:h['Content-Type']='application/json';data=json.dumps(body,separators=(',',':')).encode()
 if binary is not None:h['Content-Type']='application/octet-stream';data=binary
 try:
  with urllib.request.urlopen(urllib.request.Request('https://api.netlify.com/api/v1/'+p,headers=h,method=method,data=data),timeout=40)as r:
   raw=r.read();return json.loads(raw)if raw else {}
 except urllib.error.HTTPError as e:raise RuntimeError('Netlify HTTP '+str(e.code)+' for '+p.split('?')[0]) from None
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':')).encode()
def digest(v):return hashlib.sha256(canonical(v)).hexdigest()
def save(name,v):
 p=STATE/name;p.write_text(json.dumps(v,indent=2)+'\n');p.chmod(0o600)
def inventory(id):
 files={}
 for page in range(1,101):
  batch=api(f'deploys/{id}/files?per_page=100&page={page}')
  for row in batch:
   assert row['path']not in files,'Duplicate static path';files[row['path']]=row['sha']
  if len(batch)<100:return files
 raise RuntimeError('Inventory exceeds bounded release')
def environment():
 site=api(f'accounts/{ACCOUNT}/env?site_id={SITE}');shared=api(f'accounts/{ACCOUNT}/env')
 return {'site':{r['key']:digest(r)for r in site},'shared':{r['key']:digest(r)for r in shared}}
def current(id):
 site=api('sites/'+SITE);assert site['published_deploy']['id']==id,'Concurrent production change';assert site['published_deploy']['locked'] is True,'Publication lock changed';return site

import sys,time,subprocess,re,urllib.parse
BASE='6ae971bd73f65c3f86a9e887'
NEW=['arcade-social','arcade-campaign']
OVERLAY=['/play/index.html','/styles/tree-arcade-suite.css','/scripts/arcade-daily-growth.js','/scripts/arcade-social-missions.js','/scripts/arcade-quest-campaigns.js']
RUNTIME=['function_schedules','functions_region','functions_region_overrides','branch','context','database_branch_id','blobs_region','framework','edge_functions_present','server','database_migrations']
def config_for(records):
 configurations={}
 for f in records:
  c={}
  for short,long in {'dn':'display_name','g':'generator','bd':'build_data','p':'priority','tr':'traffic_rules','vcpu':'vcpu','es':'event_subscriptions','mo':'memory','rgo':'region'}.items():
   if f.get(short)is not None:c[long]=f[short]
  for short,long in [('ro','routes'),('er','excluded_routes')]:
   if f.get(short)is not None:c[long]=[{name:r[key]for key,name in {'p':'pattern','l':'literal','e':'expression','m':'methods','ps':'prefer_static'}.items()if r.get(key)is not None}for r in f[short]]
  configurations[f['n']]=c
 return configurations

def envcheck(baseline):
 now=environment();assert now==baseline['environment'],'An existing environment record or inventory changed'
 site=api('sites/'+SITE)
 assert digest(site.get('build_settings',{}).get('env',{}))==baseline['buildEnvironmentHash'],'Legacy build environment changed'
 return now

def sourcecheck(manifest):
 for f in manifest['functions']:
  assert hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256'],'New package digest changed'
  for source in f['sourceFiles']:
   assert hashlib.sha256((ROOT/source['path']).read_bytes()).hexdigest()==source['sha256'],'Packaged source drift: '+source['path']
 assert subprocess.check_output(['git','status','--porcelain','--',*[p.lstrip('/')for p in OVERLAY]],cwd=ROOT,text=True).strip()=='','Frontend overlay is uncommitted'

def verify(state,b):
 d=api('deploys/'+state['id']);assert d['state']=='ready','Candidate is not ready'
 old=b['deploy']['available_functions'];actual=[f for f in d['available_functions']if f['n']not in NEW]
 assert actual==old,'Existing backend provider or identity changed'
 assert len(d['available_functions'])==43 and {f['n']for f in d['available_functions']}=={f['n']for f in old}|set(NEW),'Unexpected function inventory'
 for key in RUNTIME:assert d.get(key)==b['deploy'].get(key),'Runtime change: '+key
 for f in state['newFunctions']:
  got=next(v for v in d['available_functions']if v['n']==f['name'])
  assert got['d']==f['sha256'] and got['r']==f['runtimeVersion'] and got['im']==f['invocationMode'],'New quest package/runtime mismatch'
 assert inventory(state['id'])==state['files'],'Static inventory mismatch'
 envcheck(b)
 return d

def run(mode):
 b=json.loads((STATE/'baseline.json').read_text());assert b['deploy']['id']==BASE
 manifest=json.loads((ROOT/'.netlify/arcade-quest-functions/manifest.json').read_text());sourcecheck(manifest)
 if mode=='create':
  assert not(STATE/'candidate.json').exists(),'Resume the already recorded candidate'
  current(BASE);env=envcheck(b)
  old=b['deploy']['available_functions'];files=dict(b['files']);overlays=[]
  for path in OVERLAY:
   data=(ROOT/path.lstrip('/')).read_bytes();files[path]=hashlib.sha1(data).hexdigest();overlays.append({'path':path,'sha':files[path],'size':len(data)})
  assert set(files)-set(b['files'])=={'/scripts/arcade-social-missions.js','/scripts/arcade-quest-campaigns.js'}
  assert all(files[p]==sha for p,sha in b['files'].items()if p not in OVERLAY),'Unrelated static changes'
  functions={f['n']:f['d']for f in old};configs=config_for(old)
  def snake(v):
   if isinstance(v,list):return [snake(x)for x in v]
   if isinstance(v,dict):return {re.sub(r'(?<!^)(?=[A-Z])','_',k).lower():snake(x)for k,x in v.items()}
   return v
  for f in manifest['functions']:
   functions[f['name']]=f['sha256'];configs[f['name']]={'build_data':f['buildData'],'routes':f['routes'],'traffic_rules':snake(f['trafficRules'])}
  commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
  payload={'files':files,'functions':functions,'functions_config':configs,'function_schedules':b['deploy']['function_schedules'],'draft':False,'async':True,'branch':b['deploy']['branch'],'commit_ref':commit}
  created=api('sites/'+SITE+'/deploys?title='+urllib.parse.quote('TREE Arcade quests: verified campaigns and social missions; preserved backend'),'POST',payload)
  state={'id':created['id'],'baseline':BASE,'sourceCommit':commit,'files':files,'overlay':overlays,'newFunctions':manifest['functions'],'environment':env,'createdAt':created['created_at']}
  save('candidate.json',state);print(json.dumps({'candidateRecorded':state['id']}),flush=True)
  assert not created.get('published_at'),'Candidate unexpectedly published'
  deadline=time.monotonic()+45;d=created
  while d['state']not in ['prepared','uploading','uploaded','processing','ready']:
   assert d['state']not in ['error','canceled'];assert time.monotonic()<deadline,'Candidate preparation pending; resume upload';time.sleep(1);d=api('deploys/'+state['id'])
  return upload(state,b,d)
 state=json.loads((STATE/'candidate.json').read_text());assert state['baseline']==BASE
 if mode=='upload':return upload(state,b,api('deploys/'+state['id']))
 if mode=='verify':
  current(BASE);d=verify(state,b);assert not d.get('published_at');save('verified.json',{'id':state['id'],'sourceCommit':state['sourceCommit'],'passed':True,'baseline':BASE});print(json.dumps({'verified':state['id'],'functionsPreserved':41,'functionsAdded':2,'schedulesPreserved':5,'files':len(state['files'])}));return
 if mode=='publish':
  current(BASE);proof=json.loads((STATE/'verified.json').read_text());assert proof['id']==state['id'] and proof['passed'] and proof['sourceCommit']==state['sourceCommit'];d=verify(state,b);assert not d.get('published_at')
  # A new, recorded, previously verified candidate only. Lock publishes it atomically.
  api('deploys/'+state['id']+'/lock','POST');current(state['id']);d=verify(state,b);assert d['locked'] and d.get('published_at')
  receipt={'id':state['id'],'siteId':SITE,'baseline':BASE,'sourceCommit':state['sourceCommit'],'publishedAt':d['published_at'],'url':'https://tree-token.xyz/play/','files':len(state['files']),'functionsPreserved':41,'functionsAdded':2,'schedulesPreserved':5,'oldEnvironmentEntriesPreserved':len(b['environment']['site']),'newEnvironmentEntries':0,'locked':True}
  save('published.json',receipt);print(json.dumps(receipt));return
 raise RuntimeError('Unknown mode')

def upload(state,b,d):
 current(BASE);envcheck(b);assert not d.get('published_at')
 packages={f['sha256']:f for f in state['newFunctions']}
 # Re-upload only original ZIP bytes matching the actual baseline; never rebuild an existing function.
 archives={}
 for folder in ['production','.netlify/arcade-quest-functions']:
  for path in (ROOT/folder).rglob('*.zip'):
   archives[hashlib.sha256(path.read_bytes()).hexdigest()]=path
 for f in b['deploy']['available_functions']:
  assert f['d'] in archives,'Original package missing: '+f['n']
  packages[f['d']]={'name':f['n'],'path':str(archives[f['d']]),'runtimeVersion':f['r'],'invocationMode':f['im'],'sha256':f['d']}
 assert not d.get('required_edge_functions') and not d.get('required_server')
 assert set(d.get('required_functions')or[])<=set(packages),'Refuse unknown function package upload'
 allowed={f['sha']:f for f in state['overlay']};assert set(d.get('required')or[])<=set(allowed),'Refuse unrelated static upload'
 def upload_function(sha):
  f=packages[sha];data=(ROOT/f['path']).read_bytes();assert hashlib.sha256(data).hexdigest()==sha
  api('deploys/'+state['id']+'/functions/'+f['name']+'?runtime='+f['runtimeVersion']+'&invocation_mode='+f['invocationMode'],'PUT',binary=data)
 from concurrent.futures import ThreadPoolExecutor
 with ThreadPoolExecutor(max_workers=6)as pool:list(pool.map(upload_function,d.get('required_functions')or[]))
 for sha in d.get('required')or[]:
  f=allowed[sha];api('deploys/'+state['id']+'/files'+urllib.parse.quote(f['path']),'PUT',binary=(ROOT/f['path'].lstrip('/')).read_bytes())
 current(BASE);print(json.dumps({'uploaded':state['id'],'newFunctions':2,'originalByteExactPackagesAvailable':41,'overlayFiles':len(state['overlay']),'productionChanged':False}))
if __name__=='__main__':
 try:run(sys.argv[1])
 except (AssertionError,RuntimeError)as e:print('Quest release stopped: '+str(e),file=sys.stderr);sys.exit(1)
 except Exception:print('Quest release stopped: local/network operation failed; credential details withheld.',file=sys.stderr);sys.exit(1)
