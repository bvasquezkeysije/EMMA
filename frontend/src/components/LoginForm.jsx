import { useState } from 'react'
import loginLogo from '../assets/EMMA-LOGO-LOGIN.png'

export default function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    setLoading(true)
    setError('')
    try {
      await onLogin(username.trim(), password)
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
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Ingresa tu usuario"
          autoFocus
        />
        <label>Contrasena</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Ingresa tu contrasena"
        />
        {error && <p className="muted" style={{ color: '#b4232b', marginTop: 8 }}>{error}</p>}
        <button className="btn dark" type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
