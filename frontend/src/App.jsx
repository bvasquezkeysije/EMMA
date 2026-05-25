import { useEffect, useMemo, useState } from 'react'
import {
  createDataset, deleteDataset, getDatasets, getTrainingStatus, getVoices,
  getDataset, splitAudios, startTraining, stopTraining, synthesize, uploadAudio,
  updateDataset, logout, login, me, listDatasetAudios, deleteDatasetAudio, datasetAudioUrl,
  trimDatasetAudio, formatTime,
} from './api'
import './App.css'
import logo from './assets/EMMA-LOGO.png'
import loginLogo from './assets/EMMA-LOGO-LOGIN.png'

const modules = [
  { key: 'overview', label: 'Inicio',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M3 11.5L12 4l9 7.5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M6 10.5V20h12v-9.5" /></svg> },
  { key: 'training', label: 'Entrenamiento',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M4 19h16M6 16l3-4 3 2 4-6 2 2" /></svg> },
  { key: 'voices', label: 'Voces',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M12 3a4 4 0 00-4 4v5a4 4 0 008 0V7a4 4 0 00-4-4z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M5 11a7 7 0 0014 0M12 18v3M9 21h6" /></svg> },
]

const PAGE_SIZE = 12

export default function App() {
  const [active, setActive] = useState(() => localStorage.getItem('emma_active') || 'training')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [openProfile, setOpenProfile] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [loginUser, setLoginUser] = useState('admin')
  const [loginPass, setLoginPass] = useState('123')
  const [loginErr, setLoginErr] = useState('')

  const [datasets, setDatasets] = useState([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [newDatasetName, setNewDatasetName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [detail, setDetail] = useState(null)
  const [selected, setSelected] = useState(null)
  const [trainingView, setTrainingView] = useState(() => localStorage.getItem('emma_training_view') || 'list')
  const [savedSelectedId, setSavedSelectedId] = useState(() => localStorage.getItem('emma_selected_id') || '')

  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [audios, setAudios] = useState([])

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

  const [audioStates, setAudioStates] = useState({})

  const getAudioState = (name) => audioStates[name] || { playing: false, currentTime: 0, duration: 0, volume: 1, trimStart: 0, trimEnd: 0 }

  const updAudioState = (name, updates) => {
    setAudioStates(prev => ({
      ...prev,
      [name]: { ...(prev[name] || { playing: false, currentTime: 0, duration: 0, volume: 1, trimStart: 0, trimEnd: 0 }), ...updates }
    }))
  }

  const togglePlay = (name) => {
    const el = document.getElementById(`aplay-${name}`)
    if (!el) return
    if (el.paused) { el.play(); updAudioState(name, { playing: true }) }
    else { el.pause(); updAudioState(name, { playing: false }) }
  }

  const handleTrimAudio = async (name, start, end) => {
    if (!selected?.id) return
    try {
      await trimDatasetAudio(selected.id, name, start, end)
      setUploadMsg('Audio recortado')
      await loadAudios(selected.id)
    } catch { setUploadMsg('Error al recortar audio') }
  }

  const loadDatasets = async () => {
    try { setDatasets(Array.isArray(await getDatasets()) ? await getDatasets() : []) }
    catch { setDatasets([]) }
  }
  const loadVoices = async () => {
    try { const l = await getVoices(); setVoices(l || []); if (l?.length) setVoice(l[0]) }
    catch { setVoices([]) }
  }
  const loadAudios = async (id) => {
    try { setAudios(await listDatasetAudios(id) || []) }
    catch { setAudios([]) }
  }

  useEffect(() => {
    (async () => {
      try { const u = await me(); setUsername(u?.username || 'admin'); await loadDatasets(); await loadVoices() }
      catch { setUsername('') }
      finally { setAuthLoading(false) }
    })()
  }, [])

  useEffect(() => { localStorage.setItem('emma_active', active) }, [active])
  useEffect(() => { localStorage.setItem('emma_training_view', trainingView) }, [trainingView])

  useEffect(() => {
    const t = setInterval(async () => {
      try { setStatus(await getTrainingStatus()) } catch {}
    }, 2000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (savedSelectedId && datasets.length) {
      const f = datasets.find(d => String(d.id) === String(savedSelectedId))
      if (f) setSelected(f)
    }
  }, [datasets, savedSelectedId])

  useEffect(() => {
    if (selected?.id) loadAudios(selected.id)
  }, [selected])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return datasets
    return datasets.filter(d => [d.id, d.name, d.language, d.status].some(v => String(v || '').toLowerCase().includes(q)))
  }, [datasets, query])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const handleCreate = async () => {
    if (!newDatasetName.trim()) return
    await createDataset(newDatasetName.trim(), 'es')
    setNewDatasetName(''); setShowCreate(false); await loadDatasets()
  }
  const handleDelete = async (id) => {
    await deleteDataset(id)
    if (selected?.id === id) { setSelected(null); setTrainingView('list'); setSavedSelectedId(''); localStorage.removeItem('emma_selected_id') }
    await loadDatasets()
  }
  const handleEdit = async (d) => {
    const n = window.prompt('Nuevo nombre', d.name || '')
    if (!n?.trim() || n.trim() === d.name) return
    await updateDataset(d.id, n.trim()); await loadDatasets()
  }
  const handleViewDetail = async (d) => {
    setDetail(await getDataset(d.id)); setShowDetail(true)
  }
  const handleSelectTrain = (d) => {
    setSelected(d); setSavedSelectedId(String(d.id)); localStorage.setItem('emma_selected_id', String(d.id))
    setTrainingView('train'); setModelName(d.name || '')
  }

  const handleUpload = async () => {
    if (!selected?.id || !files.length) return
    setUploading(true); setUploadMsg('')
    try {
      const res = await uploadAudio(selected.id, files)
      setUploadMsg(`Audios subidos. Total: ${res.audio_count ?? 0}`)
      setFiles([]); await loadDatasets(); await loadAudios(selected.id)
      setSelected(p => (p ? { ...p, audio_count: res.audio_count ?? p.audio_count } : p))
    } catch { setUploadMsg('Error al subir audios') }
    finally { setUploading(false) }
  }
  const handleSplit = async () => {
    if (!selected?.id) return
    await splitAudios(selected.id, 12)
    setUploadMsg('Audios divididos en clips de 12s')
    await loadDatasets()
  }
  const handleDeleteAudio = async (name) => {
    if (!selected?.id) return
    await deleteDatasetAudio(selected.id, name)
    await loadAudios(selected.id)
  }

  const handleStartTrain = async () => {
    if (!selected?.id) return
    await startTraining({ dataset_id: selected.id, language: 'es', epochs: Number(epochs), learning_rate: Number(lr), output_model_name: modelName.trim() || selected.name || 'modelo' })
  }

  const handlePreview = async () => {
    if (!previewText.trim()) return
    setPreviewLoading(true)
    try { setPreviewUrl(URL.createObjectURL(await synthesize(previewText, voice || 'default', 'es', 1.0))) }
    finally { setPreviewLoading(false) }
  }
  const handleSynthesize = async () => {
    if (!ttsText.trim()) return
    setTtsLoading(true)
    try { setTtsUrl(URL.createObjectURL(await synthesize(ttsText, voice || 'default', 'es', 1.0))) }
    finally { setTtsLoading(false) }
  }

  const handleLogin = async (e) => {
    e.preventDefault(); setLoginErr('')
    try { const u = await login(loginUser, loginPass); setUsername(u?.username || 'admin'); await loadDatasets(); await loadVoices() }
    catch { setLoginErr('Credenciales invalidas') }
  }
  const handleLogout = async () => { try { await logout() } catch {}; window.location.reload() }

  const activeLabel = modules.find(m => m.key === active)?.label || 'EMMA'

  if (authLoading) return <div className="center-card"><p>Cargando...</p></div>

  if (!username) {
    return (
      <div className="center-card">
        <form className="card login-card" onSubmit={handleLogin}>
          <div className="login-logo-wrap"><img src={loginLogo} alt="EMMA" className="login-logo" /></div>
          <h3>EMMA</h3>
          <label>Usuario</label>
          <input value={loginUser} onChange={e => setLoginUser(e.target.value)} />
          <label>Contrasena</label>
          <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} />
          {loginErr && <p className="muted" style={{ color: '#b4232b', marginTop: 8 }}>{loginErr}</p>}
          <button className="btn dark" type="submit">Entrar</button>
        </form>
      </div>
    )
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-head">
          <div className="sidebar-top">
            <button className="toggle" onClick={() => setSidebarOpen(v => !v)}>
              {sidebarOpen
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 6l12 12M18 6L6 18" /></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeWidth="2.2" d="M4 7h16M4 12h16M4 17h16" /></svg>}
            </button>
          </div>
          <div className="sidebar-logo-wrap">
            <img src={logo} alt="EMMA" className={`logo-img ${sidebarOpen ? 'open' : 'closed'}`} />
          </div>
        </div>
        <nav className="menu">
          {modules.map(m => (
            <button key={m.key} className={`menu-btn ${active === m.key ? 'active' : ''}`} onClick={() => setActive(m.key)}>
              <span className="menu-icon">{m.icon}</span>
              <span className="menu-label">{m.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="menu-btn" onClick={() => { setActive('overview') }}>
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
          <div className="profile-wrap">
            <button className="user" onClick={() => setOpenProfile(v => !v)}>{username} ▾</button>
            {openProfile && (
              <div className="profile-menu">
                <button className="profile-item" onClick={() => { setActive('overview'); setOpenProfile(false) }}>Dashboard</button>
                <button className="profile-item danger" onClick={handleLogout}>Cerrar sesion</button>
              </div>
            )}
          </div>
        </header>

        <div className="content">

          {/* === INICIO === */}
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

          {/* === ENTRENAMIENTO - LISTA === */}
          {active === 'training' && (trainingView === 'list' || !selected) && (
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
                              <button className="mini blue" title="Ver detalle" onClick={() => handleViewDetail(d)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="3" strokeWidth="2.2" /></svg>
                              </button>
                              <button className="mini dark" title="Entrenar" onClick={() => handleSelectTrain(d)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 19h16M7 15l4-4 3 3 4-6" /></svg>
                              </button>
                              <button className="mini yellow" title="Editar" onClick={() => handleEdit(d)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 20h4l10-10-4-4L4 16v4zM13 7l4 4" /></svg>
                              </button>
                              <button className="mini red" title="Eliminar" onClick={() => handleDelete(d.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 7h14M9 7V5h6v2m-7 0l1 12h6l1-12" /></svg>
                              </button>
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
          )}

          {/* === ENTRENAMIENTO - TRAIN === */}
          {active === 'training' && trainingView === 'train' && selected && (
            <>
              <section className="card">
                <div className="row between">
                  <div>
                    <h3>Entrenar Modelo</h3>
                    <p className="muted">Dataset: <b>{selected.name}</b> ({selected.id})</p>
                  </div>
                  <button className="btn" onClick={() => { setTrainingView('list'); setSelected(null); setSavedSelectedId(''); localStorage.removeItem('emma_selected_id'); setUploadMsg('') }}>Volver</button>
                </div>
              </section>

              <section className="card">
                <h3>Archivos de Audio</h3>
                <p className="muted">{audios.length} archivo(s) en este dataset:</p>
                <div className="audio-list">
                  {audios.map(a => {
                    const st = getAudioState(a.name)
                    return (
                      <div key={a.name} className="audio-item">
                        <div className="audio-item-top">
                          <span className="audio-name">{a.name}</span>
                          <button className="mini red" title="Eliminar" onClick={() => handleDeleteAudio(a.name)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 7h14M9 7V5h6v2m-7 0l1 12h6l1-12" /></svg>
                          </button>
                        </div>
                        <div className="audio-player-row">
                          <button className="play-btn" onClick={() => togglePlay(a.name)}>
                            {st.playing
                              ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                              : <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19" /></svg>}
                          </button>
                          <div className="audio-progress-wrap">
                            <input type="range" className="audio-progress" min={0} max={st.duration || 0} step={0.01} value={st.currentTime}
                              onChange={e => {
                                const t = parseFloat(e.target.value)
                                const el = document.getElementById(`aplay-${a.name}`)
                                if (el) el.currentTime = t
                                updAudioState(a.name, { currentTime: t })
                              }} />
                            <div className="audio-time">
                              <span>{formatTime(st.currentTime)}</span>
                              <span>{formatTime(st.duration)}</span>
                            </div>
                          </div>
                          <div className="volume-wrap">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="vol-icon"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0014 8.5v7a4.5 4.5 0 002.5-3.5zM14 3.5v2.1a7.5 7.5 0 010 12.8v2.1a9.5 9.5 0 000-17z" /></svg>
                            <input type="range" className="volume-slider" min={0} max={1} step={0.01} value={st.volume}
                              onChange={e => {
                                const v = parseFloat(e.target.value)
                                const el = document.getElementById(`aplay-${a.name}`)
                                if (el) el.volume = v
                                updAudioState(a.name, { volume: v })
                              }} />
                          </div>
                        </div>
                        <div className="audio-trim-row">
                          <label className="trim-label">
                            <span>Inicio</span>
                            <input type="number" min={0} max={st.duration || 0} step={0.1} value={st.trimStart}
                              onChange={e => updAudioState(a.name, { trimStart: Math.max(0, parseFloat(e.target.value) || 0) })} />
                          </label>
                          <label className="trim-label">
                            <span>Fin</span>
                            <input type="number" min={0} max={st.duration || 0} step={0.1} value={st.trimEnd || st.duration}
                              onChange={e => {
                                const v = parseFloat(e.target.value) || 0
                                updAudioState(a.name, { trimEnd: Math.min(v, st.duration || 0) })
                              }} />
                          </label>
                          <button className="mini blue" title="Recortar" onClick={() => handleTrimAudio(a.name, st.trimStart, st.trimEnd || st.duration)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 17L17 4M11 21L21 11" /></svg>
                          </button>
                        </div>
                        <audio id={`aplay-${a.name}`} src={datasetAudioUrl(selected.id, a.name)}
                          onTimeUpdate={e => updAudioState(a.name, { currentTime: e.target.currentTime })}
                          onLoadedMetadata={e => updAudioState(a.name, { duration: e.target.duration })}
                          onEnded={e => updAudioState(a.name, { playing: false })}
                          style={{ display: 'none' }} />
                      </div>
                    )
                  })}
                  {!audios.length && <p className="muted">Sin audios</p>}
                </div>
              </section>

              <section className="card">
                <h3>Carga de Audios</h3>
                <p className="muted">Sube archivos de audio para este dataset.</p>
                <input type="file" multiple accept="audio/*" onChange={e => setFiles(Array.from(e.target.files || []))} />
                {!!files.length && <p className="muted" style={{ marginTop: 4 }}>{files.length} archivo(s) seleccionado(s)</p>}
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn dark" onClick={handleUpload} disabled={!files.length || uploading}>{uploading ? 'Subiendo...' : 'Subir audios'}</button>
                  <button className="btn" onClick={handleSplit}>Dividir clips (12s)</button>
                </div>
                {!!uploadMsg && <p className="muted" style={{ marginTop: 6 }}>{uploadMsg}</p>}
              </section>

              <section className="card">
                <h3>Probar Voz</h3>
                <p className="muted">Escucha como sonara el modelo con una voz de prueba.</p>
                <select value={voice} onChange={e => setVoice(e.target.value)}>
                  {(voices.length ? voices : ['default']).map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <textarea rows={3} value={previewText} onChange={e => setPreviewText(e.target.value)} />
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn dark" onClick={handlePreview} disabled={previewLoading}>{previewLoading ? 'Generando...' : 'Generar audio de prueba'}</button>
                </div>
                {previewUrl && <audio controls src={previewUrl} style={{ width: '100%', marginTop: 10 }} />}
              </section>

              <section className="card">
                <h3>Entrenamiento</h3>
                <div className="grid2">
                  <div>
                    <label>Nombre del modelo</label>
                    <input value={modelName} onChange={e => setModelName(e.target.value)} placeholder="Ej: MiVoz" />
                  </div>
                  <div>
                    <label>Epochs</label>
                    <input type="number" min={1} max={200} value={epochs} onChange={e => setEpochs(e.target.value)} />
                  </div>
                  <div>
                    <label>Learning rate</label>
                    <input value={lr} onChange={e => setLr(e.target.value)} />
                  </div>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn dark" onClick={handleStartTrain} disabled={status?.running}>Iniciar Entrenamiento</button>
                  <button className="btn danger" onClick={stopTraining} disabled={!status?.running}>Cancelar</button>
                </div>
                <div className="progress-box">
                  <div className="progress-meta">
                    <span>{status?.running ? `Epoca ${status.current_epoch} / ${status.total_epochs}` : 'Sin entrenamiento activo'}</span>
                    <b>{Math.round((status?.progress || 0) * 100)}%</b>
                  </div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.round((status?.progress || 0) * 100)}%` }} /></div>
                  {status?.loss !== null && status?.loss !== undefined && <p className="muted" style={{ marginTop: 4 }}>Loss: {status.loss}</p>}
                  <p className="muted" style={{ marginTop: 4 }}>{status?.message || '-'}</p>
                </div>
              </section>
            </>
          )}

          {/* === VOCES === */}
          {active === 'voices' && (
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
          )}

        </div>
      </section>

      {/* Modal crear dataset */}
      {showCreate && (
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
      )}

      {/* Modal detalle */}
      {showDetail && detail && (
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
      )}
    </div>
  )
}
