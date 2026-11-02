#!/usr/bin/env python3
"""Guarded TREE Arcade session-return and missing participation-binding repair.

Read-only remote actions: check (GET only), verify ID, published ID.
Pure local checks: guards (writes the sanitized, deterministic guard report).
Root-reviewed mutation phases, each requiring committed reviewed source:
  configure --commit FULL_COMMIT --tree FULL_TREE
  candidate --commit FULL_COMMIT --tree FULL_TREE
  publish NEW_CANDIDATE_ID (requires prior separate successful verify).

Configure creates only the missing production/functions database secret using
its existing isolated branch. No credentials are saved or printed. Candidate
preserves 284 paths, 41 full function records and five schedules; exactly one
frontend path changes. No backend rebuild, database writes, deploy-specific
environment overrides, paid-continue changes, or old-deploy restoration.
Verify/published use a synthetic nonexistent game credential to exercise the
hosted read-only authentication path: HTTP 401 invalid-game-session is required.
"""
import argparse
import copy
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
SITE_ID = 'aa62f324-b880-47d6-85b8-4ba0700ff5bf'
BASELINE_ID = '6ae7f8a9183c770b8f0eb50c'
BASELINE_SHA256 = '67e7f1d86a7aefd1d871415c8b6811428a6523797a4e6c44dd0cedf662a2b2d8'
SOURCE_ANCESTOR = 'caed1e3f96a3496537515fc46d9cb1bd7fd9e9eb'
SOURCE_BRANCH = 'fix/arcade-session-return-20261102'
OVERLAY_PATHS = ('/scripts/arcade-daily-growth.js',)
GENERATED_CONFIG_SHA1 = 'ac47414c8205343f1a87a5b7b48131aaa7b92856'
PRESERVED_REDIRECT_SHA1 = '4450ad95c97a2045c2575bd2cc75c49a8a2ba6c7'
DEFAULT_BASELINE = ROOT / 'production/arcade-session-return-baseline.json'
STATE_DIR = ROOT / '.netlify/arcade-session-return'
CANDIDATE_PATH = STATE_DIR / 'candidate.json'
VERIFICATION_PATH = STATE_DIR / 'verified.json'
CONFIGURATION_PATH = STATE_DIR / 'configured.json'
CONFIGURATION_INTENT_PATH = STATE_DIR / 'configure-intent.json'
GUARDS_PATH = ROOT / 'docs/arcade-session-return-release-guards.json'
ACCOUNT_ID = '69800888d1a3d0483003ae9e'
BINDING_KEY = 'TREEFORCE89_DEV_DATABASE_URL'
DATABASE_BRANCH = 'feature/treeforce89-play-integration'
DATABASE_IDENTITY = 'df2f0abee059d9898495a125018fa0a291d50b9050c0d4557231f409bed53065'
PRODUCTION_DATABASE_IDENTITY = '5a940f1b6bdcce4a96dff3ffcfeb6a2b5de01b09fcfe2f8f1e351a9a0ef47712'
CANONICAL_ORIGIN = 'https://tree-token.xyz'
RECEIPT_PATH = ROOT / 'production/arcade-session-return-release.json'
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


def verify_runtime(actual, expected):
    complete_functions(expected['available_functions'])
    complete_functions(actual.get('available_functions'))
    check(len(expected['function_schedules']) == 5, 'Expected all five schedules.')
    for field in RUNTIME_FIELDS:
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
    check(isinstance(files, dict) and len(files) == 284, 'Expected exactly 284 baseline paths.')
    for path, sha in files.items():
        check(path.startswith('/') and path == path.lower() and re.fullmatch(r'[a-f0-9]{40}', sha),
              'Malformed public path or SHA1 in baseline.')
    check(files.get('/netlify.toml') == GENERATED_CONFIG_SHA1, 'Generated Netlify config identity changed.')
    check(files.get('/_redirects') == PRESERVED_REDIRECT_SHA1,
          'The current Canopy checkout routing must remain byte-exact.')
    verify_runtime(baseline['deploy'], baseline['deploy'])
    evidence = baseline['runtimeEvidence']
    check(evidence['accountId'] == ACCOUNT_ID and evidence['deployEnvironmentOverrides'] == [] and
          evidence['releaseSourceCommit'] == 'f1a29b30aa8a726a38233d5f42a0582a9f347a38' and
          evidence['releaseHelperSha256'] == '4530740f19ba4c918a43a9b1704001c2fa5679a7ba7631febd1c647bc66e0f46',
          'Current runtime environment provenance is missing.')
    check(evidence['siteFunctionsEnvironmentEntries'] == 49 and
          evidence['sharedAccountFunctionsEnvironmentEntries'] == 0 and
          evidence['missingRuntimeBinding']['expectedDatabaseIdentity'] == DATABASE_IDENTITY,
          'The reviewed missing-binding baseline changed.')
    check(evidence['preservedCanopyRouting']['sha1'] == PRESERVED_REDIRECT_SHA1 and
          evidence['preservedCanopyRouting']['upstreamDeployId'] == '6ae7ee72f3a12d5acb787a55',
          'Current Canopy checkout provenance is missing.')
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
    check(tuple(changed) == OVERLAY_PATHS, 'Exactly the reviewed Daily Growth controller must change.')
    check(set(files) == set(baseline['files']) and len(files) == 284, 'Static paths were added or removed.')
    check(files['/netlify.toml'] == GENERATED_CONFIG_SHA1, 'Generated Netlify config must remain exact.')
    check(files['/_redirects'] == PRESERVED_REDIRECT_SHA1, 'Canopy checkout routing changed.')
    return files, overlay, changed


def verify_source(commit, tree, overlay, creating=False):
    check(re.fullmatch(r'[a-f0-9]{40}', commit or '') and re.fullmatch(r'[a-f0-9]{40}', tree or ''),
          'Pass the full approved source commit and Git tree IDs.')
    check(git('rev-parse', commit + '^{tree}').decode().strip() == tree, 'Approved full source tree changed.')
    git('merge-base', '--is-ancestor', SOURCE_ANCESTOR, commit)
    git('merge-base', '--is-ancestor', commit, 'HEAD')
    if creating:
        check(git('status', '--porcelain') == b'', 'Commit the reviewed source before any release mutation.')
        check(git('branch', '--show-current').decode().strip() == SOURCE_BRANCH, 'Use the reviewed feature branch.')
        check(git('rev-parse', 'HEAD').decode().strip() == commit, 'Release source must be the approved checkout HEAD.')
    check(tuple(item['path'] for item in overlay) == OVERLAY_PATHS, 'Candidate overlay allowlist changed.')
    for item in overlay:
        path = item['path'].lstrip('/')
        approved = git('show', commit + ':' + path)
        check(digest(approved, 'sha1') == item['sha'] and len(approved) == item['size'],
              'Candidate inventory differs from its committed source: ' + path)
        check((ROOT / path).read_bytes() == approved, 'Working source changed after review: ' + path)
    for path in ('package.json', 'package-lock.json'):
        before = git('show', SOURCE_ANCESTOR + ':' + path)
        check(git('show', commit + ':' + path) == before and (ROOT / path).read_bytes() == before,
              'Root dependencies changed during this preserved-backend release.')
    for path in ('scripts/release-arcade-session-return.py',
                 'production/arcade-session-return-baseline.json',
                 'docs/arcade-session-return-release-guards.json',
                 'docs/arcade-session-return-runtime-diagnosis.json'):
        check(git('show', commit + ':' + path) == (ROOT / path).read_bytes(),
              'Reviewed release evidence/helper changed: ' + path)
    guards = json.loads(GUARDS_PATH.read_text())
    check(guards.get('passed') is True and guards.get('helperSha256') == digest(Path(__file__).read_bytes()) and
          guards.get('baselineSha256') == BASELINE_SHA256,
          'Run pure guards and commit the reviewed helper/evidence first.')


class Netlify:
    def __init__(self):
        check(not os.environ.get('DEBUG'), 'Run credential-bearing release operations with DEBUG unset.')
        config = json.loads((Path.home() / '.config/netlify/config.json').read_text())
        auth = config['users'][config['userId']]['auth']
        self.token = os.environ.get('NETLIFY_AUTH_TOKEN') or (auth if isinstance(auth, str) else auth['token'])

    def request(self, endpoint, method='GET', body=None, binary=None):
        headers = {'Authorization': 'Bearer ' + self.token, 'Accept': 'application/json'}
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

    def baseline_integrity(self, baseline):
        live = self.request('deploys/' + BASELINE_ID)
        check(live.get('site_id') == SITE_ID and live.get('id') == BASELINE_ID and live.get('state') == 'ready',
              'Baseline deployment identity or ready state changed.')
        verify_runtime(live, baseline['deploy'])
        check(self.inventory(BASELINE_ID) == baseline['files'], 'Baseline static inventory changed.')
        return live

    def environment(self, baseline, site, configured=None):
        evidence = baseline['runtimeEvidence']
        check(site.get('account_id') == ACCOUNT_ID, 'Site account identity changed.')
        query = urllib.parse.urlencode({'site_id': SITE_ID})
        values = self.request('accounts/' + ACCOUNT_ID + '/env?' + query + '&scope=functions')
        # Also protect unrelated build/runtime contexts that a functions filter
        # would omit, and prove that the key is absent across all site scopes.
        all_values = self.request('accounts/' + ACCOUNT_ID + '/env?' + query)
        shared = self.request('accounts/' + ACCOUNT_ID + '/env?scope=functions')
        all_shared = self.request('accounts/' + ACCOUNT_ID + '/env')
        legacy = site.get('build_settings', {}).get('env', {})
        return validate_environment(values, all_values, shared, legacy, evidence, configured, all_shared)

    def preflight(self, baseline, configured=None):
        site = self.current_is(BASELINE_ID)
        live = self.baseline_integrity(baseline)
        check(live.get('locked') is True, 'The original publication lock changed.')
        environment = self.environment(baseline, site, configured)
        self.current_is(BASELINE_ID)
        return live, environment


def environment_hash(records):
    return fingerprint(sorted(records, key=canonical))


def binding_metadata(record):
    check(record.get('key') == BINDING_KEY and record.get('is_secret') is True,
          'The sole new binding must be the reviewed secret key.')
    check(record.get('scopes') == ['functions'], 'The binding must have functions scope only.')
    values = record.get('values')
    check(isinstance(values, list) and len(values) == 1, 'The binding must have exactly one context.')
    value = values[0]
    check(value.get('context') == 'production' and value.get('context_parameter') in (None, ''),
          'The binding must use the production context without a branch parameter.')
    # A non-development secret is intentionally not readable from the API.
    # Neither a response's value nor any credential-bearing record is saved.
    return {'key': BINDING_KEY, 'isSecret': True, 'scopes': ['functions'],
            'values': [{'id': value.get('id'), 'context': 'production',
                        'contextParameter': value.get('context_parameter')}]}


def validate_environment(values, all_values, shared, legacy, evidence, configured=None, all_shared=None):
    all_shared = shared if all_shared is None else all_shared
    for records in (values, all_values, shared, all_shared):
        check(isinstance(records, list) and all(isinstance(item, dict) for item in records),
              'Unrecognized environment record inventory.')
        check(len({item.get('key') for item in records}) == len(records), 'Duplicate environment keys.')
    originals = [item for item in values if item.get('key') != BINDING_KEY]
    check(len(originals) == 49 and environment_hash(originals) == evidence['siteFunctionsEnvironmentSha256'],
          'An existing function environment record changed.')
    check(len(shared) == evidence['sharedAccountFunctionsEnvironmentEntries'] and
          environment_hash(shared) == evidence['sharedAccountFunctionsEnvironmentSha256'],
          'Shared account function environment changed.')
    check(not any(item.get('key') == BINDING_KEY for item in all_shared),
          'The target key already exists in shared account settings.')
    check(all(any(item == other for other in all_shared) for item in shared),
          'Filtered and unfiltered shared environment records disagree.')
    check(fingerprint(legacy) == evidence['siteBuildEnvironmentSha256'], 'Legacy build environment changed.')
    check(BINDING_KEY not in legacy, 'Do not add or replace a legacy build binding.')
    target = [item for item in values if item.get('key') == BINDING_KEY]
    all_target = [item for item in all_values if item.get('key') == BINDING_KEY]
    all_originals = [item for item in all_values if item.get('key') != BINDING_KEY]
    # The unfiltered inventory must contain exactly the same function records.
    check(all(any(item == other for other in all_values) for item in values),
          'Filtered and unfiltered environment records disagree.')
    binding = None
    if configured is None:
        check(not target and not all_target and len(values) == 49,
              'The target key already exists; only a missing key may be created.')
    else:
        check(len(values) == 50 and len(target) == len(all_target) == 1 and target[0] == all_target[0],
              'Expected precisely one new binding and all 49 existing function entries.')
        binding = {'metadata': binding_metadata(target[0]), 'recordSha256': fingerprint(target[0])}
        check(len(all_originals) == configured['allOtherSiteEnvironmentEntries'] and
              environment_hash(all_originals) == configured['allOtherSiteEnvironmentSha256'],
              'An unrelated site environment record changed in another scope.')
        check(len(all_shared) == configured['allSharedEnvironmentEntries'] and
              environment_hash(all_shared) == configured['allSharedEnvironmentSha256'],
              'An unrelated shared account environment record changed in another scope.')
        if configured.get('binding'):
            check(binding == configured['binding'] and environment_hash(values) ==
                  configured['siteFunctionsEnvironmentSha256'], 'The configured binding/environment drifted.')
    return {'siteFunctionsEnvironmentEntries': len(values),
            'siteFunctionsEnvironmentSha256': environment_hash(values),
            'preservedFunctionEnvironmentEntries': 49,
            'preservedFunctionEnvironmentSha256': environment_hash(originals),
            'allOtherSiteEnvironmentEntries': len(all_originals),
            'allOtherSiteEnvironmentSha256': environment_hash(all_originals),
            'sharedFunctionEnvironmentEntries': len(shared),
            'sharedFunctionEnvironmentSha256': environment_hash(shared),
            'allSharedEnvironmentEntries': len(all_shared),
            'allSharedEnvironmentSha256': environment_hash(all_shared),
            'legacyBuildEnvironmentSha256': fingerprint(legacy), 'binding': binding}


def database_identity(connection_string, owner=True):
    try:
        url = urllib.parse.urlsplit(connection_string)
        options = urllib.parse.parse_qsl(url.query, keep_blank_values=True, strict_parsing=True)
        check(url.scheme in ('postgres', 'postgresql') and url.hostname and
              url.hostname.endswith('.db.netlify.com') and url.path == '/netlifydb' and
              url.username == ('netlifydb_owner' if owner else 'netlifydb_readonly') and url.password and
              not url.fragment and url.port in (None, 5432), 'Unexpected database connection shape.')
        check(len({key for key, _ in options}) == len(options) and
              all(key in ('sslmode', 'channel_binding') for key, _ in options), 'Unexpected database transport override.')
        parameters = dict(options)
        check(parameters.get('sslmode') in ('require', 'verify-full') and
              parameters.get('channel_binding', 'require') == 'require', 'Database TLS settings changed.')
        return digest((re.sub(r'-pooler(?=\.)', '', url.hostname) + '|' + url.path).encode())
    except (ValueError, TypeError):
        raise ReleaseError('Malformed database connection; raw details withheld.') from None


def verify_database_binding(connection_string, production_connection):
    identity = database_identity(connection_string)
    production = database_identity(production_connection, owner=False)
    check(identity == DATABASE_IDENTITY and production == PRODUCTION_DATABASE_IDENTITY and identity != production,
          'The database is not the reviewed existing isolated branch.')
    return {'branchId': DATABASE_BRANCH, 'identitySha256': identity,
            'productionIdentitySha256': production, 'bindingSha256': digest(connection_string.encode())}


def read_configuration(commit=None, tree=None):
    configured = json.loads(CONFIGURATION_PATH.read_text())
    check(configured.get('configured') is True and configured.get('siteId') == SITE_ID and
          configured.get('baseline') == BASELINE_ID and configured.get('baselineSha256') == BASELINE_SHA256 and
          configured.get('sourceBranch') == SOURCE_BRANCH, 'Reviewed configuration state is missing or mismatched.')
    check(configured['database']['branchId'] == DATABASE_BRANCH and
          configured['database']['identitySha256'] == DATABASE_IDENTITY and
          configured['database']['productionIdentitySha256'] == PRODUCTION_DATABASE_IDENTITY,
          'Configured database identity changed.')
    check(configured['environment']['siteFunctionsEnvironmentEntries'] == 50 and
          configured['environment']['preservedFunctionEnvironmentEntries'] == 49 and
          configured['environment']['binding']['metadata']['key'] == BINDING_KEY,
          'Configured environment evidence is incomplete.')
    if commit is not None:
        check(configured['sourceCommit'] == commit and configured['sourceTree'] == tree,
              'Configuration and candidate must use the same reviewed commit/tree.')
    return configured


def configure(api, baseline, args):
    check(args.deploy_id is None and not CANDIDATE_PATH.exists(), 'Configure must precede candidate creation.')
    _, overlay, _ = build_files(baseline)
    verify_source(args.commit, args.tree, overlay, creating=True)
    if CONFIGURATION_PATH.exists():
        configured = read_configuration(args.commit, args.tree)
        api.preflight(baseline, configured['environment'])
        return configured
    # If a process stops after the single create request, never create again.
    # Readback can recover only the recorded intent with all unrelated values
    # byte/fingerprint exact; otherwise this phase stops for explicit review.
    if CONFIGURATION_INTENT_PATH.exists():
        intent = json.loads(CONFIGURATION_INTENT_PATH.read_text())
        check(intent.get('siteId') == SITE_ID and intent.get('baselineSha256') == BASELINE_SHA256 and
              intent.get('sourceCommit') == args.commit and intent.get('sourceTree') == args.tree and
              intent.get('sourceBranch') == SOURCE_BRANCH, 'Configuration intent differs from reviewed source.')
        _, environment = api.preflight(baseline, intent['before'])
        check(intent['database']['identitySha256'] == DATABASE_IDENTITY and
              intent['database']['productionIdentitySha256'] == PRODUCTION_DATABASE_IDENTITY,
              'Recorded database intent differs.')
        configured = {**intent, 'configured': True, 'configuredAt': now(),
                      'recoveredByReadback': True, 'environment': environment}
        save(CONFIGURATION_PATH, configured)
        return configured
    _, before = api.preflight(baseline)
    branches = api.request('sites/' + SITE_ID + '/database/branches')
    matches = [item for item in branches.get('branches', []) if item.get('branch_id') == DATABASE_BRANCH]
    check(len(matches) == 1 and matches[0].get('name') == DATABASE_BRANCH and matches[0].get('state') == 'ready',
          'The existing isolated database branch is not ready or unique.')
    branch_path = urllib.parse.quote(DATABASE_BRANCH, safe='')
    branch = api.request('sites/' + SITE_ID + '/database/branch/' + branch_path + '?role=netlifydb_owner')
    production = api.request('sites/' + SITE_ID + '/database?role=netlifydb_readonly')
    connection_string = branch.get('connection_string')
    database = verify_database_binding(connection_string, production.get('connection_string'))
    # Capture the current failure using a nonexistent credential. This cannot
    # satisfy the database authentication SELECT or reach any participation RPC.
    before_probe = negative_probe(CANONICAL_ORIGIN, expected=(503, 'participation-unavailable'))
    _, latest = api.preflight(baseline)
    check(latest == before, 'Environment changed while reviewing the database binding.')
    verify_source(args.commit, args.tree, overlay, creating=True)
    intent = {'siteId': SITE_ID, 'baseline': BASELINE_ID, 'baselineSha256': BASELINE_SHA256,
              'sourceCommit': args.commit, 'sourceTree': args.tree, 'sourceBranch': SOURCE_BRANCH,
              'database': database, 'before': before, 'beforeProbe': before_probe, 'recordedAt': now(),
              'operation': 'Create exactly one missing production/functions secret; no other writes'}
    save(CONFIGURATION_INTENT_PATH, intent)
    payload = [{'key': BINDING_KEY, 'scopes': ['functions'], 'is_secret': True,
                'values': [{'value': connection_string, 'context': 'production'}]}]
    try:
        api.current_is(BASELINE_ID)
        api.request('accounts/' + ACCOUNT_ID + '/env?' + urllib.parse.urlencode({'site_id': SITE_ID}), 'POST', payload)
    except Exception:
        # Only exact metadata/preservation readback can resolve an ambiguous
        # HTTP result. The state prevents a second create on retry.
        _, environment = api.preflight(baseline, before)
    else:
        _, environment = api.preflight(baseline, before)
    finally:
        # Strings cannot be zeroed in Python, but no reference is retained or
        # serialized after this process; errors and responses are never logged.
        payload[0]['values'][0]['value'] = None
        connection_string = None
        branch = production = branches = None
    configured = {**intent, 'configured': True, 'configuredAt': now(), 'environment': environment}
    save(CONFIGURATION_PATH, configured)
    return configured


def negative_probe(origin, expected=(401, 'invalid-game-session')):
    check(origin == CANONICAL_ORIGIN or re.fullmatch(r'https://[a-f0-9]{24}--tree-token\.netlify\.app', origin),
          'The runtime probe must target this canonical site or an exact candidate URL.')
    token = secrets.token_hex(32)
    run_id = 'grove-' + secrets.token_hex(16)
    data = canonical({'runId': run_id})
    request = urllib.request.Request(origin + '/api/arcade-growth?action=treeforce-play', data=data, method='POST',
        headers={'Authorization': 'Bearer ' + token, 'Origin': CANONICAL_ORIGIN, 'Sec-Fetch-Site': 'same-origin',
                 'Content-Type': 'application/json', 'Accept': 'application/json'})
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status, raw = response.status, response.read(4096)
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read(4096)
    try:
        body = json.loads(raw)
    except (ValueError, TypeError):
        raise ReleaseError('Runtime probe returned an unrecognized response; raw details withheld.') from None
    code = body.get('error') if isinstance(body, dict) else None
    check(isinstance(body, dict) and body.get('status') == 'error' and (status, code) == expected,
          'Runtime probe did not return the reviewed negative authentication result.')
    return {'url': origin + '/api/arcade-growth?action=treeforce-play', 'checkedAt': now(),
            'method': 'POST', 'status': status, 'code': code, 'milliseconds': round((time.monotonic() - started) * 1000, 2),
            'credential': 'cryptographically random nonexistent token; no user credential',
            'run': 'synthetic nonexistent run; no game session created', 'participationWritten': False,
            'interpretation': ('Pinned database connection and real session SELECT rejected the nonexistent session before ownership/RPC'
                               if status == 401 else 'Missing-binding reader failed before its session SELECT')}


def candidate_proof(state):
    return {key: state[key] for key in ('id', 'siteId', 'baseline', 'baselineSha256',
            'sourceCommit', 'sourceTree', 'sourceBranch', 'filesSha256', 'overlay', 'configurationSha256')}


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
    verify_source(state['sourceCommit'], state['sourceTree'], overlay)
    configured = read_configuration(state['sourceCommit'], state['sourceTree'])
    check(state['configurationSha256'] == fingerprint(configured), 'Candidate runtime configuration proof changed.')
    return state, changed, configured


def verify_candidate(api, baseline, state, wait=False):
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
    verify_runtime(candidate, baseline['deploy'])
    check(api.inventory(state['id']) == state['files'], 'Candidate static inventory differs from the approved overlay.')
    return candidate


def write_receipt(api, baseline, state, candidate, changed, configured):
    site = api.current_is(state['id'])
    check(candidate.get('locked') is True and candidate.get('published_at'), 'New publication is not ready and locked.')
    previous = api.baseline_integrity(baseline)
    api.environment(baseline, site, configured['environment'])
    probe = negative_probe(CANONICAL_ORIGIN)
    receipt = {**candidate_proof(state), 'publishedAt': candidate['published_at'], 'verifiedAt': now(),
               'locked': True, 'files': 284, 'filesBySha1': state['files'], 'changedExistingPaths': changed,
               'preservedStaticFiles': 283, 'newPaths': [], 'functionsPreserved': 41,
               'functionRecords': candidate['available_functions'], 'functionSchedules': candidate['function_schedules'],
               'schedulesPreserved': 5, 'runtime': {key: candidate.get(key) for key in RUNTIME_FIELDS
                                                if key not in ('available_functions', 'function_schedules')},
               'databaseSnapshotEvents': candidate.get('database_snapshots'),
               'generatedNetlifyConfigSha1': GENERATED_CONFIG_SHA1, 'preservedRedirectSha1': PRESERVED_REDIRECT_SHA1,
               'configuration': configured, 'runtimeNegativeProbe': probe, 'deployEnvironmentOverrides': [],
               'previousDeployLocked': previous.get('locked'),
               'publicationLockScope': 'current publication only; do not relock an earlier deployment',
               'url': CANONICAL_ORIGIN + '/play/',
               'candidateUrl': 'https://' + state['id'] + '--tree-token.netlify.app/play/'}
    save(RECEIPT_PATH, receipt)
    return receipt


def require_prior_verification(prior, state):
    check(prior.get('passed') is True and prior.get('unpublished') is True and
          all(prior.get(key) == value for key, value in candidate_proof(state).items()),
          'Publish requires prior verification of this exact new candidate/source/configuration.')
    probe = prior.get('runtimeNegativeProbe', {})
    check(probe.get('status') == 401 and probe.get('code') == 'invalid-game-session' and
          probe.get('participationWritten') is False and probe.get('url') ==
          'https://' + state['id'] + '--tree-token.netlify.app/api/arcade-growth?action=treeforce-play',
          'Publish requires the successful candidate database authentication probe.')


def pure_guards(baseline):
    passed = []

    def accept(name, call):
        call()
        passed.append(name)

    def reject(name, call):
        try:
            call()
        except ReleaseError:
            passed.append(name)
        else:
            raise ReleaseError('Pure guard failed to reject: ' + name)

    originals = [{'key': 'FIXTURE_' + str(index), 'is_secret': False, 'scopes': ['functions'],
                  'values': [{'id': str(index), 'context': 'production', 'value': 'synthetic'}]}
                 for index in range(49)]
    build_only = {'key': 'FIXTURE_BUILD', 'scopes': ['builds'], 'values': []}
    shared_build = {'key': 'FIXTURE_SHARED_BUILD', 'scopes': ['builds'], 'values': []}
    all_originals = originals + [build_only]
    target = {'key': BINDING_KEY, 'is_secret': True, 'scopes': ['functions'],
              'values': [{'id': 'synthetic-value-id', 'context': 'production'}]}
    evidence = {'siteFunctionsEnvironmentSha256': environment_hash(originals),
                'sharedAccountFunctionsEnvironmentEntries': 0,
                'sharedAccountFunctionsEnvironmentSha256': environment_hash([]),
                'siteBuildEnvironmentSha256': fingerprint({})}
    before = validate_environment(originals, all_originals, [], {}, evidence, all_shared=[shared_build])
    after = validate_environment(originals + [target], all_originals + [target], [], {}, evidence,
                                 before, [shared_build])
    accept('49 existing records and key absent in all scopes',
           lambda: validate_environment(originals, all_originals, [], {}, evidence, all_shared=[shared_build]))
    accept('50 records with one production/functions secret; unreadable value accepted',
           lambda: validate_environment(originals + [target], all_originals + [target], [], {}, evidence,
                                        after, [shared_build]))
    reject('existing functions key cannot be overwritten', lambda: validate_environment(
        originals + [target], all_originals + [target], [], {}, evidence, all_shared=[shared_build]))
    reject('existing build-only key cannot be missed', lambda: validate_environment(
        originals, all_originals + [{**target, 'scopes': ['builds']}], [], {}, evidence,
        all_shared=[shared_build]))
    reject('existing shared build-only key cannot be shadowed', lambda: validate_environment(
        originals, all_originals, [], {}, evidence, all_shared=[shared_build, {**target, 'scopes': ['builds']}]))
    reject('missing post-configure key rejected', lambda: validate_environment(
        originals, all_originals, [], {}, evidence, before, [shared_build]))
    for label, change in (
        ('wrong key', {'key': 'TREEFORCE89_PAID_CONTINUES_ENABLED'}),
        ('non-secret', {'is_secret': False}),
        ('build scope', {'scopes': ['builds']}),
        ('extra scope', {'scopes': ['functions', 'builds']}),
        ('preview context', {'values': [{'context': 'deploy-preview'}]}),
        ('all context', {'values': [{'context': 'all'}]}),
        ('extra context', {'values': [{'context': 'production'}, {'context': 'dev'}]}),
        ('branch parameter', {'values': [{'context': 'production', 'context_parameter': 'main'}]}),
    ):
        bad_target = {**target, **change}
        reject('binding rejects ' + label, lambda value=bad_target: validate_environment(
            originals + [value], all_originals + [value], [], {}, evidence, before, [shared_build]))
    reject('duplicate target key rejected', lambda: validate_environment(
        originals + [target, target], all_originals + [target, target], [], {}, evidence, before, [shared_build]))
    changed_originals = copy.deepcopy(originals)
    changed_originals[0]['values'][0]['value'] = 'different synthetic fixture'
    reject('unrelated secret/value byte drift rejected', lambda: validate_environment(
        changed_originals + [target], changed_originals + [build_only, target], [], {}, evidence, before, [shared_build]))
    reject('unrelated scope/id/context record drift rejected', lambda: validate_environment(
        originals[:-1] + [{**originals[-1], 'scopes': ['functions', 'runtime']}, target],
        all_originals + [target], [], {}, evidence, before, [shared_build]))
    reject('unrelated build-only record drift rejected', lambda: validate_environment(
        originals + [target], originals + [{**build_only, 'values': [{'context': 'all', 'value': 'change'}]}, target],
        [], {}, evidence, before, [shared_build]))
    reject('shared functions drift rejected', lambda: validate_environment(
        originals + [target], all_originals + [target], [originals[0]], {}, evidence, before,
        [shared_build, originals[0]]))
    reject('shared other-scope drift rejected', lambda: validate_environment(
        originals + [target], all_originals + [target], [], {}, evidence, before,
        [{**shared_build, 'values': [{'context': 'all', 'value': 'change'}]}]))
    reject('legacy build environment drift rejected', lambda: validate_environment(
        originals + [target], all_originals + [target], [], {'FIXTURE': 'change'}, evidence, before, [shared_build]))
    changed_target = copy.deepcopy(target)
    changed_target['values'][0]['id'] = 'another-context-record'
    reject('configured secret metadata drift rejected', lambda: validate_environment(
        originals + [changed_target], all_originals + [changed_target], [], {}, evidence, after, [shared_build]))
    fixture_url = 'postgresql://netlifydb_owner:synthetic@example-pooler.db.netlify.com/netlifydb?sslmode=require&channel_binding=require'
    accept('strict synthetic owner connection shape', lambda: database_identity(fixture_url))
    reject('unrelated database identity rejected', lambda: verify_database_binding(fixture_url,
        fixture_url.replace('netlifydb_owner', 'netlifydb_readonly')))
    for label, value in (
        ('wrong scheme', fixture_url.replace('postgresql:', 'https:')),
        ('wrong host', fixture_url.replace('.db.netlify.com', '.example.com')),
        ('wrong database', fixture_url.replace('/netlifydb?', '/postgres?')),
        ('wrong role', fixture_url.replace('netlifydb_owner', 'netlifydb_readonly')),
        ('missing password', fixture_url.replace(':synthetic@', '@')),
        ('wrong port', fixture_url.replace('.com/', '.com:1234/')),
        ('URL fragment', fixture_url + '#fragment'),
        ('host override', fixture_url + '&host=example.com'),
        ('file TLS override', fixture_url + '&sslkey=/tmp/example'),
        ('duplicate TLS option', fixture_url + '&sslmode=require'),
        ('TLS disabled', fixture_url.replace('sslmode=require', 'sslmode=disable')),
        ('channel binding disabled', fixture_url.replace('channel_binding=require', 'channel_binding=disable')),
    ):
        reject('database rejects ' + label, lambda url=value: database_identity(url))
    accept('full baseline runtime accepted', lambda: verify_runtime(baseline['deploy'], baseline['deploy']))
    files, overlay, changed = build_files(baseline, lambda path: b'pure synthetic controller fixture\n')
    check(changed == list(OVERLAY_PATHS) and len(files) == 284 and
          sum(files[path] == sha for path, sha in baseline['files'].items()) == 283,
          'One-path overlay guard failed.')
    passed.append('284 paths with exactly one overlay and 283 unchanged')
    check(files['/_redirects'] == PRESERVED_REDIRECT_SHA1 and files['/netlify.toml'] == GENERATED_CONFIG_SHA1,
          'Critical preserved routing/config paths changed.')
    passed.append('Canopy redirects and generated config remain exact')
    for field in RUNTIME_FIELDS:
        bad = copy.deepcopy(baseline['deploy'])
        if field == 'available_functions':
            bad[field][0]['d'] = '0' * 64
        elif field == 'function_schedules':
            bad[field] = bad[field][:-1]
        else:
            bad[field] = {'unexpected': 'synthetic runtime drift'}
        reject('full runtime guard: ' + field, lambda value=bad: verify_runtime(value, baseline['deploy']))
    for label, field, value in (('edge functions', 'edge_functions_present', True),
                                ('server bundle', 'server', {'id': 'synthetic'}),
                                ('database migrations', 'database_migrations', {'files': ['synthetic.sql']})):
        bad = {**baseline['deploy'], field: value}
        reject('reject ' + label, lambda actual=bad: verify_runtime(actual, baseline['deploy']))
    function_config = configuration_for(baseline['deploy']['available_functions'])
    check(len(function_config['functions']) == len(function_config['functions_config']) == 41 and
          'env' not in function_config and 'environment' not in function_config,
          'Preserved function payload changed.')
    passed.append('41 full function configurations with no deploy environment overrides')
    state = {'id': 'a' * 24, 'siteId': SITE_ID, 'baseline': BASELINE_ID, 'baselineSha256': BASELINE_SHA256,
             'sourceCommit': 'b' * 40, 'sourceTree': 'c' * 40, 'sourceBranch': SOURCE_BRANCH,
             'files': files, 'filesSha256': fingerprint(files), 'overlay': overlay, 'configurationSha256': 'd' * 64}
    candidate = {**copy.deepcopy(baseline['deploy']), 'id': state['id'], 'locked': False,
                 'created_at': '2099-01-01T00:00:00Z', 'published_at': None, 'commit_ref': state['sourceCommit']}

    class FixtureAPI:
        def __init__(self, value):
            self.value = value

        def request(self, endpoint):
            check(endpoint == 'deploys/' + state['id'], 'Unexpected fixture endpoint.')
            return self.value

        def inventory(self, deploy_id):
            check(deploy_id == state['id'], 'Unexpected fixture deployment.')
            return files

    accept('new unpublished candidate inventory/runtime accepted', lambda: verify_candidate(
        FixtureAPI(candidate), baseline, state))
    for label, value in (
        ('old deployment', {**candidate, 'id': BASELINE_ID}),
        ('wrong site', {**candidate, 'site_id': 'synthetic-other-site'}),
        ('stale creation date', {**candidate, 'created_at': baseline['deploy']['created_at']}),
        ('unready deploy', {**candidate, 'state': 'processing'}),
        ('wrong source commit', {**candidate, 'commit_ref': 'e' * 40}),
    ):
        reject('candidate rejects ' + label, lambda actual=value: verify_candidate(FixtureAPI(actual), baseline, state))
    prior = {**candidate_proof(state), 'passed': True, 'unpublished': True, 'runtimeNegativeProbe': {
        'status': 401, 'code': 'invalid-game-session', 'participationWritten': False,
        'url': 'https://' + state['id'] + '--tree-token.netlify.app/api/arcade-growth?action=treeforce-play'}}
    accept('publication requires exact verified new candidate and successful DB probe',
           lambda: require_prior_verification(prior, state))
    for label, change in (
        ('missing verification', {'passed': False}),
        ('previously published candidate', {'unpublished': False}),
        ('changed source', {'sourceCommit': 'e' * 40}),
        ('changed configuration', {'configurationSha256': 'e' * 64}),
        ('503 database failure', {'runtimeNegativeProbe': {**prior['runtimeNegativeProbe'], 'status': 503,
                                                         'code': 'participation-unavailable'}}),
        ('malformed-token-only evidence', {'runtimeNegativeProbe': {**prior['runtimeNegativeProbe'], 'status': 400}}),
        ('wrong candidate probe', {'runtimeNegativeProbe': {**prior['runtimeNegativeProbe'],
                                                           'url': CANONICAL_ORIGIN + '/api/arcade-growth?action=treeforce-play'}}),
    ):
        reject('publish rejects ' + label, lambda changes=change: require_prior_verification({**prior, **changes}, state))
    report = {'passed': True, 'count': len(passed), 'checks': passed,
              'helperSha256': digest(Path(__file__).read_bytes()), 'baselineSha256': BASELINE_SHA256,
              'scope': 'Pure synthetic fixtures and pinned sanitized baseline; no network, credentials, user data, database writes, or backend rebuild',
              'releaseShape': {'staticPaths': 284, 'overlays': list(OVERLAY_PATHS), 'unchangedPaths': 283,
                               'fullFunctions': 41, 'schedules': 5, 'existingFunctionEnvEntries': 49,
                               'configuredFunctionEnvEntries': 50, 'newKey': BINDING_KEY,
                               'newKeyScopes': ['functions'], 'newKeyContext': 'production', 'newKeySecret': True}}
    save(GUARDS_PATH, report)
    return report


def run(args):
    baseline = read_baseline(args.baseline)
    if args.mode == 'guards':
        report = pure_guards(baseline)
        print(json.dumps({'mode': 'guards', 'passed': True, 'count': report['count'],
                          'helperSha256': report['helperSha256'], 'remoteRequests': 0}))
        return
    api = Netlify()
    if args.mode == 'check':
        configured = read_configuration() if CONFIGURATION_PATH.exists() else None
        _, environment = api.preflight(baseline, configured['environment'] if configured else None)
        print(json.dumps({'mode': 'check', 'baseline': BASELINE_ID, 'staticPaths': 284,
                          'completeFunctions': 41, 'schedules': 5, 'locked': True,
                          'environment': environment, 'configured': bool(configured), 'remoteMethods': ['GET']}))
        return
    if args.mode == 'configure':
        configured = configure(api, baseline, args)
        print(json.dumps({'mode': 'configure', 'configured': True, 'siteId': SITE_ID,
                          'sourceCommit': configured['sourceCommit'], 'sourceTree': configured['sourceTree'],
                          'database': configured['database'], 'environment': configured['environment'],
                          'configurationSha256': fingerprint(configured)}))
        return
    if args.mode == 'candidate':
        check(args.deploy_id is None and not CANDIDATE_PATH.exists(), 'A candidate already exists or an existing ID was supplied.')
        files, overlay, changed = build_files(baseline)
        verify_source(args.commit, args.tree, overlay, creating=True)
        configured = read_configuration(args.commit, args.tree)
        live, _ = api.preflight(baseline, configured['environment'])
        payload = {'files': files, **configuration_for(live['available_functions']),
                   'function_schedules': live['function_schedules'], 'draft': False, 'async': False,
                   'branch': live['branch'], 'commit_ref': args.commit}
        # Inherit the reviewed persistent production/functions secret. No
        # per-deploy environment field or obsolete paid-continues flag is sent.
        api.current_is(BASELINE_ID)
        title = urllib.parse.quote('TREE Arcade: session return and durable participation binding')
        created = api.request('sites/' + SITE_ID + '/deploys?title=' + title, 'POST', payload)
        check(re.fullmatch(r'[a-f0-9]{24}', created.get('id', '')), 'Candidate creation returned no valid ID.')
        state = {'id': created['id'], 'siteId': SITE_ID, 'baseline': BASELINE_ID,
                 'baselineSha256': BASELINE_SHA256, 'sourceCommit': args.commit, 'sourceTree': args.tree,
                 'sourceBranch': SOURCE_BRANCH, 'sourceAncestor': SOURCE_ANCESTOR,
                 'files': files, 'filesSha256': fingerprint(files), 'overlay': overlay,
                 'configurationSha256': fingerprint(configured), 'recordedAt': now()}
        save(CANDIDATE_PATH, state)
        print(json.dumps({'candidateRecorded': state['id'], 'sourceCommit': args.commit}), flush=True)
        check(created['id'] != BASELINE_ID and not created.get('published_at'), 'Candidate unexpectedly published; inspect recorded state.')
        for key in ('required_functions', 'required_edge_functions', 'required_server'):
            check(created.get(key) in (None, []), 'Refusing an unexpected backend/server upload: ' + key)
        required = created.get('required') or []
        check(isinstance(required, list) and all(any(item['sha'] == sha for item in overlay) for sha in required),
              'Refusing any unrelated static upload.')
        for sha in required:
            api.current_is(BASELINE_ID)
            item = next(item for item in overlay if item['sha'] == sha)
            data = (ROOT / item['path'].lstrip('/')).read_bytes()
            check(digest(data, 'sha1') == sha and len(data) == item['size'], 'An overlay changed before upload.')
            api.request('deploys/' + state['id'] + '/files' + urllib.parse.quote(item['path']), 'PUT', binary=data)
        candidate = verify_candidate(api, baseline, state, wait=True)
        api.preflight(baseline, configured['environment'])
        check(not candidate.get('published_at'), 'Candidate must remain unpublished for review.')
    else:
        state, changed, configured = read_state(args.deploy_id, baseline)
        if args.mode != 'published':
            api.preflight(baseline, configured['environment'])
        candidate = verify_candidate(api, baseline, state)
        if args.mode == 'verify':
            check(not candidate.get('published_at'), 'Review verification requires an unpublished candidate.')
            probe = negative_probe('https://' + state['id'] + '--tree-token.netlify.app')
            api.preflight(baseline, configured['environment'])
            save(VERIFICATION_PATH, {**candidate_proof(state), 'verifiedAt': now(), 'unpublished': True,
                                     'passed': True, 'runtimeNegativeProbe': probe})
        elif args.mode == 'publish':
            verify_source(state['sourceCommit'], state['sourceTree'], state['overlay'], creating=True)
            prior = json.loads(VERIFICATION_PATH.read_text())
            require_prior_verification(prior, state)
            check(not candidate.get('published_at'), 'Only this new never-published candidate can be published.')
            api.current_is(BASELINE_ID)
            # This is the sole publication operation and cannot select an old
            # deployment. No unlock, restore, old relock, or backend build.
            try:
                api.request('deploys/' + state['id'] + '/lock', 'POST')
            except Exception:
                api.current_is(state['id'])
            api.current_is(state['id'])
            candidate = verify_candidate(api, baseline, state)
            write_receipt(api, baseline, state, candidate, changed, configured)
        elif args.mode == 'published':
            write_receipt(api, baseline, state, candidate, changed, configured)
    print(json.dumps({'mode': args.mode, 'id': state['id'], 'baseline': BASELINE_ID,
                      'sourceCommit': state['sourceCommit'], 'sourceTree': state['sourceTree'],
                      'files': 284, 'changedExistingPaths': changed, 'preservedStaticFiles': 283,
                      'functionsPreserved': 41, 'schedulesPreserved': 5,
                      'functionEnvironmentEntries': 50, 'preservedFunctionEnvironmentEntries': 49,
                      'published': bool(candidate.get('published_at')), 'locked': bool(candidate.get('locked'))}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('guards', 'check', 'configure', 'candidate', 'verify', 'publish', 'published'))
    parser.add_argument('deploy_id', nargs='?')
    parser.add_argument('--baseline', type=Path, default=DEFAULT_BASELINE)
    parser.add_argument('--commit')
    parser.add_argument('--tree')
    args = parser.parse_args()
    try:
        run(args)
    except ReleaseError as error:
        print('Arcade session-return release stopped: ' + str(error), file=sys.stderr)
        return 1
    except Exception:
        print('Arcade session-return release stopped: local or network operation failed; raw details withheld to protect credentials.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
