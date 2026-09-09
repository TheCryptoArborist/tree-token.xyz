import { getAddress } from 'viem';
import { normalizeSuiAddress } from './nftree-wallet-verification.ts';

export const NFTREE_ACCESS_VERSION = 1;

export type EvmAccessChain = 'bnb' | 'robinhood';
export type NftreeUtility =
  | 'free_play'
  | 'canopy_credits'
  | 'ranked_leaderboard'
  | 'daily_canopy'
  | 'achievements'
  | 'arboretum'
  | 'garden_battles';

export type VaultAssignmentStatus = 'active' | 'claim_pending' | 'claimed' | 'revoked';

export type VaultAssignment = {
  version: typeof NFTREE_ACCESS_VERSION;
  assignmentId: string;
  treeAccountId: string;
  evmAddress: string;
  evmChain: EvmAccessChain;
  nftreeObjectId: string;
  vaultSuiAddress: string;
  paymentReference: string;
  assignedAt: string;
  status: VaultAssignmentStatus;
  claimSuiAddress: string | null;
};

export type NftreeAccessEvidence = {
  treeAccountId: string | null;
  directSuiNftreeCount?: number;
  linkedSuiNftreeCount?: number;
  vaultAssignment?: VaultAssignment | null;
};

export type AccessDecision = {
  allowed: boolean;
  level: 'free' | 'full';
  source: 'public' | 'direct_sui' | 'linked_sui' | 'evm_vault' | null;
  reason: 'free-play' | 'verified-nftree' | 'nftree-required' | 'invalid-evidence';
};

type AllocateVaultInput = {
  assignmentId: string;
  treeAccountId: string;
  evmAddress: string;
  evmChain: EvmAccessChain;
  nftreeObjectId: string;
  vaultSuiAddress: string;
  paymentReference: string;
  paymentFinalized: boolean;
  assignedAt?: string;
};

function requiredIdentifier(value: unknown, label: string) {
  const normalized = String(value || '').trim();
  if (!/^[a-zA-Z0-9:_-]{8,160}$/.test(normalized)) throw new Error(`${label} was invalid.`);
  return normalized;
}

function normalizedEvmAddress(value: unknown) {
  try {
    return getAddress(String(value || '')).toLowerCase();
  } catch {
    throw new Error('EVM address was invalid.');
  }
}

function nonNegativeCount(value: unknown, label: string) {
  const count = Number(value ?? 0);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error(`${label} was invalid.`);
  return count;
}

export function decideNftreeAccess(utility: NftreeUtility, evidence: NftreeAccessEvidence): AccessDecision {
  if (utility === 'free_play') {
    return { allowed: true, level: 'free', source: 'public', reason: 'free-play' };
  }

  const treeAccountId = String(evidence.treeAccountId || '').trim();
  if (!treeAccountId) {
    return { allowed: false, level: 'free', source: null, reason: 'nftree-required' };
  }

  let directCount: number;
  let linkedCount: number;
  try {
    directCount = nonNegativeCount(evidence.directSuiNftreeCount, 'Direct NFTree count');
    linkedCount = nonNegativeCount(evidence.linkedSuiNftreeCount, 'Linked NFTree count');
  } catch {
    return { allowed: false, level: 'free', source: null, reason: 'invalid-evidence' };
  }

  if (directCount > 0) {
    return { allowed: true, level: 'full', source: 'direct_sui', reason: 'verified-nftree' };
  }
  if (linkedCount > 0) {
    return { allowed: true, level: 'full', source: 'linked_sui', reason: 'verified-nftree' };
  }

  const assignment = evidence.vaultAssignment;
  if (assignment && assignment.treeAccountId === treeAccountId &&
      (assignment.status === 'active' || assignment.status === 'claim_pending')) {
    return { allowed: true, level: 'full', source: 'evm_vault', reason: 'verified-nftree' };
  }

  return { allowed: false, level: 'free', source: null, reason: 'nftree-required' };
}

/**
 * In-memory reference implementation for the server-authoritative NFTree vault
 * lifecycle. Durable storage must provide equivalent unique constraints and
 * atomic transitions before this is connected to real payments or assets.
 */
export class NftreeAccessRegistry {
  readonly #assignments = new Map<string, VaultAssignment>();
  readonly #nftreeAssignments = new Map<string, string>();
  readonly #paymentAssignments = new Map<string, string>();

  allocate(input: AllocateVaultInput): VaultAssignment {
    if (input.paymentFinalized !== true) throw new Error('Payment must be finalized before NFTree allocation.');
    const assignmentId = requiredIdentifier(input.assignmentId, 'Assignment ID');
    const treeAccountId = requiredIdentifier(input.treeAccountId, 'TREE Account ID');
    const paymentReference = requiredIdentifier(input.paymentReference, 'Payment reference');
    const nftreeObjectId = normalizeSuiAddress(input.nftreeObjectId);
    const vaultSuiAddress = normalizeSuiAddress(input.vaultSuiAddress);
    if (!nftreeObjectId) throw new Error('NFTree object ID was invalid.');
    if (!vaultSuiAddress) throw new Error('Vault Sui address was invalid.');
    if (input.evmChain !== 'bnb' && input.evmChain !== 'robinhood') throw new Error('EVM chain was unsupported.');
    if (this.#assignments.has(assignmentId)) throw new Error('Assignment ID was already used.');
    if (this.#nftreeAssignments.has(nftreeObjectId)) throw new Error('NFTree was already assigned.');
    if (this.#paymentAssignments.has(paymentReference)) throw new Error('Payment reference was already used.');

    const assignedAt = input.assignedAt || new Date().toISOString();
    if (!Number.isFinite(Date.parse(assignedAt))) throw new Error('Assignment time was invalid.');
    const assignment: VaultAssignment = {
      version: NFTREE_ACCESS_VERSION,
      assignmentId,
      treeAccountId,
      evmAddress: normalizedEvmAddress(input.evmAddress),
      evmChain: input.evmChain,
      nftreeObjectId,
      vaultSuiAddress,
      paymentReference,
      assignedAt,
      status: 'active',
      claimSuiAddress: null,
    };
    this.#assignments.set(assignmentId, assignment);
    this.#nftreeAssignments.set(nftreeObjectId, assignmentId);
    this.#paymentAssignments.set(paymentReference, assignmentId);
    return structuredClone(assignment);
  }

  get(assignmentId: string) {
    const assignment = this.#assignments.get(assignmentId);
    return assignment ? structuredClone(assignment) : null;
  }

  requestClaim(assignmentId: string, treeAccountId: string, destination: unknown) {
    const assignment = this.#require(assignmentId);
    if (assignment.treeAccountId !== treeAccountId) throw new Error('TREE Account did not own this assignment.');
    if (assignment.status !== 'active') throw new Error('NFTree assignment was not claimable.');
    const claimSuiAddress = normalizeSuiAddress(destination);
    if (!claimSuiAddress) throw new Error('Claim Sui address was invalid.');
    const updated = { ...assignment, status: 'claim_pending' as const, claimSuiAddress };
    this.#assignments.set(assignmentId, updated);
    return structuredClone(updated);
  }

  finalizeClaim(assignmentId: string, observedOwner: unknown) {
    const assignment = this.#require(assignmentId);
    if (assignment.status !== 'claim_pending' || !assignment.claimSuiAddress) {
      throw new Error('NFTree assignment had no pending claim.');
    }
    const owner = normalizeSuiAddress(observedOwner);
    if (!owner || owner !== assignment.claimSuiAddress) throw new Error('Final NFTree owner did not match the claim.');
    const updated = { ...assignment, status: 'claimed' as const };
    this.#assignments.set(assignmentId, updated);
    return structuredClone(updated);
  }

  revoke(assignmentId: string) {
    const assignment = this.#require(assignmentId);
    if (assignment.status === 'claimed') throw new Error('A claimed NFTree assignment cannot be revoked.');
    const updated = { ...assignment, status: 'revoked' as const };
    this.#assignments.set(assignmentId, updated);
    return structuredClone(updated);
  }

  #require(assignmentId: string) {
    const assignment = this.#assignments.get(assignmentId);
    if (!assignment) throw new Error('NFTree assignment was not found.');
    return assignment;
  }
}
