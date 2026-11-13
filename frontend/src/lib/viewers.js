/** How many simulated viewers an analysis can use. Mirrors VIEWERS_* in backend/analysis.py. */
export const VIEWERS = { min: 200, max: 1000, step: 100, default: 200 };

/** "1,000 simulated viewers" style counts. */
export const viewerCount = n => (n ?? VIEWERS.default).toLocaleString('en');
