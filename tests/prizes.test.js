const { test } = require('node:test');
const assert = require('node:assert');
const { getEligible, selectPrize } = require('../server/prizes');

const PRIZES = [
  { id: 1, label: '10% off',  weight: 40, daily_cap: null },
  { id: 2, label: 'Free meal', weight: 2, daily_cap: 2 },
  { id: 3, label: 'Zero',     weight: 0, daily_cap: null },
];

test('getEligible drops weight<=0 prizes', () => {
  const e = getEligible(PRIZES, {});
  assert.deepStrictEqual(e.map((p) => p.id), [1, 2]);
});

test('getEligible drops prizes at their daily cap', () => {
  const e = getEligible(PRIZES, { 2: 2 }); // free meal already awarded twice
  assert.deepStrictEqual(e.map((p) => p.id), [1]);
});

test('getEligible falls back to uncapped prizes when all capped', () => {
  const capped = [{ id: 9, label: 'X', weight: 5, daily_cap: 1 }];
  const withUncapped = [...capped, { id: 1, label: '10% off', weight: 40, daily_cap: null }];
  const e = getEligible(withUncapped, { 9: 1 });
  assert.deepStrictEqual(e.map((p) => p.id), [1]);
});

test('selectPrize is weighted (deterministic via injected rng)', () => {
  const eligible = [
    { id: 1, weight: 40 },
    { id: 2, weight: 2 },
  ];
  // rng just below the 40/42 boundary picks id 1; just above picks id 2
  assert.strictEqual(selectPrize(eligible, () => 0.5).id, 1);
  assert.strictEqual(selectPrize(eligible, () => 0.99).id, 2);
});

test('selectPrize distribution roughly matches weights', () => {
  const eligible = [
    { id: 1, weight: 90 },
    { id: 2, weight: 10 },
  ];
  let ones = 0;
  for (let i = 0; i < 5000; i++) if (selectPrize(eligible).id === 1) ones++;
  const ratio = ones / 5000;
  assert.ok(ratio > 0.85 && ratio < 0.95, `expected ~0.9, got ${ratio}`);
});
