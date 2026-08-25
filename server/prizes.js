// prizes: array of active prize rows. counts: { [prizeId]: awardedToday }
function getEligible(prizes, counts) {
  const withWeight = prizes.filter((p) => p.weight > 0);
  const underCap = withWeight.filter(
    (p) => p.daily_cap == null || (counts[p.id] || 0) < p.daily_cap
  );
  if (underCap.length > 0) return underCap;
  // everything capped -> consolation: any uncapped active prize
  const uncapped = prizes.filter((p) => p.daily_cap == null);
  return uncapped.length > 0 ? uncapped : prizes.slice();
}

function selectPrize(eligible, rng = Math.random) {
  const total = eligible.reduce((s, p) => s + p.weight, 0);
  let r = rng() * total;
  for (const p of eligible) {
    r -= p.weight;
    if (r < 0) return p;
  }
  return eligible[eligible.length - 1];
}

module.exports = { getEligible, selectPrize };
