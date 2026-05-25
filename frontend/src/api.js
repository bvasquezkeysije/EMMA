import axios from "axios";

const API = axios.create({ baseURL: "/v1" });

export const getDatasets = () => API.get("/datasets/").then(r => r.data);
export const createDataset = (name, language) => API.post("/datasets/", { name, language }).then(r => r.data);
export const getDataset = (id) => API.get(`/datasets/${id}`).then(r => r.data);
export const deleteDataset = (id) => API.delete(`/datasets/${id}`).then(r => r.data);
export const splitAudios = (id, maxDuration = 12) => API.post(`/datasets/${id}/split-audios`, { max_duration: maxDuration }).then(r => r.data);

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
