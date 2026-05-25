export default function TrainingListModule({ query, setQuery, setPage, setShowCreate, filtered, page, totalPages, PAGE_SIZE, paged, onViewDetail, onSelectTrain, onEdit, onDelete }) {
  return (
    <>
      <section className="card toolbar-card">
        <div className="toolbar">
          <input value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="Buscar..." />
          <button className="icon-btn dark" title="Nuevo dataset" onClick={() => setShowCreate(true)}>+</button>
        </div>
      </section>
      <section className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Codigo</th><th>Nombre</th><th>Fecha</th><th>Audios</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {paged.map(d => (
                <tr key={d.id}>
                  <td>{String(d.id).slice(0, 8).toUpperCase()}</td>
                  <td>{d.name}</td>
                  <td>{d.created ? new Date(d.created).toLocaleDateString() : '-'}</td>
                  <td>{d.audio_count || 0}</td>
                  <td>{d.status}</td>
                  <td>
                    <div className="row-actions">
                      <button className="mini blue" title="Ver detalle" onClick={() => onViewDetail(d)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="3" strokeWidth="2.2" /></svg></button>
                      <button className="mini dark" title="Entrenar" onClick={() => onSelectTrain(d)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 19h16M7 15l4-4 3 3 4-6" /></svg></button>
                      <button className="mini yellow" title="Editar" onClick={() => onEdit(d)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 20h4l10-10-4-4L4 16v4zM13 7l4 4" /></svg></button>
                      <button className="mini red" title="Eliminar" onClick={() => onDelete(d.id)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 7h14M9 7V5h6v2m-7 0l1 12h6l1-12" /></svg></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <span>{filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}</span>
          <div>
            <button className="btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
            <span>{page}/{totalPages}</span>
            <button className="btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</button>
          </div>
        </div>
      </section>
    </>
  )
}
