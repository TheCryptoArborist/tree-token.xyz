import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dapp/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../scripts/canopy-draw.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../dapp/panel-router.css', import.meta.url), 'utf8');

test('Knowledge Trial replaces the public raffle countdown with a fixed-duration skill summary', () => {
  assert.match(html, /class="raffle-countdown-card knowledge-trial-summary"[^>]*aria-live="polite"/);
  assert.match(html, /TRIAL DURATION/);
  assert.match(html, />03:00</);
  assert.match(styles, /\.raffle-countdown-card/);
});

test('countdown distinguishes controlled draw verification from public launch', () => {
  assert.match(script, /publicLaunchAt/);
  assert.match(script, /controlledClose \+ 5 \* 60_000/);
  assert.match(script, /Controlled draw check in/);
  assert.match(script, /Public raffle launches in/);
  assert.match(script, /ENTRIES OPEN/);
});
