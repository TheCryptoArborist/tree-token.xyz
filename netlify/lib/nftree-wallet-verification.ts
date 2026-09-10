type OwnerNode = {
  address?: unknown;
  owner?: { __typename?: unknown; address?: { address?: unknown } | null } | null;
};

export function normalizeSuiAddress(value: unknown): string | null {
  const match = String(value || '').toLowerCase().match(/^0x([a-f0-9]{1,64})$/);
  return match ? `0x${match[1].padStart(64, '0')}` : null;
}

export function nftreeOwnerRoots(nodes: OwnerNode[]) {
  if (!Array.isArray(nodes)) throw new Error('NFTree objects were unavailable.');
  const objectIds = new Set<string>();
  const roots = new Set<string>();
  for (const node of nodes) {
    const id = normalizeSuiAddress(node?.address);
    const kind = String(node?.owner?.__typename || '');
    const owner = normalizeSuiAddress(node?.owner?.address?.address);
    if (!id || objectIds.has(id)) throw new Error('NFTree object identities were invalid.');
    if (!owner || (kind !== 'AddressOwner' && kind !== 'ObjectOwner')) throw new Error('NFTree ownership was unsupported.');
    objectIds.add(id);
    if (kind === 'ObjectOwner') roots.add(owner);
  }
  return [...roots];
}

export function countNftreesForWallet(nodes: OwnerNode[], resolvedObjectOwners: Map<string, string>, walletInput: unknown) {
  const wallet = normalizeSuiAddress(walletInput);
  if (!wallet) throw new Error('Wallet address was invalid.');
  const objectIds = new Set<string>();
  let directCount = 0;
  let objectOwnedCount = 0;
  for (const node of nodes) {
    const id = normalizeSuiAddress(node?.address);
    const kind = String(node?.owner?.__typename || '');
    const owner = normalizeSuiAddress(node?.owner?.address?.address);
    if (!id || objectIds.has(id) || !owner) throw new Error('NFTree ownership evidence was invalid.');
    objectIds.add(id);
    if (kind === 'AddressOwner') {
      if (owner === wallet) directCount += 1;
    } else if (kind === 'ObjectOwner') {
      const resolved = normalizeSuiAddress(resolvedObjectOwners.get(owner));
      if (!resolved) throw new Error('An NFTree object-owner chain was unresolved.');
      if (resolved === wallet) objectOwnedCount += 1;
    } else {
      throw new Error('NFTree ownership was unsupported.');
    }
  }
  return { nftreeCount: directCount + objectOwnedCount, directCount, objectOwnedCount, objectsScanned: objectIds.size };
}
