#!/usr/bin/env python3
"""Attach exact archived packages to one existing, unpublished Netlify candidate.

guards: offline checks only; writes the deterministic reviewed guard report.
attach: PUT only the exact 41 baseline ZIPs requested by the pinned candidate,
        plus its one originally approved controller file if requested.
capture: authenticated GETs only; captures complete records and every difference.

There is no create, configure, publish, lock, restore, delete, rebuild, or retry
operation. A successful/ambiguous upload is never automatically repeated.
Changed function identities are evidence for separate root review, not waived
preservation checks. This helper never writes the original verification proof.
"""
import argparse
import copy
import fcntl
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys
import time
import urllib.parse
import zipfile


ROOT = Path(__file__).resolve().parents[1]
ORIGINAL_HELPER = ROOT / 'scripts/release-arcade-session-return.py'
ORIGINAL_HELPER_SHA256 = 'c1fef669f8b0775b8970e0f31b16e5e4db406e4a32e7114abb291cc18a642f0f'
ORIGINAL_COMMIT = '81b463838a2ed3c5c388be14c1935a80c221c73d'
ORIGINAL_TREE = 'e028fb2cd59f31e1f13c235d61f9e03bfe8caa4e'
CANDIDATE_ID = '6ae7fe815070789ddb725fa3'
CANDIDATE_CREATED_AT = '2026-11-02T03:07:45.633Z'
CONFIGURATION_SHA256 = '233fe64419a86b8d70a4416a53916506f08932ee5c370682f6a196b54c01f3e3'
CANDIDATE_STATE_SHA256 = '6199745e8d72013bdb520a820ba4b5744d4f9ac4286fcdc965bce13601674c13'
MANIFEST_PATH = ROOT / 'production/arcade-session-return-function-packages.json'
GUARDS_PATH = ROOT / 'docs/arcade-session-return-attachment-guards.json'
STATE_DIR = ROOT / '.netlify/arcade-session-return/attachment'
JOURNAL_PATH = STATE_DIR / 'journal.json'
BEFORE_PATH = STATE_DIR / 'before.json'
AFTER_PATH = STATE_DIR / 'after.json'
SPECIAL_PACKAGES = frozenset(('arcade-growth', 'treeforce89-dev', 'canopy-access'))
RECOVERY_ADDITIONS = frozenset((
    'scripts/attach-arcade-session-return-functions.py',
    'docs/arcade-session-return-attachment-guards.json',
    'docs/arcade-session-return-package-recovery.json',
    'production/arcade-session-return-function-packages.json',
    *(f'production/arcade-session-return-functions/{name}.zip' for name in SPECIAL_PACKAGES),
))


class AttachmentError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise AttachmentError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def verify_original_helper(data):
    require(sha256(data) == ORIGINAL_HELPER_SHA256, 'Original release helper bytes changed.')


def load_release():
    verify_original_helper(ORIGINAL_HELPER.read_bytes())
    spec = importlib.util.spec_from_file_location('immutable_arcade_session_release', ORIGINAL_HELPER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


release = load_release()


def plain_path(path):
    """Reject symlinks, traversal and files outside this exact checkout."""
    path = Path(path)
    require(path.is_absolute() and path.is_relative_to(ROOT), 'Path is outside this checkout.')
    require(path.resolve() == path, 'Symlink or noncanonical path is not permitted.')
    for parent in (path, *path.parents):
        if parent == ROOT.parent:
            break
        require(not parent.is_symlink(), 'Symlink paths are not permitted.')
    return path


def save_state(path, value):
    require(path.parent == STATE_DIR, 'Only ignored attachment state may be written here.')
    plain_path(path)
    plain_path(path.with_suffix(path.suffix + '.tmp'))
    release.save(path, value)


def validate_source_identity(commit, tree, *, head, head_tree, branch, status, original_tree):
    require(isinstance(commit, str) and re.fullmatch(r'[a-f0-9]{40}', commit) and
            isinstance(tree, str) and re.fullmatch(r'[a-f0-9]{40}', tree),
            'Pass the full reviewed recovery commit and tree IDs.')
    require(commit != ORIGINAL_COMMIT and head == commit and head_tree == tree,
            'Recovery source must be the exact reviewed checkout HEAD/tree.')
    require(original_tree == ORIGINAL_TREE, 'Original source tree identity changed.')
    require(branch == release.SOURCE_BRANCH, 'Use the reviewed session-return branch.')
    require(status == b'', 'Commit the complete reviewed recovery before attachment.')


def validate_recovery_changes(changes):
    require(changes and all(status == 'A' and path in RECOVERY_ADDITIONS
                            for status, path in changes),
            'Recovery may only add the seven reviewed helper/evidence/archive paths.')
    require({path for _, path in changes} == RECOVERY_ADDITIONS and
            len(changes) == len(RECOVERY_ADDITIONS), 'Recovery additions are incomplete or duplicated.')


def verify_source(commit, tree, state):
    git = release.git
    validate_source_identity(commit, tree, head=git('rev-parse', 'HEAD').decode().strip(),
        head_tree=git('rev-parse', 'HEAD^{tree}').decode().strip(),
        branch=git('branch', '--show-current').decode().strip(), status=git('status', '--porcelain'),
        original_tree=git('rev-parse', ORIGINAL_COMMIT + '^{tree}').decode().strip())
    git('merge-base', '--is-ancestor', ORIGINAL_COMMIT, commit)
    raw = git('diff', '--name-status', '--no-renames', '-z', ORIGINAL_COMMIT, commit).decode().split('\0')
    require(raw[-1:] == [''] and (len(raw) - 1) % 2 == 0, 'Unrecognized recovery Git delta.')
    validate_recovery_changes(list(zip(raw[:-1:2], raw[1:-1:2])))
    release.verify_source(ORIGINAL_COMMIT, ORIGINAL_TREE, state['overlay'])
    verify_original_helper(ORIGINAL_HELPER.read_bytes())
    for path in sorted(RECOVERY_ADDITIONS):
        plain_path(ROOT / path)
        entry = git('ls-tree', commit, '--', path).decode().split()
        require(len(entry) >= 4 and entry[0] in ('100644', '100755') and entry[1] == 'blob',
                'A reviewed recovery path is not a regular committed file.')
        require(git('show', commit + ':' + path) == (ROOT / path).read_bytes(),
                'A recovery file changed after review.')
    require(git('check-ignore', str(JOURNAL_PATH.relative_to(ROOT))).strip(),
            'Attachment journal must remain excluded from Git.')
    guards = json.loads(GUARDS_PATH.read_text())
    require(guards.get('passed') is True and guards.get('helperSha256') == sha256(Path(__file__).read_bytes())
            and guards.get('originalHelperSha256') == ORIGINAL_HELPER_SHA256
            and guards.get('remoteRequests') == 0, 'Run and commit the current offline attachment guards.')


def validate_manifest(manifest, baseline):
    pins = {'baseline': release.BASELINE_ID, 'candidate': CANDIDATE_ID,
            'originalSourceCommit': ORIGINAL_COMMIT, 'originalSourceTree': ORIGINAL_TREE,
            'configurationSha256': CONFIGURATION_SHA256}
    require(isinstance(manifest, dict) and set(manifest) == set(pins) | {'packages'},
            'Unrecognized archive manifest shape.')
    require(all(manifest.get(key) == value for key, value in pins.items()), 'Archive manifest identity changed.')
    packages = manifest.get('packages')
    require(isinstance(packages, list) and len(packages) == 41 and
            all(isinstance(item, dict) for item in packages), 'Expected exactly 41 archive entries.')
    expected = {item['n']: item for item in baseline['deploy']['available_functions']}
    require(len(expected) == len({item['d'] for item in expected.values()}) == 41,
            'Baseline package names and digests must be unique.')
    require({item.get('name') for item in packages} == set(expected), 'Archive names differ from the baseline.')
    require(len({item.get('path') for item in packages}) == 41, 'Archive paths must be unique.')
    for package in packages:
        require(set(package) == {'name', 'path', 'sha256', 'size', 'provenance'}, 'Unrecognized archive entry.')
        name = package['name']
        require(isinstance(name, str) and re.fullmatch(r'[a-z0-9][a-z0-9-]*', name), 'Unsafe function name.')
        directory = 'arcade-session-return-functions' if name in SPECIAL_PACKAGES else 'functions'
        require(package['path'] == f'production/{directory}/{name}.zip', 'Archive path is not the reviewed exact path.')
        path = PurePosixPath(package['path'])
        require(not path.is_absolute() and '..' not in path.parts, 'Archive path traversal is forbidden.')
        record = expected[name]
        require(package['sha256'] == record['d'] and isinstance(package['size'], int)
                and not isinstance(package['size'], bool) and package['size'] == record['s'] > 0,
                'Archive digest or byte size differs from the baseline.')
        require(isinstance(package['provenance'], str) and 0 < len(package['provenance']) < 2048,
                'Archive provenance is required.')
        function_endpoint(record)
    return packages


def validate_archive(data, package):
    require(isinstance(data, bytes) and len(data) == package['size'] and sha256(data) == package['sha256'],
            'Archive bytes do not match their exact reviewed SHA256 and size.')
    require(zipfile.is_zipfile(io.BytesIO(data)), 'Expected an unchanged ZIP archive.')


def read_archive(package):
    data = plain_path(ROOT / package['path']).read_bytes()
    validate_archive(data, package)
    return data


def function_endpoint(record):
    require(isinstance(record, dict) and isinstance(record.get('n'), str) and
            re.fullmatch(r'[a-z0-9][a-z0-9-]*', record['n']), 'Unsafe function upload name.')
    require(record.get('r') in ('nodejs22.x', 'nodejs24.x'), 'Preserve the exact reviewed Node runtime.')
    require(record.get('im') in ('stream', 'background'), 'Preserve the exact invocation mode.')
    query = urllib.parse.urlencode({'runtime': record['r'], 'invocation_mode': record['im']})
    return f'deploys/{CANDIDATE_ID}/functions/{record["n"]}?{query}'


def read_original_state(baseline):
    require(sha256(release.CANDIDATE_PATH.read_bytes()) == CANDIDATE_STATE_SHA256,
            'Original candidate receipt changed.')
    state, _, configured = release.read_state(CANDIDATE_ID, baseline)
    require(state['sourceCommit'] == ORIGINAL_COMMIT and state['sourceTree'] == ORIGINAL_TREE
            and state['configurationSha256'] == CONFIGURATION_SHA256
            and release.fingerprint(configured) == CONFIGURATION_SHA256,
            'Original source or configured-environment proof changed.')
    return state, configured


def validate_candidate(candidate, baseline, state, *, strict_records=True):
    require(isinstance(candidate, dict) and candidate.get('id') == CANDIDATE_ID and
            candidate.get('site_id') == release.SITE_ID and
            candidate.get('created_at') == CANDIDATE_CREATED_AT,
            'This is not the exact recorded new candidate.')
    require(candidate.get('state') in ('uploading', 'uploaded', 'processing', 'ready'),
            'Candidate is no longer in an attachable or ready state.')
    require(not candidate.get('published_at') and not candidate.get('locked') and
            not candidate.get('draft') and candidate.get('context') == 'production',
            'Candidate must remain unpublished, unlocked and in the production context.')
    require(candidate.get('commit_ref') in (None, ORIGINAL_COMMIT), 'Candidate source metadata changed.')
    for field in release.RUNTIME_FIELDS:
        if field != 'available_functions':
            # Observed on this exact candidate before any archive upload. This
            # pending null remains in the captured diff and is forbidden once
            # ready; no other database branch or runtime field is tolerated.
            if (field == 'database_branch_id' and candidate['state'] != 'ready' and
                    candidate.get(field) is None and baseline['deploy'].get(field) == 'production'):
                continue
            require(candidate.get(field) == baseline['deploy'].get(field), 'Candidate configuration drift: ' + field)
    require(not candidate.get('edge_functions_present') and not candidate.get('server') and
            release.migration_count(candidate) == 0, 'Unrelated runtime bundles or migrations appeared.')
    for key in ('required_edge_functions', 'required_server'):
        require(candidate.get(key) in (None, []), 'An unrelated runtime upload was requested.')
    required = candidate.get('required_functions')
    required = [] if required is None else required
    expected = {record['n']: record for record in baseline['deploy']['available_functions']}
    hashes = {record['d'] for record in expected.values()}
    require(isinstance(required, list) and all(isinstance(item, str) for item in required) and
            len(required) == len(set(required)) and set(required) <= hashes,
            'Candidate requested an unknown or malformed function digest.')
    static = candidate.get('required')
    static = [] if static is None else static
    require(isinstance(static, list) and len(static) <= 1 and
            all(item == state['overlay'][0]['sha'] for item in static), 'Candidate requested an unrelated static file.')
    records = candidate.get('available_functions')
    records = [] if records is None else records
    require(isinstance(records, list) and all(isinstance(record, dict) for record in records),
            'Unrecognized candidate function records.')
    names = [record.get('n') for record in records]
    require(all(isinstance(name, str) for name in names) and len(names) == len(set(names)) and
            set(names) <= set(expected), 'Candidate function names changed.')
    if strict_records:
        for record in records:
            for field in ('d', 'r', 'im', 's'):
                require(record.get(field) == expected[record['n']].get(field),
                        'Attached package/runtime drift: ' + field)
    if candidate['state'] == 'ready':
        require(not required and not static and set(names) == set(expected), 'Ready candidate has an incomplete inventory.')
    return required, static, records


def validate_request(endpoint, method, body, binary, baseline, state, packages):
    allowed_get = {'sites/' + release.SITE_ID,
                   'deploys/' + release.BASELINE_ID, 'deploys/' + CANDIDATE_ID}
    for deploy_id in (release.BASELINE_ID, CANDIDATE_ID):
        allowed_get.update(f'deploys/{deploy_id}/files?per_page=100&page={page}' for page in range(1, 5))
    env = 'accounts/' + release.ACCOUNT_ID + '/env'
    allowed_get.update((env, env + '?scope=functions', env + '?site_id=' + release.SITE_ID,
                        env + '?site_id=' + release.SITE_ID + '&scope=functions'))
    if method == 'GET':
        require(endpoint in allowed_get and body is None and binary is None, 'Unapproved read endpoint or body.')
        return
    require(method == 'PUT' and body is None and isinstance(binary, bytes),
            'Only explicitly reviewed binary PUTs are available; no other mutation exists.')
    records = {record['n']: record for record in baseline['deploy']['available_functions']}
    for package in packages:
        if endpoint == function_endpoint(records[package['name']]):
            validate_archive(binary, package)
            return
    overlay = state['overlay'][0]
    if endpoint == 'deploys/' + CANDIDATE_ID + '/files' + overlay['path']:
        require(len(binary) == overlay['size'] and release.digest(binary, 'sha1') == overlay['sha'],
                'Controller upload differs from original candidate bytes.')
        return
    raise AttachmentError('Unapproved upload endpoint, runtime or invocation mode.')


class AttachmentAPI(release.Netlify):
    def __init__(self, baseline, state, packages):
        self.baseline, self.state, self.packages = baseline, state, packages
        super().__init__()

    def request(self, endpoint, method='GET', body=None, binary=None):
        validate_request(endpoint, method, body, binary, self.baseline, self.state, self.packages)
        return super().request(endpoint, method, body, binary)


def safe_metadata(value):
    """Complete provider records may be saved only when free of credential fields."""
    if isinstance(value, dict):
        for key, item in value.items():
            require(isinstance(key, str) and not re.search(
                r'(password|secret|credential|authorization|connection.string|access.token|environment|^env$)', key, re.I),
                'Credential-bearing provider metadata withheld; review is required.')
            safe_metadata(item)
    elif isinstance(value, list):
        for item in value:
            safe_metadata(item)
    elif isinstance(value, str):
        require(not re.search(r'(postgres(?:ql)?://|bearer\s+|-----BEGIN .*PRIVATE KEY)', value, re.I),
                'Credential-bearing provider metadata withheld; review is required.')


def snapshot(candidate):
    result = {key: candidate.get(key) for key in (
        'id', 'site_id', 'state', 'context', 'branch', 'created_at', 'published_at', 'locked',
        'draft', 'commit_ref', 'required', 'required_functions', 'required_edge_functions', 'required_server',
        *release.RUNTIME_FIELDS, 'edge_functions_present', 'server', 'database_migrations')}
    safe_metadata(result)
    return result


def differences(before, after, path=()):
    if isinstance(before, dict) and isinstance(after, dict):
        result = []
        for key in sorted(set(before) | set(after)):
            if key not in before or key not in after:
                result.append({'path': [*path, key], 'beforePresent': key in before, 'afterPresent': key in after,
                               'before': before.get(key), 'after': after.get(key)})
            else:
                result.extend(differences(before[key], after[key], (*path, key)))
        return result
    return [] if before == after else [{'path': list(path), 'before': before, 'after': after}]


def capture(api, baseline, state, candidate, proof):
    """Capture every field, including identities, without accepting any drift."""
    actual = snapshot(candidate)
    expected = snapshot(baseline['deploy'])
    old = {item['n']: item for item in expected['available_functions']}
    new = {item['n']: item for item in (actual['available_functions'] or [])}
    record_differences = differences(old, new, ('available_functions',))
    runtime_differences = differences(
        {key: expected[key] for key in release.RUNTIME_FIELDS if key != 'available_functions'},
        {key: actual[key] for key in release.RUNTIME_FIELDS if key != 'available_functions'})
    order_changed = list(old) != list(new)
    ready = candidate.get('state') == 'ready'
    inventory = api.inventory(CANDIDATE_ID) if ready else None
    report = {'proof': proof, 'capturedAt': release.now(), 'candidate': actual,
              'baselineCompleteFunctionRecords': expected['available_functions'],
              'candidateCompleteFunctionRecords': actual['available_functions'],
              'functionRecordDifferences': record_differences, 'functionOrderChanged': order_changed,
              'runtimeDifferences': runtime_differences, 'staticInventory': inventory,
              'staticInventoryExact': inventory == state['files'] if ready else None,
              'ready': ready, 'allCompleteFunctionRecordsExact': not record_differences and not order_changed,
              'identityFieldsWaived': [], 'releaseApproved': False,
              'originalVerificationProofWritten': False}
    save_state(AFTER_PATH, report)
    validate_candidate(candidate, baseline, state, strict_records=False)
    if ready:
        require(inventory == state['files'], 'Ready candidate static inventory differs; complete evidence saved.')
        release.complete_functions(actual['available_functions'])
    return report


def validate_journal(journal, proof, packages, state, baseline):
    require(isinstance(journal, dict) and journal.get('proof') == proof and journal.get('version') == 1,
            'Attachment journal belongs to a different reviewed recovery.')
    attempts = journal.get('attempts')
    require(isinstance(attempts, dict), 'Invalid attachment attempt journal.')
    expected = {item['name']: item for item in packages}
    records = {item['n']: item for item in baseline['deploy']['available_functions']}
    for name, item in attempts.items():
        require(isinstance(item, dict) and item.get('status') in ('started', 'accepted', 'ambiguous', 'confirmed-by-readback'),
                'Unknown attachment attempt status.')
        if name == '@controller':
            overlay = state['overlay'][0]
            require(item.get('sha1') == overlay['sha'] and item.get('size') == overlay['size'] and
                    item.get('endpoint') == 'deploys/' + CANDIDATE_ID + '/files' + overlay['path'],
                    'Controller journal identity changed.')
        else:
            require(name in expected and item.get('sha256') == expected[name]['sha256'] and
                    item.get('size') == expected[name]['size'] and
                    item.get('endpoint') == function_endpoint(records[name]), 'Function journal identity changed.')
    safe_metadata(journal)


def reconcile_attempts(journal, candidate, state):
    records = {item['n']: item for item in (candidate.get('available_functions') or [])}
    changed = False
    for name, attempt in journal['attempts'].items():
        if attempt['status'] in ('accepted', 'confirmed-by-readback'):
            continue
        if name == '@controller':
            confirmed = candidate.get('state') == 'ready' and not candidate.get('required')
        else:
            confirmed = (name in records and records[name].get('d') == attempt['sha256'] and
                         attempt['sha256'] not in (candidate.get('required_functions') or []))
        require(confirmed, 'An earlier upload has an ambiguous result; no retry is permitted. Use GET-only review.')
        attempt.update(status='confirmed-by-readback', confirmedAt=release.now())
        changed = True
    return changed


def remaining_functions(required, packages, journal):
    completed = {name for name, attempt in journal['attempts'].items()
                 if attempt['status'] in ('accepted', 'confirmed-by-readback')}
    return [item for item in packages if item['sha256'] in required and item['name'] not in completed]


def upload_once(api, journal, key, endpoint, data, identity):
    require(key not in journal['attempts'], 'Never retry an existing upload attempt.')
    journal['attempts'][key] = {**identity, 'endpoint': endpoint, 'status': 'started', 'startedAt': release.now()}
    save_state(JOURNAL_PATH, journal)
    try:
        response = api.request(endpoint, 'PUT', binary=data)
    except Exception:
        journal['attempts'][key].update(status='ambiguous', stoppedAt=release.now())
        save_state(JOURNAL_PATH, journal)
        raise AttachmentError('Upload response was ambiguous; journal retained, no automatic retry performed.') from None
    # Record success before inspecting response metadata, so a changed response
    # shape can never cause a duplicate successful PUT on the next invocation.
    journal['attempts'][key].update(status='accepted', acceptedAt=release.now())
    save_state(JOURNAL_PATH, journal)
    require(isinstance(response, dict), 'Upload response shape changed; success retained without retry.')
    if key != '@controller':
        require(response.get('name', key) == key and response.get('sha', identity['sha256']) == identity['sha256'],
                'Upload response identity differed; success retained for separate review.')
    receipt = {}
    for field in ('id', 'name', 'sha', 'region'):
        value = response.get(field)
        if isinstance(value, str) and re.fullmatch(r'[a-zA-Z0-9_-]{1,128}', value):
            receipt[field] = value
    journal['attempts'][key]['receipt'] = receipt
    save_state(JOURNAL_PATH, journal)


def run_remote(args):
    baseline = release.read_baseline(release.DEFAULT_BASELINE)
    state, configured = read_original_state(baseline)
    verify_source(args.commit, args.tree, state)
    manifest = json.loads(plain_path(MANIFEST_PATH).read_text())
    packages = validate_manifest(manifest, baseline)
    for package in packages:
        read_archive(package)
    proof = {'candidate': CANDIDATE_ID, 'originalCommit': ORIGINAL_COMMIT, 'originalTree': ORIGINAL_TREE,
             'recoveryCommit': args.commit, 'recoveryTree': args.tree,
             'configurationSha256': CONFIGURATION_SHA256, 'originalHelperSha256': ORIGINAL_HELPER_SHA256,
             'helperSha256': sha256(Path(__file__).read_bytes()), 'manifestSha256': release.fingerprint(manifest),
             'originalCandidateProof': release.candidate_proof(state)}
    api = AttachmentAPI(baseline, state, packages)
    _, environment = api.preflight(baseline, configured['environment'])
    require(environment == configured['environment'], 'Configured 50-entry environment is not exact.')
    candidate = api.request('deploys/' + CANDIDATE_ID)
    validate_candidate(candidate, baseline, state, strict_records=args.mode != 'capture')
    plain_path(STATE_DIR)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    lock_path = plain_path(STATE_DIR / 'operation.lock')
    descriptor = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise AttachmentError('Another attachment or capture operation is already running.') from None
        if args.mode == 'capture':
            report = capture(api, baseline, state, candidate, proof)
        else:
            if JOURNAL_PATH.exists():
                journal = json.loads(plain_path(JOURNAL_PATH).read_text())
                validate_journal(journal, proof, packages, state, baseline)
            else:
                require(candidate['state'] == 'uploading' and not candidate.get('available_functions') and
                        set(candidate.get('required_functions') or []) == {item['sha256'] for item in packages},
                        'First attachment must start at the recorded, untouched 41-package candidate.')
                require(not BEFORE_PATH.exists(), 'An earlier attachment snapshot exists without its journal; stop.')
                journal = {'version': 1, 'proof': proof, 'startedAt': release.now(), 'attempts': {}}
                save_state(BEFORE_PATH, {'proof': proof, 'capturedAt': release.now(),
                    'baseline': snapshot(baseline['deploy']), 'candidate': snapshot(candidate)})
                save_state(JOURNAL_PATH, journal)
            records = {item['n']: item for item in baseline['deploy']['available_functions']}
            for _ in range(43):
                candidate = api.request('deploys/' + CANDIDATE_ID)
                report = capture(api, baseline, state, candidate, proof)
                required, static, _ = validate_candidate(candidate, baseline, state)
                if reconcile_attempts(journal, candidate, state):
                    save_state(JOURNAL_PATH, journal)
                pending = remaining_functions(required, packages, journal)
                controller_pending = static and '@controller' not in journal['attempts']
                if candidate['state'] == 'ready' or (not pending and not controller_pending):
                    break
                verify_source(args.commit, args.tree, state)
                api.current_is(release.BASELINE_ID)
                if pending:
                    package = pending[0]
                    endpoint = function_endpoint(records[package['name']])
                    upload_once(api, journal, package['name'], endpoint, read_archive(package),
                                {'sha256': package['sha256'], 'size': package['size'],
                                 'runtime': records[package['name']]['r'], 'invocationMode': records[package['name']]['im']})
                    print(json.dumps({'acceptedFunction': package['name'], 'attempts': len(journal['attempts']),
                                      'candidate': CANDIDATE_ID}), flush=True)
                else:
                    overlay = state['overlay'][0]
                    data = plain_path(ROOT / overlay['path'].lstrip('/')).read_bytes()
                    require(data == release.git('show', ORIGINAL_COMMIT + ':' + overlay['path'].lstrip('/')),
                            'Controller bytes differ from original committed source.')
                    endpoint = 'deploys/' + CANDIDATE_ID + '/files' + overlay['path']
                    upload_once(api, journal, '@controller', endpoint, data,
                                {'sha1': overlay['sha'], 'size': overlay['size']})
                    print(json.dumps({'acceptedStatic': overlay['path'], 'candidate': CANDIDATE_ID}), flush=True)
            # Brief bounded GET-only polling; if provider processing continues,
            # a later capture/attach invocation resumes without replaying PUTs.
            for _ in range(30):
                if candidate['state'] == 'ready':
                    break
                time.sleep(1)
                candidate = api.request('deploys/' + CANDIDATE_ID)
                validate_candidate(candidate, baseline, state, strict_records=False)
                if candidate.get('required') and '@controller' not in journal['attempts']:
                    break
            report = capture(api, baseline, state, candidate, proof)
        verify_source(args.commit, args.tree, state)
        _, latest_environment = api.preflight(baseline, configured['environment'])
        require(latest_environment == configured['environment'], 'Environment drifted during attachment/capture.')
        print(json.dumps({'mode': args.mode, 'candidate': CANDIDATE_ID, 'ready': report['ready'],
            'completeFunctionRecords': len(report['candidateCompleteFunctionRecords'] or []),
            'functionFieldDifferences': len(report['functionRecordDifferences']),
            'functionOrderChanged': report['functionOrderChanged'], 'runtimeDifferences': len(report['runtimeDifferences']),
            'staticInventoryExact': report['staticInventoryExact'], 'identityFieldsWaived': [],
            'releaseApproved': False, 'productionUnchangedAndLocked': True,
            'evidence': str(AFTER_PATH.relative_to(ROOT))}))
        return 0 if report['ready'] and report['allCompleteFunctionRecordsExact'] and not report['runtimeDifferences'] else 2


def pure_guards():
    """Synthetic malformed-input and request-allowlist checks; never instantiate API."""
    baseline = release.read_baseline(release.DEFAULT_BASELINE)
    state, _ = read_original_state(baseline)
    manifest = json.loads(MANIFEST_PATH.read_text())
    packages = validate_manifest(manifest, baseline)
    passed = []

    def accept(name, callback):
        callback()
        passed.append(name)

    def reject(name, callback):
        try:
            callback()
        except (AttachmentError, release.ReleaseError):
            passed.append(name)
        else:
            raise AttachmentError('Offline guard failed: ' + name)

    accept('original helper exact SHA256', lambda: verify_original_helper(ORIGINAL_HELPER.read_bytes()))
    reject('modified original helper', lambda: verify_original_helper(b'changed'))
    source = {'commit': '1' * 40, 'tree': '2' * 40, 'head': '1' * 40, 'head_tree': '2' * 40,
              'branch': release.SOURCE_BRANCH, 'status': b'', 'original_tree': ORIGINAL_TREE}
    accept('full clean reviewed recovery identity', lambda: validate_source_identity(**source))
    for key, value in [('commit', 'short'), ('tree', 'short'), ('head', '3' * 40), ('head_tree', '4' * 40),
                       ('branch', 'main'), ('status', b' M source'), ('original_tree', '5' * 40)]:
        reject('source rejects ' + key, lambda k=key, v=value: validate_source_identity(**{**source, k: v}))
    additions = [('A', path) for path in RECOVERY_ADDITIONS]
    accept('seven explicit recovery additions only', lambda: validate_recovery_changes(additions))
    reject('original file modification', lambda: validate_recovery_changes(additions + [('M', 'play/index.html')]))
    reject('unrelated new file', lambda: validate_recovery_changes(additions + [('A', 'extra.txt')]))
    reject('missing recovery evidence', lambda: validate_recovery_changes(additions[:-1]))
    accept('complete exact 41-entry manifest', lambda: validate_manifest(manifest, baseline))
    accept('all 41 archived ZIP byte counts and SHA256 digests exact',
           lambda: [read_archive(package) for package in packages])
    for key in ('baseline', 'candidate', 'originalSourceCommit', 'originalSourceTree', 'configurationSha256'):
        reject('manifest rejects ' + key, lambda k=key: validate_manifest({**manifest, k: 'wrong'}, baseline))
    for label, update in [('wrong hash', {'sha256': '0' * 64}), ('wrong size', {'size': 1}),
                           ('absolute path', {'path': '/tmp/function.zip'}),
                           ('parent path', {'path': 'production/functions/../function.zip'}),
                           ('wrong directory', {'path': 'production/rebuilt/function.zip'}),
                           ('missing provenance', {'provenance': ''})]:
        altered = copy.deepcopy(manifest)
        altered['packages'][0].update(update)
        reject('archive rejects ' + label, lambda m=altered: validate_manifest(m, baseline))
    reject('missing package', lambda: validate_manifest({**manifest, 'packages': packages[:-1]}, baseline))
    reject('duplicate package', lambda: validate_manifest({**manifest, 'packages': packages[:-1] + [packages[0]]}, baseline))
    data = read_archive(packages[0])
    accept('exact existing archive bytes', lambda: validate_archive(data, packages[0]))
    reject('archive byte change', lambda: validate_archive(data[:-1] + bytes([data[-1] ^ 1]), packages[0]))
    reject('archive truncation', lambda: validate_archive(data[:-1], packages[0]))
    reject('malformed ZIP even with matching fixture digest', lambda: validate_archive(b'not zip',
           {'sha256': sha256(b'not zip'), 'size': 7}))
    first = baseline['deploy']['available_functions'][0]
    for label, update in [('generic runtime', {'r': 'js'}), ('wrong Node version', {'r': 'nodejs20.x'}),
                           ('invocation mode', {'im': 'sync'}), ('path injection', {'n': '../lock'})]:
        reject('upload rejects ' + label, lambda r={**first, **update}: function_endpoint(r))
    candidate = copy.deepcopy(baseline['deploy'])
    candidate.update(id=CANDIDATE_ID, site_id=release.SITE_ID, created_at=CANDIDATE_CREATED_AT,
        state='uploading', locked=None, published_at=None, draft=None, commit_ref=None,
        available_functions=[], required_functions=[item['sha256'] for item in packages], required=[],
        required_edge_functions=[], required_server=[])
    accept('recorded uploading candidate', lambda: validate_candidate(candidate, baseline, state))
    accept('observed pending null database branch retained as a diff', lambda: validate_candidate(
        {**candidate, 'database_branch_id': None}, baseline, state))
    reject('pending alternative database branch', lambda: validate_candidate(
        {**candidate, 'database_branch_id': 'other-branch'}, baseline, state))
    ready_candidate = {**candidate, 'state': 'ready', 'required_functions': [],
                       'available_functions': baseline['deploy']['available_functions']}
    accept('ready candidate requires exact production database branch', lambda: validate_candidate(
        ready_candidate, baseline, state))
    reject('ready null database branch', lambda: validate_candidate(
        {**ready_candidate, 'database_branch_id': None}, baseline, state))
    for label, update in [('wrong ID', {'id': release.BASELINE_ID}), ('wrong site', {'site_id': 'other'}),
                          ('wrong creation', {'created_at': 'different'}), ('published', {'published_at': 'now'}),
                          ('locked', {'locked': True}), ('draft', {'draft': True}), ('context', {'context': 'deploy-preview'}),
                          ('source', {'commit_ref': '0' * 40}), ('error', {'state': 'error'}),
                          ('unknown function', {'required_functions': ['0' * 64]}),
                          ('duplicate digest', {'required_functions': [first['d'], first['d']]}),
                          ('malformed digest list', {'required_functions': {first['d']: True}}),
                          ('empty malformed digest list', {'required_functions': {}}),
                          ('malformed static list', {'required': {}}),
                          ('malformed available records', {'available_functions': {}}),
                          ('unrelated static', {'required': ['0' * 40]}),
                          ('edge upload', {'required_edge_functions': ['0' * 64]}),
                          ('server upload', {'required_server': ['0' * 64]}),
                          ('schedule drift', {'function_schedules': []}),
                          ('region drift', {'functions_region': 'other'})]:
        reject('candidate rejects ' + label, lambda c={**candidate, **update}: validate_candidate(c, baseline, state))
    for field, value in [('d', '0' * 64), ('r', 'js'), ('im', 'background'), ('s', 1)]:
        reject('attached record rejects ' + field, lambda f=field, v=value: validate_candidate(
            {**candidate, 'available_functions': [{**first, f: v}]}, baseline, state))
    endpoint = function_endpoint(first)
    accept('only exact package PUT with explicit runtime/mode', lambda: validate_request(
        endpoint, 'PUT', None, data, baseline, state, packages))
    for label, ep, method in [('publish', f'deploys/{CANDIDATE_ID}/lock', 'POST'),
                             ('create', f'sites/{release.SITE_ID}/deploys', 'POST'),
                             ('configure', f'accounts/{release.ACCOUNT_ID}/env', 'POST'),
                             ('restore', f'sites/{release.SITE_ID}/deploys/{release.BASELINE_ID}/restore', 'POST'),
                             ('delete', f'deploys/{CANDIDATE_ID}', 'DELETE'),
                             ('wrong candidate', endpoint.replace(CANDIDATE_ID, release.BASELINE_ID), 'PUT'),
                             ('wrong runtime parameter', endpoint.replace('nodejs22.x', 'js'), 'PUT')]:
        reject('request rejects ' + label, lambda e=ep, m=method: validate_request(e, m, None, data, baseline, state, packages))
    controller = (ROOT / state['overlay'][0]['path'].lstrip('/')).read_bytes()
    static_endpoint = 'deploys/' + CANDIDATE_ID + '/files' + state['overlay'][0]['path']
    accept('original approved controller PUT', lambda: validate_request(
        static_endpoint, 'PUT', None, controller, baseline, state, packages))
    reject('changed controller PUT', lambda: validate_request(
        static_endpoint, 'PUT', None, controller + b'\n', baseline, state, packages))
    reject('other static path', lambda: validate_request(
        static_endpoint.replace('arcade-daily-growth.js', 'other.js'), 'PUT', None, controller, baseline, state, packages))
    journal = {'version': 1, 'proof': {'fixture': True}, 'attempts': {first['n']: {
        'status': 'accepted', 'sha256': first['d'], 'size': first['s'], 'endpoint': endpoint}}}
    accept('accepted attempt journal', lambda: validate_journal(journal, {'fixture': True}, packages, state, baseline))
    reject('different recovery journal', lambda: validate_journal(journal, {'fixture': False}, packages, state, baseline))
    accept('accepted package never selected for repeat', lambda: require(
        not remaining_functions([first['d']], packages, journal), 'Successful upload selected twice.'))
    ambiguous = copy.deepcopy(journal)
    ambiguous['attempts'][first['n']]['status'] = 'ambiguous'
    reject('ambiguous upload is not retried', lambda: reconcile_attempts(ambiguous, candidate, state))
    accept('ambiguous result recoverable only by exact GET evidence', lambda: reconcile_attempts(ambiguous,
        {**candidate, 'available_functions': [first], 'required_functions': []}, state))
    accept('all identity fields produce differences', lambda: require(
        len(differences(first, {**first, 'id': 'changed', 'oid': 'changed', 'a': 'changed', 'c': 'changed'})) == 4,
        'An identity difference was hidden.'))
    reject('credential metadata never persisted', lambda: safe_metadata({'environment': {'PASSWORD': 'fixture'}}))
    reject('credential connection string never persisted', lambda: safe_metadata({'value': 'postgresql://fixture'}))
    # Reuse the original strict current/lock and environment validators with
    # synthetic records; no API object/credentials/network is constructed.
    originals = [{'key': f'FIXTURE_{i}', 'scopes': ['functions'], 'values': []} for i in range(49)]
    target = {'key': release.BINDING_KEY, 'scopes': ['functions'], 'is_secret': True,
              'values': [{'id': 'fixture-id', 'context': 'production'}]}
    evidence = {'siteFunctionsEnvironmentSha256': release.environment_hash(originals),
                'sharedAccountFunctionsEnvironmentEntries': 0,
                'sharedAccountFunctionsEnvironmentSha256': release.environment_hash([]),
                'siteBuildEnvironmentSha256': release.fingerprint({})}
    before = release.validate_environment(originals, originals, [], {}, evidence, all_shared=[])
    configured = release.validate_environment(originals + [target], originals + [target], [], {}, evidence, before, [])
    accept('exact 50-entry configured environment', lambda: release.validate_environment(
        originals + [target], originals + [target], [], {}, evidence, configured, []))
    reject('missing configured secret', lambda: release.validate_environment(originals, originals, [], {}, evidence, configured, []))
    changed = copy.deepcopy(originals)
    changed[0]['scopes'] = ['functions', 'builds']
    reject('one existing environment record changed', lambda: release.validate_environment(
        changed + [target], changed + [target], [], {}, evidence, configured, []))
    reject('new binding scope changed', lambda: release.validate_environment(
        originals + [{**target, 'scopes': ['builds']}], originals + [{**target, 'scopes': ['builds']}],
        [], {}, evidence, configured, []))
    class FakeCurrent:
        def __init__(self, site):
            self.site = site
        def request(self, endpoint):
            require(endpoint == 'sites/' + release.SITE_ID, 'Unexpected fixture endpoint.')
            return self.site
    site = {'id': release.SITE_ID, 'published_deploy': {'id': release.BASELINE_ID, 'locked': True}}
    accept('current baseline remains locked', lambda: release.Netlify.current_is(FakeCurrent(site), release.BASELINE_ID))
    reject('concurrent production publication', lambda: release.Netlify.current_is(FakeCurrent(
        {**site, 'published_deploy': {'id': CANDIDATE_ID, 'locked': True}}), release.BASELINE_ID))
    reject('production lock removed', lambda: release.Netlify.current_is(FakeCurrent(
        {**site, 'published_deploy': {'id': release.BASELINE_ID, 'locked': False}}), release.BASELINE_ID))
    report = {'passed': True, 'count': len(passed), 'checks': passed, 'remoteRequests': 0,
              'helperSha256': sha256(Path(__file__).read_bytes()), 'originalHelperSha256': ORIGINAL_HELPER_SHA256,
              'candidate': CANDIDATE_ID, 'originalSourceCommit': ORIGINAL_COMMIT, 'originalSourceTree': ORIGINAL_TREE,
              'configurationSha256': CONFIGURATION_SHA256, 'baselineSha256': release.BASELINE_SHA256,
              'allowedMutations': ['PUT exact requested baseline function ZIPs to the pinned candidate',
                                   'PUT the original approved controller if requested by that candidate'],
              'identityFieldsWaived': [], 'publicationSupported': False}
    release.save(GUARDS_PATH, report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('guards', 'attach', 'capture'))
    parser.add_argument('--commit')
    parser.add_argument('--tree')
    args = parser.parse_args()
    try:
        if args.mode == 'guards':
            report = pure_guards()
            print(json.dumps({'mode': 'guards', 'passed': True, 'count': report['count'],
                              'remoteRequests': 0, 'helperSha256': report['helperSha256']}))
            return 0
        return run_remote(args)
    except (AttachmentError, release.ReleaseError) as error:
        print('Arcade attachment stopped: ' + str(error), file=sys.stderr)
    except Exception:
        print('Arcade attachment stopped: local or network operation failed; raw details withheld.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
