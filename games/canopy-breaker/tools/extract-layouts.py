"""Read the uploaded unprotected Games Factory project without executing it.

This small reader uses bounded GAPP segment and placement tables. Only confirmed
brick objects 14..20 and concrete placement records are adapted. No legacy art,
native binary or third-party parser is redistributed.
"""
from pathlib import Path
from zipfile import ZipFile
import hashlib, json, struct, sys

archive = Path(sys.argv[1])
with ZipFile(archive) as z:
    data = z.read('Arkannoyed.gam')
assert data[:4] == b'GAPP' and struct.unpack_from('<H', data, 4)[0] == 0x207
count = struct.unpack_from('<H', data, 0x15c)[0]

def chunks(blob, offset):
    result = []
    while offset + 6 <= len(blob):
        kind, length = struct.unpack_from('<HI', blob, offset)
        end = offset + 6 + length
        assert end <= len(blob)
        result.append((kind & 0x7fff, blob[offset + 6:end]))
        offset = end
        if kind & 0x8000:
            break
    assert offset == len(blob)
    return result

frames = [blob for kind, blob in chunks(data, 0x166 + count * 4) if kind == 8]
assert len(frames) == count == 34
layouts, evidence = [], []
# Three opening frames and frame 32's ending are excluded. The additional
# gameplay frame at 33 follows the other 29 gameplay frames in this adaptation.
for frame in [*range(3, 32), 33]:
    blocks = dict(chunks(frames[frame], 0xb8))
    placement = blocks[3]
    slots = struct.unpack_from('<H', placement)[0]
    base = 2 + slots * 4
    records = []
    for offset in struct.unpack_from(f'<{slots}I', placement, 2):
        if offset == 0xffffffff:
            continue
        assert base + offset + 32 <= len(placement)
        row = struct.unpack_from('<16h', placement, base + offset)
        object_id, x, y = row[:3]
        if 14 <= object_id <= 20 and row[-1] == -1 and 20 < x < 400 and 20 < y < 390:
            records.append([x, y, object_id - 14])
    assert records and len(records) == len({tuple(r[:2]) for r in records})
    layouts.append(records)
    evidence.append({'frame': frame, 'bricks': len(records), 'eventBytes': len(blocks[4]), 'eventSha256': hashlib.sha256(blocks[4]).hexdigest()})
out = Path(__file__).resolve().parents[1]
(out / 'src/original-layouts.js').write_text('// Brick placements read directly from the supplied Arkannoyed.gam.\nexport const ORIGINAL_LAYOUTS=' + json.dumps(layouts, separators=(',', ':')) + ';\n')
(out / 'docs/source-inspection.json').write_text(json.dumps({'file': 'Arkannoyed.gam', 'sha256': hashlib.sha256(data).hexdigest(), 'signature': 'GAPP', 'protected': False, 'frames': count, 'gameplayFramesUsed': evidence, 'transform': {'x': '40 + (sourceX - 72) * 2.25', 'y': '134 + (sourceY - 62) * 1.3'}, 'scope': 'Original concrete brick positions reused. Physics, art, audio, hazards, boss, wallet and payment code are new browser implementations; legacy event programs are inspected as binary data, not automatically translated.'}, indent=2) + '\n')
print(json.dumps({'unprotected': True, 'frames': count, 'layouts': len(layouts), 'bricks': sum(map(len, layouts))}))
