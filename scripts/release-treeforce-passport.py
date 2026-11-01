#!/usr/bin/env python3
"""Release the reviewed TREE FORCE Passport compatibility backend and UI.

Read-only: check; verify DEPLOY_ID; published DEPLOY_ID.
Create:   candidate --commit COMMIT --tree TREE --function-manifest PATH --function-sha256 SHA256
Publish:  publish DEPLOY_ID (requires a separate successful verify first).
All modes accept --baseline PATH. The default is the committed production capture.

Never rebuild unrelated handlers or publish an archived root snapshot. The complete
283-path / 41-function baseline is pinned below; only two frontend files and
the arcade-growth package may change. SQL activation is a separate later step. Locking publishes only this helper's new, recorded, verified candidate
in one operation. No previous deployment can be selected or relocked.
"""
import argparse
import copy
import datetime
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile


ROOT = Path(__file__).resolve().parents[1]
SITE_ID = 'aa62f324-b880-47d6-85b8-4ba0700ff5bf'
BASELINE_ID = '6ae75c44b387f8129ba60518'
BASELINE_SHA256 = 'e00aa58733a17a1bb8377380a2a5e865661b80a1c2d060cb2c6dd852e153567e'
SOURCE_ANCESTOR = '084032c5cc531b7b8c4e16acb5679e40e6b58dbe'
SOURCE_BRANCH = 'feature/treeforce-passport-20261101'
OVERLAY_PATHS = ('/play/index.html', '/scripts/arcade-daily-growth.js')
GENERATED_CONFIG_SHA1 = 'ac47414c8205343f1a87a5b7b48131aaa7b92856'
DEFAULT_BASELINE = ROOT / 'production/treeforce-passport-baseline.json'
STATE_DIR = ROOT / '.netlify/treeforce-passport'
CANDIDATE_PATH = STATE_DIR / 'candidate.json'
VERIFICATION_PATH = STATE_DIR / 'verified.json'
RECEIPT_PATH = ROOT / 'production/treeforce-passport-release.json'
FUNCTION_NAME = 'arcade-growth'
DEFAULT_FUNCTION_MANIFEST = ROOT / '.netlify/treeforce-passport-functions/manifest.json'
FUNCTION_MANIFEST_EVIDENCE = 'docs/treeforce-passport-function.json'
RUNTIME_FIELDS = ('available_functions', 'function_schedules', 'functions_region',
                  'functions_region_overrides', 'branch', 'context', 'database_branch_id',
                  'blobs_region', 'framework')
# database_snapshots contains host-generated on-publish event timestamps. Keep
# it in captured evidence/receipts, but do not treat event history as config.


class ReleaseError(Exception):
    pass


def check(condition, message):
    if not condition:
        raise ReleaseError(message)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def digest(value, algorithm='sha256'):
    return hashlib.new(algorithm, value).hexdigest()


def fingerprint(value):
    return digest(canonical(value))


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
    temporary.replace(path)


def git(*arguments):
    return subprocess.check_output(['git', *arguments], cwd=ROOT, stderr=subprocess.PIPE)


def complete_functions(records):
    check(isinstance(records, list) and len(records) == 41, 'Expected all 41 function records.')
    check(len({record.get('n') for record in records}) == 41, 'Function names must be unique.')
    for record in records:
        check(isinstance(record.get('n'), str) and re.fullmatch(r'[a-f0-9]{64}', record.get('d', '')),
              'Function package identity is missing or malformed.')
        check(all(key in record for key in ('id', 'a', 'r', 'rg', 'm', 'im')),
              'A full function provider/runtime record is missing.')


def migration_count(deploy):
    value = deploy.get('database_migrations')
    if value is None:
        return 0
    check(isinstance(value, dict) and isinstance(value.get('files'), list),
          'Unrecognized database migration metadata.')
    return len(value['files'])


def verify_runtime(actual, expected, replacement=None, pinned_record=None):
    complete_functions(expected['available_functions'])
    complete_functions(actual.get('available_functions'))
    check(len(expected['function_schedules']) == 5, 'Expected all five schedules.')
    if replacement is not None:
        verify_replacement_records(actual['available_functions'], expected['available_functions'], replacement, pinned_record)
    for field in RUNTIME_FIELDS:
        if replacement is not None and field == 'available_functions':
            continue
        check(actual.get(field) == expected.get(field), 'Runtime drift: ' + field)
    check(not actual.get('edge_functions_present') and not expected.get('edge_functions_present'),
          'Edge functions are outside this release.')
    check(not actual.get('server') and not expected.get('server'), 'Server bundles are outside this release.')
    check(migration_count(actual) == migration_count(expected) == 0, 'Database migrations are outside this release.')


def read_baseline(path):
    baseline = json.loads(path.read_text())
    check(fingerprint(baseline) == BASELINE_SHA256, 'The captured baseline changed; stop and review.')
    check(baseline['siteId'] == SITE_ID and baseline['deploy']['id'] == BASELINE_ID,
          'Unexpected baseline site or deployment.')
    check(baseline['deploy']['locked'] is True and baseline['deploy']['state'] == 'ready',
          'The captured baseline must be ready and locked.')
    files = baseline['files']
    check(isinstance(files, dict) and len(files) == 283, 'Expected exactly 283 baseline paths.')
    for path, sha in files.items():
        check(path.startswith('/') and path == path.lower() and re.fullmatch(r'[a-f0-9]{40}', sha),
              'Malformed public path or SHA1 in baseline.')
    check(files.get('/netlify.toml') == GENERATED_CONFIG_SHA1, 'Generated Netlify config identity changed.')
    verify_runtime(baseline['deploy'], baseline['deploy'])
    evidence = baseline['runtimeEvidence']
    check(evidence['deployEnvironmentOverrides'] == [] and
          evidence['releaseSourceCommit'] == '90ce9a5a308855c07b08597fa0341367842591b8' and
          evidence['releaseHelperGitBlob'] == '109721e6ef6dc71d220c7beabefd236192bc5806',
          'Current runtime environment provenance is missing.')
    return baseline


def configuration_for(records):
    complete_functions(records)
    configurations = {}
    route_keys = {'p': 'pattern', 'l': 'literal', 'e': 'expression', 'm': 'methods', 'ps': 'prefer_static'}
    config_keys = {'dn': 'display_name', 'g': 'generator', 'bd': 'build_data', 'p': 'priority',
                   'tr': 'traffic_rules', 'vcpu': 'vcpu', 'es': 'event_subscriptions'}
    for record in records:
        config = {long: record[short] for short, long in config_keys.items() if record.get(short) is not None}
        # mo/rgo are explicit overrides; m/rg include effective package defaults.
        # Canopy has no overrides. Adding its defaults would change the live
        # complete record and the existing 40-entry region override array.
        if record.get('mo') is not None:
            config['memory'] = record['mo']
        if record.get('rgo') is not None:
            config['region'] = record['rgo']
        for short, long in (('ro', 'routes'), ('er', 'excluded_routes')):
            if record.get(short) is not None:
                config[long] = [{name: route[key] for key, name in route_keys.items()
                                 if route.get(key) is not None} for route in record[short]]
        configurations[record['n']] = config
    return {'functions': {record['n']: record['d'] for record in records},
            'functions_config': configurations}


def source_path(value):
    check(isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9._/-]+', value) and
          not value.startswith('/') and all(part not in ('', '.', '..') for part in value.split('/')),
          'Unsafe package source path.')
    return value


def public_routes(record):
    routes = []
    for route in record.get('ro') or []:
        item = {long: route[short] for short, long in
                {'p': 'pattern', 'l': 'literal', 'e': 'expression', 'm': 'methods'}.items()
                if route.get(short) is not None}
        if route.get('ps'):
            item['prefer_static'] = True
        routes.append(item)
    return routes


def read_function_package(manifest_path, expected_sha256, baseline):
    check(re.fullmatch(r'[a-f0-9]{64}', expected_sha256 or ''), 'Pass the explicitly reviewed replacement ZIP SHA256.')
    resolved = manifest_path.resolve()
    check(resolved.is_relative_to(ROOT), 'The function manifest must be inside this checkout.')
    manifest = json.loads(resolved.read_text())
    check(json.loads((ROOT / FUNCTION_MANIFEST_EVIDENCE).read_text()) == manifest,
          'Package manifest differs from its committed review-evidence file.')
    fields = {'version', 'packager', 'name', 'path', 'sha256', 'runtimeVersion', 'invocationMode',
              'buildData', 'routes', 'trafficRules', 'sourceFiles'}
    check(set(manifest) == fields, 'Unexpected replacement-function manifest fields.')
    check(manifest['version'] == 1 and manifest['name'] == FUNCTION_NAME and manifest['sha256'] == expected_sha256,
          'Replacement-function identity differs from the reviewed package.')
    check(manifest['packager'] == {'name': '@netlify/zip-it-and-ship-it', 'version': '16.3.0'},
          'Use the existing pinned function packager.')
    path = source_path(manifest['path'])
    check(path in ('.netlify/treeforce-passport-functions/arcade-growth.zip',
                   '.netlify/arcade-growth-functions/arcade-growth.zip'),
          'The replacement ZIP must use its isolated packaging directory.')
    data = (ROOT / path).read_bytes()
    check(digest(data) == expected_sha256 and zipfile.is_zipfile(io.BytesIO(data)),
          'Replacement ZIP bytes differ from the approved SHA256 or are invalid.')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        check(0 < len(archive.infolist()) < 65535, 'Unexpected replacement ZIP inventory.')
        for entry in archive.infolist():
            name = entry.filename.rstrip('/')
            check(name and not name.startswith('/') and '\\' not in name and '\0' not in name and
                  all(part not in ('', '.', '..') for part in name.split('/')) and
                  ((entry.external_attr >> 16) & 0o170000) != 0o120000,
                  'Unsafe path or dependency symlink in replacement ZIP.')
    original = next(record for record in baseline['deploy']['available_functions'] if record['n'] == FUNCTION_NAME)
    check(expected_sha256 != original['d'] and
          all(record['d'] != expected_sha256 for record in baseline['deploy']['available_functions']),
          'The explicitly approved replacement must have a new package identity.')
    check(manifest['runtimeVersion'] == original['r'] == 'nodejs22.x' and
          manifest['invocationMode'] == original['im'] == 'stream', 'Function runtime or invocation mode changed.')
    check(manifest['buildData'] == original['bd'], 'Function bootstrap/runtime API metadata changed.')
    check(manifest['routes'] == public_routes(original), 'Function public routes or HTTP methods changed.')
    rules = copy.deepcopy(manifest['trafficRules'])
    config = rules.get('action', {}).get('config', {})
    if 'rateLimitConfig' in config:
        rate = config.pop('rateLimitConfig')
        check(set(rate) == {'algorithm', 'windowSize', 'windowLimit'}, 'Unexpected rate-limiter manifest fields.')
        config['rate_limit_config'] = {'algorithm': rate['algorithm'], 'window_size': rate['windowSize'],
                                     'window_limit': rate['windowLimit']}
    check(rules == original['tr'], 'Function rate limiting changed.')
    inputs = manifest['sourceFiles']
    check(isinstance(inputs, list) and inputs, 'Function source input evidence is missing.')
    seen = set()
    for item in inputs:
        check(set(item) == {'path', 'sha256'}, 'Unexpected function source evidence fields.')
        name = source_path(item['path'])
        check(re.fullmatch(r'(?:netlify/(?:functions|lib)/[A-Za-z0-9._/-]+|(?:vendor/arcade-growth-backend/)?package(?:-lock)?\.json)', name),
              'Function input is outside the approved backend/dependency sources.')
        check(name not in seen and re.fullmatch(r'[a-f0-9]{64}', item['sha256']), 'Duplicate or malformed source input identity.')
        seen.add(name)
        check(digest((ROOT / name).read_bytes()) == item['sha256'], 'Function input changed after packaging: ' + name)
    check({'netlify/functions/arcade-growth.ts', 'netlify/lib/arcade-growth-games.ts',
           'netlify/lib/arcade-treeforce-session.ts', 'package.json', 'package-lock.json',
           'vendor/arcade-growth-backend/package.json', 'vendor/arcade-growth-backend/package-lock.json'}.issubset(seen),
          'Function entry, game configuration, session verification, or dependency inputs are missing.')
    return {'manifest': manifest, 'manifestPath': resolved.relative_to(ROOT).as_posix(),
            'manifestSha256': fingerprint(manifest), 'sha256': expected_sha256, 'size': len(data), 'bytes': data}


def function_proof(package):
    return {key: package[key] for key in ('manifest', 'manifestPath', 'manifestSha256', 'sha256', 'size')}


def configuration_with_replacement(records, package):
    configuration = configuration_for(records)
    configuration['functions'][FUNCTION_NAME] = package['sha256']
    configuration['functions_config'][FUNCTION_NAME]['build_data'] = package['manifest']['buildData']
    return configuration


def verify_replacement_records(actual, expected, package, pinned_record=None):
    check([record for record in actual if record['n'] != FUNCTION_NAME] ==
          [record for record in expected if record['n'] != FUNCTION_NAME],
          'An unrelated complete function package/provider/configuration record changed.')
    original = next(record for record in expected if record['n'] == FUNCTION_NAME)
    record = next(record for record in actual if record['n'] == FUNCTION_NAME)
    check(record['d'] == package['sha256'] and record['bd'] == package['manifest']['buildData'],
          'Replacement function differs from its approved package/build metadata.')
    check(isinstance(record.get('a'), str) and re.fullmatch(r'\d{12}', record['a']) and
          isinstance(record.get('id'), str), 'Replacement function provider identity is incomplete.')
    # Netlify assigns the new package's provider/storage/telemetry identities.
    # Only these replacement-specific fields may change; every runtime/config
    # field stays exact. Pin the complete first verified record before publish.
    identity_fields = {'d', 'id', 'a', 'c', 's', 'bd', 'oid', 'oblv'}
    check({key: value for key, value in record.items() if key not in identity_fields} ==
          {key: value for key, value in original.items() if key not in identity_fields},
          'Replacement changed an unapproved runtime, memory, region, route, rate limit, or provider field.')
    if pinned_record is not None:
        check(record == pinned_record, 'The previously verified complete replacement record changed.')
    return record


def build_files(baseline, read_source=None):
    read_source = read_source or (lambda path: (ROOT / path.lstrip('/')).read_bytes())
    files = dict(baseline['files'])
    overlay = []
    for path in OVERLAY_PATHS:
        check(path in files, 'An approved overlay is absent from the baseline.')
        data = read_source(path)
        files[path] = digest(data, 'sha1')
        overlay.append({'path': path, 'sha': files[path], 'size': len(data)})
    changed = sorted(path for path in files if files[path] != baseline['files'][path])
    check(changed and set(changed).issubset(OVERLAY_PATHS), 'Only the two approved Passport interface files may change.')
    check(set(files) == set(baseline['files']) and len(files) == 283, 'Static paths were added or removed.')
    check(files['/netlify.toml'] == GENERATED_CONFIG_SHA1, 'Generated Netlify config must remain exact.')
    return files, overlay, changed


def verify_source(commit, tree, overlay, creating=False, package=None):
    check(re.fullmatch(r'[a-f0-9]{40}', commit or '') and re.fullmatch(r'[a-f0-9]{40}', tree or ''),
          'Pass the full approved source commit and Git tree IDs.')
    check(git('rev-parse', commit + '^{tree}').decode().strip() == tree, 'Approved full source tree changed.')
    git('merge-base', '--is-ancestor', SOURCE_ANCESTOR, commit)
    git('merge-base', '--is-ancestor', commit, 'HEAD')
    if creating:
        check(git('status', '--porcelain') == b'', 'Commit the reviewed source before candidate creation.')
        check(git('branch', '--show-current').decode().strip() == SOURCE_BRANCH, 'Use the reviewed feature branch.')
        check(git('rev-parse', 'HEAD').decode().strip() == commit, 'Candidate source must be the approved checkout HEAD.')
    check(tuple(item['path'] for item in overlay) == OVERLAY_PATHS, 'Candidate overlay allowlist changed.')
    for item in overlay:
        path = item['path'].lstrip('/')
        approved = git('show', commit + ':' + path)
        check(digest(approved, 'sha1') == item['sha'] and len(approved) == item['size'],
              'Candidate inventory differs from its committed source: ' + path)
        check((ROOT / path).read_bytes() == approved, 'Working source changed after review: ' + path)
    for path in ('package.json', 'package-lock.json', 'vendor/arcade-growth-backend/package.json',
                 'vendor/arcade-growth-backend/package-lock.json'):
        before = git('show', SOURCE_ANCESTOR + ':' + path)
        check(git('show', commit + ':' + path) == before and (ROOT / path).read_bytes() == before,
              'Root dependencies changed during the targeted Passport release.')
    if package is not None:
        check(json.loads(git('show', commit + ':' + FUNCTION_MANIFEST_EVIDENCE)) == package['manifest'],
              'Packaged function manifest differs from the approved source commit.')
        for item in package['manifest']['sourceFiles']:
            check(digest(git('show', commit + ':' + item['path'])) == item['sha256'],
                  'Packaged function input differs from the approved source commit: ' + item['path'])


class Netlify:
    def __init__(self):
        check(not os.environ.get('DEBUG'), 'Run credential-bearing release operations with DEBUG unset.')
        config = json.loads((Path.home() / '.config/netlify/config.json').read_text())
        auth = config['users'][config['userId']]['auth']
        self.token = os.environ.get('NETLIFY_AUTH_TOKEN') or (auth if isinstance(auth, str) else auth['token'])

    def request(self, endpoint, method='GET', body=None, binary=None):
        headers = {'Authorization': 'Bearer ' + self.token}
        data = None
        if body is not None:
            headers['Content-Type'] = 'application/json'
            # Preserve the baseline function order in the provider request.
            data = json.dumps(body, separators=(',', ':')).encode()
        if binary is not None:
            headers['Content-Type'] = 'application/octet-stream'
            data = binary
        request = urllib.request.Request('https://api.netlify.com/api/v1/' + endpoint,
                                         data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                raw = response.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as error:
            raise ReleaseError('Netlify request failed (HTTP ' + str(error.code) + '); raw details withheld.') from None

    def inventory(self, deploy_id):
        files = {}
        for page in range(1, 5):
            batch = self.request(f'deploys/{deploy_id}/files?per_page=100&page={page}')
            check(isinstance(batch, list), 'Invalid static inventory response.')
            for item in batch:
                check(item['path'] not in files, 'Duplicate static path.')
                files[item['path']] = item['sha']
            if len(batch) < 100:
                return files
        raise ReleaseError('Static inventory exceeds this bounded release.')

    def current_is(self, deploy_id, locked=True):
        site = self.request('sites/' + SITE_ID)
        check(site.get('id') == SITE_ID and site.get('published_deploy', {}).get('id') == deploy_id,
              'Production changed concurrently; stop and rebase the overlay.')
        if locked:
            check(site['published_deploy'].get('locked') is True, 'Current production is not locked.')
        return site

    def environment_is_unchanged(self, baseline, site):
        evidence = baseline['runtimeEvidence']
        check(site.get('account_id') == evidence['accountId'], 'Site account identity changed.')
        query = urllib.parse.urlencode({'site_id': SITE_ID, 'scope': 'functions'})
        values = self.request('accounts/' + evidence['accountId'] + '/env?' + query)
        check(isinstance(values, list) and len(values) == evidence['siteFunctionsEnvironmentEntries'],
              'Site function environment inventory changed.')
        check(fingerprint(sorted(values, key=canonical)) == evidence['siteFunctionsEnvironmentSha256'],
              'Site function environment settings changed.')
        shared = self.request('accounts/' + evidence['accountId'] + '/env?scope=functions')
        check(isinstance(shared, list) and len(shared) == evidence['sharedAccountFunctionsEnvironmentEntries'],
              'Shared account function environment inventory changed.')
        check(fingerprint(sorted(shared, key=canonical)) == evidence['sharedAccountFunctionsEnvironmentSha256'],
              'Shared account function environment settings changed.')
        check(fingerprint(site.get('build_settings', {}).get('env', {})) == evidence['siteBuildEnvironmentSha256'],
              'Legacy site build environment changed.')
        # Values remain only in memory and are never saved or printed.

    def baseline_integrity(self, baseline):
        live = self.request('deploys/' + BASELINE_ID)
        check(live.get('site_id') == SITE_ID and live.get('id') == BASELINE_ID and live.get('state') == 'ready',
              'Baseline deployment identity or ready state changed.')
        verify_runtime(live, baseline['deploy'])
        check(self.inventory(BASELINE_ID) == baseline['files'], 'Baseline static inventory changed.')
        return live

    def preflight(self, baseline):
        site = self.current_is(BASELINE_ID)
        live = self.baseline_integrity(baseline)
        check(live.get('locked') is True, 'The original publication lock changed.')
        self.environment_is_unchanged(baseline, site)
        self.current_is(BASELINE_ID)
        return live


def candidate_proof(state):
    return {key: state[key] for key in ('id', 'siteId', 'baseline', 'baselineSha256',
            'sourceCommit', 'sourceTree', 'sourceBranch', 'filesSha256', 'overlay',
            'functionPackage', 'replacementRecord')}


def read_state(deploy_id, baseline):
    check(re.fullmatch(r'[a-f0-9]{24}', deploy_id or '') and deploy_id != BASELINE_ID,
          'Pass the exact newly recorded candidate ID.')
    state = json.loads(CANDIDATE_PATH.read_text())
    check(state['id'] == deploy_id and state['siteId'] == SITE_ID and state['baseline'] == BASELINE_ID,
          'Candidate identity does not match the recorded release.')
    check(state['baselineSha256'] == BASELINE_SHA256 and state['sourceBranch'] == SOURCE_BRANCH,
          'Candidate baseline or source branch changed.')
    files, overlay, changed = build_files(baseline)
    check(state['files'] == files and state['filesSha256'] == fingerprint(files) and state['overlay'] == overlay,
          'Candidate files changed after creation.')
    recorded_package = state['functionPackage']
    package = read_function_package(ROOT / source_path(recorded_package['manifestPath']), recorded_package['sha256'], baseline)
    check(function_proof(package) == recorded_package, 'Replacement function package/evidence changed after candidate creation.')
    verify_source(state['sourceCommit'], state['sourceTree'], overlay, package=package)
    return state, changed, package


def verify_candidate(api, baseline, state, package, wait=False):
    for attempt in range(45 if wait else 1):
        candidate = api.request('deploys/' + state['id'])
        if candidate.get('state') == 'ready':
            break
        check(candidate.get('state') not in ('error', 'canceled'), 'Candidate deployment failed.')
        if wait:
            time.sleep(1)
    check(candidate.get('id') == state['id'] and candidate.get('site_id') == SITE_ID and
          candidate.get('state') == 'ready', 'Recorded candidate is not ready on the expected site.')
    check(candidate['id'] != BASELINE_ID and candidate.get('created_at', '') > baseline['deploy']['created_at'],
          'Refuse any previous deployment; only this new candidate can be published.')
    check(candidate.get('commit_ref') in (None, state['sourceCommit']), 'Candidate source metadata differs.')
    verify_runtime(candidate, baseline['deploy'], replacement=package, pinned_record=state.get('replacementRecord'))
    check(api.inventory(state['id']) == state['files'], 'Candidate static inventory differs from the approved overlay.')
    if state.get('replacementRecord') is None:
        state['replacementRecord'] = next(record for record in candidate['available_functions'] if record['n'] == FUNCTION_NAME)
        save(CANDIDATE_PATH, state)
    return candidate


def write_receipt(api, baseline, state, candidate, changed):
    site = api.current_is(state['id'])
    check(candidate.get('locked') is True and candidate.get('published_at'), 'New publication is not ready and locked.')
    previous = api.baseline_integrity(baseline)
    api.environment_is_unchanged(baseline, site)
    receipt = {**candidate_proof(state), 'publishedAt': candidate['published_at'], 'verifiedAt': now(),
               'locked': True, 'files': 283, 'filesBySha1': state['files'], 'changedExistingPaths': changed,
               'preservedStaticFiles': 283 - len(changed), 'newPaths': [], 'functionsPreserved': 40,
               'functionsReplaced': [FUNCTION_NAME], 'replacementPackageSha256': state['functionPackage']['sha256'],
               'functionRecords': candidate['available_functions'], 'functionSchedules': candidate['function_schedules'],
               'schedulesPreserved': 5, 'runtime': {key: candidate.get(key) for key in RUNTIME_FIELDS
                                                if key not in ('available_functions', 'function_schedules')},
               'databaseSnapshotEvents': candidate.get('database_snapshots'),
               'generatedNetlifyConfigSha1': GENERATED_CONFIG_SHA1, 'environmentEvidence': baseline['runtimeEvidence'],
               'previousDeployLocked': previous.get('locked'),
               'publicationLockScope': 'current publication only; do not relock an earlier deployment',
               'databaseActivation': 'Separate reviewed SQL step after compatible backend/UI publication; this helper never applies SQL.',
               'rolloutOrder': ['publish compatibility backend and UI while existing required-game data remains valid',
                                'apply the reviewed atomic SQL activation separately',
                                'verify canonical status reports four required Passport games'],
               'url': 'https://tree-token.xyz/play/',
               'candidateUrl': 'https://' + state['id'] + '--tree-token.netlify.app/play/'}
    save(RECEIPT_PATH, receipt)
    return receipt


def run(args):
    baseline = read_baseline(args.baseline)
    api = Netlify()
    if args.mode == 'check':
        api.preflight(baseline)
        print(json.dumps({'mode': 'check', 'baseline': BASELINE_ID, 'staticPaths': 283,
                          'completeFunctions': 41, 'schedules': 5, 'locked': True,
                          'environmentUnchanged': True, 'remoteMethods': ['GET']}))
        return
    if args.mode == 'candidate':
        check(args.deploy_id is None and not CANDIDATE_PATH.exists(), 'A candidate already exists or an existing ID was supplied.')
        files, overlay, changed = build_files(baseline)
        package = read_function_package(args.function_manifest, args.function_sha256, baseline)
        verify_source(args.commit, args.tree, overlay, creating=True, package=package)
        live = api.preflight(baseline)
        payload = {'files': files, **configuration_with_replacement(live['available_functions'], package),
                   'function_schedules': live['function_schedules'], 'draft': False, 'async': False,
                   'branch': live['branch'], 'commit_ref': args.commit}
        # The exact invitation baseline source omitted deploy-specific environment.
        # Reuse its main/production settings; do not add obsolete TREEFORCE overrides.
        api.current_is(BASELINE_ID)
        title = urllib.parse.quote('TREE Arcade: TREE FORCE monthly Passport - preserved live site')
        created = api.request('sites/' + SITE_ID + '/deploys?title=' + title, 'POST', payload)
        check(re.fullmatch(r'[a-f0-9]{24}', created.get('id', '')), 'Candidate creation returned no valid ID.')
        state = {'id': created['id'], 'siteId': SITE_ID, 'baseline': BASELINE_ID,
                 'baselineSha256': BASELINE_SHA256, 'sourceCommit': args.commit, 'sourceTree': args.tree,
                 'sourceBranch': SOURCE_BRANCH, 'sourceAncestor': SOURCE_ANCESTOR,
                 'files': files, 'filesSha256': fingerprint(files), 'overlay': overlay,
                 'functionPackage': function_proof(package), 'replacementRecord': None, 'recordedAt': now()}
        save(CANDIDATE_PATH, state)
        print(json.dumps({'candidateRecorded': state['id'], 'sourceCommit': args.commit}), flush=True)
        check(created['id'] != BASELINE_ID and not created.get('published_at'), 'Candidate unexpectedly published; inspect recorded state.')
        required_functions = created.get('required_functions') or []
        check(isinstance(required_functions, list) and all(sha == package['sha256'] for sha in required_functions),
              'Refusing every function upload except the explicitly approved arcade-growth package.')
        for key in ('required_edge_functions', 'required_server'):
            check(created.get(key) in (None, []), 'Refusing an unexpected backend/server upload: ' + key)
        required = created.get('required') or []
        check(isinstance(required, list) and all(any(item['sha'] == sha for item in overlay) for sha in required),
              'Refusing any unrelated static upload.')
        if required_functions:
            api.current_is(BASELINE_ID)
            api.request('deploys/' + state['id'] + '/functions/' + FUNCTION_NAME +
                        '?runtime=nodejs22.x&invocation_mode=stream', 'PUT', binary=package['bytes'])
        for sha in required:
            api.current_is(BASELINE_ID)
            item = next(item for item in overlay if item['sha'] == sha)
            data = (ROOT / item['path'].lstrip('/')).read_bytes()
            check(digest(data, 'sha1') == sha and len(data) == item['size'], 'An overlay changed before upload.')
            api.request('deploys/' + state['id'] + '/files' + urllib.parse.quote(item['path']), 'PUT', binary=data)
        candidate = verify_candidate(api, baseline, state, package, wait=True)
        api.current_is(BASELINE_ID)
        check(not candidate.get('published_at'), 'Candidate must remain unpublished for review.')
    else:
        state, changed, package = read_state(args.deploy_id, baseline)
        if args.mode != 'published':
            api.preflight(baseline)
        candidate = verify_candidate(api, baseline, state, package)
        if args.mode == 'verify':
            check(not candidate.get('published_at'), 'Review verification requires an unpublished candidate.')
            api.current_is(BASELINE_ID)
            save(VERIFICATION_PATH, {**candidate_proof(state), 'verifiedAt': now(), 'unpublished': True, 'passed': True})
        elif args.mode == 'publish':
            prior = json.loads(VERIFICATION_PATH.read_text())
            check(prior.get('passed') is True and prior.get('unpublished') is True and
                  all(prior.get(key) == value for key, value in candidate_proof(state).items()),
                  'Publish requires successful prior verification of this exact candidate and source.')
            check(not candidate.get('published_at'), 'Only the newly reviewed, never-published candidate can be published.')
            api.current_is(BASELINE_ID)
            # Lock is the single publication operation used by the current Canopy
            # release. Only this new, recorded, verified candidate reaches here.
            try:
                api.request('deploys/' + state['id'] + '/lock', 'POST')
            except Exception:
                # An ambiguous response succeeds only if readback proves that
                # this exact candidate is now published and locked.
                api.current_is(state['id'])
            api.current_is(state['id'])
            candidate = verify_candidate(api, baseline, state, package)
            write_receipt(api, baseline, state, candidate, changed)
        elif args.mode == 'published':
            write_receipt(api, baseline, state, candidate, changed)
    print(json.dumps({'mode': args.mode, 'id': state['id'], 'baseline': BASELINE_ID,
                      'sourceCommit': state['sourceCommit'], 'sourceTree': state['sourceTree'],
                      'files': 283, 'changedExistingPaths': changed, 'preservedStaticFiles': 283 - len(changed),
                      'functionsPreserved': 40, 'functionsReplaced': [FUNCTION_NAME],
                      'replacementPackageSha256': package['sha256'], 'schedulesPreserved': 5,
                      'published': bool(candidate.get('published_at')), 'locked': bool(candidate.get('locked'))}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('check', 'candidate', 'verify', 'publish', 'published'))
    parser.add_argument('deploy_id', nargs='?')
    parser.add_argument('--baseline', type=Path, default=DEFAULT_BASELINE)
    parser.add_argument('--commit')
    parser.add_argument('--tree')
    parser.add_argument('--function-manifest', type=Path, default=DEFAULT_FUNCTION_MANIFEST)
    parser.add_argument('--function-sha256')
    args = parser.parse_args()
    try:
        run(args)
    except ReleaseError as error:
        print('TREE FORCE Passport release stopped: ' + str(error), file=sys.stderr)
        return 1
    except Exception:
        print('TREE FORCE Passport release stopped: local or network operation failed; raw details withheld to protect credentials.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
