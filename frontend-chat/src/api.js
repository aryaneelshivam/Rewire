/**
 * The same API the dashboard uses (backend/main.py). Nothing here is specific to this frontend: it only reads.
 * VITE_API_URL points it at another backend; by default it's the local one on port 8000.
 */
export const API_ORIGIN = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

// With sign-in on, every request carries the person's Clerk session token (the auth gate registers how to get one;
// Clerk refreshes it, so each request asks afresh). Without sign-in nothing is added and the backend runs open.
let getToken = null;
let accountEmail = '';
export const setTokenGetter = fn => { getToken = fn; };
/** The signed-in email, so the team can tell testers apart (it grants nothing; the token decides who you are). */
export const setAccountEmail = email => { accountEmail = email || ''; };

async function request(path, options = {}) {
  const token = getToken ? await getToken() : null;
  const headers = { ...(options.headers ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (token && accountEmail) headers['X-Rewire-Email'] = accountEmail;
  const res = await fetch(`${API_ORIGIN}/api${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail; } catch { /* not JSON */ }
    const error = new Error(typeof detail === 'string' && detail ? detail : `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return res;
}

const call = async (path, options) => (await request(path, options)).json();

/** Whether the assistant (open-ended questions, answered from the analysis data) is set up on the server. */
export const chatStatus = () => call('/chat');

/**
 * Asks the assistant about the open analysis. `messages` is the conversation so far ({ role, content }, ending with
 * the question); `onText` gets the answer so far as it streams in. Resolves with the whole answer.
 */
export async function askAssistant(messages, onText, signal) {
  const res = await request('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  text += decoder.decode();
  onText(text);
  return text;
}

const post = (path, body) => call(path, { method: 'POST', body });

export const mediaUrl = path => (path ? `${API_ORIGIN}${path}` : null);

export const fetchStatus = () => call('/status');
/** The person's credits: { enforced, balance, seconds_per_credit, usage }. */
export const fetchCredits = () => call('/credits');
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
