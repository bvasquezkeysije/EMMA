import { useEffect, useRef, useState } from 'react'
import { formatTime } from '../../api'

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
    p[i] = Math.pow(s / bs, 0.5)
  }
  return Array.from(p)
}

function drawSeekBar(ctx, w, h, peaks, ct, dur) {
  ctx.clearRect(0, 0, w, h)
  const waveTop = 8
  const waveBottom = h - 8
  const waveH = waveBottom - waveTop

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

  const px = (ct / d) * w
  ctx.fillStyle = 'rgba(0,0,0,0.07)'
  ctx.fillRect(0, waveTop, Math.max(0, px), waveH)

  ctx.strokeStyle = '#4a4a4a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(px, waveTop)
  ctx.lineTo(px, waveBottom)
  ctx.stroke()
}

export default function VoicesModule({ models, voice, setVoice, ttsText, setTtsText, handleSynthesize, ttsLoading, ttsUrl }) {
  const list = Array.isArray(models) ? models : []
  const [audioState, setAudioState] = useState({ playing: false, currentTime: 0, duration: 0, waveform: [] })
  const canvasRef = useRef(null)

  const draw = (st = audioState) => {
    const c = canvasRef.current
    if (!c || !st?.waveform?.length) return
    const dpr = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    if (!rect.width) return
    c.width = rect.width * dpr
    c.height = rect.height * dpr
    const ctx = c.getContext('2d')
    ctx.scale(dpr, dpr)
    drawSeekBar(ctx, rect.width, rect.height, st.waveform, st.currentTime || 0, st.duration || 0)
  }

  useEffect(() => {
    if (!ttsUrl) {
      setAudioState({ playing: false, currentTime: 0, duration: 0, waveform: [] })
      return
    }
    computePeaks(ttsUrl).then((p) => {
      setAudioState((prev) => ({ ...prev, waveform: p }))
    }).catch(() => {})
  }, [ttsUrl])

  useEffect(() => { draw() }, [audioState.currentTime, audioState.waveform, audioState.duration])

  const togglePlay = () => {
    const el = document.getElementById('tts-audio')
    if (!el) return
    if (el.paused) {
      el.play()
      setAudioState((s) => ({ ...s, playing: true }))
    } else {
      el.pause()
      setAudioState((s) => ({ ...s, playing: false }))
    }
  }

  const handleCanvasDown = (e) => {
    const el = document.getElementById('tts-audio')
    const c = canvasRef.current
    if (!el || !c || !audioState.duration) return
    const rect = c.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const t = pct * audioState.duration
    el.currentTime = t
    setAudioState((s) => ({ ...s, currentTime: t }))
  }

  return (
    <>
      <section className="card">
        <h3>Modelos Disponibles</h3>
        {list.length === 0 && <p className="muted">Aun no hay modelos entrenados.</p>}
        {list.length > 0 && (
          <div className="audio-list models-grid">
            {list.map((m) => {
              const selected = voice === m.name
              return (
                <button
                  key={m.name}
                  type="button"
                  className={`card audio-item model-card-btn ${selected ? 'active' : ''}`}
                  onClick={() => setVoice(m.name)}
                >
                  <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                    <span className="mini dark" style={{ width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 3a4 4 0 00-4 4v5a4 4 0 008 0V7a4 4 0 00-4-4z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 11a7 7 0 0014 0M12 18v3M9 21h6" />
                      </svg>
                    </span>
                    <div style={{ textAlign: 'left' }}>
                      <b>{m.name}</b>
                      <p className="muted" style={{ margin: 0 }}>Motor: {m.engine || 'coqui_xtts_v2'} | Estado: {m.status || 'ready'}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>
      <section className="card">
        <h3>Convertir texto a voz</h3>
        <textarea rows={4} value={ttsText} onChange={e => setTtsText(e.target.value)} placeholder="Escribe el texto a sintetizar..." />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn dark" onClick={handleSynthesize} disabled={ttsLoading}>{ttsLoading ? 'Generando...' : 'Generar audio'}</button>
        </div>
        {ttsUrl && (
          <div className="card audio-item" style={{ marginTop: 10 }}>
            <div className="audio-item-top">
              <span className="audio-name-static">Audio generado</span>
            </div>
            <div className="audio-player-row">
              <button className="play-btn" onClick={togglePlay}>
                {audioState.playing
                  ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  : <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19" /></svg>}
              </button>
              <div className="seek-bar-wrap">
                <canvas className="seek-bar-canvas" ref={canvasRef} onMouseDown={handleCanvasDown} />
                <div className="seek-bar-bottom">
                  <div className="seek-bar-time">
                    <span>{formatTime(audioState.currentTime)}</span>
                    <span>{formatTime(audioState.duration)}</span>
                  </div>
                </div>
              </div>
            </div>
            <audio
              id="tts-audio"
              src={ttsUrl}
              style={{ display: 'none' }}
              onLoadedMetadata={e => setAudioState((s) => ({ ...s, duration: e.target.duration, currentTime: 0, playing: false }))}
              onTimeUpdate={e => setAudioState((s) => ({ ...s, currentTime: e.target.currentTime }))}
              onEnded={() => setAudioState((s) => ({ ...s, playing: false }))}
            />
          </div>
        )}
      </section>
    </>
  )
}

