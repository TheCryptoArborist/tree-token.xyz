#!/usr/bin/env python3
"""Publish only Deadfall Run and its cabinet, reusing the pinned live inventory.

Usage: python3 scripts/release-deadfall-preserved.py prepare|verify|promote
The existing live deploy must remain locked until the verified new candidate is
explicitly promoted. No backend rebuilds or archive-based full-site uploads.
API schema: https://open-api.netlify.com/#tag/deploy
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = json.loads((ROOT / 'production/deadfall-baseline/inventory.json').read_text())
STATE_DIR = ROOT / '.netlify/deadfall'
STATE_DIR.mkdir(parents=True, exist_ok=True)
STATE_PATH = STATE_DIR / 'candidate.json'
SITE = BASE['siteId']
MODE = sys.argv[1] if len(sys.argv) > 1 else ''
assert MODE in ('prepare', 'verify', 'promote'), __doc__
config = json.loads((Path.home() / '.config/netlify/config.json').read_text())
auth = config['users'][config['userId']]['auth']
TOKEN = os.environ.get('NETLIFY_AUTH_TOKEN') or (auth if isinstance(auth, str) else auth['token'])


def api(endpoint, method='GET', body=None):
    headers = {'Authorization': 'Bearer ' + TOKEN}
    data = None
    if body is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(body).encode()
    request = urllib.request.Request('https://api.netlify.com/api/v1/' + endpoint,
                                     data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def inventory(deploy_id):
    files = {}
    page = 1
    while True:
        batch = api(f'deploys/{deploy_id}/files?per_page=100&page={page}')
        files.update({f['path']: f['sha'] for f in batch})
        if len(batch) < 100:
            return files
        page += 1


def functions(records):
    # Netlify can materialize existing effective defaults in reused packages.
    # Compare every provider/config field, with only these equivalent aliases
    # normalized. Rate limits, observability, routes and runtime remain exact.
    result = []
    for record in records:
        f = dict(record)
        f['m'] = f.get('m', f.get('mo', 1024))
        f['rg'] = f.get('rg', f.get('rgo', 'us-east-2'))
        f.pop('mo', None)
        f.pop('rgo', None)
        result.append(f)
    return sorted(result, key=lambda f: f['n'])


def schedules(records):
    return sorted(records, key=lambda f: f['name'])


def assert_baseline_live():
    current = api('sites/' + SITE)['published_deploy']
    assert current['id'] == BASE['id'], 'Production changed; rebase the overlay onto the new live baseline.'
    live = api('deploys/' + BASE['id'])
    assert live['locked'] is True, 'Existing production must stay locked.'
    assert live['functions_region'] == BASE['functionsRegion'] == 'cmh'
    assert functions(live['available_functions']) == functions(BASE['functions'])
    assert schedules(live['function_schedules']) == schedules(BASE['schedules'])
    assert not live.get('edge_functions_present') and not live.get('server')
    assert not (live.get('database_migrations') or {}).get('files')
    assert inventory(BASE['id']) == BASE['files']
    return live


def sha(data):
    return hashlib.sha1(data).hexdigest()


def local_changes():
    files = {'/play/index.html': ROOT / 'play/index.html'}
    game = ROOT / 'play/deadfall-run'
    for source in game.rglob('*'):
        if not source.is_file():
            continue
        rel = source.relative_to(game)
        if len(rel.parts) == 1 and source.suffix in ('.html', '.js', '.css', '.svg') or str(rel) == 'vendor/three.min.js' or str(rel) == 'third-party-notices.txt':
            files['/play/deadfall-run/' + rel.as_posix()] = source
    assert len(files) >= 10
    before = (ROOT / 'production/deadfall-baseline/play-index.html').read_text()
    after = files['/play/index.html'].read_text()
    old = re.findall(r'          <article class="game-poster poster--future future--one".*?</article>', before, re.S)
    assert len(old) == 1
    reverted, count = re.subn(r'          <article class="game-poster poster--deadfall".*?</article>', lambda _: old[0], after, count=1, flags=re.S)
    assert count == 1 and reverted == before, 'Lobby must change exactly one cabinet.'
    return files


def verify_candidate(state):
    d = api('deploys/' + state['id'])
    assert d['state'] == 'ready', d['state']
    assert d['functions_region'] == BASE['functionsRegion']
    assert functions(d['available_functions']) == functions(BASE['functions']), 'Function/provider/configuration mismatch'
    assert schedules(d['function_schedules']) == schedules(BASE['schedules']), 'Schedule mismatch'
    assert not d.get('edge_functions_present') and not d.get('server')
    assert not (d.get('database_migrations') or {}).get('files')
    assert inventory(d['id']) == state['files'], 'Static inventory mismatch'
    for path, source in local_changes().items():
        assert sha(source.read_bytes()) == state['files'][path], 'Local source changed: ' + path
    (STATE_DIR / 'verified-deploy.json').write_text(json.dumps(d, indent=2) + '\n')
    return d


live = assert_baseline_live()
if MODE == 'prepare':
    changes = local_changes()
    files = dict(BASE['files'])
    files.update({p: sha(s.read_bytes()) for p, s in changes.items()})
    assert all(p == '/play/index.html' or p.startswith('/play/deadfall-run/') for p in files if files.get(p) != BASE['files'].get(p))
    assert all(p in files for p in BASE['files'])
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    for path, source in changes.items():
        tracked = subprocess.check_output(['git', 'show', commit + ':' + str(source.relative_to(ROOT))], cwd=ROOT)
        assert sha(tracked) == files[path], 'Commit all release bytes first: ' + path
    function_configs = {}
    for f in BASE['functions']:
        c = {}
        for from_key, to_key in {'dn': 'display_name', 'g': 'generator', 'bd': 'build_data', 'm': 'memory', 'p': 'priority', 'rg': 'region', 'tr': 'traffic_rules'}.items():
            v = f.get(from_key)
            if v is not None:
                c[to_key] = v
        if 'memory' not in c and f.get('mo') is not None:
            c['memory'] = f['mo']
        if 'region' not in c and f.get('rgo') is not None:
            c['region'] = f['rgo']
        if f.get('ro') is not None:
            c['routes'] = [{long: r[short] for short, long in {'p': 'pattern', 'l': 'literal', 'e': 'expression', 'm': 'methods', 'ps': 'prefer_static'}.items() if r.get(short) is not None} for r in f['ro']]
        function_configs[f['n']] = c
    payload = {'files': files, 'functions': {f['n']: f['d'] for f in BASE['functions']},
               'functions_config': function_configs, 'function_schedules': BASE['schedules'],
               'draft': False, 'async': False, 'branch': live['branch'], 'commit_ref': commit}
    d = api(f'sites/{SITE}/deploys?title=Deadfall%20Run%203D%20play%20test%20-%20preserved%20live%20site', 'POST', payload)
    state = {'id': d['id'], 'baseline': BASE['id'], 'sourceCommit': commit, 'files': files,
             'changedPaths': sorted(changes), 'url': 'https://tree-token.xyz/play/deadfall-run/'}
    STATE_PATH.write_text(json.dumps(state, indent=2) + '\n')
    assert not d.get('required_functions'), 'Existing backend packages must be reused without upload.'
    assert not d.get('required_edge_functions') and not d.get('required_server')
    for digest in d.get('required', []):
        matches = [(p, s) for p, s in changes.items() if files[p] == digest]
        assert matches, 'Refusing to upload an unrelated static file.'
        path, source = matches[0]
        request = urllib.request.Request(f'https://api.netlify.com/api/v1/deploys/{d["id"]}/files{path}',
            data=source.read_bytes(), headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/octet-stream'}, method='PUT')
        with urllib.request.urlopen(request, timeout=45) as response:
            assert response.status in (200, 201)
    print(json.dumps({'candidate': d['id'], 'uploaded': len(d.get('required', [])), 'sourceCommit': commit}), flush=True)
    for _ in range(60):
        d = api('deploys/' + state['id'])
        if d['state'] == 'ready':
            break
        assert d['state'] != 'error', d.get('error_message')
        time.sleep(1)
else:
    state = json.loads(STATE_PATH.read_text())
    assert state['baseline'] == BASE['id']

ready = verify_candidate(state)
assert api('sites/' + SITE)['published_deploy']['id'] == BASE['id'], 'Production changed during verification.'
if MODE == 'promote':
    # This activates only the newly created, fully verified candidate above;
    # it never restores a historical release or unlocks automatic publishing.
    api(f'sites/{SITE}/deploys/{state["id"]}/restore', 'POST')
    api(f'deploys/{state["id"]}/lock', 'POST')
    assert api('sites/' + SITE)['published_deploy']['id'] == state['id']
    ready = verify_candidate(state)
    assert ready['locked'] is True
    report = {**state, 'published': True, 'locked': True, 'functionConfigurations': ready['available_functions'],
              'schedules': ready['function_schedules'], 'functionsRegion': ready['functions_region']}
    (ROOT / 'production/deadfall-release.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'mode': MODE, 'id': ready['id'], 'files': len(state['files']), 'functionsPreserved': len(BASE['functions']), 'schedulesPreserved': len(BASE['schedules']), 'published': MODE == 'promote'}), flush=True)
