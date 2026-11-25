"""Create an isolated, keyless compiler configuration. Never touches a wallet config."""
import argparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('directory', type=Path)
args = parser.parse_args()
p = args.directory.resolve()
if p.exists() and any(p.iterdir()):
    raise SystemExit('Refusing to overwrite a nonempty configuration directory')
p.mkdir(parents=True, exist_ok=True)
(p / 'empty.keystore').write_text('[]')
(p / 'external.keystore').write_text('{}')
(p / 'client.yaml').write_text(
    f'keystore:\n  File: {p}/empty.keystore\n'
    f'external_keys:\n  External: {p}/external.keystore\n'
    'envs:\n  - alias: mainnet\n    rpc: "https://fullnode.mainnet.sui.io:443"\n'
    '    ws: null\n    basic_auth: null\n    chain_id: 35834a8a\n'
    'active_env: mainnet\nactive_address: null\n'
)
print(f'Keyless configuration created: {p}')
