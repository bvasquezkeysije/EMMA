import { datasetAudioUrl, formatTime } from '../../api'
import { useEffect, useRef, useCallback } from 'react'

async function computePeaks(url, pts = 200) {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const ac = new AudioContext()
  const ab = await ac.decodeAudioData(buf)
  const ch = ab.getChannelData(0)
  const bs = Math.max(1, Math.floor(ch.length / pts))
  const p = new Float32Array(pts)
  for (let i = 0; i < pts; i++) {
    let s = 0
    const off = i * bs
    for (let j = 0; j < bs; j++) s += Math.abs(ch[off + j] || 0)
    p[i] = s / bs
  }
  return Array.from(p)
}

function drawSeekBar(ctx, w, h, peaks, ct, dur, ts, te) {
  ctx.clearRect(0, 0, w, h)
  const r = 6
  ctx.beginPath()
  ctx.moveTo(r, 0); ctx.lineTo(w - r, 0)
  ctx.quadraticCurveTo(w, 0, w, r); ctx.lineTo(w, h - r)
  ctx.quadraticCurveTo(w, h, w - r, h); ctx.lineTo(r, h)
  ctx.quadraticCurveTo(0, h, 0, h - r); ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0); ctx.closePath()
  ctx.clip()

  ctx.fillStyle = '#eee'
  ctx.fillRect(0, 0, w, h)

  const d = dur || 1
  if (peaks && peaks.length) {
    const mid = h / 2
    const maxH = h * 0.8
    const bw = w / peaks.length
    ctx.fillStyle = '#bbb'
    for (let i = 0; i < peaks.length; i++) {
      const bh = Math.max(1, peaks[i] * maxH)
      ctx.fillRect(i * bw + 1, mid - bh / 2, Math.max(1, bw - 2), bh)
    }
  }

  const sx = (ts / d) * w
  const ex = ((te || dur) / d) * w
  ctx.fillStyle = 'rgba(220,53,69,0.12)'
  ctx.fillRect(sx, 0, ex - sx, h)

  ctx.strokeStyle = '#dc3545'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(ex, 0); ctx.lineTo(ex, h); ctx.stroke()

  const px = (ct / d) * w
  ctx.strokeStyle = '#171717'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke()
}

export default function TrainingTrainModule(props) {
  const {
    selected, setTrainingView, setSelected, setSavedSelectedId, setUploadMsg,
    files, setFiles, localFiles, setLocalFiles, setLocalAudioStates,
    getLocalAudioState, updLocalAudioState, toggleLocalPlay, handleRemoveLocalFile,
    handleUpload, uploading, uploadMsg,
    audios, getAudioState, togglePlay, updAudioState, handleDeleteAudio, handleTrimAudio,
    voice, setVoice, voices, previewText, setPreviewText, handlePreview, previewLoading, previewUrl,
    modelName, setModelName, epochs, setEpochs, lr, setLr, handleStartTrain, status, stopTraining,
  } = props

  const canvasRefs = useRef({})
  const dragRef = useRef(null)

  const drawOne = useCallback((id, st) => {
    const c = canvasRefs.current[id]
    if (!c || !st?.waveform) return
    const dpr = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    if (rect.width === 0) return
    c.width = rect.width * dpr
    c.height = rect.height * dpr
    const ctx = c.getContext('2d')
    ctx.scale(dpr, dpr)
    drawSeekBar(ctx, rect.width, rect.height, st.waveform, st.currentTime || 0, st.duration || 0, st.trimStart || 0, st.trimEnd || st.duration || 0)
  }, [])

  const handleTimeUpdate = useCallback((id, isLocal, e) => {
    const upd = isLocal ? updLocalAudioState : updAudioState
    upd(id, { currentTime: e.target.currentTime })
    const st = isLocal ? getLocalAudioState(id) : getAudioState(id)
    if (st) drawOne(id, { ...st, currentTime: e.target.currentTime })
  }, [updLocalAudioState, updAudioState, getLocalAudioState, getAudioState, drawOne])

  const handleLoadedMetadata = useCallback((id, isLocal, e) => {
    const upd = isLocal ? updLocalAudioState : updAudioState
    upd(id, { duration: e.target.duration, trimEnd: e.target.duration })
    computePeaks(e.target.src).then(p => upd(id, { waveform: p })).catch(() => {})
  }, [updLocalAudioState, updAudioState])

  useEffect(() => {
    function mm(e) {
      const d = dragRef.current
      if (!d) return
      const { id, isLocal, which } = d
      const st = isLocal ? getLocalAudioState(id) : getAudioState(id)
      if (!st) return
      const c = canvasRefs.current[id]
      if (!c) return
      const rect = c.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const val = pct * (st.duration || 1)
      const upd = isLocal ? updLocalAudioState : updAudioState
      if (which === 'start') upd(id, { trimStart: Math.min(val, st.trimEnd || st.duration) })
      else upd(id, { trimEnd: Math.max(val, st.trimStart) })
      drawOne(id, { ...st, trimStart: which === 'start' ? Math.min(val, st.trimEnd || st.duration) : st.trimStart, trimEnd: which === 'end' ? Math.max(val, st.trimStart) : st.trimEnd || st.duration })
    }
    function mu() { dragRef.current = null }
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', mu)
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu) }
  }, [getLocalAudioState, getAudioState, updLocalAudioState, updAudioState, drawOne])

  function handleCanvasDown(e, id, isLocal) {
    const c = e.currentTarget
    const rect = c.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = x / rect.width
    const st = isLocal ? getLocalAudioState(id) : getAudioState(id)
    if (!st || !st.duration) return
    const d = st.duration
    const sx = (st.trimStart / d) * rect.width
    const ex = ((st.trimEnd || d) / d) * rect.width
    if (Math.abs(x - sx) < 8) { dragRef.current = { id, isLocal, which: 'start' }; return }
    if (Math.abs(x - ex) < 8) { dragRef.current = { id, isLocal, which: 'end' }; return }
    const t = pct * d
    const el = document.getElementById(isLocal ? `lplay-${id}` : `aplay-${id}`)
    if (el) el.currentTime = t
    const upd = isLocal ? updLocalAudioState : updAudioState
    upd(id, { currentTime: t })
  }

  function renderAudioItem(id, name, isLocal, st, srcUrl, showTrim) {
    return (
      <div key={id} className="audio-item">
        <div className="audio-item-top">
          <span className="audio-name">{name}</span>
          <button className="mini red" title={isLocal ? "Quitar" : "Eliminar"} onClick={() => isLocal ? handleRemoveLocalFile(id) : handleDeleteAudio(name)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 7h14M9 7V5h6v2m-7 0l1 12h6l1-12" /></svg>
          </button>
        </div>
        <div className="audio-player-row">
          <button className="play-btn" onClick={() => isLocal ? toggleLocalPlay(id) : togglePlay(name)}>
            {st.playing ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg> : <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19" /></svg>}
          </button>
          <div className="seek-bar-wrap">
            <canvas className="seek-bar-canvas" ref={el => { if (el) canvasRefs.current[id] = el }} onMouseDown={e => handleCanvasDown(e, id, isLocal)} />
            <div className="seek-bar-time"><span>{formatTime(st.currentTime)}</span><span>{formatTime(st.duration)}</span></div>
          </div>
        </div>
        {showTrim && (
          <div className="audio-trim-row">
            <div className="trim-info-wrap">
              <span className="trim-info-label red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="2" x2="8" y2="22" /></svg>{formatTime(st.trimStart)}</span>
              <span className="trim-info-label dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="2" x2="12" y2="22" /></svg>{formatTime(st.currentTime)}</span>
              <span className="trim-info-label red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="16" y1="2" x2="16" y2="22" /></svg>{formatTime(st.trimEnd || st.duration)}</span>
            </div>
            <button className="mini blue" title="Recortar" onClick={() => handleTrimAudio(name, st.trimStart, st.trimEnd || st.duration)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 17L17 4M11 21L21 11" /></svg>
            </button>
          </div>
        )}
        <audio id={isLocal ? `lplay-${id}` : `aplay-${id}`} src={srcUrl}
          onTimeUpdate={e => handleTimeUpdate(id, isLocal, e)}
          onLoadedMetadata={e => handleLoadedMetadata(id, isLocal, e)}
          onEnded={() => { const upd = isLocal ? updLocalAudioState : updAudioState; upd(id, { playing: false }) }}
          style={{ display: 'none' }} />
      </div>
    )
  }

  return (
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
        <h3>Cargar audios</h3>
        <p className="muted">Sube archivos de audio para este dataset (carpeta: wavs).</p>
        <input type="file" multiple accept="audio/*" onChange={e => {
          const fs = Array.from(e.target.files || [])
          localFiles.forEach(lf => URL.revokeObjectURL(lf.url))
          setFiles(fs)
          setLocalFiles(fs.map((f, i) => ({ id: `${f.name}_${f.lastModified}_${i}`, file: f, url: URL.createObjectURL(f) })))
          setLocalAudioStates({})
        }} />
        {!!localFiles.length && (
          <div className="audio-list" style={{ marginTop: 10 }}>
            {localFiles.map(lf => {
              const st = getLocalAudioState(lf.id)
              return renderAudioItem(lf.id, lf.file.name, true, st, lf.url, false)
            })}
          </div>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn dark" onClick={handleUpload} disabled={!files.length || uploading}>{uploading ? 'Subiendo...' : 'Subir a wavs'}</button>
        </div>
        {!!uploadMsg && <p className="muted" style={{ marginTop: 6 }}>{uploadMsg}</p>}
      </section>

      <section className="card">
        <h3>Audios subidos</h3>
        <p className="muted">Audios en este dataset:</p>
        {audios.length === 0 && <p className="muted">Sin audios</p>}
        {audios.length > 0 && (
          <div className="audio-list">
            {audios.map(a => {
              const st = getAudioState(a.name)
              return renderAudioItem(a.name, a.name, false, st, datasetAudioUrl(selected.id, a.name), true)
            })}
          </div>
        )}
      </section>

      <section className="card">
        <h3>Probar Voz</h3>
        <p className="muted">Escucha como sonara el modelo con una voz de prueba.</p>
        <select value={voice} onChange={e => setVoice(e.target.value)}>{(voices.length ? voices : ['default']).map(v => <option key={v} value={v}>{v}</option>)}</select>
        <textarea rows={3} value={previewText} onChange={e => setPreviewText(e.target.value)} />
        <div className="row" style={{ marginTop: 10 }}><button className="btn dark" onClick={handlePreview} disabled={previewLoading}>{previewLoading ? 'Generando...' : 'Generar audio de prueba'}</button></div>
        {previewUrl && <audio controls src={previewUrl} style={{ width: '100%', marginTop: 10 }} />}
      </section>

      <section className="card">
        <h3>Entrenamiento</h3>
        <div className="grid2">
          <div><label>Nombre del modelo</label><input value={modelName} onChange={e => setModelName(e.target.value)} placeholder="Ej: MiVoz" /></div>
          <div><label>Epochs</label><input type="number" min={1} max={200} value={epochs} onChange={e => setEpochs(e.target.value)} /></div>
          <div><label>Learning rate</label><input value={lr} onChange={e => setLr(e.target.value)} /></div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn dark" onClick={handleStartTrain} disabled={status?.running}>Iniciar Entrenamiento</button>
          <button className="btn danger" onClick={stopTraining} disabled={!status?.running}>Cancelar</button>
        </div>
        <div className="progress-box">
          <div className="progress-meta"><span>{status?.running ? `Epoca ${status.current_epoch} / ${status.total_epochs}` : 'Sin entrenamiento activo'}</span><b>{Math.round((status?.progress || 0) * 100)}%</b></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.round((status?.progress || 0) * 100)}%` }} /></div>
          {status?.loss !== null && status?.loss !== undefined && <p className="muted" style={{ marginTop: 4 }}>Loss: {status.loss}</p>}
          <p className="muted" style={{ marginTop: 4 }}>{status?.message || '-'}</p>
        </div>
      </section>
    </>
  )
}
