import { useEffect, useState } from 'react'
import loginLogo from '../assets/EMMA-LOGO-LOGIN.png'

export default function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberAccess, setRememberAccess] = useState(() => localStorage.getItem('emma_remember_access') === '1')
  const [savedUsers, setSavedUsers] = useState([])

  useEffect(() => {
    const saved = localStorage.getItem('emma_saved_user')
    const all = JSON.parse(localStorage.getItem('emma_saved_users') || '[]')
    setSavedUsers(Array.isArray(all) ? all : [])
    if (saved) setUsername(saved)
    else setUsername('admin')
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    setLoading(true)
    setError('')
    try {
      await onLogin(username.trim(), password)
      if (rememberAccess) {
        localStorage.setItem('emma_saved_user', username.trim())
        localStorage.setItem('emma_remember_access', '1')
        const prev = JSON.parse(localStorage.getItem('emma_saved_users') || '[]')
        const next = [username.trim(), ...prev.filter(u => u !== username.trim())].slice(0, 8)
        localStorage.setItem('emma_saved_users', JSON.stringify(next))
        setSavedUsers(next)
      } else {
        localStorage.removeItem('emma_saved_user')
        localStorage.removeItem('emma_remember_access')
      }
    } catch {
      setError('Credenciales invalidas')
    }
    setLoading(false)
  }

  return (
    <div className="center-card">
      <form className="card login-card" onSubmit={handleSubmit}>
        <div className="login-logo-wrap">
          <img src={loginLogo} alt="EMMA" className="login-logo" />
        </div>
        <h3>EMMA</h3>
        <label>Usuario</label>
        {savedUsers.length > 0 ? (
          <select value={username} onChange={e => setUsername(e.target.value)} autoFocus>
            {savedUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        ) : (
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Ingresa tu usuario"
            autoFocus
          />
        )}
        <label>Contrasena</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Ingresa tu contrasena"
        />
        <div className="remember-row">
          <input
            id="remember-access"
            type="checkbox"
            checked={rememberAccess}
            onChange={e => setRememberAccess(e.target.checked)}
          />
          <label htmlFor="remember-access">Recordar acceso</label>
        </div>
        {error && <p className="muted" style={{ color: '#b4232b', marginTop: 8 }}>{error}</p>}
        <button className="btn dark" type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
