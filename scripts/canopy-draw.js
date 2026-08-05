const canopyRoot = document.getElementById('canopy-draw');

if (canopyRoot) {
  const dailyPrize = canopyRoot.querySelector('[data-daily-prize]');
  const weeklyPrize = canopyRoot.querySelector('[data-weekly-prize]');
  const formulaInput = canopyRoot.querySelector('#canopy-qualifying-usd');
  const formulaResult = canopyRoot.querySelector('#canopy-ticket-result');
  const streakInput = canopyRoot.querySelector('#canopy-streak-days');
  const streakResult = canopyRoot.querySelector('#canopy-streak-result');

  const unfundedLabel = 'TBD — round not funded';
  let previewConfig = {
    minimumQualifyingUsdConcept: 5,
    maxStreakMultiplierConcept: 2.5,
    maxStreakDaysConcept: 15,
  };

  function prizeLabel(prize) {
    if (!prize) return unfundedLabel;
    if (typeof prize === 'string') return prize;
    if (prize.amount && prize.symbol) return `${prize.amount} ${prize.symbol}`;
    return unfundedLabel;
  }

  function updateTicketPreview() {
    const rawValue = formulaInput.value.trim();
    const qualifyingUsd = Number(rawValue);
    const minimum = Number(previewConfig.minimumQualifyingUsdConcept || 5);

    if (!rawValue) {
      formulaInput.removeAttribute('aria-invalid');
      formulaResult.textContent = 'Enter a demonstration amount to preview tickets.';
      return;
    }

    if (!Number.isFinite(qualifyingUsd) || qualifyingUsd < 0) {
      formulaInput.setAttribute('aria-invalid', 'true');
      formulaResult.textContent = 'Enter a valid non-negative amount.';
      return;
    }

    formulaInput.removeAttribute('aria-invalid');
    if (qualifyingUsd < minimum) {
      formulaResult.textContent = `Below the $${minimum.toFixed(2)} qualifying concept: 0 example main tickets and 0 Lucky Leaf tickets.`;
      return;
    }

    const mainTickets = Math.floor(100 * Math.sqrt(qualifyingUsd / minimum));
    formulaResult.textContent = `${mainTickets.toLocaleString()} example main tickets and 1 Lucky Leaf ticket. Preview only — these are not valid entries.`;
  }

  function updateStreakPreview() {
    const days = Number(streakInput.value);
    const maxDays = Number(previewConfig.maxStreakDaysConcept || 15);
    const maxMultiplier = Number(previewConfig.maxStreakMultiplierConcept || 2.5);
    const progress = maxDays <= 1 ? 1 : (days - 1) / (maxDays - 1);
    const multiplier = 1 + progress * (maxMultiplier - 1);
    streakResult.textContent = `Day ${days}: ${multiplier.toFixed(2)}x preview multiplier`;
  }

  const previewUrl = new URL('../data/canopy-draw-preview.json', import.meta.url);

  fetch(previewUrl, { headers: { Accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error('Preview configuration unavailable');
      return response.json();
    })
    .then((config) => {
      previewConfig = { ...previewConfig, ...config };
      dailyPrize.textContent = prizeLabel(config.dailyPrize);
      weeklyPrize.textContent = prizeLabel(config.weeklyPrize);
      streakInput.max = String(config.maxStreakDaysConcept || 15);
      updateTicketPreview();
      updateStreakPreview();
    })
    .catch(() => {
      dailyPrize.textContent = unfundedLabel;
      weeklyPrize.textContent = unfundedLabel;
      updateTicketPreview();
      updateStreakPreview();
    });

  formulaInput.addEventListener('input', updateTicketPreview);
  streakInput.addEventListener('input', updateStreakPreview);
}
