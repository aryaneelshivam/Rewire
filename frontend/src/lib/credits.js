/**
 * Credits for an analysis, the same way the API charges them: per video, one credit per started block of
 * `secondsPerCredit` seconds (half a second of grace), at least one. The API measures the videos itself and its
 * figure is the one charged; this is for showing the cost before uploading.
 */
const GRACE_S = 0.5;
export function creditCost(seconds, secondsPerCredit = 10) {
  return seconds.reduce((sum, s) => sum + Math.max(1, Math.ceil(Math.max(0, (s || 0) - GRACE_S) / secondsPerCredit - 1e-9)), 0) || 1;
}
