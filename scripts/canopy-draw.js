import { buildTreeRaffleBrowserClaim } from '../dapp/raffle-transaction-core.js';
import { confirmTransaction } from '../dapp/transaction-review.js';

const canopyRoot = document.getElementById('canopy-draw');

if (canopyRoot) {
  const dailyPrize = canopyRoot.querySelector('[data-daily-prize]');
  const weeklyPrize = canopyRoot.querySelector('[data-weekly-prize]');
  const formulaInput = canopyRoot.querySelector('#canopy-qualifying-usd');
  const formulaResult = canopyRoot.querySelector('#canopy-ticket-result');
  const streakInput = canopyRoot.querySelector('#canopy-streak-days');
  const streakResult = canopyRoot.querySelector('#canopy-streak-result');
  const raffleEntryButton = canopyRoot.querySelector('#raffleEntryButton');
  const raffleEntriesCount = canopyRoot.querySelector('#raffleEntriesCount');
  const raffleEntriesStatus = canopyRoot.querySelector('#raffleEntriesStatus');
  const raffleHistoryElement = canopyRoot.querySelector('#raffleHistory');
  const launchNotActiveText = 'Raffle inactive';
  const raffleState = canopyRoot.querySelector('#raffleState');
  const raffleMeta = canopyRoot.querySelector('#raffleMeta');
  const raffleHistory = canopyRoot.querySelector('[data-raffle-history]');
  const raffleBlockers = canopyRoot.querySelector('[data-raffle-blockers]');
  const raffleClaimList = canopyRoot.querySelector('#raffleClaimList');
  const raffleClaimStatus = canopyRoot.querySelector('#raffleClaimStatus');
  const raffleCountdownCard = canopyRoot.querySelector('#raffleCountdownCard');
  const raffleCountdownLabel = canopyRoot.querySelector('#raffleCountdownLabel');
  const raffleCountdown = canopyRoot.querySelector('#raffleCountdown');
  const raffleCountdownTarget = canopyRoot.querySelector('#raffleCountdownTarget');
  const claimBusy = new Set();
  let countdownTimer = null;
  let countdownTargetMs = null;
  let countdownMode = 'pending';
  const SUI_TRANSACTION_SDK = 'https://esm.run/@mysten/sui@2.23.1/transactions';

  const unfundedLabel = 'Prize to be announced';
  let previewConfig = {
    minimumQualifyingUsdConcept: 5,
    maxStreakMultiplierConcept: 2.5,
    maxStreakDaysConcept: 15,
    ticketExponentConcept: 0.9457,
    ticketCoefficientConcept: 0.288368,
    streakMultipliersConcept: [1, 1.1, 1.25, 1.4, 1.5, 1.6, 1.75, 1.85, 1.95, 2, 2.1, 2.2, 2.3, 2.4, 2.5],
    milestoneBonusUsdConcept: { 7: 50, 15: 200 },
  };

  function formattedCountdownTarget(targetMs) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full', timeStyle: 'short', timeZone: 'America/New_York',
    }).format(new Date(targetMs)) + ' Eastern';
  }

  function renderCountdown() {
    if (!raffleCountdown || !raffleCountdownLabel || !raffleCountdownTarget) return;
    raffleCountdownCard?.classList.toggle('live', countdownMode === 'live');
    if (countdownMode === 'live') {
      raffleCountdownLabel.textContent = 'TREE Canopy Draw';
      raffleCountdown.textContent = 'ENTRIES OPEN';
      raffleCountdownTarget.textContent = 'The public raffle is active. Review the rules before entering.';
      return;
    }
    if (!Number.isFinite(countdownTargetMs)) {
      raffleCountdownLabel.textContent = 'Public raffle launch';
      raffleCountdown.textContent = 'DATE PENDING';
      raffleCountdownTarget.textContent = 'The public launch time will appear after the controlled draw and claim test.';
      return;
    }
    const remaining = countdownTargetMs - Date.now();
    if (remaining <= 0) {
      raffleCountdownLabel.textContent = countdownMode === 'public-launch' ? 'Public raffle launch' : 'Controlled draw check';
      raffleCountdown.textContent = countdownMode === 'public-launch' ? 'LAUNCH CHECK DUE' : 'DRAW CHECK DUE';
      raffleCountdownTarget.textContent = countdownMode === 'public-launch'
        ? 'Waiting for the verified public-entry status.'
        : 'Waiting for the on-chain draw and claim verification.';
      return;
    }
    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    raffleCountdownLabel.textContent = countdownMode === 'public-launch' ? 'Public raffle launches in' : 'Controlled draw check in';
    raffleCountdown.textContent = `${String(days).padStart(2, '0')}d : ${String(hours).padStart(2, '0')}h : ${String(minutes).padStart(2, '0')}m : ${String(seconds).padStart(2, '0')}s`;
    raffleCountdownTarget.textContent = formattedCountdownTarget(countdownTargetMs);
  }

  function setCountdown(payload, entriesOpen) {
    clearInterval(countdownTimer);
    const publicTarget = Date.parse(String(payload.publicLaunchAt || ''));
    const controlledClose = Date.parse(String(payload.rounds?.daily?.closesAt || ''));
    if (entriesOpen) {
      countdownMode = 'live';
      countdownTargetMs = null;
    } else if (Number.isFinite(publicTarget)) {
      countdownMode = 'public-launch';
      countdownTargetMs = publicTarget;
    } else if (Number.isFinite(controlledClose)) {
      countdownMode = 'controlled-draw';
      countdownTargetMs = controlledClose + 5 * 60_000;
    } else {
      countdownMode = 'pending';
      countdownTargetMs = null;
    }
    renderCountdown();
    countdownTimer = setInterval(renderCountdown, 1_000);
  }

  function prizeLabel(prize) {
    if (!prize) return unfundedLabel;
    if (typeof prize === 'string') return prize;
    if (prize.amount && prize.symbol) return `${prize.amount} ${prize.symbol}`;
    if (prize.amountRaw && prize.symbol && Number.isInteger(Number(prize.decimals))) {
      const decimals = Number(prize.decimals);
      const raw = String(prize.amountRaw).padStart(decimals + 1, '0');
      const whole = decimals ? raw.slice(0, -decimals) : raw;
      const fraction = decimals ? raw.slice(-decimals).replace(/0+$/, '') : '';
      const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const amount = fraction ? `${groupedWhole}.${fraction}` : groupedWhole;
      return `${amount} ${prize.symbol}`;
    }
    return unfundedLabel;
  }

  function renderWalletSnapshot(payload) {
    const wallet = payload.wallet;
    const daily = payload.rounds?.daily?.wallet;
    const weekly = payload.rounds?.weekly?.wallet;
    if (!window.playerAddress) {
      raffleEntriesCount.textContent = '—';
      raffleEntriesStatus.textContent = 'Connect your wallet to view verified entries, streaks, and prizes.';
      return;
    }
    const dailyTickets = Number(daily?.mainTickets || 0);
    const weeklyTickets = Number(weekly?.mainTickets || 0);
    const luckyTickets = Number(weekly?.luckyLeafTickets || 0);
    raffleEntriesCount.textContent = dailyTickets.toLocaleString();
    const streakDays = Number(wallet?.streak?.days || 0);
    const unclaimed = Array.isArray(wallet?.unclaimedPrizes) ? wallet.unclaimedPrizes.length : 0;
    raffleEntriesStatus.textContent = `Daily: ${dailyTickets.toLocaleString()} main tickets · Weekly: ${weeklyTickets.toLocaleString()} main + ${luckyTickets.toLocaleString()} Lucky Leaf · Streak: ${streakDays} day${streakDays === 1 ? '' : 's'} · Unclaimed prizes: ${unclaimed}`;
  }

  function renderHistory(history) {
    if (!raffleHistoryElement) return;
    if (!Array.isArray(history) || history.length === 0) {
      raffleHistoryElement.textContent = 'No rounds have been completed yet.';
      return;
    }
    raffleHistoryElement.replaceChildren(...history.slice(0, 8).map((winner) => {
      const row = document.createElement('span');
      const wallet = String(winner.wallet || '');
      const shortWallet = wallet.length > 12 ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : wallet;
      row.className = 'raffle-history-row';
      row.textContent = `${winner.kind === 'weekly' ? 'Weekly' : 'Daily'} ${winner.prizeClass === 'lucky' ? 'Lucky Leaf' : 'main'} · ${shortWallet} · ${prizeLabel({ amountRaw: winner.amountRaw, decimals: winner.decimals, symbol: winner.token })}${winner.claimed ? ' · Claimed' : ' · Ready to claim'}`;
      return row;
    }));
  }

  function transactionDigest(value) {
    return value?.digest || value?.transactionDigest || value?.effects?.transactionDigest || value?.result?.digest || null;
  }

  function transactionSucceeded(value) {
    const status = value?.effects?.status?.status ?? value?.effects?.status ?? value?.transaction?.effects?.status?.status;
    return String(status || '').toLowerCase() === 'success';
  }

  async function submitClaim(prize, contracts) {
    const wallet = String(window.playerAddress || '').toLowerCase();
    const key = `${prize.roundId}:${prize.prizeClass}`;
    if (!/^0x[0-9a-f]{64}$/.test(wallet)) throw new Error('Connect the winning wallet before claiming.');
    if (claimBusy.has(key)) return;
    claimBusy.add(key);
    try {
      raffleClaimStatus.textContent = 'Checking the claim transaction before wallet approval…';
      const [{ Transaction }, client] = await Promise.all([
        import(SUI_TRANSACTION_SDK),
        typeof window.initSuiClient === 'function' ? window.initSuiClient() : Promise.reject(new Error('The Sui Mainnet client is unavailable.')),
      ]);
      const transaction = buildTreeRaffleBrowserClaim(Transaction, {
        packageId: contracts.packageId,
        poolId: contracts.poolId,
        onchainDrawId: prize.onchainDrawId,
        tokenType: prize.tokenType,
      });
      if (typeof transaction.setSender === 'function') transaction.setSender(wallet);
      const simulation = await client.core.simulateTransaction({
        transaction,
        checksEnabled: true,
        include: { effects: true, events: true, balanceChanges: true },
      });
      if (!transactionSucceeded(simulation)) throw new Error('The prize claim did not pass the Sui Mainnet safety check.');
      if (!(await confirmTransaction(`Claim ${prizeLabel({ amountRaw: prize.amountRaw, decimals: prize.decimals, symbol: prize.token })} from the TREE Canopy Draw?`, { title: 'Claim TREE Prize' }))) return;
      if (typeof window.signAndExecuteTransactionBlock !== 'function') throw new Error('The connected wallet cannot sign this transaction.');
      raffleClaimStatus.textContent = 'Review and approve the prize claim in your wallet.';
      const submitted = await window.signAndExecuteTransactionBlock(transaction);
      const digest = transactionDigest(submitted);
      if (!digest) throw new Error('The wallet returned no transaction digest.');
      raffleClaimStatus.textContent = 'Waiting for the claim to finalize on Sui…';
      const finalized = await client.core.waitForTransaction({ digest, timeout: 60_000, include: { effects: true, events: true, balanceChanges: true } });
      if (!transactionSucceeded(finalized)) throw new Error('The prize claim did not finalize successfully.');
      const response = await fetch('/api/tree-raffle-claim', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest, wallet, roundId: prize.roundId, prizeClass: prize.prizeClass }),
      });
      if (!response.ok) throw new Error('The claim finalized, but the raffle record has not reconciled yet. Refresh shortly or contact TREE support with the transaction digest.');
      raffleClaimStatus.textContent = `Prize claimed successfully · ${digest.slice(0, 8)}…${digest.slice(-6)}`;
      await loadRaffleStatus();
    } finally {
      claimBusy.delete(key);
    }
  }

  function renderClaims(payload) {
    if (!raffleClaimList) return;
    raffleClaimList.replaceChildren();
    const wallet = payload.wallet;
    const prizes = Array.isArray(wallet?.unclaimedPrizes) ? wallet.unclaimedPrizes : [];
    if (!window.playerAddress) {
      const message = document.createElement('p');
      message.textContent = 'Connect your wallet to check for claimable prizes.';
      raffleClaimList.append(message);
      return;
    }
    if (!prizes.length) {
      const message = document.createElement('p');
      message.textContent = 'No unclaimed prizes are recorded for this wallet.';
      raffleClaimList.append(message);
      return;
    }
    const claimsReady = payload.rules?.claimsEnabled === true
      && payload.rules?.prizesFunded === true
      && payload.safeguards?.onchainPrizePoolConfigured === true
      && payload.contracts?.packageId
      && payload.contracts?.poolId;
    prizes.forEach((prize) => {
      const row = document.createElement('div');
      row.className = 'raffle-claim-row';
      const copy = document.createElement('span');
      copy.textContent = `${prize.roundId} · ${prize.prizeClass === 'lucky' ? 'Lucky Leaf' : 'Main'} · ${prizeLabel({ amountRaw: prize.amountRaw, decimals: prize.decimals, symbol: prize.token })}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button gold';
      button.textContent = claimsReady ? 'Claim Prize' : 'Claim activation pending';
      button.disabled = !claimsReady;
      if (claimsReady) button.addEventListener('click', () => submitClaim(prize, payload.contracts).catch((error) => {
        raffleClaimStatus.textContent = error instanceof Error ? error.message : 'Prize claim failed.';
      }));
      row.append(copy, button);
      raffleClaimList.append(row);
    });
  }

  function currentStreakMultiplierBasisPoints() {
    const days = Number(streakInput.value);
    const table = previewConfig.streakMultipliersConcept;
    const multiplier = Array.isArray(table)
      ? table[Math.min(days, table.length) - 1]
      : null;
    return Math.round(Number(multiplier || previewConfig.maxStreakMultiplierConcept || 2.5) * 10_000);
  }

  function baseTicketsFromUsd(qualifyingUsd) {
    const exponent = Number(previewConfig.ticketExponentConcept || 0.9457);
    const coefficient = Number(previewConfig.ticketCoefficientConcept || 0.288368);
    return Math.max(1, Math.floor(qualifyingUsd ** exponent * coefficient));
  }

  function updateTicketPreview() {
    const rawValue = formulaInput.value.trim();
    const minimum = Number(previewConfig.minimumQualifyingUsdConcept || 5);

    if (!rawValue) {
      formulaInput.removeAttribute('aria-invalid');
      formulaResult.textContent = 'Enter an amount to preview tickets.';
      return;
    }

    if (!/^\d+(?:\.\d{0,2})?$/.test(rawValue)) {
      formulaInput.setAttribute('aria-invalid', 'true');
      formulaResult.textContent = 'Enter a valid non-negative amount with no more than two decimal places.';
      return;
    }

    const [whole, fraction = ''] = rawValue.split('.');
    const qualifyingUsdCents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
    const minimumCents = BigInt(Math.round(minimum * 100));
    formulaInput.removeAttribute('aria-invalid');
    if (qualifyingUsdCents < minimumCents) {
      formulaResult.textContent = `Below the $${minimum.toFixed(2)} qualifying threshold: 0 main tickets. Lucky Leaf remains staged and inactive.`;
      return;
    }

    const qualifyingUsd = Number(qualifyingUsdCents) / 100;
    const mainTickets = baseTicketsFromUsd(qualifyingUsd);
    const multiplierBasisPoints = currentStreakMultiplierBasisPoints();
    const exponent = Number(previewConfig.ticketExponentConcept || 0.9457);
    const coefficient = Number(previewConfig.ticketCoefficientConcept || 0.288368);
    const adjustedTickets = Math.max(1, Math.floor(
      qualifyingUsd ** exponent * coefficient * multiplierBasisPoints / 10_000,
    ));
    const days = Number(streakInput.value);
    const milestoneUsd = Number(previewConfig.milestoneBonusUsdConcept?.[days] || 0);
    const milestoneTickets = milestoneUsd ? baseTicketsFromUsd(milestoneUsd) : 0;
    const milestoneLabel = milestoneTickets
      ? ` · potential first-time day-${days} bonus: ${milestoneTickets.toLocaleString()}`
      : '';
    formulaResult.textContent = `${mainTickets.toLocaleString()} base tickets · ${adjustedTickets.toLocaleString()} after the ${(multiplierBasisPoints / 10_000).toFixed(2)}x streak preview${milestoneLabel}. Lucky Leaf remains staged and inactive. Preview only — these are not valid entries.`;
  }

  function updateStreakPreview() {
    const days = Number(streakInput.value);
    const multiplierBasisPoints = currentStreakMultiplierBasisPoints();
    streakResult.textContent = `Day ${days}: ${(multiplierBasisPoints / 10_000).toFixed(2)}x preview multiplier`;
    updateTicketPreview();
  }

  function setRaffleEntryUi(acceptingEntries) {
    if (!raffleEntryButton) {
      return;
    }
    if (acceptingEntries) {
      raffleEntryButton.textContent = 'Buy TREE to enter';
      raffleEntryButton.setAttribute('href', '#swap');
      raffleEntryButton.removeAttribute('aria-disabled');
      raffleEntryButton.classList.remove('button-staged-disabled');
      raffleEntryButton.classList.remove('is-disabled');
      raffleEntryButton.classList.remove('disabled');
      raffleEntryButton.style.pointerEvents = '';
      raffleEntryButton.style.opacity = '';
      if (raffleEntriesStatus) {
        raffleEntriesStatus.textContent = 'Entries are currently open to qualified purchases.';
      }
      if (raffleEntriesCount) {
        raffleEntriesCount.textContent = raffleEntriesCount.textContent || '0';
      }
    } else {
      raffleEntryButton.textContent = launchNotActiveText;
      raffleEntryButton.setAttribute('href', '#canopy-draw');
      raffleEntryButton.setAttribute('aria-disabled', 'true');
      raffleEntryButton.style.pointerEvents = 'none';
      raffleEntryButton.style.opacity = '0.72';
      if (raffleEntriesStatus) {
        raffleEntriesStatus.textContent = 'Entries are only tracked after launch activation.';
      }
      if (raffleEntriesCount && raffleEntriesCount.textContent === '0') {
        raffleEntriesCount.textContent = '0';
      }
    }
  }

  const previewUrl = new URL('../data/canopy-draw-preview.json', import.meta.url);

  function loadRaffleStatus() {
    const statusUrl = new URL('/api/tree-raffle-status', window.location.origin);
    if (window.playerAddress) statusUrl.searchParams.set('wallet', window.playerAddress);
    return fetch(statusUrl, { headers: { Accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error('Raffle status unavailable');
      return response.json();
    })
    .then((payload) => {
      const rules = payload.rules || {};
      previewConfig = {
        ...previewConfig,
        minimumQualifyingUsdConcept: Number(rules.minimumQualifyingUsdCents || 500) / 100,
        ticketExponentConcept: rules.ticketExponent || 0.9457,
        ticketCoefficientConcept: rules.ticketCoefficient || 0.288368,
        maxStreakDaysConcept: rules.maxStreakDays || 15,
        maxStreakMultiplierConcept: Number(rules.maxStreakMultiplierBasisPoints || 25000) / 10000,
        streakMultipliersConcept: Array.isArray(rules.streakMultipliersBasisPoints)
          ? rules.streakMultipliersBasisPoints.map((value) => Number(value) / 10_000)
          : previewConfig.streakMultipliersConcept,
        milestoneBonusUsdConcept: rules.milestoneBonusUsdCents
          ? Object.fromEntries(Object.entries(rules.milestoneBonusUsdCents).map(([day, cents]) => [day, Number(cents) / 100]))
          : previewConfig.milestoneBonusUsdConcept,
      };
      dailyPrize.textContent = prizeLabel(payload.rounds?.daily?.prize);
      weeklyPrize.textContent = prizeLabel(payload.rounds?.weekly?.prize);
      streakInput.max = String(previewConfig.maxStreakDaysConcept);
      const entriesOpen = payload.safeguards?.verifiedBuyIngestionEnabled === true
        && Array.isArray(payload.launchBlockers)
        && payload.launchBlockers.length === 0;
      raffleState.textContent = entriesOpen ? 'Open' : 'Preparing';
      raffleState.className = entriesOpen ? 'data-state ok' : 'data-state stale';
      setRaffleEntryUi(entriesOpen);
      setCountdown(payload, entriesOpen);
      const entriesText = entriesOpen ? 'Entries: enabled' : 'Entries: not open yet';
      raffleMeta.textContent = `Rules: ${rules.version || 'not published'} · Updated: ${new Date(payload.generatedAt).toLocaleString()} · ${entriesText}`;
      const historyText = Array.isArray(payload.history) && payload.history.length
        ? `${payload.history.length} published draw records.`
        : 'No rounds have been scheduled and no draw history exists.';
      if (raffleHistory) {
        raffleHistory.textContent = historyText;
      }
      if (raffleHistoryElement && !payload.history?.length) {
        raffleHistoryElement.textContent = 'No rounds have been scheduled.';
      }
      renderWalletSnapshot(payload);
      renderHistory(payload.history);
      renderClaims(payload);
      raffleBlockers.textContent = Array.isArray(payload.launchBlockers)
        ? payload.launchBlockers.join(' ')
        : 'Launch requirements have not been approved.';
      updateTicketPreview();
      updateStreakPreview();
    })
    .catch(() => fetch(previewUrl, { headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error('Preview configuration unavailable');
        return response.json();
      })
      .then((config) => {
        previewConfig = { ...previewConfig, ...config };
        raffleState.textContent = 'Local safeguard';
        raffleState.className = 'data-state stale';
        raffleMeta.textContent = `Rules: ${config.version || 'local preview'} · Live status temporarily unavailable · Entries status unavailable`;
        setRaffleEntryUi(false);
        setCountdown({}, false);
      })
      .catch(() => {
        raffleState.textContent = 'Unavailable';
        raffleState.className = 'data-state error';
        raffleMeta.textContent = 'Raffle status unavailable · Entries remain disabled';
        setRaffleEntryUi(false);
        setCountdown({}, false);
      })
      .finally(() => {
        dailyPrize.textContent = unfundedLabel;
        weeklyPrize.textContent = unfundedLabel;
        updateTicketPreview();
        updateStreakPreview();
      }));
  }

  formulaInput.addEventListener('input', updateTicketPreview);
  streakInput.addEventListener('input', updateStreakPreview);
  window.addEventListener('tree:wallet-changed', loadRaffleStatus);
  loadRaffleStatus();
}

