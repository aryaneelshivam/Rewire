import axios from 'axios';

// The API's address. Local development talks to the backend on port 8000; a production build is served by the same
// server as the API, so it uses its own address. VITE_API_URL overrides both (for a frontend hosted elsewhere).
const API_ORIGIN = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000');
const API_BASE_URL = `${API_ORIGIN}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
});

// With sign-in on, every request carries the user's Clerk session token. The auth gate registers how to get one;
// Clerk refreshes it as needed, so each request asks afresh. Without sign-in nothing is added.
let getToken = null;
let accountEmail = '';
export const setTokenGetter = fn => { getToken = fn; };
/** The signed-in email, sent along so admins can tell testers apart (it grants nothing; the token decides who you are). */
export const setAccountEmail = email => { accountEmail = email || ''; };
api.interceptors.request.use(async config => {
  const token = getToken ? await getToken() : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (token && accountEmail) config.headers['X-Rewire-Email'] = accountEmail;
  return config;
});

/** A media link from the API (a signed /api/media/... path) as a full URL for <video> and <img>. */
export const mediaUrl = path => (path ? `${API_ORIGIN}${path}` : null);

export const fetchOverview = async () => {
  const response = await api.get('/overview');
  return response.data; // { A: {...}, B: {...} }
};

export const fetchTopRois = async () => {
  const response = await api.get('/top-rois');
  return response.data; // { A: {...}, B: {...} }
};

export const fetchEngagement = async () => {
  const response = await api.get('/engagement');
  return response.data; // { A: {...}, B: {...} }
};

export const fetchTimeSeries = async () => {
  const response = await api.get('/timeseries');
  return response.data; // { A: {...}, B: {...} }
};

export const fetchHeatmap = async () => {
  const response = await api.get('/heatmap');
  return response.data; // { A: {...}, B: {...} }
};

export const fetchBrainMesh = async () => {
  const response = await api.get('/brain-mesh');
  return response.data;
};

export const fetchBrainActivation = async (timestep, demographic = "baseline", variant = "A") => {
  const response = await api.get(`/brain-activation/${timestep}?demographic=${demographic}&variant=${variant}`);
  return response.data;
};

export const fetchDemographics = async () => {
  const response = await api.get('/demographics');
  return response.data; // { A: {...}, B: {...} }
};

export const fetchABSummary = async () => {
  const response = await api.get('/ab-summary');
  return response.data;
};
export const fetchStatus = async () => {
  const response = await api.get('/status');
  return response.data;
}

export const uploadPredictions = async (fileA, fileB, metadataA = {}, metadataB = {}) => {
  const formData = new FormData();
  formData.append('fileA', fileA);
  if (fileB) formData.append('fileB', fileB);
  
  // V4: Append content metadata for each variant
  formData.append('genre_A', metadataA.genre || 'general');
  formData.append('genre_B', metadataB.genre || 'general');
  formData.append('content_type_A', metadataA.content_type || 'video_ad');
  formData.append('content_type_B', metadataB.content_type || 'video_ad');
  formData.append('pacing_A', metadataA.pacing || 'medium');
  formData.append('pacing_B', metadataB.pacing || 'medium');
  formData.append('audio_profile_A', metadataA.audio_profile || 'mixed');
  formData.append('audio_profile_B', metadataB.audio_profile || 'mixed');
  formData.append('brand_reveal_A', metadataA.brand_reveal_timestamp ?? -1);
  formData.append('brand_reveal_B', metadataB.brand_reveal_timestamp ?? -1);
  
  const response = await api.post('/upload-predictions', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const fetchContentProfile = async () => {
  const response = await api.get('/content-profile');
  return response.data;
};

export const loadSampleData = async () => {
  const response = await api.post('/load-sample-data');
  return response.data;
};

export default api;

/** Every simulated viewer of one variant: cohort, trajectory, regional pattern, networks and dimensions. */
export const fetchEnsemble = async (variant = 'A') => {
  const response = await api.get(`/ensemble?variant=${variant}`);
  return response.data;
};

/** A group of viewers' mean regional response at one second, per vertex. mode: cluster, rest or difference. */
export const fetchEnsembleActivation = async (variant, timestep, ids, mode = 'cluster') => {
  const response = await api.post('/ensemble/activation', { variant, timestep, ids, mode });
  return response.data;
};

const appendDetails = (formData, meta = {}) => {
  ['A', 'B'].forEach(v => {
    const m = meta[v] || {};
    formData.append(`genre_${v}`, m.genre || 'general');
    formData.append(`content_type_${v}`, m.content_type || 'video_ad');
    formData.append(`pacing_${v}`, m.pacing || 'medium');
    formData.append(`audio_profile_${v}`, m.audio_profile || 'mixed');
  });
};

/** Starts an analysis of one video ("single") or two ("compare"). Resolves to { job_id }. */
export const createJob = async (mode, videos, meta = {}, onUploadProgress, signal) => {
  const formData = new FormData();
  formData.append('mode', mode);
  formData.append('videoA', videos.A);
  if (mode === 'compare') formData.append('videoB', videos.B);
  appendDetails(formData, meta);
  const response = await api.post('/jobs', formData, { onUploadProgress, signal });
  return response.data;
};

/** The job's stages, per-video progress and status. */
export const fetchJob = async (jobId) => {
  const response = await api.get(`/jobs/${jobId}`);
  return response.data;
};

export const cancelJob = async (jobId) => {
  const response = await api.post(`/jobs/${jobId}/cancel`);
  return response.data;
};

// ── Test credits ─────────────────────────────────────────────────────────
/** { enforced, balance, granted, used, cost_per_video, admin }. Not enforced without sign-in. */
export const fetchCredits = async () => (await api.get('/credits')).data;
/** Admins: every tester with balance and usage. */
export const fetchTesters = async () => (await api.get('/admin/credits')).data;
/** Admins: add (or with a negative number, remove) a tester's credits. */
export const grantCredits = async (user, add, reason) => (await api.post('/admin/credits', { user, add, reason })).data;

// ── Workspace: saved analyses ────────────────────────────────────────────
export const fetchRuns = async () => (await api.get('/runs')).data;              // { runs, current }
export const openRun = async (id) => (await api.post(`/runs/${id}/open`)).data;
export const renameRun = async (id, title) => (await api.patch(`/runs/${id}`, { title })).data;
export const deleteRun = async (id) => (await api.delete(`/runs/${id}`)).data;
/** The Rewire Score per variant: measures, ranks once benchmarked, and the per-second response. */
export const fetchScore = async () => (await api.get('/score')).data;

