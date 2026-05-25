export function CreateDatasetModal({ showCreate, setShowCreate, newDatasetName, setNewDatasetName, handleCreate }) {
  if (!showCreate) return null
  return (
    <div className="modal-wrap" onClick={() => setShowCreate(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h4>Nuevo dataset</h4>
        <label>Nombre</label>
        <input value={newDatasetName} onChange={e => setNewDatasetName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
        <div className="row end" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => setShowCreate(false)}>Cancelar</button>
          <button className="btn dark" onClick={handleCreate}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

export function DatasetDetailModal({ showDetail, detail, setShowDetail }) {
  if (!showDetail || !detail) return null
  return (
    <div className="modal-wrap" onClick={() => setShowDetail(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h4>Detalle del dataset</h4>
        <p><b>Codigo:</b> {String(detail.id).slice(0, 8).toUpperCase()}</p>
        <p><b>Nombre:</b> {detail.name}</p>
        <p><b>Idioma:</b> {detail.language || 'es'}</p>
        <p><b>Audios:</b> {detail.audio_count || 0}</p>
        <p><b>Estado:</b> {detail.status || '-'}</p>
        <div className="row end" style={{ marginTop: 12 }}>
          <button className="btn dark" onClick={() => setShowDetail(false)}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
