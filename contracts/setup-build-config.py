from pathlib import Path
import os
if os.environ.get("GITHUB_ACTIONS") != "true":
    raise SystemExit("CI-only helper: do not replace a local wallet configuration")
p=Path.home()/'.sui/sui_config'
if (p/'client.yaml').exists():
    raise SystemExit('Refusing to replace an existing wallet configuration')
p.mkdir(parents=True,exist_ok=True)
# Build-only configuration with empty keystores. No key generation or signer.
(p/'build-empty.keystore').write_text('[]')
(p/'build-external.keystore').write_text('{}')
(p/'client.yaml').write_text('keystore:\n  File: '+str(p/'build-empty.keystore')+'\nexternal_keys:\n  External: '+str(p/'build-external.keystore')+'\nenvs:\n  - alias: mainnet\n    rpc: "https://fullnode.mainnet.sui.io:443"\n    ws: null\n    basic_auth: null\n    chain_id: 35834a8a\nactive_env: mainnet\nactive_address: null\n')
