import { useState, useEffect } from "react";
import { getDatasets, getTrainingStatus, startTraining, stopTraining } from "../api";

export default function Training() {
  const [datasets, setDatasets] = useState([]);
  const [status, setStatus] = useState(null);
  const [datasetId, setDatasetId] = useState("");
  const [epochs, setEpochs] = useState(30);
  const [lr, setLr] = useState("5e-6");

  useEffect(() => {
    getDatasets().then(setDatasets);
    const interval = setInterval(() => {
      getTrainingStatus().then(setStatus).catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    if (!datasetId) return;
    await startTraining({ dataset_id: datasetId, language: "es", epochs: Number(epochs), learning_rate: parseFloat(lr) });
  };

  return (
    <div>
      <h1 style={{ marginBottom: "1rem" }}>Training</h1>
      <div className="card">
        <h2>Configuration</h2>
        <label>Dataset</label>
        <select value={datasetId} onChange={e => setDatasetId(e.target.value)}>
          <option value="">Select dataset...</option>
          {datasets.filter(d => d.status === "ready").map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <label>Epochs</label>
        <input type="number" value={epochs} onChange={e => setEpochs(e.target.value)} min={1} max={200} />
        <label>Learning Rate</label>
        <input value={lr} onChange={e => setLr(e.target.value)} />
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <button className="btn btn-primary" onClick={handleStart} disabled={status?.running || !datasetId}>Start</button>
          <button className="btn btn-danger" onClick={stopTraining} disabled={!status?.running}>Stop</button>
        </div>
      </div>
      {status && (
        <div className="card">
          <h2>Status</h2>
          <p>Status: {status.running ? "Running" : "Idle"}</p>
          {status.running && (
            <>
              <p>Epoch {status.current_epoch} / {status.total_epochs}</p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${status.progress * 100}%` }} />
              </div>
              {status.loss !== null && <p>Loss: {status.loss.toFixed(4)}</p>}
            </>
          )}
          <p style={{ color: "#94a3b8", marginTop: "0.5rem" }}>{status.message}</p>
        </div>
      )}
    </div>
  );
}
