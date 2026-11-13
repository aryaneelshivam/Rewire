/**
 * Credits for an analysis, the same way the API charges them: per video, one credit per started block of
 * `secondsPerCredit` seconds (half a second of grace), at least one; then a bigger audience adds up to
 * `surcharge` (half as much again by default) at 1,000 simulated viewers, in proportion above 200, rounded up.
 * The API measures the videos itself and its figure is the one charged; this is for showing the cost before uploading.
 */
const GRACE_S = 0.5;
const VIEWERS_BASE = 200;
const VIEWERS_TOP = 1000;

export function creditCost(seconds, secondsPerCredit = 10, viewers = VIEWERS_BASE, surcharge = 0.5) {
  const base = seconds.reduce((sum, s) => sum + Math.max(1, Math.ceil(Math.max(0, (s || 0) - GRACE_S) / secondsPerCredit - 1e-9)), 0) || 1;
  const share = Math.max(0, viewers - VIEWERS_BASE) / (VIEWERS_TOP - VIEWERS_BASE);
  return base + Math.ceil(base * surcharge * share - 1e-9);
}
