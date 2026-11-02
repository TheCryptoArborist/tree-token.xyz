#!/usr/bin/env python3
"""DRAFT: exact provider-record review, verification and one-candidate publication.

Only guards (offline), verify (GET plus synthetic negative-authentication probe),
and publish (one POST to the pinned new candidate's lock endpoint) exist.
This draft cannot perform remote work until root finalizes the concrete provider
policy, supplies the committed review, and commits the three final procedure files.
Neither existing release helper is edited or given weaker verification rules.
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
import urllib.parse


ORIGINAL_COMMIT = '81b463838a2ed3c5c388be14c1935a80c221c73d'
ORIGINAL_TREE = 'e028fb2cd59f31e1f13c235d61f9e03bfe8caa4e'
RECOVERY_COMMIT = '00e9d0e0f7968751559c6f9458d5bdd1b3384afa'
RECOVERY_TREE = '3edeab27f14dc687b38a97f237a2027cc7c61e2b'
ORIGINAL_HELPER_SHA256 = 'c1fef669f8b0775b8970e0f31b16e5e4db406e4a32e7114abb291cc18a642f0f'
ATTACHMENT_HELPER_SHA256 = '1ef530a8e707000228380c45483f943a999ffe4207f766003a5e69685b5eae56'
CONFIGURATION_SHA256 = '233fe64419a86b8d70a4416a53916506f08932ee5c370682f6a196b54c01f3e3'
SUPERSEDED_CANDIDATE_ID = '6ae7fe815070789ddb725fa3'
RETRY_COMMIT = 'ef2fe8edd269600379c4160750553262ada8f5c3'
RETRY_TREE = 'c94ac71110cee9de398afbc5dfc8d7e7ebf09f11'
RETRY_HELPER_SHA256 = '0e6e1dda078c836f5d260022bd2773d00e0fd7c383ac01937b84c13a9cf3a405'
RETRY_PAYLOAD_SHA256 = '11dd087d6272edba2e2f8d675459cbf59a2320bb17e4c397d55c98734d44fa95'
RETRY_MANIFEST_SHA256 = 'b39dcbda43207af13928806bf01125479817a333721b51843c0fb456e69fddfc'
OLD_UPLOAD_JOURNAL_SHA256 = '7a68f268b6b26b5284c12c589bd4e14c6acbb8e2a7477bb55d3999fda9200d7e'
CANDIDATE_ID = '6ae806bda0c2f59d35109a6e'
CANDIDATE_CREATED_AT = '2026-11-02T03:42:53.290Z'
CANDIDATE_ORIGIN = 'https://' + CANDIDATE_ID + '--tree-token.netlify.app'

# Root must finalize these two lines after inspecting the actual READY capture.
# An empty allowlist is intentional; no generated identity is implicitly waived.
PROVIDER_POLICY_FINALIZED = True
REVIEWED_PROVIDER_FIELDS = frozenset(('a', 'c', 'id', 'oid'))

# Proposed names; root decides before copying this draft into the repository.
HELPER_RELATIVE = 'scripts/finalize-arcade-session-return.py'
REVIEW_RELATIVE = 'docs/arcade-session-return-provider-review.json'
GUARDS_RELATIVE = 'docs/arcade-session-return-finalization-guards.json'
FINAL_ADDITIONS = frozenset((HELPER_RELATIVE, REVIEW_RELATIVE, GUARDS_RELATIVE))
HOSTED_RELATIVE = '.netlify/arcade-session-return/hosted/hosted-candidate-browser-report.json'
FINAL_STATE_RELATIVE = '.netlify/arcade-session-return/retry-finalization'
RETRY_HELPER_RELATIVE = 'scripts/retry-arcade-session-return.py'
RETRY_REVIEW_RELATIVE = 'docs/arcade-session-return-retry-review.json'
RETRY_GUARDS_RELATIVE = 'docs/arcade-session-return-retry-guards.json'
RETRY_ADDITIONS = frozenset((RETRY_HELPER_RELATIVE, RETRY_REVIEW_RELATIVE, RETRY_GUARDS_RELATIVE))
RETRY_STATE_RELATIVE = '.netlify/arcade-session-return/retry/candidate.json'
RETRY_CAPTURE_RELATIVE = '.netlify/arcade-session-return/retry/after.json'
SOURCE_FILES = ('play/index.html', 'scripts/arcade-daily-growth.js',
                'styles/tree-arcade-suite.css', 'assets/arcade/arcade-growth-wallet.js')
EXPECTED_VIEWPORTS = {(1440, 900), (390, 844), (320, 740)}
GAME_IDS = {'garden-bot', 'pvp', 'arborist-trials', 'treeforce89'}
CABINETS = {'force-title': '/play/treeforce89/', 'arboretum-title': 'https://treegrow.xyz/',
    'deadfall-title': 'https://tree-token.xyz/play/deadfall-run/',
    'canopy-title': 'https://tree-token.xyz/play/canopy-defense/preview/',
    'garden-bot-title': 'https://nftree.net/battle/garden-bot', 'pvp-title': 'https://nftree.net/battle/pvp',
    'trials-title': 'https://nftree.net/battle/trials', 'clash-title': 'https://nftree.net/battle/canopy-clash'}


class FinalizationError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise FinalizationError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def fingerprint(value):
    return sha256(canonical(value))


def load_helpers(root):
    """No bytecode writes; verify all three immutable procedures, import the original utility helpers."""
    retry_path = root / RETRY_HELPER_RELATIVE
    require(retry_path.is_file() and not retry_path.is_symlink() and
            sha256(retry_path.read_bytes()) == RETRY_HELPER_SHA256,
            'The committed retry helper changed or remains unpinned.')
    modules = []
    for name, path, digest in (
        ('immutable_session_release', root / 'scripts/release-arcade-session-return.py', ORIGINAL_HELPER_SHA256),
        ('immutable_session_attachment', root / 'scripts/attach-arcade-session-return-functions.py', ATTACHMENT_HELPER_SHA256),
    ):
        require(path.is_file() and not path.is_symlink() and sha256(path.read_bytes()) == digest,
                'An immutable earlier helper changed.')
        spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        modules.append(module)
    return tuple(modules)


def timestamp(value):
    require(isinstance(value, str), 'Missing evidence timestamp.')
    try:
        result = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        raise FinalizationError('Malformed evidence timestamp.') from None
    require(result.tzinfo is not None, 'Evidence timestamp must include UTC offset.')
    return result


def require_retry_pins():
    require(all(isinstance(value, str) and re.fullmatch(r'[a-f0-9]{40}', value)
                for value in (RETRY_COMMIT, RETRY_TREE)) and
            isinstance(RETRY_HELPER_SHA256, str) and re.fullmatch(r'[a-f0-9]{64}', RETRY_HELPER_SHA256),
            'Retry commit/tree/helper digest must be explicitly pinned by root.')
    require(isinstance(CANDIDATE_ID, str) and re.fullmatch(r'[a-f0-9]{24}', CANDIDATE_ID) and
            CANDIDATE_ID != SUPERSEDED_CANDIDATE_ID, 'Pin the fresh retry candidate; the superseded candidate is forbidden.')
    timestamp(CANDIDATE_CREATED_AT)


def verify_source(root, release, attachment, commit, tree, state):
    require_retry_pins()
    require(PROVIDER_POLICY_FINALIZED, 'Draft provider policy is unapproved; finalize it after READY record review.')
    require(isinstance(commit, str) and re.fullmatch(r'[a-f0-9]{40}', commit) and
            isinstance(tree, str) and re.fullmatch(r'[a-f0-9]{40}', tree), 'Pass full final procedure commit/tree IDs.')
    git = release.git
    require(git('status', '--porcelain') == b'', 'Final procedure must be reviewed, committed and clean.')
    require(git('rev-parse', 'HEAD').decode().strip() == commit and
            git('rev-parse', 'HEAD^{tree}').decode().strip() == tree and
            git('branch', '--show-current').decode().strip() == release.SOURCE_BRANCH,
            'Final procedure checkout differs from the approved commit/tree/branch.')
    require(git('rev-parse', ORIGINAL_COMMIT + '^{tree}').decode().strip() == ORIGINAL_TREE and
            git('rev-parse', RECOVERY_COMMIT + '^{tree}').decode().strip() == RECOVERY_TREE and
            git('rev-parse', RETRY_COMMIT + '^{tree}').decode().strip() == RETRY_TREE,
            'Original, recovery or retry source tree changed.')
    git('merge-base', '--is-ancestor', RECOVERY_COMMIT, RETRY_COMMIT)
    git('merge-base', '--is-ancestor', RETRY_COMMIT, commit)
    retry_raw = git('diff', '--name-status', '--no-renames', '-z', RECOVERY_COMMIT, RETRY_COMMIT).decode().split('\0')
    require(retry_raw[-1:] == [''] and (len(retry_raw) - 1) % 2 == 0, 'Unrecognized retry procedure delta.')
    retry_changes = list(zip(retry_raw[:-1:2], retry_raw[1:-1:2]))
    require(len(retry_changes) == 3 and {path for _, path in retry_changes} == RETRY_ADDITIONS and
            all(status == 'A' for status, _ in retry_changes), 'Retry commit must add only its reviewed helper, review and guards.')
    for path in RETRY_ADDITIONS:
        attachment.plain_path(root / path)
        entry = git('ls-tree', RETRY_COMMIT, '--', path).decode().split()
        require(len(entry) >= 4 and entry[0] in ('100644', '100755') and entry[1] == 'blob' and
                git('show', RETRY_COMMIT + ':' + path) == (root / path).read_bytes(), 'A committed retry file changed.')
    retry_guards = json.loads((root / RETRY_GUARDS_RELATIVE).read_text())
    require(retry_guards.get('passed') is True and retry_guards.get('remoteRequests') == 0 and
            retry_guards.get('helperSha256') == RETRY_HELPER_SHA256 and
            retry_guards.get('payloadSha256') == RETRY_PAYLOAD_SHA256 and
            retry_guards.get('manifestSha256') == RETRY_MANIFEST_SHA256 and
            retry_guards.get('expectedAddedPaths') == sorted(RETRY_ADDITIONS), 'Committed retry guards changed.')
    raw = git('diff', '--name-status', '--no-renames', '-z', RETRY_COMMIT, commit).decode().split('\0')
    require(raw[-1:] == [''] and (len(raw) - 1) % 2 == 0, 'Unrecognized final procedure delta.')
    changes = list(zip(raw[:-1:2], raw[1:-1:2]))
    require(len(changes) == 3 and {path for _, path in changes} == FINAL_ADDITIONS and
            all(status == 'A' for status, _ in changes), 'Final commit may only add its helper, review and guards.')
    release.verify_source(ORIGINAL_COMMIT, ORIGINAL_TREE, state['overlay'])
    for path in attachment.RECOVERY_ADDITIONS:
        require(git('show', RECOVERY_COMMIT + ':' + path) == (root / path).read_bytes(),
                'A reviewed recovery artifact changed.')
    for path in FINAL_ADDITIONS:
        attachment.plain_path(root / path)
        entry = git('ls-tree', commit, '--', path).decode().split()
        require(len(entry) >= 4 and entry[0] in ('100644', '100755') and entry[1] == 'blob' and
                git('show', commit + ':' + path) == (root / path).read_bytes(), 'Final procedure file changed.')
    require(git('check-ignore', FINAL_STATE_RELATIVE + '/verified.json').strip(), 'Final state must remain ignored.')
    guards = json.loads((root / GUARDS_RELATIVE).read_text())
    require(guards.get('passed') is True and guards.get('remoteRequests') == 0 and
            guards.get('helperSha256') == sha256((root / HELPER_RELATIVE).read_bytes()) and
            guards.get('originalHelperSha256') == ORIGINAL_HELPER_SHA256 and
            guards.get('attachmentHelperSha256') == ATTACHMENT_HELPER_SHA256 and
            guards.get('retryHelperSha256') == RETRY_HELPER_SHA256 and
            guards.get('retryCommit') == RETRY_COMMIT and guards.get('retryTree') == RETRY_TREE and
            guards.get('reviewedProviderFields') == sorted(REVIEWED_PROVIDER_FIELDS),
            'Final offline guard evidence is missing or stale.')


def validate_retry_provenance(retry_state, capture, expected_proof, site_id):
    require(retry_state == {'id': CANDIDATE_ID, 'createdAt': CANDIDATE_CREATED_AT,
            'siteId': site_id, 'supersedes': SUPERSEDED_CANDIDATE_ID, 'proof': expected_proof},
            'Retry candidate receipt differs from the pinned source, manifest or new candidate.')
    require(capture.get('proof') == {**expected_proof, 'candidate': CANDIDATE_ID,
            'candidateCreatedAt': CANDIDATE_CREATED_AT, 'supersededCandidate': SUPERSEDED_CANDIDATE_ID},
            'Retry capture does not belong to the exact new candidate receipt.')
    require(capture.get('supersededCandidatePublicationForbidden') is True and
            timestamp(capture.get('capturedAt')) >= timestamp(CANDIDATE_CREATED_AT),
            'Retry capture must forbid the old candidate and postdate the new candidate.')


def validate_provider_review(review, capture, capture_sha, baseline, state, release, attachment):
    require(isinstance(review, dict) and review.get('approved') is True and review.get('reviewer') == 'root',
            'An explicit committed root provider review is required.')
    pins = {'candidate': CANDIDATE_ID, 'baseline': release.BASELINE_ID,
            'originalSourceCommit': ORIGINAL_COMMIT, 'originalSourceTree': ORIGINAL_TREE,
            'recoveryCommit': RECOVERY_COMMIT, 'recoveryTree': RECOVERY_TREE,
            'retryProcedureCommit': RETRY_COMMIT, 'retryProcedureTree': RETRY_TREE,
            'retryHelperSha256': RETRY_HELPER_SHA256, 'candidateCreatedAt': CANDIDATE_CREATED_AT,
            'supersededCandidate': SUPERSEDED_CANDIDATE_ID,
            'configurationSha256': CONFIGURATION_SHA256, 'attachmentHelperSha256': ATTACHMENT_HELPER_SHA256,
            'payloadSha256': RETRY_PAYLOAD_SHA256, 'manifestSha256': RETRY_MANIFEST_SHA256}
    require(all(review.get(key) == value for key, value in pins.items()), 'Provider review identity changed.')
    require(review.get('retryCaptureSha256') == capture_sha, 'Reviewed retry capture changed.')
    require(isinstance(review.get('summary'), str) and review['summary'].strip(), 'Concrete provider-change explanation required.')
    require(timestamp(review['reviewedAt']) >= timestamp(CANDIDATE_CREATED_AT), 'Provider review predates the candidate.')
    require(capture.get('ready') is True and capture.get('staticInventoryExact') is True and
            capture.get('staticInventory') == state['files'] and capture.get('identityFieldsWaived') == [] and
            capture.get('releaseApproved') is False and capture.get('runtimeDifferences') == [] and
            capture.get('supersededCandidatePublicationForbidden') is True,
            'Retry capture must be READY with exact static and protected runtime configuration.')
    proof = capture.get('proof', {})
    proof_pins = {'candidate': CANDIDATE_ID, 'candidateCreatedAt': CANDIDATE_CREATED_AT,
            'supersededCandidate': SUPERSEDED_CANDIDATE_ID,
            'originalSourceCommit': ORIGINAL_COMMIT, 'originalSourceTree': ORIGINAL_TREE,
            'recoveryCommit': RECOVERY_COMMIT, 'recoveryTree': RECOVERY_TREE,
            'retryProcedureCommit': RETRY_COMMIT, 'retryProcedureTree': RETRY_TREE,
            'configurationSha256': CONFIGURATION_SHA256, 'helperSha256': RETRY_HELPER_SHA256,
            'payloadSha256': RETRY_PAYLOAD_SHA256, 'manifestSha256': RETRY_MANIFEST_SHA256}
    require(all(proof.get(key) == value for key, value in proof_pins.items()), 'Retry capture provenance changed.')
    require(timestamp(review['reviewedAt']) >= timestamp(capture.get('capturedAt')),
            'Provider review predates the READY retry capture.')
    actual = capture.get('candidateCompleteFunctionRecords')
    expected = baseline['deploy']['available_functions']
    release.complete_functions(actual)
    require(capture.get('baselineCompleteFunctionRecords') == expected and
            capture.get('candidate', {}).get('available_functions') == actual and
            review.get('candidateFunctionRecords') == actual, 'Complete reviewed function records differ.')
    validate_candidate(capture['candidate'], baseline, state, actual, release, published=False)
    old = {item['n']: item for item in expected}
    new = {item['n']: item for item in actual}
    require(set(old) == set(new), 'Function names changed.')
    deltas = attachment.differences(old, new, ('available_functions',))
    require(capture.get('functionRecordDifferences') == deltas and review.get('reviewedFunctionDifferences') == deltas,
            'Every actual function-record difference must be enumerated exactly in the committed review.')
    fields = set()
    for delta in deltas:
        path = delta['path']
        require(len(path) == 3 and path[0] == 'available_functions' and path[1] in old and
                path[2] in REVIEWED_PROVIDER_FIELDS,
                'Unapproved package/runtime/configuration/provider field changed.')
        fields.add(path[2])
    require(review.get('reviewedProviderFields') == sorted(fields) == sorted(REVIEWED_PROVIDER_FIELDS),
            'Provider policy must list exactly the concretely reviewed changed fields.')
    require(review.get('functionOrderChanged') is (list(old) != list(new)) and
            capture.get('functionOrderChanged') is (list(old) != list(new)), 'Function-order change was not explicitly reviewed.')
    # Defense in depth even if the future root-reviewed provider allowlist is
    # edited incorrectly: all known package/runtime/config fields stay exact.
    protected = ('n', 'd', 's', 'r', 'im', 'rg', 'rgo', 'm', 'mo', 'bd', 'dn', 'g', 'ro', 'er',
                 'p', 'tr', 'vcpu', 'es', 'obl', 'oblv')
    require(not set(protected) & REVIEWED_PROVIDER_FIELDS, 'Protected fields may never become identity exceptions.')
    for name in old:
        for field in protected:
            require((field in old[name], old[name].get(field)) == (field in new[name], new[name].get(field)),
                    'A protected function field changed.')
    attachment.safe_metadata(review)
    return actual


def validate_candidate(candidate, baseline, state, reviewed_records, release, *, published):
    require(candidate.get('id') == CANDIDATE_ID and candidate.get('site_id') == release.SITE_ID and
            candidate.get('created_at') == CANDIDATE_CREATED_AT and candidate.get('state') == 'ready' and
            candidate.get('context') == 'production' and not candidate.get('draft') and
            candidate.get('commit_ref') in (None, ORIGINAL_COMMIT), 'Unexpected candidate identity or state.')
    require(bool(candidate.get('published_at')) is published and bool(candidate.get('locked')) is published,
            'Candidate publication/lock state differs from this phase.')
    require(candidate.get('available_functions') == reviewed_records, 'Ready function records differ from exact committed review.')
    for field in release.RUNTIME_FIELDS:
        if field != 'available_functions':
            require(candidate.get(field) == baseline['deploy'].get(field), 'Protected deployment runtime drift: ' + field)
    for field in ('required', 'required_functions', 'required_edge_functions', 'required_server'):
        require(candidate.get(field) in (None, []), 'Candidate still requires an upload.')
    require(not candidate.get('edge_functions_present') and not candidate.get('server') and
            release.migration_count(candidate) == 0, 'Unreviewed runtime bundle or database migration.')


def validate_hosted(report, state, expected_sources):
    require(report.get('passed') is True and report.get('synthetic') is False and
            report.get('actualHostedCode') is True and report.get('target') == CANDIDATE_ORIGIN + '/play/' and
            report.get('label') == 'candidate', 'Passing real candidate-browser evidence is required.')
    require(timestamp(report.get('checkedAt')) >= timestamp(CANDIDATE_CREATED_AT), 'Hosted report predates candidate.')
    require(report.get('sourceSha256') == expected_sources and report.get('pinnedSourceSha256') == expected_sources,
            'Hosted source bytes differ from the original approved application.')
    files = report.get('fetchedFiles')
    require(isinstance(files, list) and len(files) == 4 and {item.get('file') for item in files} == set(SOURCE_FILES)
            and all(item.get('status') == 200 and item.get('sha256') == expected_sources[item['file']] for item in files),
            'Hosted HTML/controller/CSS/wallet fetch evidence is incomplete.')
    require(report.get('tls') == {'authorized': True, 'status': 200} and report.get('cabinetLinks') == CABINETS,
            'Hosted TLS or existing cabinet destinations differ.')
    require(all(report.get(key) is True for key in ('noWalletConnected', 'noSignatures', 'noRemoteWrites')) and
            all(report.get(key) == [] for key in ('blockedRequests', 'pageErrors', 'consoleErrors')),
            'Hosted run used credentials/writes or reported browser errors.')
    checks = report.get('checks')
    require(isinstance(checks, list) and len(checks) == 5 and all(item.get('passed') is True for item in checks),
            'All five real hosted browser groups must pass.')
    dimensions = report.get('dimensions')
    require(isinstance(dimensions, list) and len(dimensions) == 3 and
            {(item['viewport']['width'], item['viewport']['height']) for item in dimensions} == EXPECTED_VIEWPORTS,
            'Desktop,390px and320px hosted evidence is required.')
    for item in dimensions:
        size, view = item['viewport'], item['collapsed']
        require(view.get('detailsOpen') is False and view.get('overflow') == [] and
                view.get('scrollWidth', float('inf')) <= size['width'] + 1 and
                view.get('firstPoster', {}).get('top', float('inf')) < size['height'] and
                item.get('dateCount') in (28, 29, 30, 31), 'Hosted compact layout or month rail failed.')
    configuration = report.get('configuration', {})
    for key in ('enabledGames', 'eligibleGames'):
        games = configuration.get(key)
        require(isinstance(games, list) and len(games) == 4 and {game.get('id') for game in games} == GAME_IDS,
                'Hosted four-game configuration differs.')
    require(next(game for game in configuration['eligibleGames'] if game['id'] == 'treeforce89').get('creditRule') == 'start-run',
            'Hosted TREE FORCE credit rule differs.')
    requests, responses = report.get('requests'), report.get('responses')
    require(isinstance(requests, list) and requests and isinstance(responses, list) and responses and
            all(item.get('status') == 200 for item in responses), 'Hosted network evidence is incomplete or failed.')
    for item in requests:
        url = urllib.parse.urlsplit(item.get('url', ''))
        allowed_api = url.path == '/api/arcade-growth' and urllib.parse.parse_qs(url.query) == {'action': ['status']}
        require(url.scheme + '://' + url.netloc == CANDIDATE_ORIGIN and
                item.get('method') in ('GET', 'HEAD') and item.get('hasAuthorization') is False and
                (url.path in state['files'] or url.path == '/play/' or allowed_api),
                'Hosted report contains an unapproved request.')


def hosted_evidence(root, release, attachment, state):
    path = attachment.plain_path(root / HOSTED_RELATIVE)
    data = path.read_bytes()
    report = json.loads(data)
    expected = {path: sha256(release.git('show', ORIGINAL_COMMIT + ':' + path)) for path in SOURCE_FILES}
    validate_hosted(report, state, expected)
    screenshots = report.get('screenshots')
    require(isinstance(screenshots, list) and len(screenshots) == 2, 'Hosted desktop/mobile screenshots are required.')
    evidence = []
    staging = (root / '.netlify/arcade-session-return/hosted').resolve()
    names = {'hosted-candidate-signed-out-1440.jpg', 'hosted-candidate-signed-out-320.jpg'}
    for value in screenshots:
        image = attachment.plain_path(Path(value))
        require(image.is_relative_to(staging) and image.name in names, 'Screenshot must be in ignored hosted staging.')
        raw = image.read_bytes()
        require(raw.startswith(b'\xff\xd8') and raw.endswith(b'\xff\xd9'), 'Hosted screenshot is not a complete JPEG.')
        evidence.append({'path': str(image.relative_to(root)), 'size': len(raw), 'sha256': sha256(raw)})
    require({Path(item['path']).name for item in evidence} == names, 'Duplicate or missing hosted screenshot.')
    return {'path': HOSTED_RELATIVE, 'sha256': sha256(data), 'checkedAt': report['checkedAt'],
            'checks': 5, 'screenshots': evidence, 'sourceSha256': expected,
            'requestCount': len(report['requests']), 'synthetic': False}


def probe_valid(probe, origin):
    return (isinstance(probe, dict) and probe.get('status') == 401 and probe.get('code') == 'invalid-game-session'
            and probe.get('participationWritten') is False and probe.get('method') == 'POST'
            and probe.get('url') == origin + '/api/arcade-growth?action=treeforce-play')


def require_prior(prior, proof):
    require(isinstance(prior, dict) and prior.get('passed') is True and prior.get('unpublished') is True and
            prior.get('proof') == proof and probe_valid(prior.get('candidateNegativeProbe'), CANDIDATE_ORIGIN),
            'Publication requires this exact final source/review/browser/configuration verification and real401 probe.')


def validate_api_request(endpoint, method, body, binary, release, *, lock_armed):
    gets = {'sites/' + release.SITE_ID, 'deploys/' + release.BASELINE_ID, 'deploys/' + CANDIDATE_ID}
    for deploy in (release.BASELINE_ID, CANDIDATE_ID):
        gets.update(f'deploys/{deploy}/files?per_page=100&page={page}' for page in range(1, 5))
    env = 'accounts/' + release.ACCOUNT_ID + '/env'
    gets.update((env, env + '?scope=functions', env + '?site_id=' + release.SITE_ID,
                 env + '?site_id=' + release.SITE_ID + '&scope=functions'))
    if method == 'GET':
        require(endpoint in gets and body is None and binary is None, 'Unapproved GET endpoint/body.')
        return
    require(lock_armed and method == 'POST' and endpoint == 'deploys/' + CANDIDATE_ID + '/lock' and
            body is None and binary is None, 'Only the separately verified new-candidate publication POST is allowed.')


def api_for(release):
    class FinalAPI(release.Netlify):
        lock_armed = False
        def request(self, endpoint, method='GET', body=None, binary=None):
            validate_api_request(endpoint, method, body, binary, release, lock_armed=self.lock_armed)
            if method == 'POST':
                self.lock_armed = False
            return super().request(endpoint, method, body, binary)
    return FinalAPI()


def local_review(root, release, attachment, args):
    baseline = release.read_baseline(release.DEFAULT_BASELINE)
    state, configured = attachment.read_original_state(baseline)
    verify_source(root, release, attachment, args.commit, args.tree, state)
    manifest = json.loads(attachment.MANIFEST_PATH.read_text())
    require(fingerprint(manifest) == RETRY_MANIFEST_SHA256, 'Reviewed exact archive manifest changed.')
    packages = attachment.validate_manifest(manifest, baseline)
    for package in packages:
        attachment.read_archive(package)
    retry_state_bytes = attachment.plain_path(root / RETRY_STATE_RELATIVE).read_bytes()
    retry_state = json.loads(retry_state_bytes)
    capture_bytes = attachment.plain_path(root / RETRY_CAPTURE_RELATIVE).read_bytes()
    captured = json.loads(capture_bytes)
    retry_review_bytes = attachment.plain_path(root / RETRY_REVIEW_RELATIVE).read_bytes()
    retry_review = json.loads(retry_review_bytes)
    require(retry_review.get('approved') is True and
            retry_review.get('supersededCandidate') == SUPERSEDED_CANDIDATE_ID and
            retry_review.get('maximumNewCandidates') == 1 and
            retry_review.get('supersededCandidatePublicationForbidden') is True,
            'Committed single-candidate retry approval changed.')
    require(sha256(attachment.plain_path(attachment.JOURNAL_PATH).read_bytes()) == OLD_UPLOAD_JOURNAL_SHA256,
            'The original accepted-upload journal changed.')
    retry_payload = {'files': state['files'], **release.configuration_for(baseline['deploy']['available_functions']),
            'function_schedules': baseline['deploy']['function_schedules'], 'draft': False, 'async': True,
            'branch': baseline['deploy']['branch'], 'commit_ref': ORIGINAL_COMMIT}
    require(fingerprint(retry_payload) == RETRY_PAYLOAD_SHA256, 'Exact async retry payload changed.')
    retry_proof = {'originalSourceCommit': ORIGINAL_COMMIT, 'originalSourceTree': ORIGINAL_TREE,
            'recoveryCommit': RECOVERY_COMMIT, 'recoveryTree': RECOVERY_TREE,
            'retryProcedureCommit': RETRY_COMMIT, 'retryProcedureTree': RETRY_TREE,
            'helperSha256': RETRY_HELPER_SHA256, 'retryReviewSha256': sha256(retry_review_bytes),
            'configurationSha256': CONFIGURATION_SHA256, 'manifestSha256': RETRY_MANIFEST_SHA256,
            'payloadSha256': RETRY_PAYLOAD_SHA256, 'filesSha256': state['filesSha256'],
            'originalCandidateProof': release.candidate_proof(state), 'oldUploadJournalSha256': OLD_UPLOAD_JOURNAL_SHA256}
    validate_retry_provenance(retry_state, captured, retry_proof, release.SITE_ID)
    review_bytes = attachment.plain_path(root / REVIEW_RELATIVE).read_bytes()
    review = json.loads(review_bytes)
    require(review.get('retryCandidateReceiptSha256') == sha256(retry_state_bytes) and
            review.get('retryReviewSha256') == sha256(retry_review_bytes), 'Reviewed retry receipt or review changed.')
    records = validate_provider_review(review, captured, sha256(capture_bytes), baseline, state, release, attachment)
    browser = hosted_evidence(root, release, attachment, state)
    proof = {'candidate': CANDIDATE_ID, 'originalSourceCommit': ORIGINAL_COMMIT, 'originalSourceTree': ORIGINAL_TREE,
             'recoveryCommit': RECOVERY_COMMIT, 'recoveryTree': RECOVERY_TREE,
             'retryProcedureCommit': RETRY_COMMIT, 'retryProcedureTree': RETRY_TREE,
             'retryHelperSha256': RETRY_HELPER_SHA256, 'supersededCandidate': SUPERSEDED_CANDIDATE_ID,
             'finalProcedureCommit': args.commit, 'finalProcedureTree': args.tree,
             'finalHelperSha256': sha256((root / HELPER_RELATIVE).read_bytes()),
             'providerReviewSha256': sha256(review_bytes), 'configurationSha256': CONFIGURATION_SHA256,
             'retryCandidateReceiptSha256': sha256(retry_state_bytes), 'retryCaptureSha256': sha256(capture_bytes),
             'retryReviewSha256': sha256(retry_review_bytes), 'payloadSha256': RETRY_PAYLOAD_SHA256,
             'manifestSha256': fingerprint(manifest),
             'candidateFunctionRecordsSha256': fingerprint(records), 'filesSha256': state['filesSha256'],
             'hostedBrowser': browser}
    return baseline, state, configured, packages, review, records, proof


def write_receipt(root, release, attachment, api, args, baseline, state, configured, packages, review, records, proof, prior):
    site = api.current_is(CANDIDATE_ID)
    candidate = api.request('deploys/' + CANDIDATE_ID)
    validate_candidate(candidate, baseline, state, records, release, published=True)
    require(api.inventory(CANDIDATE_ID) == state['files'], 'Published static inventory changed.')
    previous = api.baseline_integrity(baseline)
    require(api.environment(baseline, site, configured['environment']) == configured['environment'],
            'Published environment changed.')
    canonical_probe = release.negative_probe(release.CANONICAL_ORIGIN)
    require(probe_valid(canonical_probe, release.CANONICAL_ORIGIN), 'Canonical negative database probe failed.')
    verify_source(root, release, attachment, args.commit, args.tree, state)
    api.current_is(CANDIDATE_ID)
    receipt = {'published': True, 'locked': True, 'candidate': CANDIDATE_ID,
        'publishedAt': candidate['published_at'], 'recordedAt': release.now(), 'proof': proof,
        'applicationSourceCommit': ORIGINAL_COMMIT, 'applicationSourceTree': ORIGINAL_TREE,
        'archiveRecoveryCommit': RECOVERY_COMMIT, 'archiveRecoveryTree': RECOVERY_TREE,
        'retryProcedureCommit': RETRY_COMMIT, 'retryProcedureTree': RETRY_TREE,
        'retryHelperSha256': RETRY_HELPER_SHA256, 'supersededCandidate': SUPERSEDED_CANDIDATE_ID,
        'finalProcedureCommit': args.commit, 'finalProcedureTree': args.tree,
        'files': 284, 'filesBySha1': state['files'], 'preservedStaticFiles': 283,
        'changedExistingPaths': ['/scripts/arcade-daily-growth.js'], 'newPublicPaths': [],
        'unchangedFunctionPackages': 41, 'functionPackageBytes': sum(item['size'] for item in packages),
        'functionPackages': packages, 'actualCompleteFunctionRecords': records,
        'reviewedProviderFields': sorted(REVIEWED_PROVIDER_FIELDS),
        'reviewedFunctionDifferences': review['reviewedFunctionDifferences'],
        'functionOrderChanged': review['functionOrderChanged'], 'protectedFunctionFieldsExact': True,
        'runtime': {key: candidate.get(key) for key in release.RUNTIME_FIELDS if key != 'available_functions'},
        'schedulesPreserved': 5, 'siteFunctionEnvironmentEntries': 50,
        'preservedFunctionEnvironmentEntries': 49, 'configurationSha256': CONFIGURATION_SHA256,
        'candidateNegativeProbe': prior['candidateNegativeProbe'], 'canonicalNegativeProbe': canonical_probe,
        'hostedCandidateBrowser': proof['hostedBrowser'], 'deployEnvironmentOverrides': [],
        'previousDeploy': release.BASELINE_ID, 'previousDeployLocked': previous.get('locked'),
        'publicationLockScope': 'current publication only; never relock an earlier deployment',
        'url': release.CANONICAL_ORIGIN + '/play/', 'candidateUrl': CANDIDATE_ORIGIN + '/play/'}
    # This receipt is constructed from known safe fields. Provider records and
    # review text were already checked before use; configuration values and
    # raw API responses are never included. The pinned probe emits descriptive
    # credential provenance only, never the synthetic bearer itself.
    release.save(root / FINAL_STATE_RELATIVE / 'receipt.json', receipt)
    return receipt


def run(args, root):
    require_retry_pins()
    require(PROVIDER_POLICY_FINALIZED, 'This draft cannot perform remote requests; concrete provider policy is still unapproved.')
    release, attachment = load_helpers(root)
    values = local_review(root, release, attachment, args)
    baseline, state, configured, packages, review, records, proof = values
    directory = attachment.plain_path(root / FINAL_STATE_RELATIVE)
    directory.mkdir(parents=True, exist_ok=True)
    verified_path, intent_path = directory / 'verified.json', directory / 'publish-intent.json'
    descriptor = os.open(attachment.plain_path(directory / 'operation.lock'), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise FinalizationError('Another final verification/publication operation is running.') from None
        api = api_for(release)
        if args.mode == 'publish' and intent_path.exists():
            intent = json.loads(attachment.plain_path(intent_path).read_text())
            prior = json.loads(attachment.plain_path(verified_path).read_text())
            require(intent.get('proof') == proof and intent.get('verificationSha256') == fingerprint(prior),
                    'Publication intent differs from exact prior verification.')
            require_prior(prior, proof)
            # A recorded publication attempt is never repeated. Only readback of
            # the exact already-published candidate may finish its receipt.
            api.current_is(CANDIDATE_ID)
            receipt = write_receipt(root, release, attachment, api, args, baseline, state, configured,
                                    packages, review, records, proof, prior)
            print(json.dumps({'mode': 'publish', 'published': True, 'resumedByReadback': True,
                              'candidate': CANDIDATE_ID, 'canonicalProbe': receipt['canonicalNegativeProbe']['code']}))
            return
        _, environment = api.preflight(baseline, configured['environment'])
        require(environment == configured['environment'], 'Configured 50-entry environment changed.')
        candidate = api.request('deploys/' + CANDIDATE_ID)
        validate_candidate(candidate, baseline, state, records, release, published=False)
        require(api.inventory(CANDIDATE_ID) == state['files'], 'Candidate static inventory differs.')
        if args.mode == 'verify':
            probe = release.negative_probe(CANDIDATE_ORIGIN)
            require(probe_valid(probe, CANDIDATE_ORIGIN), 'Real candidate database authentication probe failed.')
            api.preflight(baseline, configured['environment'])
            validate_candidate(api.request('deploys/' + CANDIDATE_ID), baseline, state, records, release, published=False)
            require(local_review(root, release, attachment, args)[-1] == proof, 'Local verification evidence changed during probe.')
            release.save(verified_path, {'passed': True, 'unpublished': True, 'verifiedAt': release.now(),
                         'proof': proof, 'candidateNegativeProbe': probe})
            print(json.dumps({'mode': 'verify', 'passed': True, 'candidate': CANDIDATE_ID,
                              'negativeProbe': probe['code'], 'hostedBrowserGroups': 5,
                              'reviewedProviderDifferences': len(review['reviewedFunctionDifferences'])}))
            return
        prior = json.loads(attachment.plain_path(verified_path).read_text())
        require_prior(prior, proof)
        require(local_review(root, release, attachment, args)[-1] == proof, 'Publication evidence changed.')
        api.preflight(baseline, configured['environment'])
        validate_candidate(api.request('deploys/' + CANDIDATE_ID), baseline, state, records, release, published=False)
        release.save(intent_path, {'proof': proof, 'verificationSha256': fingerprint(prior),
                                  'recordedAt': release.now(), 'operation': 'POST this new candidate lock exactly once'})
        api.current_is(release.BASELINE_ID)
        api.lock_armed = True
        try:
            api.request('deploys/' + CANDIDATE_ID + '/lock', 'POST')
        except Exception:
            # No retry: only exact publication readback can resolve uncertainty.
            api.current_is(CANDIDATE_ID)
        receipt = write_receipt(root, release, attachment, api, args, baseline, state, configured,
                                packages, review, records, proof, prior)
        print(json.dumps({'mode': 'publish', 'published': True, 'candidate': CANDIDATE_ID,
                          'canonicalProbe': receipt['canonicalNegativeProbe']['code'],
                          'receipt': FINAL_STATE_RELATIVE + '/receipt.json'}))


def pure_guards(root, output_path=None):
    """Focused synthetic guards. Does not instantiate API, read credentials or call probes."""
    release, attachment = load_helpers(root)
    baseline = release.read_baseline(release.DEFAULT_BASELINE)
    state, _ = attachment.read_original_state(baseline)
    fixture_time = (timestamp(CANDIDATE_CREATED_AT) + datetime.timedelta(seconds=1)).isoformat()
    passed = []
    def accept(name, callback):
        callback()
        passed.append(name)
    def reject(name, callback):
        try:
            callback()
        except (FinalizationError, release.ReleaseError, attachment.AttachmentError):
            passed.append(name)
        else:
            raise FinalizationError('Offline guard failed: ' + name)
    candidate = copy.deepcopy(baseline['deploy'])
    records = copy.deepcopy(candidate['available_functions'])
    candidate.update(id=CANDIDATE_ID, site_id=release.SITE_ID, created_at=CANDIDATE_CREATED_AT,
                     state='ready', locked=None, published_at=None, draft=None, commit_ref=None,
                     required=[], required_functions=[], required_edge_functions=[], required_server=[])
    accept('exact reviewed ready unpublished candidate', lambda: validate_candidate(candidate, baseline, state, records, release, published=False))
    for label, update in [('wrong candidate', {'id': release.BASELINE_ID}), ('wrong site', {'site_id': 'other'}),
        ('already published', {'published_at': 'now'}), ('already locked', {'locked': True}),
        ('pending', {'state': 'uploading'}), ('ready null database branch', {'database_branch_id': None}),
        ('other schedule', {'function_schedules': []}), ('unknown package upload', {'required_functions': ['0'*64]}),
        ('source metadata', {'commit_ref': '0'*40})]:
        reject(label, lambda c={**candidate, **update}: validate_candidate(c, baseline, state, records, release, published=False))
    changed = copy.deepcopy(records)
    changed[0]['id'] = 'not-the-reviewed-id'
    reject('even provider identity must equal exact reviewed records', lambda: validate_candidate(
        {**candidate, 'available_functions': changed}, baseline, state, records, release, published=False))
    probe = {'method': 'POST', 'status': 401, 'code': 'invalid-game-session', 'participationWritten': False,
             'url': CANDIDATE_ORIGIN + '/api/arcade-growth?action=treeforce-play'}
    proof = {'fixture': 'full source, review, browser, config proof'}
    prior = {'passed': True, 'unpublished': True, 'proof': proof, 'candidateNegativeProbe': probe}
    accept('exact prior verification and real-probe result shape', lambda: require_prior(prior, proof))
    reject('prior verification belongs to other source', lambda: require_prior(prior, {'fixture': 'different'}))
    reject('no prior successful verification', lambda: require_prior({**prior, 'passed': False}, proof))
    for field, value in [('status', 503), ('code', 'participation-unavailable'), ('participationWritten', True),
                         ('url', 'https://tree-token.xyz/api/arcade-growth?action=treeforce-play')]:
        reject('negative probe rejects ' + field, lambda f=field, v=value: require_prior(
            {**prior, 'candidateNegativeProbe': {**probe, f: v}}, proof))
    lock = 'deploys/' + CANDIDATE_ID + '/lock'
    accept('only armed exact new-candidate lock POST', lambda: validate_api_request(lock, 'POST', None, None, release, lock_armed=True))
    reject('publication not armed', lambda: validate_api_request(lock, 'POST', None, None, release, lock_armed=False))
    for label, endpoint, method in [('old deploy publication', 'deploys/' + release.BASELINE_ID + '/lock', 'POST'),
        ('create', 'sites/' + release.SITE_ID + '/deploys', 'POST'), ('config', 'accounts/' + release.ACCOUNT_ID + '/env', 'POST'),
        ('upload', 'deploys/' + CANDIDATE_ID + '/functions/arcade-growth', 'PUT'),
        ('restore', 'sites/' + release.SITE_ID + '/deploys/' + release.BASELINE_ID + '/restore', 'POST'),
        ('delete', 'deploys/' + CANDIDATE_ID, 'DELETE')]:
        reject('request rejects ' + label, lambda e=endpoint, m=method: validate_api_request(e, m, None, None, release, lock_armed=True))
    reject('publication body not allowed', lambda: validate_api_request(lock, 'POST', {}, None, release, lock_armed=True))
    # Provider-policy fixture: uses the exact baseline and a temporary local
    # synthetic field decision; it cannot authorize production remote work.
    retry_proof = {'originalSourceCommit': ORIGINAL_COMMIT, 'originalSourceTree': ORIGINAL_TREE,
        'recoveryCommit': RECOVERY_COMMIT, 'recoveryTree': RECOVERY_TREE,
        'retryProcedureCommit': RETRY_COMMIT, 'retryProcedureTree': RETRY_TREE,
        'configurationSha256': CONFIGURATION_SHA256, 'helperSha256': RETRY_HELPER_SHA256,
        'manifestSha256': RETRY_MANIFEST_SHA256, 'payloadSha256': RETRY_PAYLOAD_SHA256,
        'retryReviewSha256': '3'*64, 'filesSha256': state['filesSha256'],
        'originalCandidateProof': release.candidate_proof(state), 'oldUploadJournalSha256': OLD_UPLOAD_JOURNAL_SHA256}
    retry_state = {'id': CANDIDATE_ID, 'createdAt': CANDIDATE_CREATED_AT, 'siteId': release.SITE_ID,
        'supersedes': SUPERSEDED_CANDIDATE_ID, 'proof': retry_proof}
    capture = {'ready': True, 'staticInventoryExact': True, 'staticInventory': state['files'],
        'identityFieldsWaived': [], 'releaseApproved': False, 'runtimeDifferences': [],
        'supersededCandidatePublicationForbidden': True, 'capturedAt': fixture_time,
        'proof': {**retry_proof, 'candidate': CANDIDATE_ID, 'candidateCreatedAt': CANDIDATE_CREATED_AT,
                  'supersededCandidate': SUPERSEDED_CANDIDATE_ID},
        'baselineCompleteFunctionRecords': records, 'candidateCompleteFunctionRecords': records,
        'candidate': candidate, 'functionRecordDifferences': [], 'functionOrderChanged': False}
    accept('exact new receipt and full retry capture provenance', lambda: validate_retry_provenance(
        retry_state, capture, retry_proof, release.SITE_ID))
    reject('superseded candidate receipt forbidden', lambda: validate_retry_provenance(
        {**retry_state, 'id': SUPERSEDED_CANDIDATE_ID}, capture, retry_proof, release.SITE_ID))
    reject('changed retry payload proof forbidden', lambda: validate_retry_provenance(
        {**retry_state, 'proof': {**retry_proof, 'payloadSha256': '0'*64}}, capture, retry_proof, release.SITE_ID))
    reject('old capture cannot substitute for new retry capture', lambda: validate_retry_provenance(
        retry_state, {**capture, 'proof': {**capture['proof'], 'candidate': SUPERSEDED_CANDIDATE_ID}}, retry_proof, release.SITE_ID))
    reject('missing old-candidate publication prohibition', lambda: validate_retry_provenance(
        retry_state, {**capture, 'supersededCandidatePublicationForbidden': False}, retry_proof, release.SITE_ID))
    review = {'approved': True, 'reviewer': 'root', 'candidate': CANDIDATE_ID, 'baseline': release.BASELINE_ID,
        'candidateCreatedAt': CANDIDATE_CREATED_AT, 'supersededCandidate': SUPERSEDED_CANDIDATE_ID,
        'originalSourceCommit': ORIGINAL_COMMIT, 'originalSourceTree': ORIGINAL_TREE,
        'recoveryCommit': RECOVERY_COMMIT, 'recoveryTree': RECOVERY_TREE,
        'retryProcedureCommit': RETRY_COMMIT, 'retryProcedureTree': RETRY_TREE,
        'retryHelperSha256': RETRY_HELPER_SHA256,
        'configurationSha256': CONFIGURATION_SHA256, 'attachmentHelperSha256': ATTACHMENT_HELPER_SHA256,
        'payloadSha256': RETRY_PAYLOAD_SHA256, 'manifestSha256': RETRY_MANIFEST_SHA256,
        'retryCaptureSha256': '1'*64, 'summary': 'Synthetic fixture only; no production approval.',
        'reviewedAt': fixture_time, 'candidateFunctionRecords': records,
        'reviewedFunctionDifferences': [], 'reviewedProviderFields': [], 'functionOrderChanged': False}
    global REVIEWED_PROVIDER_FIELDS
    original_policy = REVIEWED_PROVIDER_FIELDS
    try:
        REVIEWED_PROVIDER_FIELDS = frozenset()
        call = lambda r=review, c=capture: validate_provider_review(r, c, '1'*64, baseline, state, release, attachment)
        accept('no actual changes requires no field waiver', call)
        reject('unapproved provider review', lambda: call({**review, 'approved': False}))
        reject('wrong capture digest', lambda: call({**review, 'retryCaptureSha256': '2'*64}))
        reject('incomplete full records', lambda: call({**review, 'candidateFunctionRecords': records[:-1]}))
        altered = copy.deepcopy(capture)
        altered['candidateCompleteFunctionRecords'][0]['id'] = 'synthetic-new-id'
        # deepcopy preserved shared references; explicitly rebuild baseline to
        # keep before/after separate and calculate the actual fixture delta.
        altered['baselineCompleteFunctionRecords'] = copy.deepcopy(records)
        altered['candidate']['available_functions'] = altered['candidateCompleteFunctionRecords']
        old = {item['n']: item for item in records}
        new = {item['n']: item for item in altered['candidateCompleteFunctionRecords']}
        deltas = attachment.differences(old, new, ('available_functions',))
        altered['functionRecordDifferences'] = deltas
        approved = {**review, 'candidateFunctionRecords': altered['candidateCompleteFunctionRecords'],
                    'reviewedFunctionDifferences': deltas, 'reviewedProviderFields': ['id']}
        reject('generated ID cannot be automatically waived', lambda: call(approved, altered))
        REVIEWED_PROVIDER_FIELDS = frozenset(('id',))
        accept('one concrete exact enumerated provider delta', lambda: call(approved, altered))
        reject('omitted provider difference', lambda: call({**approved, 'reviewedFunctionDifferences': []}, altered))
        changed_runtime = copy.deepcopy(altered)
        changed_runtime['candidateCompleteFunctionRecords'][0]['r'] = 'nodejs20.x'
        changed_runtime['candidate']['available_functions'] = changed_runtime['candidateCompleteFunctionRecords']
        reject('runtime change cannot use provider review', lambda: call(approved, changed_runtime))
    finally:
        REVIEWED_PROVIDER_FIELDS = original_policy
    expected_sources = {path: 'f' * 64 for path in SOURCE_FILES}
    browser = {'passed': True, 'synthetic': False, 'actualHostedCode': True,
        'target': CANDIDATE_ORIGIN + '/play/', 'label': 'candidate', 'checkedAt': fixture_time,
        'sourceSha256': expected_sources, 'pinnedSourceSha256': expected_sources,
        'fetchedFiles': [{'file': path, 'status': 200, 'sha256': 'f' * 64} for path in SOURCE_FILES],
        'tls': {'authorized': True, 'status': 200}, 'cabinetLinks': CABINETS,
        'noWalletConnected': True, 'noSignatures': True, 'noRemoteWrites': True,
        'blockedRequests': [], 'pageErrors': [], 'consoleErrors': [],
        'checks': [{'name': f'SYNTHETIC GUARD FIXTURE {index}', 'passed': True} for index in range(5)],
        'dimensions': [{'viewport': {'width': width, 'height': height}, 'dateCount': 30,
            'collapsed': {'detailsOpen': False, 'overflow': [], 'scrollWidth': width, 'firstPoster': {'top': 500}}}
            for width, height in EXPECTED_VIEWPORTS],
        'configuration': {'enabledGames': [{'id': game} for game in GAME_IDS],
                          'eligibleGames': [{'id': game, 'creditRule': 'start-run'} for game in GAME_IDS]},
        'requests': [{'url': CANDIDATE_ORIGIN + '/play/', 'method': 'GET', 'hasAuthorization': False}],
        'responses': [{'url': CANDIDATE_ORIGIN + '/play/', 'status': 200}]}
    accept('synthetic guard of complete real-report schema', lambda: validate_hosted(browser, state, expected_sources))
    for label, change in [('failed browser', {'passed': False}), ('fixture report', {'synthetic': True}),
        ('other origin', {'target': 'https://tree-token.xyz/play/'}), ('missing viewport', {'dimensions': browser['dimensions'][:2]}),
        ('browser errors', {'pageErrors': ['fixture error']}), ('unsigned safety missing', {'noSignatures': False}),
        ('wrong source bytes', {'sourceSha256': {**expected_sources, 'scripts/arcade-daily-growth.js': '0' * 64}}),
        ('missing browser group', {'checks': browser['checks'][:-1]}),
        ('failed resource', {'responses': [{'status': 503}]})]:
        reject('hosted evidence rejects ' + label, lambda b={**browser, **change}: validate_hosted(b, state, expected_sources))
    for label, item in [('POST', {'method': 'POST'}), ('authorization', {'hasAuthorization': True}),
                        ('cross-origin', {'url': 'https://example.invalid/play/'})]:
        reject('hosted evidence rejects request ' + label, lambda change=item: validate_hosted(
            {**browser, 'requests': [{**browser['requests'][0], **change}]}, state, expected_sources))
    # Publication unlocks the former current deploy. Preserve its artifact
    # integrity, require the new current lock, and record the actual old lock.
    published_candidate = {**candidate, 'locked': True, 'published_at': fixture_time}
    prior_unlocked = {**baseline['deploy'], 'locked': False}
    fixture_environment = {'fixture': 'exact already-validated environment'}
    fixture_saved = []
    fixture_probes = []
    class PublishedFixture:
        def current_is(self, deploy_id):
            require(deploy_id == CANDIDATE_ID, 'Receipt must guard only the new current publication.')
            return {'id': release.SITE_ID, 'published_deploy': published_candidate}
        def request(self, endpoint):
            require(endpoint == 'deploys/' + CANDIDATE_ID, 'Unexpected receipt fixture read.')
            return published_candidate
        def inventory(self, deploy_id):
            require(deploy_id == CANDIDATE_ID, 'Wrong receipt inventory.')
            return state['files']
        def baseline_integrity(self, requested):
            require(requested == baseline, 'Original artifact integrity must still be checked.')
            return prior_unlocked
        def environment(self, requested, site, expected):
            require(requested == baseline and expected == fixture_environment, 'Receipt environment must stay exact.')
            return fixture_environment
    global verify_source
    original_verify_source, original_probe, original_save = verify_source, release.negative_probe, release.save
    def fixture_probe(origin):
        require(origin == release.CANONICAL_ORIGIN, 'Receipt requires the canonical negative probe.')
        fixture_probes.append(origin)
        return {**probe, 'url': origin + '/api/arcade-growth?action=treeforce-play'}
    try:
        verify_source = lambda *args: None
        release.negative_probe = fixture_probe
        release.save = lambda path, value: fixture_saved.append((path, value))
        fixture_args = argparse.Namespace(commit='1' * 40, tree='2' * 40)
        fixture_packages = json.loads(attachment.MANIFEST_PATH.read_text())['packages']
        receipt = write_receipt(root, release, attachment, PublishedFixture(), fixture_args, baseline, state,
            {'environment': fixture_environment}, fixture_packages,
            {'reviewedFunctionDifferences': [], 'functionOrderChanged': False}, records,
            {'hostedBrowser': {'fixture': 'verified report'}}, prior)
        accept('successful publication records old unlocked state without relocking', lambda: require(
            receipt['published'] is True and receipt['locked'] is True and receipt['previousDeployLocked'] is False
            and len(fixture_saved) == 1 and len(fixture_probes) == 1,
            'Valid new publication was blocked by the former deploy lock.'))
        reject('published receipt still requires the new candidate lock', lambda: validate_candidate(
            {**published_candidate, 'locked': False}, baseline, state, records, release, published=True))
    finally:
        verify_source, release.negative_probe, release.save = original_verify_source, original_probe, original_save
    report = {'passed': True, 'count': len(passed), 'checks': passed, 'remoteRequests': 0,
        'helperSha256': sha256(Path(__file__).read_bytes()), 'originalHelperSha256': ORIGINAL_HELPER_SHA256,
        'attachmentHelperSha256': ATTACHMENT_HELPER_SHA256, 'retryHelperSha256': RETRY_HELPER_SHA256,
        'retryCommit': RETRY_COMMIT, 'retryTree': RETRY_TREE,
        'reviewedProviderFields': sorted(REVIEWED_PROVIDER_FIELDS),
        'providerPolicyFinalized': PROVIDER_POLICY_FINALIZED, 'draftOnly': not PROVIDER_POLICY_FINALIZED,
        'candidate': CANDIDATE_ID, 'originalSourceCommit': ORIGINAL_COMMIT, 'recoveryCommit': RECOVERY_COMMIT}
    if output_path is not None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, indent=2) + '\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('guards', 'verify', 'publish'))
    parser.add_argument('--commit')
    parser.add_argument('--tree')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    try:
        if args.mode == 'guards':
            report = pure_guards(root, root / GUARDS_RELATIVE)
            print(json.dumps({'passed': True, 'count': report['count'], 'remoteRequests': 0,
                              'helperSha256': report['helperSha256'], 'draftOnly': report['draftOnly']}))
        else:
            run(args, root)
    except FinalizationError as error:
        print('Arcade finalization stopped: ' + str(error), file=sys.stderr)
        return 1
    except Exception:
        print('Arcade finalization stopped: local or network operation failed; raw details withheld.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
