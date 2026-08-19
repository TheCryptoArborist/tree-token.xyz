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

  const unfundedLabel = 'TBD — round not funded';
  let previewConfig = {
    minimumQualifyingUsdConcept: 5,
    maxStreakMultiplierConcept: 2.5,
    maxStreakDaysConcept: 15,
    ticketExponentConcept: 0.9457,
    ticketCoefficientConcept: 0.288368,
    streakMultipliersConcept: [1, 1.1, 1.25, 1.4, 1.5, 1.6, 1.75, 1.85, 1.95, 2, 2.1, 2.2, 2.3, 2.4, 2.5],
    milestoneBonusUsdConcept: { 7: 50, 15: 200 },
  };

  function prizeLabel(prize) {
    if (!prize) return unfundedLabel;
    if (typeof prize === 'string') return prize;
    if (prize.amount && prize.symbol) return `${prize.amount} ${prize.symbol}`;
    return unfundedLabel;
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
      formulaResult.textContent = `Below the $${minimum.toFixed(2)} qualifying threshold: 0 main tickets and 0 Lucky Leaf tickets.`;
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
    formulaResult.textContent = `${mainTickets.toLocaleString()} base tickets · ${adjustedTickets.toLocaleString()} after the ${(multiplierBasisPoints / 10_000).toFixed(2)}x streak preview${milestoneLabel} · 1 Lucky Leaf ticket. Preview only — these are not valid entries.`;
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

  fetch('/api/tree-raffle-status', { headers: { Accept: 'application/json' } })
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
      })
      .catch(() => {
        raffleState.textContent = 'Unavailable';
        raffleState.className = 'data-state error';
        raffleMeta.textContent = 'Raffle status unavailable · Entries remain disabled';
        setRaffleEntryUi(false);
      })
      .finally(() => {
        dailyPrize.textContent = unfundedLabel;
        weeklyPrize.textContent = unfundedLabel;
        updateTicketPreview();
        updateStreakPreview();
      }));

  formulaInput.addEventListener('input', updateTicketPreview);
  streakInput.addEventListener('input', updateStreakPreview);
}

