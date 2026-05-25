export default function Header({ activeLabel, username, openProfile, setOpenProfile, onDashboard, onLogout }) {
  return (
    <header className="header">
      <h2>{activeLabel}</h2>
      <div className="profile-wrap">
        <button className="user" onClick={() => setOpenProfile(v => !v)}>{username}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 14, height: 14, marginLeft: 4 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 9l6 6 6-6" /></svg>
        </button>
        {openProfile && (
          <div className="profile-menu">
            <button className="profile-item" onClick={onDashboard}>Dashboard</button>
            <button className="profile-item danger" onClick={onLogout}>Cerrar sesion</button>
          </div>
        )}
      </div>
    </header>
  )
}
