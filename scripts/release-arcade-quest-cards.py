"""Publish only the compact quest HTML/CSS over the verified 43-function release."""
import importlib.util
import json
import hashlib
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('quest_release', ROOT/'scripts/release-arcade-quests.py')
q = importlib.util.module_from_spec(spec)
spec.loader.exec_module(q)
BASE = '6aebe195dff096f7428fe1b0'
STATE = ROOT/'.netlify/arcade-quest-cards'
STATE.mkdir(parents=True, exist_ok=True)
OVERLAY = ['/play/index.html', '/styles/tree-arcade-suite.css']

def read(name):
    return json.loads((STATE/name).read_text())

def save(name, value):
    p = STATE/name
    p.write_text(json.dumps(value, indent=2)+'\n')
    p.chmod(0o600)

def envcheck(b):
    assert q.environment() == b['environment'], 'Environment records changed'
    site = q.api('sites/'+q.SITE)
    assert q.digest(site.get('build_settings', {}).get('env', {})) == b['buildEnvironmentHash'], 'Build environment changed'

def verify(s, b):
    d = q.api('deploys/'+s['id'])
    assert d['state'] == 'ready', 'Candidate not ready'
    for k in ['available_functions', *q.RUNTIME]:
        assert d.get(k) == b['deploy'].get(k), 'Runtime/provider change: '+k
    assert len(d['available_functions']) == 43 and len(d['function_schedules']) == 5
    assert q.inventory(s['id']) == s['files'], 'Static inventory mismatch'
    envcheck(b)
    return d

def sourcecheck(s):
    for f in s['overlay']:
        data = (ROOT/f['path'].lstrip('/')).read_bytes()
        assert hashlib.sha1(data).hexdigest() == f['sha'], 'Overlay source changed'
    assert subprocess.check_output(['git','status','--porcelain','--',*[p.lstrip('/')for p in OVERLAY]],cwd=ROOT,text=True).strip() == '', 'Uncommitted presentation source'

def run(mode):
    if mode == 'capture':
        assert not (STATE/'baseline.json').exists(), 'Baseline already captured'
        site = q.current(BASE)
        d = q.api('deploys/'+BASE)
        assert d['state'] == 'ready' and len(d['available_functions']) == 43 and len(d['function_schedules']) == 5
        save('baseline.json', {'siteId':q.SITE,'deploy':{k:d.get(k) for k in ['id','site_id','state','locked','created_at','published_at','available_functions',*q.RUNTIME]},'files':q.inventory(BASE),'environment':q.environment(),'buildEnvironmentHash':q.digest(site.get('build_settings',{}).get('env',{}))})
        print(json.dumps({'captured':BASE,'functions':43,'schedules':5}),flush=True)
        return
    b = read('baseline.json')
    if mode == 'candidate':
        assert not (STATE/'candidate.json').exists(), 'Candidate already recorded'
        q.current(BASE)
        envcheck(b)
        files = dict(b['files'])
        overlays = []
        for path in OVERLAY:
            data = (ROOT/path.lstrip('/')).read_bytes()
            assert path in files
            files[path] = hashlib.sha1(data).hexdigest()
            overlays.append({'path':path,'sha':files[path],'size':len(data)})
        assert len(files) == 290 and all(files[p] == sha for p,sha in b['files'].items() if p not in OVERLAY)
        archives = {hashlib.sha256(p.read_bytes()).hexdigest():p for p in (ROOT/'production').rglob('*.zip')}
        old = b['deploy']['available_functions']
        assert all(f['d'] in archives for f in old), 'Exact original archive missing'
        commit = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
        state = {'baseline':BASE,'sourceCommit':commit,'files':files,'overlay':overlays}
        sourcecheck(state)
        payload = {'files':files,'functions':{f['n']:f['d']for f in old},'functions_config':q.config_for(old),'function_schedules':b['deploy']['function_schedules'],'draft':False,'async':True,'branch':b['deploy']['branch'],'commit_ref':commit}
        created = q.api('sites/'+q.SITE+'/deploys?title='+quote('Compact illustrated Arcade quests; SuiDex and Kelpie follows; preserved 43 backends'),'POST',payload)
        state['id'] = created['id']
        save('candidate.json',state)
        print(json.dumps({'candidateRecorded':state['id']}),flush=True)
        assert not created.get('published_at')
        d = created
        deadline = time.monotonic()+45
        while d['state'] not in ['prepared','uploading','uploaded','processing','ready']:
            assert d['state'] not in ['error','canceled'] and time.monotonic() < deadline
            time.sleep(1)
            d = q.api('deploys/'+state['id'])
        assert not d.get('required_edge_functions') and not d.get('required_server')
        packages = {f['d']:f for f in old}
        allowed = {f['sha']:f for f in overlays}
        assert set(d.get('required_functions')or[]) <= set(packages)
        assert set(d.get('required')or[]) <= set(allowed)
        def upload(sha):
            f = packages[sha]
            data = archives[sha].read_bytes()
            assert hashlib.sha256(data).hexdigest() == sha
            q.api('deploys/'+state['id']+'/functions/'+f['n']+'?runtime='+f['r']+'&invocation_mode='+f['im'],'PUT',binary=data)
        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(upload,d.get('required_functions')or[]))
        for sha in d.get('required')or[]:
            f = allowed[sha]
            data = (ROOT/f['path'].lstrip('/')).read_bytes()
            assert hashlib.sha1(data).hexdigest() == sha
            q.api('deploys/'+state['id']+'/files'+quote(f['path']),'PUT',binary=data)
        q.current(BASE)
        print(json.dumps({'uploaded':state['id'],'productionChanged':False}),flush=True)
        return
    s = read('candidate.json')
    sourcecheck(s)
    q.current(BASE)
    d = verify(s,b)
    assert not d.get('published_at'), 'New unpublished candidate required'
    if mode == 'verify':
        save('verified.json',{'id':s['id'],'sourceCommit':s['sourceCommit'],'passed':True})
        print(json.dumps({'verified':s['id'],'functionsPreserved':43,'schedulesPreserved':5,'files':290}))
        return
    assert mode == 'publish'
    proof = read('verified.json')
    assert proof == {'id':s['id'],'sourceCommit':s['sourceCommit'],'passed':True}
    q.current(BASE)
    q.api('deploys/'+s['id']+'/lock','POST')
    q.current(s['id'])
    d = verify(s,b)
    assert d['locked'] and d.get('published_at')
    save('published.json',{'id':s['id'],'siteId':q.SITE,'baseline':BASE,'sourceCommit':s['sourceCommit'],'publishedAt':d['published_at'],'locked':True,'files':290,'filesBySha1':s['files'],'overlay':s['overlay'],'functionsPreserved':43,'functionRecords':d['available_functions'],'functionSchedules':d['function_schedules'],'schedulesPreserved':5,'runtime':{k:d.get(k)for k in q.RUNTIME},'environmentEvidence':{'unchanged':True,'siteRecordCount':len(b['environment']['site']),'sharedRecordCount':len(b['environment']['shared'])},'url':'https://tree-token.xyz/play/'})
    print(json.dumps({'published':s['id'],'functionsPreserved':43,'schedulesPreserved':5}),flush=True)

if __name__ == '__main__':
    try:
        run(sys.argv[1])
    except (AssertionError,RuntimeError) as e:
        print('Quest cards release stopped: '+str(e),file=sys.stderr)
        sys.exit(1)
    except Exception:
        print('Quest cards release stopped: local/network operation failed; credential details withheld.',file=sys.stderr)
        sys.exit(1)
