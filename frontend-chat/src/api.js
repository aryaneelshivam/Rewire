/**
 * The same API the dashboard uses (backend/main.py). Nothing here is specific to this frontend: it only reads.
 * VITE_API_URL points it at another backend; by default it's the local one on port 8000.
 */
export const API_ORIGIN = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

async function call(path, options = {}) {
  const res = await fetch(`${API_ORIGIN}/api${path}`, options);
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail; } catch { /* not JSON */ }
    const error = new Error(typeof detail === 'string' && detail ? detail : `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

const post = (path, body) => call(path, { method: 'POST', body });

export const mediaUrl = path => (path ? `${API_ORIGIN}${path}` : null);

export const fetchStatus = () => call('/status');
export const fetchRuns = () => call('/runs');
export const openRun = id => post(`/runs/${id}/open`);
export const loadSample = () => post('/load-sample-data');
export const fetchJob = id => call(`/jobs/${id}`);
export const cancelJob = id => post(`/jobs/${id}/cancel`);

/** Everything a verdict needs, for whichever analysis the API has open. */
export async function fetchResults() {
  const status = await fetchStatus();
  const [score, engagement, ab, overview, timeseries] = await Promise.all([
    call('/score'),
    call('/engagement'),
    status.variants.length > 1 ? call('/ab-summary') : Promise.resolve(null),
    call('/overview'),     // per-second response and transcript, for the timeline
    call('/timeseries'),   // each audience's response per driver, per second, for the detail lanes and charts
  ]);
  return { status, score, engagement, ab, overview, timeseries };
}

/** Starts an analysis of one video, or two to compare. Resolves to { job_id }. */
export function createJob(files, viewers) {
  const form = new FormData();
  form.append('mode', files.length === 2 ? 'compare' : 'single');
  form.append('viewers', String(viewers));
  form.append('videoA', files[0]);
  if (files[1]) form.append('videoB', files[1]);
  return post('/jobs', form);
}
