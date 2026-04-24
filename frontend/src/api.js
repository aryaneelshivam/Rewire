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
  formData.append('fileB', fileB);
  
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

export default api;
