import './TopBar.css';

function TopBar({ status }) {
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
          <a className="topbar__nav-link" href="#decks">Decks</a>
          <a className="topbar__nav-link" href="#library">Library</a>
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
