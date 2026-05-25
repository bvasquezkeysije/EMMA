import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getDatasets, getDataset, createDataset, deleteDataset, uploadAudio, splitAudios } from "../api";

export default function Datasets() {
  const { id } = useParams();
  const [datasets, setDatasets] = useState([]);
  const [detail, setDetail] = useState(null);
  const [name, setName] = useState("");
  const [files, setFiles] = useState([]);

  const load = () => getDatasets().then(setDatasets).catch(() => {});

  useEffect(() => {
    if (id) getDataset(id).then(setDetail).catch(() => setDetail(null));
    else load();
  }, [id]);

  const handleCreate = async () => {
    if (!name) return;
    await createDataset(name);
    setName("");
    load();
  };

  const handleUpload = async () => {
    if (!files.length) return;
    await uploadAudio(id, files);
    setFiles([]);
    getDataset(id).then(setDetail);
  };

  const handleSplit = async () => {
    await splitAudios(id);
    getDataset(id).then(setDetail);
  };

  if (id && detail) {
    return (
      <div>
        <h1 style={{ marginBottom: "1rem" }}>Dataset: {detail.name}</h1>
        <div className="card">
          <p>Language: {detail.language}</p>
          <p>Audio files: {detail.audio_count || 0}</p>
          <p>Status: {detail.status}</p>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button className="btn btn-success" onClick={handleSplit}>Dividir en clips de 12s</button>
            <button className="btn btn-danger" onClick={() => { deleteDataset(id); window.location = "/datasets"; }}>Delete</button>
          </div>
        </div>
        <div className="card">
          <h2>Upload Audio</h2>
          <input type="file" multiple accept="audio/*" onChange={e => setFiles([...e.target.files])} />
          <button className="btn btn-primary" onClick={handleUpload} disabled={!files.length}>Upload</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: "1rem" }}>Datasets</h1>
      <div className="card" style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
        <div style={{ flex: 1 }}>
          <label>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Dataset name" />
        </div>
        <button className="btn btn-primary" onClick={handleCreate} disabled={!name}>Create</button>
      </div>
      <div className="grid">
        {datasets.map(d => (
          <div className="card" key={d.id}>
            <h2>{d.name}</h2>
            <p>Language: {d.language}</p>
            <p>Audio: {d.audio_count || 0}</p>
            <p>Status: {d.status}</p>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <a href={`/datasets/${d.id}`} className="btn btn-primary">Open</a>
              <button className="btn btn-danger" onClick={() => deleteDataset(d.id).then(load)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
