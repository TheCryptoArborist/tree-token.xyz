from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Missing expected text for {label}')
    return text.replace(old, new, 1)


def replace_block(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'Expected one block for {label}; found {count}')
    return updated


app_path = Path('dapp/app.js')
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    "const leaderboardUrl = isDeployPreview ? '/api/tree-leaderboard-preview' : '/api/tree-leaderboard';",
    "const leaderboardUrl = isDeployPreview ? '/api/tree-exposure' : '/api/tree-leaderboard';\nlet leaderboardMode = isDeployPreview ? 'exposure' : 'direct';",
    'preview exposure endpoint',
)

identity_anchor = """function displayNameForEntry(entry) {
  const name = typeof entry?.suinsName === 'string' ? entry.suinsName.trim() : '';
  return name || shortened(String(entry?.wallet || ''));
}
"""
identity_helpers = identity_anchor + r'''
function entryIsExposure(entry) {
  return Boolean(entry
    && typeof entry.totalExposureRaw === 'string'
    && /^\d+$/.test(entry.totalExposureRaw)
    && typeof entry.liquidTreeRaw === 'string'
    && typeof entry.lpTreeRaw === 'string');
}

function normalizeLeaderboardEntry(entry) {
  if (!entryIsExposure(entry)) return entry;
  return {
    ...entry,
    directTreeRaw: entry.totalExposureRaw,
    directTree: entry.totalExposure,
    coinObjectCount: entry.liquidCoinObjectCount,
  };
}

function badgeDefinition(slug) {
  return {
    'lp-provider': { icon: '💧', label: 'LP Provider', description: 'Holds verified TREE principal in a recognized liquidity pool.' },
    'lp-maxi': { icon: '🌊', label: 'LP Maxi', description: 'More verified TREE is held in LP principal than liquid in the wallet.' },
    'diamond-hands': { icon: '💎', label: 'Diamond Hands', description: 'No classified TREE sells during the verified 30-day window.' },
    'paper-hands': { icon: '📄', label: 'Paper Hands', description: 'Classified TREE sold exceeded TREE bought during the verified 30-day window.' },
    accumulator: { icon: '🌱', label: 'Accumulator', description: 'Completed at least 10 qualifying TREE buys during the verified 30-day window.' },
    burned: { icon: '🔥', label: 'Burned', description: 'Burned at least 500,000 TREE.' },
  }[slug] || null;
}

function exposureBreakdownText(entry) {
  if (!entryIsExposure(entry)) return '';
  return `${entry.liquidTree} Liquid + ${entry.lpTree} LP`;
}
'''
app = replace_once(app, identity_anchor, identity_helpers, 'exposure entry helpers')

rank_detail = r'''function renderRankDetail(row) {
  const hasWallet = typeof window !== 'undefined' && Boolean(window.playerAddress);
  if (!hasWallet) {
    setText('rankTierIcon', '🌱'); setText('rankTierName', 'Connect Wallet'); setText('rankPosition', '—');
    setText('rankDirectTree', '—'); setText('rankSupplyPercent', 'Connect a wallet to compare with the verified Top 50.');
    setText('rankExposureBreakdown', 'Liquid TREE and verified LP principal will appear here.');
    setText('rankNextTier', 'Seedling'); setText('rankNextRequirement', 'Connect a wallet to calculate progress.');
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = '0%';
    return;
  }

  if (!['ok', 'stale'].includes(leaderboardStatus)) {
    setText('rankTierIcon', '⌛'); setText('rankTierName', 'Snapshot pending'); setText('rankPosition', '—');
    setText('rankDirectTree', connectedTreeBalanceRaw === null ? '—' : `${formatTreeRaw(connectedTreeBalanceRaw)} TREE liquid`);
    setText('rankSupplyPercent', 'Verified rank data is not currently available.');
    setText('rankExposureBreakdown', 'Partial scans never produce total-exposure rankings.');
    setText('rankNextTier', 'Verification required'); setText('rankNextRequirement', 'Wait for a complete verified snapshot.');
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = '0%';
    return;
  }

  if (row) {
    const tier = tierForEntry(row);
    const currentRaw = parseTreeRaw(row);
    const nextTier = nextTierFor(tier);
    const exposure = entryIsExposure(row);
    setText('rankTierIcon', tier?.icon || '🌿');
    setText('rankTierName', tier?.name || row.tier || 'Ranked');
    setText('rankPosition', `#${row.rank}`);
    setText('rankDirectTree', `${exposure ? row.totalExposure : row.directTree} TREE`);
    setText('rankSupplyPercent', exposure
      ? `${row.supplyPercent ?? '—'}% of total supply · ${row.lpPositionCount ?? 0} verified LP position${row.lpPositionCount === 1 ? '' : 's'}`
      : `${row.supplyPercent ?? '—'}% of total supply · ${row.coinObjectCount ?? '—'} Coin<TREE> objects`);
    setText('rankExposureBreakdown', exposure
      ? exposureBreakdownText(row)
      : 'Direct address-owned TREE only.');
    if (!nextTier) {
      setText('rankNextTier', 'Champion Tree'); setText('rankNextRequirement', 'Highest TREE leaderboard tier reached.');
      const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = '100%';
    } else {
      const targetEntry = nextTier.topRank ? rankCutoff(nextTier.topRank) : null;
      const targetRaw = nextTier.topRank ? parseTreeRaw(targetEntry) : nextTier.minimumRaw;
      let need = 0n;
      if (currentRaw !== null && targetRaw !== null) {
        need = nextTier.topRank
          ? (targetRaw >= currentRaw ? targetRaw - currentRaw + 1n : 0n)
          : (targetRaw > currentRaw ? targetRaw - currentRaw : 0n);
      }
      setText('rankNextTier', nextTier.name);
      const requirement = nextTier.topRank
        ? (need > 0n ? `Need ${formatTreeRaw(need)} more verified TREE exposure to reach the current Champion Tree cutoff.` : 'Current exposure meets the Champion Tree cutoff.')
        : (need > 0n ? `Need ${formatTreeRaw(need)} more verified TREE exposure to reach the ${nextTier.qualification} TREE threshold.` : `Current exposure meets the ${nextTier.name} threshold.`);
      setText('rankNextRequirement', requirement);
      const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = `${percentageToward(currentRaw, targetRaw)}%`;
    }
    return;
  }

  const cutoff = rankCutoff(50);
  setText('rankTierIcon', '🌱'); setText('rankTierName', 'Outside Top 50'); setText('rankPosition', 'Unranked');
  setText('rankDirectTree', connectedTreeBalanceRaw === null ? 'Loading liquid balance…' : `${formatTreeRaw(connectedTreeBalanceRaw)} TREE liquid`);
  if (leaderboardMode === 'exposure') {
    setText('rankSupplyPercent', 'Liquid balance only. Total verified exposure also includes recognized LP principal.');
    setText('rankExposureBreakdown', 'LP exposure is resolved during the complete background snapshot, not estimated on demand.');
    setText('rankNextTier', 'Top 50 Entry');
    setText('rankNextRequirement', cutoff
      ? `Current #50 total-exposure cutoff: ${cutoff.totalExposure || cutoff.directTree} TREE. The next complete snapshot determines eligibility.`
      : 'The current Top 50 cutoff is unavailable.');
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = '0%';
    return;
  }

  const cutoffRaw = parseTreeRaw(cutoff);
  setText('rankSupplyPercent', 'Direct wallet-held TREE, compared with the current verified cutoff.');
  setText('rankExposureBreakdown', 'Direct address-owned TREE only.');
  setText('rankNextTier', 'Top 50 Entry');
  if (connectedTreeBalanceRaw !== null && cutoffRaw !== null) {
    const need = cutoffRaw >= connectedTreeBalanceRaw ? cutoffRaw - connectedTreeBalanceRaw + 1n : 0n;
    setText('rankNextRequirement', need > 0n ? `Need ${formatTreeRaw(need)} more TREE to enter the current Top 50.` : 'Balance meets the current cutoff; the next snapshot may update your rank.');
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = `${percentageToward(connectedTreeBalanceRaw, cutoffRaw)}%`;
  } else {
    setText('rankNextRequirement', cutoff ? `Current cutoff: ${cutoff.directTree} TREE.` : 'The current Top 50 cutoff is unavailable.');
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = '0%';
  }
}'''
app = replace_block(
    app,
    r"function renderRankDetail\(row\) \{[\s\S]*?\n\}\n\nasync function loadConnectedTreeBalance",
    rank_detail + "\n\nasync function loadConnectedTreeBalance",
    'rank detail',
)

cards = r'''function renderLeaderboardCards() {
  const container = elementById('leaderboardCards');
  if (!container?.replaceChildren) return;
  if (!leaderboardEntries.length) {
    const empty = document.createElement('p'); empty.className = 'leaderboard-empty';
    empty.textContent = leaderboardStatus === 'refreshing' ? 'A verified snapshot is being built. Partial ranks are never published.' : leaderboardStatus === 'not-ready' ? 'A complete verified TREE exposure snapshot is not available yet.' : 'No ranked owners are available.';
    container.replaceChildren(empty); return;
  }
  const connected = typeof window !== 'undefined' ? window.playerAddress?.toLowerCase() : null;
  const cards = leaderboardEntries.map((entry) => {
    const exposure = entryIsExposure(entry);
    const card = document.createElement('article');
    card.className = `leader-card${entry.rank <= 3 ? ` top-three rank-${entry.rank}` : ''}${connected === entry.wallet.toLowerCase() ? ' connected' : ''}${exposure ? ' exposure-card' : ''}`;
    const rank = document.createElement('span'); rank.className = 'leader-rank'; rank.textContent = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
    const identity = document.createElement('div'); identity.className = 'leader-identity';
    const walletLine = document.createElement('div'); walletLine.className = 'leader-wallet';
    const wallet = document.createElement('span'); wallet.textContent = displayNameForEntry(entry); wallet.title = entry.suinsName || entry.wallet; walletLine.append(wallet);
    const addressLine = document.createElement('div'); addressLine.className = 'leader-address'; addressLine.textContent = shortened(entry.wallet); addressLine.title = entry.wallet;
    const tierDefinition = tierForEntry(entry);
    const tier = document.createElement('div'); tier.className = `leader-tier ${tierDefinition?.css || ''}`.trim(); tier.textContent = `${tierDefinition?.icon || '🌿'} ${tierDefinition?.name || entry.tier || 'Ranked'}`;
    identity.append(walletLine, ...(entry.suinsName ? [addressLine] : []), tier);

    const badges = document.createElement('div'); badges.className = 'leader-badges';
    for (const slug of Array.isArray(entry.badges) ? entry.badges : []) {
      const definition = badgeDefinition(slug);
      if (!definition) continue;
      const badge = document.createElement('span');
      badge.className = `leader-badge badge-${slug}`;
      badge.textContent = `${definition.icon} ${definition.label}`;
      badge.title = definition.description;
      badges.append(badge);
    }
    if (badges.children?.length || (Array.isArray(entry.badges) && entry.badges.length)) identity.append(badges);

    const balance = document.createElement('div'); balance.className = 'leader-balance';
    const amount = document.createElement('strong'); amount.textContent = `${exposure ? entry.totalExposure : entry.directTree} TREE`;
    const meta = document.createElement('span');
    meta.textContent = exposure
      ? `${entry.liquidTree} Liquid + ${entry.lpTree} LP`
      : `${entry.supplyPercent ?? '—'}% supply · ${entry.coinObjectCount ?? '—'} objects`;
    const supply = document.createElement('small');
    supply.textContent = exposure ? `${entry.supplyPercent ?? '—'}% of supply` : '';
    balance.append(amount, meta, ...(exposure ? [supply] : []));

    const actions = document.createElement('div'); actions.className = 'leader-actions';
    const copy = document.createElement('button'); copy.className = 'icon-button'; copy.type = 'button'; copy.title = 'Copy wallet address'; copy.textContent = '⧉';
    copy.addEventListener?.('click', async () => { try { await navigator.clipboard.writeText(entry.wallet); setText('rankShareStatus', 'Wallet address copied.'); } catch { setText('rankShareStatus', 'Copy was unavailable.'); } });
    const explorer = document.createElement('a'); explorer.className = 'icon-button'; explorer.title = 'Open wallet in SuiScan'; explorer.textContent = '↗'; explorer.href = `https://suiscan.xyz/mainnet/account/${entry.wallet}`; explorer.target = '_blank'; explorer.rel = 'noopener noreferrer';
    actions.append(copy, explorer);
    card.append(rank, identity, balance, actions);

    if (exposure) {
      const details = document.createElement('details'); details.className = 'leader-exposure-details';
      const summary = document.createElement('summary'); summary.textContent = entry.lpTreeRaw === '0' ? 'No verified LP principal' : 'View verified LP breakdown';
      const grid = document.createElement('div'); grid.className = 'lp-breakdown-grid';
      const items = [
        ['Liquid TREE', entry.liquidTree],
        ['SuiDex V2 LP', entry.lpBreakdown?.suiDexV2 || '0'],
        ['SuiDex V3 LP', entry.lpBreakdown?.suiDexV3 || '0'],
        ['Turbos LP', entry.lpBreakdown?.turbos || '0'],
        ['Total Exposure', entry.totalExposure],
      ];
      for (const [label, value] of items) {
        const labelNode = document.createElement('span'); labelNode.textContent = label;
        const valueNode = document.createElement('strong'); valueNode.textContent = `${value} TREE`;
        grid.append(labelNode, valueNode);
      }
      details.append(summary, grid); card.append(details);
    }
    return card;
  });
  container.replaceChildren(...cards);
}'''
app = replace_block(
    app,
    r"function renderLeaderboardCards\(\) \{[\s\S]*?\n\}\n\nfunction rankShareText",
    cards + "\n\nfunction rankShareText",
    'leaderboard cards',
)

share_text = r'''function rankShareText() {
  const row = currentLeaderboardRow();
  if (!row) return 'I’m checking the verified TREE Canopy Leaderboard on the TREE Command Center. https://tree-token.xyz/dapp/#leaderboard';
  const tier = tierForEntry(row)?.name || row.tier || 'Ranked';
  if (entryIsExposure(row)) {
    const badges = (Array.isArray(row.badges) ? row.badges : []).map((slug) => badgeDefinition(slug)?.label).filter(Boolean);
    return `I’m #${row.rank} on the verified TREE Canopy Leaderboard — ${displayNameForEntry(row)}, ${tier}, with ${row.totalExposure} TREE total verified exposure (${row.liquidTree} liquid + ${row.lpTree} LP)${badges.length ? ` · ${badges.join(' · ')}` : ''}. https://tree-token.xyz/dapp/#leaderboard`;
  }
  return `I’m #${row.rank} on the verified TREE Canopy Leaderboard — ${displayNameForEntry(row)}, ${tier}, with ${row.directTree} direct TREE. https://tree-token.xyz/dapp/#leaderboard`;
}'''
app = replace_block(
    app,
    r"function rankShareText\(\) \{[\s\S]*?\n\}\n\nasync function shareRank",
    share_text + "\n\nasync function shareRank",
    'rank share text',
)

download = r'''function downloadRankCard() {
  const canvas = elementById('rankShareCanvas');
  const row = currentLeaderboardRow();
  if (!canvas?.getContext || !row) { setText('rankShareStatus', 'Connect a ranked wallet to create a rank card.'); return; }
  const exposure = entryIsExposure(row);
  const ctx = canvas.getContext('2d'); const size = canvas.width;
  const gradient = ctx.createLinearGradient(0, 0, size, size); gradient.addColorStop(0, '#03080d'); gradient.addColorStop(.55, '#071b18'); gradient.addColorStop(1, '#07111d');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(53,200,255,.32)'; ctx.lineWidth = 8; ctx.strokeRect(42, 42, size - 84, size - 84);
  ctx.fillStyle = '#35f28c'; ctx.font = '900 54px ui-monospace, monospace'; ctx.fillText('TREE CANOPY LEADERBOARD', 90, 130);
  ctx.fillStyle = '#9aa9b8'; ctx.font = '700 30px ui-monospace, monospace'; ctx.fillText(exposure ? 'VERIFIED LIQUID + LP SNAPSHOT' : 'VERIFIED DIRECT TREE SNAPSHOT', 90, 182);
  ctx.fillStyle = '#ffe14f'; ctx.font = '900 210px ui-monospace, monospace'; ctx.fillText(`#${row.rank}`, 90, 455);
  ctx.fillStyle = '#f5fbff'; ctx.font = '900 58px ui-monospace, monospace'; ctx.fillText((tierForEntry(row)?.name || row.tier || 'Ranked').toUpperCase(), 90, 540);
  ctx.fillStyle = '#35c8ff'; ctx.font = '900 68px ui-monospace, monospace'; ctx.fillText(`${exposure ? row.totalExposure : row.directTree} TREE`, 90, 680);
  ctx.fillStyle = '#9aa9b8'; ctx.font = '600 32px ui-monospace, monospace';
  ctx.fillText(exposure ? `${row.liquidTree} LIQUID + ${row.lpTree} LP` : `${row.supplyPercent ?? '—'}% OF TOTAL SUPPLY`, 90, 735);
  if (exposure) ctx.fillText(`${row.supplyPercent ?? '—'}% OF TOTAL SUPPLY`, 90, 785);
  const badgeLine = exposure ? (row.badges || []).map((slug) => badgeDefinition(slug)?.label?.toUpperCase()).filter(Boolean).join(' · ') : '';
  if (badgeLine) { ctx.fillStyle = '#ffe14f'; ctx.font = '800 27px ui-monospace, monospace'; ctx.fillText(badgeLine, 90, 840); }
  ctx.fillStyle = '#f5fbff'; ctx.font = '700 34px ui-monospace, monospace'; ctx.fillText(displayNameForEntry(row), 90, 920);
  if (row.suinsName) { ctx.fillStyle = '#9aa9b8'; ctx.font = '600 27px ui-monospace, monospace'; ctx.fillText(shortened(row.wallet), 90, 965); }
  ctx.fillStyle = '#35f28c'; ctx.font = '800 34px ui-monospace, monospace'; ctx.fillText('tree-token.xyz/dapp', 90, 1050);
  canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `tree-canopy-rank-${row.rank}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setText('rankShareStatus', 'Rank card downloaded.'); }, 'image/png');
}'''
app = replace_block(
    app,
    r"function downloadRankCard\(\) \{[\s\S]*?\n\}\n\nfunction updateYourRank",
    download + "\n\nfunction updateYourRank",
    'rank-card download',
)

render = r'''function renderLeaderboard(payload) {
  lastLeaderboardPayload = payload;
  const state = elementById('leaderboardState');
  const rows = elementById('leaderboardRows');
  const allowedStatus = ['not-ready', 'refreshing', 'ok', 'stale', 'error'];
  leaderboardStatus = allowedStatus.includes(payload.status) ? payload.status : 'error';
  const exposurePayload = payload.methodologyVersion === 'verified-tree-exposure-v1'
    || payload.provider === 'tree-exposure-snapshot';
  leaderboardMode = exposurePayload ? 'exposure' : 'direct';
  const rawEntries = ['ok', 'stale'].includes(leaderboardStatus) && Array.isArray(payload.entries) ? payload.entries : [];
  leaderboardEntries = rawEntries.map(normalizeLeaderboardEntry);
  const stateLabels = exposurePayload ? {
    'not-ready': 'Exposure Snapshot Not Ready', refreshing: 'Building Exposure Snapshot', ok: 'Current Exposure Snapshot', stale: 'Last Exposure Snapshot', error: 'Exposure Board Unavailable',
  } : {
    'not-ready': 'Verified Snapshot Not Ready', refreshing: 'Building Verified Snapshot', ok: 'Current Verified Snapshot', stale: 'Last Verified Snapshot', error: 'Leaderboard Unavailable',
  };
  if (state) { state.textContent = stateLabels[leaderboardStatus]; state.className = `data-state ${leaderboardStatus}`; }
  const hasSnapshot = ['ok', 'stale'].includes(leaderboardStatus);
  const coverage = hasSnapshot ? (payload.coverage || {}) : (payload.refreshStatus || {});
  const snapshotTime = payload.snapshotGeneratedAt ? new Date(payload.snapshotGeneratedAt) : null;
  setText('leaderboardProvider', payload.provider || (exposurePayload ? 'tree-exposure-snapshot' : 'sui-graphql-snapshot'));
  setText('leaderboardSnapshotTime', snapshotTime ? snapshotTime.toLocaleString() : 'None');
  setText('leaderboardSnapshotCardTime', snapshotTime ? snapshotTime.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'None');
  setText('leaderboardSnapshotAge', formatSnapshotAge(payload.snapshotAgeMs));
  setText('leaderboardRefreshState', payload.refreshState || 'idle');

  if (exposurePayload) {
    const direct = payload.source?.direct || {};
    const summary = payload.summary || {};
    const venues = payload.source?.venues || {};
    setText('leaderboardPagesScanned', quantity.format(Number(direct.pagesScanned) || 0));
    setText('leaderboardObjectsScanned', quantity.format(Number(direct.objectsScanned) || 0));
    setText('verifiedAddressOwnerCount', direct.verifiedAddressOwners === null || direct.verifiedAddressOwners === undefined ? '—' : quantity.format(direct.verifiedAddressOwners));
    setText('eligibleRankedOwnerCount', payload.eligibleOwnerCount === null || payload.eligibleOwnerCount === undefined ? '—' : quantity.format(payload.eligibleOwnerCount));
    setText('displayedWalletCount', quantity.format(payload.displayedCount ?? leaderboardEntries.length));
    setText('excludedCoinObjectCount', quantity.format(summary.badgeCounts?.lpProvider ?? 0));
    setText('excludedUniqueOwnerCount', quantity.format(summary.badgeCounts?.lpMaxi ?? 0));
    setText('leaderboardReconciliation', coverage.totalExposureComplete === true ? 'All venue gates passed' : 'Not complete');
    setText('leaderboardAddressOwnedTree', summary.top50TotalRaw ? `${compactTree(formatTreeRaw(summary.top50TotalRaw))} TREE` : '—');
    setText('leaderboardUpdated', payload.message || 'Exposure snapshot status unavailable.');
    setText('leaderboardCoverageDetails', [
      `Refresh state: ${payload.refreshState || 'idle'}.`,
      `Direct scan: ${quantity.format(Number(direct.pagesScanned) || 0)} pages and ${quantity.format(Number(direct.objectsScanned) || 0)} Coin<TREE> objects.`,
      `SuiDex V2: ${venues.suiDexV2?.outcome || 'pending'}; ${venues.suiDexV2?.walletCount ?? 0} wallets.`,
      `SuiDex V3: ${venues.suiDexV3?.outcome || 'pending'}; ${venues.suiDexV3?.walletCount ?? 0} wallets.`,
      `Turbos: ${venues.turbos?.outcome || 'pending'}; ${venues.turbos?.walletCount ?? 0} wallets.`,
      `Total exposure complete: ${coverage.totalExposureComplete === true ? 'yes' : 'no'}.`,
      `SuiNS reverse names resolved: ${payload.source?.suins?.resolvedCount ?? 0} of ${payload.source?.suins?.requestedCount ?? 0}.`,
    ].join(' '));
  } else {
    setText('leaderboardPagesScanned', quantity.format(Number(coverage.pagesScanned) || 0));
    setText('leaderboardObjectsScanned', quantity.format(Number(coverage.objectsScanned) || 0));
    const verifiedOwnerCount = hasSnapshot ? (payload.verifiedAddressOwners ?? payload.holderCount) : coverage.uniqueAddressOwners;
    const eligibleOwnerCount = hasSnapshot ? payload.eligibleRankedOwners : Number.isFinite(Number(coverage.uniqueAddressOwners)) ? Math.max(0, Number(coverage.uniqueAddressOwners) - (Number(coverage.excludedUniqueOwners) || 0)) : null;
    setText('verifiedAddressOwnerCount', verifiedOwnerCount === null || verifiedOwnerCount === undefined ? '—' : quantity.format(verifiedOwnerCount));
    setText('eligibleRankedOwnerCount', eligibleOwnerCount === null || eligibleOwnerCount === undefined ? '—' : quantity.format(eligibleOwnerCount));
    setText('displayedWalletCount', quantity.format(payload.displayedCount ?? leaderboardEntries.length));
    setText('excludedCoinObjectCount', quantity.format(payload.excludedCoinObjects ?? payload.excludedCount ?? coverage.excludedCoinObjects ?? coverage.excludedAddresses ?? 0));
    setText('excludedUniqueOwnerCount', quantity.format(payload.excludedUniqueOwners ?? coverage.excludedUniqueOwners ?? 0));
    const reconciliation = payload.reconciliation || {};
    setText('leaderboardReconciliation', reconciliation.valid === true ? 'Valid' : 'Not available');
    setText('leaderboardAddressOwnedTree', reconciliation.addressOwnedTree ? `${compactTree(reconciliation.addressOwnedTree)} TREE` : '—');
    setText('leaderboardUpdated', payload.message || 'Snapshot status unavailable.');
    setText('leaderboardCoverageDetails', [
      `Refresh state: ${payload.refreshState || 'idle'}.`, `Natural end reached: ${coverage.reachedEnd === true ? 'yes' : 'no'}.`,
      `Complete snapshot available: ${hasSnapshot ? 'yes' : 'no'}.`, `TREE metadata verified: ${coverage.coinMetadataVerified === true ? 'yes' : 'no'}.`,
      hasSnapshot ? `TREE decimals: ${payload.coinDecimals ?? coverage.coinDecimals ?? 'unavailable'}.` : null,
      `Reconciliation: ${reconciliation.valid === true ? 'valid' : 'not available'}.`,
      hasSnapshot ? `Address-owned TREE: ${reconciliation.addressOwnedTree ?? 'unavailable'}.` : 'Refresh progress contains aggregate counts only.',
    ].filter(Boolean).join(' '));
  }

  const warningBox = elementById('leaderboardWarnings');
  if (warningBox) { warningBox.textContent = Array.isArray(payload.warnings) ? payload.warnings.join(' ') : ''; warningBox.hidden = !warningBox.textContent; }
  if (rows) {
    if (!leaderboardEntries.length) {
      const emptyMessages = { 'not-ready': 'A complete verified TREE leaderboard snapshot is not available yet.', refreshing: 'The first verified TREE leaderboard snapshot is being built. No partial ranks are published.', error: 'The verified TREE leaderboard is temporarily unavailable.' };
      rows.innerHTML = `<tr><td colspan="6">${emptyMessages[leaderboardStatus] || 'No ranked wallets are available in the verified snapshot.'}</td></tr>`;
    } else if (rows.replaceChildren) {
      rows.replaceChildren(...leaderboardEntries.map((entry) => {
        const exposure = entryIsExposure(entry);
        const values = exposure
          ? [entry.rank, displayNameForEntry(entry), entry.totalExposure, entry.liquidTree, entry.lpTree, tierForEntry(entry)?.name || 'Ranked']
          : [entry.rank, displayNameForEntry(entry), entry.directTree, entry.directTree, '0', tierForEntry(entry)?.name || entry.tier || 'Ranked'];
        const row = document.createElement('tr');
        values.forEach((value, index) => {
          const cell = document.createElement('td'); cell.textContent = String(value); if (index >= 3) cell.className = 'wide-column'; if (index === 1) cell.title = entry.wallet; row.append(cell);
        });
        return row;
      }));
    }
  }
  renderTierLadder();
  renderLeaderboardCards();
  updateYourRank();
}'''
app = replace_block(
    app,
    r"function renderLeaderboard\(payload\) \{[\s\S]*?\n\}\n\nasync function loadLeaderboard",
    render + "\n\nasync function loadLeaderboard",
    'leaderboard renderer',
)

loader = r'''async function loadLeaderboard() {
  try {
    const response = await fetch(leaderboardUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Leaderboard returned ${response.status}`);
    const payload = await response.json();
    if (isDeployPreview && payload.methodologyVersion === 'verified-tree-exposure-v1') {
      payload.warnings = [...(Array.isArray(payload.warnings) ? payload.warnings : []), 'Deploy Preview: ranks combine liquid TREE with current verified principal in SuiDex V2, SuiDex V3, and Turbos positions.'];
    }
    renderLeaderboard(payload);
  } catch (error) {
    renderLeaderboard({ status: 'error', generatedAt: new Date().toISOString(), entries: [], displayedCount: 0, excludedCount: 0, holderCount: null });
    console.error(error);
  }
}'''
app = replace_block(
    app,
    r"async function loadLeaderboard\(\) \{[\s\S]*?\n\}\n\nasync function connectForDapp",
    loader + "\n\nasync function connectForDapp",
    'leaderboard loader',
)

old_export = "export { DAPP_SWAP_EXECUTION_ENABLED, TIER_DEFINITIONS, displayNameForEntry, formatSupplyPercentFromRaw, formatTreePrice, readDashboardCache, renderLeaderboard, tierForEntry, updateYourRank, writeDashboardCache };"
new_export = "export { DAPP_SWAP_EXECUTION_ENABLED, TIER_DEFINITIONS, badgeDefinition, displayNameForEntry, entryIsExposure, formatSupplyPercentFromRaw, formatTreePrice, normalizeLeaderboardEntry, readDashboardCache, renderLeaderboard, tierForEntry, updateYourRank, writeDashboardCache };"
app = replace_once(app, old_export, new_export, 'app exports')
app_path.write_text(app, encoding='utf-8')

index_path = Path('dapp/index.html')
index = index_path.read_text(encoding='utf-8')
replacements = [
    ('Live market data, verified direct-TREE rankings, creator tools, and clear routes into the NFTree ecosystem.', 'Live market data, verified Liquid TREE plus LP exposure rankings, creator tools, and clear routes into the NFTree ecosystem.'),
    ('<p>Direct address-owned TREE only. Rankings never use partial scans.</p>', '<p>Total verified exposure = Liquid TREE + current principal TREE in recognized SuiDex V2, SuiDex V3, and Turbos positions. Partial scans never publish ranks.</p>'),
    ('<div class="rank-balance"><span>Direct TREE</span><strong id="rankDirectTree">—</strong><small id="rankSupplyPercent">Connect a wallet to compare with the verified Top 50.</small></div>', '<div class="rank-balance"><span>Total Verified Exposure</span><strong id="rankDirectTree">—</strong><small id="rankSupplyPercent">Connect a wallet to compare with the verified Top 50.</small><em id="rankExposureBreakdown" class="rank-exposure-breakdown">Liquid TREE and verified LP principal will appear here.</em></div>'),
    ('<div><span>Eligible ranked owners</span><strong id="eligibleRankedOwnerCount">—</strong></div>', '<div><span>Eligible exposure owners</span><strong id="eligibleRankedOwnerCount">—</strong></div>'),
    ('<div><span>Address-owned TREE</span><strong id="leaderboardAddressOwnedTree">—</strong></div>', '<div><span>Top 50 verified exposure</span><strong id="leaderboardAddressOwnedTree">—</strong></div>'),
    ('The leaderboard is served from the most recent complete, reconciled Sui-native scan. Partial refreshes never replace verified rankings.', 'The board is served from the most recent complete Liquid TREE plus LP snapshot. Incomplete venue scans never replace verified rankings.'),
    ('Each tier displays both its TREE requirement and its share of the fixed 1,000,000,000-token supply. Champion Tree is reserved for the Top 5. This preview still uses direct address-owned TREE; verified LP exposure will be added separately.', 'Each tier displays both its TREE requirement and its share of the fixed 1,000,000,000-token supply. Champion Tree is reserved for the Top 5. Tier placement uses total verified exposure: Liquid TREE plus current principal TREE in recognized LP positions.'),
    ('<div><span class="rank-kicker">TOP 50</span><h3>Verified Direct TREE Leaders</h3></div>', '<div><span class="rank-kicker">TOP 50</span><h3>Verified TREE Exposure Leaders</h3></div>'),
    ('<div class="table-wrap leaderboard-fallback-table" aria-hidden="true"><table><thead><tr><th>Rank</th><th>Wallet</th><th>Direct TREE</th><th class="wide-column">Supply %</th><th class="wide-column">Tier</th></tr></thead><tbody id="leaderboardRows"><tr><td colspan="5">Loading eligible ranked owners…</td></tr></tbody></table></div>', '<div class="table-wrap leaderboard-fallback-table" aria-hidden="true"><table><thead><tr><th>Rank</th><th>Wallet</th><th>Total TREE</th><th class="wide-column">Liquid</th><th class="wide-column">LP</th><th class="wide-column">Tier</th></tr></thead><tbody id="leaderboardRows"><tr><td colspan="6">Loading eligible ranked owners…</td></tr></tbody></table></div>'),
    ('<p>A protected background worker scans all live Coin&lt;TREE&gt; objects, aggregates balances with exact bigint arithmetic, reconciles supply, and publishes rows only after natural pagination completion.</p>', '<p>A protected background worker completes the direct Coin&lt;TREE&gt; scan and verifies current principal in SuiDex V2, SuiDex V3, and Turbos. Exact bigint/Q64 accounting is published only after every venue reaches natural completion and passes reconciliation.</p>'),
    ('<span>Excluded protocol/system coin objects<strong id="excludedCoinObjectCount">0</strong></span><span>Unique excluded protocol/system owners<strong id="excludedUniqueOwnerCount">0</strong></span>', '<span>LP Provider badges<strong id="excludedCoinObjectCount">0</strong></span><span>LP Maxi badges<strong id="excludedUniqueOwnerCount">0</strong></span>'),
    ('<span>Reconciliation state<strong id="leaderboardReconciliation">Not available</strong></span>', '<span>Exposure verification<strong id="leaderboardReconciliation">Not available</strong></span>'),
    ('<p>TREE not represented by address-owned Coin&lt;TREE&gt; objects may include balances inside shared objects, object-owned coins, wrapped or embedded balances, and other non-address-owned storage. This difference is not labeled burned or circulating.</p>', '<p>LP exposure counts current principal TREE attributable to verified wallet-owned positions. Unclaimed trading fees, incentive rewards, Moonbags locks, and unidentified embedded balances are excluded from the exposure total.</p>'),
]
for old, new in replacements:
    index = replace_once(index, old, new, f'index replacement: {old[:40]}')
index_path.write_text(index, encoding='utf-8')

css_path = Path('dapp/styles.css')
css = css_path.read_text(encoding='utf-8')
marker = '/* Verified exposure leaderboard */'
if marker not in css:
    css += r'''

/* Verified exposure leaderboard */
.rank-exposure-breakdown{display:block;margin-top:7px;color:var(--cyan);font:750 .78rem/1.4 var(--mono);font-style:normal;text-transform:none}
.exposure-card{grid-template-columns:48px minmax(0,1.4fr) minmax(220px,.9fr) 74px}
.leader-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
.leader-badge{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(255,255,255,.045);font:800 .62rem/1 var(--mono);letter-spacing:.02em;white-space:nowrap}
.badge-lp-provider{color:#79e4ff;border-color:rgba(53,200,255,.35);background:rgba(53,200,255,.09)}
.badge-lp-maxi{color:#ffe26f;border-color:rgba(255,225,79,.36);background:linear-gradient(135deg,rgba(53,200,255,.11),rgba(255,225,79,.1))}
.badge-diamond-hands{color:#c8b7ff;border-color:rgba(154,98,242,.38)}
.badge-paper-hands{color:#ffc47a;border-color:rgba(255,179,38,.38)}
.badge-accumulator{color:#7dffae;border-color:rgba(53,242,140,.38)}
.badge-burned{color:#ff9b7b;border-color:rgba(255,123,82,.42)}
.leader-balance small{display:block;margin-top:3px;color:var(--muted-2);font:.68rem var(--mono)}
.leader-exposure-details{grid-column:2/-1;margin-top:2px;border-top:1px solid rgba(255,255,255,.06);padding-top:8px}
.leader-exposure-details summary{width:max-content;max-width:100%;color:var(--cyan);cursor:pointer;font:750 .72rem var(--mono)}
.lp-breakdown-grid{display:grid;grid-template-columns:minmax(150px,1fr) auto;gap:5px 18px;margin-top:9px;padding:11px;border:1px solid rgba(53,200,255,.13);border-radius:10px;background:rgba(2,8,12,.55)}
.lp-breakdown-grid span{color:var(--muted);font-size:.74rem}.lp-breakdown-grid strong{color:var(--text);font:800 .74rem var(--mono);text-align:right}.lp-breakdown-grid strong:last-child{color:var(--gold)}
@media(max-width:760px){.exposure-card{grid-template-columns:42px minmax(0,1fr) 34px}.exposure-card .leader-balance{grid-column:2/-1;text-align:left}.leader-exposure-details{grid-column:1/-1}.leader-badges{margin-bottom:4px}.lp-breakdown-grid{grid-template-columns:minmax(120px,1fr) auto}}
'''
css_path.write_text(css, encoding='utf-8')

test_path = Path('tests/leaderboard-ui-state.test.mjs')
test = test_path.read_text(encoding='utf-8')
test = replace_once(
    test,
    "const { TIER_DEFINITIONS, displayNameForEntry, formatSupplyPercentFromRaw, renderLeaderboard, tierForEntry } = await import('../dapp/app.js');",
    "const { TIER_DEFINITIONS, badgeDefinition, displayNameForEntry, entryIsExposure, formatSupplyPercentFromRaw, normalizeLeaderboardEntry, renderLeaderboard, tierForEntry } = await import('../dapp/app.js');",
    'test import',
)
insert_after = "assert.match(displayNameForEntry({ wallet: `0x${'c'.repeat(64)}`, suinsName: null }), /^0x/);\n"
new_checks = insert_after + """const exposureEntry = normalizeLeaderboardEntry({
  rank: 6, wallet: `0x${'d'.repeat(64)}`, suinsName: 'treeholder.sui',
  liquidTreeRaw: '4000000000000', liquidTree: '4000000', lpTreeRaw: '6000000000000', lpTree: '6000000',
  totalExposureRaw: '10000000000000', totalExposure: '10000000', supplyPercent: '1',
  liquidCoinObjectCount: 3, lpPositionCount: 2,
  lpBreakdown: { suiDexV2Raw: '1000000000000', suiDexV2: '1000000', suiDexV3Raw: '4500000000000', suiDexV3: '4500000', turbosRaw: '500000000000', turbos: '500000' },
  badges: ['lp-provider', 'lp-maxi'],
});
assert.equal(entryIsExposure(exposureEntry), true);
assert.equal(exposureEntry.directTree, '10000000');
assert.equal(exposureEntry.directTreeRaw, '10000000000000');
assert.equal(tierForEntry(exposureEntry).name, 'Giant Sequoia');
assert.equal(badgeDefinition('lp-provider').label, 'LP Provider');
assert.equal(badgeDefinition('lp-maxi').label, 'LP Maxi');
assert.equal(badgeDefinition('burned').label, 'Burned');
"""
test = replace_once(test, insert_after, new_checks, 'exposure helper tests')
test = test.replace("assert.equal(dappMarkup.includes('Excluded protocol/system coin objects'), true);", "assert.equal(dappMarkup.includes('LP Provider badges'), true);")
test = test.replace("assert.equal(dappMarkup.includes('Unique excluded protocol/system owners'), true);", "assert.equal(dappMarkup.includes('LP Maxi badges'), true);")
test = test.replace("assert.equal(dappMarkup.includes('verified LP exposure will be added separately'), true);", "assert.equal(dappMarkup.includes('Liquid TREE plus current principal TREE'), true);")
test_path.write_text(test, encoding='utf-8')
