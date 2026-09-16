import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { getAddress, verifyMessage } from 'viem';
import { normalizeSuiAddress } from '../lib/nftree-wallet-verification.ts';
import { getCanonicalNftreeOwnership } from './nftree-wallet.ts';

const LINK_VERSION = 1;
const LINK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const PURPOSE = 'Link these wallets for NFTree access. No transaction or token approval.';

type LinkFields = {
  suiAddress: string;
  evmAddress: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export function normalizeEvmAddress(value: unknown) {
  try {
    return getAddress(String(value || '')).toLowerCase();
  } catch {
    return null;
  }
}

function requestDomain(request: Request) {
  return new URL(request.url).host.toLowerCase();
}

export function buildMessage(domain: string, fields: LinkFields) {
  return [
    'TREE Arcade Wallet Link',
    `Version: ${LINK_VERSION}`,
    `Domain: ${domain}`,
    `Sui address: ${fields.suiAddress}`,
    `EVM address: ${fields.evmAddress}`,
    `Issued at: ${fields.issuedAt}`,
    `Expires at: ${fields.expiresAt}`,
    `Nonce: ${fields.nonce}`,
    `Purpose: ${PURPOSE}`,
  ].join('\n');
}

function randomHex(bytes: number) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function validatedFields(input: Record<string, unknown>, now = Date.now()): LinkFields | null {
  const suiAddress = normalizeSuiAddress(input.suiAddress);
  const evmAddress = normalizeEvmAddress(input.evmAddress);
  const issuedAt = String(input.issuedAt || '');
  const expiresAt = String(input.expiresAt || '');
  const nonce = String(input.nonce || '').toLowerCase();
  const issuedMs = Date.parse(issuedAt);
  const expiresMs = Date.parse(expiresAt);
  if (!suiAddress || !evmAddress || !/^[a-f0-9]{64}$/.test(nonce)) return null;
  if (!Number.isFinite(issuedMs) || !Number.isFinite(expiresMs)) return null;
  if (issuedMs > now + CLOCK_SKEW_MS || issuedMs < now - LINK_LIFETIME_MS - CLOCK_SKEW_MS) return null;
  if (expiresMs <= now || expiresMs <= issuedMs || expiresMs > issuedMs + LINK_LIFETIME_MS) return null;
  return { suiAddress, evmAddress, issuedAt, expiresAt, nonce };
}

export async function verifyWalletLinkSignatures(fields: LinkFields, message: string, suiSignature: string, evmSignature: string) {
  await verifyPersonalMessageSignature(new TextEncoder().encode(message), suiSignature, { address: fields.suiAddress });
  return verifyMessage({
    address: getAddress(fields.evmAddress),
    message,
    signature: evmSignature as `0x${string}`,
  });
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ status: 'error', error: 'method-not-allowed' }, 405);
  const raw = await request.text();
  if (raw.length > 24_000) return json({ status: 'error', error: 'request-too-large' }, 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ status: 'error', error: 'invalid-json' }, 400);
  }

  const domain = requestDomain(request);
  if (body.action === 'challenge') {
    const suiAddress = normalizeSuiAddress(body.suiAddress);
    const evmAddress = normalizeEvmAddress(body.evmAddress);
    if (!suiAddress || !evmAddress) return json({ status: 'error', error: 'invalid-address' }, 400);
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + LINK_LIFETIME_MS).toISOString();
    const fields = { suiAddress, evmAddress, issuedAt, expiresAt, nonce: randomHex(32) };
    return json({ status: 'ok', fields, message: buildMessage(domain, fields) });
  }

  if (body.action !== 'verify') return json({ status: 'error', error: 'invalid-action' }, 400);
  const fields = validatedFields((body.fields || {}) as Record<string, unknown>);
  const message = String(body.message || '');
  const suiSignature = String(body.suiSignature || '');
  const evmSignature = String(body.evmSignature || '');
  if (!fields || message !== buildMessage(domain, fields) || !suiSignature || !/^0x[a-f0-9]+$/i.test(evmSignature)) {
    return json({ status: 'error', error: 'invalid-proof' }, 400);
  }

  try {
    const evmValid = await verifyWalletLinkSignatures(fields, message, suiSignature, evmSignature);
    if (!evmValid) return json({ status: 'error', error: 'signature-mismatch' }, 401);
  } catch (error) {
    console.error('TREE Arcade wallet-link signature verification failed:', error);
    return json({ status: 'error', error: 'signature-mismatch' }, 401);
  }

  try {
    const ownership = await getCanonicalNftreeOwnership(fields.suiAddress);
    if (ownership.nftreeCount < 1) {
      return json({ status: 'denied', error: 'nftree-required', nftreeCount: 0 }, 403);
    }
    return json({
      status: 'ok', linked: true,
      suiAddress: fields.suiAddress, evmAddress: fields.evmAddress,
      nftreeCount: ownership.nftreeCount,
      verifiedAt: new Date().toISOString(), expiresAt: fields.expiresAt,
    });
  } catch (error) {
    console.error('TREE Arcade linked NFTree verification failed:', error);
    return json({ status: 'error', error: 'nftree-verification-unavailable' }, 503);
  }
};

export const config = { path: '/api/arcade-wallet-link' };
