import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

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
export const createJob = async (mode, videos, meta = {}, onUploadProgress) => {
  const formData = new FormData();
  formData.append('mode', mode);
  formData.append('videoA', videos.A);
  if (mode === 'compare') formData.append('videoB', videos.B);
  appendDetails(formData, meta);
  const response = await api.post('/jobs', formData, { onUploadProgress });
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
