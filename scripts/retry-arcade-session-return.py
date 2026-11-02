#!/usr/bin/env python3
"""One fresh asynchronous candidate for the exact already-reviewed Arcade release.

guards: offline evidence. retry: create at most one new unpublished candidate,
then upload only requested exact archives/controller once. capture: GET only.
No publish, lock, restore, configure, delete, cancel or rebuild operation exists.
All state is separate from the original candidate and attachment evidence.
"""
import sys
sys.dont_write_bytecode = True

import argparse
import copy
import datetime
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import time
import urllib.parse

ORIGINAL_COMMIT = '81b463838a2ed3c5c388be14c1935a80c221c73d'
ORIGINAL_TREE = 'e028fb2cd59f31e1f13c235d61f9e03bfe8caa4e'
RECOVERY_COMMIT = '00e9d0e0f7968751559c6f9458d5bdd1b3384afa'
RECOVERY_TREE = '3edeab27f14dc687b38a97f237a2027cc7c61e2b'
ORIGINAL_HELPER_SHA256 = 'c1fef669f8b0775b8970e0f31b16e5e4db406e4a32e7114abb291cc18a642f0f'
ATTACHMENT_HELPER_SHA256 = '1ef530a8e707000228380c45483f943a999ffe4207f766003a5e69685b5eae56'
CONFIGURATION_SHA256 = '233fe64419a86b8d70a4416a53916506f08932ee5c370682f6a196b54c01f3e3'
OLD_CANDIDATE = '6ae7fe815070789ddb725fa3'
OLD_JOURNAL_SHA256 = '7a68f268b6b26b5284c12c589bd4e14c6acbb8e2a7477bb55d3999fda9200d7e'
LAST_OLD_UPLOAD = '2026-11-02T03:22:29.827233+00:00'
PAYLOAD_SHA256 = '11dd087d6272edba2e2f8d675459cbf59a2320bb17e4c397d55c98734d44fa95'
MANIFEST_SHA256 = 'b39dcbda43207af13928806bf01125479817a333721b51843c0fb456e69fddfc'
HELPER_PATH = 'scripts/retry-arcade-session-return.py'
GUARDS_PATH = 'docs/arcade-session-return-retry-guards.json'
REVIEW_PATH = 'docs/arcade-session-return-retry-review.json'
ADDITIONS = frozenset((HELPER_PATH, GUARDS_PATH, REVIEW_PATH))
STATE_PATH = '.netlify/arcade-session-return/retry'
WAIT_SECONDS = 1200
DIFFED_STATES = frozenset(('prepared', 'uploading', 'uploaded', 'processing', 'ready'))


class RetryError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise RetryError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def fp(value):
    return sha(json.dumps(value, sort_keys=True, separators=(',', ':')).encode())


def stamp(value):
    require(isinstance(value, str), 'Missing timestamp.')
    try:
        parsed = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        raise RetryError('Malformed timestamp.') from None
    require(parsed.tzinfo is not None, 'Timestamp requires UTC offset.')
    return parsed


def helpers(root):
    result = []
    for name, relative, digest in (
        ('retry_original_release', 'scripts/release-arcade-session-return.py', ORIGINAL_HELPER_SHA256),
        ('retry_original_attachment', 'scripts/attach-arcade-session-return-functions.py', ATTACHMENT_HELPER_SHA256)):
        path = root / relative
        require(not path.is_symlink() and sha(path.read_bytes()) == digest, 'An earlier immutable helper changed.')
        spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        result.append(module)
    return tuple(result)


def payload_for(release, baseline, original):
    payload = {'files': original['files'], **release.configuration_for(baseline['deploy']['available_functions']),
        'function_schedules': baseline['deploy']['function_schedules'], 'draft': False, 'async': True,
        'branch': baseline['deploy']['branch'], 'commit_ref': ORIGINAL_COMMIT}
    require(fp(payload) == PAYLOAD_SHA256, 'Manifest differs from the reviewed original except async:true.')
    return payload


def review_pins(release):
    return {'approved': True, 'supersededCandidate': OLD_CANDIDATE, 'baseline': release.BASELINE_ID,
        'originalSourceCommit': ORIGINAL_COMMIT, 'originalSourceTree': ORIGINAL_TREE,
        'recoveryCommit': RECOVERY_COMMIT, 'recoveryTree': RECOVERY_TREE,
        'configurationSha256': CONFIGURATION_SHA256, 'manifestSha256': MANIFEST_SHA256,
        'payloadSha256': PAYLOAD_SHA256, 'lastAcceptedUploadAt': LAST_OLD_UPLOAD,
        'minimumWaitSeconds': WAIT_SECONDS, 'maximumNewCandidates': 1,
        'supersededCandidatePublicationForbidden': True}


def validate_review(review, release):
    require(isinstance(review, dict) and all(review.get(k) == v for k, v in review_pins(release).items()),
            'Explicit committed one-candidate retry review is missing or changed.')
    require(isinstance(review.get('reason'), str) and review['reason'].strip(), 'Retry review needs a concrete reason.')


def source_check(root, release, attachment, original, commit, tree):
    require(isinstance(commit, str) and re.fullmatch(r'[a-f0-9]{40}', commit) and
            isinstance(tree, str) and re.fullmatch(r'[a-f0-9]{40}', tree), 'Pass full reviewed retry commit/tree IDs.')
    require(release.git('status', '--porcelain') == b'' and
            release.git('rev-parse', 'HEAD').decode().strip() == commit and
            release.git('rev-parse', 'HEAD^{tree}').decode().strip() == tree and
            release.git('branch', '--show-current').decode().strip() == release.SOURCE_BRANCH,
            'Retry must use the reviewed clean checkout HEAD/tree/branch.')
    require(release.git('rev-parse', RECOVERY_COMMIT + '^{tree}').decode().strip() == RECOVERY_TREE,
            'Recovery source identity changed.')
    release.git('merge-base', '--is-ancestor', RECOVERY_COMMIT, commit)
    raw = release.git('diff', '--name-status', '--no-renames', '-z', RECOVERY_COMMIT, commit).decode().split('\0')
    changes = list(zip(raw[:-1:2], raw[1:-1:2]))
    require(raw[-1:] == [''] and len(raw) == 7 and len(changes) == 3 and
            {path for _, path in changes} == ADDITIONS and all(kind == 'A' for kind, _ in changes),
            'Retry source may only add its helper, guard report and explicit review.')
    release.verify_source(ORIGINAL_COMMIT, ORIGINAL_TREE, original['overlay'])
    for path in attachment.RECOVERY_ADDITIONS:
        require(release.git('show', RECOVERY_COMMIT + ':' + path) == (root / path).read_bytes(), 'Recovery artifact changed.')
    for path in ADDITIONS:
        attachment.plain_path(root / path)
        item = release.git('ls-tree', commit, '--', path).decode().split()
        require(len(item) >= 4 and item[0] in ('100644', '100755') and item[1] == 'blob' and
                release.git('show', commit + ':' + path) == (root / path).read_bytes(), 'Retry artifact differs from its commit.')
    guards = json.loads((root / GUARDS_PATH).read_text())
    require(guards.get('passed') is True and guards.get('remoteRequests') == 0 and
            guards.get('helperSha256') == sha((root / HELPER_PATH).read_bytes()) and
            guards.get('payloadSha256') == PAYLOAD_SHA256 and guards.get('expectedAddedPaths') == sorted(ADDITIONS),
            'Current reviewed offline retry guards are required.')
    require(release.git('check-ignore', STATE_PATH + '/candidate.json').strip(), 'Retry state must remain ignored.')


def old_stalled(old, baseline, original, release, attachment, current_time):
    require(current_time >= stamp(LAST_OLD_UPLOAD) + datetime.timedelta(seconds=WAIT_SECONDS),
            'The original candidate must receive its full20-minute post-upload processing interval.')
    attachment.validate_candidate(old, baseline, original)
    require(old.get('id') == OLD_CANDIDATE and old.get('state') == 'uploading' and
            old.get('required') in (None, []) and old.get('required_functions') in (None, []) and
            old.get('available_functions') in (None, []),
            'Original candidate is ready, has progressed, or is not the exact observed empty pending state; stop.')


def fresh_id(value, release):
    require(isinstance(value, str) and re.fullmatch(r'[a-f0-9]{24}', value) and
            value not in (OLD_CANDIDATE, release.BASELINE_ID), 'Only the recorded new replacement candidate is allowed.')


def endpoint_for(candidate_id, record, release):
    fresh_id(candidate_id, release)
    require(re.fullmatch(r'[a-z0-9][a-z0-9-]*', record['n']) and
            record['r'] in ('nodejs22.x', 'nodejs24.x') and record['im'] in ('stream', 'background'),
            'Invalid exact baseline function upload metadata.')
    return f'deploys/{candidate_id}/functions/{record["n"]}?' + urllib.parse.urlencode(
        {'runtime': record['r'], 'invocation_mode': record['im']})


def validate_new(candidate, state, baseline, original, release):
    fresh_id(state['id'], release)
    require(candidate.get('id') == state['id'] and candidate.get('site_id') == release.SITE_ID and
            candidate.get('created_at') == state['createdAt'] and not candidate.get('published_at') and
            not candidate.get('locked') and not candidate.get('draft'), 'Replacement candidate identity/publication changed.')
    status = candidate.get('state')
    require(status == 'preparing' or status in DIFFED_STATES, 'Replacement candidate failed or entered an unknown state.')
    if status == 'preparing':
        require(candidate.get('context') in (None, 'production'), 'Wrong preparing context.')
        return [], [], []
    require(candidate.get('context') == 'production' and candidate.get('commit_ref') in (None, ORIGINAL_COMMIT),
            'Replacement must retain production context and original application source.')
    for key in release.RUNTIME_FIELDS:
        if key == 'available_functions':
            continue
        if key == 'database_branch_id' and status != 'ready' and candidate.get(key) is None and baseline['deploy'].get(key) == 'production':
            continue
        require(candidate.get(key) == baseline['deploy'].get(key), 'Protected candidate runtime changed: ' + key)
    require(not candidate.get('server') and not candidate.get('edge_functions_present') and
            release.migration_count(candidate) == 0, 'Unexpected server/edge/migration work.')
    for key in ('required_edge_functions', 'required_server'):
        require(candidate.get(key) in (None, []), 'Unapproved runtime upload requested.')
    required = [] if candidate.get('required_functions') is None else candidate['required_functions']
    static = [] if candidate.get('required') is None else candidate['required']
    records = [] if candidate.get('available_functions') is None else candidate['available_functions']
    expected = {record['n']: record for record in baseline['deploy']['available_functions']}
    require(isinstance(required, list) and all(isinstance(value, str) for value in required) and
            len(required) == len(set(required)) and set(required) <= {record['d'] for record in expected.values()},
            'Unapproved or malformed required function digest.')
    require(isinstance(static, list) and len(static) <= 1 and
            all(value == original['overlay'][0]['sha'] for value in static), 'Unapproved required static digest.')
    require(isinstance(records, list) and all(isinstance(item, dict) and isinstance(item.get('n'), str) for item in records),
            'Malformed function records.')
    names = [item['n'] for item in records]
    require(len(names) == len(set(names)) and set(names) <= set(expected), 'Function names changed.')
    for record in records:
        require(all(record.get(key) == expected[record['n']].get(key) for key in ('d', 's', 'r', 'im')),
                'Attached function package/runtime changed.')
    if status == 'ready':
        require(not required and not static and len(records) == 41, 'Ready replacement inventory is incomplete.')
    return required, static, records


def api_class(release, attachment, baseline, original, packages, payload, transport=None):
    class RetryAPI(release.Netlify):
        new_id = None
        create_armed = False
        def request(self, endpoint, method='GET', body=None, binary=None):
            if method == 'GET':
                # Reuse the reviewed read allowlist, substituting the new ID
                # only for validation; the actual GET still targets the new ID.
                checked = endpoint.replace(self.new_id, OLD_CANDIDATE) if self.new_id else endpoint
                attachment.validate_request(checked, method, body, binary, baseline, original, packages)
            elif method == 'POST':
                require(self.create_armed and self.new_id is None and
                        endpoint == 'sites/' + release.SITE_ID + '/deploys?title=TREE%20Arcade%3A%20asynchronous%20candidate%20retry' and
                        body == payload and fp(body) == PAYLOAD_SHA256 and binary is None,
                        'Only one exact new-candidate creation POST is allowed.')
                self.create_armed = False
            else:
                require(method == 'PUT' and self.new_id is not None and body is None and isinstance(binary, bytes),
                        'No configuration/publication/restore/delete operation exists.')
                fresh_id(self.new_id, release)
                require(endpoint.startswith('deploys/' + self.new_id + '/'), 'Upload targets an old or unknown candidate.')
                attachment.validate_request(endpoint.replace(self.new_id, OLD_CANDIDATE), method, body, binary,
                                            baseline, original, packages)
            if transport is not None:
                return transport(self, endpoint, method, body, binary)
            return super().request(endpoint, method, body, binary)
    return RetryAPI


def capture(candidate, state, baseline, original, release, attachment, save):
    actual = attachment.snapshot(candidate)
    expected = attachment.snapshot(baseline['deploy'])
    old = {item['n']: item for item in expected['available_functions']}
    new = {item['n']: item for item in (actual['available_functions'] or [])}
    ready = candidate.get('state') == 'ready'
    report = {'proof': {**state['proof'], 'candidate': state['id'], 'candidateCreatedAt': state['createdAt'],
                       'supersededCandidate': OLD_CANDIDATE}, 'capturedAt': release.now(), 'candidate': actual,
        'baselineCompleteFunctionRecords': expected['available_functions'],
        'candidateCompleteFunctionRecords': actual['available_functions'],
        'functionRecordDifferences': attachment.differences(old, new, ('available_functions',)),
        'functionOrderChanged': list(old) != list(new),
        'runtimeDifferences': attachment.differences(
            {key: expected[key] for key in release.RUNTIME_FIELDS if key != 'available_functions'},
            {key: actual[key] for key in release.RUNTIME_FIELDS if key != 'available_functions'}),
        'ready': ready, 'identityFieldsWaived': [], 'releaseApproved': False,
        'supersededCandidatePublicationForbidden': True}
    save('after.json', report)
    validate_new(candidate, state, baseline, original, release)
    return report


def run(args, root):
    release, attachment = helpers(root)
    baseline = release.read_baseline(release.DEFAULT_BASELINE)
    original, configured = attachment.read_original_state(baseline)
    source_check(root, release, attachment, original, args.commit, args.tree)
    manifest = json.loads(attachment.MANIFEST_PATH.read_text())
    require(fp(manifest) == MANIFEST_SHA256, 'Exact committed archive manifest changed.')
    packages = attachment.validate_manifest(manifest, baseline)
    for package in packages:
        attachment.read_archive(package)
    review_bytes = (root / REVIEW_PATH).read_bytes()
    validate_review(json.loads(review_bytes), release)
    payload = payload_for(release, baseline, original)
    old_journal_bytes = attachment.JOURNAL_PATH.read_bytes()
    require(sha(old_journal_bytes) == OLD_JOURNAL_SHA256, 'Original41 accepted-upload journal changed.')
    old_journal = json.loads(old_journal_bytes)
    require(len(old_journal['attempts']) == 41 and all(item['status'] == 'accepted' for item in old_journal['attempts'].values()) and
            max(item['acceptedAt'] for item in old_journal['attempts'].values()) == LAST_OLD_UPLOAD,
            'Original upload completion proof is incomplete.')
    proof = {'originalSourceCommit': ORIGINAL_COMMIT, 'originalSourceTree': ORIGINAL_TREE,
        'recoveryCommit': RECOVERY_COMMIT, 'recoveryTree': RECOVERY_TREE,
        'retryProcedureCommit': args.commit, 'retryProcedureTree': args.tree,
        'helperSha256': sha((root / HELPER_PATH).read_bytes()), 'retryReviewSha256': sha(review_bytes),
        'configurationSha256': CONFIGURATION_SHA256, 'manifestSha256': MANIFEST_SHA256,
        'payloadSha256': PAYLOAD_SHA256, 'filesSha256': original['filesSha256'],
        'originalCandidateProof': release.candidate_proof(original), 'oldUploadJournalSha256': OLD_JOURNAL_SHA256}
    directory = attachment.plain_path(root / STATE_PATH)
    directory.mkdir(parents=True, exist_ok=True)
    def save(name, value):
        require(name in ('create-intent.json', 'candidate.json', 'journal.json', 'before.json', 'after.json'), 'Unapproved state path.')
        attachment.plain_path(directory / name)
        attachment.plain_path((directory / name).with_suffix('.json.tmp'))
        release.save(directory / name, value)
    descriptor = os.open(attachment.plain_path(directory / 'operation.lock'), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RetryError('Another retry/capture operation is running.') from None
        api = api_class(release, attachment, baseline, original, packages, payload)()
        _, environment = api.preflight(baseline, configured['environment'])
        require(environment == configured['environment'], 'Configured50-entry environment changed.')
        state_path, intent_path, journal_path = directory / 'candidate.json', directory / 'create-intent.json', directory / 'journal.json'
        if state_path.exists():
            state = json.loads(attachment.plain_path(state_path).read_text())
            require(state.get('proof') == proof and state.get('siteId') == release.SITE_ID and
                    state.get('supersedes') == OLD_CANDIDATE, 'Replacement receipt differs from reviewed retry source.')
            fresh_id(state.get('id'), release)
            intent = json.loads(attachment.plain_path(intent_path).read_text())
            require(intent.get('proof') == proof, 'Creation intent differs from recorded replacement.')
        else:
            require(args.mode == 'retry', 'No replacement candidate exists to capture.')
            require(not intent_path.exists(), 'A creation attempt already exists without an ID; use read-only review, never retry POST.')
            old = api.request('deploys/' + OLD_CANDIDATE)
            old_stalled(old, baseline, original, release, attachment, datetime.datetime.now(datetime.timezone.utc))
            source_check(root, release, attachment, original, args.commit, args.tree)
            api.preflight(baseline, configured['environment'])
            old = api.request('deploys/' + OLD_CANDIDATE)
            old_stalled(old, baseline, original, release, attachment, datetime.datetime.now(datetime.timezone.utc))
            save('create-intent.json', {'proof': proof, 'recordedAt': release.now(),
                 'supersedes': OLD_CANDIDATE, 'oldCandidateAtDecision': attachment.snapshot(old),
                 'maximumNewCandidates': 1, 'supersededCandidatePublicationForbidden': True})
            api.current_is(release.BASELINE_ID)
            api.create_armed = True
            created = api.request('sites/' + release.SITE_ID + '/deploys?title=TREE%20Arcade%3A%20asynchronous%20candidate%20retry', 'POST', payload)
            fresh_id(created.get('id'), release)
            state = {'id': created['id'], 'createdAt': created.get('created_at'), 'siteId': created.get('site_id'),
                     'supersedes': OLD_CANDIDATE, 'proof': proof}
            save('candidate.json', state)
            require(stamp(state['createdAt']) > stamp(LAST_OLD_UPLOAD) and state['siteId'] == release.SITE_ID,
                    'Replacement creation metadata differs.')
            print(json.dumps({'candidateRecorded': state['id'], 'supersedes': OLD_CANDIDATE, 'async': True}), flush=True)
            save('before.json', {'proof': proof, 'baseline': attachment.snapshot(baseline['deploy']),
                                'originalCandidate': attachment.snapshot(old), 'replacement': attachment.snapshot(created)})
        api.new_id = state['id']
        journal = json.loads(attachment.plain_path(journal_path).read_text()) if journal_path.exists() else {
            'proof': proof, 'candidate': state['id'], 'attempts': {}}
        require(journal.get('proof') == proof and journal.get('candidate') == state['id'] and
                isinstance(journal.get('attempts'), dict), 'Upload journal differs from this replacement.')
        by_name = {package['name']: package for package in packages}
        records = {record['n']: record for record in baseline['deploy']['available_functions']}
        for name, attempt in journal['attempts'].items():
            require(attempt.get('status') in ('started', 'accepted', 'ambiguous', 'confirmed-by-readback'), 'Unknown attempt status.')
            if name == '@controller':
                require(attempt.get('sha1') == original['overlay'][0]['sha'], 'Controller attempt changed.')
            else:
                require(name in by_name and attempt.get('sha256') == by_name[name]['sha256'] and
                        attempt.get('size') == by_name[name]['size'], 'Archive attempt changed.')
        deadline = time.monotonic() + WAIT_SECONDS
        while True:
            candidate = api.request('deploys/' + state['id'])
            report = capture(candidate, state, baseline, original, release, attachment, save)
            required, static, actual_records = validate_new(candidate, state, baseline, original, release)
            if args.mode == 'capture' or candidate['state'] == 'ready':
                break
            if time.monotonic() >= deadline:
                break
            if candidate['state'] == 'preparing':
                time.sleep(1)
                continue
            actual = {record['n']: record for record in actual_records}
            for name, attempt in journal['attempts'].items():
                if attempt['status'] in ('accepted', 'confirmed-by-readback'):
                    continue
                confirmed = (name != '@controller' and name in actual and actual[name].get('d') == attempt['sha256']
                             and attempt['sha256'] not in required)
                require(confirmed, 'An upload response is ambiguous; no duplicate PUT is allowed.')
                attempt['status'] = 'confirmed-by-readback'
                save('journal.json', journal)
            pending = [package for package in packages if package['sha256'] in required and package['name'] not in journal['attempts']]
            key = pending[0]['name'] if pending else ('@controller' if static and '@controller' not in journal['attempts'] else None)
            if key is None:
                time.sleep(1)
                continue
            require(release.git('status', '--porcelain') == b'' and release.git('rev-parse', 'HEAD').decode().strip() == args.commit,
                    'Reviewed checkout changed before upload.')
            api.current_is(release.BASELINE_ID)
            if key == '@controller':
                overlay = original['overlay'][0]
                data = (root / overlay['path'].lstrip('/')).read_bytes()
                require(data == release.git('show', ORIGINAL_COMMIT + ':' + overlay['path'].lstrip('/')), 'Controller source changed.')
                endpoint = 'deploys/' + state['id'] + '/files' + overlay['path']
                identity = {'sha1': overlay['sha'], 'size': overlay['size']}
            else:
                package = by_name[key]
                data = attachment.read_archive(package)
                endpoint = endpoint_for(state['id'], records[key], release)
                identity = {'sha256': package['sha256'], 'size': package['size'], 'runtime': records[key]['r'], 'invocationMode': records[key]['im']}
            journal['attempts'][key] = {**identity, 'status': 'started', 'startedAt': release.now(), 'endpoint': endpoint}
            save('journal.json', journal)
            try:
                response = api.request(endpoint, 'PUT', binary=data)
            except Exception:
                journal['attempts'][key].update(status='ambiguous', stoppedAt=release.now())
                save('journal.json', journal)
                raise RetryError('Upload outcome is ambiguous; journal preserved and no automatic retry performed.') from None
            journal['attempts'][key].update(status='accepted', acceptedAt=release.now())
            save('journal.json', journal)
            require(isinstance(response, dict) and (key == '@controller' or response.get('name') == key),
                    'Upload response metadata differed; accepted attempt is retained, never repeated.')
            print(json.dumps({'accepted': key, 'candidate': state['id'], 'attempts': len(journal['attempts'])}), flush=True)
            deadline = time.monotonic() + WAIT_SECONDS
        if report['ready']:
            inventory = api.inventory(state['id'])
            report.update(staticInventory=inventory, staticInventoryExact=inventory == original['files'])
            save('after.json', report)
            require(report['staticInventoryExact'], 'Ready candidate static inventory differs.')
            release.complete_functions(report['candidateCompleteFunctionRecords'])
        source_check(root, release, attachment, original, args.commit, args.tree)
        _, latest = api.preflight(baseline, configured['environment'])
        require(latest == configured['environment'], 'Configuration changed during retry/capture.')
        print(json.dumps({'candidate': state['id'], 'supersedes': OLD_CANDIDATE, 'ready': report['ready'],
            'functionRecords': len(report['candidateCompleteFunctionRecords'] or []),
            'functionFieldDifferences': len(report['functionRecordDifferences']),
            'runtimeDifferences': len(report['runtimeDifferences']), 'identityFieldsWaived': [],
            'productionUnchangedAndLocked': True, 'releaseApproved': False,
            'evidence': STATE_PATH + '/after.json'}))
        return 0 if report['ready'] else 2


def pure_guards(root, output=None):
    release, attachment = helpers(root)
    baseline = release.read_baseline(release.DEFAULT_BASELINE)
    original, _ = attachment.read_original_state(baseline)
    manifest = json.loads(attachment.MANIFEST_PATH.read_text())
    packages = attachment.validate_manifest(manifest, baseline)
    payload = payload_for(release, baseline, original)
    passed = []
    def accept(name, callback):
        callback(); passed.append(name)
    def reject(name, callback):
        try:
            callback()
        except (RetryError, release.ReleaseError, attachment.AttachmentError):
            passed.append(name)
        else:
            raise RetryError('Offline guard failed: ' + name)
    accept('all41 exact original ZIP hashes and sizes', lambda: [attachment.read_archive(p) for p in packages])
    accept('only async:true differs in the complete pinned manifest', lambda: require(fp(payload) == PAYLOAD_SHA256, 'Payload drift.'))
    accept('review binds original recovery config deadline and one replacement', lambda: validate_review({**review_pins(release), 'reason': 'Synthetic guard fixture'}, release))
    reject('missing explicit retry approval', lambda: validate_review({**review_pins(release), 'approved': False, 'reason': 'fixture'}, release))
    old = copy.deepcopy(baseline['deploy'])
    old.update(id=OLD_CANDIDATE, site_id=release.SITE_ID, created_at=attachment.CANDIDATE_CREATED_AT,
        state='uploading', published_at=None, locked=None, draft=None, commit_ref=None,
        available_functions=[], required=[], required_functions=[], required_edge_functions=[], required_server=[], database_branch_id=None)
    deadline = stamp(LAST_OLD_UPLOAD) + datetime.timedelta(seconds=WAIT_SECONDS)
    accept('exact old pending candidate after full20minutes', lambda: old_stalled(old, baseline, original, release, attachment, deadline))
    reject('retry before deadline', lambda: old_stalled(old, baseline, original, release, attachment, deadline-datetime.timedelta(microseconds=1)))
    reject('old ready candidate never superseded automatically', lambda: old_stalled({**old, 'state': 'ready'}, baseline, original, release, attachment, deadline))
    reject('old candidate with new progress stops retry', lambda: old_stalled({**old, 'state': 'uploaded'}, baseline, original, release, attachment, deadline))
    reject('old published candidate stops retry', lambda: old_stalled({**old, 'published_at': 'now'}, baseline, original, release, attachment, deadline))
    new_id = 'a' * 24
    accept('new distinct candidate ID', lambda: fresh_id(new_id, release))
    reject('old ID cannot be replacement', lambda: fresh_id(OLD_CANDIDATE, release))
    reject('baseline ID cannot be replacement', lambda: fresh_id(release.BASELINE_ID, release))
    state = {'id': new_id, 'createdAt': '2026-11-02T04:00:00Z'}
    candidate = {**old, 'id': new_id, 'created_at': state['createdAt'], 'state': 'preparing'}
    accept('normal asynchronous preparing phase', lambda: validate_new(candidate, state, baseline, original, release))
    prepared = {**candidate, 'state': 'prepared', 'required_functions': [p['sha256'] for p in packages]}
    accept('prepared phase returns requested exact digests', lambda: validate_new(prepared, state, baseline, original, release))
    ready = {**candidate, 'state': 'ready', 'database_branch_id': 'production', 'available_functions': baseline['deploy']['available_functions']}
    accept('ready requires all41 records and exact production runtime', lambda: validate_new(ready, state, baseline, original, release))
    for label, update in [('wrong context', {'context': 'deploy-preview'}), ('unrelated static', {'required': ['0'*40]}),
        ('unknown function', {'required_functions': ['0'*64]}), ('scheduled configuration', {'function_schedules': []}),
        ('published', {'published_at': 'now'}), ('ready null database', {'state': 'ready', 'database_branch_id': None})]:
        reject('candidate rejects ' + label, lambda c={**prepared, **update}: validate_new(c, state, baseline, original, release))
    # Exercise the real request allowlist without constructing credentials or
    # allowing the parent transport to perform any external operation.
    API = api_class(release, attachment, baseline, original, packages, payload,
                    transport=lambda *args: {'offline': True})
    fake = object.__new__(API)
    post = 'sites/' + release.SITE_ID + '/deploys?title=TREE%20Arcade%3A%20asynchronous%20candidate%20retry'
    reject('creation must be armed after intent', lambda: fake.request(post, 'POST', payload))
    fake.create_armed = True
    altered = {**payload, 'async': False}
    reject('sync manifest cannot bypass async payload pin', lambda: fake.request(post, 'POST', altered))
    accept('one exact armed creation POST', lambda: fake.request(post, 'POST', payload))
    reject('successful create cannot automatically repeat', lambda: fake.request(post, 'POST', payload))
    fake.new_id = new_id
    package, record = packages[0], baseline['deploy']['available_functions'][0]
    data = attachment.read_archive(package)
    endpoint = endpoint_for(new_id, record, release)
    accept('new candidate exact binary upload with original runtime and mode', lambda: fake.request(endpoint, 'PUT', binary=data))
    reject('old candidate upload forbidden', lambda: fake.request(endpoint.replace(new_id, OLD_CANDIDATE), 'PUT', binary=data))
    for path, method in [('deploys/'+new_id+'/lock', 'POST'), ('deploys/'+new_id, 'DELETE'),
        ('accounts/'+release.ACCOUNT_ID+'/env', 'POST'), ('sites/'+release.SITE_ID+'/deploys/'+OLD_CANDIDATE+'/restore', 'POST')]:
        reject('request rejects '+method+' '+path.rsplit('/',1)[-1], lambda p=path,m=method: fake.request(p,m))
    report = {'passed': True, 'count': len(passed), 'checks': passed, 'remoteRequests': 0,
        'helperSha256': sha(Path(__file__).read_bytes()), 'originalHelperSha256': ORIGINAL_HELPER_SHA256,
        'attachmentHelperSha256': ATTACHMENT_HELPER_SHA256, 'payloadSha256': PAYLOAD_SHA256,
        'manifestSha256': MANIFEST_SHA256, 'expectedAddedPaths': sorted(ADDITIONS),
        'supersededCandidate': OLD_CANDIDATE, 'maximumNewCandidates': 1, 'publicationSupported': False}
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2)+'\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('guards', 'retry', 'capture'))
    parser.add_argument('--commit')
    parser.add_argument('--tree')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    try:
        if args.mode == 'guards':
            result = pure_guards(root, root / GUARDS_PATH)
            print(json.dumps({'passed': True, 'count': result['count'], 'helperSha256': result['helperSha256'], 'remoteRequests': 0}))
            return 0
        return run(args, root)
    except RetryError as error:
        print('Arcade retry stopped: '+str(error), file=sys.stderr)
    except Exception:
        print('Arcade retry stopped: local or network operation failed; raw details withheld.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
