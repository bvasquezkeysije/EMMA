export default function OverviewModule({ datasets, status }) {
  return (
    <section className="card">
      <h3>Dashboard</h3>
      <p className="muted">Resumen general de EMMA.</p>
      <div className="kpis">
        <div className="kpi"><b>{datasets.length}</b><span>Datasets</span></div>
        <div className="kpi"><b>{datasets.reduce((a, d) => a + (d.audio_count || 0), 0)}</b><span>Audios</span></div>
        <div className="kpi"><b>{status?.running ? 'ON' : 'OFF'}</b><span>Entrenamiento</span></div>
      </div>
    </section>
  )
}
