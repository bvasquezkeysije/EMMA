import { datasetAudioUrl, formatTime } from '../../api'
import { useEffect, useRef, useCallback, useState } from 'react'

async function computePeaks(url, pts = 320) {
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
    // Curva perceptual para resaltar mejor altos/bajos en UI.
    p[i] = Math.pow(s / bs, 0.5)
  }
  return Array.from(p)
}

function drawSeekBar(ctx, w, h, peaks, ct, dur, ts, te) {
  ctx.clearRect(0, 0, w, h)
  const waveTop = 8
  const waveBottom = h - 8
  const waveH = waveBottom - waveTop
  const handleTop = 0
  const handleBottom = h

  ctx.fillStyle = '#eee'
  ctx.fillRect(0, waveTop, w, waveH)

  const d = dur || 1
  if (peaks && peaks.length) {
    const mid = waveTop + waveH / 2
    const maxH = waveH * 0.92
    const bw = w / peaks.length
    ctx.fillStyle = '#333'
    for (let i = 0; i < peaks.length; i++) {
      const bh = Math.max(2, peaks[i] * maxH)
      ctx.fillRect(i * bw + 0.5, mid - bh / 2, Math.max(1.4, bw - 1), bh)
    }
  }

  const sx = (ts / d) * w
  const ex = ((te || dur) / d) * w
  ctx.fillStyle = 'rgba(220,53,69,0.05)'
  ctx.fillRect(sx, waveTop, ex - sx, waveH)

  ctx.strokeStyle = '#dc3545'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(sx, handleTop); ctx.lineTo(sx, handleBottom); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(ex, handleTop); ctx.lineTo(ex, handleBottom); ctx.stroke()

  const px = (ct / d) * w
  ctx.fillStyle = 'rgba(0,0,0,0.07)'
  ctx.fillRect(0, waveTop, Math.max(0, px), waveH)

  ctx.strokeStyle = '#4a4a4a'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(px, waveTop); ctx.lineTo(px, waveBottom); ctx.stroke()
}

export default function TrainingTrainModule(props) {
  const {
    selected, setTrainingView, setSelected, setSavedSelectedId, setUploadMsg,
    localFiles, setLocalFiles, setLocalAudioStates,
    getLocalAudioState, updLocalAudioState, toggleLocalPlay, handleRemoveLocalFile, handleApplyLocalTrim,
    handleUpload, uploading, uploadMsg,
    audios, getAudioState, togglePlay, updAudioState, handleDeleteAudio, handleTrimAudio, handleSplitAudio12,
    audioLabels, onEditAudioLabel,
    engine, setEngine, audioChannels, setAudioChannels, sampleRate, setSampleRate,
    qualityMode, setQualityMode, speedRate, setSpeedRate, temperature, setTemperature, topK, setTopK, topP, setTopP, noiseScale, setNoiseScale, precisionMode, setPrecisionMode,
    previewText, setPreviewText, handlePreview, previewLoading, previewUrl,
    modelName, setModelName, epochs, setEpochs, lr, setLr, handleStartTrain, status, stopTraining,
  } = props

  const canvasRefs = useRef({})
  const dragRef = useRef(null)
  const [editingNameKey, setEditingNameKey] = useState(null)
  const [editingNameValue, setEditingNameValue] = useState('')

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
    const st = isLocal ? getLocalAudioState(id) : getAudioState(id)
    if (!st) return
    if (isLocal) {
      const sourceStart = st.sourceStart || 0
      const sourceEnd = st.sourceEnd ?? (sourceStart + (st.duration || 0))
      if (e.target.currentTime >= sourceEnd) {
        e.target.pause()
        upd(id, { playing: false, currentTime: st.duration || 0 })
        drawOne(id, { ...st, currentTime: st.duration || 0 })
        return
      }
      const rel = Math.max(0, e.target.currentTime - sourceStart)
      upd(id, { currentTime: rel })
      drawOne(id, { ...st, currentTime: rel })
      return
    }
    upd(id, { currentTime: e.target.currentTime })
    drawOne(id, { ...st, currentTime: e.target.currentTime })
  }, [updLocalAudioState, updAudioState, getLocalAudioState, getAudioState, drawOne])

  const handleLoadedMetadata = useCallback((id, isLocal, e) => {
    const upd = isLocal ? updLocalAudioState : updAudioState
    const dur = e.target.duration
    upd(id, { duration: dur, trimEnd: dur, sourceStart: 0, sourceEnd: dur })
    computePeaks(e.target.src).then(p => {
      upd(id, { waveform: p })
      const st = isLocal ? getLocalAudioState(id) : getAudioState(id)
      if (st) drawOne(id, { ...st, waveform: p, currentTime: st.currentTime || 0, duration: dur, trimStart: st.trimStart || 0, trimEnd: st.trimEnd || dur })
    }).catch(() => {})
  }, [updLocalAudioState, updAudioState, getLocalAudioState, getAudioState, drawOne])

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
      if (which === 'seek') {
        const el = document.getElementById(isLocal ? `localplay-${id}` : `aplay-${id}`)
        if (el) {
          const base = isLocal ? (st.sourceStart || 0) : 0
          el.currentTime = base + val
        }
        upd(id, { currentTime: val })
        drawOne(id, { ...st, currentTime: val })
      } else if (which === 'start') {
        upd(id, { trimStart: Math.min(val, st.trimEnd || st.duration) })
        drawOne(id, { ...st, trimStart: Math.min(val, st.trimEnd || st.duration) })
      } else {
        upd(id, { trimEnd: Math.max(val, st.trimStart) })
        drawOne(id, { ...st, trimEnd: Math.max(val, st.trimStart) })
      }
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
    const el = document.getElementById(isLocal ? `localplay-${id}` : `aplay-${id}`)
    if (el) {
      const base = isLocal ? (st.sourceStart || 0) : 0
      el.currentTime = base + t
    }
    const upd = isLocal ? updLocalAudioState : updAudioState
    upd(id, { currentTime: t })
    dragRef.current = { id, isLocal, which: 'seek' }
  }

  function renderAudioItem(id, name, isLocal, st, srcUrl, showTrim, canSplit = false, opts = {}) {
    const { editableName = true, showActions = true, showTrimButton = true, playKey = null } = opts
    const audioKey = isLocal ? id : (playKey || name)
    const shownName = audioLabels?.[id] || audioLabels?.[name] || name
    const editKey = isLocal ? id : name
    const isEditing = editingNameKey === editKey

    const saveInlineName = () => {
      const next = (editingNameValue || '').trim()
      if (next && next !== shownName) onEditAudioLabel(editKey, next)
      setEditingNameKey(null)
      setEditingNameValue('')
    }

    return (
      <div key={id} className="card audio-item">
        <div className="audio-item-top">
          {editableName && isEditing ? (
            <input
              className="audio-name-input"
              value={editingNameValue}
              autoFocus
              onChange={e => setEditingNameValue(e.target.value)}
              onBlur={saveInlineName}
              onKeyDown={e => {
                if (e.key === 'Enter') saveInlineName()
                if (e.key === 'Escape') { setEditingNameKey(null); setEditingNameValue('') }
              }}
            />
          ) : editableName ? (
            <button
              className="audio-name-btn"
              title="Editar nombre"
              onClick={() => { setEditingNameKey(editKey); setEditingNameValue(shownName) }}
            >
              {shownName}
            </button>
          ) : (
            <span className="audio-name-static">{shownName}</span>
          )}
          {showActions && (
            <div className="row-actions">
              {!isLocal && canSplit && (
                <button className="mini dark" title="Dividir 12s" onClick={() => handleSplitAudio12(name)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M8 4v16M16 4v16M4 12h16" /></svg>
                </button>
              )}
              <button className="mini red" title={isLocal ? "Quitar" : "Eliminar"} onClick={() => isLocal ? handleRemoveLocalFile(id) : handleDeleteAudio(name)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 7h14M9 7V5h6v2m-7 0l1 12h6l1-12" /></svg>
              </button>
            </div>
          )}
        </div>
        <div className="audio-player-row">
          <button className="play-btn" onClick={() => isLocal ? toggleLocalPlay(id) : togglePlay(audioKey)}>
            {st.playing ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg> : <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19" /></svg>}
          </button>
          <div className="seek-bar-wrap">
            <canvas className="seek-bar-canvas" ref={el => { if (el) canvasRefs.current[id] = el }} onMouseDown={e => handleCanvasDown(e, id, isLocal)} />
            <div className="seek-bar-bottom">
              <div className="seek-bar-time"><span>{formatTime(st.currentTime)}</span><span>{formatTime(st.duration)}</span></div>
              <div className="trim-info-wrap">
                <span className="trim-info-label red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="2" x2="8" y2="22" /></svg>{formatTime(st.trimStart)}</span>
                <span className="trim-info-label dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="2" x2="12" y2="22" /></svg>{formatTime(st.currentTime)}</span>
                <span className="trim-info-label red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="16" y1="2" x2="16" y2="22" /></svg>{formatTime(st.trimEnd || st.duration)}</span>
              </div>
            </div>
          </div>
          {showTrimButton && (
            <button className="mini blue" title="Recortar" onClick={() => isLocal ? handleApplyLocalTrim(id) : handleTrimAudio(name, st.trimStart, st.trimEnd || st.duration)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 17L17 4M11 21L21 11" /></svg>
            </button>
          )}
        </div>
        <audio id={isLocal ? `localplay-${id}` : `aplay-${audioKey}`} src={srcUrl}
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
          setLocalFiles(fs.map((f, i) => ({ id: `${f.name}_${f.lastModified}_${i}`, file: f, url: URL.createObjectURL(f) })))
          setLocalAudioStates({})
        }} />
        {!!localFiles.length && (
          <div className="audio-list" style={{ marginTop: 10 }}>
            {localFiles.map(lf => {
              const st = getLocalAudioState(lf.id)
              return renderAudioItem(lf.id, lf.file.name, true, st, lf.url, false, false)
            })}
          </div>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn dark" onClick={handleUpload} disabled={!localFiles.length || uploading}>{uploading ? 'Subiendo...' : 'Subir a wavs'}</button>
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
              return renderAudioItem(
                a.name,
                a.name,
                false,
                st,
                datasetAudioUrl(selected.id, a.name, a.updated_at || ''),
                true,
                Number(a.duration_seconds || 0) > 12
              )
            })}
          </div>
        )}
      </section>

      <section className="card">
        <h3>Ajustes</h3>
        <div className="grid3">
          <div>
            <label>Motor de voz</label>
            <select value={engine} onChange={e => setEngine(e.target.value)}>
              <option value="coqui_xtts_v2">Coqui XTTS v2</option>
              <option value="f5_tts">F5-TTS</option>
              <option value="openvoice_v2">OpenVoice v2</option>
            </select>
          </div>
          <div>
            <label>Canal</label>
            <select value={audioChannels} onChange={e => setAudioChannels(e.target.value)}>
              <option value="mono">Mono</option>
              <option value="stereo">Estereo</option>
            </select>
          </div>
          <div>
            <label>Sample rate</label>
            <select value={sampleRate} onChange={e => setSampleRate(Number(e.target.value))}>
              <option value={16000}>16000 Hz</option>
              <option value={22050}>22050 Hz</option>
              <option value={24000}>24000 Hz</option>
              <option value={44100}>44100 Hz</option>
            </select>
          </div>
        </div>
        <div className="grid3" style={{ marginTop: 10 }}>
          <div>
            <label>Modo de calidad</label>
            <select
              value={qualityMode}
              onChange={e => {
                const m = e.target.value
                setQualityMode(m)
                if (m === 'fast') { setSpeedRate(1.2); setTemperature(0.55); setTopK(30); setTopP(0.82); setNoiseScale(0.35); setPrecisionMode('fp16') }
                else if (m === 'balanced') { setSpeedRate(1.0); setTemperature(0.7); setTopK(50); setTopP(0.9); setNoiseScale(0.45); setPrecisionMode('fp16') }
                else { setSpeedRate(0.9); setTemperature(0.8); setTopK(80); setTopP(0.95); setNoiseScale(0.55); setPrecisionMode('bf16') }
              }}
            >
              <option value="fast">Rapido</option>
              <option value="balanced">Balanceado</option>
              <option value="hq">Alta calidad</option>
            </select>
          </div>
          <div>
            <label>Velocidad ({speedRate.toFixed(2)}x)</label>
            <input type="range" min={0.7} max={1.4} step={0.01} value={speedRate} onChange={e => setSpeedRate(Number(e.target.value))} />
          </div>
          <div>
            <label>Precision</label>
            <select value={precisionMode} onChange={e => setPrecisionMode(e.target.value)}>
              <option value="fp16">FP16</option>
              <option value="bf16">BF16</option>
              <option value="fp32">FP32</option>
            </select>
          </div>
        </div>
        <div className="grid3" style={{ marginTop: 10 }}>
          <div>
            <label>Temperature ({temperature.toFixed(2)})</label>
            <input type="range" min={0.3} max={1.2} step={0.01} value={temperature} onChange={e => setTemperature(Number(e.target.value))} />
          </div>
          <div>
            <label>Top-k ({topK})</label>
            <input type="range" min={10} max={120} step={1} value={topK} onChange={e => setTopK(Number(e.target.value))} />
          </div>
          <div>
            <label>Top-p ({topP.toFixed(2)})</label>
            <input type="range" min={0.5} max={1.0} step={0.01} value={topP} onChange={e => setTopP(Number(e.target.value))} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label>Noise scale ({noiseScale.toFixed(2)})</label>
          <input type="range" min={0.1} max={1.0} step={0.01} value={noiseScale} onChange={e => setNoiseScale(Number(e.target.value))} />
        </div>
      </section>

      <section className="card">
        <h3>Probar Voz</h3>
        <p className="muted">Escucha como sonara el modelo con una voz de prueba.</p>
        <textarea rows={3} value={previewText} onChange={e => setPreviewText(e.target.value)} />
        <div className="row" style={{ marginTop: 10 }}><button className="btn dark" onClick={handlePreview} disabled={previewLoading}>{previewLoading ? 'Generando...' : 'Generar audio de prueba'}</button></div>
        {previewUrl && (
          <div className="audio-list" style={{ marginTop: 10 }}>
            {renderAudioItem(
              '__preview__',
              'Audio de prueba',
              false,
              getAudioState('__preview__'),
              previewUrl,
              false,
              false,
              { editableName: false, showActions: false, showTrimButton: false, playKey: '__preview__' }
            )}
          </div>
        )}
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
        </div>
        <div className="progress-box">
          <div className="progress-meta"><span>{status?.running ? `Epoca ${status.current_epoch} / ${status.total_epochs}` : 'Sin entrenamiento activo'}</span><b>{Math.round((status?.progress || 0) * 100)}%</b></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.round((status?.progress || 0) * 100)}%` }} /></div>
          <div className="progress-actions">
            <button className="btn danger" onClick={stopTraining} disabled={!status?.running}>Cancelar</button>
          </div>
          {status?.loss !== null && status?.loss !== undefined && <p className="muted" style={{ marginTop: 4 }}>Loss: {status.loss}</p>}
          <p className="muted" style={{ marginTop: 4 }}>{status?.message || '-'}</p>
        </div>
      </section>
    </>
  )
}
