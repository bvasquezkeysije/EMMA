import { useState, useEffect } from "react";
import { getDatasets, getTrainingStatus } from "../api";

export default function Dashboard() {
  const [datasets, setDatasets] = useState([]);
  const [training, setTraining] = useState(null);

  useEffect(() => {
    getDatasets().then(setDatasets).catch(() => {});
    getTrainingStatus().then(setTraining).catch(() => {});
  }, []);

  const totalAudio = datasets.reduce((s, d) => s + (d.audio_count || 0), 0);
  const ready = datasets.filter(d => d.status === "ready").length;

  return (
    <div>
      <h1 style={{ marginBottom: "1.5rem" }}>Dashboard</h1>
      <div className="grid">
        <div className="card">
          <h2>Datasets</h2>
          <p style={{ fontSize: "2rem", color: "#38bdf8" }}>{datasets.length}</p>
          <p style={{ color: "#94a3b8" }}>{ready} ready</p>
        </div>
        <div className="card">
          <h2>Audio Files</h2>
          <p style={{ fontSize: "2rem", color: "#22c55e" }}>{totalAudio}</p>
          <p style={{ color: "#94a3b8" }}>clips totales</p>
        </div>
        <div className="card">
          <h2>Training</h2>
          {training?.running ? (
            <>
              <p style={{ color: "#facc15" }}>Running</p>
              <p>Epoch {training.current_epoch}/{training.total_epochs}</p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${training.progress * 100}%` }} />
              </div>
            </>
          ) : (
            <p style={{ color: "#94a3b8" }}>Idle</p>
          )}
        </div>
      </div>
    </div>
  );
}
