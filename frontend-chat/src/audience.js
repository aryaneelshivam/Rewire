/**
 * The audience sizes a person can simulate, and what each one buys, from measurements rather than guesses.
 *
 * MEASURED comes from scripts/measure_viewers.py: runs of the real analysis (backend/analysis.py) on the sample
 * ad: five different simulated audiences per size, recording how much the overall score moved between them and how
 * long the simulation took. Re-measure and paste new numbers here if the simulation changes.
 *
 * Display values (what tooltips say) are kept apart from the 10-segment bar values, which are normalised against the
 * best size in the set: the most precise, the most viewers, the fastest, the cheapest.
 */

export const VIEWERS = { min: 200, max: 1000, step: 100, default: 200 };
const COHORTS = 4;

// Overall score spread between runs (sample SD as % of the mean) and median simulation time, per size.
// Sample ad A, 33 s long, measured on a Mac laptop (2 simulation threads, as the API runs).
export const MEASURED = {
  videoSeconds: 33,
  runs: 5,
  sizes: {
    200: { sdPct: 0.93, seconds: 3.2 },
    400: { sdPct: 0.77, seconds: 8.8 },
    600: { sdPct: 0.54, seconds: 11.4 },
    800: { sdPct: 0.51, seconds: 15.5 },
    1000: { sdPct: 0.49, seconds: 17.1 },
  },
};

/** Linear in between measured sizes (both spread and time move smoothly with size). */
function measuredAt(n) {
  const keys = Object.keys(MEASURED.sizes).map(Number).sort((a, b) => a - b);
  const hi = keys.find(k => k >= n) ?? keys.at(-1);
  const lo = [...keys].reverse().find(k => k <= n) ?? keys[0];
  const a = MEASURED.sizes[lo];
  const b = MEASURED.sizes[hi];
  const t = hi === lo ? 0 : (n - lo) / (hi - lo);
  return { sdPct: a.sdPct + (b.sdPct - a.sdPct) * t, seconds: a.seconds + (b.seconds - a.seconds) * t };
}

/** The API's credit rule (backend/credits.py): per video one credit per started block of seconds, at least one,
 * then up to `surcharge` more at 1,000 viewers in proportion above 200, rounded up. */
export function creditCost(lengths, secondsPerCredit = 10, viewers = 200, surcharge = 0.5) {
  const base = lengths.reduce((sum, s) => sum + Math.max(1, Math.ceil(Math.max(0, (s || 0) - 0.5) / secondsPerCredit - 1e-9)), 0) || 1;
  const share = Math.max(0, viewers - VIEWERS.min) / (VIEWERS.max - VIEWERS.min);
  return base + Math.ceil(base * surcharge * share - 1e-9);
}

const clamp10 = v => Math.min(10, Math.max(1, Math.round(v)));

/**
 * Every size with its display values and normalised bars:
 *   precision  how closely repeat runs agree (lower spread is better), against the most precise size
 *   depth      viewers simulated, against the largest size
 *   speed      simulation time, against the fastest size
 *   cost       credit multiplier, inverted so cheaper fills more, against the cheapest size
 */
export function audienceOptions(surcharge = 0.5) {
  const sizes = [];
  for (let n = VIEWERS.min; n <= VIEWERS.max; n += VIEWERS.step) sizes.push(n);
  const rows = sizes.map(n => ({ n, ...measuredAt(n), multiplier: 1 + surcharge * (n - VIEWERS.min) / (VIEWERS.max - VIEWERS.min) }));
  const best = {
    sd: Math.min(...rows.map(r => r.sdPct)) || 1e-9,
    n: Math.max(...rows.map(r => r.n)),
    time: Math.min(...rows.map(r => r.seconds)) || 1e-9,
    multiplier: Math.min(...rows.map(r => r.multiplier)),
  };
  return rows.map(r => ({
    value: r.n,
    label: `${r.n.toLocaleString('en')} viewers`,
    group: `${(r.n / COHORTS).toLocaleString('en')} per age group`,
    description: r.n === VIEWERS.min
      ? 'The standard audience. Quickest, and the base price.'
      : r.n === VIEWERS.max
        ? 'The largest audience. Steadiest averages, for close calls between two cuts.'
        : 'Smoother averages than the standard audience, for a little more time and credit.',
    sdPct: r.sdPct,
    simSeconds: r.seconds,
    multiplier: r.multiplier,
    metrics: {
      precision: clamp10(10 * best.sd / (r.sdPct || best.sd)),
      depth: clamp10(10 * r.n / best.n),
      speed: clamp10(10 * best.time / (r.seconds || best.time)),
      cost: clamp10(10 * best.multiplier / r.multiplier),
    },
  }));
}

/** Simulation time for videos of these lengths, scaled from the measured sample (it grows with video length). */
export const simSecondsFor = (option, lengths) => {
  const total = lengths.length ? lengths.reduce((a, b) => a + (b || 0), 0) : 30;
  return option.simSeconds * total / MEASURED.videoSeconds;
};
