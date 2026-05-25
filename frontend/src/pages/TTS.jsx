import { useState, useEffect } from "react";
import { getVoices, synthesize } from "../api";

export default function TTS() {
  const [voices, setVoices] = useState([]);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [speed, setSpeed] = useState(1.0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getVoices().then(v => {
      setVoices(v);
      if (v.length) setVoice(v[0]);
    }).catch(() => {});
  }, []);

  const handleSynthesize = async () => {
    if (!text) return;
    setLoading(true);
    try {
      const blob = await synthesize(text, voice, "es", speed);
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <h1 style={{ marginBottom: "1rem" }}>Synthesize</h1>
      <div className="card">
        <h2>Text to Speech</h2>
        <label>Voice</label>
        <select value={voice} onChange={e => setVoice(e.target.value)}>
          {voices.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <label>Speed</label>
        <input type="range" min="0.5" max="2.0" step="0.1" value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} />
        <span>{speed}x</span>
        <label>Text</label>
        <textarea
          rows={4} value={text} onChange={e => setText(e.target.value)}
          style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontFamily: "inherit", marginBottom: "0.5rem" }}
          placeholder="Escribe el texto a sintetizar..."
        />
        <button className="btn btn-primary" onClick={handleSynthesize} disabled={loading || !text}>
          {loading ? "Generating..." : "Synthesize"}
        </button>
        {audioUrl && (
          <audio controls src={audioUrl} style={{ marginTop: "1rem" }} />
        )}
      </div>
    </div>
  );
}
