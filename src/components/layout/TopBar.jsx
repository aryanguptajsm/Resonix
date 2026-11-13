import './TopBar.css';

function TopBar({ status, activePage, onNavigate }) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="topbar__logo">
          <svg
            className="topbar__logo-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          </svg>
          <span className="topbar__logo-text">RESONIX</span>
        </div>
        <nav className="topbar__nav" aria-label="Main navigation">
          <button
            className={`topbar__nav-link ${activePage === 'studio' ? 'topbar__nav-link--active' : ''}`}
            type="button"
            aria-current={activePage === 'studio' ? 'page' : undefined}
            onClick={() => onNavigate?.('studio')}
          >
            Studio
          </button>
          <button
            className="topbar__nav-link"
            type="button"
            onClick={() => onNavigate?.('studio', 'songs')}
          >
            Songs
          </button>
          <button
            className="topbar__nav-link"
            type="button"
            onClick={() => onNavigate?.('studio', 'smart-set')}
          >
            Concert mix
          </button>
          <button
            className={`topbar__nav-link ${activePage === 'roadmap' ? 'topbar__nav-link--active' : ''}`}
            type="button"
            aria-current={activePage === 'roadmap' ? 'page' : undefined}
            onClick={() => onNavigate?.('roadmap')}
          >
            Roadmap
          </button>
        </nav>
      </div>

      <div className="topbar__spacer" />

      <div className="topbar__right">
        <div className="topbar__status" role="status">
          <span className="topbar__status-dot" />
          <span className="topbar__status-text">{status}</span>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
