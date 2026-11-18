import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countdownUnitLabel,
  formatUTCDeadline,
  monthFromCalendarLabel,
  monthFromCollectionTitle,
  parseSeasonMonth,
  resolveSeasonMonth,
  seasonCountdown,
} from '../scripts/arcade-season-deadline.js';
import { collections } from '../scripts/arcade-seasonal-data.js';

test('November closes at the exclusive December 1 midnight UTC boundary', () => {
  const season = parseSeasonMonth('2026-11');
  assert.equal(season.deadlineISO, '2026-12-01T00:00:00.000Z');
  assert.equal(season.deadlineLabel, 'December 1, 2026 · 00:00 UTC');
  const before = seasonCountdown('2026-11', Date.parse('2026-11-30T23:59:59.999Z'));
  assert.equal(before.state, 'active');
  assert.equal(before.remainingSeconds, 1);
  const exact = seasonCountdown('2026-11', season.endsAt);
  assert.equal(exact.state, 'closed');
  assert.equal(exact.remainingSeconds, 0);
  const after = seasonCountdown('2026-11', Date.parse('2027-02-01T12:00:00Z'));
  assert.equal(after.state, 'closed');
  assert.deepEqual([after.days, after.hours, after.minutes, after.seconds], [0, 0, 0, 0]);
});

test('UTC boundaries are independent of an equivalent local offset', () => {
  const utc = seasonCountdown('2026-11', Date.parse('2026-12-01T00:00:00Z'));
  const central = seasonCountdown('2026-11', Date.parse('2026-11-30T18:00:00-06:00'));
  assert.deepEqual(central, utc);
  const remaining = seasonCountdown('2026-11', Date.parse('2026-11-18T12:34:56Z'));
  assert.deepEqual([remaining.days, remaining.hours, remaining.minutes, remaining.seconds], [12, 11, 25, 4]);
});

test('calendar arithmetic handles December rollover and leap-year rules', () => {
  assert.equal(parseSeasonMonth('2026-12').deadlineISO, '2027-01-01T00:00:00.000Z');
  for (const [month, days] of [['2024-02', 29], ['2026-02', 28], ['2100-02', 28], ['2000-02', 29]]) {
    const season = parseSeasonMonth(month);
    assert.equal((season.endsAt - season.startsAt) / 86400000, days);
  }
});

test('malformed months and invalid clocks fail without fabricating a deadline', () => {
  for (const month of [undefined, null, '', '2026-00', '2026-13', '2026-1', 'November 2026', '2026-11-01', '0000-11', {}, ' 2026-11']) {
    assert.equal(parseSeasonMonth(month), null);
    assert.equal(seasonCountdown(month, Date.now()), null);
  }
  assert.equal(seasonCountdown('2026-11', NaN), null);
  assert.equal(seasonCountdown('2026-11', new Date('invalid')), null);
  assert.equal(formatUTCDeadline(Infinity), null);
});

test('a stale November collection stays closed until the displayed month changes', () => {
  const now = Date.parse('2026-12-03T12:00:00Z');
  const stale = resolveSeasonMonth({ calendarLabel: 'November 2026', progressMonth: '2026-11' });
  assert.equal(seasonCountdown(stale, now).state, 'closed');
  assert.equal(resolveSeasonMonth({ calendarLabel: 'Your month' }), '2026-11');
  const current = resolveSeasonMonth({ calendarLabel: 'December 2026', progressMonth: '2026-11' });
  assert.equal(current, '2026-12');
  assert.equal(seasonCountdown(current, now).state, 'active');
  assert.equal(resolveSeasonMonth({ calendarLabel: 'Your month', progressMonth: '2026-12' }), '2026-12');
  assert.equal(resolveSeasonMonth({ fallbackMonth: 'bad' }), null);
  assert.equal(monthFromCalendarLabel('November 2026 · Last saved progress'), '2026-11');
});

test('upcoming collections are not presented as open and unit labels handle one', () => {
  assert.equal(seasonCountdown('2026-12', Date.parse('2026-11-30T23:59:59Z')).state, 'upcoming');
  for (const unit of ['day', 'hour', 'minute', 'second']) {
    assert.equal(countdownUnitLabel(unit, 1), unit);
    assert.equal(countdownUnitLabel(unit, 0), `${unit}s`);
    assert.equal(countdownUnitLabel(unit, 2), `${unit}s`);
  }
});

test('signed-out named artwork resolves only to explicitly configured season years', () => {
  for (const [month, collection] of Object.entries(collections)) {
    assert.equal(monthFromCollectionTitle(collection.title), month);
  }
  assert.equal(monthFromCollectionTitle('December'), null);
  assert.equal(monthFromCollectionTitle('December · A future collection'), null);
  assert.equal(resolveSeasonMonth({ calendarLabel: 'Your month', collectionTitle: collections['2026-12'].title }), '2026-12');
  assert.equal(resolveSeasonMonth({ calendarLabel: 'November 2026', collectionTitle: collections['2026-12'].title }), '2026-11');
  assert.equal(resolveSeasonMonth({ calendarLabel: 'Your month', progressMonth: '2026-11', collectionTitle: collections['2026-12'].title }), '2026-11');
});
