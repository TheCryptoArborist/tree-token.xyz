"""Read original CI artifacts; retain only ZIP bytes matching pinned live hashes."""
import concurrent.futures, hashlib, io, json, os, pathlib, urllib.request, zipfile
ROOT=pathlib.Path(__file__).resolve().parent.parent
OUT=ROOT/'production/recovered-function-archives'
DOC=ROOT/'docs/multichain/generation-milestone/package-recovery'
plan=json.loads((ROOT/'docs/multichain/generation-milestone/run-enablement/plan.json').read_text())
wanted={f['d']:f['n'] for f in plan['baseline']['deploy']['available_functions']}
artifacts=json.loads((DOC/'artifacts.json').read_text())
OUT.mkdir(exist_ok=True)
def matches(data, source, depth=0):
    digest=hashlib.sha256(data).hexdigest()
    if digest in wanted:
        return [(digest, data, source)]
    if depth>=3 or not zipfile.is_zipfile(io.BytesIO(data)): return []
    result=[]
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for entry in z.infolist():
            # Never extract paths or execute artifact contents.
            if entry.filename.endswith('.zip') and entry.file_size<=50*1024*1024:
                result.extend(matches(z.read(entry),source+[entry.filename],depth+1))
    return result
def inspect(a):
    req=urllib.request.Request(f"https://api.github.com/repos/TheCryptoArborist/tree-token.xyz/actions/artifacts/{a['id']}/zip",headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json'})
    try:
        with urllib.request.urlopen(req,timeout=45) as r: data=r.read(100*1024*1024+1)
        if len(data)>100*1024*1024: raise ValueError('Artifact exceeds limit')
        return a,matches(data,[]),None
    except Exception as e:
        # Do not print signed URLs, token headers or response bodies.
        return a,[],type(e).__name__
found={}; errors=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for a,results,error in pool.map(inspect,artifacts):
        if error: errors.append({'artifactId':a['id'],'errorType':error})
        for digest,data,entries in results:
            name=wanted[digest]; path=OUT/(name+'.zip')
            if name in found: continue
            path.write_bytes(data)
            found[name]={'name':name,'sha256':digest,'bytes':len(data),'path':str(path.relative_to(ROOT)),'artifactId':a['id'],'artifactName':a['name'],'runId':a['workflow_run']['id'],'entries':entries}
            print('RECOVERED',name,digest,flush=True)
report={'baselineId':plan['baselineId'],'artifactsInspected':len(artifacts),'recovered':list(found.values()),'unmatched':[{'name':n,'sha256':h} for h,n in wanted.items() if n not in found],'errors':errors,'productionChanged':False,'packagesRebuilt':False}
(DOC/'recovered.json').write_text(json.dumps(report,indent=2)+'\n')
print('RECOVERY_SUMMARY',json.dumps({'matches':len(found),'errors':len(errors),'unmatched':len(report['unmatched'])}))
