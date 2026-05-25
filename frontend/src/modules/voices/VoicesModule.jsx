export default function VoicesModule({ voices, voice, setVoice, ttsText, setTtsText, handleSynthesize, ttsLoading, ttsUrl }) {
  return (
    <>
      <section className="card">
        <h3>Modelos Disponibles</h3>
        <p className="muted">Voces entrenadas: {voices.length ? voices.join(', ') : 'default'}</p>
        <label>Voz</label>
        <select value={voice} onChange={e => setVoice(e.target.value)}>
          {(voices.length ? voices : ['default']).map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </section>
      <section className="card">
        <h3>Sintesis de Voz</h3>
        <textarea rows={4} value={ttsText} onChange={e => setTtsText(e.target.value)} placeholder="Escribe el texto a sintetizar..." />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn dark" onClick={handleSynthesize} disabled={ttsLoading}>{ttsLoading ? 'Generando...' : 'Generar audio'}</button>
        </div>
        {ttsUrl && <audio controls src={ttsUrl} style={{ width: '100%', marginTop: 10 }} />}
      </section>
    </>
  )
}
