"""Compare executable handlers and dependency bytes, excluding Netlify-owned wrappers."""
import hashlib
import json
from pathlib import Path
import sys
from zipfile import ZipFile

published, built = map(Path, sys.argv[1:])
results = []
for path in sorted(published.glob('*.zip')):
    with ZipFile(path) as old, ZipFile(built / path.name) as new:
        # Netlify's bootstrap/telemetry and generated package metadata depend on
        # its packaging version. They are not application source parity claims.
        payload = lambda name: not name.startswith('___netlify') and name != 'package.json' and not name.endswith('/')
        old_names = set(filter(payload, old.namelist()))
        new_names = set(filter(payload, new.namelist()))
        if old_names != new_names:
            raise RuntimeError(f'{path.stem}: payload inventory differs: {old_names ^ new_names}')
        for name in sorted(old_names):
            expected, actual = old.read(name), new.read(name)
            if path.stem == 'tree-knowledge-trial-claim' and name == 'netlify/functions/tree-knowledge-trial-claim.mjs':
                # The claim adapter is intentionally isolated from the newer
                # round adapter. Only the non-executable source label changed.
                actual = actual.replace(b'// netlify/lib/tree-knowledge-trial-claim-store.ts\n', b'// netlify/lib/tree-knowledge-trial-supabase.ts\n')
            if expected != actual:
                raise RuntimeError(f'{path.stem}: executable payload differs: {name}')
        handler = f'netlify/functions/{path.stem}.mjs'
        results.append({'name': path.stem, 'payloadFiles': len(old_names), 'handlerSha256': hashlib.sha256(old.read(handler)).hexdigest(), 'match': True})
print(json.dumps({'functions': len(results), 'allExecutablePayloadsMatch': True, 'results': results}))
