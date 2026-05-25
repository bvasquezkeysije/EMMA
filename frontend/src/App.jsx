import { useEffect, useMemo, useState } from 'react'
import {
  createDataset,
  deleteDataset,
  getDatasets,
  getTrainingStatus,
  getVoices,
  splitAudios,
  startTraining,
  stopTraining,
  synthesize,
  uploadAudio,
} from './api'
import './App.css'
import logo from './assets/EMMA-LOGO.png'

const modules = [
  {
    key: 'overview',
    label: 'Inicio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M3 11.5L12 4l9 7.5" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M6 10.5V20h12v-9.5" />
      </svg>
    ),
  },
  {
    key: 'training',
    label: 'Entrenamiento',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M4 19h16M6 16l3-4 3 2 4-6 2 2" />
      </svg>
    ),
  },
  {
    key: 'voices',
    label: 'Voces',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M12 3a4 4 0 00-4 4v5a4 4 0 008 0V7a4 4 0 00-4-4z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M5 11a7 7 0 0014 0M12 18v3M9 21h6" />
      </svg>
    ),
  },
]

const PAGE_SIZE = 12

export default function App() {
  const [active, setActive] = useState(() => localStorage.getItem('emma_active_module') || 'training')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [datasets, setDatasets] = useState([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [newDatasetName, setNewDatasetName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)
  const [trainingView, setTrainingView] = useState(() => localStorage.getItem('emma_training_view') || 'list')
  const [savedSelectedId, setSavedSelectedId] = useState(() => localStorage.getItem('emma_selected_dataset_id') || '')

  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')

  const [epochs, setEpochs] = useState(30)
  const [lr, setLr] = useState('0.000005')
  const [modelName, setModelName] = useState('')
  const [status, setStatus] = useState(null)

  const [voices, setVoices] = useState([])
  const [voice, setVoice] = useState('default')
  const [previewText, setPreviewText] = useState('Buenos dias. Esta es una prueba de voz para EMMA.')
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  const [ttsText, setTtsText] = useState('Hola, esta es una prueba de sintesis con EMMA.')
  const [ttsUrl, setTtsUrl] = useState('')
  const [ttsLoading, setTtsLoading] = useState(false)

  const loadDatasets = async () => {
    try {
      const rows = await getDatasets()
      setDatasets(Array.isArray(rows) ? rows : [])
    } catch {
      setDatasets([])
    }
  }

  const loadVoices = async () => {
    try {
      const list = await getVoices()
      setVoices(list || [])
      if (list?.length) setVoice(list[0])
    } catch {
      setVoices([])
    }
  }

  useEffect(() => {
    loadDatasets()
    loadVoices()
  }, [])

  useEffect(() => {
    localStorage.setItem('emma_active_module', active)
  }, [active])

  useEffect(() => {
    localStorage.setItem('emma_training_view', trainingView)
  }, [trainingView])

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const s = await getTrainingStatus()
        setStatus(s)
      } catch {}
    }, 2000)
    return () => clearInterval(t)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return datasets
    return datasets.filter((d) =>
      [d.id, d.name, d.language, d.status].some((v) => String(v || '').toLowerCase().includes(q))
    )
  }, [datasets, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    if (!savedSelectedId || !datasets.length) return
    const found = datasets.find((d) => String(d.id) === String(savedSelectedId))
    if (found) setSelected(found)
  }, [datasets, savedSelectedId])

  const onCreateDataset = async () => {
    const name = newDatasetName.trim()
    if (!name) return
    await createDataset(name, 'es')
    setNewDatasetName('')
    setShowCreate(false)
    await loadDatasets()
  }

  const onDeleteDataset = async (id) => {
    await deleteDataset(id)
    if (selected?.id === id) {
      setSelected(null)
      setTrainingView('list')
      setSavedSelectedId('')
      localStorage.removeItem('emma_selected_dataset_id')
    }
    await loadDatasets()
  }

  const onUpload = async () => {
    if (!selected?.id || !files.length) return
    setUploading(true)
    setUploadMsg('')
    try {
      const res = await uploadAudio(selected.id, files)
      setUploadMsg(`Audios subidos. Total actual: ${res.audio_count ?? 0}`)
      setFiles([])
      await loadDatasets()
      setSelected((prev) => (prev ? { ...prev, audio_count: res.audio_count ?? prev.audio_count } : prev))
    } catch {
      setUploadMsg('No se pudo subir audios')
    } finally {
      setUploading(false)
    }
  }

  const onSplit = async () => {
    if (!selected?.id) return
    await splitAudios(selected.id, 12)
    await loadDatasets()
    setUploadMsg('Audios divididos en clips de 12s')
  }

  const onStartTrain = async () => {
    if (!selected?.id) return
    await startTraining({
      dataset_id: selected.id,
      language: 'es',
      epochs: Number(epochs),
      learning_rate: Number(lr),
      output_model_name: modelName.trim() || selected.name || 'modelo_emma',
    })
  }

  const onPreview = async () => {
    if (!previewText.trim()) return
    setPreviewLoading(true)
    try {
      const blob = await synthesize(previewText, voice || 'default', 'es', 1.0)
      setPreviewUrl(URL.createObjectURL(blob))
    } finally {
      setPreviewLoading(false)
    }
  }

  const onSynthesize = async () => {
    if (!ttsText.trim()) return
    setTtsLoading(true)
    try {
      const blob = await synthesize(ttsText, voice || 'default', 'es', 1.0)
      setTtsUrl(URL.createObjectURL(blob))
    } finally {
      setTtsLoading(false)
    }
  }

  const activeLabel = modules.find((m) => m.key === active)?.label || 'Dashboard'

  return (
    <div className="shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-head">
          <div className="sidebar-top">
            <button className="toggle" onClick={() => setSidebarOpen((v) => !v)}>{sidebarOpen ? '✕' : '☰'}</button>
          </div>
          <div className="sidebar-logo-wrap">
            <img src={logo} alt="EMMA" className={`logo-img ${sidebarOpen ? 'open' : 'closed'}`} />
          </div>
        </div>
        <nav className="menu">
          {modules.map((m) => (
            <button key={m.key} className={`menu-btn ${active === m.key ? 'active' : ''}`} onClick={() => setActive(m.key)}>
              <span className="menu-icon">{m.icon}</span>
              <span className="menu-label">{m.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="menu-btn">
            <span className="menu-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M12 8.5A3.5 3.5 0 1112 15.5 3.5 3.5 0 0112 8.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M19.4 15a1.6 1.6 0 00.32 1.76l.05.05a2 2 0 11-2.83 2.83l-.05-.05A1.6 1.6 0 0015 19.4a1.6 1.6 0 00-1 .28 1.6 1.6 0 00-.76 1.37V21a2 2 0 11-4 0v-.08a1.6 1.6 0 00-.76-1.37 1.6 1.6 0 00-1-.28 1.6 1.6 0 00-1.76.32l-.05.05a2 2 0 11-2.83-2.83l.05-.05A1.6 1.6 0 004.6 15a1.6 1.6 0 00-.28-1 1.6 1.6 0 00-1.37-.76H3a2 2 0 110-4h.08a1.6 1.6 0 001.37-.76 1.6 1.6 0 00.28-1 1.6 1.6 0 00-.32-1.76l-.05-.05a2 2 0 112.83-2.83l.05.05A1.6 1.6 0 009 4.6a1.6 1.6 0 001-.28 1.6 1.6 0 00.76-1.37V3a2 2 0 114 0v.08a1.6 1.6 0 00.76 1.37 1.6 1.6 0 001 .28 1.6 1.6 0 001.76-.32l.05-.05a2 2 0 112.83 2.83l-.05.05A1.6 1.6 0 0019.4 9a1.6 1.6 0 00.28 1 1.6 1.6 0 001.37.76H21a2 2 0 110 4h-.08a1.6 1.6 0 00-1.37.76 1.6 1.6 0 00-.15.24z" />
              </svg>
            </span>
            <span className="menu-label">Configuracion</span>
          </button>
        </div>
      </aside>

      <section className="main">
        <header className="header">
          <h2>{activeLabel}</h2>
          <div className="user">admin</div>
        </header>

        <div className="content">
          {active === 'overview' && (
            <section className="card">
              <h3>Dashboard</h3>
              <p className="muted">Resumen general de EMMA.</p>
              <div className="kpis">
                <div className="kpi"><b>{datasets.length}</b><span>Datasets</span></div>
                <div className="kpi"><b>{datasets.reduce((a, d) => a + (d.audio_count || 0), 0)}</b><span>Audios</span></div>
                <div className="kpi"><b>{status?.running ? 'ON' : 'OFF'}</b><span>Entrenamiento</span></div>
              </div>
            </section>
          )}

          {active === 'training' && trainingView === 'list' && (
            <>
              <section className="card toolbar-card">
                <div className="toolbar">
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por id, nombre, idioma o estado" />
                  <button className="btn" onClick={() => setPage(1)}>Buscar</button>
                  <button className="btn" onClick={() => { setQuery(''); setPage(1) }}>Limpiar</button>
                  <button className="btn dark" onClick={() => setShowCreate(true)}>+</button>
                </div>
              </section>

              <section className="card table-card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Codigo</th><th>Nombre</th><th>Fecha</th><th>Creador</th><th>Muestra</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                      {paged.map((d) => (
                        <tr key={d.id}>
                          <td>{String(d.id).slice(0, 8).toUpperCase()}</td>
                          <td>{d.name}</td>
                          <td>{d.created ? new Date(d.created).toLocaleDateString() : '-'}</td>
                          <td>admin</td>
                          <td>{d.audio_count || 0}</td>
                          <td>
                            <div className="row-actions">
                              <button className="mini blue" onClick={() => { setSelected(d); setSavedSelectedId(String(d.id)); localStorage.setItem('emma_selected_dataset_id', String(d.id)); setTrainingView('train'); setModelName(d.name || '') }}>Entrenar</button>
                              <button className="mini red" onClick={() => onDeleteDataset(d.id)}>Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pager">
                  <span>Mostrando {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0} - {Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}</span>
                  <div>
                    <button className="btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
                    <span>Pagina {page} / {totalPages}</span>
                    <button className="btn" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
                  </div>
                </div>
              </section>
            </>
          )}

          {active === 'training' && trainingView === 'train' && selected && (
            <>
              <section className="card">
                <div className="row between">
                  <div>
                    <h3>Entrenar Modelo</h3>
                    <p className="muted">Dataset: <b>{selected.name}</b> ({selected.id})</p>
                  </div>
                  <button className="btn" onClick={() => { setTrainingView('list'); setSelected(null); setSavedSelectedId(''); localStorage.removeItem('emma_selected_dataset_id'); setUploadMsg('') }}>Volver</button>
                </div>
              </section>

              <section className="card">
                <h3>Carga de Audios</h3>
                <p className="muted">Sube audios para este dataset.</p>
                <input type="file" multiple accept="audio/*" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn" onClick={onUpload} disabled={!files.length || uploading}>{uploading ? 'Subiendo...' : 'Subir audios'}</button>
                  <button className="btn" onClick={onSplit}>Dividir clips (12s)</button>
                </div>
                {!!files.length && <p className="muted">Seleccionados: {files.length}</p>}
                {!!uploadMsg && <p className="muted">{uploadMsg}</p>}
              </section>

              <section className="card">
                <h3>Probar Voz (Preview)</h3>
                <textarea rows={3} value={previewText} onChange={(e) => setPreviewText(e.target.value)} />
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn" onClick={onPreview} disabled={previewLoading}>{previewLoading ? 'Generando...' : 'Generar audio de prueba'}</button>
                </div>
                {previewUrl && <audio controls src={previewUrl} style={{ width: '100%', marginTop: 10 }} />}
              </section>

              <section className="card">
                <h3>Crear Modelo de Voz</h3>
                <div className="grid2">
                  <div>
                    <label>Nombre del modelo</label>
                    <input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="Ej: MiVoz" />
                  </div>
                  <div>
                    <label>Epochs</label>
                    <input type="number" min={1} max={200} value={epochs} onChange={(e) => setEpochs(e.target.value)} />
                  </div>
                  <div>
                    <label>Learning rate</label>
                    <input value={lr} onChange={(e) => setLr(e.target.value)} />
                  </div>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn dark" onClick={onStartTrain} disabled={status?.running}>Iniciar Entrenamiento</button>
                  <button className="btn" onClick={stopTraining} disabled={!status?.running}>Cancelar</button>
                </div>
                <div className="progress-box">
                  <div className="progress-meta">
                    <span>{status?.running ? `Epoca ${status.current_epoch} / ${status.total_epochs}` : 'Sin entrenamiento activo'}</span>
                    <b>{Math.round((status?.progress || 0) * 100)}%</b>
                  </div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.round((status?.progress || 0) * 100)}%` }} /></div>
                  <p className="muted">{status?.message || '-'}</p>
                </div>
              </section>
            </>
          )}

          {active === 'voices' && (
            <>
              <section className="card">
                <h3>Modelos Entrenados</h3>
                <p className="muted">Disponibles: {voices.length ? voices.join(', ') : 'default'}</p>
                <label>Voz</label>
                <select value={voice} onChange={(e) => setVoice(e.target.value)}>
                  {(voices.length ? voices : ['default']).map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </section>

              <section className="card">
                <h3>Convertir texto a voz</h3>
                <textarea rows={4} value={ttsText} onChange={(e) => setTtsText(e.target.value)} />
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn dark" onClick={onSynthesize} disabled={ttsLoading}>{ttsLoading ? 'Generando...' : 'Generar audio'}</button>
                </div>
                {ttsUrl && <audio controls src={ttsUrl} style={{ width: '100%', marginTop: 10 }} />}
              </section>
            </>
          )}
        </div>
      </section>

      {showCreate && (
        <div className="modal-wrap" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h4>Nuevo dataset</h4>
            <label>Nombre</label>
            <input value={newDatasetName} onChange={(e) => setNewDatasetName(e.target.value)} />
            <div className="row end">
              <button className="btn" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="btn dark" onClick={onCreateDataset}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
