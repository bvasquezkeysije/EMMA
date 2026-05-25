import axios from "axios";

const API = axios.create({ baseURL: "/v1", withCredentials: true });

export const login = (username, password) => API.post("/auth/login", { username, password }).then(r => r.data);
export const me = () => API.get("/auth/me").then(r => r.data);

export const getDatasets = () => API.get("/datasets/").then(r => r.data);
export const createDataset = (name, language) => API.post("/datasets/", { name, language }).then(r => r.data);
export const getDataset = (id) => API.get(`/datasets/${id}`).then(r => r.data);
export const updateDataset = (id, name) => API.patch(`/datasets/${id}`, { name }).then(r => r.data);
export const deleteDataset = (id) => API.delete(`/datasets/${id}`).then(r => r.data);
export const splitAudios = (id, maxDuration = 12) => API.post(`/datasets/${id}/split-audios`, { max_duration: maxDuration }).then(r => r.data);
export const listDatasetAudios = (id) => API.get(`/datasets/${id}/audios`).then(r => r.data);
export const trimDatasetAudio = (id, fileName, startSeconds, endSeconds) =>
  API.post(`/datasets/${id}/audios/${encodeURIComponent(fileName)}/trim`, { start_seconds: startSeconds, end_seconds: endSeconds }).then(r => r.data);
export const deleteDatasetAudio = (id, fileName) =>
  API.delete(`/datasets/${id}/audios/${encodeURIComponent(fileName)}`).then(r => r.data);
export const datasetAudioUrl = (id, fileName) => `/v1/datasets/${id}/audios/${encodeURIComponent(fileName)}/stream`;

export const uploadAudio = (datasetId, files) => {
  const fd = new FormData();
  files.forEach(f => fd.append("files", f));
  return API.post(`/datasets/${datasetId}/upload`, fd).then(r => r.data);
};

export const getTrainingStatus = () => API.get("/training/status").then(r => r.data);
export const startTraining = (body) => API.post("/training/start", body).then(r => r.data);
export const stopTraining = () => API.post("/training/stop").then(r => r.data);

export const getVoices = () => API.get("/voices/").then(r => r.data.voices);
export const synthesize = (text, voice, language, speed) =>
  API.post("/voices/synthesize", { text, voice, language, speed }, { responseType: "blob" }).then(r => r.data);

export const logout = () => API.post("/auth/logout").then(r => r.data);

export const formatTime = (s) => {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
