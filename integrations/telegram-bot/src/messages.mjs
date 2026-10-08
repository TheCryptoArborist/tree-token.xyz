export const CHALLENGE_URL = 'https://tree-token.xyz/dapp/#canopy-draw';
const WALLET = /^0x[0-9a-f]{64}$/;
const DIGEST = /^[1-9A-HJ-NP-Za-km-z]{40,64}$/;

function requireValue(ok) {
  if (!ok) throw new Error('Invalid verified notification data.');
}

function units(raw, decimals, shown = decimals) {
  requireValue(typeof raw === 'string' && /^[0-9]{1,78}$/.test(raw));
  const value = BigInt(raw);
  const scale = 10n ** BigInt(decimals);
  const whole = (value / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (value % scale).toString().padStart(decimals, '0').slice(0, shown).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

// Deliberately whitelist public fields. No answers, scores, elapsed time, attempt
// tokens, Telegram identities, or unverified SuiNS names enter a message.
export function formatNotification(event) {
  requireValue(event && typeof event === 'object');
  const p = event.payload;
  requireValue(p && WALLET.test(p.wallet) && /^knowledge:\d{4}-\d{2}-\d{2}$/.test(p.roundId));
  const wallet = `${p.wallet.slice(0, 8)}…${p.wallet.slice(-6)}`;
  const round = p.roundId.slice('knowledge:'.length);
  const buttons = [{ text: 'Open Challenge', url: CHALLENGE_URL }];
  let text;
  if (event.kind === 'qualifying_buy') {
    requireValue(DIGEST.test(p.txDigest));
    const amount = units(p.treeAmountRaw, 6);
    const value = units(p.qualifyingUsdCents, 2);
    requireValue(BigInt(p.treeAmountRaw) > 0n && BigInt(p.qualifyingUsdCents) >= 500n);
    text = `🌳 QUALIFYING TREE PURCHASE\n\nWallet: ${wallet}\nPurchased: ${amount} TREE\nVerified qualifying value: $${value}\nChallenge round: ${round} (UTC)\n\nThis purchase meets the round’s purchase requirement. Participation requires completing the Challenge on the website.`;
    buttons.push({ text: 'View Transaction', url: `https://suivision.xyz/txblock/${p.txDigest}` });
  } else if (event.kind === 'challenge_completed') {
    text = `🎯 TREE CHALLENGE COMPLETED\n\nWallet: ${wallet}\nChallenge round: ${round} (UTC)\n\nA scored attempt has been recorded. Scores stay private while the round is open; standings appear after official scoring.`;
  } else {
    throw new Error('Unsupported notification type.');
  }
  return { text, link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: [buttons] } };
}
