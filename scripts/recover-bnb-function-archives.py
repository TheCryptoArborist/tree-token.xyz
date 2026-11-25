"""Read original CI artifacts; retain only ZIP bytes matching pinned live hashes."""
import concurrent.futures, hashlib, io, json, pathlib, zipfile
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
    directory=pathlib.Path('/tmp/bnb-original-artifacts')/str(a['id'])
    if not directory.exists(): return a,[],'ArtifactDownloadUnavailable'
    result=[]
    for path in directory.rglob('*.zip'):
        if path.is_file() and path.stat().st_size<=50*1024*1024:
            result.extend(matches(path.read_bytes(),[str(path.relative_to(directory))]))
    return a,result,None
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
print('RECOVERY_ERRORS',json.dumps(errors[:3]))
print('RECOVERY_SUMMARY',json.dumps({'matches':len(found),'errors':len(errors),'unmatched':len(report['unmatched'])}))
