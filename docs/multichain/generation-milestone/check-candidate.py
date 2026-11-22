"""Read-only candidate refresh. No transaction creation, simulation, signing or submission."""
import datetime
import json
import urllib.request

NFT = '0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba'
TYPE = '0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT'
DEV = '0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4'
QUERY = '''query { chainIdentifier checkpoint { sequenceNumber timestamp }
 nft:object(address:"%s") { address version digest owner { __typename
 ... on AddressOwner { address { address } } }
 asMoveObject { contents { type { repr } json } } } }''' % NFT

def read():
    req = urllib.request.Request('https://graphql.mainnet.sui.io/graphql',
        data=json.dumps({'query': QUERY}).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=20) as response:
        result = json.load(response)
    if result.get('errors') or not result.get('data'):
        raise RuntimeError('Sui query failed: ' + json.dumps(result))
    data = result['data']
    assert data['chainIdentifier'] == '4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S', 'Wrong chain'
    nft = data['nft']
    assert nft['address'] == NFT and nft['asMoveObject']['contents']['type']['repr'] == TYPE, 'Identity changed'
    assert nft['owner']['__typename'] == 'AddressOwner' and nft['owner']['address']['address'] == DEV, 'Owner changed'
    assert nft['asMoveObject']['contents']['json']['number'] == '2720', 'Metadata changed'
    timestamp = datetime.datetime.fromisoformat(data['checkpoint']['timestamp'].replace('Z', '+00:00'))
    age = (datetime.datetime.now(datetime.timezone.utc) - timestamp).total_seconds()
    assert -30 <= age <= 120, 'Stale checkpoint'
    return data

first, second = read(), read()
assert first['nft'] == second['nft'], 'Candidate changed during observation'
assert second['checkpoint']['sequenceNumber'] >= first['checkpoint']['sequenceNumber'], 'Checkpoint regressed'
print(json.dumps({'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'purpose': 'Read-only stable identity observation; not deposit authorization. Refresh before deposit.',
    'startCheckpoint': first['checkpoint'], 'data': second}, indent=2))
