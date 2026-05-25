import { useEffect, useMemo, useState } from 'react'
import {
  createDataset, deleteDataset, getDatasets, getTrainingStatus, getVoices,
  getDataset, startTraining, stopTraining, synthesize, uploadAudio,
  updateDataset, logout, login, me, listDatasetAudios, deleteDatasetAudio,
  trimDatasetAudio,
} from './api'
import './App.css'
import logo from './assets/EMMA-LOGO.png'
import LoginForm from './components/LoginForm'

import Sidebar from './layouts/Sidebar'
import Header from './layouts/Header'
import OverviewModule from './modules/overview/OverviewModule'
import TrainingListModule from './modules/training/TrainingListModule'
import TrainingTrainModule from './modules/training/TrainingTrainModule'
import VoicesModule from './modules/voices/VoicesModule'
import { CreateDatasetModal, DatasetDetailModal } from './modules/common/Modals'

const modules = [
  { key: 'overview', label: 'Inicio', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M3 11.5L12 4l9 7.5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M6 10.5V20h12v-9.5" /></svg> },
  { key: 'training', label: 'Entrenamiento', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M4 19h16M6 16l3-4 3 2 4-6 2 2" /></svg> },
  { key: 'voices', label: 'Voces', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M12 3a4 4 0 00-4 4v5a4 4 0 008 0V7a4 4 0 00-4-4z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M5 11a7 7 0 0014 0M12 18v3M9 21h6" /></svg> },
]
const PAGE_SIZE = 12

export default function App() {
  const [active, setActive] = useState(() => localStorage.getItem('emma_active') || 'training')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [openProfile, setOpenProfile] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [username, setUsername] = useState('')

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
  const [localFiles, setLocalFiles] = useState([])
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
  const [localAudioStates, setLocalAudioStates] = useState({})

  const getAudioState = (name) => audioStates[name] || { playing: false, currentTime: 0, duration: 0, volume: 1, trimStart: 0, trimEnd: 0 }
  const getLocalAudioState = (id) => localAudioStates[id] || { playing: false, currentTime: 0, duration: 0, volume: 1, trimStart: 0, trimEnd: 0 }
  const updAudioState = (name, updates) => setAudioStates(prev => ({ ...prev, [name]: { ...(prev[name] || { playing: false, currentTime: 0, duration: 0, volume: 1, trimStart: 0, trimEnd: 0 }), ...updates } }))
  const updLocalAudioState = (id, updates) => setLocalAudioStates(prev => ({ ...prev, [id]: { ...(prev[id] || { playing: false, currentTime: 0, duration: 0, volume: 1, trimStart: 0, trimEnd: 0 }), ...updates } }))

  const formatTime = (s) => {
    if (!s || Number.isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const togglePlay = (name) => {
    const el = document.getElementById(`aplay-${name}`)
    if (!el) return
    if (el.paused) { el.play(); updAudioState(name, { playing: true }) }
    else { el.pause(); updAudioState(name, { playing: false }) }
  }
  const toggleLocalPlay = (id) => {
    const el = document.getElementById(`localplay-${id}`)
    if (!el) return
    if (el.paused) { el.play(); updLocalAudioState(id, { playing: true }) }
    else { el.pause(); updLocalAudioState(id, { playing: false }) }
  }

  const loadDatasets = async () => { try { setDatasets(Array.isArray(await getDatasets()) ? await getDatasets() : []) } catch { setDatasets([]) } }
  const loadVoices = async () => { try { const l = await getVoices(); setVoices(l || []); if (l?.length) setVoice(l[0]) } catch { setVoices([]) } }
  const loadAudios = async (id) => { try { setAudios(await listDatasetAudios(id) || []) } catch { setAudios([]) } }

  useEffect(() => { (async () => { try { const u = await me(); setUsername(u?.username || 'admin'); await loadDatasets(); await loadVoices() } catch { setUsername('') } finally { setAuthLoading(false) } })() }, [])
  useEffect(() => { localStorage.setItem('emma_active', active) }, [active])
  useEffect(() => { localStorage.setItem('emma_training_view', trainingView) }, [trainingView])
  useEffect(() => { const t = setInterval(async () => { try { setStatus(await getTrainingStatus()) } catch {} }, 2000); return () => clearInterval(t) }, [])
  useEffect(() => { if (savedSelectedId && datasets.length) { const f = datasets.find(d => String(d.id) === String(savedSelectedId)); if (f) setSelected(f) } }, [datasets, savedSelectedId])
  useEffect(() => { if (selected?.id) loadAudios(selected.id) }, [selected])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return datasets
    return datasets.filter(d => [d.id, d.name, d.language, d.status].some(v => String(v || '').toLowerCase().includes(q)))
  }, [datasets, query])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const handleCreate = async () => { if (!newDatasetName.trim()) return; await createDataset(newDatasetName.trim(), 'es'); setNewDatasetName(''); setShowCreate(false); await loadDatasets() }
  const handleDelete = async (id) => { await deleteDataset(id); if (selected?.id === id) { setSelected(null); setTrainingView('list'); setSavedSelectedId(''); localStorage.removeItem('emma_selected_id') }; await loadDatasets() }
  const handleEdit = async (d) => { const n = window.prompt('Nuevo nombre', d.name || ''); if (!n?.trim() || n.trim() === d.name) return; await updateDataset(d.id, n.trim()); await loadDatasets() }
  const handleViewDetail = async (d) => { setDetail(await getDataset(d.id)); setShowDetail(true) }
  const handleSelectTrain = (d) => { setSelected(d); setSavedSelectedId(String(d.id)); localStorage.setItem('emma_selected_id', String(d.id)); setTrainingView('train'); setModelName(d.name || '') }

  const handleRemoveLocalFile = (id) => {
    let removed = null
    setLocalFiles(prev => { const target = prev.find(x => x.id === id); if (target) { URL.revokeObjectURL(target.url); removed = target.file }; return prev.filter(x => x.id !== id) })
    setLocalAudioStates(prev => { const next = { ...prev }; delete next[id]; return next })
    if (removed) setFiles(prev => prev.filter(f => f !== removed))
  }

  const handleUpload = async () => {
    if (!selected?.id || !files.length) return
    setUploading(true); setUploadMsg('')
    try {
      const res = await uploadAudio(selected.id, files)
      for (const lf of localFiles) {
        const st = getLocalAudioState(lf.id)
        if ((st.trimStart || 0) > 0 || (st.trimEnd || 0) > 0) {
          const end = st.trimEnd && st.trimEnd > 0 ? st.trimEnd : st.duration
          if (end > st.trimStart) { try { await trimDatasetAudio(selected.id, lf.file.name, st.trimStart || 0, end) } catch {} }
        }
      }
      setUploadMsg(`Audios subidos. Total: ${res.audio_count ?? 0}`)
      localFiles.forEach(lf => URL.revokeObjectURL(lf.url))
      setFiles([]); setLocalFiles([]); setLocalAudioStates({})
      await loadDatasets(); await loadAudios(selected.id)
      setSelected(p => (p ? { ...p, audio_count: res.audio_count ?? p.audio_count } : p))
    } catch { setUploadMsg('Error al subir audios') }
    finally { setUploading(false) }
  }

  const handleDeleteAudio = async (name) => { if (!selected?.id) return; await deleteDatasetAudio(selected.id, name); await loadAudios(selected.id) }
  const handleTrimAudio = async (name, start, end) => { if (!selected?.id) return; try { await trimDatasetAudio(selected.id, name, start, end); setUploadMsg('Audio recortado'); await loadAudios(selected.id) } catch { setUploadMsg('Error al recortar audio') } }

  const handleStartTrain = async () => {
    if (!selected?.id) return
    await startTraining({ dataset_id: selected.id, language: 'es', epochs: Number(epochs), learning_rate: Number(lr), output_model_name: modelName.trim() || selected.name || 'modelo' })
  }
  const handlePreview = async () => { if (!previewText.trim()) return; setPreviewLoading(true); try { setPreviewUrl(URL.createObjectURL(await synthesize(previewText, voice || 'default', 'es', 1.0))) } finally { setPreviewLoading(false) } }
  const handleSynthesize = async () => { if (!ttsText.trim()) return; setTtsLoading(true); try { setTtsUrl(URL.createObjectURL(await synthesize(ttsText, voice || 'default', 'es', 1.0))) } finally { setTtsLoading(false) } }

  const handleLogin = async (user, pass) => { const u = await login(user, pass); setUsername(u?.username || user); await loadDatasets(); await loadVoices() }
  const handleLogout = async () => { try { await logout() } catch {}; window.location.reload() }

  const activeLabel = modules.find(m => m.key === active)?.label || 'EMMA'

  if (authLoading) return <div className="center-card"><p>Cargando...</p></div>
  if (!username) return <LoginForm onLogin={handleLogin} />

  return (
    <div className="shell">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} modules={modules} active={active} setActive={setActive} logo={logo} />
      <section className="main">
        <Header activeLabel={activeLabel} username={username} openProfile={openProfile} setOpenProfile={setOpenProfile} onDashboard={() => { setActive('overview'); setOpenProfile(false) }} onLogout={handleLogout} />

        <div className="content">
          {active === 'overview' && <OverviewModule datasets={datasets} status={status} />}

          {active === 'training' && (trainingView === 'list' || !selected) && (
            <TrainingListModule
              query={query} setQuery={setQuery} setPage={setPage} setShowCreate={setShowCreate}
              filtered={filtered} page={page} totalPages={totalPages} PAGE_SIZE={PAGE_SIZE}
              paged={paged} onViewDetail={handleViewDetail} onSelectTrain={handleSelectTrain}
              onEdit={handleEdit} onDelete={handleDelete}
            />
          )}

          {active === 'training' && trainingView === 'train' && selected && (
            <TrainingTrainModule
              selected={selected} setTrainingView={setTrainingView} setSelected={setSelected} setSavedSelectedId={setSavedSelectedId} setUploadMsg={setUploadMsg}
              files={files} setFiles={setFiles} localFiles={localFiles} setLocalFiles={setLocalFiles} setLocalAudioStates={setLocalAudioStates}
              getLocalAudioState={getLocalAudioState} updLocalAudioState={updLocalAudioState} toggleLocalPlay={toggleLocalPlay} handleRemoveLocalFile={handleRemoveLocalFile}
              handleUpload={handleUpload} uploading={uploading} uploadMsg={uploadMsg}
              audios={audios} getAudioState={getAudioState} togglePlay={togglePlay} updAudioState={updAudioState} handleDeleteAudio={handleDeleteAudio} handleTrimAudio={handleTrimAudio}
              voice={voice} setVoice={setVoice} voices={voices} previewText={previewText} setPreviewText={setPreviewText} handlePreview={handlePreview} previewLoading={previewLoading} previewUrl={previewUrl}
              modelName={modelName} setModelName={setModelName} epochs={epochs} setEpochs={setEpochs} lr={lr} setLr={setLr} handleStartTrain={handleStartTrain} status={status} stopTraining={stopTraining}
            />
          )}

          {active === 'voices' && (
            <VoicesModule
              voices={voices} voice={voice} setVoice={setVoice}
              ttsText={ttsText} setTtsText={setTtsText}
              handleSynthesize={handleSynthesize} ttsLoading={ttsLoading} ttsUrl={ttsUrl}
            />
          )}
        </div>
      </section>

      <CreateDatasetModal showCreate={showCreate} setShowCreate={setShowCreate} newDatasetName={newDatasetName} setNewDatasetName={setNewDatasetName} handleCreate={handleCreate} />
      <DatasetDetailModal showDetail={showDetail} detail={detail} setShowDetail={setShowDetail} />
    </div>
  )
}
