export default function Sidebar({ sidebarOpen, setSidebarOpen, modules, active, setActive, logo }) {
  return (
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
        <button className="menu-btn" onClick={() => setActive('overview')}>
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
  )
}
