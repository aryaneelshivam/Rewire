import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const fetchOverview = async () => {
  const sid = localStorage.getItem('rewire_session') || '';
  const response = await api.get(`/overview?session_id=${sid}`);
  return response.data; // { A: {...}, B: {...} }
};

export const fetchTopRois = async () => {
  const sid = localStorage.getItem('rewire_session') || '';
  const response = await api.get(`/top-rois?session_id=${sid}`);
  return response.data; // { A: {...}, B: {...} }
};

export const fetchEngagement = async () => {
  const sid = localStorage.getItem('rewire_session') || '';
  const response = await api.get(`/engagement?session_id=${sid}`);
  return response.data; // { A: {...}, B: {...} }
};

export const fetchTimeSeries = async () => {
  const sid = localStorage.getItem('rewire_session') || '';
  const response = await api.get(`/timeseries?session_id=${sid}`);
  return response.data; // { A: {...}, B: {...} }
};

export const fetchHeatmap = async () => {
  const sid = localStorage.getItem('rewire_session') || '';
  const response = await api.get(`/heatmap?session_id=${sid}`);
  return response.data; // { A: {...}, B: {...} }
};

export const fetchBrainMesh = async () => {
  const response = await api.get('/brain-mesh');
  return response.data;
};

export const fetchBrainActivation = async (timestep, demographic = "baseline", variant = "A") => {
  const sid = localStorage.getItem('rewire_session') || '';
  const response = await api.get(`/brain-activation/${timestep}?session_id=${sid}&demographic=${demographic}&variant=${variant}`);
  return response.data;
};

export const fetchDemographics = async () => {
  const sid = localStorage.getItem('rewire_session') || '';
  const response = await api.get(`/demographics?session_id=${sid}`);
  return response.data; // { A: {...}, B: {...} }
};

export const fetchABSummary = async () => {
  const sid = localStorage.getItem('rewire_session') || '';
  const response = await api.get(`/ab-summary?session_id=${sid}`);
  return response.data;
};
export const fetchStatus = async () => {
  const sid = localStorage.getItem('rewire_session') || '';
  const response = await api.get(`/status?session_id=${sid}`);
  return response.data;
}

export const uploadPredictions = async (fileA, fileB) => {
  const formData = new FormData();
  formData.append('fileA', fileA);
  formData.append('fileB', fileB);
  
  const response = await api.post('/upload-predictions', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  if (response.data.session_id) {
    localStorage.setItem('rewire_session', response.data.session_id);
  }
  return response.data;
};

export default api;
